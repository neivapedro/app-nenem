// Exportar tudo: um .zip com todos os dados desde o início (JSON e planilhas)
// e os arquivos guardados (documentos, comprovantes do cofrinho e fotos).
import { zipSync, strToU8, type Zippable } from 'fflate';
import { NOME_CATEGORIA, nomeArquivo } from './documentos';
import { chaveDia, horaCurta } from './datas';
import { descrever, NOMES_TIPO } from './registros';
import type { ArquivoDocumento, Bebe, ContaCofrinho, Documento, Marco, MovimentoCofrinho, Registro } from './tipos';

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
}

/** A lista de arquivos e onde cada um vai ficar no .zip (sem nomes repetidos) */
export function planejarArquivos(
  bebe: Bebe | null,
  documentos: Documento[],
  movimentos: MovimentoCofrinho[],
  contas: ContaCofrinho[],
  marcos: Marco[],
): ArquivoParaBaixar[] {
  const usados = new Set<string>();
  const unico = (pasta: string, nome: string, ext: string) => {
    let n = 1;
    let p = `${pasta}/${nome}.${ext}`;
    while (usados.has(p.toLowerCase())) p = `${pasta}/${nome} (${++n}).${ext}`;
    usados.add(p.toLowerCase());
    return p;
  };
  const lista: ArquivoParaBaixar[] = [];
  const doc = (a: ArquivoDocumento, pasta: string, nome: string) =>
    lista.push({ caminho: a.caminho, destino: unico(pasta, limpar(nome), extensao(a)), balde: 'documentos' });

  for (const d of [...documentos].sort((a, b) => a.titulo.localeCompare(b.titulo))) {
    const pasta = `documentos/${limpar(NOME_CATEGORIA[d.categoria])}`;
    const base = nomeArquivo(d.titulo, d.categoria === 'familia' ? null : bebe?.nome, 'x').replace(/\.x$/, '');
    d.arquivos.forEach((a, i) => doc(a, pasta, d.arquivos.length > 1 ? `${base} - ${i + 1}` : base));
  }
  const conta = new Map(contas.map((c) => [c.id, c.nome]));
  for (const m of movimentos) if (m.comprovante) doc(m.comprovante, 'cofrinho/comprovantes', `${m.data} ${conta.get(m.conta_id) ?? ''} ${m.de ?? ''}`.trim());
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
