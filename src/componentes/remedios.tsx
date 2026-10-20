import { useState } from 'react';
import { useAgora, useDados } from '../dados/contexto';
import { avaliarTemperatura, FONTE_FEBRE } from '../lib/conteudo';
import { agoraIso, chaveDia, diasEntre, haQuanto, horaCurta, nomeDia, textoDuracao } from '../lib/datas';
import { descrever, ordenarRecentes } from '../lib/registros';
import { proximaDose, ultimaDose } from '../lib/saude';
import type { RegistroDe, Remedio } from '../lib/tipos';
import { FolhaRegistroMais } from './registrar-mais';
import { FolhaEditar } from './registrar';
import { Campo, Folha, Icone, Selo } from './ui';

const INTERVALOS = [4, 6, 8, 12, 24];

function FolhaRemedio({ inicial, aoFechar }: { inicial: Remedio | null; aoFechar: () => void }) {
  const { bebe, membro, usuario, gravar, mostrarAviso } = useDados();
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [dose, setDose] = useState(inicial?.dose ?? '');
  const [intervalo, setIntervalo] = useState<string>(inicial?.intervalo_h ? String(inicial.intervalo_h) : '');
  const [obs, setObs] = useState(inicial?.observacao ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  if (!bebe || !membro) return null;

  /** Grava o que está no formulário; `ativo` muda só ao encerrar/reativar */
  function salvar(ativo: boolean, aviso: string) {
    if (!bebe || !membro) return;
    if (!nome.trim()) return setMsg('Informe o nome do remédio.');
    const r: Remedio = {
      id: inicial?.id ?? crypto.randomUUID(),
      familia_id: membro.familia_id,
      bebe_id: bebe.id,
      criado_por: inicial?.criado_por ?? usuario?.id ?? null,
      nome: nome.trim(),
      dose: dose.trim() || null,
      intervalo_h: intervalo ? Number(intervalo) : null,
      ativo,
      observacao: obs.trim() || null,
    };
    gravar({ tipo: 'colecao', colecao: 'remedios', dado: r });
    mostrarAviso({ texto: aviso });
    aoFechar();
  }

  return (
    <Folha titulo={inicial ? 'Remédio' : 'Novo remédio'} aoFechar={aoFechar}>
      <form
        className="pilha"
        onSubmit={(e) => {
          e.preventDefault();
          salvar(inicial?.ativo ?? true, inicial ? 'Remédio atualizado' : 'Remédio salvo');
        }}
      >
        <Campo rotulo="Remédio">
          <input value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: vitamina D" autoCapitalize="sentences" />
        </Campo>
        <Campo rotulo="Dose (opcional)">
          <input value={dose} maxLength={120} onChange={(e) => setDose(e.target.value)} placeholder="Ex.: 2 gotas" />
        </Campo>
        <Campo rotulo="Frequência" dica="Com intervalo, o app mostra a hora da próxima dose e avisa no celular (se ligado em Ajustes).">
          <select value={intervalo} onChange={(e) => setIntervalo(e.target.value)}>
            <option value="">Quando precisar / sem horário</option>
            {[...new Set([...INTERVALOS, ...(inicial?.intervalo_h ? [inicial.intervalo_h] : [])])]
              .sort((a, b) => a - b)
              .map((h) => (
                <option key={h} value={h}>
                  {h === 24 ? '1 vez por dia' : `De ${h} em ${h} horas`}
                </option>
              ))}
          </select>
        </Campo>
        <Campo rotulo="Observação (opcional)">
          <textarea value={obs} maxLength={2000} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: receitado na consulta de 1 mês, por 7 dias" />
        </Campo>
        <p className="mudo">Use remédios só com orientação do pediatra. O app só ajuda a lembrar.</p>
        {msg && <div className="alerta erro">{msg}</div>}
        <button className="botao primario">Salvar</button>
        {inicial && (
          <button
            type="button"
            className="botao"
            onClick={() => salvar(!inicial.ativo, inicial.ativo ? 'Remédio encerrado' : 'Remédio reativado')}
          >
            {inicial.ativo ? 'Encerrar (parou de tomar)' : 'Voltar a usar'}
          </button>
        )}
      </form>
    </Folha>
  );
}

function CartaoRemedio({ r }: { r: Remedio }) {
  const { registros, gravar, mostrarAviso, baseRegistro, nomeDe } = useDados();
  const agora = useAgora(30_000);
  const [editar, setEditar] = useState(false);
  const [outraHora, setOutraHora] = useState(false);
  const ultima = ultimaDose(registros, r.id);
  const proxima = proximaDose(r, registros);
  const atrasada = proxima && new Date(proxima).getTime() < agora.getTime();

  function deiAgora() {
    const ini = agoraIso();
    const reg: RegistroDe<'remedio'> = { ...baseRegistro(), tipo: 'remedio', inicio: ini, fim: ini, observacao: null, dados: { remedio_id: r.id, nome: r.nome, dose: r.dose } };
    gravar({ tipo: 'registro', dado: reg });
    mostrarAviso({ texto: `${r.nome}: dose registrada`, desfazer: () => gravar({ tipo: 'excluir', dado: { alvo: 'registro', id: reg.id } }) });
  }

  return (
    <section className="cartao pilha" aria-label={r.nome}>
      <div className="linha" style={{ flexWrap: 'nowrap' }}>
        <Selo tipo="remedio" />
        <div className="cresce">
          <div style={{ fontWeight: 650 }}>{r.nome}</div>
          <div className="texto-2">
            {[r.dose, r.intervalo_h ? (r.intervalo_h === 24 ? '1 vez por dia' : `de ${r.intervalo_h} em ${r.intervalo_h} h`) : 'quando precisar'].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button className="botao pequeno" onClick={() => setEditar(true)}>
          Editar
        </button>
      </div>
      <div className="grade">
        <div className="bloco">
          <div className="rotulo">Última dose</div>
          <div className="valor">{ultima ? horaCurta(ultima.inicio) : '—'}</div>
          {ultima && (
            <div className="mudo">
              {haQuanto(ultima.inicio, agora)}
              {ultima.criado_por ? ` · ${nomeDe(ultima.criado_por)}` : ''}
            </div>
          )}
        </div>
        <div className="bloco">
          <div className="rotulo">Próxima</div>
          <div className={`valor ${atrasada ? 'ruim' : ''}`}>{proxima ? horaCurta(proxima) : '—'}</div>
          {proxima && <div className="mudo">{atrasada ? `passou há ${textoDuracao(agora.getTime() - new Date(proxima).getTime())}` : nomeDia(chaveDia(proxima), chaveDia(agora))}</div>}
        </div>
      </div>
      <div className="linha">
        <button className="botao primario cresce" onClick={deiAgora}>
          <Icone nome="check" /> Dei agora
        </button>
        <button className="botao" onClick={() => setOutraHora(true)}>
          Outra hora
        </button>
      </div>
      {editar && <FolhaRemedio inicial={r} aoFechar={() => setEditar(false)} />}
      {outraHora && <FolhaRegistroMais tipo="remedio" remedioId={r.id} aoFechar={() => setOutraHora(false)} />}
    </section>
  );
}

export function SecaoRemedios() {
  const { remedios, registros, nomeDe } = useDados();
  const agora = useAgora(60_000);
  const [novo, setNovo] = useState(false);
  const [avulso, setAvulso] = useState(false);
  const [encerradoAberto, setEncerradoAberto] = useState<Remedio | null>(null);
  const [editando, setEditando] = useState<RegistroDe<'remedio'> | null>(null);
  const ativos = remedios.filter((r) => r.ativo);
  const encerrados = remedios.filter((r) => !r.ativo);
  const doses = ordenarRecentes(registros.filter((r): r is RegistroDe<'remedio'> => r.tipo === 'remedio')).slice(0, 15);

  return (
    <div className="pilha">
      <div className="linha">
        <button className="botao primario cresce" onClick={() => setNovo(true)}>
          <Icone nome="mais" /> Novo remédio
        </button>
        <button className="botao" onClick={() => setAvulso(true)}>
          Dose avulsa
        </button>
      </div>
      {ativos.map((r) => (
        <CartaoRemedio key={r.id} r={r} />
      ))}
      {!ativos.length && <div className="cartao mudo">Nenhum remédio em uso. Cadastre os receitados (ex.: vitamina) para lembrar a hora e ver quem deu a última dose.</div>}
      {doses.length > 0 && (
        <section className="cartao" aria-label="Doses dadas">
          <h2>Doses dadas</h2>
          <div className="lista">
            {doses.map((d) => {
              const t = descrever(d, agora);
              return (
                <button key={d.id} className="item" onClick={() => setEditando(d)}>
                  <div className="cresce">
                    <div className="titulo">{d.dados.nome}</div>
                    <div className="detalhe">
                      {nomeDia(chaveDia(d.inicio), chaveDia(agora))} · {t.detalhe}
                    </div>
                  </div>
                  {d.criado_por && <span className="quem">{nomeDe(d.criado_por)}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}
      {encerrados.length > 0 && (
        <section className="cartao" aria-label="Encerrados">
          <h2>Encerrados</h2>
          <div className="lista">
            {encerrados.map((r) => (
              <button key={r.id} className="item" onClick={() => setEncerradoAberto(r)}>
                <div className="cresce">
                  <div className="titulo">{r.nome}</div>
                  {r.dose && <div className="detalhe">{r.dose}</div>}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
      {novo && <FolhaRemedio inicial={null} aoFechar={() => setNovo(false)} />}
      {encerradoAberto && <FolhaRemedio inicial={encerradoAberto} aoFechar={() => setEncerradoAberto(null)} />}
      {avulso && <FolhaRegistroMais tipo="remedio" aoFechar={() => setAvulso(false)} />}
      {editando && <FolhaEditar r={editando} aoFechar={() => setEditando(null)} />}
    </div>
  );
}

export function SecaoTemperatura() {
  const { registros, bebe, nomeDe } = useDados();
  const agora = useAgora(60_000);
  const [nova, setNova] = useState(false);
  const [editando, setEditando] = useState<RegistroDe<'temperatura'> | null>(null);
  const lista = ordenarRecentes(registros.filter((r): r is RegistroDe<'temperatura'> => r.tipo === 'temperatura'));
  const ultima = lista[0] ?? null;
  const idadeDias = (iso: string) => (bebe?.nascimento ? diasEntre(chaveDia(bebe.nascimento), chaveDia(iso)) : null);
  const aval = ultima ? avaliarTemperatura(ultima.dados.graus, idadeDias(ultima.inicio)) : null;
  const graus = (g: number) => g.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <div className="pilha">
      <button className="botao primario" onClick={() => setNova(true)}>
        <Icone nome="temperatura" /> Medir temperatura
      </button>
      {ultima && aval && (
        <section className="cartao pilha" aria-label="Última temperatura">
          <div className="rotulo">Última · {haQuanto(ultima.inicio, agora)}</div>
          <div className="grande">{graus(ultima.dados.graus)} °C</div>
          {aval.nivel !== 'normal' ? (
            <div className={`alerta ${aval.nivel === 'urgente' ? 'erro' : ''}`}>
              <Icone nome="alerta" />
              <span>{aval.texto}</span>
            </div>
          ) : (
            <p className="texto-2">{aval.texto}</p>
          )}
        </section>
      )}
      {lista.length > 0 ? (
        <section className="cartao" aria-label="Medições">
          <h2>Medições</h2>
          <div className="lista">
            {lista.slice(0, 30).map((t) => {
              const a = avaliarTemperatura(t.dados.graus, idadeDias(t.inicio));
              return (
                <button key={t.id} className="item" onClick={() => setEditando(t)}>
                  <div className="cresce">
                    <div className="titulo">
                      {graus(t.dados.graus)} °C {a.nivel !== 'normal' && <span className={`etiqueta ${a.nivel === 'urgente' ? 'ruim' : 'aviso'}`}>{a.nivel === 'urgente' ? 'atenção' : 'febre'}</span>}
                    </div>
                    <div className="detalhe">
                      {nomeDia(chaveDia(t.inicio), chaveDia(agora))} · {horaCurta(t.inicio)}
                      {t.observacao ? ` · ${t.observacao}` : ''}
                    </div>
                  </div>
                  {t.criado_por && <span className="quem">{nomeDe(t.criado_por)}</span>}
                </button>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="cartao mudo">Nenhuma medição ainda. Meça na axila com termômetro digital.</div>
      )}
      <p className="fonte">
        Febre a partir de 37,5 °C na axila, pela SBP.{' '}
        <a href={FONTE_FEBRE.url} target="_blank" rel="noreferrer">
          Fonte
        </a>
        . Na dúvida, ligue para o pediatra.
      </p>
      {nova && <FolhaRegistroMais tipo="temperatura" aoFechar={() => setNova(false)} />}
      {editando && <FolhaEditar r={editando} aoFechar={() => setEditando(null)} />}
    </div>
  );
}
