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

/** Imagem com zoom: pinça com dois dedos ou dois toques (2,5×); arrasta para mover */
function ImagemZoom({ url, alt, aoZoom }: { url: string; alt: string; aoZoom: (ampliada: boolean) => void }) {
  const caixa = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const escala = useRef(1);
  const ultimoToque = useRef<{ t: number; x: number; y: number } | null>(null);

  // Aplica a escala mantendo o ponto (fx, fy) da tela parado
  const aplicar = (nova: number, fx: number, fy: number) => {
    const el = caixa.current;
    const im = img.current;
    if (!el || !im) return;
    const antes = escala.current;
    nova = Math.min(5, Math.max(1, nova));
    const r = el.getBoundingClientRect();
    const px = el.scrollLeft + (fx - r.left);
    const py = el.scrollTop + (fy - r.top);
    escala.current = nova;
    if (nova <= 1.01) {
      escala.current = 1;
      im.style.width = '';
      im.style.maxWidth = '';
      im.style.maxHeight = '';
      el.style.overflow = 'hidden';
      el.scrollLeft = el.scrollTop = 0;
      aoZoom(false);
      return;
    }
    // Largura que a imagem ocupa sem zoom (cabe na tela)
    const nat = im.naturalWidth / im.naturalHeight || 1;
    const base = Math.min(r.width, r.height * nat);
    im.style.maxWidth = 'none';
    im.style.maxHeight = 'none';
    im.style.width = `${base * nova}px`;
    el.style.overflow = 'auto';
    const k = nova / antes;
    el.scrollLeft = px * k - (fx - r.left);
    el.scrollTop = py * k - (fy - r.top);
    aoZoom(true);
  };

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    let pinca: { d: number; e: number } | null = null;
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const centro = (t: TouchList) => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2] as const;
    const inicio = (ev: TouchEvent) => {
      if (ev.touches.length === 2) {
        ev.preventDefault();
        pinca = { d: dist(ev.touches), e: escala.current };
      }
    };
    const move = (ev: TouchEvent) => {
      if (pinca && ev.touches.length === 2) {
        ev.preventDefault();
        const [cx, cy] = centro(ev.touches);
        aplicar(pinca.e * (dist(ev.touches) / pinca.d), cx, cy);
      }
    };
    const fim = (ev: TouchEvent) => {
      if (ev.touches.length < 2) pinca = null;
    };
    el.addEventListener('touchstart', inicio, { passive: false });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', fim);
    el.addEventListener('touchcancel', fim);
    return () => {
      el.removeEventListener('touchstart', inicio);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', fim);
      el.removeEventListener('touchcancel', fim);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={caixa}
      className="vis-zoom"
      onPointerUp={(e) => {
        // Dois toques rápidos no mesmo lugar: amplia ou volta
        const agora = Date.now();
        const u = ultimoToque.current;
        if (u && agora - u.t < 320 && Math.hypot(e.clientX - u.x, e.clientY - u.y) < 30) {
          aplicar(escala.current > 1 ? 1 : 2.5, e.clientX, e.clientY);
          ultimoToque.current = null;
        } else ultimoToque.current = { t: agora, x: e.clientX, y: e.clientY };
      }}
    >
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
