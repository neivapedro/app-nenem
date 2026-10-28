/**
 * Visual "vidro" (iOS 26) e texto que acompanha o tamanho escolhido no iPhone.
 *
 * 1. Tamanho do texto (Dynamic Type): no Safari do iPhone, `font: -apple-system-body` vale o
 *    tamanho de Ajustes → Tela e Brilho → Tamanho do Texto (17 px no padrão). O app foi desenhado
 *    com 16 px de base; aqui a base do <html> segue a mesma proporção (17 → 16), com limites para
 *    nada estourar a tela. Todos os tamanhos do app estão em rem, então tudo cresce junto.
 *    Fora do iPhone (sem esse recurso) fica o tamanho padrão do navegador (CSS em estilos.css).
 * 2. Rolagem: a barra de abas encolhe ao rolar para baixo e volta ao rolar para cima ou parar;
 *    o topo vira vidro (translúcido) quando há conteúdo passando por baixo dele.
 *    Tudo por atributos no <html> (data-nav-recolhida, data-topo-vidro), que o CSS usa.
 */

/** Tamanho do texto do sistema no padrão do iPhone ("Grande"): 17 px */
export const TEXTO_SISTEMA_PADRAO = 17;
/** Base do app nesse padrão */
export const BASE_APP = 16;
/** Limites da base: abaixo disso fica ilegível; acima, os layouts de 320 px não cabem mais */
export const BASE_MIN = 14;
export const BASE_MAX = 22;

/** Base do app (px no <html>) para um tamanho de texto do sistema (px de -apple-system-body) */
export function baseDoTexto(sistemaPx: number): number {
  if (!Number.isFinite(sistemaPx) || sistemaPx <= 0) return BASE_APP;
  const base = (sistemaPx * BASE_APP) / TEXTO_SISTEMA_PADRAO;
  return Math.round(Math.min(BASE_MAX, Math.max(BASE_MIN, base)) * 100) / 100;
}

function suportaTextoSistema(): boolean {
  try {
    return typeof CSS !== 'undefined' && CSS.supports('font', '-apple-system-body');
  } catch {
    return false;
  }
}

let acompanhando = false;

/**
 * Passa a acompanhar o tamanho do texto do iPhone. Chamar uma vez, antes do primeiro desenho.
 * Mede um elemento escondido com `font: -apple-system-body`; quando a pessoa muda o tamanho
 * em Ajustes e volta ao app, o elemento muda de tamanho e a base acompanha.
 */
export function acompanharTamanhoDoTexto(): void {
  if (acompanhando || typeof document === 'undefined' || !suportaTextoSistema()) return;
  const corpo = document.body;
  if (!corpo) return;
  acompanhando = true;
  const raiz = document.documentElement;
  const sonda = document.createElement('span');
  sonda.setAttribute('aria-hidden', 'true');
  sonda.textContent = 'Aa';
  sonda.style.cssText =
    'font: -apple-system-body; position: absolute; left: -9999px; top: 0; visibility: hidden; pointer-events: none; white-space: nowrap; contain: layout style;';
  corpo.appendChild(sonda);
  let ultima = '';
  const aplicar = () => {
    const px = parseFloat(getComputedStyle(sonda).fontSize);
    const base = baseDoTexto(px);
    const valor = `${base}px`;
    if (valor === ultima) return;
    ultima = valor;
    raiz.style.fontSize = valor;
    raiz.dataset.texto = base > BASE_APP + 0.5 ? 'grande' : base < BASE_APP - 0.5 ? 'pequeno' : 'padrao';
  };
  aplicar();
  if (typeof ResizeObserver === 'function') new ResizeObserver(aplicar).observe(sonda);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') aplicar();
  });
  window.addEventListener('pageshow', aplicar);
}

/** Decide o estado da barra a cada evento de rolagem (função pura, para dar para conferir) */
export function decidirRecolher(
  recolhida: boolean,
  y: number,
  delta: number,
  limites: { inicio: number; passo: number; fim: number },
): boolean {
  // Perto do topo ou do fim da página: barra inteira (o fim tem botões e o "Salvar")
  if (y <= limites.inicio || y >= limites.fim) return false;
  if (delta > limites.passo) return true;
  if (delta < -limites.passo) return false;
  return recolhida;
}

/**
 * Observa a rolagem da página: encolhe a barra de abas ao descer, devolve ao subir ou parar,
 * e marca quando o topo tem conteúdo por baixo. Devolve a função que para de observar.
 */
export function observarRolagem(): () => void {
  if (typeof window === 'undefined') return () => {};
  const raiz = document.documentElement;
  let ultimoY = window.scrollY;
  let recolhida = false;
  let quadro = 0;
  let parou = 0;

  const marcar = (nome: 'navRecolhida' | 'topoVidro', ligado: boolean) => {
    if (ligado) {
      if (raiz.dataset[nome] === undefined) raiz.dataset[nome] = '';
    } else if (raiz.dataset[nome] !== undefined) delete raiz.dataset[nome];
  };

  const topoPreso = (y: number): boolean => {
    const topo = document.querySelector<HTMLElement>('.app > .topo');
    if (!topo || y <= 1) return false;
    // A capa do Hoje só gruda depois de encolher (top negativo); as outras telas, já no começo
    const preso = parseFloat(getComputedStyle(topo).top) || 0;
    return topo.getBoundingClientRect().top <= preso + 0.5;
  };

  const pintar = () => {
    quadro = 0;
    const y = Math.max(0, window.scrollY);
    const delta = y - ultimoY;
    const fim = document.documentElement.scrollHeight - window.innerHeight - 24;
    // Folha ou tela cheia aberta: a barra fica como está
    if (!document.querySelector('.folha-fundo, .visualizador, .crescer')) {
      recolhida = decidirRecolher(recolhida, y, delta, { inicio: 80, passo: 4, fim: Math.max(81, fim) });
      marcar('navRecolhida', recolhida);
    }
    marcar('topoVidro', topoPreso(y));
    ultimoY = y;
  };

  const rolar = () => {
    if (!quadro) quadro = requestAnimationFrame(pintar);
    // Parou de rolar: a barra volta inteira
    clearTimeout(parou);
    parou = window.setTimeout(() => {
      recolhida = false;
      marcar('navRecolhida', false);
    }, 900);
  };

  pintar();
  window.addEventListener('scroll', rolar, { passive: true });
  window.addEventListener('resize', rolar, { passive: true });
  return () => {
    cancelAnimationFrame(quadro);
    clearTimeout(parou);
    window.removeEventListener('scroll', rolar);
    window.removeEventListener('resize', rolar);
    marcar('navRecolhida', false);
    marcar('topoVidro', false);
  };
}

/** Depois de trocar de tela (a página volta ao topo): barra inteira e topo sem vidro */
export function rolagemReiniciada(): void {
  if (typeof document === 'undefined') return;
  const raiz = document.documentElement;
  delete raiz.dataset.navRecolhida;
  delete raiz.dataset.topoVidro;
}
