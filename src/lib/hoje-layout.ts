/*
 * Layout da tela Hoje "do jeito de vocês" (como o Resumo do app Saúde):
 * ordem dos cartões, cartões escondidos e cartões fixados no topo.
 * Guardado por aparelho (localStorage). Tudo aqui é função pura.
 */

export type IdCartaoHoje =
  | 'momentos'
  | 'proxima'
  | 'faixa24h'
  | 'relogio'
  | 'registrar'
  | 'outros'
  | 'avisos'
  | 'resumo'
  | 'divisao'
  | 'compromisso'
  | 'recentes';

export interface CartaoHoje {
  id: IdCartaoHoje;
  nome: string;
  descricao: string;
  /** false = não dá para esconder (só mover e fixar) */
  ocultavel?: boolean;
  /** Só existe depois do nascimento */
  soNascido?: boolean;
  /** Começa escondido no layout padrão (dá para ligar em "Editar o Hoje") */
  padraoOculto?: boolean;
}

/** Catálogo na ordem padrão. Cartão novo numa versão futura: é só colocar no lugar dele aqui. */
export const CARTOES_HOJE: CartaoHoje[] = [
  { id: 'momentos', nome: 'Momentos', descricao: 'Mesversário e lembranças do dia (quando houver)', soNascido: true },
  { id: 'proxima', nome: 'Próxima mamada', descricao: 'Anel com a hora prevista da próxima alimentação', soNascido: true },
  // Mostra as mesmas 24 h do relógio: por padrão só o relógio aparece
  { id: 'faixa24h', nome: 'Últimas 24 horas', descricao: 'Faixa com mamadas, sono e fraldas', soNascido: true, padraoOculto: true },
  { id: 'relogio', nome: 'Relógio 24 h', descricao: 'O dia desenhado em volta de um relógio', soNascido: true },
  { id: 'registrar', nome: 'Botões de registro', descricao: 'Mamada, mamadeira, fralda e sono', ocultavel: false },
  { id: 'outros', nome: 'Outros registros', descricao: 'Remédio, febre, extração e mais' },
  { id: 'avisos', nome: 'Avisos', descricao: 'Vacina, remédio e leite vencendo (quando pedem ação)' },
  { id: 'resumo', nome: 'Resumo do dia', descricao: 'Os números de hoje comparados com a média' },
  { id: 'divisao', nome: 'Divisão da semana', descricao: 'Como os cuidados da semana se dividiram', soNascido: true },
  { id: 'compromisso', nome: 'Próximo compromisso', descricao: 'Consulta ou vacina marcada na Agenda (quando houver)' },
  { id: 'recentes', nome: 'Últimos registros', descricao: 'Os 5 registros mais recentes' },
];

export const CHAVE_LAYOUT_HOJE = 'app-nenem:hoje-layout';

export interface LayoutHoje {
  /** Todos os cartões, na ordem (a posição de um fixado vale para quando ele deixar de ser fixado) */
  ordem: string[];
  /** Escondidos */
  ocultos: string[];
  /** Fixados no topo, na ordem em que aparecem */
  fixos: string[];
}

const ocultavel = (catalogo: CartaoHoje[], id: string) => catalogo.find((c) => c.id === id)?.ocultavel !== false;

export function layoutPadrao(catalogo: CartaoHoje[] = CARTOES_HOJE): LayoutHoje {
  return { ordem: catalogo.map((c) => c.id), ocultos: catalogo.filter((c) => c.padraoOculto && c.ocultavel !== false).map((c) => c.id), fixos: [] };
}

const listaDeTexto = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const semRepetir = (l: string[]) => l.filter((x, i) => l.indexOf(x) === i);

/**
 * Junta o layout salvo com o catálogo atual: ids que não existem mais saem;
 * cartões novos entram logo depois do vizinho que vem antes deles na ordem padrão
 * (ou no começo, se nenhum vizinho anterior estiver na lista).
 */
export function mesclarLayout(salvo: unknown, catalogo: CartaoHoje[] = CARTOES_HOJE): LayoutHoje {
  const ids = catalogo.map((c) => c.id as string);
  // Nada salvo (ou lixo): o padrão. Layout salvo vale como está (o padrão novo não mexe nele)
  if (!salvo || typeof salvo !== 'object' || !Array.isArray((salvo as Record<string, unknown>).ordem)) return layoutPadrao(catalogo);
  const s = salvo as Record<string, unknown>;
  const ordem = semRepetir(listaDeTexto(s.ordem)).filter((id) => ids.includes(id));
  ids.forEach((id, i) => {
    if (ordem.includes(id)) return;
    let pos = 0;
    for (let j = i - 1; j >= 0; j--) {
      const k = ordem.indexOf(ids[j]);
      if (k >= 0) {
        pos = k + 1;
        break;
      }
    }
    ordem.splice(pos, 0, id);
  });
  const ocultos = semRepetir(listaDeTexto(s.ocultos)).filter((id) => ids.includes(id) && ocultavel(catalogo, id));
  const fixos = semRepetir(listaDeTexto(s.fixos)).filter((id) => ids.includes(id) && !ocultos.includes(id));
  return { ordem, ocultos, fixos };
}

