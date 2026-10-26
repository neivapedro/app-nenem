// Exportar tudo: um .zip com todos os dados desde o início (JSON e planilhas)
// e os arquivos guardados (documentos, comprovantes do cofrinho e fotos).
import { strToU8, Zip, ZipDeflate, ZipPassThrough } from 'fflate';
import { MARCOS_CADERNETA } from './conteudo';
import { NOME_CATEGORIA } from './documentos';
import { chaveDia, horaCurta } from './datas';
import { descrever, duracaoPorLado, NOMES_TIPO } from './registros';
import type { ContaCofrinho, Documento, Marco, MovimentoCofrinho, Registro } from './tipos';

export const celula = (v: unknown) => {
  const bruto = v === null || v === undefined ? '' : String(v);
  // Texto que começa com = + @ (ou - sem número) viraria fórmula no Excel: entra como texto
  const s = /^[=+@\t]|^-(?!\d)/.test(bruto) ? `'${bruto}` : bruto;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** BOM para o Excel abrir com acentos */
const planilha = (linhas: unknown[][]) => '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\n');

/** Número com vírgula (Excel/Numbers em português somam direto) */
const num = (v: number | null | undefined, casas = 0) => (v === null || v === undefined || !isFinite(v) ? '' : v.toFixed(casas).replace('.', ','));
const minutos = (ms: number) => num(ms / 60_000, 1);

export function csvRegistros(registros: Registro[], agora: Date, nomeDe: (id: string | null) => string): string {
  // Colunas de texto (como antes) + colunas só com números, para somar e fazer gráfico no Excel
  const linhas: unknown[][] = [
    ['data', 'hora', 'tipo', 'resumo', 'detalhe', 'fim', 'observacao', 'registrado_por', 'duracao_min', 'peito_e_min', 'peito_d_min', 'comecou_no_peito', 'ml', 'xixi', 'coco', 'cor_coco', 'temperatura_c', 'remedio', 'dose'],
  ];
  for (const r of [...registros].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    const d = descrever(r, agora);
    const fimMs = r.fim ? new Date(r.fim).getTime() : null;
    const n = {
      duracao: '',
      e: '',
      dd: '',
      lado: '',
      ml: '',
      xixi: '',
      coco: '',
      cor: '',
      graus: '',
      remedio: '',
      dose: '',
    };
    if (r.tipo === 'mamada') {
      const lados = duracaoPorLado(r, agora);
      n.duracao = minutos(lados.total);
      n.e = minutos(lados.E);
      n.dd = minutos(lados.D);
      n.lado = r.dados.segmentos[0]?.lado ?? '';
    } else if (r.tipo === 'sono') {
      n.duracao = fimMs ? minutos(fimMs - new Date(r.inicio).getTime()) : '';
    } else if (r.tipo === 'mamadeira') {
      n.ml = num(Number(r.dados.ml) || 0);
    } else if (r.tipo === 'extracao') {
      n.ml = num((r.dados.ml_e || 0) + (r.dados.ml_d || 0));
    } else if (r.tipo === 'fralda') {
      n.xixi = r.dados.xixi ? '1' : '0';
      n.coco = r.dados.coco ? '1' : '0';
      n.cor = r.dados.coco ? (r.dados.cor ?? '') : '';
    } else if (r.tipo === 'temperatura') {
      n.graus = num(r.dados.graus, 1);
    } else if (r.tipo === 'remedio') {
      n.remedio = r.dados.nome;
      n.dose = r.dados.dose ?? '';
    }
    linhas.push([
      chaveDia(r.inicio),
      horaCurta(r.inicio),
      NOMES_TIPO[r.tipo],
      d.titulo,
      d.detalhe,
      r.fim ? `${chaveDia(r.fim)} ${horaCurta(r.fim)}` : '',
      r.observacao ?? '',
      nomeDe(r.criado_por),
      n.duracao,
      n.e,
      n.dd,
      n.lado,
      n.ml,
      n.xixi,
      n.coco,
      n.cor,
      n.graus,
      n.remedio,
      n.dose,
    ]);
  }
  return planilha(linhas);
}

