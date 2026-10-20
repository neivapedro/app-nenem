import { useMemo, useState } from 'react';
import { NOMES_INDICADOR, PERCENTIS_REFERENCIA, UNIDADE_INDICADOR, valorNoPercentil, type Indicador, type Sexo } from '../lib/crescimento';

export interface PontoCrescimento {
  id: string;
  dia: number;
  data: string;
  valor: number;
  percentil: string;
  /** Comparado com a OMS pela idade corrigida (prematuro) */
  corrigida?: boolean;
}

const L = 40;
const R = 36;
const T = 12;
const B = 30;
const W = 360;
const H = 250;

function passoBonito(faixa: number, alvo = 5): number {
  const bruto = faixa / alvo;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const n = bruto / pot;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pot;
}

const fmt = (v: number, casas: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/**
 * Curvas da OMS (P3, P15, P50, P85, P97) em cinza, com a faixa P3–P97 bem clara,
 * e as medidas do bebê numa linha só. Toque num ponto para ver o valor.
 */
export function GraficoCrescimento({ indicador, sexo, pontos, idadeCorrigida = false }: { indicador: Indicador; sexo: Sexo; pontos: PontoCrescimento[]; idadeCorrigida?: boolean }) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const unidade = UNIDADE_INDICADOR[indicador];
  const casas = indicador === 'peso' ? 2 : 1;

  const g = useMemo(() => {
    const ultimoDia = pontos.reduce((m, p) => Math.max(m, p.dia), 0);
    // Mostra pelo menos 3 meses e sempre 2 meses à frente da última medida (até 5 anos)
    const diaMax = Math.min(1826, Math.max(91, ultimoDia + 61));
    const meses = diaMax / 30.4375;
    const passoMes = meses <= 6 ? 1 : meses <= 12 ? 2 : meses <= 24 ? 3 : 6;
    const amostras: number[] = [];
    const passoDia = Math.max(1, Math.round(diaMax / 80));
    for (let d = 0; d <= diaMax; d += passoDia) amostras.push(d);
    if (amostras[amostras.length - 1] !== diaMax) amostras.push(diaMax);
    const curvas = PERCENTIS_REFERENCIA.map((p) => ({ p, valores: amostras.map((d) => valorNoPercentil(indicador, sexo, d, p) ?? 0) }));
    let yMin = Math.min(...curvas[0].valores, ...pontos.map((p) => p.valor));
    let yMax = Math.max(...curvas[curvas.length - 1].valores, ...pontos.map((p) => p.valor));
    const passoY = passoBonito(yMax - yMin);
    yMin = Math.floor(yMin / passoY) * passoY;
    yMax = Math.ceil(yMax / passoY) * passoY;
    const x = (d: number) => L + (d / diaMax) * (W - L - R);
    const y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
    const ticksY: number[] = [];
    for (let v = yMin; v <= yMax + 1e-9; v += passoY) ticksY.push(Math.round(v * 1000) / 1000);
    const ticksX: number[] = [];
    for (let m = 0; m <= meses + 1e-9; m += passoMes) ticksX.push(m);
    return { amostras, curvas, x, y, ticksY, ticksX, diaMax };
  }, [indicador, sexo, pontos]);

  const linha = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${g.x(g.amostras[i]).toFixed(1)},${g.y(v).toFixed(1)}`).join(' ');
  const p3 = g.curvas[0].valores;
  const p97 = g.curvas[g.curvas.length - 1].valores;
  const faixa = `${linha(p97)} ${[...p3].reverse().map((v, i) => `L${g.x(g.amostras[p3.length - 1 - i]).toFixed(1)},${g.y(v).toFixed(1)}`).join(' ')} Z`;
  const ordenados = [...pontos].sort((a, b) => a.dia - b.dia);
  const sel = pontos.find((p) => p.id === ativo) ?? null;
  const decimaisY = g.ticksY.some((v) => v % 1 !== 0) ? 1 : 0;

  return (
    <figure className="grafico-cresc" style={{ margin: 0 }}>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${NOMES_INDICADOR[indicador]} pela idade, com as curvas de percentis da OMS`} onClick={() => setAtivo(null)}>
          {g.ticksY.map((v) => (
            <g key={`y${v}`}>
              <line x1={L} x2={W - R} y1={g.y(v)} y2={g.y(v)} className="grade-linha" />
              <text x={L - 6} y={g.y(v) + 3.5} textAnchor="end" className="eixo-texto">
                {fmt(v, decimaisY)}
              </text>
            </g>
          ))}
          {g.ticksX.map((m) => (
            <text key={`x${m}`} x={g.x(m * 30.4375)} y={H - B + 16} textAnchor="middle" className="eixo-texto">
              {m}
            </text>
          ))}
          <text x={(L + W - R) / 2} y={H - 3} textAnchor="middle" className="eixo-texto">
            {idadeCorrigida ? 'idade corrigida até 2 anos (meses)' : 'idade (meses)'}
          </text>
          <path d={faixa} className="faixa-oms" />
          {g.curvas.map((c) => (
            <g key={c.p}>
              <path d={linha(c.valores)} className={`curva-oms ${c.p === 50 ? 'mediana' : ''}`} />
              <text x={W - R + 4} y={g.y(c.valores[c.valores.length - 1]) + 3.5} className="eixo-texto">
                P{c.p}
              </text>
            </g>
          ))}
          {ordenados.length > 1 && <path d={ordenados.map((p, i) => `${i ? 'L' : 'M'}${g.x(p.dia).toFixed(1)},${g.y(p.valor).toFixed(1)}`).join(' ')} className="linha-bebe" />}
          {ordenados.map((p) => (
            <g
              key={p.id}
              tabIndex={0}
              role="button"
              aria-label={`${p.data}: ${fmt(p.valor, casas)} ${unidade}, ${p.percentil}${p.corrigida ? ' (idade corrigida)' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setAtivo(p.id === ativo ? null : p.id);
              }}
              onFocus={() => setAtivo(p.id)}
              onMouseEnter={() => setAtivo(p.id)}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              <circle cx={g.x(p.dia)} cy={g.y(p.valor)} r={12} fill="transparent" />
              <circle cx={g.x(p.dia)} cy={g.y(p.valor)} r={p.id === ativo ? 6 : 4.5} className="ponto-bebe" />
            </g>
          ))}
        </svg>
        {sel && (
          <div
            className="dica-grafico"
            style={{
              left: `${Math.min(Math.max((g.x(sel.dia) / W) * 100, 18), 78)}%`,
              top: `${Math.max((g.y(sel.valor) / H) * 100 - 6, 0)}%`,
            }}
            role="status"
          >
            <strong>
              {fmt(sel.valor, casas)} {unidade}
            </strong>
            <span>
              {sel.percentil}
              {sel.corrigida ? ' (idade corrigida)' : ''} · {sel.data}
            </span>
          </div>
        )}
      </div>
      <figcaption className="mudo" style={{ marginTop: 6 }}>
        Linhas cinza: percentis 3, 15, 50, 85 e 97 da OMS para {sexo === 'M' ? 'meninos' : 'meninas'}. A faixa clara vai do P3 ao P97.
      </figcaption>
    </figure>
  );
}