/** Lê do texto guardado (JSON); qualquer problema = padrão */
export function lerLayout(texto: string | null, catalogo: CartaoHoje[] = CARTOES_HOJE): LayoutHoje {
  if (!texto) return layoutPadrao(catalogo);
  try {
    return mesclarLayout(JSON.parse(texto), catalogo);
  } catch {
    return layoutPadrao(catalogo);
  }
}

export function serializarLayout(l: LayoutHoje): string {
  return JSON.stringify({ v: 1, ordem: l.ordem, ocultos: l.ocultos, fixos: l.fixos });
}

/** Grupos como aparecem: fixados (no topo), soltos (visíveis) e escondidos */
export function gruposLayout(l: LayoutHoje): { fixos: string[]; soltos: string[]; ocultos: string[] } {
  return {
    fixos: l.fixos.filter((id) => !l.ocultos.includes(id)),
    soltos: l.ordem.filter((id) => !l.fixos.includes(id) && !l.ocultos.includes(id)),
    ocultos: l.ordem.filter((id) => l.ocultos.includes(id)),
  };
}

/** Ordem final na tela: fixados primeiro, depois o resto; sem os escondidos */
export function ordemNaTela(l: LayoutHoje): string[] {
  const g = gruposLayout(l);
  return [...g.fixos, ...g.soltos];
}

/**
 * Leva o cartão para a posição `alvo` dentro do grupo dele (fixados ou soltos).
 * Nos soltos, os escondidos ficam onde estão: só as vagas dos visíveis trocam de dono.
 */
export function moverPara(l: LayoutHoje, id: string, alvo: number): LayoutHoje {
  if (l.fixos.includes(id)) {
    const g = l.fixos.filter((x) => x !== id);
    const i = Math.max(0, Math.min(g.length, alvo));
    g.splice(i, 0, id);
    return { ...l, fixos: g };
  }
  const soltos = gruposLayout(l).soltos;
  const de = soltos.indexOf(id);
  if (de < 0) return l;
  const nova = soltos.filter((x) => x !== id);
  nova.splice(Math.max(0, Math.min(nova.length, alvo)), 0, id);
  let k = 0;
  const ordem = l.ordem.map((x) => (soltos.includes(x) ? nova[k++] : x));
  return { ...l, ordem };
}

/** ▲ (-1) / ▼ (+1) dentro do grupo */
export function mover(l: LayoutHoje, id: string, delta: -1 | 1): LayoutHoje {
  const g = gruposLayout(l);
  const lista = l.fixos.includes(id) ? g.fixos : g.soltos;
  const i = lista.indexOf(id);
  if (i < 0 || i + delta < 0 || i + delta >= lista.length) return l;
  return moverPara(l, id, i + delta);
}

/** Fixar no topo (entra no fim dos fixados) ou soltar (volta para o lugar dele na ordem) */
export function alternarFixo(l: LayoutHoje, id: string): LayoutHoje {
  if (l.fixos.includes(id)) return { ...l, fixos: l.fixos.filter((x) => x !== id) };
  if (!l.ordem.includes(id)) return l;
  return { ...l, fixos: [...l.fixos, id], ocultos: l.ocultos.filter((x) => x !== id) };
}

/** Esconder (deixa de ser fixado) ou mostrar (volta para o lugar dele) */
export function alternarOculto(l: LayoutHoje, id: string, catalogo: CartaoHoje[] = CARTOES_HOJE): LayoutHoje {
  if (l.ocultos.includes(id)) return { ...l, ocultos: l.ocultos.filter((x) => x !== id) };
  if (!l.ordem.includes(id) || !ocultavel(catalogo, id)) return l;
  return { ...l, ocultos: [...l.ocultos, id], fixos: l.fixos.filter((x) => x !== id) };
}

export function ehPadrao(l: LayoutHoje, catalogo: CartaoHoje[] = CARTOES_HOJE): boolean {
  const p = layoutPadrao(catalogo);
  return !l.fixos.length && l.ordem.join() === p.ordem.join() && [...l.ocultos].sort().join() === [...p.ocultos].sort().join();
}
