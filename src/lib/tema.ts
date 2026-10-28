import { useSyncExternalStore } from 'react';

/**
 * Aparência do app (por aparelho): tema claro/escuro/noite e cor de destaque.
 *
 * O <html> recebe os atributos que o CSS usa:
 * - data-tema="claro" | "escuro" | "noite" (noite = escuro âmbar bem baixo, 22h–6h)
 * - data-tom="frio" | "quente" (só no claro automático: manhã mais fria, tarde mais quente)
 * - data-cor="padrao" | "azul" | "verde" | "lilas" | "terracota"
 * - data-theme="light" | "dark" (compatibilidade com o CSS que já usava esse atributo)
 *
 * O script inline do index.html faz o mesmo cálculo antes do primeiro desenho (sem piscar);
 * mantenha os dois iguais (tema.test.ts confere).
 */

export type ModoTema = 'auto' | 'sistema' | 'claro' | 'escuro';
export type CorDestaque = 'padrao' | 'azul' | 'verde' | 'lilas' | 'terracota';
export type TemaEfetivo = 'claro' | 'escuro' | 'noite';
export type Tom = 'frio' | 'quente' | null;
export type Periodo = 'manha' | 'tarde' | 'noitinha' | 'madrugada';

export interface Aparencia {
  modo: ModoTema;
  cor: CorDestaque;
  /** Noite âmbar das 22h às 6h. null = padrão (ligada só no automático) */
  ambar: boolean | null;
}

export interface EstadoTema {
  tema: TemaEfetivo;
  tom: Tom;
  periodo: Periodo;
}

export const CHAVE_APARENCIA = 'app-nenem:aparencia';
export const APARENCIA_PADRAO: Aparencia = { modo: 'auto', cor: 'padrao', ambar: null };

export const MODOS: { valor: ModoTema; rotulo: string; dica: string }[] = [
  { valor: 'auto', rotulo: 'Automático pela hora', dica: 'Claro de dia, escuro à noite' },
  { valor: 'sistema', rotulo: 'Seguir o iPhone', dica: 'Igual ao modo do aparelho' },
  { valor: 'claro', rotulo: 'Claro', dica: 'Sempre claro' },
  { valor: 'escuro', rotulo: 'Escuro', dica: 'Sempre escuro' },
];

/** Amostras das cores (as mesmas de src/estilos/tema.css) para os botões de escolha */
export const CORES: { valor: CorDestaque; rotulo: string; claro: string; escuro: string }[] = [
  { valor: 'padrao', rotulo: 'Padrão', claro: '#1b1a1f', escuro: '#f4f3f1' },
  { valor: 'azul', rotulo: 'Azul', claro: '#245bc0', escuro: '#8fb5ff' },
  { valor: 'verde', rotulo: 'Verde', claro: '#1f7356', escuro: '#66d1a4' },
  { valor: 'lilas', rotulo: 'Lilás', claro: '#7446c0', escuro: '#c8adf7' },
  { valor: 'terracota', rotulo: 'Terracota', claro: '#ab452a', escuro: '#f4a284' },
];
export const COR_NOITE = '#c9935a';

/** Cor da barra do sistema (theme-color): a mesma do fundo/topo de cada tema */
export const FUNDOS: Record<'claro' | 'claro-frio' | 'claro-quente' | 'escuro' | 'noite', string> = {
  claro: '#f6f4f1',
  'claro-frio': '#f2f4f7',
  'claro-quente': '#f8f3ec',
  escuro: '#0e0f13',
  noite: '#0c0907',
};

const MODOS_VALIDOS: readonly string[] = MODOS.map((m) => m.valor);
const CORES_VALIDAS: readonly string[] = CORES.map((c) => c.valor);

export function normalizarAparencia(bruto: unknown): Aparencia {
  const o = bruto && typeof bruto === 'object' ? (bruto as Record<string, unknown>) : {};
  return {
    modo: MODOS_VALIDOS.includes(o.modo as string) ? (o.modo as ModoTema) : APARENCIA_PADRAO.modo,
    cor: CORES_VALIDAS.includes(o.cor as string) ? (o.cor as CorDestaque) : APARENCIA_PADRAO.cor,
    ambar: typeof o.ambar === 'boolean' ? o.ambar : null,
  };
}

export function lerAparencia(): Aparencia {
  try {
    return normalizarAparencia(JSON.parse(localStorage.getItem(CHAVE_APARENCIA) || '{}'));
  } catch {
    return { ...APARENCIA_PADRAO };
  }
}

/** A noite âmbar vale? (padrão: ligada no automático, desligada nos outros modos) */
export const ambarLigado = (a: Aparencia) => (a.ambar === null ? a.modo === 'auto' : a.ambar);

