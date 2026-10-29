import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as KE, type MouseEvent as ME, type PointerEvent as PE } from 'react';
import { createPortal } from 'react-dom';
import type { Atalho } from '../lib/atalhos-rapidos';
import { Icone } from './ui';

/*
 * Registro rápido segurando o botão (como o menu de contexto do iPhone):
 * segurar ~450 ms abre o menu com atalhos de um toque; toque normal continua
 * abrindo o formulário. Mexer o dedo mais de 8 px antes do tempo cancela (é rolagem).
 * Com o menu aberto e o dedo ainda na tela, dá para deslizar até a opção e soltar.
 * Mouse: clique direito, ou segurar o botão esquerdo.
 */

export const TEMPO_SEGURAR_MS = 450;
export const TOLERANCIA_PX = 8;

export interface Ponto {
  x: number;
  y: number;
}

/**
 * Segurar um botão. `aoSegurar` devolve true se abriu algo (aí o clique que vem
 * ao soltar é engolido); false deixa o toque seguir como um clique normal.
 */
export function useSegurar(aoSegurar: (chave: string, el: HTMLElement, dedo: Ponto | null) => boolean) {
  const cb = useRef(aoSegurar);
  cb.current = aoSegurar;
  const estado = useRef<{ timer: number; x: number; y: number; el: HTMLElement | null; chave: string; disparou: boolean; soltouEm: number }>({ timer: 0, x: 0, y: 0, el: null, chave: '', disparou: false, soltouEm: 0 });

  const cancelar = useCallback(() => {
    const s = estado.current;
    if (s.timer) window.clearTimeout(s.timer);
    s.timer = 0;
    s.el?.classList.remove('mr-segurando');
  }, []);
  useEffect(() => cancelar, [cancelar]);

  return useCallback(
    (chave: string, ativo = true) => {
      if (!ativo) return {};
      return {
        'data-segurar': chave,
        onPointerDown: (e: PE<HTMLElement>) => {
          const s = estado.current;
          cancelar();
          s.disparou = false;
          if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
          const el = e.currentTarget;
          Object.assign(s, { x: e.clientX, y: e.clientY, el, chave });
          el.classList.add('mr-segurando');
          s.timer = window.setTimeout(() => {
            s.timer = 0;
            el.classList.remove('mr-segurando');
            s.disparou = cb.current(chave, el, { x: s.x, y: s.y });
          }, TEMPO_SEGURAR_MS);
        },
        onPointerMove: (e: PE<HTMLElement>) => {
          const s = estado.current;
          if (s.timer && Math.hypot(e.clientX - s.x, e.clientY - s.y) > TOLERANCIA_PX) cancelar();
        },
        onPointerUp: () => {
          cancelar();
          estado.current.soltouEm = Date.now();
        },
        onPointerCancel: cancelar,
        onPointerLeave: (e: PE<HTMLElement>) => {
          if (e.pointerType === 'mouse') cancelar();
        },
        // Clique direito (ou o menu do sistema por segurar): abre o nosso, nunca o do navegador
        onContextMenu: (e: ME<HTMLElement>) => {
          e.preventDefault();
          const s = estado.current;
          if (s.disparou) return;
          const dedoNaTela = !!s.timer;
          cancelar();
          s.disparou = cb.current(chave, e.currentTarget, dedoNaTela ? { x: s.x, y: s.y } : null);
          s.soltouEm = Date.now();
        },
        // O clique que vem logo depois de soltar o dedo não abre o formulário
        onClickCapture: (e: ME<HTMLElement>) => {
          const s = estado.current;
          if (s.disparou && Date.now() - s.soltouEm < 800) {
            e.preventDefault();
            e.stopPropagation();
          }
          s.disparou = false;
        },
      };
    },
    [cancelar],
  );
}

