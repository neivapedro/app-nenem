import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { abaVizinha, decidirTroca, deslocamentoLado, intencao, LIMIAR_PUXAR, naBorda, progressoPuxar, resistencia, type Sentido } from '../lib/gestos';

/*
 * Gestos de toque da estrutura do app:
 *  - deslizar para os lados no conteúdo troca de aba (na ordem da barra de baixo);
 *  - no topo da página, puxar para baixo atualiza os dados.
 * Nada disso vale com folha ou tela cheia aberta, nem quando o toque começa num campo,
 * num gráfico, numa fileira que rola para os lados ou em algo marcado com data-sem-gesto.
 */

// Onde o dedo é de outro (gráficos com toque/arrasto, campos, deslizadores)
const ALVOS_PROPRIOS = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-sem-gesto], svg[role="img"], canvas, [role="slider"], .grafico-area';
// Folhas, telas cheias e diálogos abertos
const ABERTOS = '[aria-modal="true"], .folha-fundo, .crescer, .visualizador, .editor-foto';

function algoAberto(): boolean {
  return !!document.querySelector(ABERTOS);
}

/** O toque começou dentro de algo que rola para os lados (chips, trilha de vacinas, carteira...)? */
function dentroDeRolagemLateral(alvo: Element | null): boolean {
  for (let el = alvo; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return true;
    }
  }
  return false;
}

/** Algo rolável por dentro, já rolado para baixo (aí puxar é rolar de volta, não atualizar) */
function dentroDeRolagemVerticalRolada(alvo: Element | null): boolean {
  for (let el = alvo; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (el.scrollTop > 0) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === 'auto' || oy === 'scroll') return true;
    }
  }
  return false;
}

type Toque = {
  x0: number;
  y0: number;
  t0: number;
  dx: number;
  dy: number;
  estado: 'indefinido' | 'lado' | 'puxar' | 'nada';
  podeLado: boolean;
  podePuxar: boolean;
};

type Props = {
  /** Endereços das abas, na ordem da barra */
  abas: string[];
  /** Endereço atual (sem barra no fim) */
  atual: string;
  /** Vai para a aba (com a transição na direção certa) */
  irPara: (para: string, sentido: Sentido, antes: () => void) => void;
  /** Recarrega os dados (puxar para atualizar) */
  atualizar: () => Promise<void>;
};

