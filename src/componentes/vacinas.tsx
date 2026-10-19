import { useMemo, useState } from 'react';
import { calendarioDoBebe, FONTES_VACINAS, porIdade, type DoseNoCalendario } from '../../supabase/functions/_shared/vacinas.ts';
import { useDados } from '../dados/contexto';
import { chaveDia, dataBr, diasEntre, hojeLocal } from '../lib/datas';
import { idFixo } from '../lib/ids';
import type { VacinaRegistro } from '../lib/tipos';
import { Campo, Escolhas, Folha, Icone } from './ui';

function Situacao({ d, hoje }: { d: DoseNoCalendario; hoje: string }) {
  const s = d.situacao;
  if (s === 'aplicada')
    return (
      <span className="etiqueta bom">
        <Icone nome="check" /> {d.aplicacao?.data ? dataBr(d.aplicacao.data).slice(0, 5) : 'Aplicada'}
      </span>
    );
  if (s === 'pulada') return <span className="etiqueta">Não vai tomar</span>;
  if (s === 'atrasada')
    return (
      <span className="etiqueta ruim">
        <Icone nome="alerta" /> Atrasada
      </span>
    );
  if (s === 'agora') return <span className="etiqueta aviso">Já pode tomar</span>;
  const dias = diasEntre(hoje, d.prevista);
  if (s === 'proxima') return <span className="etiqueta aviso">Em {dias} {dias === 1 ? 'dia' : 'dias'}</span>;
  return <span className="etiqueta">{dataBr(d.prevista).slice(0, 5)}</span>;
}

function FolhaDose({ d, aoFechar }: { d: DoseNoCalendario; aoFechar: () => void }) {
  const { bebe, membro, usuario, gravar, mostrarAviso, vacinas, nomeDe } = useDados();
  const existente = vacinas.find((v) => v.dose_id === d.dose.id) ?? null;
  const [data, setData] = useState(existente?.data ?? hojeLocal());
  const [rede, setRede] = useState<'sus' | 'particular'>(existente?.rede ?? (d.dose.rede === 'particular' ? 'particular' : 'sus'));
  const [local, setLocal] = useState(existente?.local ?? '');
  const [lote, setLote] = useState(existente?.lote ?? '');
  const [obs, setObs] = useState(existente?.observacao ?? '');
  if (!bebe || !membro) return null;

  function salvar(status: 'aplicada' | 'pulada') {
    if (!bebe || !membro) return;
    const v: VacinaRegistro = {
      id: existente?.id ?? idFixo(`${bebe.id}:vacina:${d.dose.id}`),
      familia_id: membro.familia_id,
      bebe_id: bebe.id,
      criado_por: existente?.criado_por ?? usuario?.id ?? null,
      dose_id: d.dose.id,
      nome: `${d.dose.vacina} – ${d.dose.dose}`,
      status,
      data: status === 'aplicada' ? data : null,
      rede: status === 'aplicada' ? rede : null,
      local: local.trim() || null,
      lote: lote.trim() || null,
      observacao: obs.trim() || null,
    };
    gravar({ tipo: 'colecao', colecao: 'vacinas', dado: v });
    mostrarAviso({
      texto: status === 'aplicada' ? 'Vacina marcada como aplicada' : 'Dose marcada como "não vai tomar"',
      desfazer: () => gravar(existente ? { tipo: 'colecao', colecao: 'vacinas', dado: existente } : { tipo: 'excluir', dado: { alvo: 'vacinas', id: v.id } }),
    });
    aoFechar();
  }

  function desmarcar() {
    if (!existente) return;
    gravar({ tipo: 'excluir', dado: { alvo: 'vacinas', id: existente.id } });
    mostrarAviso({ texto: 'Marcação desfeita', desfazer: () => gravar({ tipo: 'colecao', colecao: 'vacinas', dado: existente }) });
    aoFechar();
  }

  return (
    <Folha titulo={d.dose.vacina} aoFechar={aoFechar}>
      <div className="pilha">
        <div className="pilha-p">
          <p>
            <strong>{d.dose.dose}</strong> · {d.dose.idade_texto}
          </p>
          <p className="texto-2">
            Indicada a partir de {dataBr(d.prevista)} ·{' '}
            {d.dose.rede === 'ambas' ? 'SUS e particular' : d.dose.rede === 'sus' ? 'SUS' : 'só na rede particular'}
          </p>
          {d.dose.observacao && <p className="texto-2">{d.dose.observacao}</p>}
          {d.dose.confirmar && (
            <div className="alerta">
              <Icone nome="alerta" />
              <span>Confirme esta dose e a idade com o pediatra: a recomendação tem detalhes que variam.</span>
            </div>
          )}
        </div>
        <Campo rotulo="Data da aplicação">
          <input type="date" value={data} max={hojeLocal()} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo rotulo="Onde" grupo>
          <Escolhas
            opcoes={[
              { valor: 'sus' as const, rotulo: 'SUS' },
              { valor: 'particular' as const, rotulo: 'Particular' },
            ]}
            valor={rede}
            aoMudar={setRede}
          />
        </Campo>
        <div className="grade">
          <Campo rotulo="Local (opcional)">
            <input value={local} maxLength={300} onChange={(e) => setLocal(e.target.value)} placeholder="UBS, clínica" />
          </Campo>
          <Campo rotulo="Lote (opcional)">
            <input value={lote} maxLength={100} onChange={(e) => setLote(e.target.value)} />
          </Campo>
        </div>
        <Campo rotulo="Observação (opcional)">
          <textarea value={obs} maxLength={2000} onChange={(e) => setObs(e.target.value)} placeholder="Reação, febre depois da vacina…" />
        </Campo>
        <button className="botao primario" onClick={() => salvar('aplicada')} disabled={!data}>
          <Icone nome="check" /> {existente?.status === 'aplicada' ? 'Salvar alterações' : 'Marcar como aplicada'}
        </button>
        {existente?.status !== 'pulada' && (
          <button className="botao" onClick={() => salvar('pulada')}>
            Não vai tomar esta dose
          </button>
        )}
        {existente && (
          <>
            {existente.criado_por && <p className="mudo">Marcado por {nomeDe(existente.criado_por)}</p>}
            <button className="botao texto pequeno" onClick={desmarcar}>
              Desfazer a marcação
            </button>
          </>
        )}
      </div>
    </Folha>
  );
}