export function csvCofrinho(contas: ContaCofrinho[], movimentos: MovimentoCofrinho[]): string {
  const conta = new Map(contas.map((c) => [c.id, c.nome]));
  const nomes = { deposito: 'Depósito', retirada: 'Retirada', saldo: 'Saldo do extrato' } as const;
  const linhas: unknown[][] = [['data', 'conta', 'tipo', 'valor', 'de', 'ocasiao', 'recado', 'observacao']];
  for (const m of [...movimentos].sort((a, b) => a.data.localeCompare(b.data))) {
    linhas.push([
      m.data,
      conta.get(m.conta_id) ?? '',
      // Transferência entre contas: não é dinheiro novo (somar "Depósito" daria a mais)
      m.transferencia_id ? (m.tipo === 'deposito' ? 'Transferência (entrada)' : 'Transferência (saída)') : nomes[m.tipo],
      (m.valor_centavos / 100).toFixed(2).replace('.', ','),
      m.transferencia_id
        ? `${m.tipo === 'deposito' ? 'de' : 'para'} ${conta.get(movimentos.find((x) => x.transferencia_id === m.transferencia_id && x.id !== m.id)?.conta_id ?? '') ?? 'outra conta'}`
        : (m.de ?? ''),
      m.ocasiao ?? '',
      m.recado ?? '',
      m.observacao ?? '',
    ]);
  }
  return planilha(linhas);
}

