/**
 * Transição "zoom" (como no iOS 18): o cartão tocado cresce e vira a tela de destino;
 * ao voltar, a tela encolhe de volta para o mesmo cartão.
 *
 * Por baixo é a mesma troca de tela de src/lib/transicao.ts (View Transitions, Safari 18+):
 *  - o cartão tocado ganha `view-transition-name: zoom-cartao` só durante a troca;
 *  - a tela nova (a "raiz" da transição) cresce do retângulo do cartão até a tela toda
 *    (escala + recorte arredondado, por variáveis CSS em src/estilos/zoom.css);
 *  - na volta, a tela atual encolhe até o cartão, que reaparece no lugar.
 * Sem a API ou com "Reduzir movimento": troca normal. Se o cartão de origem não existir
 * mais na volta, fica a transição normal para trás.
 *
 * Uso: `<Link to="/mais/resumo" {...useZoom('/mais/resumo')}>`
 */
import { useCallback, useRef, type MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { aoTrocarTela, definirGanchoTransicao, podeAnimar, trocarComTransicao, type Direcao, type OpcoesTransicao } from './transicao';

// ---------- Lógica pura (testada em zoom.test.ts) ----------

export type Retangulo = { x: number; y: number; w: number; h: number };

/** Nomes de transição usados pelo zoom */
export const NOME_CARTAO = 'zoom-cartao';
export const NOME_TITULO = 'zoom-titulo';

/** Endereço sem a barra do fim ("/mais/" = "/mais") */
export const semBarra = (p: string) => p.replace(/\/+$/, '') || '/';

/** Endereço da tela (sem o caminho base do app, ex.: "/app-nenem") */
export function rotaDoEndereco(pathname: string, base = '/'): string {
  const b = semBarra(base);
  let p = pathname;
  if (b !== '/' && (p === b || p.startsWith(`${b}/`))) p = p.slice(b.length);
  return semBarra(p || '/');
}

/**
 * Quanto do cartão aparece na tela (0 a 1). Cartão escondido (fora da tela, sem tamanho)
 * não serve de origem/destino do zoom.
 */
export function fracaoVisivel(r: Retangulo, vw: number, vh: number): number {
  if (!(r.w > 0 && r.h > 0) || !(vw > 0 && vh > 0)) return 0;
  const l = Math.max(0, Math.min(vw, r.x + r.w) - Math.max(0, r.x));
  const a = Math.max(0, Math.min(vh, r.y + r.h) - Math.max(0, r.y));
  return (l * a) / (r.w * r.h);
}

/** Entre vários elementos com a mesma chave (ex.: um saindo da tela), o mais visível; nenhum se quase nada aparece */
export function escolherCartao<T>(candidatos: { item: T; conectado: boolean; ret: Retangulo }[], vw: number, vh: number, minimo = 0.25): T | null {
  let melhor: T | null = null;
  let maior = minimo;
  for (const c of candidatos) {
    if (!c.conectado) continue;
    const f = fracaoVisivel(c.ret, vw, vh);
    if (f >= maior) {
      maior = f;
      melhor = c.item;
    }
  }
  return melhor;
}

export type Geometria = {
  /** Deslocamento da tela até o canto do cartão (px) */
  x: number;
  y: number;
  /** Escala da tela para caber na largura do cartão */
  s: number;
  /** Recorte embaixo, em px da tela inteira (antes da escala) */
  corte: number;
  /** Canto arredondado, em px da tela inteira (antes da escala) */
  r: number;
};

/**
 * Como encaixar a tela inteira (vw × vh) no retângulo do cartão: escala igual nos dois eixos
 * (nada fica achatado) pela largura, e o que sobra embaixo é recortado.
 */
export function geometria(r: Retangulo, vw: number, vh: number, raio: number): Geometria {
  const s = Math.min(1, Math.max(0.05, r.w / Math.max(1, vw)));
  const alturaNaTela = r.h / s;
  const corte = Math.max(0, vh - alturaNaTela);
  return { x: r.x, y: r.y, s, corte, r: Math.max(0, raio) / s };
}

/** Variáveis CSS que o zoom.css usa nas animações */
export function variaveisCss(g: Geometria, vw: number, vh: number, ret: Retangulo, raio: number): Record<string, string> {
  const px = (n: number) => `${Math.round(n * 100) / 100}px`;
  return {
    '--zoom-x': px(g.x),
    '--zoom-y': px(g.y),
    '--zoom-s': String(Math.round(g.s * 10000) / 10000),
    '--zoom-corte': px(g.corte),
    '--zoom-r': px(g.r),
    '--zoom-vw': px(vw),
    '--zoom-vh': px(vh),
    '--zoom-w': px(ret.w),
    '--zoom-h': px(ret.h),
    '--zoom-raio': px(raio),
  };
}

export const VARIAVEIS = ['--zoom-x', '--zoom-y', '--zoom-s', '--zoom-corte', '--zoom-r', '--zoom-vw', '--zoom-vh', '--zoom-w', '--zoom-h', '--zoom-raio'];

/** Qual cartão abriu qual tela */
export type Registro = {
  /** Tela onde estava o cartão */
  de: string;
  /** Tela aberta pelo cartão */
  para: string;
  /** Chave do cartão (o endereço que ele abre) */
  chave: string;
  /** Rolagem da tela de origem, para voltar ao mesmo ponto */
  rolagem: number;
};

/** A volta (para `destino`, saindo de `mostrada`) encolhe no cartão de origem? */
export function voltaComZoom(registro: Registro | null, mostrada: string, destino: string | null): boolean {
  if (!registro) return false;
  if (semBarra(mostrada) !== registro.para) return false;
  return destino === null || semBarra(destino) === registro.de;
}

/**
 * Voltar do navegador (popstate): anima só quando o próprio navegador não anima
 * (o deslizar do Safari já tem a animação dele: `hasUAVisualTransition`). Sem a informação,
 * só no app da Tela de Início (lá não existe o deslizar do Safari).
 */
export function animarPopstate(uaVisual: boolean | undefined, standalone: boolean): boolean {
  if (uaVisual === true) return false;
  if (uaVisual === false) return true;
  return standalone;
}

type ComEstilo = { style: { viewTransitionName?: string; setProperty?: (n: string, v: string) => void } };

/**
 * Guarda quem recebeu nome de transição, para nunca deixar nome preso nem dois elementos
 * com o mesmo nome (isso quebra a View Transition inteira).
 */
export class Nomes<E extends ComEstilo = ComEstilo> {
  private donos = new Map<string, E>();

  nomear(el: E, nome: string) {
    const antes = this.donos.get(nome);
    if (antes && antes !== el) this.tirar(antes);
    // Um elemento tem um nome só: tira o que ele tinha antes
    for (const [n, dono] of this.donos) if (dono === el && n !== nome) this.donos.delete(n);
    el.style.viewTransitionName = nome;
    this.donos.set(nome, el);
  }

  private tirar(el: E) {
    el.style.viewTransitionName = '';
    for (const [n, dono] of this.donos) if (dono === el) this.donos.delete(n);
  }

  /** Tira todos os nomes dados */
  limpar() {
    for (const el of this.donos.values()) el.style.viewTransitionName = '';
    this.donos.clear();
  }

  quem(nome: string): E | undefined {
    return this.donos.get(nome);
  }

  get tamanho() {
    return this.donos.size;
  }
}

// ---------- Ligação com a tela ----------

type Cartao = { el: HTMLElement; titulo?: string };

/** Cartões na tela, por chave (o endereço que abrem) */
const cartoes = new Map<string, Set<Cartao>>();
const nomes = new Nomes<HTMLElement>();
let registro: Registro | null = null;
/** Tela que está desenhada agora (no popstate o endereço já mudou, mas a tela ainda não) */
let mostrada = '/';
/** Cada troca com zoom tem um número: uma troca antiga terminando não limpa a nova */
let geracao = 0;
/** Entre o toque e a tela nova desenhada: outros toques são ignorados */
let abrindo = false;

const base = () => (import.meta.env?.BASE_URL as string | undefined) ?? '/';
const rotaAgora = () => rotaDoEndereco(location.pathname, base());

function retDe(el: Element): Retangulo {
  const b = el.getBoundingClientRect();
  return { x: b.left, y: b.top, w: b.width, h: b.height };
}

function viewport() {
  const raiz = document.documentElement;
  return { vw: raiz.clientWidth || window.innerWidth, vh: window.innerHeight || raiz.clientHeight };
}

function raioDe(el: Element): number {
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(r) ? r : 18;
}

function aplicarVariaveis(el: Element) {
  const { vw, vh } = viewport();
  const ret = retDe(el);
  const raio = raioDe(el);
  const vars = variaveisCss(geometria(ret, vw, vh, raio), vw, vh, ret, raio);
  const raiz = document.documentElement;
  for (const [k, v] of Object.entries(vars)) raiz.style.setProperty(k, v);
}

function limparTudo() {
  nomes.limpar();
  const raiz = document.documentElement;
  delete raiz.dataset.zoom;
  for (const k of VARIAVEIS) raiz.style.removeProperty(k);
}

/** O título da tela nova (no topo) recebe o nome do título do cartão, para "voar" até lá */
function tituloDoTopo(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.app > .topo:not(.capa) h1');
}

function acharCartao(chave: string): Cartao | null {
  const lista = [...(cartoes.get(chave) ?? [])];
  const { vw, vh } = viewport();
  return escolherCartao(
    lista.map((c) => ({ item: c, conectado: c.el.isConnected, ret: retDe(c.el) })),
    vw,
    vh,
  );
}

/** Opções da troca com zoom para abrir a tela do cartão */
function opcoesAbrir(c: Cartao, novo: Registro): OpcoesTransicao {
  const g = ++geracao;
  return {
    antes: () => {
      limparTudo();
      abrindo = true;
      registro = novo;
      const raiz = document.documentElement;
      raiz.dataset.zoom = 'abrir';
      aplicarVariaveis(c.el);
      nomes.nomear(c.el, NOME_CARTAO);
      const t = c.titulo ? c.el.querySelector<HTMLElement>(c.titulo) : null;
      if (t) nomes.nomear(t, NOME_TITULO);
    },
    depois: () => {
      abrindo = false;
      if (g !== geracao) return;
      // O cartão saiu da tela; o título novo (topo) recebe o nome do título do cartão
      const tituloVelho = nomes.quem(NOME_TITULO);
      nomes.limpar();
      const h1 = tituloVelho ? tituloDoTopo() : null;
      if (h1) nomes.nomear(h1, NOME_TITULO);
    },
    fim: () => {
      abrindo = false;
      if (g === geracao) limparTudo();
    },
  };
}

/** Opções da troca para trás: encolhe no cartão de origem, se ele ainda existir */
function opcoesVoltar(reg: Registro): OpcoesTransicao {
  const g = ++geracao;
  return {
    antes: () => {
      limparTudo();
      // Já avisa a tela de origem (a grade do Mais não repete a entrada dos cartões)
      document.documentElement.dataset.zoom = 'voltar';
      const h1 = tituloDoTopo();
      const comTitulo = [...(cartoes.get(reg.chave) ?? [])].some((c) => c.titulo);
      if (h1 && comTitulo) nomes.nomear(h1, NOME_TITULO);
    },
    depois: () => {
      if (g !== geracao) return;
      registro = null;
      const raiz = document.documentElement;
      const tituloVelho = !!nomes.quem(NOME_TITULO);
      nomes.limpar();
      if (rotaAgora() !== reg.de) {
        delete raiz.dataset.zoom;
        return;
      }
      // Volta ao ponto da rolagem de onde saiu (a Estrutura sobe a tela a cada troca)
      if (reg.rolagem > 0) window.scrollTo(0, reg.rolagem);
      const c = acharCartao(reg.chave);
      if (!c) {
        // O cartão não existe mais (ou ficou fora da tela): transição normal para trás
        delete raiz.dataset.zoom;
        return;
      }
      aplicarVariaveis(c.el);
      nomes.nomear(c.el, NOME_CARTAO);
      const t = tituloVelho && c.titulo ? c.el.querySelector<HTMLElement>(c.titulo) : null;
      if (t) nomes.nomear(t, NOME_TITULO);
    },
    fim: () => {
      if (g === geracao) limparTudo();
    },
  };
}

/** Toda troca sem opções próprias (abas, Voltar do topo, gestos) passa por aqui */
function gancho(direcao: Direcao): OpcoesTransicao | undefined {
  if (direcao === 'tras' && voltaComZoom(registro, mostrada, null)) return opcoesVoltar(registro!);
  // Troca normal: nenhum nome de zoom pode sobrar de uma troca anterior
  const g = ++geracao;
  return {
    antes: () => {
      limparTudo();
      abrindo = false;
    },
    fim: () => {
      if (g === geracao) limparTudo();
    },
  };
}

let ligado = false;
function ligar() {
  if (ligado || typeof window === 'undefined') return;
  ligado = true;
  mostrada = rotaAgora();
  definirGanchoTransicao(gancho);
  aoTrocarTela(() => {
    mostrada = rotaAgora();
    // Saiu da tela aberta pelo cartão por outro caminho: esquece a origem
    if (registro && mostrada !== registro.para && mostrada !== registro.de) registro = null;
  });
  // Voltar do navegador: segura o aviso de troca até a foto da tela antiga, depois repassa ao roteador.
  // Fica registrado antes do roteador (este módulo carrega antes da tela montar).
  let repassando = false;
  window.addEventListener(
    'popstate',
    (e) => {
      if (repassando) return;
      const destino = rotaAgora();
      if (!voltaComZoom(registro, mostrada, destino) || !podeAnimar()) return;
      const standalone = (navigator as { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
      if (!animarPopstate((e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition, !!standalone)) return;
      e.stopImmediatePropagation();
      const estado = e.state;
      const repassar = () => {
        repassando = true;
        try {
          window.dispatchEvent(new PopStateEvent('popstate', { state: estado }));
        } finally {
          repassando = false;
        }
      };
      if (!trocarComTransicao(repassar, 'tras', opcoesVoltar(registro!))) repassar();
    },
    true,
  );
}
ligar();

/** Abre `para` com o zoom a partir do cartão. Devolve false se não animou (o link segue normal). */
export function abrirComZoom(c: Cartao, para: string, navegar: () => void): boolean {
  if (!podeAnimar()) return false;
  const de = mostrada;
  if (de === semBarra(para)) return false;
  const novo: Registro = { de, para: semBarra(para), chave: semBarra(para), rolagem: window.scrollY };
  return trocarComTransicao(navegar, 'frente', opcoesAbrir(c, novo));
}

export type OpcoesZoom = {
  /** O elemento que cresce é o ancestral mais próximo com este seletor (ex.: '.cartao'); sem ele, o próprio link */
  cartao?: string;
  /** Seletor do título dentro do cartão que "voa" até o título do topo */
  titulo?: string;
};

/**
 * Liga um link a uma tela com o zoom. Devolve `{ ref, onClick }` para espalhar no <Link>.
 */
export function useZoom<E extends HTMLElement = HTMLAnchorElement>(para: string, opcoes: OpcoesZoom = {}) {
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const atual = useRef<Cartao | null>(null);
  const chave = semBarra(para);
  const { cartao: seletor, titulo } = opcoes;
  const ref = useCallback(
    (el: E | null) => {
      if (!el) return;
      const alvo = (seletor ? el.closest<HTMLElement>(seletor) : null) ?? el;
      const c: Cartao = { el: alvo, titulo };
      atual.current = c;
      let lista = cartoes.get(chave);
      if (!lista) cartoes.set(chave, (lista = new Set()));
      lista.add(c);
      return () => {
        lista.delete(c);
        if (!lista.size && cartoes.get(chave) === lista) cartoes.delete(chave);
        if (atual.current === c) atual.current = null;
      };
    },
    [chave, seletor, titulo],
  );
  const onClick = (e: MouseEvent<E>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    // Toques repetidos antes da tela nova aparecer: um só vale
    if (abrindo) {
      e.preventDefault();
      return;
    }
    const c = atual.current;
    if (!c || semBarra(pathname) === chave) return;
    if (abrirComZoom(c, chave, () => navegar(para))) e.preventDefault();
  };
  return { ref, onClick };
}

/** A tela está voltando com o zoom (a tela de origem pode pular a animação de entrada) */
export function voltandoComZoom(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.zoom === 'voltar';
}
