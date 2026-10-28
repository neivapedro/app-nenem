// O dia num relógio de 24 h (como nos apps de rotina de bebê): o sono no anel de
// fora, as alimentações no do meio e as fraldas no de dentro; o ponteiro marca
// agora. Mostra as últimas 24 h, a mesma janela da faixa linear "Últimas 24 h"
// (cada uma é um cartão do Hoje que dá para esconder). Tocar num trecho mostra os
// detalhes no centro; com algo escolhido, arrastar o dedo ao redor percorre os
// registros. A lógica (ângulos, cortes na janela) fica em lib/relogio-dia.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as EventoPonteiro, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { duracaoCurta } from '../lib/painel';
import {
  anguloDoInstante,
  anguloDoPonto,
  caminhoArco,
  caminhoSetor,
  detalheItem,
  diaTipico,
  diasDoPadrao,
  horasDeSonoTipicas,
  instanteDoAngulo,
  itemMaisPerto,
  itensEmOrdem,
  montarRelogio,
  pontoNoCirculo,
  resumoRelogio,
  DIA_MS,
  type ItemRelogio,
} from '../lib/relogio-dia';
import type { Registro } from '../lib/tipos';
import { Icone } from './ui';

// ---------- Geometria do mostrador (unidades do viewBox) ----------

const TAM = 260;
const C = TAM / 2;
const R_SONO = 95;
const E_SONO = 16;
const R_ALIM = 72;
const E_ALIM = 9;
const R_FRALDA = 55;
const R_CENTRO = 44;
const R_ROTULO = 121;
const MIN = 60_000;
/** Arcos curtos (uma mamada de 5 min) ficam pelo menos deste tamanho para dar para ver e tocar */
const ARCO_MINIMO = 2.6;

const comprimento = (r: number, graus: number) => (Math.PI * r * graus) / 180;

/** Marcações de hora e rótulos 0h, 6h, 12h, 18h (meia-noite no topo) */
function Mostrador() {
  const marcas: ReactNode[] = [];
  for (let h = 0; h < 24; h++) {
    const g = h * 15;
    const maior = h % 6 === 0;
    const a = pontoNoCirculo(C, C, maior ? 104 : 106.5, g);
    const b = pontoNoCirculo(C, C, 110.5, g);
    marcas.push(<line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={maior ? 'rd-marca rd-marca-maior' : 'rd-marca'} />);
  }
  return (
    <g aria-hidden="true">
      {marcas}
      {[0, 6, 12, 18].map((h) => {
        const p = pontoNoCirculo(C, C, R_ROTULO, h * 15);
        return (
          <text key={h} x={p.x} y={p.y} className="rd-hora" textAnchor="middle" dominantBaseline="central">
            {h}h
          </text>
        );
      })}
    </g>
  );
}

function Ponteiro({ graus }: { graus: number }) {
  const a = pontoNoCirculo(C, C, R_CENTRO + 2, graus);
  const b = pontoNoCirculo(C, C, 111, graus);
  return (
    <g className="rd-ponteiro" aria-hidden="true">
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="rd-ponteiro-halo" />
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="rd-ponteiro-linha" />
      <circle cx={b.x} cy={b.y} r={3.2} className="rd-ponteiro-ponta" />
    </g>
  );
}

// ---------- Toque e arrasto ----------

interface Ponto {
  graus: number;
  raio: number;
}

/**
 * Toque escolhe; com algo escolhido o SVG para de rolar a página (touch-action)
 * e arrastar ao redor percorre os registros. Sem nada escolhido, o dedo rola a
 * tela normalmente (o relógio ocupa quase a largura do celular).
 */
function useToqueNoRelogio(aoTocar: (p: Ponto) => void, aoArrastar: (p: Ponto) => void) {
  const arrastando = useRef(false);
  const ponto = (e: EventoPonteiro<SVGSVGElement>): Ponto => {
    const caixa = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - caixa.left) / caixa.width) * TAM;
    const y = ((e.clientY - caixa.top) / caixa.height) * TAM;
    return anguloDoPonto(C, C, x, y);
  };
  return {
    onPointerDown: (e: EventoPonteiro<SVGSVGElement>) => {
      if (e.button > 0) return;
      arrastando.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* sem captura: segue sem ela */
      }
      aoTocar(ponto(e));
    },
    onPointerMove: (e: EventoPonteiro<SVGSVGElement>) => {
      if (arrastando.current) aoArrastar(ponto(e));
    },
    onPointerUp: () => (arrastando.current = false),
    onPointerCancel: () => (arrastando.current = false),
    onLostPointerCapture: () => (arrastando.current = false),
  };
}

