import { useCallback, useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { decidirEixo, deveFecharFolha, FOLGA_GESTO, opacidadeFundo, posicaoFolha, velocidade } from '../lib/toque';
import type { TipoRegistro } from '../lib/tipos';

const caminhos: Record<string, ReactNode> = {
  hoje: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  historico: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  agenda: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
    </>
  ),
  ajustes: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  mamada: <path d="M12 2.7s-6.5 6.6-6.5 11.6a6.5 6.5 0 0 0 13 0c0-5-6.5-11.6-6.5-11.6zM9 15a3 3 0 0 0 3 3" />,
  mamadeira: <path d="M10 2h4M9.5 5h5M10 2v3M14 2v3M8 9a3 3 0 0 1 2-3h4a3 3 0 0 1 2 3v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2zM8 12h3.5M8 15.5h3.5" />,
  fralda: <path d="M3 6h18v3.5c0 5.2-4 9.5-9 9.5s-9-4.3-9-9.5zM3 9.5c3 0 5 1.5 6 4M21 9.5c-3 0-5 1.5-6 4" />,
  sono: <path d="M20.5 13.3A8.5 8.5 0 1 1 10.7 3.5a6.6 6.6 0 0 0 9.8 9.8z" />,
  mais: <path d="M12 5v14M5 12h14" />,
  fechar: <path d="M18 6 6 18M6 6l12 12" />,
  lixeira: <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />,
  pausar: <path d="M9 5v14M15 5v14" />,
  tocar: <path d="M7 4.5v15l12-7.5z" />,
  parar: <rect x="6" y="6" width="12" height="12" rx="2" />,
  trocar: <path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  sino: <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />,
  copiar: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </>
  ),
  compartilhar: <path d="M12 3v13M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />,
  seta: <path d="m9 6 6 6-6 6" />,
  bebe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0" />
    </>
  ),
  pessoas: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
    </>
  ),
  alerta: <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />,
  remedio: (
    <>
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z" />
      <path d="m8.5 8.5 7 7" />
    </>
  ),
  temperatura: <path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0zM12 9v7" />,
  extracao: (
    <>
      <path d="M8 3h8l-1 5H9z" />
      <path d="M9 8v11a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V8M9 13h6" />
    </>
  ),
  refeicao: (
    <>
      <path d="M4 11h16a8 8 0 0 1-16 0z" />
      <path d="M12 7c0-2 1-3 3-4M9 7c0-1 .5-2 1.5-2.5" />
    </>
  ),
  saude: <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7zM8 11h3l1.5-2 2 4 1.5-2h1" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  grafico: <path d="M3 3v18h18M8 17v-5M13 17V8M18 17v-8" />,
  lua: <path d="M20.5 13.3A8.5 8.5 0 1 1 10.7 3.5a6.6 6.6 0 0 0 9.8 9.8z" />,
  estrela: <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />,
  check: <path d="M20 6 9 17l-5-5" />,
  lista: <path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01" />,
  baixar: <path d="M12 3v13M7 11l5 5 5-5M5 21h14" />,
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  regua: <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0zM14.5 12.5l2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2" />,
  documento: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  imagem: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  pasta: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  busca: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  girar: <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" />,
  recortar: <path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2" />,
  carteira: (
    <>
      <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3" />
      <path d="M21 9h-5a3 3 0 0 0 0 6h5z" />
    </>
  ),
  imprimir: <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" />,
  olho: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  alfinete: <path d="M12 17v5M9 10.8V4h6v6.8l3 3.2v2H6v-2z" />,
  nuvem: <path d="M17.5 19H8a6 6 0 1 1 5.7-7.9A4.5 4.5 0 1 1 17.5 19zM9 14l2 2 4-4" />,
  cofrinho: (
    <>
      <path d="M4.5 12.5c0-3.6 3.4-6.5 7.5-6.5 1.4 0 2.7.3 3.8.9L19 5.5v3.6c.7.6 1.2 1.4 1.5 2.3H22v3.2h-1.7a6.6 6.6 0 0 1-2.3 2.6V20h-3v-1.9a9 9 0 0 1-4 0V20H8v-2.4a6.2 6.2 0 0 1-3.5-5.1z" />
      <path d="M9.5 8.6h3.5M16 11.2h.01" />
    </>
  ),
  olho_fechado: <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2" />,
  qr: <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4z" />,
  subir: <path d="m18 15-6-6-6 6" />,
  vacina: <path d="m18 2 4 4M17 7l3-3M19 9 8.7 19.3a2.4 2.4 0 0 1-3.4 0l-.6-.6a2.4 2.4 0 0 1 0-3.4L15 5M9 11l4 4M5 19l-3 3M14 4l6 6" />,
};