/** Junta os registros buscados no banco com os do app (os do app ganham: têm as mudanças ainda não enviadas) */
export function juntarRegistros(doBanco: Registro[], doApp: Registro[]): Registro[] {
  const porId = new Map(doBanco.map((r) => [r.id, r]));
  for (const r of doApp) porId.set(r.id, r);
  return [...porId.values()].sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** Nome seguro para o app Arquivos do iPhone, Windows e Mac */
export const limpar = (s: string) =>
  s
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    // Começando com ponto, o arquivo fica oculto
    .replace(/^[.\s]+/, '')
    .slice(0, 90)
    .trim() || 'arquivo';

/** A extensão vem do próprio caminho guardado (sempre .jpg ou .pdf); o tipo e o nome ficam de reserva */
const extensao = (a: { caminho?: string; nome?: string; tipo?: string }) => {
  const doCaminho = a.caminho?.toLowerCase().match(/\.(pdf|jpe?g|png)$/)?.[1];
  if (doCaminho) return doCaminho === 'jpeg' ? 'jpg' : doCaminho;
  return a.tipo === 'application/pdf' || a.nome?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'jpg';
};

export interface ArquivoParaBaixar {
  /** Caminho no armazenamento */
  caminho: string;
  /** Onde fica dentro do .zip */
  destino: string;
  balde: 'documentos' | 'fotos';
  /** De qual documento (id) e qual arquivo dele (posição) */
  docId?: string;
  indice?: number;
}

/** Nomes únicos dentro do .zip (sem diferenciar maiúsculas): "RG.jpg", "RG (2).jpg" */
function nomesUnicos() {
  const usados = new Set<string>();
  return (pasta: string, nome: string, ext: string) => {
    let n = 1;
    let p = `${pasta}/${nome}.${ext}`;
    while (usados.has(p.toLowerCase())) p = `${pasta}/${nome} (${++n}).${ext}`;
    usados.add(p.toLowerCase());
    return p;
  };
}

const ordenarDocs = (documentos: Documento[]) =>
  [...documentos].sort((a, b) => a.categoria.localeCompare(b.categoria) || a.titulo.localeCompare(b.titulo, 'pt-BR', { numeric: true }));

/**
 * Os arquivos dos documentos com o nome que o documento tem no app, numa pasta
 * por categoria: "Identificação/Certidão de nascimento.jpg"; com mais de um
 * arquivo, "Certidão de nascimento - 1.jpg", "Certidão de nascimento - 2.jpg".
 */
export function planejarDocumentos(documentos: Documento[], raiz = '', unico = nomesUnicos()): ArquivoParaBaixar[] {
  const lista: ArquivoParaBaixar[] = [];
  for (const d of ordenarDocs(documentos)) {
    const pasta = [raiz, limpar(NOME_CATEGORIA[d.categoria] ?? 'Outros')].filter(Boolean).join('/');
    const base = limpar(d.titulo || 'Documento');
    d.arquivos.forEach((a, i) =>
      lista.push({
        caminho: a.caminho,
        destino: unico(pasta, d.arquivos.length > 1 ? `${base} - ${i + 1}` : base, extensao(a)),
        balde: 'documentos',
        docId: d.id,
        indice: i,
      }),
    );
  }
  return lista;
}

/** Lista dos documentos (com número, datas e anotações), para ir junto no .zip. `baixados` = os arquivos que entraram */
export function listaDocumentos(documentos: Documento[], baixados: ArquivoParaBaixar[], titulo: string): string {
  const onde = new Map(baixados.filter((a) => a.docId).map((a) => [`${a.docId}#${a.indice}`, a.destino]));
  const ordem = ordenarDocs(documentos);
  const linhas = [`${titulo} · ${ordem.length} ${ordem.length === 1 ? 'documento' : 'documentos'}`, ''];
  let categoria = '';
  for (const d of ordem) {
    const nomeCat = NOME_CATEGORIA[d.categoria] ?? 'Outros';
    if (nomeCat !== categoria) {
      categoria = nomeCat;
      linhas.push(`== ${categoria} ==`);
    }
    linhas.push(`• ${d.titulo}`);
    if (d.numero) linhas.push(`  Número: ${d.numero}`);
    if (d.data) linhas.push(`  Data: ${d.data.split('-').reverse().join('/')}`);
    if (d.validade) linhas.push(`  Validade: ${d.validade.split('-').reverse().join('/')}`);
    if (d.observacao) linhas.push(`  Anotação: ${d.observacao}`);
    const arquivos = d.arquivos.map((_, i) => onde.get(`${d.id}#${i}`));
    const ok = arquivos.filter((a): a is string => !!a);
    if (ok.length) linhas.push(`  Arquivos: ${ok.map((a) => a.split('/').slice(-2).join('/')).join(', ')}`);
    if (ok.length < arquivos.length) linhas.push(`  ${arquivos.length - ok.length} arquivo(s) não baixado(s) — tente de novo com internet`);
    if (!arquivos.length) linhas.push('  (sem arquivo)');
    linhas.push('');
  }
  return linhas.join('\n');
}

/** A lista de arquivos e onde cada um vai ficar no .zip (sem nomes repetidos) */
export function planejarArquivos(
  documentos: Documento[],
  movimentos: MovimentoCofrinho[],
  contas: ContaCofrinho[],
  marcos: Marco[],
  fotoBebe?: string | null,
): ArquivoParaBaixar[] {
  const unico = nomesUnicos();
  const lista = planejarDocumentos(documentos, 'documentos', unico);
  if (fotoBebe) lista.push({ caminho: fotoBebe, destino: unico('fotos', 'Foto do bebê', extensao({ caminho: fotoBebe })), balde: 'fotos' });
  const conta = new Map(contas.map((c) => [c.id, c.nome]));
  for (const m of [...movimentos].sort((a, b) => a.data.localeCompare(b.data)))
    if (m.comprovante)
      lista.push({
        caminho: m.comprovante.caminho,
        destino: unico('cofrinho/comprovantes', limpar(`${m.data} ${conta.get(m.conta_id) ?? ''} ${m.de ?? ''}`), extensao(m.comprovante)),
        balde: 'documentos',
      });
  for (const m of [...marcos].sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''))) {
    if (!m.foto) continue;
    // Foto do mês: o número do mês no nome (senão ficavam todas "Foto do mês (7)")
    const n = Number(m.marco_id?.replace('mes-', ''));
    const nome =
      m.tipo === 'mes' && Number.isFinite(n)
        ? `Foto do mês ${String(n).padStart(2, '0')}${m.titulo?.trim() ? ` - ${m.titulo.trim()}` : ''}`
        : m.titulo?.trim() || (m.tipo === 'caderneta' ? (MARCOS_CADERNETA.find((c) => c.id === m.marco_id)?.descricao ?? 'Marco') : 'Primeira vez');
    lista.push({ caminho: m.foto, destino: unico('fotos', limpar(`${m.data ?? 'sem data'} ${nome}`), extensao({ caminho: m.foto })), balde: 'fotos' });
  }
  return lista;
}

/**
 * Monta o .zip aos poucos: cada arquivo entra e já pode ser solto da memória
 * (importante no iPhone, com muitas fotos e PDFs). Fotos e PDFs entram sem
 * recomprimir; textos são comprimidos.
 */
export class MontadorZip {
  private partes: Uint8Array[] = [];
  private erro: Error | null = null;
  private zip = new Zip((e, dados) => {
    if (e) this.erro = e;
    else this.partes.push(dados);
  });

  adicionar(nome: string, bytes: Uint8Array) {
    const f = new ZipPassThrough(nome);
    this.zip.add(f);
    f.push(bytes, true);
  }

  adicionarTexto(nome: string, texto: string) {
    const f = new ZipDeflate(nome, { level: 6 });
    this.zip.add(f);
    f.push(strToU8(texto), true);
  }

  terminar(): Blob {
    this.zip.end();
    if (this.erro) throw this.erro;
    const blob = new Blob(this.partes as BlobPart[], { type: 'application/zip' });
    this.partes = [];
    return blob;
  }
}
