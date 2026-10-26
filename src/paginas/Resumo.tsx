import { useMemo, useState } from 'react';
import { GraficosMeses } from '../componentes/meses';
import { ColunasEmpilhadas, Kpi, LinhaTempo, MapaCalor, Narrativa, Proporcao } from '../componentes/painel';
import { RelatorioPediatra } from '../componentes/relatorio-pediatra';
import { useAgora, useDados } from '../dados/contexto';
import { useRegistrosDesde } from '../dados/historico';
import { chaveDia, dataBr, inicioDoDia, nomeDia, somarDiasLocal, textoDuracao } from '../lib/datas';
import { diasPainel, foraDoPadrao, inicioDosDados, ladosDoPeito, periodoCoberto, linhaDoTempo, mapaHorarios, mediasPeriodo, narrativa, type MetricaMapa, variacao } from '../lib/painel';
import { duracaoMediaMamada, intervaloMedioAlimentacao } from '../lib/padroes';

const PERIODOS = [7, 14, 30, 90] as const;
type Periodo = (typeof PERIODOS)[number] | 'meses';

const um = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const horas = (ms: number) => `${um(ms / 3_600_000)} h`;
const horasCurto = (ms: number) => {
  // Arredonda os minutos antes: 1h59m45s vira 2h00 (e não 1h60)
  const min = Math.round(ms / 60_000);
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`;
};

/** Dias que cabem no mapa de horários (os mais recentes do período) */
const DIAS_MAPA = 14;

export function Resumo() {
  const { hoje, bebe } = useDados();
  const agora = useAgora(60_000);
  const [periodo, setPeriodo] = useState<Periodo>(7);
  // O dia escolhido (pela data: não muda de dia sozinho à meia-noite)
  const [selData, setSelData] = useState<string | null>(null);
  const [metrica, setMetrica] = useState<MetricaMapa>('alimentacoes');

  const n = periodo === 'meses' ? 7 : periodo;
  const de = somarDiasLocal(hoje, -(n - 1));
  // Período anterior, do mesmo tamanho, para comparar
  const deAnterior = somarDiasLocal(de, -n);
  const ateAnterior = somarDiasLocal(de, -1);
  const { registros, erro } = useRegistrosDesde(deAnterior);
  const regs = useMemo(() => registros ?? [], [registros]);

  const dias = useMemo(() => diasPainel(regs, de, hoje, agora), [regs, de, hoje, agora]);
  const anteriores = useMemo(() => diasPainel(regs, deAnterior, ateAnterior, agora), [regs, deAnterior, ateAnterior, agora]);
  // Dias antes do nascimento (ou do primeiro registro) não entram nas médias
  const inicioDados = useMemo(() => inicioDosDados(bebe?.nascimento ? chaveDia(bebe.nascimento) : null, regs, hoje), [bebe?.nascimento, regs, hoje]);
  const atual = mediasPeriodo(dias, hoje, inicioDados);
  const antes = mediasPeriodo(anteriores, hoje, inicioDados);
  const temAnterior = periodoCoberto(deAnterior, inicioDados) && anteriores.some((d) => d.alimentacoes || d.fraldas || d.sonoMs);
  const delta = (a: number, b: number) => (temAnterior ? variacao(a, b) : null);

  const inicio = inicioDoDia(de);
  const intervalo = intervaloMedioAlimentacao(regs, inicio, agora);
  const intervaloAntes = intervaloMedioAlimentacao(regs, inicioDoDia(deAnterior), inicio);
  const mamadaMedia = duracaoMediaMamada(regs, inicio, agora, agora);
  const lados = ladosDoPeito(regs, inicio, agora, agora);
  const temMamadeira = dias.some((d) => d.ml > 0);
  const nomes = dias.map((d) => d.dia);
  const sel = selData && nomes.includes(selData) ? nomes.indexOf(selData) : null;
  const setSel = (i: number | null) => setSelData(i === null ? null : (nomes[i] ?? null));
  const selDia = sel !== null ? dias[sel] : null;

  // Destaques em frases (regras simples, sem IA)
  const frases = useMemo(
    () => narrativa({ dias, anteriores, hoje, inicio: inicioDados, intervaloMs: intervalo, intervaloAntesMs: intervaloAntes, sexo: bebe?.sexo ?? null }),
    [dias, anteriores, hoje, inicioDados, intervalo, intervaloAntes, bebe?.sexo],
  );
  // Dia fora do padrão: só entre os dias inteiros com dados (sem hoje e sem antes do nascimento)
  const considerar = dias.map(
    (d) => d.dia !== hoje && (!inicioDados || d.dia >= inicioDados) && (d.alimentacoes + d.fraldas > 0 || d.sonoMs > 0),
  );
  const foraAlim = foraDoPadrao(dias.map((d) => d.alimentacoes), considerar, 2);
  const foraSono = foraDoPadrao(dias.map((d) => d.sonoMs / 3_600_000), considerar, 1.5);
  const foraFraldas = foraDoPadrao(dias.map((d) => d.fraldas), considerar, 2);
  const foraMl = foraDoPadrao(dias.map((d) => d.ml), considerar, 60);

  // Mapa: os últimos dias do período (o dia selecionado continua marcado)
  const diasMapa = nomes.slice(-DIAS_MAPA);
  const deslocamento = nomes.length - diasMapa.length;
  const chaveMapa = diasMapa.join();
  const mapa = useMemo(() => mapaHorarios(regs, chaveMapa.split(','), metrica, agora), [regs, chaveMapa, metrica, agora]);

  // Linha do tempo: o dia selecionado ou as últimas 24 horas
  const lt = useMemo(() => {
    const ate = selDia ? inicioDoDia(somarDiasLocal(selDia.dia, 1)) : agora;
    const deLt = selDia ? inicioDoDia(selDia.dia) : new Date(agora.getTime() - 24 * 3_600_000);
    const total = ate.getTime() - deLt.getTime();
    const marcas: { em: number; texto: string }[] = [];
    const primeiraHora = new Date(deLt);
    primeiraHora.setMinutes(0, 0, 0);
    for (let t = primeiraHora.getTime() + 3_600_000; t < ate.getTime(); t += 3_600_000) {
      const h = new Date(t).getHours();
      if (h % 6 === 0) marcas.push({ em: (t - deLt.getTime()) / total, texto: `${h}h` });
    }
    return { ...linhaDoTempo(regs, deLt, ate, agora), marcas, agoraFracao: selDia ? undefined : 1 };
  }, [regs, selDia, agora]);

  const mudarPeriodo = (p: Periodo) => {
    setPeriodo(p);
    setSel(null);
  };

  if (periodo === 'meses')
    return (
      <div className="pilha">
        <FiltroPeriodo periodo={periodo} aoMudar={mudarPeriodo} />
        <GraficosMeses />
        <RelatorioPediatra />
      </div>
    );

  return (
    <div className="pilha painel">
      <FiltroPeriodo periodo={periodo} aoMudar={mudarPeriodo} />
      <p className="mudo painel-legenda-periodo">
        {dataBr(de)} a {dataBr(hoje)} · {temAnterior ? `comparado com os ${n} dias anteriores` : 'ainda sem o período anterior para comparar'}
        {inicioDados && inicioDados > de ? ` · médias desde ${dataBr(inicioDados)}` : ''}
        {!inicioDados || inicioDados < hoje ? ' · médias sem contar hoje' : ''}
      </p>
      {erro && <div className="alerta erro">Não deu para buscar os registros mais antigos: {erro}</div>}
      {!registros && <p className="mudo">Carregando os registros do período…</p>}

      <Narrativa frases={frases} />

      {/* Indicadores */}
      <section className="kpis" aria-label="Indicadores do período">
        <Kpi rotulo="Alimentações/dia" valor={um(atual.alimentacoes)} delta={delta(atual.alimentacoes, antes.alimentacoes)} serie={dias.map((d) => d.alimentacoes)} cor="var(--c-mamada)" />
        <Kpi rotulo="Intervalo médio" valor={intervalo ? horasCurto(intervalo) : '—'} delta={intervalo && intervaloAntes ? delta(intervalo, intervaloAntes) : null} cor="var(--c-mamada)" detalhe="entre alimentações" />
        <Kpi rotulo="Sono/dia" valor={horas(atual.sonoMs)} delta={delta(atual.sonoMs, antes.sonoMs)} serie={dias.map((d) => d.sonoMs)} cor="var(--c-sono)" />
        <Kpi
          rotulo="Maior sono seguido"
          valor={atual.maiorSonoMs ? horasCurto(atual.maiorSonoMs) : '—'}
          delta={atual.maiorSonoMs && antes.maiorSonoMs ? delta(atual.maiorSonoMs, antes.maiorSonoMs) : null}
          serie={dias.map((d) => d.maiorSonoMs)}
          cor="var(--c-sono)"
          detalhe="média do período"
        />
        <Kpi rotulo="Fraldas/dia" valor={um(atual.fraldas)} delta={delta(atual.fraldas, antes.fraldas)} serie={dias.map((d) => d.fraldas)} cor="var(--c-fralda)" />
        {temMamadeira ? (
          <Kpi rotulo="Mamadeira/dia" valor={`${Math.round(atual.ml)} ml`} delta={delta(atual.ml, antes.ml)} serie={dias.map((d) => d.ml)} cor="var(--c-mamadeira)" />
        ) : (
          <Kpi rotulo="Mamada no peito" valor={mamadaMedia ? horasCurto(mamadaMedia) : '—'} cor="var(--c-mamada)" detalhe="duração média" />
        )}
      </section>
      {temAnterior && <p className="mudo" style={{ marginTop: -6 }}>▲▼ = variação em relação aos {n} dias anteriores.</p>}

      {/* Detalhe do dia escolhido (filtra todos os gráficos) */}
      {selDia && (
        <section className="cartao pilha-p detalhe-dia" aria-label="Dia selecionado">
          <div className="linha" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
            <h2 style={{ margin: 0 }}>{nomeDia(selDia.dia, hoje)}</h2>
            <button className="botao pequeno" onClick={() => setSel(null)}>
              Limpar filtro
            </button>
          </div>
          <div className="grade-3">
            <div className="bloco">
              <div className="rotulo">Alimentações</div>
              <div className="valor">{selDia.alimentacoes}</div>
            </div>
            <div className="bloco">
              <div className="rotulo">Sono</div>
              <div className="valor">{horas(selDia.sonoMs)}</div>
            </div>
            <div className="bloco">
              <div className="rotulo">Fraldas</div>
              <div className="valor">{selDia.fraldas}</div>
            </div>
          </div>
          <p className="mudo">
            {selDia.mamadas} no peito{selDia.peitoMs ? ` (${textoDuracao(selDia.peitoMs)})` : ''} · {selDia.mamadeiras} mamadeira{selDia.mamadeiras === 1 ? '' : 's'}
            {selDia.ml ? ` (${selDia.ml} ml)` : ''} · noite {horas(selDia.sonoNoiteMs)} · dia {horas(selDia.sonoDiaMs)} · {selDia.coco} com cocô
          </p>
        </section>
      )}

      {/* Linha do tempo */}
      <section className="cartao pilha-p" aria-label="Linha do tempo">
        <h2>{selDia ? `Linha do tempo · ${nomeDia(selDia.dia, hoje)}` : 'Últimas 24 horas'}</h2>
        <LinhaTempo {...lt} />
      </section>

      {/* Alimentação */}
      <section className="cartao pilha-p" aria-label="Alimentações por dia">
        <div className="cartao-titulo">
          <h2>Alimentações por dia</h2>
          <span className="mudo">toque num dia para filtrar</span>
        </div>
        <ColunasEmpilhadas
          key={n}
          rotulo="Alimentações por dia, peito e mamadeira"
          dias={nomes}
          series={[
            { id: 'peito', nome: 'Peito', cor: 'var(--c-mamada)', valores: dias.map((d) => d.mamadas) },
            { id: 'mamadeira', nome: 'Mamadeira', cor: 'var(--c-mamadeira)', valores: dias.map((d) => d.mamadeiras) },
          ]}
          formatar={(v) => um(v)}
          media={atual.alimentacoes}
          foraDoPadrao={foraAlim}
          selecionado={sel}
          aoSelecionar={setSel}
        />
        {lados.E + lados.D > 0 && (
          <>
            <h3>Lado do peito no período</h3>
            <Proporcao
              partes={[
                { nome: 'Esquerdo', valor: lados.E, cor: 'var(--c-mamada)' },
                { nome: 'Direito', valor: lados.D, cor: 'var(--c-sono)' },
              ]}
              formatar={(v) => textoDuracao(v)}
            />
          </>
        )}
      </section>

      {/* Mapa de horários */}
      <section className="cartao pilha-p" aria-label="Mapa de horários">
        <div className="cartao-titulo">
          <h2>Mapa de horários</h2>
          <span className="mudo">{diasMapa.length < nomes.length ? `últimos ${diasMapa.length} dias` : 'cada quadrinho é 1 hora'}</span>
        </div>
        <div className="chips" role="radiogroup" aria-label="O que mostrar">
          {(
            [
              ['alimentacoes', 'Alimentações'],
              ['sono', 'Sono'],
              ['fraldas', 'Fraldas'],
            ] as [MetricaMapa, string][]
          ).map(([v, r]) => (
            <button key={v} type="button" role="radio" aria-checked={metrica === v} className={`chip ${metrica === v ? 'ativo' : ''}`} onClick={() => setMetrica(v)}>
              {r}
            </button>
          ))}
        </div>
        <MapaCalor
          key={`${n}-${metrica}`}
          dias={diasMapa}
          matriz={mapa}
          cor={metrica === 'sono' ? 'var(--c-sono)' : metrica === 'fraldas' ? 'var(--c-fralda)' : 'var(--c-mamada)'}
          unidade={(v) => (metrica === 'sono' ? `${Math.round(v)} min de sono` : `${v} ${metrica === 'fraldas' ? (v === 1 ? 'fralda' : 'fraldas') : v === 1 ? 'alimentação' : 'alimentações'}`)}
          selecionado={sel !== null && sel >= deslocamento ? sel - deslocamento : null}
          aoSelecionar={(i) => setSel(i === null ? null : i + deslocamento)}
        />
      </section>

      {/* Sono */}
      <section className="cartao pilha-p" aria-label="Sono por dia">
        <div className="cartao-titulo">
          <h2>Sono por dia</h2>
          <span className="mudo">noite = 19h às 7h</span>
        </div>
        <ColunasEmpilhadas
          key={n}
          rotulo="Horas de sono por dia, noite e dia"
          dias={nomes}
          series={[
            { id: 'noite', nome: 'Noite', cor: 'var(--c-sono)', valores: dias.map((d) => d.sonoNoiteMs / 3_600_000) },
            { id: 'dia', nome: 'Sonecas de dia', cor: 'var(--c-mamadeira)', valores: dias.map((d) => d.sonoDiaMs / 3_600_000) },
          ]}
          formatar={(v) => `${um(v)} h`}
          media={atual.sonoMs / 3_600_000}
          foraDoPadrao={foraSono}
          selecionado={sel}
          aoSelecionar={setSel}
        />
      </section>

      {/* Fraldas */}
      <section className="cartao pilha-p" aria-label="Fraldas por dia">
        <h2>Fraldas por dia</h2>
        <ColunasEmpilhadas
          key={n}
          rotulo="Fraldas por dia, só xixi e com cocô"
          dias={nomes}
          series={[
            { id: 'xixi', nome: 'Só xixi', cor: 'var(--c-fralda)', valores: dias.map((d) => d.semCoco) },
            { id: 'coco', nome: 'Com cocô', cor: 'var(--c-mamadeira)', valores: dias.map((d) => d.coco) },
          ]}
          formatar={(v) => um(v)}
          media={atual.fraldas}
          foraDoPadrao={foraFraldas}
          selecionado={sel}
          aoSelecionar={setSel}
        />
      </section>

      {temMamadeira && (
        <section className="cartao pilha-p" aria-label="Mamadeira por dia">
          <h2>Mamadeira por dia (ml)</h2>
          <ColunasEmpilhadas
            key={n}
            rotulo="Mililitros de mamadeira por dia"
            dias={nomes}
            series={[{ id: 'ml', nome: 'Mamadeira', cor: 'var(--c-mamadeira)', valores: dias.map((d) => d.ml) }]}
            formatar={(v) => `${Math.round(v)} ml`}
            media={atual.ml}
            foraDoPadrao={foraMl}
            selecionado={sel}
            aoSelecionar={setSel}
          />
        </section>
      )}

      <details className="ajuda cartao">
        <summary>Ver em tabela</summary>
        <div style={{ overflowX: 'auto' }}>
        <table className="tabela-simples">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Alim.</th>
              <th>ml</th>
              <th>Fraldas</th>
              <th>Sono</th>
              <th>Maior</th>
            </tr>
          </thead>
          <tbody>
            {[...dias].reverse().map((d) => (
              <tr key={d.dia}>
                <td>{nomeDia(d.dia, hoje)}</td>
                <td>{d.alimentacoes}</td>
                <td>{d.ml || '—'}</td>
                <td>
                  {d.fraldas} <span className="mudo">({d.xixi}/{d.coco})</span>
                </td>
                <td>{d.sonoMs ? horas(d.sonoMs) : '—'}</td>
                <td>{d.maiorSonoMs ? horasCurto(d.maiorSonoMs) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </details>

      <RelatorioPediatra />
    </div>
  );
}

function FiltroPeriodo({ periodo, aoMudar }: { periodo: Periodo; aoMudar: (p: Periodo) => void }) {
  return (
    <div className="abas filtro-painel" role="tablist" aria-label="Período">
      {PERIODOS.map((p) => (
        <button key={p} role="tab" aria-selected={periodo === p} className={periodo === p ? 'ativo' : ''} onClick={() => aoMudar(p)}>
          {p} dias
        </button>
      ))}
      <button role="tab" aria-selected={periodo === 'meses'} className={periodo === 'meses' ? 'ativo' : ''} onClick={() => aoMudar('meses')}>
        Meses
      </button>
    </div>
  );
}
