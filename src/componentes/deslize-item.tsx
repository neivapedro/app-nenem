// Item de lista que desliza para a esquerda e revela "Editar" e "Apagar"
// (como no Mail do iPhone). Deslizar até o fim apaga. Só um aberto por vez;
// tocar fora fecha. O toque simples continua abrindo a edição (sem gesto).
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { decidirEixo, FOLGA_GESTO, limiarApagar, posicaoDeslize, soltarDeslize, velocidade } from '../lib/toque';
import { Icone } from './ui';

/** Largura de cada ação revelada (px) */
const LARGURA_ACAO = 76;
const ACOES = LARGURA_ACAO * 2;

/** Fecha o item aberto (só um por vez na tela) */
let fecharAberto: (() => void) | null = null;

const reduzMovimento = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function ItemDeslizavel({ children, aoEditar, aoApagar }: { children: ReactNode; aoEditar: () => void; aoApagar: () => void }) {
  const liRef = useRef<HTMLLIElement>(null);
  const frenteRef = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const editar = useRef(aoEditar);
  const apagar = useRef(aoApagar);
  useEffect(() => {
    editar.current = aoEditar;
    apagar.current = aoApagar;
  }, [aoEditar, aoApagar]);
  /** Ações imperativas do item (preenchidas pelo efeito abaixo) */
  const api = useRef<{ fechar: () => void; apagar: () => void } | null>(null);

  useEffect(() => {
    const li = liRef.current;
    const frente = frenteRef.current;
    if (!li || !frente) return;
    let x = 0; // posição atual (negativa = aberto para a esquerda)
    let base = 0;
    let vivo = true;
    let engolirClique = false;
    const timers: number[] = [];
    type Gesto = { x0: number; y0: number; estado: 'espera' | 'deslizando' | 'ignorar'; dx0: number; largura: number; amostras: { v: number; t: number }[] };
    let g: Gesto | null = null;

    const medidas = () => ({ acoes: ACOES, largura: li.offsetWidth || 320 });
    const pintar = (nx: number) => {
      x = nx;
      frente.style.translate = nx ? `${nx.toFixed(1)}px 0` : '';
      li.style.setProperty('--tq-x', `${Math.max(0, -nx).toFixed(1)}px`);
      li.classList.toggle('tq-apagando', -nx >= limiarApagar(medidas()));
      li.classList.toggle('tq-movendo', nx !== 0);
    };
    const animarPara = (nx: number, depois?: () => void) => {
      if (reduzMovimento()) {
        pintar(nx);
        depois?.();
        return;
      }
      li.classList.add('tq-solto');
      pintar(nx);
      timers.push(
        window.setTimeout(() => {
          li.classList.remove('tq-solto');
          depois?.();
        }, 300),
      );
    };
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (li.contains(alvo)) return; // dentro: o próprio gesto decide (tocar no item fecha)
      fechar();
      // Tocar noutro registro só fecha este (não abre a edição do outro)
      if (alvo instanceof Element && alvo.closest('.hist-item')) {
        const engole = (ev: MouseEvent) => {
          ev.stopPropagation();
          ev.preventDefault();
        };
        document.addEventListener('click', engole, { capture: true, once: true });
        timers.push(window.setTimeout(() => document.removeEventListener('click', engole, { capture: true }), 700));
      }
    };
    const abrir = () => {
      if (fecharAberto && fecharAberto !== fechar) fecharAberto();
      fecharAberto = fechar;
      base = -ACOES;
      setAberto(true);
      document.addEventListener('pointerdown', fora, true);
      animarPara(-ACOES);
    };
    function fechar() {
      if (fecharAberto === fechar) fecharAberto = null;
      base = 0;
      document.removeEventListener('pointerdown', fora, true);
      if (vivo) setAberto(false);
      if (x !== 0) animarPara(0);
    }
    const apagarAgora = () => {
      if (fecharAberto === fechar) fecharAberto = null;
      document.removeEventListener('pointerdown', fora, true);
      const largura = medidas().largura;
      const fim = () => {
        apagar.current();
        // Se o item não sumiu (ex.: a lista ainda vai buscar de novo), volta ao normal
        timers.push(
          window.setTimeout(() => {
            if (!vivo) return;
            li.classList.remove('tq-sumindo');
            li.style.height = '';
            base = 0;
            setAberto(false);
            pintar(0);
          }, 1500),
        );
      };
      if (reduzMovimento()) return fim();
      li.classList.add('tq-apagando');
      animarPara(-largura, () => {
        li.style.height = `${li.offsetHeight}px`;
        li.classList.add('tq-sumindo');
        requestAnimationFrame(() => (li.style.height = '0px'));
        timers.push(window.setTimeout(fim, 220));
      });
    };
    api.current = { fechar, apagar: apagarAgora };

    const comecar = (cx: number, cy: number, t: number) => {
      li.classList.remove('tq-solto');
      g = { x0: cx, y0: cy, estado: 'espera', dx0: 0, largura: medidas().largura, amostras: [{ v: base, t }] };
    };
    const mover = (cx: number, cy: number, t: number, e: Event) => {
      if (!g || g.estado === 'ignorar') return;
      const dx = cx - g.x0;
      const dy = cy - g.y0;
      if (g.estado === 'espera') {
        const eixo = decidirEixo(dx, dy);
        if (eixo === 'espera') return;
        // Fechado e para a direita: não é comigo (fica para o gesto de trocar de aba)
        if (eixo === 'vertical' || (dx > 0 && base === 0)) {
          g.estado = 'ignorar';
          if (base !== 0) fechar(); // rolou a lista com o item aberto: fecha
          return;
        }
        g.estado = 'deslizando';
        g.dx0 = Math.sign(dx) * Math.min(Math.abs(dx), FOLGA_GESTO);
        // Marca o item enquanto desliza: o gesto de abas ignora e a rolagem não age
        li.setAttribute('data-sem-gesto', '');
        if (fecharAberto && fecharAberto !== fechar) fecharAberto();
      }
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      const nx = posicaoDeslize(base, dx - g.dx0, { acoes: ACOES, largura: g.largura });
      g.amostras.push({ v: nx, t });
      if (g.amostras.length > 8) g.amostras.shift();
      pintar(nx);
    };
    const soltar = (e: Event | null, cancelado: boolean) => {
      const s = g;
      g = null;
      if (!s) return;
      if (s.estado !== 'deslizando') {
        // Toque simples no item aberto: só fecha (não abre a edição)
        if (s.estado === 'espera' && base !== 0 && !cancelado) {
          engolirClique = true;
          timers.push(window.setTimeout(() => (engolirClique = false), 400));
          fechar();
        }
        return;
      }
      e?.stopPropagation();
      engolirClique = true;
      timers.push(window.setTimeout(() => (engolirClique = false), 400));
      li.removeAttribute('data-sem-gesto');
      const fim = cancelado ? (base ? 'aberto' : 'fechado') : soltarDeslize(x, velocidade(s.amostras), { acoes: ACOES, largura: s.largura });
      if (fim === 'apagar') apagarAgora();
      else if (fim === 'aberto') abrir();
      else fechar();
    };

    const tInicio = (e: TouchEvent) => {
      if (e.touches.length !== 1) return soltar(null, true);
      comecar(e.touches[0].clientX, e.touches[0].clientY, e.timeStamp);
    };
    const tMover = (e: TouchEvent) => {
      if (e.touches.length !== 1) return soltar(null, true);
      mover(e.touches[0].clientX, e.touches[0].clientY, e.timeStamp, e);
    };
    const tFim = (e: TouchEvent) => soltar(e, e.type === 'touchcancel');
    const pMover = (e: PointerEvent) => mover(e.clientX, e.clientY, e.timeStamp, e);
    const pFim = (e: PointerEvent) => {
      window.removeEventListener('pointermove', pMover);
      window.removeEventListener('pointerup', pFim);
      window.removeEventListener('pointercancel', pFim);
      soltar(e, e.type === 'pointercancel');
    };
    const pInicio = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0 || (e.target as Element).closest?.('.tq-acoes')) return;
      comecar(e.clientX, e.clientY, e.timeStamp);
      window.addEventListener('pointermove', pMover);
      window.addEventListener('pointerup', pFim);
      window.addEventListener('pointercancel', pFim);
    };
    const clique = (e: MouseEvent) => {
      if (!engolirClique || (e.target as Element).closest?.('.tq-acoes')) return;
      engolirClique = false;
      e.stopPropagation();
      e.preventDefault();
    };

    frente.addEventListener('touchstart', tInicio, { passive: true });
    frente.addEventListener('touchmove', tMover, { passive: false });
    frente.addEventListener('touchend', tFim);
    frente.addEventListener('touchcancel', tFim);
    frente.addEventListener('pointerdown', pInicio);
    li.addEventListener('click', clique, true);
    return () => {
      vivo = false;
      timers.forEach(clearTimeout);
      if (fecharAberto === fechar) fecharAberto = null;
      document.removeEventListener('pointerdown', fora, true);
      frente.removeEventListener('touchstart', tInicio);
      frente.removeEventListener('touchmove', tMover);
      frente.removeEventListener('touchend', tFim);
      frente.removeEventListener('touchcancel', tFim);
      frente.removeEventListener('pointerdown', pInicio);
      li.removeEventListener('click', clique, true);
      window.removeEventListener('pointermove', pMover);
      window.removeEventListener('pointerup', pFim);
      window.removeEventListener('pointercancel', pFim);
    };
  }, []);

  return (
    <li ref={liRef} className={`tq-deslize ${aberto ? 'tq-aberto' : ''}`}>
      <div ref={frenteRef} className="tq-frente">
        {children}
      </div>
      <div className="tq-acoes" inert={!aberto} aria-hidden={!aberto}>
        <button
          type="button"
          className="tq-acao tq-editar"
          onClick={() => {
            api.current?.fechar();
            editar.current();
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
          <span>Editar</span>
        </button>
        <button type="button" className="tq-acao tq-apagar" onClick={() => api.current?.apagar()}>
          <Icone nome="lixeira" />
          <span>Apagar</span>
        </button>
      </div>
    </li>
  );
}
