import { useState } from 'react';
import { inicioDoDia } from '../lib/datas';

export interface BarraDia {
  dia: string;
  valor: number;
}

const W = 340;
const H = 150;
const L = 30;
const R = 6;
const T = 18;
const B = 22;

function passoBonito(max: number): number {
  const bruto = max / 3;
  if (bruto <= 0) return 1;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const n = bruto / pot;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pot;
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/**
 * Colunas por dia (uma série só: o título diz o que é). Valor no topo da coluna
 * de hoje; toque numa coluna para ver o valor dela.
 */
export function BarrasDiarias({ dados, formatar, tipo, rotulo }: { dados: BarraDia[]; formatar: (v: number) => string; tipo: string; rotulo: string }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const max = Math.max(...dados.map((d) => d.valor), 0);
  const passo = passoBonito(max || 1);
  const topo = Math.max(passo, Math.ceil(max / passo) * passo);
  const ticks = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
  const banda = (W - L - R) / dados.length;
  const largura = Math.min(24, banda - 2);
  const y = (v: number) => T + (1 - v / topo) * (H - T - B);
  const mostrarDia = (i: number) => dados.length <= 14 || i % Math.ceil(dados.length / 10) === 0 || i === dados.length - 1;
  const marcado = ativo ?? dados.length - 1;

  return (
    <div className={`grafico-barras t-${tipo}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rotulo}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grade-linha" />
            <text x={L - 5} y={y(v) + 3.5} textAnchor="end" className="eixo-texto">
              {Number.isInteger(v) ? v : v.toFixed(1)}
            </text>
          </g>
        ))}
        {dados.map((d, i) => {
          const cx = L + banda * i + banda / 2;
          const h = Math.max(0, y(0) - y(d.valor));
          const x = cx - largura / 2;
          const r = Math.min(4, largura / 2, h);
          const dia = inicioDoDia(d.dia);
          return (
            <g
              key={d.dia}
              onClick={() => setAtivo(i === ativo ? null : i)}
              onMouseEnter={() => setAtivo(i)}
              onFocus={() => setAtivo(i)}
              tabIndex={0}
              role="button"
              aria-label={`${dia.toLocaleDateString('pt-BR')}: ${formatar(d.valor)}`}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              <rect x={cx - banda / 2} y={T} width={banda} height={H - T - B} fill="transparent" />
              {h > 0 && (
                <path
                  className={`barra-dia ${i === marcado ? 'ativa' : ''}`}
                  d={`M${x},${y(0)} V${y(0) - h + r} Q${x},${y(0) - h} ${x + r},${y(0) - h} H${x + largura - r} Q${x + largura},${y(0) - h} ${x + largura},${y(0) - h + r} V${y(0)} Z`}
                />
              )}
              {i === marcado && (
                <text x={cx} y={Math.max(y(d.valor) - 5, 10)} textAnchor="middle" className="eixo-texto" style={{ fill: 'var(--texto)', fontWeight: 650 }}>
                  {formatar(d.valor)}
                </text>
              )}
              {mostrarDia(i) && (
                <text x={cx} y={H - 6} textAnchor="middle" className="eixo-texto">
                  {dados.length <= 7 ? DIAS[dia.getDay()] : dia.getDate()}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
