import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as EventoPonteiro } from 'react';
import { NOMES_INDICADOR, PERCENTIS_REFERENCIA, PERIODOS_GRAFICO, periodoAutomatico, textoIdadeDias, UNIDADE_INDICADOR, valorNoPercentil, type Indicador, type Sexo } from '../lib/crescimento';
import { Escolhas } from './ui';
import '../estilos/saude.css';

export interface PontoCrescimento {
  id: string;
  dia: number;
  data: string;
  valor: number;
  percentil: string;
  /** Comparado com a OMS pela idade corrigida (prematuro) */
  corrigida?: boolean;
  /** Ganho desde a medida anterior do mesmo indicador (texto pronto) */
  ganho?: string | null;
}

const L = 36;
const R = 30;
const T = 12;
const B = 30;
const W = 360;
const H = 260;

function passoBonito(faixa: number, alvo = 5): number {
  const bruto = faixa / alvo;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const n = bruto / pot;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pot;
}

const fmt = (v: number, casas: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

/**
 * Curvas da OMS (P3, P15, P50, P85, P97) discretas, com a faixa P3–P97 bem clara,
 * e as medidas do bebê em destaque. Tocar ou passar o dedo no gráfico mostra a medida
 * mais perto (data, idade, valor, percentil e ganho desde a anterior).
 */
export function GraficoCrescimento({
  indicador,
  sexo,
  pontos,
  idadeCorrigida = false,
  idadeAtualDias = 0,
  nome = 'Bebê',
}: {
  indicador: Indicador;
  sexo: Sexo;
  pontos: PontoCrescimento[];
  idadeCorrigida?: boolean;
  /** Idade de hoje (na régua da OMS), para escolher o período automático */
  idadeAtualDias?: number;
  nome?: string;
}) {
  const [ativo, setAtivo] = useState<string | null>(null);
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const unidade = UNIDADE_INDICADOR[indicador];
  const casas = indicador === 'peso' ? 2 : 1;
  const ultimoDia = pontos.reduce((m, p) => Math.max(m, p.dia), 0);
  const automatico = periodoAutomatico(Math.max(idadeAtualDias, ultimoDia));
  const diaMax = escolhido ?? automatico;

  const g = useMemo(() => {
    const visiveis = pontos.filter((p) => p.dia <= diaMax).sort((a, b) => a.dia - b.dia);
    const meses = diaMax / 30.4375;
    const emAnos = diaMax > 731;
    const passoMes = emAnos ? 12 : meses <= 7 ? 1 : meses <= 13 ? 2 : 3;
    const amostras: number[] = [];
    const passoDia = Math.max(1, Math.round(diaMax / 90));
    for (let d = 0; d <= diaMax; d += passoDia) amostras.push(d);
    if (amostras[amostras.length - 1] !== diaMax) amostras.push(diaMax);
    const curvas = PERCENTIS_REFERENCIA.map((p) => ({ p, valores: amostras.map((d) => valorNoPercentil(indicador, sexo, d, p) ?? 0) }));
    let yMin = Math.min(...curvas[0].valores, ...visiveis.map((p) => p.valor));
    let yMax = Math.max(...curvas[curvas.length - 1].valores, ...visiveis.map((p) => p.valor));
    const passoY = passoBonito(yMax - yMin);
    yMin = Math.floor(yMin / passoY) * passoY;
    yMax = Math.ceil(yMax / passoY) * passoY;
    const x = (d: number) => L + (d / diaMax) * (W - L - R);
    const y = (v: number) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);
    const ticksY: number[] = [];
    for (let v = yMin; v <= yMax + 1e-9; v += passoY) ticksY.push(Math.round(v * 1000) / 1000);
    const ticksX: number[] = [];
    for (let m = 0; m <= meses + 1e-9; m += passoMes) ticksX.push(m);
    return { amostras, curvas, x, y, ticksY, ticksX, visiveis, emAnos };
  }, [indicador, sexo, pontos, diaMax]);

  const figura = useRef<HTMLElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const dica = useRef<HTMLDivElement>(null);
  const [posDica, setPosDica] = useState<{ left: number; top: number; abaixo: boolean } | null>(null);
  const sel = g.visiveis.find((p) => p.id === ativo) ?? null;

  // Toque fora do gráfico (ou Esc) fecha a dica
  useEffect(() => {
    if (!ativo) return;
    const fora = (e: PointerEvent) => {
      if (figura.current && !figura.current.contains(e.target as Node)) setAtivo(null);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAtivo(null);
    document.addEventListener('pointerdown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [ativo]);

  // Posição da dica: acima do ponto (abaixo, se o ponto está no alto), sem sair do cartão
  useLayoutEffect(() => {
    if (!sel || !caixa.current || !dica.current) return setPosDica(null);
    const cw = caixa.current.clientWidth;
    const escala = cw / W;
    const tw = dica.current.offsetWidth;
    const px = g.x(sel.dia) * escala;
    const py = g.y(sel.valor) * escala;
    const abaixo = py < dica.current.offsetHeight + 16;
    setPosDica({ left: Math.min(Math.max(px - tw / 2, 0), cw - tw), top: abaixo ? py + 16 : py - 16, abaixo });
  }, [sel, g]);

  /** Escolhe a medida mais perto do dedo/ponteiro (no eixo da idade) */
  function procurar(e: EventoPonteiro<SVGSVGElement>) {
    if (!g.visiveis.length) return;
    const r = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    let melhor = g.visiveis[0];
    for (const p of g.visiveis) if (Math.abs(g.x(p.dia) - vx) < Math.abs(g.x(melhor.dia) - vx)) melhor = p;
    if (melhor.id !== ativo) setAtivo(melhor.id);
  }

  const linha = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${g.x(g.amostras[i]).toFixed(1)},${g.y(v).toFixed(1)}`).join(' ');
  const p3 = g.curvas[0].valores;
  const p97 = g.curvas[g.curvas.length - 1].valores;
  const faixa = `${linha(p97)} ${[...p3].reverse().map((v, i) => `L${g.x(g.amostras[p3.length - 1 - i]).toFixed(1)},${g.y(v).toFixed(1)}`).join(' ')} Z`;
  const decimaisY = g.ticksY.some((v) => v % 1 !== 0) ? 1 : 0;
  const caminhoBebe = g.visiveis.map((p, i) => `${i ? 'L' : 'M'}${g.x(p.dia).toFixed(1)},${g.y(p.valor).toFixed(1)}`).join(' ');
  const fora = pontos.length - g.visiveis.length;
  const ultimo = g.visiveis[g.visiveis.length - 1];
  const nomePeriodo = PERIODOS_GRAFICO.find((p) => p.dias === diaMax)?.nome ?? '';

  return (
    <figure className="grafico-cresc sc-grafico" ref={figura} style={{ margin: 0 }}>
      <Escolhas
        rotulo="Período do gráfico"
        opcoes={PERIODOS_GRAFICO.map((p) => ({ valor: p.dias, rotulo: p.rotulo }))}
        valor={diaMax}
        aoMudar={(v) => {
          setEscolhido(v === automatico ? null : v);
          setAtivo(null);
        }}
      />
      <ul className="sc-legenda" aria-label="Legenda">
        <li>
          <span className="sc-chave bebe" aria-hidden="true" />
          {nome}
        </li>
        <li>
          <span className="sc-chave oms" aria-hidden="true" />
          Curvas da OMS (P3 a P97)
        </li>
      </ul>
      <div className="sc-grafico-caixa" ref={caixa}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${NOMES_INDICADOR[indicador]} pela idade, de ${nomePeriodo}, com as curvas de percentis da OMS. ${g.visiveis.length} ${g.visiveis.length === 1 ? 'medida' : 'medidas'}${ultimo ? `; a última, ${fmt(ultimo.valor, casas)} ${unidade} (${ultimo.percentil}) em ${ultimo.data}` : ''}.`}
          onPointerDown={procurar}
          onPointerMove={(e) => (e.pointerType === 'mouse' || e.buttons) && procurar(e)}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setAtivo(null)}
        >
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
              {g.emAnos ? m / 12 : m}
            </text>
          ))}
          <text x={(L + W - R) / 2} y={H - 2} textAnchor="middle" className="eixo-texto">
            {idadeCorrigida ? `idade corrigida até 2 anos (${g.emAnos ? 'anos' : 'meses'})` : `idade (${g.emAnos ? 'anos' : 'meses'})`}
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
          {sel && <line x1={g.x(sel.dia)} x2={g.x(sel.dia)} y1={T} y2={H - B} className="sc-mira" />}
          {g.visiveis.length > 1 && <path key={`${indicador}-${diaMax}`} d={caminhoBebe} pathLength={1} className="linha-bebe sc-linha-bebe" />}
          {g.visiveis.map((p, i) => (
            <g
              key={p.id}
              tabIndex={0}
              role="button"
              aria-label={`${p.data}, ${textoIdadeDias(p.dia)}${p.corrigida ? ' de idade corrigida' : ''}: ${fmt(p.valor, casas)} ${unidade}, ${p.percentil}${p.ganho ? `, ${p.ganho}` : ''}`}
              onFocus={() => setAtivo(p.id)}
              className="sc-ponto"
            >
              {/* Alvo de toque invisível de 48 px (o ponto desenhado é pequeno) */}
              <circle cx={g.x(p.dia)} cy={g.y(p.valor)} r={26} className="sc-alvo" />
              <circle cx={g.x(p.dia)} cy={g.y(p.valor)} r={p.id === ativo ? 7 : i === g.visiveis.length - 1 ? 5.5 : 4.5} className="ponto-bebe" />
            </g>
          ))}
        </svg>
        {sel && (
          <div
            ref={dica}
            className={`dica-grafico sc-dica ${posDica?.abaixo ? 'abaixo' : ''}`}
            style={posDica ? { left: posDica.left, top: posDica.top } : { left: 0, top: 0, visibility: 'hidden' }}
            role="status"
          >
            <span className="sc-dica-valor">
              <span className="sc-chave bebe" aria-hidden="true" />
              <strong>
                {fmt(sel.valor, casas)} {unidade}
              </strong>
              <span className="sc-dica-p">{sel.percentil}</span>
            </span>
            <span>
              {sel.data} · {textoIdadeDias(sel.dia)}
              {sel.corrigida ? ' (corrigida)' : ''}
            </span>
            {sel.ganho && <span>{sel.ganho}</span>}
          </div>
        )}
      </div>
      <figcaption className="mudo" style={{ marginTop: 6 }}>
        {g.visiveis.length ? 'Toque ou passe o dedo no gráfico para ver cada medida. ' : 'Nenhuma medida neste período. '}
        {fora > 0 && g.visiveis.length > 0 ? `${fora} ${fora === 1 ? 'medida fica' : 'medidas ficam'} fora deste período. ` : ''}
        Linhas cinza: percentis 3, 15, 50, 85 e 97 da OMS para {sexo === 'M' ? 'meninos' : 'meninas'}; a faixa clara vai do P3 ao P97.
      </figcaption>
    </figure>
  );
}