/**
 * Trava contra toque duplo: depois de um toque, ignora os próximos por um
 * instante (a tela redesenha e o 2º toque cairia no botão que aparece no lugar).
 */
export function useUmToque(intervalo = 700) {
  const ultimo = useRef(0);
  return useCallback(
    <A extends unknown[]>(fn: (...a: A) => void) =>
      (...a: A) => {
        const t = Date.now();
        if (t - ultimo.current < intervalo) return;
        ultimo.current = t;
        fn(...a);
      },
    [intervalo],
  );
}

export function Icone({ nome }: { nome: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {caminhos[nome]}
    </svg>
  );
}

/** Ícone do tipo de registro num quadrado com a cor do tipo */
export function Selo({ tipo, icone }: { tipo: TipoRegistro | 'agenda' | 'saude'; icone?: string }) {
  return (
    <span className={`selo t-${tipo}`}>
      <Icone nome={icone ?? tipo} />
    </span>
  );
}

/** Onde o toque não vira arrasto da folha: campos, seletores, sliders e o que se marcar com data-sem-gesto */
const SEM_GESTO = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="slider"], [data-sem-gesto]';

/** O toque começou em algo com gesto próprio (campo, área que não rola na vertical, rolagem interna fora do topo) */
function temGestoProprio(alvo: Element, folha: HTMLElement): boolean {
  for (let el: Element | null = alvo; el && el !== folha; el = el.parentElement) {
    if (el.matches(SEM_GESTO)) return true;
    const cs = getComputedStyle(el);
    const ta = cs.touchAction;
    if (ta === 'none' || ta === 'pinch-zoom' || (ta.includes('pan-x') && !ta.includes('pan-y'))) return true;
    if ((cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight && el.scrollTop > 0) return true;
  }
  return false;
}

const reduzMovimento = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Arrastar a folha para baixo para fechar (como no iPhone): pela alça/cabeçalho
 * sempre; pelo conteúdo só quando ele está rolado no topo. Soltar além do
 * limiar (ou rápido) fecha com animação e chama `aoFechar`; senão a folha volta.
 */
function useArrastarParaFechar(fundoRef: RefObject<HTMLDivElement | null>, folhaRef: RefObject<HTMLDivElement | null>, aoFechar: () => void) {
  const fechar = useRef(aoFechar);
  useEffect(() => {
    fechar.current = aoFechar;
  }, [aoFechar]);

  useEffect(() => {
    const fundo = fundoRef.current;
    const folha = folhaRef.current;
    if (!fundo || !folha) return;
    type Gesto = { x0: number; y0: number; topo: boolean; estado: 'espera' | 'arrastando' | 'ignorar'; dy0: number; pos: number; amostras: { v: number; t: number }[] };
    let g: Gesto | null = null;
    let arrastou = false;
    let fechando = false;
    let vivo = true;
    const timers: number[] = [];

    const aplicar = (y: number) => {
      folha.style.translate = y ? `0 ${y.toFixed(1)}px` : '';
      fundo.style.setProperty('--tq-fundo', String(opacidadeFundo(y, folha.offsetHeight)));
    };
    const limpar = () => {
      folha.style.transition = '';
      fundo.style.transition = '';
      fundo.classList.remove('tq-movendo');
      fundo.style.removeProperty('--tq-fundo');
      folha.style.translate = '';
    };
    const voltar = () => {
      if (reduzMovimento()) return limpar();
      folha.style.transition = 'translate 0.32s cubic-bezier(0.2, 0.9, 0.3, 1)';
      fundo.style.transition = '--tq-fundo 0.32s';
      aplicar(0);
      timers.push(window.setTimeout(limpar, 340));
    };
    const fecharAnimado = (vel: number) => {
      fechando = true;
      const depois = () => {
        fechar.current();
        // Se a tela não fechou a folha (aoFechar não a tirou), ela volta ao lugar
        timers.push(
          window.setTimeout(() => {
            if (!vivo) return;
            fechando = false;
            limpar();
          }, 120),
        );
      };
      if (reduzMovimento()) return depois();
      const destino = folha.offsetHeight + 40;
      const falta = Math.max(0, destino - (g?.pos ?? 0));
      const dur = Math.round(Math.min(300, Math.max(160, falta / Math.max(1.4, vel))));
      folha.style.transition = `translate ${dur}ms cubic-bezier(0.3, 0.6, 0.4, 1)`;
      fundo.style.transition = `--tq-fundo ${dur}ms`;
      folha.style.translate = `0 ${destino}px`;
      fundo.style.setProperty('--tq-fundo', '0');
      timers.push(window.setTimeout(depois, dur));
    };

    const comecar = (x: number, y: number, alvo: EventTarget | null, t: number) => {
      g = null;
      if (fechando || !(alvo instanceof Element) || alvo.closest('.folha') !== folha) return;
      const topo = !!alvo.closest('.tq-folha-topo');
      if (!topo && (folha.scrollTop > 0 || temGestoProprio(alvo, folha))) return;
      // A 1ª amostra é o ponto de partida: gesto rápido conta a velocidade desde o começo
      g = { x0: x, y0: y, topo, estado: 'espera', dy0: 0, pos: 0, amostras: [{ v: 0, t }] };
    };
    const mover = (x: number, y: number, t: number, e: Event) => {
      if (!g || g.estado === 'ignorar') return;
      const dx = x - g.x0;
      const dy = y - g.y0;
      if (g.estado === 'espera') {
        // Para baixo e mais vertical: já segura a rolagem nativa (no topo não há o que rolar para cima)
        if (dy > 0 && Math.abs(dy) >= Math.abs(dx) && e.cancelable) e.preventDefault();
        const eixo = decidirEixo(dx, dy);
        if (eixo === 'espera') return;
        if (eixo !== 'vertical' || dy < 0 || (!g.topo && folha.scrollTop > 0)) {
          g.estado = 'ignorar';
          return;
        }
        g.estado = 'arrastando';
        // Desconta só a folga de decidir (a folha não pula, e o gesto curto não perde distância)
        g.dy0 = Math.min(dy, FOLGA_GESTO);
        folha.style.transition = '';
        fundo.style.transition = '';
        fundo.classList.add('tq-movendo');
      }
      if (e.cancelable) e.preventDefault();
      g.pos = posicaoFolha(dy - g.dy0);
      g.amostras.push({ v: g.pos, t });
      if (g.amostras.length > 8) g.amostras.shift();
      aplicar(g.pos);
    };
    const soltar = (cancelado: boolean) => {
      const s = g;
      if (!s || s.estado !== 'arrastando') {
        g = null;
        return;
      }
      arrastou = true;
      timers.push(window.setTimeout(() => (arrastou = false), 400));
      const vel = velocidade(s.amostras);
      if (!cancelado && deveFecharFolha(s.pos, vel, folha.offsetHeight)) fecharAnimado(vel);
      else voltar();
      g = null;
    };

    // Toque (iPhone)
    const tInicio = (e: TouchEvent) => {
      if (e.touches.length !== 1) return soltar(true);
      comecar(e.touches[0].clientX, e.touches[0].clientY, e.target, e.timeStamp);
    };
    const tMover = (e: TouchEvent) => {
      if (e.touches.length !== 1) return soltar(true);
      mover(e.touches[0].clientX, e.touches[0].clientY, e.timeStamp, e);
    };
    const tFim = (e: TouchEvent) => soltar(e.type === 'touchcancel');
    // Mouse (computador): só pela alça/cabeçalho
    const pMover = (e: PointerEvent) => mover(e.clientX, e.clientY, e.timeStamp, e);
    const pFim = () => {
      window.removeEventListener('pointermove', pMover);
      window.removeEventListener('pointerup', pFim);
      window.removeEventListener('pointercancel', pFim);
      soltar(false);
    };
    const pInicio = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || !(e.target instanceof Element) || !e.target.closest('.tq-folha-topo')) return;
      comecar(e.clientX, e.clientY, e.target, e.timeStamp);
      if (!g) return;
      window.addEventListener('pointermove', pMover);
      window.addEventListener('pointerup', pFim);
      window.addEventListener('pointercancel', pFim);
    };
    // Depois de arrastar, o "clique" de soltar o dedo não aperta botão nem fecha pelo fundo
    const clique = (e: MouseEvent) => {
      if (!arrastou) return;
      arrastou = false;
      e.stopPropagation();
      e.preventDefault();
    };

    folha.addEventListener('touchstart', tInicio, { passive: true });
    folha.addEventListener('touchmove', tMover, { passive: false });
    folha.addEventListener('touchend', tFim);
    folha.addEventListener('touchcancel', tFim);
    folha.addEventListener('pointerdown', pInicio);
    fundo.addEventListener('click', clique, true);
    return () => {
      vivo = false;
      timers.forEach(clearTimeout);
      folha.removeEventListener('touchstart', tInicio);
      folha.removeEventListener('touchmove', tMover);
      folha.removeEventListener('touchend', tFim);
      folha.removeEventListener('touchcancel', tFim);
      folha.removeEventListener('pointerdown', pInicio);
      fundo.removeEventListener('click', clique, true);
      window.removeEventListener('pointermove', pMover);
      window.removeEventListener('pointerup', pFim);
      window.removeEventListener('pointercancel', pFim);
    };
  }, [fundoRef, folhaRef]);
}

