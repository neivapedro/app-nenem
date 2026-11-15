// Visualizador em tela cheia: mostra o documento para alguém (recepção, farmácia,
// escola). Desliza entre as páginas, dá zoom (pinça ou dois toques) e mantém a
// tela acesa. Funciona sem internet quando o arquivo já está no celular.
import { useEffect, useRef, useState } from 'react';
import { useDados } from '../dados/contexto';
import type { ArquivoDocumento, Documento } from '../lib/tipos';
import { obterArquivo } from './doc-arquivos';
import { Icone } from './ui';

interface Pagina {
  chave: string;
  url: string | null;
  /** Nome da folha do PDF; foto: "Página N" contada pela posição na tela */
  rotulo: string | null;
  /** Não abriu: o motivo aparece no lugar de "Abrindo…" */
  falha?: string;
}

const paginasIniciais = (arquivos: ArquivoDocumento[]): Pagina[] =>
  arquivos.map((a) => ({ chave: a.caminho, url: null, rotulo: a.tipo === 'application/pdf' ? a.nome : null }));

/** Mantém a tela acesa enquanto o documento está aberto */
function useTelaAcesa() {
  useEffect(() => {
    let trava: { release: () => Promise<void> } | null = null;
    const pedir = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (wl && document.visibilityState === 'visible') trava = await wl.request('screen');
      } catch {
        /* sem suporte: segue normal */
      }
    };
    void pedir();
    const voltou = () => document.visibilityState === 'visible' && void pedir();
    document.addEventListener('visibilitychange', voltou);
    return () => {
      document.removeEventListener('visibilitychange', voltou);
      void trava?.release().catch(() => undefined);
    };
  }, []);
}

/**
 * Imagem com zoom: pinça com dois dedos ou dois toques (2,5×); com zoom, um dedo arrasta a imagem.
 * Tudo por transformação (mover + ampliar), sem depender da rolagem nativa, que no iPhone
 * falhava dentro da galeria de páginas.
 */
