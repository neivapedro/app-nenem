// Peças do painel de gráficos (estilo dashboard): indicadores com variação e
// minigráfico, colunas empilhadas com seleção de dia (vale para todos os
// gráficos), mapa de horários, linha do tempo e proporção do peito.
// Marcas finas, grade discreta, legenda com 2+ séries, toque para ver valores.
import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { useTextoAnimado } from '../lib/animar';
import { inicioDoDia } from '../lib/datas';
import type { ForaDoPadrao, FraseNarrativa, IconeFrase } from '../lib/painel';
import '../estilos/painel.css';

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const diaCurto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const semana = (dia: string) => DIAS_SEMANA[inicioDoDia(dia).getDay()];

function passoBonito(max: number, partes = 3): number {
  const bruto = max / partes;
  if (bruto <= 0) return 1;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const n = bruto / pot;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pot;
}

// ---------- Indicador (KPI) ----------

export function Kpi({
  rotulo,
  valor,
  delta,
  serie,
  cor,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  /** Variação vs o período anterior (0,1 = +10%) */
  delta?: number | null;
  /** Valores de cada dia (minigráfico) */
  serie?: number[];
  cor: string;
  detalhe?: string;
}) {
  const pts = serie && serie.length > 1 ? serie : null;
  const max = pts ? Math.max(...pts, 1e-9) : 1;
  const caminho = pts ? pts.map((v, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * 100).toFixed(1)},${(26 - (v / max) * 24).toFixed(1)}`).join('') : '';
  // Conta até o valor (na 1ª vez e quando o período muda); o leitor de tela lê só o final
  const exibido = useTextoAnimado(valor, { chave: `kpi:${rotulo}` });
  // "14,2 h" → número grande + unidade menor (hierarquia); "2h34" fica inteiro
  const partes = /^([\d.,]+)\s(h|ml|min)$/.exec(exibido);
  return (
    <div className="kpi" style={{ '--kpi-cor': cor } as CSSProperties}>
      <div className="kpi-rotulo">
        <span className="kpi-ponto" style={{ background: cor }} />
        {rotulo}
      </div>
      <div className="kpi-valor">
        <span aria-hidden={exibido !== valor || undefined}>
          {partes ? (
            <>
              {partes[1]}
              <span className="kpi-unidade"> {partes[2]}</span>
            </>
          ) : (
            exibido
          )}
        </span>
        {exibido !== valor && <span className="oculto-visual">{valor}</span>}
      </div>
      <div className="kpi-rodape">
        {delta !== undefined && delta !== null && isFinite(delta) ? (
          <span className={`kpi-delta ${Math.abs(delta) < 0.005 ? 'igual' : delta > 0 ? 'sobe' : 'desce'}`}>
            {Math.abs(delta) < 0.005 ? '= ' : delta > 0 ? '▲ ' : '▼ '}
            {Math.abs(delta * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%
          </span>
        ) : (
          <span className="kpi-delta mudo">{detalhe ?? ' '}</span>
        )}
        {pts && (
          <svg className="kpi-spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
            <path d={caminho} pathLength={1} style={{ stroke: cor }} />
            <circle cx={100} cy={26 - (pts[pts.length - 1] / max) * 24} r={2.6} style={{ fill: cor }} />
          </svg>
        )}
      </div>
    </div>
  );
}

// ---------- Colunas empilhadas ----------

export interface SerieColuna {
  id: string;
  nome: string;
  cor: string;
  valores: number[];
}

const W = 340;
const H = 172;
const L = 30;
const R = 6;
const T = 16;
const B = 22;

/**
 * Colunas por dia, empilhadas por série. Tocar numa coluna seleciona o dia
 * (a página repassa a seleção para os outros gráficos e mostra o detalhe).
 */
export function ColunasEmpilhadas({
  dias,
  series,
  formatar,
  formatarEixo,
  media,
  selecionado,
  aoSelecionar,
  rotulo,
  foraDoPadrao,
}: {
  dias: string[];
  series: SerieColuna[];
  formatar: (v: number) => string;
  formatarEixo?: (v: number) => string;
  media?: number | null;
  selecionado: number | null;
  aoSelecionar: (i: number | null) => void;
  rotulo: string;
  /** Dia que destoa dos outros (marcado de leve, com o motivo na legenda e na leitura) */
  foraDoPadrao?: ForaDoPadrao | null;
}) {
  const [toque, setToque] = useState<number | null>(null);
  const n = dias.length;
  const totais = dias.map((_, i) => series.reduce((s, x) => s + (x.valores[i] || 0), 0));
  const max = Math.max(...totais, media ?? 0, 0);
  const passo = passoBonito(max || 1);
  const topo = Math.max(passo, Math.ceil(max / passo) * passo);
  const ticks = Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => i * passo);
  const banda = (W - L - R) / Math.max(1, n);
  const largura = Math.max(2, Math.min(24, banda * 0.66));
  const y = (v: number) => T + (1 - v / topo) * (H - T - B);
  // Ao trocar de período, um toque antigo pode apontar para fora: ignora
  const ativo = (toque !== null && toque < n ? toque : null) ?? (selecionado !== null && selecionado < n ? selecionado : null);
  const mostrarRotulo = (i: number) => n <= 14 || i % Math.ceil(n / 7) === 0 || i === n - 1;
  const eixo = formatarEixo ?? ((v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }));
  const fora = foraDoPadrao && foraDoPadrao.indice < n ? foraDoPadrao : null;
  const nomeDia = (i: number) => (n <= 7 ? semana(dias[i]) : diaCurto(dias[i]));
  const motivo = fora ? `${fora.acima ? 'bem acima' : 'bem abaixo'} da média (${formatar(fora.media)})` : '';

  const tecla = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight') aoSelecionar(Math.min(n - 1, (selecionado ?? -1) + 1));
    else if (e.key === 'ArrowLeft') aoSelecionar(Math.max(0, (selecionado ?? n) - 1));
    else if (e.key === 'Escape') aoSelecionar(null);
    else return;
    e.preventDefault();
  };

  return (
    <div className="painel-grafico">
      {(series.length > 1 || (media !== undefined && media !== null && media > 0) || fora) && (
        <ul className="legenda" aria-label="Legenda">
          {(series.length > 1 ? series : []).map((s) => (
            <li key={s.id}>
              <span className="chave-caixa" style={{ background: s.cor }} />
              {s.nome}
            </li>
          ))}
          {media !== undefined && media !== null && media > 0 && (
            <li>
              <span className="chave-linha" style={{ background: 'var(--texto-3)' }} />
              média {formatar(media)}
            </li>
          )}
          {fora && (
            <li className="legenda-fora" title={`Fora do padrão: ${motivo}`}>
              <span className="chave-fora" />
              fora do padrão: {nomeDia(fora.indice)}
            </li>
          )}
        </ul>
      )}
      <div className="grafico-area">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={fora ? `${rotulo}. Fora do padrão: ${semana(dias[fora.indice])}, ${diaCurto(dias[fora.indice])}, ${formatar(totais[fora.indice])}, ${motivo}` : rotulo}
          tabIndex={0}
          onKeyDown={tecla}
          onPointerLeave={(e) => e.pointerType === 'mouse' && setToque(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grade-linha" />
              <text x={L - 5} y={y(v) + 3.5} textAnchor="end" className="eixo-texto">
                {eixo(v)}
              </text>
            </g>
          ))}
          {dias.map((d, i) => {
            const cx = L + banda * i + banda / 2;
            const x = cx - largura / 2;
            let acumulado = 0;
            const segs = series
              .map((s) => ({ s, v: s.valores[i] || 0 }))
              .filter((p) => p.v > 0)
              .map((p) => {
                const y0 = y(acumulado);
                acumulado += p.v;
                return { ...p, y0, y1: y(acumulado) };
              });
            const esmaecido = ativo !== null && ativo !== i;
            return (
              <g
                key={d}
                className={`coluna ${esmaecido ? 'esmaecida' : ''}`}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setToque(i)}
                onClick={() => aoSelecionar(selecionado === i ? null : i)}
                style={{ cursor: 'pointer' }}
              >
                <rect x={cx - banda / 2} y={T} width={banda} height={H - T - B} fill="transparent" />
                {fora?.indice === i && (
                  <rect className="fora-faixa" x={cx - Math.min(banda, largura + 8) / 2} y={T - 2} width={Math.min(banda, largura + 8)} height={H - T - B + 2} rx={Math.min(6, banda / 2)} />
                )}
                {segs.map((p, k) => {
                  const ultimo = k === segs.length - 1;
                  // 2 px de respiro entre os pedaços empilhados
                  const alto = Math.max(0, p.y0 - p.y1 - (k > 0 ? 2 : 0));
                  const topoSeg = p.y1;
                  const r = ultimo ? Math.min(4, largura / 2, alto) : 0;
                  return (
                    <path
                      key={p.s.id}
                      style={{ fill: p.s.cor, '--atraso': `${Math.round((i / Math.max(1, n)) * 320)}ms` } as CSSProperties}
                      d={`M${x},${topoSeg + alto} V${topoSeg + r} Q${x},${topoSeg} ${x + r},${topoSeg} H${x + largura - r} Q${x + largura},${topoSeg} ${x + largura},${topoSeg + r} V${topoSeg + alto} Z`}
                    />
                  );
                })}
                {fora?.indice === i && <circle className="fora-marca" cx={cx} cy={(segs.length ? segs[segs.length - 1].y1 : y(0)) - 7} r={3.2} />}
                {mostrarRotulo(i) && (
                  <text x={cx} y={H - 7} textAnchor="middle" className={`eixo-texto ${selecionado === i ? 'forte' : ''}`}>
                    {n <= 7 ? semana(d) : d.slice(8, 10)}
                  </text>
                )}
              </g>
            );
          })}
          {media !== undefined && media !== null && media > 0 && <line x1={L} x2={W - R} y1={y(media)} y2={y(media)} className="media-linha" />}
        </svg>
        {ativo !== null && (
          <div
            className={`leitura ${L + banda * ativo + banda / 2 < W / 2 ? 'direita' : 'esquerda'}`}
            // Ao lado da coluna, sem cobri-la
            style={
              L + banda * ativo + banda / 2 < W / 2
                ? { left: `${((L + banda * (ativo + 1) + 2) / W) * 100}%`, right: 'auto', maxWidth: `min(220px, ${(1 - (L + banda * (ativo + 1) + 2) / W) * 100}%)` }
                : { right: `${(1 - (L + banda * ativo - 2) / W) * 100}%`, left: 'auto', maxWidth: `min(220px, ${((L + banda * ativo - 2) / W) * 100}%)` }
            }
            aria-live="polite"
          >
            <div className="leitura-titulo">
              {semana(dias[ativo])}, {diaCurto(dias[ativo])}
            </div>
            <div className="leitura-linha">
              <strong>{formatar(totais[ativo])}</strong>
              <span>total</span>
            </div>
            {series.length > 1 &&
              series.map((s) => (
                <div key={s.id} className="leitura-linha">
                  <span className="chave-linha" style={{ background: s.cor }} />
                  <strong>{formatar(s.valores[ativo] || 0)}</strong>
                  <span>{s.nome}</span>
                </div>
              ))}
            {fora?.indice === ativo && <div className="leitura-fora">Fora do padrão: {motivo}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Mapa de horários ----------

export function MapaCalor({
  dias,
  matriz,
  cor,
  unidade,
  selecionado,
  aoSelecionar,
}: {
  dias: string[];
  matriz: number[][];
  cor: string;
  /** Como ler o valor da célula, ex.: (v) => "2 alimentações" */
  unidade: (v: number) => string;
  selecionado: number | null;
  aoSelecionar: (i: number | null) => void;
}) {
  const [celulaEscolhida, setCelula] = useState<{ d: number; h: number } | null>(null);
  const celula = celulaEscolhida && celulaEscolhida.d < dias.length && celulaEscolhida.d < matriz.length ? celulaEscolhida : null;
  const max = Math.max(1e-9, ...matriz.flat());
  const passos = [0.12, 0.3, 0.5, 0.72, 1];
  const nivel = (v: number) => (v <= 0 ? -1 : passos.findIndex((p) => v / max <= p + 1e-9));
  return (
    <div className="mapa">
      <div className="mapa-grade" role="grid" aria-label="Mapa de horários">
        <div className="mapa-linha mapa-cabecalho" aria-hidden="true">
          <span className="mapa-dia" />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="mapa-hora">
              {h % 6 === 0 ? `${h}h` : ''}
            </span>
          ))}
        </div>
        {matriz.map((linha, d) => (
          <div
            key={dias[d]}
            className={`mapa-linha ${selecionado === d ? 'selecionada' : selecionado !== null ? 'esmaecida' : ''}`}
            role="row"
            style={{ '--atraso': `${Math.round((d / Math.max(1, matriz.length)) * 260)}ms` } as CSSProperties}
          >
            <button type="button" role="rowheader" className="mapa-dia" onClick={() => aoSelecionar(selecionado === d ? null : d)}>
              {dias.length <= 7 ? semana(dias[d]) : diaCurto(dias[d])}
            </button>
            {linha.map((v, h) => {
              const k = nivel(v);
              return (
                <button
                  key={h}
                  type="button"
                  role="gridcell"
                  // Fora do Tab (são 336 quadrinhos): o resumo por dia está em "Ver em tabela"
                  tabIndex={-1}
                  className={`mapa-celula ${celula?.d === d && celula.h === h ? 'ativa' : ''}`}
                  aria-label={`${diaCurto(dias[d])}, ${h}h: ${unidade(v)}`}
                  style={k < 0 ? undefined : { background: `color-mix(in srgb, ${cor} ${Math.round(18 + k * 20)}%, var(--superficie))` }}
                  onClick={() => setCelula(celula?.d === d && celula.h === h ? null : { d, h })}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mapa-rodape">
        <span className="texto-2">
          {celula
            ? `${semana(dias[celula.d])}, ${diaCurto(dias[celula.d])} · ${celula.h}h–${celula.h + 1}h: ${unidade(matriz[celula.d][celula.h])}`
            : 'Toque num quadrinho para ver o valor'}
        </span>
        <span className="mapa-escala" aria-hidden="true">
          menos
          {passos.map((_, k) => (
            <i key={k} style={{ background: `color-mix(in srgb, ${cor} ${Math.round(18 + k * 20)}%, var(--superficie))` }} />
          ))}
          mais
        </span>
      </div>
    </div>
  );
}

// ---------- Linha do tempo ----------

export function LinhaTempo({
  sono,
  alimentacoes,
  fraldas,
  marcas,
  agoraFracao,
}: {
  sono: { de: number; ate: number }[];
  alimentacoes: { em: number; ate: number; tipo: 'mamada' | 'mamadeira' }[];
  fraldas: { em: number; coco: boolean }[];
  /** Rótulos do eixo: posição (0 a 1) e texto */
  marcas: { em: number; texto: string }[];
  /** Linha do "agora", quando o intervalo chega até agora */
  agoraFracao?: number;
}) {
  const faixa = (titulo: string, conteudo: ReactNode) => (
    <div className="lt-faixa">
      <span className="lt-titulo">{titulo}</span>
      <div className="lt-trilho">
        {marcas.map((m) => (
          <span key={m.em} className="lt-grade" style={{ left: `${m.em * 100}%` }} />
        ))}
        {conteudo}
        {agoraFracao !== undefined && <span className="lt-agora" style={{ left: `${agoraFracao * 100}%` }} />}
      </div>
    </div>
  );
  return (
    <div className="linha-tempo">
      {faixa(
        'Sono',
        sono.map((s, i) => (
          <span
            key={i}
            className="lt-bloco"
            style={{ left: `${s.de * 100}%`, width: `${Math.max(0.6, (s.ate - s.de) * 100)}%`, background: 'var(--c-sono)' }}
          />
        )),
      )}
      {faixa(
        'Alimentação',
        alimentacoes.map((a, i) => (
          <span
            key={i}
            className="lt-bloco"
            style={{
              left: `${a.em * 100}%`,
              width: `${Math.max(0.9, (a.ate - a.em) * 100)}%`,
              background: a.tipo === 'mamada' ? 'var(--c-mamada)' : 'var(--c-mamadeira)',
            }}
          />
        )),
      )}
      {faixa(
        'Fraldas',
        fraldas.map((f, i) => (
          <span key={i} className="lt-ponto" style={{ left: `clamp(6px, ${f.em * 100}%, calc(100% - 6px))`, background: f.coco ? 'var(--c-mamadeira)' : 'var(--c-fralda)' }} />
        )),
      )}
      <div className="lt-eixo">
        <span className="lt-titulo" />
        <div className="lt-trilho sem-fundo">
          {marcas.map((m) => (
            <span key={m.em} className={`lt-marca ${m.em < 0.06 ? 'na-esquerda' : m.em > 0.94 ? 'na-direita' : ''}`} style={{ left: `${m.em * 100}%` }}>
              {m.texto}
            </span>
          ))}
        </div>
      </div>
      <ul className="legenda" aria-label="Legenda">
        <li>
          <span className="chave-caixa" style={{ background: 'var(--c-sono)' }} />
          Sono
        </li>
        <li>
          <span className="chave-caixa" style={{ background: 'var(--c-mamada)' }} />
          Peito
        </li>
        <li>
          <span className="chave-caixa" style={{ background: 'var(--c-mamadeira)' }} />
          Mamadeira / cocô
        </li>
        <li>
          <span className="chave-caixa" style={{ background: 'var(--c-fralda)' }} />
          Xixi
        </li>
      </ul>
    </div>
  );
}

// ---------- Proporção (2 partes de um todo) ----------

export function Proporcao({ partes, formatar }: { partes: { nome: string; valor: number; cor: string }[]; formatar: (v: number) => string }) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  if (!total) return <p className="texto-2">Sem mamadas no peito no período.</p>;
  return (
    <div className="proporcao">
      <div className="proporcao-barra" role="img" aria-label={partes.map((p) => `${p.nome} ${Math.round((p.valor / total) * 100)}%`).join(', ')}>
        {partes.map((p) => (p.valor > 0 ? <span key={p.nome} style={{ width: `${(p.valor / total) * 100}%`, background: p.cor }} /> : null))}
      </div>
      <div className="proporcao-legenda">
        {partes.map((p) => (
          <span key={p.nome}>
            <span className="chave-caixa" style={{ background: p.cor }} /> {p.nome} <strong>{Math.round((p.valor / total) * 100)}%</strong>{' '}
            <span className="mudo">· {formatar(p.valor)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- Narrativa (destaques do período em frases) ----------

const ICONES: Record<IconeFrase, { cor: string; desenho: ReactNode }> = {
  sono: { cor: 'var(--c-sono)', desenho: <path d="M19.5 14.6A7.6 7.6 0 1 1 9.4 4.5a6.1 6.1 0 0 0 10.1 10.1Z" /> },
  recorde: { cor: 'var(--c-sono)', desenho: <path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.4l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8Z" /> },
  intervalo: {
    cor: 'var(--c-mamada)',
    desenho: (
      <>
        <circle cx="12" cy="12.5" r="7.5" />
        <path d="M12 8.5v4l2.6 1.8M10 3h4" />
      </>
    ),
  },
  alimentacao: { cor: 'var(--c-mamada)', desenho: <path d="M12 4c2.9 3.4 5.8 6.6 5.8 9.6a5.8 5.8 0 0 1-11.6 0C6.2 10.6 9.1 7.4 12 4Z" /> },
  mamadeira: { cor: 'var(--c-mamadeira)', desenho: <path d="M10 3.5h4M10.2 3.5v2.7L8 9v9.5A2 2 0 0 0 10 20.5h4a2 2 0 0 0 2-2V9l-2.2-2.8V3.5M8 12.5h3.5M8 15.5h3.5" /> },
  fralda: { cor: 'var(--c-fralda)', desenho: <path d="M4 7h16v2.6c0 4.6-3.6 8.4-8 8.4s-8-3.8-8-8.4V7ZM8.5 7v2.5M15.5 7v2.5" /> },
};

/** Até 4 frases automáticas sobre o período, cada uma com ícone e o número em negrito */
export function Narrativa({ frases, titulo = 'Destaques do período' }: { frases: FraseNarrativa[]; titulo?: string }) {
  if (!frases.length) return null;
  return (
    <section className="cartao narrativa" aria-label={titulo}>
      <h2 className="narrativa-titulo">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3.5 13.6 9l5.4 1.6-5.4 1.6L12 17.7l-1.6-5.5L5 10.6 10.4 9ZM18.5 15.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7Z" />
        </svg>
        {titulo}
      </h2>
      <ul className="narrativa-lista">
        {frases.map((f, i) => {
          const ic = ICONES[f.icone];
          return (
            <li key={f.id} style={{ '--cor-icone': ic.cor, '--atraso': `${i * 70}ms` } as CSSProperties}>
              <span className="narrativa-icone" aria-hidden="true">
                <svg viewBox="0 0 24 24">{ic.desenho}</svg>
              </span>
              <span className="narrativa-texto">{f.partes.map((p, k) => (typeof p === 'string' ? p : <strong key={k}>{p.destaque}</strong>))}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
