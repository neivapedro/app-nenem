import { useMemo, useState } from 'react';
import { BarrasDiarias } from '../componentes/barras';
import { GraficosMeses } from '../componentes/meses';
import { RelatorioPediatra } from '../componentes/relatorio-pediatra';
import { useAgora, useDados } from '../dados/contexto';
import { dataBr, inicioDoDia, nomeDia, somarDiasLocal, textoDuracao } from '../lib/datas';
import { intervaloMedioAlimentacao, media, ultimosDias } from '../lib/padroes';

const PERIODOS = [7, 14, 30] as const;

const horas = (ms: number) => `${(ms / 3_600_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;

export function Resumo() {
  const dados = useDados();
  const { registros, hoje, carregadoDesde } = dados;
  const agora = useAgora(60_000);
  const [n, setN] = useState<(typeof PERIODOS)[number]>(7);
  const [porMes, setPorMes] = useState(false);

  const dias = useMemo(() => ultimosDias(registros, hoje, n, agora), [registros, hoje, n, agora]);
  const desde = inicioDoDia(dias[0].dia);
  // Médias sem contar hoje (dia incompleto), quando há mais de um dia
  const completos = dias.length > 1 ? dias.slice(0, -1) : dias;
  const intervalo = intervaloMedioAlimentacao(registros, desde, agora);
  const temMamadeira = dias.some((d) => d.ml > 0);
  const incompleto = carregadoDesde > dias[0].dia;

  return (
    <div className="pilha">
      <div className="abas" role="tablist" aria-label="Período">
        {PERIODOS.map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={!porMes && n === p}
            className={!porMes && n === p ? 'ativo' : ''}
            onClick={() => {
              setN(p);
              setPorMes(false);
            }}
          >
            {p} dias
          </button>
        ))}
        <button role="tab" aria-selected={porMes} className={porMes ? 'ativo' : ''} onClick={() => setPorMes(true)}>
          Meses
        </button>
      </div>
      {porMes ? (
        <GraficosMeses />
      ) : (
        <>
      {incompleto && <p className="mudo">O app carregou registros a partir de {dataBr(carregadoDesde)}; dias anteriores aparecem vazios.</p>}

      <section className="cartao" aria-label="Médias">
        <h2>Médias por dia</h2>
        <div className="grade">
          <div className="bloco">
            <div className="rotulo">Alimentações</div>
            <div className="valor">{media(completos.map((d) => d.alimentacoes)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</div>
          </div>
          <div className="bloco">
            <div className="rotulo">Intervalo entre elas</div>
            <div className="valor">{intervalo ? textoDuracao(intervalo) : '—'}</div>
          </div>
          <div className="bloco">
            <div className="rotulo">Fraldas</div>
            <div className="valor">{media(completos.map((d) => d.fraldas)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</div>
          </div>
          <div className="bloco">
            <div className="rotulo">Sono</div>
            <div className="valor">{horas(media(completos.map((d) => d.sonoMs)))}</div>
          </div>
        </div>
        <p className="mudo" style={{ marginTop: 8 }}>
          Sem contar hoje (o dia ainda não acabou). Servem para acompanhar o ritmo do bebê, não para comparar com outros.
        </p>
      </section>

      <section className="cartao" aria-label="Alimentações por dia">
        <h2>Alimentações por dia</h2>
        <BarrasDiarias tipo="mamada" rotulo="Alimentações por dia" dados={dias.map((d) => ({ dia: d.dia, valor: d.alimentacoes }))} formatar={(v) => String(v)} />
      </section>
      {temMamadeira && (
        <section className="cartao" aria-label="Mamadeira por dia">
          <h2>Mamadeira por dia (ml)</h2>
          <BarrasDiarias tipo="mamadeira" rotulo="Mamadeira por dia em ml" dados={dias.map((d) => ({ dia: d.dia, valor: d.ml }))} formatar={(v) => `${v}`} />
        </section>
      )}
      <section className="cartao" aria-label="Fraldas por dia">
        <h2>Fraldas por dia</h2>
        <BarrasDiarias tipo="fralda" rotulo="Fraldas por dia" dados={dias.map((d) => ({ dia: d.dia, valor: d.fraldas }))} formatar={(v) => String(v)} />
      </section>
      <section className="cartao" aria-label="Sono por dia">
        <h2>Sono por dia (horas)</h2>
        <BarrasDiarias
          tipo="sono"
          rotulo="Sono por dia em horas"
          dados={dias.map((d) => ({ dia: d.dia, valor: Math.round((d.sonoMs / 3_600_000) * 10) / 10 }))}
          formatar={(v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
        />
      </section>

      <details className="ajuda cartao">
        <summary>Ver em tabela</summary>
        <table className="tabela-simples">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Alim.</th>
              <th>ml</th>
              <th>Fraldas</th>
              <th>Sono</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <p className="mudo" style={{ textAlign: 'center' }}>
        Período: {dataBr(dias[0].dia)} a {dataBr(somarDiasLocal(hoje, 0))}
      </p>
        </>
      )}
      <RelatorioPediatra />
    </div>
  );
}
