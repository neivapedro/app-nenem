// Ajustar a foto do documento: arraste os 4 cantos até as pontas do papel, gire
// se precisar e escolha o realce. O app endireita (tira a mesa e o ângulo).
import { useEffect, useMemo, useRef, useState } from 'react';
import { cantosIniciais, cantosValidos, endireitar, ordenarCantos, tamanhoSaida, type Cantos, type Filtro } from '../lib/perspectiva';
import { Icone } from './ui';

/** Lado maior da foto de trabalho (e da foto final) */
const MAX = 2400;

async function carregar(blob: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error('Não foi possível abrir a foto.'));
      i.src = url;
    });
    const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    const ctx = c.getContext('2d')!;
    // Fundo branco: PNG transparente não vira quadro preto
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function girar(origem: HTMLCanvasElement, sentido: 1 | -1): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = origem.height;
  c.height = origem.width;
  const ctx = c.getContext('2d')!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((sentido * Math.PI) / 2);
  ctx.drawImage(origem, -origem.width / 2, -origem.height / 2);
  return c;
}

const paraBlob = (c: HTMLCanvasElement, q = 0.88) =>
  new Promise<Blob>((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error('Não foi possível preparar a foto.'))), 'image/jpeg', q));

export function EditorFoto({ foto, aoPronto, aoCancelar, textoPular }: { foto: Blob; aoPronto: (b: Blob) => void; aoCancelar: () => void; textoPular?: string }) {
  const [fonte, setFonte] = useState<HTMLCanvasElement | null>(null);
  // Foto como abriu (sem giro): "usar como está" só reaproveita o arquivo original se não girou
  const [original, setOriginal] = useState<HTMLCanvasElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [cantos, setCantos] = useState<Cantos | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('realcar');
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const [caixa, setCaixa] = useState({ w: 0, h: 0 });
  const arrastando = useRef<number | null>(null);

  useEffect(() => {
    let vivo = true;
    carregar(foto)
      .then((c) => vivo && (setFonte(c), setOriginal(c), setCantos(cantosIniciais(c.width, c.height, 0.05))))
      .catch((e) => vivo && setErro((e as Error).message));
    return () => {
      vivo = false;
    };
  }, [foto]);

  // Imagem para mostrar (muda ao girar)
  useEffect(() => {
    if (!fonte) return;
    let u: string | null = null;
    let vivo = true;
    paraBlob(fonte, 0.8).then((b) => {
      if (!vivo) return;
      u = URL.createObjectURL(b);
      setUrl(u);
    });
    return () => {
      vivo = false;
      if (u) URL.revokeObjectURL(u);
    };
  }, [fonte]);

  // Tamanho da foto na tela (cabe na área, mantendo a proporção)
  useEffect(() => {
    const medir = () => {
      const a = area.current;
      if (!a || !fonte) return;
      const k = Math.min(a.clientWidth / fonte.width, a.clientHeight / fonte.height);
      setCaixa({ w: fonte.width * k, h: fonte.height * k });
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [fonte]);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const escala = fonte && caixa.w ? fonte.width / caixa.w : 1;
  // Cantos na ordem certa, seja qual for a bolinha levada a cada ponta (não espelha)
  const ordenados = useMemo(() => (cantos ? ordenarCantos(cantos) : null), [cantos]);
  const valido = useMemo(() => !!ordenados && cantosValidos(ordenados), [ordenados]);

  function mover(e: React.PointerEvent<SVGSVGElement>) {
    const i = arrastando.current;
    if (i === null || !cantos || !fonte) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.min(fonte.width, Math.max(0, ((e.clientX - r.left) / r.width) * fonte.width));
    const y = Math.min(fonte.height, Math.max(0, ((e.clientY - r.top) / r.height) * fonte.height));
    const novos = [...cantos] as Cantos;
    novos[i] = { x, y };
    setCantos(novos);
  }

  function girarFoto(sentido: 1 | -1) {
    if (!fonte) return;
    const g = girar(fonte, sentido);
    setFonte(g);
    setCantos(cantosIniciais(g.width, g.height, 0.05));
  }

  async function concluir() {
    if (!fonte || !ordenados) return;
    if (!valido) return setErro('Os cantos não formam o documento. Arraste cada bolinha para uma ponta do papel.');
    setProcessando(true);
    setErro(null);
    // Deixa a tela mostrar "Endireitando…" antes do cálculo
    await new Promise((r) => setTimeout(r, 30));
    try {
      const { w, h } = tamanhoSaida(ordenados, MAX);
      const origem = fonte.getContext('2d')!.getImageData(0, 0, fonte.width, fonte.height);
      const saida = document.createElement('canvas');
      saida.width = w;
      saida.height = h;
      const ctx = saida.getContext('2d')!;
      const destino = ctx.createImageData(w, h);
      endireitar(origem, ordenados, destino, filtro);
      ctx.putImageData(destino, 0, 0);
      aoPronto(await paraBlob(saida));
    } catch (e) {
      setErro((e as Error).message || 'Não foi possível ajustar a foto.');
      setProcessando(false);
    }
  }

  /** Sem recorte: a foto como está, mas com o giro feito aqui */
  async function usarComoEsta() {
    if (!fonte || fonte === original) return aoPronto(foto);
    setProcessando(true);
    try {
      aoPronto(await paraBlob(fonte));
    } catch (e) {
      setErro((e as Error).message || 'Não foi possível preparar a foto.');
      setProcessando(false);
    }
  }

  const raio = 16 * escala;
  return (
    <div className="editor-foto" role="dialog" aria-modal="true" aria-label="Ajustar foto">
      <div className="vis-topo">
        <button className="vis-botao" onClick={aoCancelar} aria-label="Cancelar">
          <Icone nome="fechar" />
        </button>
        <div className="vis-titulo">
          <strong>Ajustar foto</strong>
          <span>Arraste as bolinhas até as pontas do documento</span>
        </div>
      </div>
      <div ref={area} className="editor-area">
        {url && cantos && ordenados && fonte && caixa.w > 0 && (
          <div className="editor-caixa" style={{ width: caixa.w, height: caixa.h }}>
            <img src={url} alt="Foto do documento" draggable={false} />
            <svg
              viewBox={`0 0 ${fonte.width} ${fonte.height}`}
              preserveAspectRatio="none"
              onPointerMove={mover}
              onPointerUp={() => (arrastando.current = null)}
              onPointerCancel={() => (arrastando.current = null)}
            >
              <path
                d={`M0,0H${fonte.width}V${fonte.height}H0Z M${ordenados.map((c) => `${c.x},${c.y}`).join(' L')} Z`}
                fillRule="evenodd"
                className="editor-sombra"
              />
              <polygon
                points={ordenados.map((c) => `${c.x},${c.y}`).join(' ')}
                className={`editor-borda ${valido ? '' : 'ruim'}`}
                style={{ strokeWidth: 3 * escala }}
              />
              {cantos.map((c, i) => (
                <circle
                  key={i}
                  cx={c.x}
                  cy={c.y}
                  r={raio}
                  className="editor-canto"
                  style={{ strokeWidth: 3 * escala }}
                  onPointerDown={(e) => {
                    e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
                    arrastando.current = i;
                  }}
                />
              ))}
            </svg>
          </div>
        )}
        {!url && !erro && <span className="vis-carregando">Abrindo a foto…</span>}
      </div>
      <div className="editor-barra">
        {erro && <p className="vis-erro">{erro}</p>}
        <div className="editor-filtros" role="radiogroup" aria-label="Realce">
          {(
            [
              ['original', 'Original'],
              ['realcar', 'Realçar'],
              ['pb', 'Preto e branco'],
            ] as [Filtro, string][]
          ).map(([v, r]) => (
            <button key={v} role="radio" aria-checked={filtro === v} className={filtro === v ? 'ativo' : ''} onClick={() => setFiltro(v)}>
              {r}
            </button>
          ))}
        </div>
        <div className="editor-acoes">
          <button className="vis-botao" disabled={!fonte || processando} onClick={() => girarFoto(-1)} aria-label="Girar para a esquerda">
            <span style={{ display: 'inline-flex', transform: 'scaleX(-1)' }}>
              <Icone nome="trocar" />
            </span>
          </button>
          <button className="vis-botao" disabled={!fonte || processando} onClick={() => girarFoto(1)} aria-label="Girar para a direita">
            <Icone nome="trocar" />
          </button>
          <button className="vis-botao texto" disabled={!fonte || processando} onClick={() => fonte && setCantos(cantosIniciais(fonte.width, fonte.height, 0))}>
            Foto inteira
          </button>
          <button className="botao primario" disabled={!fonte || !cantos || processando} onClick={() => void concluir()}>
            {processando ? 'Endireitando…' : 'Pronto'}
          </button>
        </div>
        {textoPular && (
          <button className="vis-botao texto" disabled={processando} onClick={() => void usarComoEsta()}>
            {textoPular}
          </button>
        )}
      </div>
    </div>
  );
}