export function GestosNavegacao({ abas, atual, irPara, atualizar }: Props) {
  const [puxado, setPuxado] = useState(0);
  const [atualizando, setAtualizando] = useState(false);
  const [soltando, setSoltando] = useState(false);
  // Valores mais recentes para os ouvintes de toque (registrados uma vez só)
  const ref = useRef({ abas, atual, irPara, atualizar, atualizando });
  ref.current = { abas, atual, irPara, atualizar, atualizando };

  useEffect(() => {
    let toque: Toque | null = null;
    let quadro = 0;
    let puxadoAgora = 0;
    const conteudo = () => document.querySelector<HTMLElement>('.app > main');

    const moverConteudo = (x: number | null) => {
      const el = conteudo();
      if (!el) return;
      if (x === null) {
        el.style.transform = '';
        el.style.transition = '';
        el.style.willChange = '';
      } else {
        el.style.transition = 'none';
        el.style.willChange = 'transform';
        el.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
      }
    };
    const voltarConteudo = () => {
      const el = conteudo();
      if (!el || !el.style.transform) return moverConteudo(null);
      el.style.transition = 'transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1)';
      el.style.transform = 'translate3d(0, 0, 0)';
      const fim = () => {
        el.removeEventListener('transitionend', fim);
        if (!toque || toque.estado !== 'lado') moverConteudo(null);
      };
      el.addEventListener('transitionend', fim);
      setTimeout(fim, 300);
    };

    const agendar = (f: () => void) => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(f);
    };

    const inicio = (e: TouchEvent) => {
      toque = null;
      if (e.touches.length !== 1 || algoAberto()) return;
      const t = e.touches[0];
      const alvo = e.target instanceof Element ? e.target : null;
      const { abas: lista, atual: aqui, atualizando: ocupado } = ref.current;
      const proprio = !!alvo?.closest(ALVOS_PROPRIOS);
      const podeLado = lista.includes(aqui) && !proprio && !naBorda(t.clientX) && !dentroDeRolagemLateral(alvo);
      const podePuxar = !ocupado && window.scrollY <= 0 && !alvo?.closest('input, textarea, select, [contenteditable], [data-sem-gesto]') && !dentroDeRolagemVerticalRolada(alvo);
      if (!podeLado && !podePuxar) return;
      toque = { x0: t.clientX, y0: t.clientY, t0: e.timeStamp, dx: 0, dy: 0, estado: 'indefinido', podeLado, podePuxar };
    };

    const movimento = (e: TouchEvent) => {
      if (!toque || e.touches.length !== 1) return;
      const t = e.touches[0];
      toque.dx = t.clientX - toque.x0;
      toque.dy = t.clientY - toque.y0;
      if (toque.estado === 'indefinido') {
        // No topo, puxando para baixo: segura o "elástico" do iOS desde o 1º movimento
        // (depois que a rolagem nativa começa, não dá mais para segurá-la)
        if (toque.podePuxar && toque.dy >= 3 && toque.dy > Math.abs(toque.dx) * 1.2 && e.cancelable) e.preventDefault();
        const i = intencao(toque.dx, toque.dy);
        if (!i) return;
        if (i === 'lado' && toque.podeLado) toque.estado = 'lado';
        else if (i === 'vertical' && toque.dy > 0 && toque.podePuxar && window.scrollY <= 0) toque.estado = 'puxar';
        else {
          toque.estado = 'nada';
          return;
        }
      }
      if (toque.estado === 'lado') {
        if (e.cancelable) e.preventDefault();
        const { abas: lista, atual: aqui } = ref.current;
        const sentido: Sentido = toque.dx < 0 ? 'proxima' : 'anterior';
        const tem = abaVizinha(lista.indexOf(aqui), lista.length, sentido) !== null;
        const x = deslocamentoLado(toque.dx, tem);
        agendar(() => moverConteudo(x));
      } else if (toque.estado === 'puxar') {
        if (e.cancelable) e.preventDefault();
        puxadoAgora = resistencia(toque.dy - 10);
        const valor = puxadoAgora;
        agendar(() => setPuxado(valor));
      }
    };

    const fimDoToque = (e: TouchEvent) => {
      const t = toque;
      toque = null;
      if (!t) return;
      cancelAnimationFrame(quadro);
      if (t.estado === 'lado') {
        const { abas: lista, atual: aqui, irPara: ir } = ref.current;
        const sentido = e.type === 'touchend' ? decidirTroca(t.dx, t.dy, e.timeStamp - t.t0, window.innerWidth) : null;
        const i = sentido ? abaVizinha(lista.indexOf(aqui), lista.length, sentido) : null;
        if (sentido && i !== null) ir(lista[i], sentido, () => moverConteudo(null));
        else voltarConteudo();
      } else if (t.estado === 'puxar') {
        const valor = puxadoAgora;
        puxadoAgora = 0;
        if (e.type === 'touchend' && valor >= LIMIAR_PUXAR) {
          setSoltando(false);
          setPuxado(LIMIAR_PUXAR);
          setAtualizando(true);
          const minimo = new Promise((ok) => setTimeout(ok, 650));
          void Promise.all([ref.current.atualizar().catch(() => undefined), minimo]).finally(() => {
            setSoltando(true);
            setPuxado(0);
            setAtualizando(false);
          });
        } else if (valor > 0) {
          // Sem deslocamento não há transição (nem transitionend para tirar o "soltando")
          setSoltando(true);
          setPuxado(0);
        } else setPuxado(0);
      }
    };

    document.addEventListener('touchstart', inicio, { passive: true });
    document.addEventListener('touchmove', movimento, { passive: false });
    document.addEventListener('touchend', fimDoToque, { passive: true });
    document.addEventListener('touchcancel', fimDoToque, { passive: true });
    return () => {
      cancelAnimationFrame(quadro);
      document.removeEventListener('touchstart', inicio);
      document.removeEventListener('touchmove', movimento);
      document.removeEventListener('touchend', fimDoToque);
      document.removeEventListener('touchcancel', fimDoToque);
      moverConteudo(null);
    };
  }, []);

  const progresso = progressoPuxar(puxado);
  const visivel = puxado > 0 || atualizando;
  return (
    <div
      className={`puxar${visivel ? ' puxar-visivel' : ''}${atualizando ? ' puxar-girando' : ''}${progresso >= 1 ? ' puxar-pronto' : ''}${soltando ? ' puxar-soltando' : ''}`}
      style={{ '--puxar-y': `${puxado.toFixed(1)}px`, '--puxar-p': progresso.toFixed(3) } as CSSProperties}
      role="status"
      aria-live="polite"
      onTransitionEnd={() => setSoltando(false)}
    >
      <span className="puxar-circulo" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle className="puxar-arco" cx="12" cy="12" r="8.5" pathLength="100" />
        </svg>
      </span>
      <span className="oculto-visual">{atualizando ? 'Atualizando…' : ''}</span>
    </div>
  );
}