const reduzMovimento = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type Props = {
  ancora: HTMLElement;
  titulo: string;
  atalhos: Atalho[];
  /** Dedo ainda na tela (veio de segurar): deslizar até a opção e soltar escolhe */
  dedo: Ponto | null;
  aoEscolher: (a: Atalho) => void;
  /** Última opção: o formulário completo */
  rotuloMais?: string;
  aoMais: () => void;
  aoFechar: () => void;
  /** Classe extra do menu (ex.: t-mamadeira, para a cor dos ícones) */
  classe?: string;
};

export function MenuRapido({ ancora, titulo, atalhos, dedo, aoEscolher, rotuloMais = 'Abrir o formulário completo', aoMais, aoFechar, classe }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [rect] = useState(() => ancora.getBoundingClientRect());
  const [previa] = useState(() => ({ classe: ancora.className.replace(/\bmr-segurando\b/g, ''), html: ancora.innerHTML }));
  const [pos, setPos] = useState<CSSProperties>({ visibility: 'hidden' });
  const [saindo, setSaindo] = useState(false);
  const [sob, setSob] = useState<string | null>(null);
  const fechou = useRef(false);

  const fechar = useCallback(
    (depois?: () => void) => {
      if (fechou.current) return;
      fechou.current = true;
      const fim = () => {
        aoFechar();
        depois?.();
        if (menuRef.current?.contains(document.activeElement) || document.activeElement === document.body) ancora.focus({ preventScroll: true });
      };
      if (reduzMovimento()) return fim();
      setSaindo(true);
      window.setTimeout(fim, 140);
    },
    [aoFechar, ancora],
  );
  const fecharRef = useRef(fechar);
  fecharRef.current = fechar;
  const escolher = useCallback((id: string) => {
    if (id === '__mais') return fechar(aoMais);
    const a = atalhos.find((x) => x.id === id);
    if (a) fechar(() => aoEscolher(a));
  }, [atalhos, aoEscolher, aoMais, fechar]);
  const escolherRef = useRef(escolher);
  escolherRef.current = escolher;

  // Posição: embaixo do botão se couber; senão em cima; senão o mais embaixo possível
  useLayoutEffect(() => {
    const m = menuRef.current;
    if (!m) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const larg = Math.min(300, vw - 32);
    m.style.width = `${larg}px`;
    const alt = m.offsetHeight;
    let top: number;
    let origemY: string;
    if (rect.bottom + 10 + alt <= vh - 12) {
      top = rect.bottom + 10;
      origemY = 'top';
    } else if (rect.top - 10 - alt >= 12) {
      top = rect.top - 10 - alt;
      origemY = 'bottom';
    } else {
      top = Math.max(12, vh - alt - 12);
      origemY = 'bottom';
    }
    const esquerdaPrimeiro = rect.left + rect.width / 2 <= vw / 2;
    const left = Math.max(16, Math.min(vw - 16 - larg, esquerdaPrimeiro ? rect.left : rect.right - larg));
    const origemX = Math.max(0, Math.min(larg, rect.left + rect.width / 2 - left));
    setPos({ top, left, width: larg, maxHeight: vh - 24, transformOrigin: `${origemX}px ${origemY}` });
  }, [rect]);

  // Rolagem travada por baixo; foco no menu; Esc fecha
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  // Foco na 1ª opção quando o menu já está visível (escondido, o foco não pega)
  const focou = useRef(false);
  useEffect(() => {
    if (focou.current || pos.visibility === 'hidden') return;
    focou.current = true;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
  }, [pos]);
  // Esc fecha mesmo com o foco fora do menu
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      fecharRef.current();
    };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, []);

  // Dedo ainda na tela: deslizar marca a opção; soltar em cima dela escolhe
  useEffect(() => {
    if (!dedo) return;
    let ativo = true;
    let mexeu = false;
    let marcado: string | null = null;
    const itemEm = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('[data-mr-item]') as HTMLElement | null)?.dataset.mrItem ?? null;
    const mover = (x: number, y: number) => {
      if (!mexeu && Math.hypot(x - dedo.x, y - dedo.y) > 10) mexeu = true;
      if (!mexeu) return;
      const id = itemEm(x, y);
      if (id !== marcado) {
        marcado = id;
        setSob(id);
      }
    };
    const soltar = (x: number, y: number) => {
      if (!ativo) return;
      ativo = false;
      const id = mexeu ? itemEm(x, y) : null;
      setSob(null);
      if (id) escolherRef.current(id);
      tirar();
    };
    const tMove = (e: TouchEvent) => {
      // Nem rolagem nem troca de aba enquanto o dedo procura a opção
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      const t = e.touches[0];
      if (t) mover(t.clientX, t.clientY);
    };
    const tEnd = (e: TouchEvent) => {
      // Sem clique "fantasma" ao soltar
      if (e.cancelable) e.preventDefault();
      const t = e.changedTouches[0];
      if (t) soltar(t.clientX, t.clientY);
    };
    const pMove = (e: PointerEvent) => e.pointerType !== 'touch' && mover(e.clientX, e.clientY);
    const pUp = (e: PointerEvent) => e.pointerType !== 'touch' && soltar(e.clientX, e.clientY);
    const tirar = () => {
      window.removeEventListener('touchmove', tMove, true);
      window.removeEventListener('touchend', tEnd, true);
      window.removeEventListener('touchcancel', tEnd, true);
      window.removeEventListener('pointermove', pMove, true);
      window.removeEventListener('pointerup', pUp, true);
    };
    window.addEventListener('touchmove', tMove, { capture: true, passive: false });
    window.addEventListener('touchend', tEnd, { capture: true, passive: false });
    window.addEventListener('touchcancel', tEnd, { capture: true, passive: false });
    window.addEventListener('pointermove', pMove, true);
    window.addEventListener('pointerup', pUp, true);
    return tirar;
  }, [dedo]);

  function teclado(e: KE<HTMLDivElement>) {
    const itens = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = itens.indexOf(document.activeElement as HTMLElement);
    const ir = (k: number) => itens[(k + itens.length) % itens.length]?.focus();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      ir(i + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      ir(i - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      ir(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      ir(itens.length - 1);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      ir(i + (e.shiftKey ? -1 : 1));
    }
  }

  return createPortal(
    <div
      className={`mr-fundo${saindo ? ' mr-saindo' : ''}`}
      data-sem-gesto=""
      role="dialog"
      aria-modal="true"
      aria-label={`Atalhos de ${titulo.toLowerCase()}`}
      onClick={() => fechar()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className={`mr-previa ${previa.classe}`} aria-hidden="true" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} dangerouslySetInnerHTML={{ __html: previa.html }} />
      <div ref={menuRef} className={`mr-menu ${classe ?? ''}`} role="menu" aria-label={titulo} style={pos} onClick={(e) => e.stopPropagation()} onKeyDown={teclado}>
        <div className="mr-cab" aria-hidden="true">
          {titulo} · um toque salva agora
        </div>
        {atalhos.map((a) => (
          <button key={a.id} type="button" role="menuitem" className={`mr-item${sob === a.id ? ' mr-sob' : ''}`} data-mr-item={a.id} onClick={() => escolher(a.id)}>
            <span className="mr-texto">
              <span className="mr-rotulo">{a.rotulo}</span>
              {a.detalhe && <span className="mr-detalhe">{a.detalhe}</span>}
            </span>
            <span className="mr-icone" aria-hidden="true">
              {a.emoji ?? <Icone nome={a.icone ?? 'check'} />}
            </span>
          </button>
        ))}
        <button type="button" role="menuitem" className={`mr-item mr-mais${sob === '__mais' ? ' mr-sob' : ''}`} data-mr-item="__mais" onClick={() => escolher('__mais')}>
          <span className="mr-texto">
            <span className="mr-rotulo">{rotuloMais}</span>
          </span>
          <span className="mr-icone" aria-hidden="true">
            <Icone nome="editar" />
          </span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