function FolhaVacinaExtra({ inicial, aoFechar }: { inicial: VacinaRegistro | null; aoFechar: () => void }) {
  const { bebe, membro, usuario, gravar, mostrarAviso } = useDados();
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [data, setData] = useState(inicial?.data ?? hojeLocal());
  const [rede, setRede] = useState<'sus' | 'particular'>(inicial?.rede ?? 'sus');
  const [local, setLocal] = useState(inicial?.local ?? '');
  if (!bebe || !membro) return null;
  return (
    <Folha titulo={inicial ? 'Vacina' : 'Outra vacina'} aoFechar={aoFechar}>
      <form
        className="pilha"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nome.trim() || !data) return;
          const id = inicial?.id ?? crypto.randomUUID();
          const v: VacinaRegistro = {
            id,
            familia_id: membro.familia_id,
            bebe_id: bebe.id,
            criado_por: inicial?.criado_por ?? usuario?.id ?? null,
            dose_id: inicial?.dose_id ?? `extra:${id}`,
            nome: nome.trim(),
            status: 'aplicada',
            data,
            rede,
            local: local.trim() || null,
            lote: inicial?.lote ?? null,
            observacao: inicial?.observacao ?? null,
          };
          gravar({ tipo: 'colecao', colecao: 'vacinas', dado: v });
          mostrarAviso({ texto: 'Vacina salva' });
          aoFechar();
        }}
      >
        <p className="texto-2">Para doses fora do calendário: gripe dos anos seguintes, campanhas, reforços indicados pelo pediatra.</p>
        <Campo rotulo="Vacina">
          <input value={nome} maxLength={200} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Influenza 2027" autoCapitalize="sentences" />
        </Campo>
        <Campo rotulo="Data">
          <input type="date" value={data} max={hojeLocal()} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo rotulo="Onde" grupo>
          <Escolhas
            opcoes={[
              { valor: 'sus' as const, rotulo: 'SUS' },
              { valor: 'particular' as const, rotulo: 'Particular' },
            ]}
            valor={rede}
            aoMudar={setRede}
          />
        </Campo>
        <Campo rotulo="Local (opcional)">
          <input value={local} maxLength={300} onChange={(e) => setLocal(e.target.value)} />
        </Campo>
        <button className="botao primario">Salvar</button>
        {inicial && (
          <button
            type="button"
            className="botao perigo"
            onClick={() => {
              gravar({ tipo: 'excluir', dado: { alvo: 'vacinas', id: inicial.id } });
              mostrarAviso({ texto: 'Vacina excluída', desfazer: () => gravar({ tipo: 'colecao', colecao: 'vacinas', dado: inicial }) });
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

export function SecaoVacinas() {
  const { bebe, vacinas, hoje, gravar } = useDados();
  const [aberta, setAberta] = useState<DoseNoCalendario | null>(null);
  const [extra, setExtra] = useState<VacinaRegistro | null | 'nova'>(null);
  const [verTodas, setVerTodas] = useState(false);

  const base = bebe?.nascimento ? chaveDia(bebe.nascimento) : bebe?.data_prevista ?? null;
  const cal = bebe?.calendario_vacinal ?? 'pni';
  const lista = useMemo(() => (base ? calendarioDoBebe(base, cal, vacinas, hoje) : []), [base, cal, vacinas, hoje]);
  const grupos = porIdade(lista);
  const extras = vacinas.filter((v) => v.dose_id.startsWith('extra:')).sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));
  const atrasadas = lista.filter((d) => d.situacao === 'atrasada');
  const aplicadas = lista.filter((d) => d.situacao === 'aplicada').length;
  // Mostra até a faixa de idade com a próxima dose pendente (+1); o resto fica em "ver todas"
  const idxPendente = grupos.findIndex((g) => g.itens.some((d) => d.situacao !== 'aplicada' && d.situacao !== 'pulada'));
  const visiveis = verTodas || idxPendente < 0 ? grupos : grupos.slice(0, idxPendente + 2);

  if (!bebe) return null;
  if (!base) return <div className="cartao mudo">Informe a data de nascimento (ou a data prevista) em Ajustes para montar o calendário de vacinas.</div>;

  return (
    <div className="pilha">
      <section className="cartao pilha" aria-label="Calendário de vacinas">
        <Campo rotulo="Calendário" grupo dica="O SUS oferece as vacinas do PNI de graça. A SBP recomenda também algumas da rede particular.">
          <Escolhas
            opcoes={[
              { valor: 'pni' as const, rotulo: 'SUS (PNI)' },
              { valor: 'sbp' as const, rotulo: 'SUS + particular (SBP)' },
            ]}
            valor={cal}
            aoMudar={(v) => gravar({ tipo: 'bebe', dado: { ...bebe, calendario_vacinal: v } })}
          />
        </Campo>
        {!bebe.nascimento && <div className="alerta info">Prévia pela data prevista do parto. As datas se ajustam quando vocês registrarem o nascimento.</div>}
        <div className="grade">
          <div className="bloco">
            <div className="rotulo">Aplicadas</div>
            <div className="valor">
              {aplicadas} <small>de {lista.length}</small>
            </div>
          </div>
          <div className="bloco">
            <div className="rotulo">Atrasadas</div>
            <div className={`valor ${atrasadas.length ? 'ruim' : ''}`}>{atrasadas.length}</div>
          </div>
        </div>
        <p className="mudo">As vacinas pendentes entram no Calendário do iPhone, com aviso na véspera.</p>
      </section>

      {visiveis.map((g) => (
        <section key={g.idade_meses} className="cartao" aria-label={g.idade_texto}>
          <div className="grupo-cab">
            <h2>{g.idade_texto}</h2>
            <span className="mudo">{dataBr(g.itens[0].prevista)}</span>
          </div>
          <div className="lista">
            {g.itens.map((d) => (
              <button key={d.dose.id} className="item" onClick={() => setAberta(d)}>
                <span className="selo t-saude">
                  <Icone nome="vacina" />
                </span>
                <div className="cresce">
                  <div className="titulo">
                    {d.dose.vacina}
                    {d.dose.confirmar ? ' *' : ''}
                  </div>
                  <div className="detalhe">
                    {d.dose.dose}
                    {d.dose.rede === 'particular' ? ' · particular' : ''}
                  </div>
                </div>
                <Situacao d={d} hoje={hoje} />
              </button>
            ))}
          </div>
        </section>
      ))}
      {!verTodas && visiveis.length < grupos.length && (
        <button className="botao" onClick={() => setVerTodas(true)}>
          Ver o calendário completo (até 10 anos)
        </button>
      )}

      <section className="cartao pilha" aria-label="Outras vacinas">
        <div className="cartao-cab" style={{ marginBottom: 0 }}>
          <h2>Outras vacinas</h2>
          <button className="botao pequeno" onClick={() => setExtra('nova')}>
            <Icone nome="mais" /> Registrar
          </button>
        </div>
        {extras.length ? (
          <div className="lista">
            {extras.map((v) => (
              <button key={v.id} className="item" onClick={() => setExtra(v)}>
                <div className="cresce">
                  <div className="titulo">{v.nome}</div>
                  <div className="detalhe">
                    {v.data ? dataBr(v.data) : ''} · {v.rede === 'particular' ? 'particular' : 'SUS'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <p className="mudo">Gripe dos anos seguintes, campanhas e doses extras.</p>
        )}
      </section>

      <p className="fonte">
        * Confirme com o pediatra. Fontes:{' '}
        {FONTES_VACINAS.map((f, i) => (
          <span key={f.url}>
            {i ? ' e ' : ''}
            <a href={f.url} target="_blank" rel="noreferrer">
              {f.nome}
            </a>
          </span>
        ))}
        . O calendário oficial muda de tempos em tempos: a caderneta e o pediatra têm a palavra final.
      </p>

      {aberta && <FolhaDose d={aberta} aoFechar={() => setAberta(null)} />}
      {extra && <FolhaVacinaExtra inicial={extra === 'nova' ? null : extra} aoFechar={() => setExtra(null)} />}
    </div>
  );
}
