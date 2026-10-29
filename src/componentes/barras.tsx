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
 * Onde vai o valor da coluna marcada: centralizado nela, mas sem sair da área do gráfico (perto da
 * borda direita alinha pelo fim, perto do eixo pelo começo, ex.: "R$ 300,00" numa coluna estreita
 * no fim) e acima de toda coluna que o texto cobre (não fica por cima da vizinha mais alta).
 */
function posicaoRotulo(texto: string, i: number, centro: (j: number) => number, topoDe: (j: number) => number, n: number) {
  // Largura aproximada do texto (10px, semi-negrito, números tabulares)
  const largura = texto.length * 6;
  const cx = centro(i);
  const [x, ancora]: [number, 'start' | 'middle' | 'end'] =
    cx + largura / 2 > W - R ? [W - R, 'end'] : cx - largura / 2 < L ? [L, 'start'] : [cx, 'middle'];
  const x0 = ancora === 'end' ? x - largura : ancora === 'start' ? x : x - largura / 2;
  const x1 = x0 + largura;
  let topo = topoDe(i);
  for (let j = 0; j < n; j++) {
    const meia = Math.min(12, (W - L - R) / n / 2);
    if (centro(j) + meia > x0 && centro(j) - meia < x1) topo = Math.min(topo, topoDe(j));
  }
  // Subiu por causa da vizinha: um fio liga o valor à coluna dele
  return { x, ancora, y: Math.max(topo - 5, 10), fio: topo < topoDe(i) - 1 ? { x: cx, de: Math.max(topo - 5, 10) + 3, ate: topoDe(i) - 2 } : null };
}

/**
 * Colunas por dia (uma série só: o título diz o que é). Valor no topo da coluna
 * de hoje; toque numa coluna para ver o valor dela.
 */
export function BarrasDiarias({
  dados,
  formatar,
  tipo,
  rotulo,
  rotulos,
  nomes,
  formatarEixo,
  media,
  estreita,
}: {
  dados: BarraDia[];
  formatar: (v: number) => string;
  tipo: string;
  rotulo: string;
  /** Texto embaixo de cada coluna (no lugar do dia), ex.: "1º" para meses */
  rotulos?: string[];
  /** Nome de cada coluna para leitores de tela, ex.: "1º mês" */
  nomes?: string[];
  /** Texto das marcas do eixo (padrão: o número) */
  formatarEixo?: (v: number) => string;
  /** Linha tracejada de média (mesma unidade dos valores) */
  media?: number;
  /** Colunas mais finas e bem arredondadas (muitas colunas, ex.: 12 meses) */
  estreita?: boolean;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const max = Math.max(...dados.map((d) => d.valor), 0);
  const passo = passoBonito(max || 1);
  const topo = Math.max(passo, Math.ceil(max / passo) * passo);
  const ticks = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
  const banda = (W - L - R) / dados.length;
  const largura = estreita ? Math.min(18, banda * 0.62) : Math.min(24, banda - 2);
  const y = (v: number) => T + (1 - v / topo) * (H - T - B);
  const mostrarDia = (i: number) => dados.length <= 14 || i % Math.ceil(dados.length / 10) === 0 || i === dados.length - 1;
  const marcado = ativo ?? dados.length - 1;
  const rotuloMarcado = dados[marcado]
    ? posicaoRotulo(formatar(dados[marcado].valor), marcado, (j) => L + banda * j + banda / 2, (j) => y(dados[j].valor), dados.length)
    : null;

  return (
    <div className={`grafico-barras t-${tipo}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={rotulo}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grade-linha" />
            <text x={L - 5} y={y(v) + 3.5} textAnchor="end" className="eixo-texto">
              {formatarEixo ? formatarEixo(v) : Number.isInteger(v) ? v : v.toFixed(1)}
            </text>
          </g>
        ))}
        {media !== undefined && media > 0 && media < topo && (
          <g className="barras-media">
            <line x1={L} x2={W - R} y1={y(media)} y2={y(media)} />
            <text x={L + 2} y={y(media) - 4}>média {formatar(media)}</text>
          </g>
        )}
        {dados.map((d, i) => {
          const cx = L + banda * i + banda / 2;
          const h = Math.max(0, y(0) - y(d.valor));
          const x = cx - largura / 2;
          const r = Math.min(estreita ? 6 : 4, largura / 2, h);
          const dia = inicioDoDia(d.dia);
          return (
            <g
              key={d.dia}
              onClick={() => setAtivo(i === ativo ? null : i)}
              onMouseEnter={() => setAtivo(i)}
              onFocus={() => setAtivo(i)}
              tabIndex={0}
              role="button"
              aria-label={`${nomes?.[i] ?? dia.toLocaleDateString('pt-BR')}: ${formatar(d.valor)}`}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              <rect x={cx - banda / 2} y={T} width={banda} height={H - T - B} fill="transparent" />
              {h > 0 && (
                <path
                  className={`barra-dia ${i === marcado ? 'ativa' : ''}`}
                  d={`M${x},${y(0)} V${y(0) - h + r} Q${x},${y(0) - h} ${x + r},${y(0) - h} H${x + largura - r} Q${x + largura},${y(0) - h} ${x + largura},${y(0) - h + r} V${y(0)} Z`}
                />
              )}
              {i === marcado && rotuloMarcado?.fio && (
                <line x1={rotuloMarcado.fio.x} x2={rotuloMarcado.fio.x} y1={rotuloMarcado.fio.de} y2={rotuloMarcado.fio.ate} className="grade-linha" style={{ stroke: 'var(--texto-3)', strokeDasharray: '2 2' }} />
              )}
              {i === marcado && rotuloMarcado && (
                <text x={rotuloMarcado.x} y={rotuloMarcado.y} textAnchor={rotuloMarcado.ancora} className="eixo-texto" style={{ fill: 'var(--texto)', fontWeight: 650 }}>
                  {formatar(d.valor)}
                </text>
              )}
              {mostrarDia(i) && (
                <text x={cx} y={H - 6} textAnchor="middle" className="eixo-texto">
                  {rotulos ? rotulos[i] : dados.length <= 7 ? DIAS[dia.getDay()] : dia.getDate()}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
