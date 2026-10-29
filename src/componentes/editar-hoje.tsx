import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as PE, type RefObject } from 'react';
import { alternarFixo, alternarOculto, CARTOES_HOJE, ehPadrao, gruposLayout, layoutPadrao, mover, moverPara, type LayoutHoje } from '../lib/hoje-layout';
import { Folha, Icone } from './ui';

/*
 * Folha "Editar o Hoje": reordenar (arrastar pela alça ou ▲▼), fixar no topo,
 * esconder/mostrar e restaurar o padrão. Vale para este aparelho.
 */

const reduzMovimento = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const nomeDe = (id: string) => CARTOES_HOJE.find((c) => c.id === id)?.nome ?? id;

/** Animação FLIP: cada linha sai de onde estava e desliza até o lugar novo */
function useFlip(lista: RefObject<HTMLElement | null>, chave: string) {
  const antes = useRef(new Map<string, DOMRect>());
  const medir = () => {
    const m = new Map<string, DOMRect>();
    lista.current?.querySelectorAll<HTMLElement>('[data-linha]').forEach((el) => m.set(el.dataset.linha!, el.getBoundingClientRect()));
    return m;
  };
  useLayoutEffect(() => {
    const agora = medir();
    if (!reduzMovimento()) {
      lista.current?.querySelectorAll<HTMLElement>('[data-linha]').forEach((el) => {
        const a = antes.current.get(el.dataset.linha!);
        const b = agora.get(el.dataset.linha!);
        if (!b) return;
        if (!a) {
          el.animate?.([{ opacity: 0, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
          return;
        }
        const dy = a.top - b.top;
        if (Math.abs(dy) > 0.5) el.animate?.([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
      });
    }
    antes.current = agora;
  }, [chave]);
  /** Guarda as posições de agora (com o arrasto aplicado) antes de mudar a ordem */
  return () => {
    antes.current = medir();
  };
}

type Arrasto = { id: string; grupo: string[]; y0: number; rolagem0: number; alturas: Map<string, number>; meios: number[]; de: number; alvo: number; rolador: HTMLElement | null; quadro: number; yAgora: number };

export function FolhaEditarHoje({ layout, aoMudar, nascido, aoFechar }: { layout: LayoutHoje; aoMudar: (l: LayoutHoje) => void; nascido: boolean; aoFechar: () => void }) {
  const listaRef = useRef<HTMLDivElement>(null);
  const g = gruposLayout(layout);
  const guardarPosicoes = useFlip(listaRef, [...g.fixos, '|', ...g.soltos, '|', ...g.ocultos].join(','));
  const [anuncio, setAnuncio] = useState('');
  const arrasto = useRef<Arrasto | null>(null);
  // Folha fechada no meio do arrasto: para o laço de rolagem automática
  useEffect(
    () => () => {
      if (arrasto.current) cancelAnimationFrame(arrasto.current.quadro);
      arrasto.current = null;
    },
    [],
  );
  const [arrastando, setArrastando] = useState<string | null>(null);

  const mudar = (novo: LayoutHoje, texto: string) => {
    guardarPosicoes();
    aoMudar(novo);
    setAnuncio(texto);
  };

  function posicaoTexto(l: LayoutHoje, id: string) {
    const gr = gruposLayout(l);
    const lista = gr.fixos.includes(id) ? gr.fixos : gr.soltos;
    return `${nomeDe(id)}: ${lista.indexOf(id) + 1}º de ${lista.length}${gr.fixos.includes(id) ? ' nos fixados' : ''}`;
  }

  // ---------- Arrastar pela alça ----------
  function aplicarDeslocamentos(a: Arrasto) {
    const linhas = listaRef.current?.querySelectorAll<HTMLElement>('[data-linha]') ?? [];
    const dy = a.yAgora - a.y0 + ((a.rolador?.scrollTop ?? 0) - a.rolagem0);
    const altura = (a.alturas.get(a.id) ?? 0) + 6;
    // Centro da linha arrastada em coordenadas da lista (sem rolagem)
    const centro = a.meios[a.de] + dy;
    let alvo = 0;
    a.meios.forEach((m, i) => {
      if (i !== a.de && m < centro) alvo++;
    });
    a.alvo = alvo;
    linhas.forEach((el) => {
      const id = el.dataset.linha!;
      const i = a.grupo.indexOf(id);
      if (id === a.id) el.style.transform = `translateY(${dy}px)`;
      else if (i < 0) el.style.transform = '';
      else if (a.de < i && i <= alvo) el.style.transform = `translateY(${-altura}px)`;
      else if (alvo <= i && i < a.de) el.style.transform = `translateY(${altura}px)`;
      else el.style.transform = '';
    });
  }

  function rolarNaBorda(a: Arrasto) {
    const r = a.rolador;
    if (!r) return;
    const box = r.getBoundingClientRect();
    const margem = 56;
    let v = 0;
    if (a.yAgora < box.top + margem) v = -Math.ceil((box.top + margem - a.yAgora) / 6);
    else if (a.yAgora > box.bottom - margem) v = Math.ceil((a.yAgora - (box.bottom - margem)) / 6);
    if (v) {
      r.scrollTop += v;
      aplicarDeslocamentos(a);
    }
    a.quadro = requestAnimationFrame(() => arrasto.current === a && rolarNaBorda(a));
  }

  function inicioArrasto(e: PE<HTMLElement>, id: string, grupo: string[]) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const rolador = listaRef.current?.closest<HTMLElement>('.folha') ?? null;
    const alturas = new Map<string, number>();
    const meios: number[] = [];
    const topoRolagem = rolador?.scrollTop ?? 0;
    grupo.forEach((gid) => {
      const el = listaRef.current?.querySelector<HTMLElement>(`[data-linha="${gid}"]`);
      const r = el?.getBoundingClientRect();
      alturas.set(gid, r?.height ?? 0);
      meios.push(r ? r.top + r.height / 2 : 0);
    });
    const a: Arrasto = { id, grupo, y0: e.clientY, rolagem0: topoRolagem, alturas, meios, de: grupo.indexOf(id), alvo: grupo.indexOf(id), rolador, quadro: 0, yAgora: e.clientY };
    arrasto.current = a;
    setArrastando(id);
    a.quadro = requestAnimationFrame(() => rolarNaBorda(a));
  }

  function moverArrasto(e: PE<HTMLElement>) {
    const a = arrasto.current;
    if (!a) return;
    a.yAgora = e.clientY;
    aplicarDeslocamentos(a);
  }

  function fimArrasto() {
    const a = arrasto.current;
    if (!a) return;
    arrasto.current = null;
    cancelAnimationFrame(a.quadro);
    setArrastando(null);
    const linhas = [...(listaRef.current?.querySelectorAll<HTMLElement>('[data-linha]') ?? [])];
    if (a.alvo === a.de) {
      // Não mudou de lugar: a linha volta deslizando (transição do CSS)
      linhas.forEach((el) => (el.style.transform = ''));
      return;
    }
    // Mudou: as outras já estão onde vão ficar; tira o deslocamento sem transição e o FLIP leva a arrastada até a vaga
    guardarPosicoes();
    linhas.forEach((el) => {
      el.style.transition = 'none';
      el.style.transform = '';
    });
    requestAnimationFrame(() => linhas.forEach((el) => (el.style.transition = '')));
    const novo = moverPara(layout, a.id, a.alvo);
    aoMudar(novo);
    setAnuncio(posicaoTexto(novo, a.id));
  }

  // ---------- Linhas ----------
  function linha(id: string, grupo: 'fixos' | 'soltos' | 'ocultos') {
    const c = CARTOES_HOJE.find((x) => x.id === id)!;
    const lista = grupo === 'fixos' ? g.fixos : grupo === 'soltos' ? g.soltos : g.ocultos;
    const i = lista.indexOf(id);
    const fixo = grupo === 'fixos';
    const podeEsconder = c.ocultavel !== false;
    return (
      <li key={id} data-linha={id} className={`he-linha${arrastando === id ? ' he-arrastando' : ''}${grupo === 'ocultos' ? ' he-oculta' : ''}`}>
        {grupo === 'ocultos' ? (
          <button type="button" className="he-botao he-mostrar" aria-label={`Mostrar ${c.nome}`} onClick={() => mudar(alternarOculto(layout, id), `${c.nome} voltou para o Hoje`)}>
            <Icone nome="olho_fechado" />
          </button>
        ) : podeEsconder ? (
          <button type="button" className="he-botao" aria-label={`Esconder ${c.nome}`} onClick={() => mudar(alternarOculto(layout, id), `${c.nome} escondido`)}>
            <Icone nome="olho" />
          </button>
        ) : (
          <span className="he-botao he-trava" title="Sempre aparece" aria-hidden="true">
            <Icone nome="check" />
          </span>
        )}
        <div className="he-texto">
          <span className="he-nome">
            {c.nome}
            {fixo && <span className="he-selo-fixo">no topo</span>}
          </span>
          <span className="he-desc">
            {c.descricao}
            {!nascido && c.soNascido ? ' · depois do nascimento' : ''}
            {!podeEsconder ? ' · sempre aparece' : ''}
          </span>
        </div>
        {grupo !== 'ocultos' && (
          <>
            <button
              type="button"
              className={`he-botao he-fixar${fixo ? ' ativo' : ''}`}
              aria-pressed={fixo}
              aria-label={fixo ? `Soltar ${c.nome} do topo` : `Fixar ${c.nome} no topo`}
              onClick={() => {
                const novo = alternarFixo(layout, id);
                mudar(novo, fixo ? `${c.nome} voltou para o lugar dele` : `${c.nome} fixado no topo`);
              }}
            >
              <Icone nome="alfinete" />
            </button>
            <span className="he-setas">
              <button type="button" className="he-seta" aria-label={`Subir ${c.nome}`} disabled={i <= 0} onClick={() => { const n = mover(layout, id, -1); mudar(n, posicaoTexto(n, id)); }}>
                <Icone nome="subir" />
              </button>
              <button type="button" className="he-seta he-descer" aria-label={`Descer ${c.nome}`} disabled={i >= lista.length - 1} onClick={() => { const n = mover(layout, id, 1); mudar(n, posicaoTexto(n, id)); }}>
                <Icone nome="subir" />
              </button>
            </span>
            <span
              className="he-alca"
              data-sem-gesto=""
              aria-hidden="true"
              title="Arrastar"
              onPointerDown={(e) => inicioArrasto(e, id, lista)}
              onPointerMove={moverArrasto}
              onPointerUp={fimArrasto}
              onPointerCancel={fimArrasto}
              onLostPointerCapture={fimArrasto}
            >
              <Icone nome="menu" />
            </span>
          </>
        )}
      </li>
    );
  }

  const padrao = ehPadrao(layout);
  return (
    <Folha titulo="Editar o Hoje" aoFechar={aoFechar} classe="he-folha">
      <div className="pilha" ref={listaRef}>
        <p className="texto-2 he-ajuda">Arraste pela alça <Icone nome="menu" /> ou use as setas. O alfinete fixa o cartão no topo. Vale só para este aparelho.</p>
        {g.fixos.length > 0 && (
          <section aria-label="Fixados no topo">
            <h3 className="he-titulo">Fixados no topo</h3>
            <ul className="he-lista">{g.fixos.map((id) => linha(id, 'fixos'))}</ul>
          </section>
        )}
        <section aria-label="No Hoje">
          <h3 className="he-titulo">{g.fixos.length ? 'Depois' : 'No Hoje'}</h3>
          <ul className="he-lista">{g.soltos.map((id) => linha(id, 'soltos'))}</ul>
        </section>
        {g.ocultos.length > 0 && (
          <section aria-label="Escondidos">
            <h3 className="he-titulo">Escondidos</h3>
            <ul className="he-lista">{g.ocultos.map((id) => linha(id, 'ocultos'))}</ul>
          </section>
        )}
        <p className="mudo he-ajuda">Cronômetro de mamada ou sono em andamento sempre aparece no topo.</p>
        <div className="linha">
          <button type="button" className="botao" disabled={padrao} onClick={() => mudar(layoutPadrao(), 'Ordem padrão restaurada')}>
            <Icone nome="girar" /> Restaurar padrão
          </button>
          <button type="button" className="botao primario cresce" onClick={aoFechar}>
            Pronto
          </button>
        </div>
        <span className="oculto-visual" role="status" aria-live="polite">
          {anuncio}
        </span>
      </div>
    </Folha>
  );
}
