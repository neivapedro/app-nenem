import { useMemo, useState } from 'react';
import { FolhaEditar } from '../componentes/registrar';
import { Selo } from '../componentes/ui';
import { useAgora, useDados } from '../dados/contexto';
import { nomeDia, textoDuracao } from '../lib/datas';
import { agruparPorDia, descrever, resumoDia } from '../lib/registros';
import type { Registro, TipoRegistro } from '../lib/tipos';

type Filtro = 'todos' | 'alimentacao' | 'fralda' | 'sono';

const FILTROS: { valor: Filtro; rotulo: string; tipos: TipoRegistro[] }[] = [
  { valor: 'todos', rotulo: 'Tudo', tipos: ['mamada', 'mamadeira', 'fralda', 'sono'] },
  { valor: 'alimentacao', rotulo: 'Mamadas', tipos: ['mamada', 'mamadeira'] },
  { valor: 'fralda', rotulo: 'Fraldas', tipos: ['fralda'] },
  { valor: 'sono', rotulo: 'Sono', tipos: ['sono'] },
];

export function Historico() {
  const { registros, hoje, nomeDe, carregarMais, carregadoDesde } = useDados();
  const agora = useAgora(60_000);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [editando, setEditando] = useState<Registro | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const tipos = FILTROS.find((f) => f.valor === filtro)!.tipos;
  const dias = useMemo(() => agruparPorDia(registros.filter((r) => tipos.includes(r.tipo))), [registros, tipos]);

  return (
    <div className="pilha">
      <div className="abas" role="tablist" aria-label="Filtrar">
        {FILTROS.map((f) => (
          <button key={f.valor} role="tab" aria-selected={filtro === f.valor} className={filtro === f.valor ? 'ativo' : ''} onClick={() => setFiltro(f.valor)}>
            {f.rotulo}
          </button>
        ))}
      </div>

      {dias.length === 0 && (
        <div className="cartao">
          <p className="mudo">Nenhum registro {filtro === 'todos' ? 'ainda' : 'deste tipo'} nos últimos dias. O que vocês registrarem na tela Hoje aparece aqui.</p>
        </div>
      )}

      {dias.map(({ dia, itens }) => {
        const r = resumoDia(registros, dia, agora);
        return (
          <section key={dia} className="cartao" aria-label={nomeDia(dia, hoje)}>
            <div className="dia-cab">
              <h2>{nomeDia(dia, hoje)}</h2>
            </div>
            <div className="resumo-linha" style={{ marginBottom: 6 }}>
              <span>🍼 {r.alimentacoes} {r.alimentacoes === 1 ? 'alimentação' : 'alimentações'}</span>
              {r.peitoMs > 0 && <span>peito {textoDuracao(r.peitoMs)}</span>}
              {r.ml > 0 && <span>{r.ml} ml</span>}
              <span>
                🧷 {r.fraldas} {r.fraldas === 1 ? 'fralda' : 'fraldas'}
              </span>
              {r.sonoMs > 0 && <span>😴 {textoDuracao(r.sonoMs)}</span>}
            </div>
            <div className="lista">
              {itens.map((x) => {
                const d = descrever(x, agora);
                return (
                  <button key={x.id} className={`item t-${x.tipo}`} onClick={() => setEditando(x)}>
                    <Selo tipo={x.tipo} />
                    <div className="cresce">
                      <div className="titulo">{d.titulo}</div>
                      <div className="detalhe">
                        {d.detalhe}
                        {x.observacao ? ` · ${x.observacao}` : ''}
                      </div>
                    </div>
                    {x.criado_por && <span className="quem">{nomeDe(x.criado_por)}</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <button
        className="botao"
        disabled={carregandoMais}
        onClick={async () => {
          setCarregandoMais(true);
          await carregarMais();
          setCarregandoMais(false);
        }}
      >
        {carregandoMais ? 'Carregando…' : `Ver dias antes de ${nomeDia(carregadoDesde, hoje)}`}
      </button>

      {editando && <FolhaEditar r={editando} aoFechar={() => setEditando(null)} />}
    </div>
  );
}