function ImagemZoom({ url, alt, aoZoom }: { url: string; alt: string; aoZoom: (ampliada: boolean) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const aoZoomRef = useRef(aoZoom);
  useEffect(() => {
    aoZoomRef.current = aoZoom;
  });

  useEffect(() => {
    const el = caixa.current;
    const im = img.current;
    if (!el || !im) return;
    let s = 1;
    let tx = 0;
    let ty = 0;
    let ampliada = false;
    let ultimoToque: { t: number; x: number; y: number } | null = null;
    let pinca: { d: number; s: number; ux: number; uy: number } | null = null;
    let arrasto: { x: number; y: number; tx: number; ty: number; moveu: boolean } | null = null;
    let ultimoTouch = 0;

    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    // Posição em relação ao centro da caixa (a imagem fica centrada nela)
    const rel = (x: number, y: number) => {
      const r = el.getBoundingClientRect();
      return [x - r.left - r.width / 2, y - r.top - r.height / 2] as const;
    };
    const limite = (v: number, tam: number, caixaTam: number) => {
      const m = Math.max(0, (tam * s - caixaTam) / 2);
      return Math.min(m, Math.max(-m, v));
    };
    const pintar = (suave = false) => {
      if (s <= 1.01) {
        s = 1;
        tx = ty = 0;
      } else {
        tx = limite(tx, im.offsetWidth, el.clientWidth);
        ty = limite(ty, im.offsetHeight, el.clientHeight);
      }
      im.style.transition = suave ? 'transform 0.2s ease-out' : 'none';
      im.style.transform = s === 1 ? '' : `translate(${tx}px, ${ty}px) scale(${s})`;
      // Ampliada: o gesto é todo da imagem; sem zoom, o deslize para o lado continua trocando de página
      el.style.touchAction = s === 1 ? 'pan-x' : 'none';
      if ((s > 1) !== ampliada) {
        ampliada = s > 1;
        aoZoomRef.current(ampliada);
      }
    };
    // Muda a escala mantendo o ponto (px, py) da tela parado
    const zoomEm = (nova: number, px: number, py: number, suave = false) => {
      const ux = (px - tx) / s;
      const uy = (py - ty) / s;
      s = Math.min(5, Math.max(1, nova));
      tx = px - s * ux;
      ty = py - s * uy;
      pintar(suave);
    };

    const inicio = (ev: TouchEvent) => {
      ultimoTouch = Date.now();
      if (ev.touches.length === 2) {
        ev.preventDefault();
        const [cx, cy] = rel((ev.touches[0].clientX + ev.touches[1].clientX) / 2, (ev.touches[0].clientY + ev.touches[1].clientY) / 2);
        pinca = { d: dist(ev.touches), s, ux: (cx - tx) / s, uy: (cy - ty) / s };
        arrasto = null;
        ultimoToque = null;
      } else if (ev.touches.length === 1) {
        arrasto = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, tx, ty, moveu: false };
      }
    };
    const move = (ev: TouchEvent) => {
      if (pinca && ev.touches.length === 2) {
        ev.preventDefault();
        const [cx, cy] = rel((ev.touches[0].clientX + ev.touches[1].clientX) / 2, (ev.touches[0].clientY + ev.touches[1].clientY) / 2);
        s = Math.min(5, Math.max(1, pinca.s * (dist(ev.touches) / pinca.d)));
        tx = cx - s * pinca.ux;
        ty = cy - s * pinca.uy;
        pintar();
      } else if (arrasto && ev.touches.length === 1) {
        const dx = ev.touches[0].clientX - arrasto.x;
        const dy = ev.touches[0].clientY - arrasto.y;
        if (Math.hypot(dx, dy) > 8) arrasto.moveu = true;
        if (s > 1) {
          ev.preventDefault();
          tx = arrasto.tx + dx;
          ty = arrasto.ty + dy;
          pintar();
        }
      }
    };
    const fim = (ev: TouchEvent) => {
      if (ev.touches.length < 2) pinca = null;
      if (ev.touches.length === 1) {
        // Soltou um dos dedos da pinça: o outro continua arrastando dali
        arrasto = { x: ev.touches[0].clientX, y: ev.touches[0].clientY, tx, ty, moveu: true };
        return;
      }
      const toque = arrasto;
      arrasto = null;
      const c = ev.changedTouches[0];
      if (!toque || toque.moveu || !c || ev.touches.length) return;
      // Dois toques rápidos no mesmo lugar: amplia ou volta
      const agora = Date.now();
      const u = ultimoToque;
      if (u && agora - u.t < 320 && Math.hypot(c.clientX - u.x, c.clientY - u.y) < 30) {
        ev.preventDefault();
        const [px, py] = rel(c.clientX, c.clientY);
        if (s > 1) {
          s = 1;
          pintar(true);
        } else zoomEm(2.5, px, py, true);
        ultimoToque = null;
      } else ultimoToque = { t: agora, x: c.clientX, y: c.clientY };
    };
    // Mouse (computador): dois cliques
    const duplo = (ev: MouseEvent) => {
      if (Date.now() - ultimoTouch < 600) return;
      const [px, py] = rel(ev.clientX, ev.clientY);
      if (s > 1) {
        s = 1;
        pintar(true);
      } else zoomEm(2.5, px, py, true);
    };
    pintar();
    el.addEventListener('touchstart', inicio, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', fim, { passive: false });
    el.addEventListener('touchcancel', fim);
    el.addEventListener('dblclick', duplo);
    return () => {
      el.removeEventListener('touchstart', inicio);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', fim);
      el.removeEventListener('touchcancel', fim);
      el.removeEventListener('dblclick', duplo);
    };
  }, []);

  return (
    <div ref={caixa} className="vis-zoom">
      <img ref={img} src={url} alt={alt} draggable={false} />
    </div>
  );
}

export function Visualizador({
  doc,
  inicio = 0,
  aoFechar,
  aoCompartilhar,
}: {
  doc: Documento;
  inicio?: number;
  aoFechar: () => void;
  aoCompartilhar?: () => void;
}) {
  const { repo, mostrarAviso } = useDados();
  const [paginas, setPaginas] = useState<Pagina[]>(() => paginasIniciais(doc.arquivos));
  const [atual, setAtual] = useState(inicio);
  const [ampliada, setAmpliada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const trilho = useRef<HTMLDivElement>(null);
  useTelaAcesa();

  // A cada recarga (a cada minuto, ou quando o outro membro muda algo) os documentos
  // chegam como objetos novos: só recarrega se os arquivos mudaram de verdade
  const assinatura = doc.arquivos.map((a) => `${a.caminho}|${a.tipo}|${a.nome}`).join('\n');
  const arquivosRef = useRef(doc.arquivos);
  useEffect(() => {
    arquivosRef.current = doc.arquivos;
  });

  // Carrega cada arquivo (do celular ou do servidor); PDF vira uma página por folha
  useEffect(() => {
    let cancelado = false;
    const criadas: string[] = [];
    const arquivos = arquivosRef.current;
    setPaginas(paginasIniciais(arquivos));
    setErro(null);
    (async () => {
      for (const a of arquivos) {
        if (cancelado) return;
        try {
          const blob = await obterArquivo(repo, a.caminho);
          if (a.tipo !== 'application/pdf') {
            const url = URL.createObjectURL(blob);
            criadas.push(url);
            if (!cancelado) setPaginas((ps) => ps.map((p) => (p.chave === a.caminho ? { ...p, url } : p)));
            continue;
          }
          const { desenharPdf } = await import('../lib/pdf-render');
          const largura = Math.min(2600, Math.round(window.innerWidth * (window.devicePixelRatio || 2) * 1.5));
          const bytes = await blob.arrayBuffer();
          await desenharPdf(
            bytes,
            largura,
            (url, n, total) => {
              criadas.push(url);
              setPaginas((ps) => {
                const nova = { chave: `${a.caminho}#${n}`, url, rotulo: total > 1 ? `${a.nome} · folha ${n} de ${total}` : a.nome };
                // Folha que já está na tela: troca (nunca repete)
                if (ps.some((p) => p.chave === nova.chave)) return ps.map((p) => (p.chave === nova.chave ? nova : p));
                const i = ps.findIndex((p) => p.chave === a.caminho);
                if (n === 1) return ps.map((p, j) => (j === i ? nova : p));
                // Folhas seguintes entram logo depois da anterior
                const anterior = ps.findIndex((p) => p.chave === `${a.caminho}#${n - 1}`);
                return [...ps.slice(0, anterior + 1), nova, ...ps.slice(anterior + 1)];
              });
            },
            () => cancelado,
          );
        } catch (e) {
          if (cancelado) return;
          const senha = (e as Error)?.name === 'PasswordException';
          const falha = senha ? 'PDF protegido por senha' : 'Não abriu';
          setPaginas((ps) => ps.map((p) => (p.chave === a.caminho ? { ...p, falha } : p)));
          setErro(
            senha
              ? `"${a.nome}" tem senha para abrir e não dá para mostrar aqui.${aoCompartilhar ? ' Use o botão de enviar para abrir em outro app.' : ''}`
              : 'Parte do documento não abriu. Sem internet, só abrem os arquivos que já estão guardados no celular.',
          );
        }
      }
    })();
    return () => {
      cancelado = true;
      for (const u of criadas) URL.revokeObjectURL(u);
    };
  }, [assinatura, repo]);

  // Começa na página pedida
  useEffect(() => {
    const t = trilho.current;
    if (t && inicio) t.scrollLeft = inicio * t.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Esc fecha; setas mudam de página (teclado do iPad/computador)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
      if (e.key === 'ArrowRight') ir(atual + 1);
      if (e.key === 'ArrowLeft') ir(atual - 1);
    };
    document.addEventListener('keydown', tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = overflow;
    };
  });

  function ir(i: number) {
    const t = trilho.current;
    if (!t || i < 0 || i >= paginas.length) return;
    t.scrollTo({ left: i * t.clientWidth, behavior: 'smooth' });
  }

  const total = paginas.length;
  return (
    <div className="visualizador" role="dialog" aria-modal="true" aria-label={doc.titulo}>
      <div className="vis-topo">
        <button className="vis-botao" onClick={aoFechar} aria-label="Fechar">
          <Icone nome="fechar" />
        </button>
        <div className="vis-titulo">
          <strong>{doc.titulo}</strong>
          {total > 1 && (
            <span>
              {atual + 1} de {total}
            </span>
          )}
        </div>
        {aoCompartilhar && (
          <button className="vis-botao" onClick={aoCompartilhar} aria-label="Enviar ou imprimir">
            <Icone nome="compartilhar" />
          </button>
        )}
      </div>
      <div
        ref={trilho}
        className={`vis-trilho ${ampliada ? 'travado' : ''}`}
        onScroll={(e) => {
          const t = e.currentTarget;
          setAtual(Math.round(t.scrollLeft / Math.max(1, t.clientWidth)));
        }}
      >
        {paginas.map((p, i) => (
          <div key={p.chave} className="vis-pagina">
            {p.url ? (
              <ImagemZoom url={p.url} alt={p.rotulo ?? `Página ${i + 1}`} aoZoom={setAmpliada} />
            ) : (
              <span className="vis-carregando">{p.falha ?? 'Abrindo…'}</span>
            )}
          </div>
        ))}
        {!total && <div className="vis-pagina vis-carregando">Sem arquivo anexado.</div>}
      </div>
      <div className="vis-rodape">
        {erro && <p className="vis-erro">{erro}</p>}
        {doc.numero && (
          <button
            className="vis-numero"
            onClick={() =>
              navigator.clipboard
                .writeText(doc.numero!)
                .then(() => mostrarAviso({ texto: 'Número copiado' }))
                .catch(() => undefined)
            }
          >
            <span>{doc.numero}</span>
            <Icone nome="copiar" />
          </button>
        )}
        {total > 1 && (
          <div className="vis-pontos" aria-hidden="true">
            {paginas.map((p, i) => (
              <span key={p.chave} className={i === atual ? 'ativo' : ''} />
            ))}
          </div>
        )}
        {total > 1 && !ampliada && (
          <div className="vis-setas">
            <button className="vis-botao" disabled={atual === 0} onClick={() => ir(atual - 1)} aria-label="Página anterior">
              <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
                <Icone nome="seta" />
              </span>
            </button>
            <span className="vis-dica">Deslize para o lado · dois toques para ampliar</span>
            <button className="vis-botao" disabled={atual >= total - 1} onClick={() => ir(atual + 1)} aria-label="Próxima página">
              <Icone nome="seta" />
            </button>
          </div>
        )}
        {total === 1 && <span className="vis-dica">Dois toques ou pinça para ampliar</span>}
      </div>
    </div>
  );
}
