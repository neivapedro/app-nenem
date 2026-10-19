import { useState } from 'react';
import { inicioTarefa, NOMES_GRUPO, prazoTarefa, TAREFAS_PADRAO, type GrupoTarefa, type TarefaPadrao } from '../../supabase/functions/_shared/primeiros-dias.ts';
import { useDados } from '../dados/contexto';
import { chaveDia, dataBr, diasEntre, hojeLocal } from '../lib/datas';
import { idFixo } from '../lib/ids';
import type { Tarefa } from '../lib/tipos';
import { Campo, Folha, Icone } from './ui';

function Prazo({ data, inicio, hoje, feito }: { data: string | null; inicio: string | null; hoje: string; feito: boolean }) {
  if (feito || !data) return null;
  const dias = diasEntre(hoje, data);
  if (dias < 0) return <span className="etiqueta ruim">venceu {dataBr(data).slice(0, 5)}</span>;
  if (inicio && inicio > hoje) return <span className="etiqueta">{`${dataBr(inicio).slice(0, 5)} a ${dataBr(data).slice(0, 5)}`}</span>;
  if (dias <= 3) return <span className="etiqueta aviso">{dias === 0 ? 'hoje' : `até ${dataBr(data).slice(0, 5)}`}</span>;
  return <span className="etiqueta">até {dataBr(data).slice(0, 5)}</span>;
}

function FolhaTarefa({ inicial, padrao, aoFechar }: { inicial: Tarefa; padrao: TarefaPadrao | null; aoFechar: () => void }) {
  const { gravar, mostrarAviso, tarefas, nomeDe } = useDados();
  const existe = tarefas.some((t) => t.id === inicial.id);
  const [t, setT] = useState(inicial);
  return (
    <Folha titulo={padrao?.titulo ?? (existe ? 'Tarefa' : 'Nova tarefa')} aoFechar={aoFechar}>
      <form
        className="pilha"
        onSubmit={(e) => {
          e.preventDefault();
          if (!padrao && !t.titulo?.trim()) return;
          gravar({ tipo: 'colecao', colecao: 'tarefas', dado: { ...t, titulo: t.titulo?.trim() || null, observacao: t.observacao?.trim() || null } });
          mostrarAviso({ texto: 'Salvo' });
          aoFechar();
        }}
      >
        {padrao ? <p className="texto-2">{padrao.detalhe}</p> : null}
        {!padrao && (
          <Campo rotulo="O quê">
            <input value={t.titulo ?? ''} maxLength={200} onChange={(e) => setT({ ...t, titulo: e.target.value })} autoCapitalize="sentences" />
          </Campo>
        )}
        {!padrao && (
          <Campo rotulo="Prazo (opcional)" dica="Com prazo, entra no Calendário do iPhone.">
            <input type="date" value={t.data ?? ''} onChange={(e) => setT({ ...t, data: e.target.value || null })} />
          </Campo>
        )}
        <label className="marcar">
          <input type="checkbox" checked={!!t.feito_em} onChange={(e) => setT({ ...t, feito_em: e.target.checked ? new Date().toISOString() : null })} />
          <span>Feito</span>
        </label>
        <Campo rotulo="Anotação (opcional)">
          <textarea value={t.observacao ?? ''} maxLength={2000} onChange={(e) => setT({ ...t, observacao: e.target.value })} placeholder="Ex.: resultado, protocolo, número do cartão" />
        </Campo>
        <button className="botao primario">Salvar</button>
        {existe && inicial.criado_por && <p className="mudo">Por {nomeDe(inicial.criado_por)}</p>}
        {existe && !padrao && (
          <button
            type="button"
            className="botao perigo"
            onClick={() => {
              gravar({ tipo: 'excluir', dado: { alvo: 'tarefas', id: inicial.id } });
              mostrarAviso({ texto: 'Excluída', desfazer: () => gravar({ tipo: 'colecao', colecao: 'tarefas', dado: inicial }) });
              aoFechar();
            }}
          >
            <Icone nome="lixeira" /> Excluir
          </button>
        )}
      </form>
    </Folha>
  );
}

