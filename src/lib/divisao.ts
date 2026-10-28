// Quem fez o quê: cor e inicial de cada responsável e a divisão dos cuidados da semana.
// Tudo em funções puras (testadas em divisao.test.ts); os componentes só desenham.
import { chaveDia, somarDiasLocal } from './datas';
import type { Membro, Registro, TipoRegistro } from './tipos';

/** Quantas cores próprias de pessoa existem (as duas primeiras são o par mais distinto; ver quem.css) */
export const CORES_PESSOA = 4;

/** Ordem estável da família: quem entrou antes vem antes (empate: pelo id). Igual em todos os aparelhos. */
export function ordenarMembros<M extends Pick<Membro, 'user_id' | 'criado_em'>>(membros: M[]): M[] {
  return [...membros].sort((a, b) => {
    const ta = a.criado_em ? Date.parse(a.criado_em) : Infinity;
    const tb = b.criado_em ? Date.parse(b.criado_em) : Infinity;
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.user_id < b.user_id ? -1 : a.user_id > b.user_id ? 1 : 0;
  });
}

/**
 * Cor de cada pessoa (índice 0..CORES_PESSOA-1; -1 = neutra, só a partir da 5ª pessoa).
 * Vem do id pela ordem de entrada: quem entra depois nunca muda a cor de quem já estava,
 * e duas pessoas da família nunca ficam com a mesma cor.
 */
export function coresDaFamilia(membros: Pick<Membro, 'user_id' | 'criado_em'>[]): Map<string, number> {
  const m = new Map<string, number>();
  ordenarMembros(membros).forEach((x, i) => m.set(x.user_id, i < CORES_PESSOA ? i : -1));
  return m;
}

const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? '';

/** Inicial de cada pessoa ("P", "K"); se duas começam com a mesma letra, usa duas letras ("Pe", "Pa") */
export function iniciaisDaFamilia(membros: Pick<Membro, 'user_id' | 'nome'>[]): Map<string, string> {
  const nomes = membros.map((m) => ({ id: m.user_id, n: primeiroNome(m.nome) || '?' }));
  const letra = (n: string, k: number) => {
    const s = [...n];
    return (s[0] ?? '?').toLocaleUpperCase('pt-BR') + s.slice(1, k).join('').toLocaleLowerCase('pt-BR');
  };
  const r = new Map<string, string>();
  for (const x of nomes) {
    const iguais = nomes.filter((y) => y.id !== x.id && letra(y.n, 1) === letra(x.n, 1));
    r.set(x.id, iguais.length ? letra(x.n, 2) : letra(x.n, 1));
  }
  return r;
}

/** Madrugada = começou entre 0h e 6h (hora local) */
export function ehMadrugada(iso: string): boolean {
  return new Date(iso).getHours() < 6;
}

export type CategoriaDivisao = 'madrugada' | 'fralda' | 'sono' | 'total';

export const CATEGORIAS: { chave: CategoriaDivisao; titulo: string; sub: string }[] = [
  { chave: 'madrugada', titulo: 'Madrugada', sub: 'mamadas e mamadeiras de 0h a 6h' },
  { chave: 'fralda', titulo: 'Fraldas', sub: 'trocas' },
  { chave: 'sono', titulo: 'Sonos', sub: 'colocar para dormir' },
  { chave: 'total', titulo: 'Tudo', sub: 'todos os registros' },
];

/** Detalhe de uma pessoa numa categoria (o que aparece ao tocar) */
export interface DetalhePessoa {
  n: number;
  /** madrugada: mamadas no peito e mamadeiras */
  mamadas: number;
  mamadeiras: number;
  /** fralda: com cocô */
  coco: number;
  /** total: quantos de cada tipo */
  porTipo: Partial<Record<TipoRegistro, number>>;
}

export interface LinhaDivisao {
  chave: CategoriaDivisao;
  /** Soma das pessoas da família (sem os registros sem autor) */
  total: number;
  por: Record<string, DetalhePessoa>;
}

export interface Divisao {
  /** Primeiro e último dia da janela (AAAA-MM-DD) */
  de: string;
  ate: string;
  linhas: LinhaDivisao[];
  /** Registros da janela sem autor conhecido (antigos, ou de quem saiu da família) */
  semAutor: number;
}

const vazio = (): DetalhePessoa => ({ n: 0, mamadas: 0, mamadeiras: 0, coco: 0, porTipo: {} });

