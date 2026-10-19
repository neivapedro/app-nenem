import { useEffect, useMemo, useState } from 'react';
import { useAgora, useDados } from '../dados/contexto';
import { chaveDia, dataBr, inicioDoDia } from '../lib/datas';
import { traduzirErro } from '../lib/erros';
import { mesesDeVida } from '../lib/padroes';
import type { Registro } from '../lib/tipos';
import { BarrasDiarias } from './barras';

const um = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const horas = (ms: number) => `${um(ms / 3_600_000)} h`;

/** Médias por dia de cada mês de vida, desde o nascimento. */
export function GraficosMeses() {
  const { registros, hoje, bebe, repo, carregadoDesde } = useDados();
  const agora = useAgora(60_000);
  const nasc = bebe?.nascimento ? chaveDia(bebe.nascimento) : null;
  // O app abre só com os últimos dias; os meses antigos vêm do banco quando precisa
  const precisaAntigos = !!nasc && nasc < carregadoDesde;
  const [antigos, setAntigos] = useState<Registro[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!precisaAntigos || !nasc) return;
    let vivo = true;
    repo
      .listarRegistros(inicioDoDia(nasc).toISOString())
      .then((lista) => vivo && setAntigos(lista))
      .catch((e) => vivo && setErro(traduzirErro(e)));
    return () => {
      vivo = false;
    };
  }, [precisaAntigos, nasc, repo]);

  const todos = useMemo(() => {
    if (!precisaAntigos) return registros;
    if (!antigos) return null;
    // Dias já carregados vêm do app (com as mudanças ao vivo); os anteriores, da busca
    return [...antigos.filter((r) => chaveDia(r.inicio) < carregadoDesde), ...registros];
  }, [precisaAntigos, antigos, registros, carregadoDesde]);

  const meses = useMemo(() => (todos && nasc ? mesesDeVida(todos, nasc, hoje, agora) : []), [todos, nasc, hoje, agora]);

  if (!nasc)
    return (
      <section className="cartao">
        <h2>Gráficos por mês</h2>
        <p className="texto-2">Começam a aparecer depois do nascimento: cada mês de vida vira uma coluna, de mesversário a mesversário.</p>
      </section>
    );
  if (erro) return <div className="alerta erro">Não foi possível carregar os meses: {erro}</div>;
  if (!todos) return <p className="mudo">Carregando os meses…</p>;
  if (!meses.length)
    return (
      <section className="cartao">
        <h2>Gráficos por mês</h2>
        <p className="texto-2">O primeiro mês aparece amanhã, depois do primeiro dia completo.</p>
      </section>
    );

  const rotulos = meses.map((m) => `${m.mes}º`);
  const nomes = meses.map((m) => `${m.mes}º mês`);
  const temMamadeira = meses.some((m) => m.ml > 0);
  const atual = meses[meses.length - 1];

  return (
    <div className="pilha">
      <p className="mudo">
        Média por dia em cada mês de vida (de mesversário a mesversário).
        {atual.emAndamento ? ` O ${atual.mes}º mês ainda está em andamento: conta até ontem.` : ''}
      </p>
      <section className="cartao" aria-label="Alimentações por dia, por mês">
        <h2>Alimentações por dia</h2>
        <BarrasDiarias
          tipo="mamada"
          rotulo="Média de alimentações por dia em cada mês"
          rotulos={rotulos}
          nomes={nomes}
          dados={meses.map((m) => ({
            dia: m.inicio,
            valor: Math.round(m.alimentacoes * 10) / 10,
          }))}
          formatar={um}
        />
      </section>
      {temMamadeira && (
        <section className="cartao" aria-label="Mamadeira por dia, por mês">
          <h2>Mamadeira por dia (ml)</h2>
          <BarrasDiarias
            tipo="mamadeira"
            rotulo="Média de mamadeira por dia em ml em cada mês"
            rotulos={rotulos}
            nomes={nomes}
            dados={meses.map((m) => ({
              dia: m.inicio,
              valor: Math.round(m.ml),
            }))}
            formatar={(v) => String(v)}
          />
        </section>
      )}
      <section className="cartao" aria-label="Fraldas por dia, por mês">
        <h2>Fraldas por dia</h2>
        <BarrasDiarias
          tipo="fralda"
          rotulo="Média de fraldas por dia em cada mês"
          rotulos={rotulos}
          nomes={nomes}
          dados={meses.map((m) => ({
            dia: m.inicio,
            valor: Math.round(m.fraldas * 10) / 10,
          }))}
          formatar={um}
        />
      </section>
      <section className="cartao" aria-label="Sono por dia, por mês">
        <h2>Sono por dia (horas)</h2>
        <BarrasDiarias
          tipo="sono"
          rotulo="Média de horas de sono por dia em cada mês"
          rotulos={rotulos}
          nomes={nomes}
          dados={meses.map((m) => ({
            dia: m.inicio,
            valor: Math.round((m.sonoMs / 3_600_000) * 10) / 10,
          }))}
          formatar={um}
        />
      </section>
      <details className="ajuda cartao" open>
        <summary>Ver em tabela</summary>
        <table className="tabela-simples">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Alim.</th>
              {temMamadeira && <th>ml</th>}
              <th>Fraldas</th>
              <th>Sono</th>
            </tr>
          </thead>
          <tbody>
            {[...meses].reverse().map((m) => (
              <tr key={m.mes}>
                <td>
                  {m.mes}º mês
                  <div className="mudo" style={{ fontSize: '0.75rem' }}>
                    {dataBr(m.inicio).slice(0, 5)} a {dataBr(m.fim).slice(0, 5)}
                  </div>
                </td>
                <td>{um(m.alimentacoes)}</td>
                {temMamadeira && <td>{m.ml ? Math.round(m.ml) : '—'}</td>}
                <td>{um(m.fraldas)}</td>
                <td>{m.sonoMs ? horas(m.sonoMs) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mudo" style={{ marginTop: 8 }}>
          Valores são médias por dia. Peso e altura mês a mês ficam em Saúde → Crescimento.
        </p>
      </details>
    </div>
  );
}
