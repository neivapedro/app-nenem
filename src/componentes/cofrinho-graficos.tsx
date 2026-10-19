// Gráficos do Cofrinho: linhas (com área opcional) e barras horizontais.
// Marcas finas, grade discreta, legenda sempre que há 2+ séries, toque/arraste
// para ver os valores de um ponto (todas as séries juntas) e tabela ao lado.
import { useId, useState, type KeyboardEvent, type PointerEvent } from 'react';

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
              <text x={L + 4} y={y(r.valor) - 4} className="eixo-texto referencia-texto">
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

/** Barras horizontais (uma série): nome, barra e valor na ponta */
export function BarrasHorizontais({ itens, formatar, rotulo }: { itens: { nome: string; valor: number; detalhe?: string }[]; formatar: (v: number) => string; rotulo: string }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <ul className="barras-h" aria-label={rotulo}>
      {itens.map((i) => (
        <li key={i.nome}>
          <div className="barras-h-cab">
            <span className="nome">{i.nome}</span>
            <strong>{formatar(i.valor)}</strong>
          </div>
          <div className="barras-h-trilho">
            <span style={{ width: `${Math.max(2, (i.valor / max) * 100)}%` }} />
          </div>
          {i.detalhe && <span className="mudo">{i.detalhe}</span>}
        </li>
      ))}
    </ul>
  );
}