export function Folha({ titulo, aoFechar, children, classe }: { titulo: string; aoFechar: () => void; children: ReactNode; classe?: string }) {
  const fundoRef = useRef<HTMLDivElement>(null);
  const folhaRef = useRef<HTMLDivElement>(null);
  useArrastarParaFechar(fundoRef, folhaRef, aoFechar);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', esc);
      document.body.style.overflow = overflow;
    };
  }, [aoFechar]);
  return (
    // data-sem-gesto: com a folha aberta, o gesto de trocar de aba não age por baixo dela
    <div ref={fundoRef} className="folha-fundo" onClick={aoFechar} data-sem-gesto="">
      <div ref={folhaRef} className={`folha ${classe ?? ''}`} role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="tq-folha-topo">
          <span className="tq-alca" aria-hidden="true" />
          <div className="cartao-cab">
            <h2>{titulo}</h2>
            <button className="icone-botao" onClick={aoFechar} aria-label="Fechar">
              <Icone nome="fechar" />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

/** `grupo` para conteúdos com botões (ex.: Escolhas): um <label> repassaria o clique ao 1º botão. */
export function Campo({ rotulo, dica, grupo, children }: { rotulo: string; dica?: ReactNode; grupo?: boolean; children: ReactNode }) {
  if (grupo) {
    return (
      <fieldset className="campo">
        <legend>{rotulo}</legend>
        {children}
        {dica && <small>{dica}</small>}
      </fieldset>
    );
  }
  return (
    <label className="campo">
      <span>{rotulo}</span>
      {children}
      {dica && <small>{dica}</small>}
    </label>
  );
}

export function Escolhas<T extends string | number | boolean | null>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
}: {
  opcoes: { valor: T; rotulo: ReactNode }[];
  valor: T;
  aoMudar: (v: T) => void;
  rotulo?: string;
}) {
  const id = useId();
  return (
    <div className="escolhas" role="radiogroup" aria-label={rotulo} id={id}>
      {opcoes.map((o) => (
        <button key={String(o.valor)} type="button" role="radio" aria-checked={valor === o.valor} className={valor === o.valor ? 'ativo' : ''} onClick={() => aoMudar(o.valor)}>
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Logotipo do app (o mesmo desenho do ícone da Tela de Início) */
export function Marca({ classe }: { classe: string }) {
  // 384 px: nítida até no tamanho grande da tela de entrada em iPhones de tela 3x
  return <img className={classe} src={`${import.meta.env.BASE_URL}marca.jpg`} alt="" decoding="async" />;
}