/** Os últimos `dias` dias (hoje incluído): quantos registros cada pessoa fez por categoria */
export function contarDivisao(registros: Registro[], pessoas: string[], hoje: string, dias = 7): Divisao {
  const de = somarDiasLocal(hoje, -(dias - 1));
  const linhas: LinhaDivisao[] = CATEGORIAS.map((c) => ({ chave: c.chave, total: 0, por: Object.fromEntries(pessoas.map((p) => [p, vazio()])) }));
  const linha = (c: CategoriaDivisao) => linhas.find((l) => l.chave === c)!;
  const conta = (c: CategoriaDivisao, p: string) => {
    const l = linha(c);
    l.total++;
    l.por[p].n++;
    return l.por[p];
  };
  let semAutor = 0;
  for (const r of registros) {
    const dia = chaveDia(r.inicio);
    if (dia < de || dia > hoje) continue;
    if (!r.criado_por || !pessoas.includes(r.criado_por)) {
      semAutor++;
      continue;
    }
    const p = r.criado_por;
    const t = conta('total', p);
    t.porTipo[r.tipo] = (t.porTipo[r.tipo] ?? 0) + 1;
    if ((r.tipo === 'mamada' || r.tipo === 'mamadeira') && ehMadrugada(r.inicio)) {
      const d = conta('madrugada', p);
      if (r.tipo === 'mamada') d.mamadas++;
      else d.mamadeiras++;
    } else if (r.tipo === 'fralda') {
      const d = conta('fralda', p);
      if (r.dados.coco) d.coco++;
    } else if (r.tipo === 'sono') conta('sono', p);
  }
  return { de, ate: hoje, linhas, semAutor };
}

export interface PessoaFrase {
  id: string;
  /** Primeiro nome */
  nome: string;
  /** É quem está vendo a tela (a frase fala com "você") */
  voce: boolean;
}

/** Fatia a partir da qual a frase sugere revezar (2 de 3) e o mínimo de registros para falar disso */
const FATIA = 2 / 3;
const MINIMO = 3;

const maiuscula = (s: string) => (s ? s[0].toLocaleUpperCase('pt-BR') + s.slice(1) : s);

/**
 * Uma frase carinhosa e neutra sobre a semana. Fala do que está mais puxado para alguém
 * (madrugada primeiro, depois fraldas e sonos) e sugere revezar, sem placar nem cobrança.
 */
export function fraseDivisao(div: Divisao, pessoas: PessoaFrase[], bebe = 'o bebê'): string {
  const total = div.linhas.find((l) => l.chave === 'total')!;
  if (pessoas.length < 2 || total.total === 0) return 'Quando vocês registrarem, aparece aqui como os cuidados da semana se dividiram.';
  const nomeDe = (p: PessoaFrase) => (p.voce ? 'você' : p.nome);
  for (const chave of ['madrugada', 'fralda', 'sono'] as const) {
    const l = div.linhas.find((x) => x.chave === chave)!;
    if (l.total < MINIMO) continue;
    const ordem = [...pessoas].sort((a, b) => l.por[b.id].n - l.por[a.id].n);
    const mais = ordem[0];
    const menos = ordem[ordem.length - 1];
    const n = l.por[mais.id].n;
    if (n / l.total < FATIA) continue;
    const de = (fem: boolean) => (n === l.total ? `${fem ? 'todas as' : 'todos os'} ${n}` : `${n} ${fem ? 'das' : 'dos'} ${l.total}`);
    const feito =
      chave === 'madrugada'
        ? `cuidou de ${de(true)} alimentações da madrugada`
        : chave === 'fralda'
          ? `trocou ${de(true)} fraldas`
          : `colocou ${bebe} para dormir em ${de(false)} sonos`;
    const proxima = chave === 'madrugada' ? 'a próxima madrugada' : chave === 'fralda' ? 'as próximas trocas' : 'o próximo soninho';
    if (mais.voce) return `Você ${feito} — que tal combinar ${proxima} com ${menos.nome} e descansar um pouco?`;
    if (menos.voce) return `${maiuscula(mais.nome)} ${feito} — que tal você assumir ${proxima}?`;
    return `${maiuscula(mais.nome)} ${feito} — que tal ${nomeDe(menos)} assumir ${proxima}?`;
  }
  return 'A semana está bem dividida entre vocês. Bonito trabalho em equipe!';
}
