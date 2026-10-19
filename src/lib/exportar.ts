// Exportar tudo: um .zip com todos os dados desde o início (JSON e planilhas)
// e os arquivos guardados (documentos, comprovantes do cofrinho e fotos).
import { zipSync, strToU8, type Zippable } from 'fflate';
import { NOME_CATEGORIA } from './documentos';
import { chaveDia, horaCurta } from './datas';
import { descrever, NOMES_TIPO } from './registros';
import type { ContaCofrinho, Documento, Marco, MovimentoCofrinho, Registro } from './tipos';

export const celula = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
/** BOM para o Excel abrir com acentos */
const planilha = (linhas: unknown[][]) => '﻿' + linhas.map((l) => l.map(celula).join(';')).join('\n');

export function csvRegistros(registros: Registro[], agora: Date, nomeDe: (id: string | null) => string): string {
  const linhas: unknown[][] = [['data', 'hora', 'tipo', 'resumo', 'detalhe', 'fim', 'observacao', 'registrado_por']];
  for (const r of [...registros].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    const d = descrever(r, agora);
    linhas.push([
      chaveDia(r.inicio),
      horaCurta(r.inicio),
      NOMES_TIPO[r.tipo],
      d.titulo,
      d.detalhe,
      r.fim ? `${chaveDia(r.fim)} ${horaCurta(r.fim)}` : '',
      r.observacao ?? '',
      nomeDe(r.criado_por),
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
      nomes[m.tipo],
      (m.valor_centavos / 100).toFixed(2).replace('.', ','),
      m.de ?? '',
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

const limpar = (s: string) =>
  s
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90) || 'arquivo';
const extensao = (a: { nome?: string; tipo?: string }) => (a.tipo === 'application/pdf' || a.nome?.toLowerCase().endsWith('.pdf') ? 'pdf' : 'jpg');

export interface ArquivoParaBaixar {
  /** Caminho no armazenamento */
  caminho: string;
  /** Onde fica dentro do .zip */
  destino: string;
  balde: 'documentos' | 'fotos';
  /** Título do documento no app */
  documento?: string;
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

/**
 * Os arquivos dos documentos com o nome que o documento tem no app, numa pasta
 * por categoria: "Identificação/Certidão de nascimento.jpg"; com mais de um
 * arquivo, "Certidão de nascimento - 1.jpg", "Certidão de nascimento - 2.jpg".
 */
export function planejarDocumentos(documentos: Documento[], raiz = '', unico = nomesUnicos()): ArquivoParaBaixar[] {
  const lista: ArquivoParaBaixar[] = [];
  const ordem = [...documentos].sort((a, b) => a.categoria.localeCompare(b.categoria) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
  for (const d of ordem) {
    const pasta = [raiz, limpar(NOME_CATEGORIA[d.categoria] ?? 'Outros')].filter(Boolean).join('/');
    const base = limpar(d.titulo || 'Documento');
    d.arquivos.forEach((a, i) =>
      lista.push({
        caminho: a.caminho,
        destino: unico(pasta, d.arquivos.length > 1 ? `${base} - ${i + 1}` : base, extensao(a)),
        balde: 'documentos',
        documento: d.titulo,
      }),
    );
  }
  return lista;
}

/** Lista dos documentos (com número, datas e anotações), para ir junto no .zip */
export function listaDocumentos(documentos: Documento[], noZip: Map<string, string>, bebe: string | null | undefined): string {
  const ordem = [...documentos].sort((a, b) => a.categoria.localeCompare(b.categoria) || a.titulo.localeCompare(b.titulo, 'pt-BR'));
  const linhas = [`Documentos${bebe ? ` do ${bebe}` : ''} · ${ordem.length} ${ordem.length === 1 ? 'documento' : 'documentos'}`, ''];
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
    const arquivos = d.arquivos.map((a) => noZip.get(a.caminho)).filter(Boolean);
    linhas.push(arquivos.length ? `  Arquivos: ${arquivos.map((a) => a!.split('/').slice(-2).join('/')).join(', ')}` : '  (sem arquivo)');
    linhas.push('');
  }
  return linhas.join('\n');
}

/** A lista de arquivos e onde cada um vai ficar no .zip (sem nomes repetidos) */
export function planejarArquivos(documentos: Documento[], movimentos: MovimentoCofrinho[], contas: ContaCofrinho[], marcos: Marco[]): ArquivoParaBaixar[] {
  const unico = nomesUnicos();
  const lista = planejarDocumentos(documentos, 'documentos', unico);
  const conta = new Map(contas.map((c) => [c.id, c.nome]));
  for (const m of movimentos)
    if (m.comprovante)
      lista.push({
        caminho: m.comprovante.caminho,
        destino: unico('cofrinho/comprovantes', limpar(`${m.data} ${conta.get(m.conta_id) ?? ''} ${m.de ?? ''}`.trim()), extensao(m.comprovante)),
        balde: 'documentos',
      });
  for (const m of [...marcos].sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''))) {
    if (!m.foto) continue;
    lista.push({
      caminho: m.foto,
      destino: unico('fotos', limpar(`${m.data ?? 'sem data'} ${m.titulo ?? (m.tipo === 'mes' ? 'foto do mês' : (m.marco_id ?? 'marco'))}`), 'jpg'),
      balde: 'fotos',
    });
  }
  return lista;
}

export interface ConteudoZip {
  dados: unknown;
  textos: Record<string, string>;
  arquivos: { destino: string; bytes: Uint8Array }[];
}

/** Monta o .zip (arquivos já comprimidos, como JPEG e PDF, entram sem recomprimir) */
export function montarZip(pasta: string, c: ConteudoZip): Uint8Array {
  const z: Zippable = {};
  z[`${pasta}/dados.json`] = [strToU8(JSON.stringify(c.dados, null, 2)), { level: 6 }];
  for (const [nome, texto] of Object.entries(c.textos)) z[`${pasta}/${nome}`] = [strToU8(texto), { level: 6 }];
  for (const a of c.arquivos) z[`${pasta}/${a.destino}`] = [a.bytes, { level: 0 }];
  return zipSync(z);
}