// ---------- Relógio das últimas 24 h (tela Hoje) ----------

const chaveItem = (it: ItemRelogio) => `${it.tipo}:${it.id}`;

export function RelogioDia({ registros, agora }: { registros: Registro[]; agora: Date }) {
  // Recalcula a cada minuto (o "agora" da tela muda a cada 30 s)
  const minuto = Math.floor(agora.getTime() / MIN);
  return (
    <section className="cartao hp-entra rd-cartao" style={{ '--hp-i': 1 } as CSSProperties} aria-label="Relógio das últimas 24 horas">
      <div className="cartao-cab">
        <h2>Relógio 24 h</h2>
        <Link to="/mais/resumo" className="botao pequeno texto">
          Padrões <Icone nome="seta" />
        </Link>
      </div>
      <Relogio24h registros={registros} minuto={minuto} />
    </section>
  );
}

function Relogio24h({ registros, minuto }: { registros: Registro[]; minuto: number }) {
  const agora = useMemo(() => new Date(minuto * MIN), [minuto]);
  const rel = useMemo(() => montarRelogio(registros, agora), [registros, agora]);
  const itens = useMemo(() => itensEmOrdem(rel), [rel]);
  const [selChave, setSelChave] = useState<string | null>(null);
  const sel = selChave ? (itens.find((i) => chaveItem(i) === selChave) ?? null) : null;
  const detalhe = sel ? detalheItem(sel, agora) : null;
  const angAgora = anguloDoInstante(agora);

  // O registro escolhido sumiu (apagado, ou saiu da janela): limpa
  useEffect(() => {
    if (selChave && !sel) setSelChave(null);
  }, [selChave, sel]);

  const escolher = (it: ItemRelogio | null) => setSelChave(it ? chaveItem(it) : null);

  /** O item no ponto tocado: primeiro o anel sob o dedo, depois qualquer anel */
  const itemNoPonto = ({ graus, raio }: Ponto, folga: number | null) => {
    const t = instanteDoAngulo(graus, agora);
    const anel = raio > R_SONO - E_SONO / 2 - 4 ? rel.sono : raio > R_ALIM - E_ALIM / 2 - 6 ? rel.alimentacoes : rel.fraldas;
    const noAnel = itemMaisPerto(anel, t, 25 * MIN);
    return noAnel ?? (folga === null ? null : itemMaisPerto(itens, t, folga));
  };
  const toque = useToqueNoRelogio(
    (p) => {
      if (p.raio < R_CENTRO) return escolher(null);
      escolher(itemNoPonto(p, null));
    },
    (p) => {
      if (p.raio < R_CENTRO * 0.6) return;
      const it = itemNoPonto(p, 3 * 60 * MIN);
      if (it && chaveItem(it) !== selChave) escolher(it);
    },
  );

  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    if (!itens.length) return;
    const i = sel ? itens.indexOf(sel) : -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') escolher(itens[Math.min(itens.length - 1, i + 1)]);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') escolher(itens[i <= 0 ? 0 : i - 1]);
    else if (e.key === 'Escape') escolher(null);
    else return;
    e.preventDefault();
  }

  const classe = (it: ItemRelogio) => (sel ? (chaveItem(it) === selChave ? 'rd-escolhido' : 'rd-apagado') : '');

  // Desenho (ordem da animação de entrada: no sentido do tempo, do mais antigo ao mais novo)
  const ordem = (it: ItemRelogio) => Math.round(((it.de - rel.de) / DIA_MS) * 16);
  const arco = (it: ItemRelogio, r: number, espessura: number, cor: string) => {
    let a0 = it.a0;
    let a1 = it.a1;
    if (a1 - a0 < ARCO_MINIMO) {
      // Curtinho: cresce para a frente, mas sem passar do ponteiro
      const ateOPonteiro = (((angAgora - a0) % 360) + 360) % 360;
      a1 = a0 + Math.min(ARCO_MINIMO, ateOPonteiro);
      a0 = a1 - ARCO_MINIMO;
    }
    const l = comprimento(r, a1 - a0);
    return (
      <path
        key={chaveItem(it)}
        d={caminhoArco(C, C, r, a0, a1)}
        className={`rd-arco ${classe(it)}`}
        style={{ stroke: cor, strokeWidth: espessura, strokeDasharray: `${l + 1} ${TAM * 8}`, '--rd-l': l + 1, '--rd-i': ordem(it) } as CSSProperties}
      />
    );
  };

  const marcaEscolhido = (() => {
    if (!sel) return null;
    if (sel.tipo === 'sono' || sel.tipo === 'mamada') {
      const r = sel.tipo === 'sono' ? R_SONO + E_SONO / 2 + 3 : R_ALIM + E_ALIM / 2 + 3;
      const a1 = Math.max(sel.a1, sel.a0 + ARCO_MINIMO);
      return <path d={caminhoArco(C, C, r, sel.a0, a1)} className="rd-indicador" />;
    }
    const p = pontoNoCirculo(C, C, sel.tipo === 'fralda' ? R_FRALDA : R_ALIM, sel.a0);
    return <circle cx={p.x} cy={p.y} r={8.5} className="rd-indicador" />;
  })();

  const centro = (() => {
    if (detalhe)
      return (
        <>
          <span className="rd-centro-rotulo">{detalhe.titulo}</span>
          <span className={`rd-centro-valor ${detalhe.valor.length > 7 ? 'rd-longo' : ''}`}>{detalhe.valor}</span>
          <span className="rd-centro-extra">{detalhe.quando}</span>
          {detalhe.extra && <span className="rd-centro-extra rd-mais-claro">{detalhe.extra}</span>}
        </>
      );
    if (rel.vazio)
      return (
        <>
          <span className="rd-centro-rotulo">Sem registros</span>
          <span className="rd-centro-extra">nas últimas 24 h</span>
        </>
      );
    if (rel.sonoAtual)
      return (
        <>
          <span className="rd-centro-rotulo">Dormindo há</span>
          <span className="rd-centro-valor">{duracaoCurta(agora.getTime() - rel.sonoAtual.ini)}</span>
          <span className="rd-centro-extra">desde {detalheItem(rel.sonoAtual, agora).quando.replace('desde ', '')}</span>
        </>
      );
    return (
      <>
        <span className="rd-centro-rotulo">Sono em 24 h</span>
        <span className="rd-centro-valor">{rel.sonoMs ? duracaoCurta(rel.sonoMs) : '—'}</span>
        {rel.acordouEm && <span className="rd-centro-extra">acordado há {duracaoCurta(Math.max(0, agora.getTime() - rel.acordouEm))}</span>}
      </>
    );
  })();

  const dica = detalhe
    ? detalhe.frase
    : rel.vazio
      ? 'Nada registrado nas últimas 24 h. Sono, mamadas e fraldas aparecem aqui conforme vocês registram.'
      : 'Toque num trecho para ver os detalhes; depois arraste o dedo ao redor.';

  return (
    <div className="rd-corpo">
      <div className="rd-relogio" tabIndex={0} onKeyDown={teclado} aria-label="Relógio das últimas 24 horas. Use as setas para percorrer os registros." role="group">
        <svg
          viewBox={`0 0 ${TAM} ${TAM}`}
          role="img"
          aria-label={resumoRelogio(rel, agora)}
          data-sem-gesto=""
          className={`rd-svg ${sel ? 'rd-explorando' : ''} ${rel.vazio ? 'rd-vazio' : ''}`}
          {...toque}
        >
          {/* Trilhos dos anéis */}
          <circle cx={C} cy={C} r={R_SONO} className="rd-trilho rd-trilho-sono" strokeWidth={E_SONO} />
          <circle cx={C} cy={C} r={R_ALIM} className="rd-trilho" strokeWidth={E_ALIM} />
          <circle cx={C} cy={C} r={R_FRALDA} className="rd-guia" />
          <Mostrador />

          {rel.sono.map((s) => arco(s, R_SONO, E_SONO, 'var(--c-sono)'))}
          {rel.alimentacoes.filter((a) => a.tipo === 'mamada').map((a) => arco(a, R_ALIM, E_ALIM, 'var(--c-mamada)'))}
          {rel.alimentacoes
            .filter((a) => a.tipo === 'mamadeira')
            .map((a) => {
              const p = pontoNoCirculo(C, C, R_ALIM, a.a0);
              return <circle key={chaveItem(a)} cx={p.x} cy={p.y} r={5.2} className={`rd-ponto rd-mamadeira ${classe(a)}`} style={{ '--rd-i': ordem(a) } as CSSProperties} />;
            })}
          {rel.fraldas.map((f) => {
            const p = pontoNoCirculo(C, C, R_FRALDA, f.a0);
            return <circle key={chaveItem(f)} cx={p.x} cy={p.y} r={4.4} className={`rd-ponto ${f.coco ? 'rd-coco' : 'rd-xixi'} ${classe(f)}`} style={{ '--rd-i': ordem(f) } as CSSProperties} />;
          })}

          {marcaEscolhido}
          <Ponteiro graus={angAgora} />
        </svg>
        <span className="rd-centro" aria-hidden="true">
          {centro}
        </span>
      </div>

      <p className={`rd-dica ${detalhe ? 'rd-dica-ativa' : ''}`} aria-live="polite">
        {dica}
      </p>

      <ul className="legenda rd-legenda" aria-label="Legenda (de fora para dentro)">
        <li>
          <span className="chave-caixa" style={{ background: 'var(--c-sono)' }} />
          Sono
        </li>
        <li>
          <span className="chave-caixa" style={{ background: 'var(--c-mamada)' }} />
          Peito
        </li>
        <li>
          <span className="rd-chave-ponto" style={{ background: 'var(--c-mamadeira)' }} />
          Mamadeira
        </li>
        <li>
          <span className="rd-chave-ponto" style={{ background: 'var(--c-fralda)' }} />
          Fralda com cocô
        </li>
        <li>
          <span className="rd-chave-ponto rd-chave-vazada" />
          Só xixi
        </li>
        <li>
          <span className="rd-chave-agora" />
          Agora
        </li>
      </ul>

      {/* Para o leitor de tela: os registros em texto, na ordem do tempo */}
      <ul className="oculto-visual" aria-label="Registros das últimas 24 horas">
        {itens.map((it) => (
          <li key={chaveItem(it)}>{detalheItem(it, agora).frase}</li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Dia típico (tela de padrões) ----------

const um = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const faixaHoras = (de: number, ate: number) => `${de % 24}h às ${ate % 24}h`;

/** O "dia médio" dos últimos 7 dias inteiros: quanto de cada hora ele costuma dormir e quando costuma mamar */
export function RelogioPadrao({ registros, hoje, inicio, agora }: { registros: Registro[]; hoje: string; inicio: string | null; agora: Date }) {
  const dias = useMemo(() => diasDoPadrao(registros, hoje, 7, inicio), [registros, hoje, inicio]);
  const tipico = useMemo(() => diaTipico(registros, dias, agora), [registros, dias, agora]);
  const [hora, setHora] = useState<number | null>(null);
  const toque = useToqueNoRelogio(
    (p) => setHora(p.raio < R_CENTRO * 0.8 ? null : Math.floor(p.graus / 15) % 24),
    (p) => p.raio >= R_CENTRO * 0.6 && setHora(Math.floor(p.graus / 15) % 24),
  );
  if (!tipico || dias.length < 2) return null;

  const maxAlim = Math.max(1, ...tipico.alimentacoes);
  const trechos = horasDeSonoTipicas(tipico.sono);
  const frase = trechos.length
    ? `Costuma dormir ${trechos
        .sort((a, b) => b.ate - b.de - (a.ate - a.de))
        .slice(0, 4)
        .sort((a, b) => (a.de % 24) - (b.de % 24))
        .map((t) => `das ${faixaHoras(t.de, t.ate)}`)
        .join(', ')
        .replace(/, (?=[^,]*$)/, ' e ')}.`
    : 'Ainda sem um horário de sono que se repita na maioria dos dias.';
  const detalhe =
    hora !== null
      ? `Das ${faixaHoras(hora, hora + 1)}: dormiu em média ${Math.round(tipico.sono[hora] * 60)} min (${Math.round(tipico.sono[hora] * 100)}% da hora) e mamou ${um(tipico.alimentacoes[hora])} ${Math.round(tipico.alimentacoes[hora] * 10) === 10 ? 'vez' : 'vezes'} por dia nesse horário.`
      : 'Toque numa hora para ver a média; arraste ao redor para comparar.';
  const resumo = `Dia típico dos últimos ${dias.length} dias: ${duracaoCurta(tipico.sonoMs)} de sono por dia. ${frase}`;

  return (
    <section className="cartao pilha-p rd-cartao-padrao" aria-label="Dia típico">
      <div className="cartao-titulo">
        <h2>Dia típico</h2>
        <span className="mudo">média de {dias.length} dias</span>
      </div>
      <div className="rd-corpo">
        <div className="rd-relogio">
          <svg viewBox={`0 0 ${TAM} ${TAM}`} role="img" aria-label={resumo} data-sem-gesto="" className={`rd-svg ${hora !== null ? 'rd-explorando' : ''}`} {...toque}>
            <circle cx={C} cy={C} r={R_ALIM - 22} className="rd-guia" />
            {tipico.sono.map((f, h) => (
              <path
                key={h}
                d={caminhoSetor(C, C, R_SONO - 12, R_SONO + 9, h * 15 + 0.6, (h + 1) * 15 - 0.6)}
                className={`rd-setor ${hora !== null ? (hora === h ? 'rd-escolhido' : 'rd-apagado') : ''}`}
                style={{ fill: `color-mix(in oklab, var(--c-sono) ${Math.round(6 + f * 94)}%, var(--superficie-2))`, '--rd-i': h } as CSSProperties}
              />
            ))}
            <Mostrador />
            {tipico.alimentacoes.map((v, h) => {
              if (v < 0.05) return null;
              const g = h * 15 + 7.5;
              const a = pontoNoCirculo(C, C, R_ALIM - 22, g);
              const b = pontoNoCirculo(C, C, R_ALIM - 22 + Math.max(3, (v / maxAlim) * 28), g);
              return (
                <line
                  key={h}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={`rd-barra ${hora !== null ? (hora === h ? 'rd-escolhido' : 'rd-apagado') : ''}`}
                  style={{ '--rd-i': h } as CSSProperties}
                />
              );
            })}
            {hora !== null && <path d={caminhoArco(C, C, R_SONO + 13, hora * 15, (hora + 1) * 15)} className="rd-indicador" />}
            <Ponteiro graus={anguloDoInstante(agora)} />
          </svg>
          <span className="rd-centro" aria-hidden="true">
            {hora !== null ? (
              <>
                <span className="rd-centro-rotulo">
                  {hora}h–{(hora + 1) % 24}h
                </span>
                <span className="rd-centro-valor">{Math.round(tipico.sono[hora] * 60)} min</span>
                <span className="rd-centro-extra">de sono</span>
              </>
            ) : (
              <>
                <span className="rd-centro-rotulo">Sono por dia</span>
                <span className="rd-centro-valor">{duracaoCurta(tipico.sonoMs)}</span>
                <span className="rd-centro-extra">em média</span>
              </>
            )}
          </span>
        </div>
        <p className={`rd-dica ${hora !== null ? 'rd-dica-ativa' : ''}`} aria-live="polite">
          {detalhe}
        </p>
        <ul className="legenda rd-legenda" aria-label="Legenda">
          <li>
            <span className="rd-chave-escala" aria-hidden="true" />
            Sono: pouco → a hora toda
          </li>
          <li>
            <span className="rd-chave-barra" aria-hidden="true" />
            Alimentações
          </li>
          <li>
            <span className="rd-chave-agora" aria-hidden="true" />
            Agora
          </li>
        </ul>
        <p className="rd-frase">{frase}</p>
      </div>
    </section>
  );
}