export function periodoDoDia(hora: number): Periodo {
  if (hora >= 22 || hora < 6) return 'madrugada';
  if (hora < 12) return 'manha';
  if (hora < 18) return 'tarde';
  return 'noitinha';
}

export function calcularTema(a: Aparencia, agora: Date, sistemaEscuro: boolean): EstadoTema {
  const periodo = periodoDoDia(agora.getHours());
  if (periodo === 'madrugada' && ambarLigado(a)) return { tema: 'noite', tom: null, periodo };
  if (a.modo === 'auto') {
    if (periodo === 'manha') return { tema: 'claro', tom: 'frio', periodo };
    if (periodo === 'tarde') return { tema: 'claro', tom: 'quente', periodo };
    return { tema: 'escuro', tom: null, periodo };
  }
  if (a.modo === 'claro') return { tema: 'claro', tom: null, periodo };
  if (a.modo === 'escuro') return { tema: 'escuro', tom: null, periodo };
  return { tema: sistemaEscuro ? 'escuro' : 'claro', tom: null, periodo };
}

export function corDaBarra(e: Pick<EstadoTema, 'tema' | 'tom'>): string {
  if (e.tema === 'claro') return e.tom ? FUNDOS[`claro-${e.tom}`] : FUNDOS.claro;
  return FUNDOS[e.tema];
}

/** Próxima hora em que o tema automático pode mudar (6h, 12h, 18h, 22h) */
export function proximaVirada(agora: Date): Date {
  const viradas = [6, 12, 18, 22];
  const h = agora.getHours();
  const prox = viradas.find((v) => v > h);
  const d = new Date(agora);
  if (prox === undefined) {
    d.setDate(d.getDate() + 1);
    d.setHours(6, 0, 0, 0);
  } else d.setHours(prox, 0, 0, 0);
  return d;
}

/** Texto curto do que está valendo agora (Ajustes → Aparência) */
export function descreverTema(e: EstadoTema): string {
  if (e.tema === 'noite') return 'Agora: noite âmbar, bem escura e quente';
  if (e.tema === 'escuro') return 'Agora: escuro';
  if (e.tom === 'frio') return 'Agora: manhã, claro levemente frio';
  if (e.tom === 'quente') return 'Agora: tarde, claro levemente quente';
  return 'Agora: claro';
}

// ---------- Aplicar no documento ----------

const sistemaEscuro = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
const menosMovimento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let atual: Aparencia = typeof localStorage === 'undefined' ? { ...APARENCIA_PADRAO } : lerAparencia();
let estadoAtual: EstadoTema | null = null;
const ouvintes = new Set<() => void>();
let fimTroca: ReturnType<typeof setTimeout> | undefined;

function aplicar(suave: boolean) {
  const raiz = document.documentElement;
  const e = calcularTema(atual, new Date(), sistemaEscuro());
  const mudou = raiz.dataset.tema !== e.tema || (raiz.dataset.tom ?? null) !== e.tom || raiz.dataset.cor !== atual.cor;
  if (mudou && suave && !menosMovimento()) {
    // Cores deslizam de um tema para o outro em vez de trocar de uma vez
    raiz.setAttribute('data-trocando-tema', '');
    clearTimeout(fimTroca);
    fimTroca = setTimeout(() => raiz.removeAttribute('data-trocando-tema'), 900);
  }
  raiz.dataset.tema = e.tema;
  if (e.tom) raiz.dataset.tom = e.tom;
  else delete raiz.dataset.tom;
  raiz.dataset.cor = atual.cor;
  raiz.dataset.theme = e.tema === 'claro' ? 'light' : 'dark';
  forcarEsquemaNasRegras(e.tema !== 'claro');
  // A tela do modo noite pinta a barra de preto enquanto estiver aberta: não brigar com ela
  if (!document.querySelector('.noite')) {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    const cor = corDaBarra(e);
    if (meta.content !== cor) meta.content = cor;
  }
  const antes = estadoAtual;
  if (!antes || antes.tema !== e.tema || antes.tom !== e.tom || antes.periodo !== e.periodo) {
    estadoAtual = e;
    ouvintes.forEach((f) => f());
  }
}

export function salvarAparencia(p: Partial<Aparencia>) {
  atual = normalizarAparencia({ ...atual, ...p });
  try {
    localStorage.setItem(CHAVE_APARENCIA, JSON.stringify(atual));
  } catch {
    /* sem armazenamento: vale até fechar o app */
  }
  aplicar(true);
  ouvintes.forEach((f) => f());
}

