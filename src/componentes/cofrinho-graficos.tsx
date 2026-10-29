// Gráficos do Cofrinho: linhas (com área opcional) e barras horizontais.
// Marcas finas, grade discreta, legenda sempre que há 2+ séries, toque/arraste
// para ver os valores de um ponto (todas as séries juntas) e tabela ao lado.
import { useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

export interface SerieLinha {
  id: string;
  nome: string;
  /** Cor da marca (variável CSS); o texto nunca usa a cor da série */
  cor: string;
  valores: (number | null)[];
  /** Pinta a área até a base (só a série principal) */
  area?: boolean;
}

const W = 340;
const H = 190;
const L = 46;
const R = 10;
const T = 14;
const B = 24;

function passoBonito(max: number): number {
  const bruto = max / 4;
  if (bruto <= 0) return 1;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const n = bruto / pot;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pot;
}

export function GraficoLinhas({
  series,
  rotulosX,
  ticksX,
  formatar,
  formatarEixo,
  referencias = [],
  rotulo,
  legendaValor,
}: {
  series: SerieLinha[];
  /** Nome de cada ponto (para a leitura ao tocar), ex.: "nov/2026" ou "5 anos" */
  rotulosX: string[];
  /** Marcas do eixo X: índice e texto */
  ticksX: { i: number; texto: string }[];
  formatar: (v: number) => string;
  formatarEixo: (v: number) => string;
  /** Linhas de referência (metas) */
  referencias?: { valor: number; texto: string }[];
  rotulo: string;
  /** Mostra na legenda o último valor de cada série */
  legendaValor?: boolean;
}) {
  const id = useId();
  const [ativo, setAtivo] = useState<number | null>(null);
  const n = Math.max(1, ...series.map((s) => s.valores.length));
  const todos = series.flatMap((s) => s.valores.filter((v): v is number => v !== null));
  const max = Math.max(1, ...todos, ...referencias.map((r) => r.valor));
  const passo = passoBonito(max);
  const topo = Math.ceil(max / passo) * passo;
  const ticks = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
  const x = (i: number) => L + (n <= 1 ? 0 : (i / (n - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - v / topo) * (H - T - B);
  // Rótulos das metas: abaixo da linha (o espaço de baixo da curva é livre), de cima para baixo, 11px de distância no mínimo
  const posRef = (() => {
    const mapa = new Map<string, number>();
    let anterior = -Infinity;
    for (const r of [...referencias].sort((a, b) => b.valor - a.valor)) {
      const yy = Math.max(y(r.valor) + 10, anterior + 11);
      mapa.set(r.texto, yy);
      anterior = yy;
    }
    return mapa;
  })();

  const caminho = (vals: (number | null)[]) => {
    let d = '';
    let aberto = false;
    vals.forEach((v, i) => {
      if (v === null) {
        aberto = false;
        return;
      }
      d += `${aberto ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      aberto = true;
    });
    return d;
  };
  const area = (vals: (number | null)[]) => {
    const pts = vals.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] !== null);
    if (pts.length < 2) return '';
    return `M${x(pts[0][0])},${y(0)}` + pts.map(([i, v]) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('') + `L${x(pts[pts.length - 1][0])},${y(0)}Z`;
  };

  const mover = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - L) / (W - L - R)) * (n - 1));
    setAtivo(Math.min(n - 1, Math.max(0, i)));
  };
  const tecla = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight') setAtivo((a) => Math.min(n - 1, (a ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setAtivo((a) => Math.max(0, (a ?? n) - 1));
    else if (e.key === 'Escape') setAtivo(null);
    else return;
    e.preventDefault();
  };
  // A leitura fica do lado oposto ao dedo, para não ficar embaixo dele
  const ladoDireito = ativo !== null && x(ativo) < W / 2;

  return (
    <div className="grafico-linhas">
      {series.length > 1 && (
        <ul className="legenda" aria-label="Legenda">
          {series.map((s) => {
            const ultimo = [...s.valores].reverse().find((v) => v !== null);
            return (
              <li key={s.id}>
                <span className="chave-linha" style={{ background: s.cor }} />
                <span>{s.nome}</span>
                {legendaValor && ultimo !== undefined && ultimo !== null && <strong>{formatar(ultimo)}</strong>}
              </li>
            );
          })}
        </ul>
      )}
      <div className="grafico-area">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={rotulo}
          aria-describedby={`${id}-leitura`}
          tabIndex={0}
          onPointerMove={mover}
          onPointerDown={mover}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setAtivo(null)}
          onKeyDown={tecla}
          onBlur={() => setAtivo(null)}
          style={{ touchAction: 'pan-y' }}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grade-linha" />
              <text x={L - 6} y={y(v) + 3.5} textAnchor="end" className="eixo-texto">
                {formatarEixo(v)}
              </text>
            </g>
          ))}
          {ticksX.map((t) => (
            <text key={t.i} x={x(t.i)} y={H - 7} textAnchor={t.i === 0 ? 'start' : t.i === n - 1 ? 'end' : 'middle'} className="eixo-texto">
              {t.texto}
            </text>
          ))}
          {referencias.map((r) => (
            <g key={r.texto}>
              <line x1={L} x2={W - R} y1={y(r.valor)} y2={y(r.valor)} className="referencia-linha" />
              <text x={W - R - 2} y={posRef.get(r.texto) ?? y(r.valor) - 4} textAnchor="end" className="eixo-texto referencia-texto">
                {r.texto}
              </text>
            </g>
          ))}
          {series.map((s) => s.area && <path key={`a-${s.id}`} d={area(s.valores)} style={{ fill: s.cor }} className="area-serie" />)}
          {series.map((s) => (
            <path key={s.id} d={caminho(s.valores)} style={{ stroke: s.cor }} className="linha-serie" />
          ))}
          {/* Ponto final de cada série */}
          {ativo === null &&
            series.map((s) => {
              const i = s.valores.length - 1;
              const v = s.valores[i];
              return v === null || v === undefined ? null : <circle key={`f-${s.id}`} cx={x(i)} cy={y(v)} r={4} style={{ fill: s.cor }} className="ponto-serie" />;
            })}
          {ativo !== null && (
            <g>
              <line x1={x(ativo)} x2={x(ativo)} y1={T} y2={H - B} className="cruz-linha" />
              {series.map((s) => {
                const v = s.valores[ativo];
                return v === null || v === undefined ? null : <circle key={`p-${s.id}`} cx={x(ativo)} cy={y(v)} r={4.5} style={{ fill: s.cor }} className="ponto-serie" />;
              })}
            </g>
          )}
        </svg>
        <div id={`${id}-leitura`} className={`leitura ${ativo === null ? 'oculta' : ''} ${ladoDireito ? 'direita' : 'esquerda'}`} aria-live="polite">
          {ativo !== null && (
            <>
              <div className="leitura-titulo">{rotulosX[ativo]}</div>
              {series.map((s) => {
                const v = s.valores[ativo];
                return v === null || v === undefined ? null : (
                  <div key={s.id} className="leitura-linha">
                    <span className="chave-linha" style={{ background: s.cor }} />
                    <strong>{formatar(v)}</strong>
                    <span>{s.nome}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const CORES_AVATAR = ['--c-mamada', '--c-fralda', '--c-sono', '--c-agenda', '--c-mamadeira'];
const iniciais = (nome: string) => {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '?') + (p.length > 1 ? (p[p.length - 1][0] ?? '') : '')).toUpperCase();
};
const corDe = (nome: string) => CORES_AVATAR[[...nome].reduce((a, c) => a + c.charCodeAt(0), 0) % CORES_AVATAR.length];

/** Ranking (uma série): avatar com iniciais, nome, valor na ponta e barra fina */
export function BarrasHorizontais({ itens, formatar, rotulo }: { itens: { nome: string; valor: number; detalhe?: string }[]; formatar: (v: number) => string; rotulo: string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ol className="cf-rank" aria-label={rotulo}>
      {itens.map((i, k) => (
        <li key={i.nome} className={k === 0 ? 'primeiro' : undefined}>
          <span className="cf-avatar" style={{ '--cor': `var(${corDe(i.nome)})` } as CSSProperties} aria-hidden="true">
            {iniciais(i.nome)}
          </span>
          <div className="cf-rank-corpo">
            <div className="cf-rank-cab">
              <span className="nome">{i.nome}</span>
              <strong>{formatar(i.valor)}</strong>
            </div>
            <div className="cf-rank-trilho" aria-hidden="true">
              <span style={{ width: `${Math.max(3, (i.valor / max) * 100)}%` }} />
            </div>
            {i.detalhe && <span className="cf-rank-det">{i.detalhe}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Mini gráfico da evolução (só a forma): linha suave com área e ponto final */
export function Sparkline({ valores, rotulo }: { valores: number[]; rotulo: string }) {
  const id = useId().replace(/:/g, '');
  if (valores.length < 2) return null;
  const W = 300;
  const H = 56;
  const P = 5;
  const min = Math.min(...valores);
  const span = Math.max(...valores) - min || 1;
  const x = (i: number) => P + (i / (valores.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - min) / span) * (H - 2 * P);
  let d = `M${x(0).toFixed(1)},${y(valores[0]).toFixed(1)}`;
  for (let i = 1; i < valores.length; i++) {
    const m = (x(i - 1) + x(i)) / 2;
    d += `C${m.toFixed(1)},${y(valores[i - 1]).toFixed(1)} ${m.toFixed(1)},${y(valores[i]).toFixed(1)} ${x(i).toFixed(1)},${y(valores[i]).toFixed(1)}`;
  }
  const ult = valores.length - 1;
  return (
    <svg className="cf-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rotulo} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--cf-linha)', stopOpacity: 0.32 }} />
          <stop offset="1" style={{ stopColor: 'var(--cf-linha)', stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <path d={`${d}L${x(ult)},${H}L${x(0)},${H}Z`} fill={`url(#${id}-a)`} />
      <path d={d} className="cf-spark-linha" pathLength={1} />
    </svg>
  );
}

/** Anel de progresso com texto no centro */
export function Anel({ pct, rotulo, centro, sub }: { pct: number; rotulo: string; centro: string; sub: string }) {
  const id = useId().replace(/:/g, '');
  const R = 46;
  const C = 2 * Math.PI * R;
  return (
    <div className="cf-anel" role="img" aria-label={rotulo}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--cf-anel-a)' }} />
            <stop offset="1" style={{ stopColor: 'var(--cf-anel-b)' }} />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={R} className="cf-anel-trilho" />
        <circle cx="60" cy="60" r={R} className="cf-anel-prog" stroke={`url(#${id}-g)`} transform="rotate(-90 60 60)" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - Math.min(1, Math.max(0, pct))), ['--cf-c' as string]: C }} />
      </svg>
      <div className="cf-anel-centro" aria-hidden="true">
        <strong>{centro}</strong>
        <span>{sub}</span>
      </div>
    </div>
  );
}
