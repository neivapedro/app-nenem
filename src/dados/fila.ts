import { COLECOES, type Bebe, type Colecoes, type Compromisso, type NomeColecao, type Registro } from '../lib/tipos';
import type { Repositorio } from './repositorio';

// Fila de gravações guardada no aparelho. A tela muda na hora (otimista) e a
// gravação vai em seguida, uma de cada vez. Sem internet, a fila espera e é
// enviada quando a conexão volta, mesmo que o app seja fechado no meio.
// Cada registro leva o id criado no aparelho: reenviar nunca duplica.

export type Operacao =
  | { tipo: 'registro'; dado: Registro }
  | { tipo: 'compromisso'; dado: Compromisso }
  | { tipo: 'bebe'; dado: Bebe }
  | { [K in NomeColecao]: { tipo: 'colecao'; colecao: K; dado: Colecoes[K] } }[NomeColecao]
  // Exclusão também passa pela fila: substitui uma edição pendente do mesmo item
  | { tipo: 'excluir'; dado: { alvo: 'registro' | 'compromisso' | NomeColecao; id: string } };

export type ItemFila = Operacao & { chave: string; versao: number };

export function chaveDe(op: Operacao): string {
  if (op.tipo === 'excluir') return `${op.dado.alvo}:${op.dado.id}`;
  if (op.tipo === 'colecao') return `${op.colecao}:${op.dado.id}`;
  return `${op.tipo}:${op.dado.id}`;
}

const PREFIXO_FILA = 'app-nenem:fila:';
const PREFIXO_CACHE = 'app-nenem:cache:';

export function lerFila(usuario: string): ItemFila[] {
  try {
    const v = JSON.parse(localStorage.getItem(PREFIXO_FILA + usuario) ?? '[]');
    return Array.isArray(v) ? (v as ItemFila[]) : [];
  } catch {
    return [];
  }
}

export function gravarFila(usuario: string, fila: ItemFila[]) {
  try {
    if (fila.length) localStorage.setItem(PREFIXO_FILA + usuario, JSON.stringify(fila));
    else localStorage.removeItem(PREFIXO_FILA + usuario);
  } catch {
    /* armazenamento indisponível: a fila segue só na memória */
  }
}

/** Uma operação nova substitui a anterior com a mesma chave (o último estado vale). */
export function enfileirar(fila: ItemFila[], op: Operacao, versao: number): ItemFila[] {
  const chave = chaveDe(op);
  return [...fila.filter((i) => i.chave !== chave), { ...op, chave, versao }];
}

export async function executarOperacao(repo: Repositorio, op: Operacao): Promise<void> {
  if (op.tipo === 'registro') return repo.salvarRegistro(op.dado);
  if (op.tipo === 'compromisso') return repo.salvarCompromisso(op.dado);
  if (op.tipo === 'bebe') return repo.salvarBebe(op.dado);
  if (op.tipo === 'colecao') return repo.salvarColecao(op.colecao, op.dado as never);
  if (op.dado.alvo === 'registro') return repo.excluirRegistro(op.dado.id);
  if (op.dado.alvo === 'compromisso') return repo.excluirCompromisso(op.dado.id);
  return repo.excluirColecao(op.dado.alvo, op.dado.id);
}

export type ListasColecoes = { [K in NomeColecao]: Colecoes[K][] };

export interface DadosFila extends ListasColecoes {
  bebe: Bebe | null;
  registros: Registro[];
  compromissos: Compromisso[];
}

export const LISTAS_VAZIAS: ListasColecoes = { medidas: [], vacinas: [], remedios: [], leite: [], marcos: [], tarefas: [], documentos: [], cofrinho_contas: [], cofrinho_movimentos: [], cofrinho_metas: [], cofrinho_planos: [] };

const porInicio = (a: Registro, b: Registro) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime();
const porData = (a: Compromisso, b: Compromisso) => `${a.data}${a.hora ?? ''}`.localeCompare(`${b.data}${b.hora ?? ''}`);

/** Aplica as operações ainda não enviadas sobre os dados (do servidor ou da cópia guardada). */
export function aplicarFila<T extends DadosFila>(dados: T, fila: Operacao[]): T {
  let { bebe, registros, compromissos } = dados;
  const listas: Record<string, { id: string }[]> = Object.fromEntries(COLECOES.map((c) => [c, dados[c] ?? []]));
  for (const op of fila) {
    if (op.tipo === 'registro') registros = [...registros.filter((r) => r.id !== op.dado.id), op.dado].sort(porInicio);
    else if (op.tipo === 'compromisso') compromissos = [...compromissos.filter((c) => c.id !== op.dado.id), op.dado].sort(porData);
    else if (op.tipo === 'bebe') bebe = op.dado;
    else if (op.tipo === 'colecao') listas[op.colecao] = [...listas[op.colecao].filter((x) => x.id !== op.dado.id), op.dado];
    else if (op.dado.alvo === 'registro') registros = registros.filter((r) => r.id !== op.dado.id);
    else if (op.dado.alvo === 'compromisso') compromissos = compromissos.filter((c) => c.id !== op.dado.id);
    else listas[op.dado.alvo] = listas[op.dado.alvo].filter((x) => x.id !== op.dado.id);
  }
  return { ...dados, ...(listas as unknown as ListasColecoes), bebe, registros, compromissos };
}

// --- Última cópia dos dados, para abrir sem internet ---

export function lerCache<T>(usuario: string): { em: string; dados: T } | null {
  try {
    const v = localStorage.getItem(PREFIXO_CACHE + usuario);
    return v ? (JSON.parse(v) as { em: string; dados: T }) : null;
  } catch {
    return null;
  }
}

export function gravarCache(usuario: string, dados: unknown, em = new Date().toISOString()) {
  try {
    localStorage.setItem(PREFIXO_CACHE + usuario, JSON.stringify({ em, dados }));
  } catch {
    /* sem espaço: segue sem cópia offline */
  }
}

export function apagarDadosLocais(usuario: string) {
  try {
    localStorage.removeItem(PREFIXO_CACHE + usuario);
  } catch {
    /* nada */
  }
}