let iniciado = false;
/** Aplica o tema agora e o mantém em dia: hora que vira, volta ao app, modo do iPhone, outra aba */
export function iniciarTema() {
  if (iniciado || typeof document === 'undefined') return;
  iniciado = true;
  atual = lerAparencia();
  aplicar(false);
  vigiarFolhasDeEstilo();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const agendar = () => {
    clearTimeout(timer);
    // Até a próxima virada (com folga), e no máximo a cada minuto: o relógio do iPhone pode pular
    const ate = proximaVirada(new Date()).getTime() - Date.now() + 500;
    timer = setTimeout(
      () => {
        aplicar(true);
        agendar();
      },
      Math.max(1000, Math.min(ate, 60_000)),
    );
  };
  agendar();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    aplicar(true);
    agendar();
  });
  window.addEventListener('pageshow', () => aplicar(false));
  window.addEventListener('storage', (ev) => {
    if (ev.key !== CHAVE_APARENCIA) return;
    atual = lerAparencia();
    aplicar(true);
    ouvintes.forEach((f) => f());
  });
  matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => aplicar(true));
}

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}
let instantaneo: { aparencia: Aparencia; estado: EstadoTema } | null = null;
function ler() {
  const estado = estadoAtual ?? calcularTema(atual, new Date(), sistemaEscuro());
  if (!instantaneo || instantaneo.aparencia !== atual || instantaneo.estado !== estado) instantaneo = { aparencia: atual, estado };
  return instantaneo;
}

/** Aparência escolhida e o tema que está valendo agora (atualiza sozinho) */
export function useAparencia() {
  return useSyncExternalStore(assinar, ler, ler);
}

// ---------- Tema forçado x @media (prefers-color-scheme) ----------
// Os CSS das telas podem usar @media (prefers-color-scheme: dark/light). Com o tema escolhido
// no app (ex.: claro num iPhone em modo escuro), essas regras precisam seguir o app e não o
// aparelho: a condição é trocada por uma sempre verdadeira ou sempre falsa (o texto original fica guardado).

const SEMPRE = '(min-width: 0px)';
const NUNCA = '(max-width: 0.01px)';
const ESQUEMA = /\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/gi;
const originais = new WeakMap<CSSMediaRule, string | null>();
let escuroForcado: boolean | null = null;

/** Troca a condição de cor do aparelho pela do app (texto de uma media query) */
export function trocarEsquema(texto: string, escuro: boolean): string {
  return texto.replace(ESQUEMA, (_, v: string) => ((v.toLowerCase() === 'dark') === escuro ? SEMPRE : NUNCA));
}

function ajustarRegras(regras: CSSRuleList, escuro: boolean) {
  for (const r of Array.from(regras)) {
    if (typeof CSSMediaRule !== 'undefined' && r instanceof CSSMediaRule) {
      let orig = originais.get(r);
      if (orig === undefined) {
        orig = /prefers-color-scheme/i.test(r.media.mediaText) ? r.media.mediaText : null;
        originais.set(r, orig);
      }
      if (orig) {
        const novo = trocarEsquema(orig, escuro);
        if (r.media.mediaText !== novo) r.media.mediaText = novo;
      }
    }
    if (typeof CSSImportRule !== 'undefined' && r instanceof CSSImportRule) {
      try {
        if (r.styleSheet) ajustarRegras(r.styleSheet.cssRules, escuro);
      } catch {
        /* folha de outro domínio */
      }
    } else if ('cssRules' in r && (r as CSSGroupingRule).cssRules) ajustarRegras((r as CSSGroupingRule).cssRules, escuro);
  }
}

function forcarEsquemaNasRegras(escuro: boolean) {
  escuroForcado = escuro;
  for (const folha of Array.from(document.styleSheets)) {
    try {
      ajustarRegras(folha.cssRules, escuro);
    } catch {
      /* folha de outro domínio ou ainda carregando */
    }
  }
}

function vigiarFolhasDeEstilo() {
  if (typeof MutationObserver === 'undefined') return;
  let pendente = false;
  const refazer = () => {
    if (pendente) return;
    pendente = true;
    queueMicrotask(() => {
      pendente = false;
      if (escuroForcado !== null) forcarEsquemaNasRegras(escuroForcado);
    });
  };
  // Folhas que chegam depois (telas carregadas sob demanda, atualização do Vite em desenvolvimento)
  new MutationObserver((ms) => {
    for (const m of ms) {
      m.addedNodes.forEach((n) => {
        if (n instanceof HTMLLinkElement) n.addEventListener('load', refazer, { once: true });
      });
    }
    refazer();
  }).observe(document.head, { childList: true, subtree: true, characterData: true });
}