export function SecaoPrimeirosDias() {
  const { bebe, membro, usuario, tarefas, gravar, hoje } = useDados();
  const [aberta, setAberta] = useState<{ t: Tarefa; padrao: TarefaPadrao | null } | null>(null);
  if (!bebe || !membro) return null;
  const nasc = bebe.nascimento ? chaveDia(bebe.nascimento) : null;
  const porItem = new Map(tarefas.filter((t) => t.item_id).map((t) => [t.item_id, t]));
  const livres = tarefas.filter((t) => !t.item_id);

  const tarefaDe = (p: TarefaPadrao): Tarefa =>
    porItem.get(p.id) ?? {
      id: idFixo(`${membro.familia_id}:tarefa:${p.id}`),
      familia_id: membro.familia_id,
      criado_por: usuario?.id ?? null,
      item_id: p.id,
      titulo: null,
      data: null,
      feito_em: null,
      observacao: null,
    };

  function alternar(t: Tarefa) {
    gravar({ tipo: 'colecao', colecao: 'tarefas', dado: { ...t, feito_em: t.feito_em ? null : new Date().toISOString() } });
  }

  const total = TAREFAS_PADRAO.length + livres.length;
  const feitas = TAREFAS_PADRAO.filter((p) => porItem.get(p.id)?.feito_em).length + livres.filter((t) => t.feito_em).length;

  return (
    <div className="pilha">
      <section className="cartao pilha">
        <div className="linha entre">
          <strong>
            {feitas} de {total} feitos
          </strong>
          <button
            className="botao pequeno"
            onClick={() =>
              setAberta({
                t: { id: crypto.randomUUID(), familia_id: membro.familia_id, criado_por: usuario?.id ?? null, item_id: null, titulo: '', data: null, feito_em: null, observacao: null },
                padrao: null,
              })
            }
          >
            <Icone nome="mais" /> Incluir item
          </button>
        </div>
        {!nasc && <p className="mudo">Os prazos aparecem depois que vocês registrarem o nascimento. Os itens com prazo entram no Calendário do iPhone.</p>}
      </section>
      {(Object.keys(NOMES_GRUPO) as GrupoTarefa[]).map((g) => (
        <section key={g} className="cartao" aria-label={NOMES_GRUPO[g]}>
          <h2>{NOMES_GRUPO[g]}</h2>
          <div className="lista">
            {TAREFAS_PADRAO.filter((p) => p.grupo === g).map((p) => {
              const t = tarefaDe(p);
              const prazo = nasc ? prazoTarefa(p, nasc) : null;
              const ini = nasc ? inicioTarefa(p, nasc) : null;
              return (
                <div key={p.id} className="item" style={{ cursor: 'default' }}>
                  <button className={`selo ${t.feito_em ? 't-agenda' : ''}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => alternar(t)} aria-label={t.feito_em ? `Desmarcar ${p.titulo}` : `Marcar ${p.titulo} como feito`}>
                    {t.feito_em ? <Icone nome="check" /> : <span style={{ width: 20 }} />}
                  </button>
                  <button className="cresce" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, cursor: 'pointer', minWidth: 0 }} onClick={() => setAberta({ t, padrao: p })}>
                    <div className="titulo" style={{ textDecoration: t.feito_em ? 'line-through' : 'none', opacity: t.feito_em ? 0.7 : 1 }}>
                      {p.titulo}
                    </div>
                    <div className="detalhe">{t.observacao || p.detalhe.split('.')[0]}</div>
                  </button>
                  <Prazo data={prazo} inicio={ini} hoje={hoje} feito={!!t.feito_em} />
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {livres.length > 0 && (
        <section className="cartao" aria-label="Itens de vocês">
          <h2>Itens de vocês</h2>
          <div className="lista">
            {livres.map((t) => (
              <div key={t.id} className="item" style={{ cursor: 'default' }}>
                <button className={`selo ${t.feito_em ? 't-agenda' : ''}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => alternar(t)} aria-label={t.feito_em ? 'Desmarcar' : 'Marcar como feito'}>
                  {t.feito_em ? <Icone nome="check" /> : <span style={{ width: 20 }} />}
                </button>
                <button className="cresce" style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, cursor: 'pointer', minWidth: 0 }} onClick={() => setAberta({ t, padrao: null })}>
                  <div className="titulo" style={{ textDecoration: t.feito_em ? 'line-through' : 'none' }}>
                    {t.titulo}
                  </div>
                  {t.observacao && <div className="detalhe">{t.observacao}</div>}
                </button>
                <Prazo data={t.data} inicio={null} hoje={hojeLocal()} feito={!!t.feito_em} />
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="fonte">Prazos do Ministério da Saúde (triagens neonatais e Primeira Semana Saúde Integral) e da ANS (plano de saúde). Confirme detalhes com a maternidade, o pediatra e o seu plano.</p>
      {aberta && <FolhaTarefa inicial={aberta.t} padrao={aberta.padrao} aoFechar={() => setAberta(null)} />}
    </div>
  );
}
