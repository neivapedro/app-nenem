import { useState, type ReactNode } from 'react';
import { useAgora, useDados } from '../dados/contexto';
import { agoraIso, chaveDia, dataBr, deCampoDataHora, horaCurta, paraCampoDataHora, relogio, textoDuracao } from '../lib/datas';
import {
  AVISO_FEZES_CLARAS,
  CORES_FEZES,
  corFezes,
  duracaoPorLado,
  emAndamento,
  finalizarMamada,
  finalizarSono,
  iniciarMamada,
  iniciarSono,
  ladoAtivo,
  ladoFinal,
  mamadaManual,
  NOME_LADO,
  outroLado,
  pausarMamada,
  textoFralda,
  trocarLado,
  ultimoDoTipo,
  ultimoLado,
  validarRegistro,
} from '../lib/registros';
import type { ConteudoMamadeira, CorFezes, Lado, PoteLeite, Registro, RegistroDe } from '../lib/tipos';
import { FormExtracao, FormRefeicao, FormRemedio, FormTemperatura } from './registrar-mais';
import { Campo, Escolhas, Folha, Icone, useUmToque } from './ui';

/** "desde 20:36" se foi hoje; "desde 18/10 20:36" se começou outro dia (cronômetro esquecido) */
const desde = (iso: string) => (chaveDia(iso) === chaveDia(new Date()) ? horaCurta(iso) : `${dataBr(chaveDia(iso)).slice(0, 5)} ${horaCurta(iso)}`);

// ---------- Peças comuns ----------

function CampoHora({ rotulo, valor, aoMudar, opcional }: { rotulo: string; valor: string; aoMudar: (v: string) => void; opcional?: boolean }) {
  return (
    <Campo rotulo={rotulo}>
      <div className="linha" style={{ flexWrap: 'nowrap' }}>
        <input type="datetime-local" className="cresce" value={valor} onChange={(e) => aoMudar(e.target.value)} required={!opcional} />
        <button type="button" className="botao pequeno" onClick={() => aoMudar(paraCampoDataHora(agoraIso()))}>
          Agora
        </button>
      </div>
    </Campo>
  );
}

function CampoObservacao({ valor, aoMudar }: { valor: string; aoMudar: (v: string) => void }) {
  return (
    <details className="ajuda" open={!!valor}>
      <summary>Observação (opcional)</summary>
      <Campo rotulo="Observação">
        <textarea value={valor} maxLength={2000} onChange={(e) => aoMudar(e.target.value)} />
      </Campo>
    </details>
  );
}

function Erro({ msg }: { msg: string | null }) {
  return msg ? (
    <div className="alerta erro" role="alert">
      {msg}
    </div>
  ) : null;
}

/** Salva pela fila, mostra o aviso com "Desfazer" e fecha a folha. */
function useSalvar() {
  const { gravar, mostrarAviso } = useDados();
  return (r: Registro, texto: string, anterior?: Registro | null) => {
    gravar({ tipo: 'registro', dado: r });
    mostrarAviso({
      texto,
      desfazer: () => gravar(anterior ? { tipo: 'registro', dado: anterior } : { tipo: 'excluir', dado: { alvo: 'registro', id: r.id } }),
    });
  };
}

// ---------- Mamada no peito ----------

/** Começar uma mamada (cronômetro) ou registrar uma que já passou. */
export function FolhaMamada({ aoFechar }: { aoFechar: () => void }) {
  const { registros, baseRegistro, gravar, mostrarAviso, nomeDe } = useDados();
  const salvar = useSalvar();
  const ultimo = ultimoLado(registros);
  const [manual, setManual] = useState(false);
  const [inicio, setInicio] = useState(() => paraCampoDataHora(new Date(Date.now() - 15 * 60_000).toISOString()));
  const [min, setMin] = useState<{ E: string; D: string }>({ E: '', D: '' });
  const [primeiro, setPrimeiro] = useState<Lado>(ultimo ? outroLado(ultimo) : 'E');
  const [obs, setObs] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  function comecar(lado: Lado) {
    // Já tem uma rolando (ex.: o outro celular começou agora): não abre outra
    const ja = emAndamento(registros).mamada;
    if (ja) {
      mostrarAviso({ texto: `Já tem uma mamada em andamento${ja.criado_por ? ` (iniciada por ${nomeDe(ja.criado_por)})` : ''}` });
      return aoFechar();
    }
    gravar({ tipo: 'registro', dado: iniciarMamada(baseRegistro(), lado, new Date()) });
    aoFechar();
  }

  function salvarManual() {
    const ini = deCampoDataHora(inicio);
    if (!ini) return setMsg('Informe a hora do início.');
    const r = { ...mamadaManual(baseRegistro(), ini, { E: Number(min.E) || 0, D: Number(min.D) || 0 }, primeiro), observacao: obs.trim() || null };
    const problema = validarRegistro(r, new Date());
    if (problema) return setMsg(problema);
    salvar(r, `Mamada registrada (${textoDuracao(duracaoPorLado(r, new Date()).total)})`);
    aoFechar();
  }

  return (
    <Folha titulo="Mamada no peito" aoFechar={aoFechar}>
      {!manual ? (
        <div className="pilha">
          <p className="texto-2">Toque no peito em que o bebê vai começar. O cronômetro conta e você troca de lado quando quiser.</p>
          <div className="grandes t-mamada">
            {(['E', 'D'] as Lado[]).map((l) => (
              <button key={l} className={`botao-grande ${ultimo === l ? 'marcado' : ''}`} onClick={() => comecar(l)}>
                <Icone nome="tocar" />
                Peito {NOME_LADO[l].toLowerCase()}
                {ultimo === l && <small>terminou aqui na última</small>}
              </button>
            ))}
          </div>
          <button className="botao texto" onClick={() => setManual(true)}>
            Registrar uma mamada que já passou
          </button>
        </div>
      ) : (
        <form
          className="pilha"
          onSubmit={(e) => {
            e.preventDefault();
            salvarManual();
          }}
        >
          <CampoHora rotulo="Começou" valor={inicio} aoMudar={setInicio} />
          <div className="grade">
            {(['E', 'D'] as Lado[]).map((l) => (
              <Campo key={l} rotulo={`Peito ${NOME_LADO[l].toLowerCase()} (min)`}>
                <input inputMode="numeric" pattern="[0-9]*" value={min[l]} onChange={(e) => setMin({ ...min, [l]: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
              </Campo>
            ))}
          </div>
          <Campo rotulo="Começou pelo" grupo>
            <Escolhas
              opcoes={[
                { valor: 'E' as Lado, rotulo: 'Esquerdo' },
                { valor: 'D' as Lado, rotulo: 'Direito' },
              ]}
              valor={primeiro}
              aoMudar={setPrimeiro}
            />
          </Campo>
          <CampoObservacao valor={obs} aoMudar={setObs} />
          <Erro msg={msg} />
          <div className="linha">
            <button type="button" className="botao" onClick={() => setManual(false)}>
              Voltar
            </button>
            <button className="botao primario cresce">Salvar mamada</button>
          </div>
        </form>
      )}
    </Folha>
  );
}

/** Mamada em andamento: tempo de cada lado, trocar, pausar e finalizar. */
export function CartaoMamadaAtiva({ r }: { r: RegistroDe<'mamada'> }) {
  const { gravar, mostrarAviso, nomeDe } = useDados();
  const agora = useAgora(1000);
  const d = duracaoPorLado(r, agora);
  const ativo = ladoAtivo(r);
  const toque = useUmToque();
  const salvar = (novo: Registro) => gravar({ tipo: 'registro', dado: novo });

  function finalizar() {
    const fim = finalizarMamada(r, new Date());
    salvar(fim);
    mostrarAviso({ texto: `Mamada salva (${textoDuracao(duracaoPorLado(fim, new Date()).total, true)})`, desfazer: () => salvar(r) });
  }

  function cancelar() {
    if (!confirm('Descartar esta mamada? Ela não fica registrada.')) return;
    gravar({ tipo: 'excluir', dado: { alvo: 'registro', id: r.id } });
    mostrarAviso({ texto: 'Mamada descartada', desfazer: () => salvar(r) });
  }

  return (
    <section className="cartao cronometro t-mamada pilha" aria-label="Mamada em andamento">
      <div className="linha entre">
        <span className="linha" style={{ gap: 8 }}>
          {ativo && <span className="pulso" aria-hidden="true" />}
          <strong>{ativo ? `Mamando no peito ${NOME_LADO[ativo].toLowerCase()}` : 'Mamada pausada'}</strong>
        </span>
        <span className="mudo">
          desde {desde(r.inicio)}
          {r.criado_por ? ` · ${nomeDe(r.criado_por)}` : ''}
        </span>
      </div>
      <div className="grande" aria-live="off">
        {relogio(d.total)}
      </div>
      <div className="lados">
        {(['E', 'D'] as Lado[]).map((l) => (
          <button
            key={l}
            className={`lado ${ativo === l ? 'ativo' : ''}`}
            onClick={toque(() => ativo !== l && salvar(trocarLado(r, new Date(), l)))}
            aria-pressed={ativo === l}
          >
            <span className="tempo">{relogio(d[l])}</span>
            <span className="rotulo">{ativo === l ? `Peito ${l} · agora` : `Mudar para o ${l}`}</span>
          </button>
        ))}
      </div>
      <div className="linha">
        {ativo ? (
          <button className="botao" onClick={toque(() => salvar(pausarMamada(r, new Date())))}>
            <Icone nome="pausar" /> Pausar
          </button>
        ) : (
          <button className="botao" onClick={toque(() => salvar(trocarLado(r, new Date(), ladoFinal(r) ?? 'E')))}>
            <Icone nome="tocar" /> Continuar
          </button>
        )}
        <button className="botao primario cresce" onClick={toque(finalizar)}>
          <Icone nome="parar" /> Finalizar
        </button>
      </div>
      <button className="botao texto pequeno" style={{ alignSelf: 'center' }} onClick={cancelar}>
        Descartar
      </button>
    </section>
  );
}

// ---------- Mamadeira ----------

const ML_RAPIDOS = [30, 60, 90, 120, 150];

function FormMamadeira({ inicial, aoSalvar, rodape }: { inicial: RegistroDe<'mamadeira'>; aoSalvar: (r: RegistroDe<'mamadeira'>) => void; rodape?: ReactNode }) {
  const [ml, setMl] = useState(inicial.dados.ml ? String(inicial.dados.ml) : '');
  const [conteudo, setConteudo] = useState<ConteudoMamadeira>(inicial.dados.conteudo);
  const [inicio, setInicio] = useState(paraCampoDataHora(inicial.inicio));
  const [obs, setObs] = useState(inicial.observacao ?? '');
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <form
      className="pilha"
      onSubmit={(e) => {
        e.preventDefault();
        const ini = deCampoDataHora(inicio);
        if (!ini) return setMsg('Informe a hora.');
        const r: RegistroDe<'mamadeira'> = { ...inicial, inicio: ini, fim: ini, dados: { ml: Number(ml), conteudo }, observacao: obs.trim() || null };
        const problema = validarRegistro(r, new Date());
        if (problema) return setMsg(problema);
        aoSalvar(r);
      }}
    >
      <Campo rotulo="Quantidade (ml)">
        <input inputMode="numeric" pattern="[0-9]*" value={ml} onChange={(e) => setMl(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="ml" />
      </Campo>
      <div className="chips">
        {ML_RAPIDOS.map((v) => (
          <button key={v} type="button" className={`chip ${Number(ml) === v ? 'ativo' : ''}`} onClick={() => setMl(String(v))}>
            {v} ml
          </button>
        ))}
      </div>
      <Campo rotulo="Leite" grupo>
        <Escolhas
          opcoes={[
            { valor: 'materno' as ConteudoMamadeira, rotulo: 'Leite materno' },
            { valor: 'formula' as ConteudoMamadeira, rotulo: 'Fórmula' },
          ]}
          valor={conteudo}
          aoMudar={setConteudo}
        />
      </Campo>
      <CampoHora rotulo="Hora" valor={inicio} aoMudar={setInicio} />
      <CampoObservacao valor={obs} aoMudar={setObs} />
      <Erro msg={msg} />
      <button className="botao primario">Salvar</button>
      {rodape}
    </form>
  );
}

export function FolhaMamadeira({ aoFechar }: { aoFechar: () => void }) {
  const { registros, baseRegistro } = useDados();
  const salvar = useSalvar();
  // Repete o tipo de leite da última mamadeira
  const ultima = ultimoDoTipo(registros, 'mamadeira');
  const agora = agoraIso();
  const inicial: RegistroDe<'mamadeira'> = {
    ...baseRegistro(),
    tipo: 'mamadeira',
    inicio: agora,
    fim: agora,
    observacao: null,
    dados: { ml: 0, conteudo: ultima?.dados.conteudo ?? 'materno' },
  };
  return (
    <Folha titulo="Mamadeira" aoFechar={aoFechar}>
      <FormMamadeira
        inicial={inicial}
        aoSalvar={(r) => {
          salvar(r, `Mamadeira registrada (${r.dados.ml} ml)`);
          aoFechar();
        }}
      />
    </Folha>
  );
}

// ---------- Fralda ----------

function EscolhaCor({ valor, aoMudar }: { valor: CorFezes | null; aoMudar: (v: CorFezes | null) => void }) {
  const cor = corFezes(valor);
  return (
    <div className="pilha-p">
      <div className="chips" role="radiogroup" aria-label="Cor do cocô">
        {CORES_FEZES.map((c) => (
          <button
            key={c.valor}
            type="button"
            role="radio"
            aria-checked={valor === c.valor}
            className={`chip ${valor === c.valor ? 'ativo' : ''}`}
            onClick={() => aoMudar(valor === c.valor ? null : c.valor)}
          >
            <span className="bolinha" style={{ background: c.cor }} />
            {c.rotulo}
          </button>
        ))}
      </div>
      {cor?.alerta && (
        <div className="alerta erro">
          <Icone nome="alerta" />
          <span>{AVISO_FEZES_CLARAS}</span>
        </div>
      )}
    </div>
  );
}

/** Um toque registra a fralda agora. Cor do cocô e hora são opcionais. */
export function FolhaFralda({ aoFechar }: { aoFechar: () => void }) {
  const { baseRegistro } = useDados();
  const salvar = useSalvar();
  const [inicio, setInicio] = useState(() => paraCampoDataHora(agoraIso()));
  const [mudarHora, setMudarHora] = useState(false);
  const [cor, setCor] = useState<CorFezes | null>(null);
  const [verCor, setVerCor] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const toque = useUmToque();

  function registrar(xixi: boolean, coco: boolean) {
    const escolhida = mudarHora ? deCampoDataHora(inicio) : null;
    if (mudarHora && !escolhida) return setMsg('Informe a hora da troca.');
    const ini = escolhida ?? agoraIso();
    const r: RegistroDe<'fralda'> = { ...baseRegistro(), tipo: 'fralda', inicio: ini, fim: ini, observacao: null, dados: { xixi, coco, cor: coco ? cor : null } };
    const problema = validarRegistro(r, new Date());
    if (problema) return setMsg(problema);
    salvar(r, `Fralda registrada (${textoFralda(r.dados)})`);
    aoFechar();
  }

  return (
    <Folha titulo="Troca de fralda" aoFechar={aoFechar}>
      <div className="pilha">
        <div className="grandes t-fralda">
          <button className="botao-grande" onClick={toque(() => registrar(true, false))}>
            💧<span>Xixi</span>
          </button>
          <button className="botao-grande" onClick={toque(() => registrar(false, true))}>
            💩<span>Cocô</span>
          </button>
          <button className="botao-grande" onClick={toque(() => registrar(true, true))}>
            💧💩<span>Os dois</span>
          </button>
        </div>
        <Erro msg={msg} />
        {!verCor ? (
          <button className="botao texto pequeno" onClick={() => setVerCor(true)}>
            Anotar a cor do cocô
          </button>
        ) : (
          <Campo rotulo="Cor do cocô (vale para cocô e os dois)" grupo>
            <EscolhaCor valor={cor} aoMudar={setCor} />
          </Campo>
        )}
        {!mudarHora ? (
          <button className="botao texto pequeno" onClick={() => setMudarHora(true)}>
            Foi em outro horário
          </button>
        ) : (
          <CampoHora rotulo="Hora da troca" valor={inicio} aoMudar={setInicio} />
        )}
      </div>
    </Folha>
  );
}

// ---------- Sono ----------

export function FolhaSono({ aoFechar }: { aoFechar: () => void }) {
  const { registros, baseRegistro, gravar, mostrarAviso } = useDados();
  const salvar = useSalvar();
  const [manual, setManual] = useState(false);
  const [inicio, setInicio] = useState(() => paraCampoDataHora(new Date(Date.now() - 60 * 60_000).toISOString()));
  const [fim, setFim] = useState(() => paraCampoDataHora(agoraIso()));
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <Folha titulo="Sono" aoFechar={aoFechar}>
      {!manual ? (
        <div className="pilha">
          <button
            className="botao-grande t-sono"
            onClick={() => {
              // O outro celular pode ter marcado "Dormiu" agora mesmo
              if (emAndamento(registros).sono) mostrarAviso({ texto: 'O sono já está sendo contado' });
              else gravar({ tipo: 'registro', dado: iniciarSono(baseRegistro(), new Date()) });
              aoFechar();
            }}
          >
            <Icone nome="sono" />
            Dormiu agora
            <small>o cronômetro conta até você tocar em "Acordou"</small>
          </button>
          <button className="botao texto" onClick={() => setManual(true)}>
            Registrar um sono que já passou
          </button>
        </div>
      ) : (
        <form
          className="pilha"
          onSubmit={(e) => {
            e.preventDefault();
            const ini = deCampoDataHora(inicio);
            const f = deCampoDataHora(fim);
            if (!ini || !f) return setMsg('Informe quando dormiu e quando acordou.');
            const r: RegistroDe<'sono'> = { ...baseRegistro(), tipo: 'sono', inicio: ini, fim: f, observacao: null, dados: {} };
            const problema = validarRegistro(r, new Date());
            if (problema) return setMsg(problema);
            salvar(r, `Sono registrado (${textoDuracao(new Date(f).getTime() - new Date(ini).getTime())})`);
            aoFechar();
          }}
        >
          <CampoHora rotulo="Dormiu" valor={inicio} aoMudar={setInicio} />
          <CampoHora rotulo="Acordou" valor={fim} aoMudar={setFim} />
          <Erro msg={msg} />
          <div className="linha">
            <button type="button" className="botao" onClick={() => setManual(false)}>
              Voltar
            </button>
            <button className="botao primario cresce">Salvar sono</button>
          </div>
        </form>
      )}
    </Folha>
  );
}

export function CartaoSonoAtivo({ r }: { r: RegistroDe<'sono'> }) {
  const { gravar, mostrarAviso, nomeDe } = useDados();
  const agora = useAgora(1000);
  const toque = useUmToque();
  function acordou() {
    const fim = finalizarSono(r, new Date());
    gravar({ tipo: 'registro', dado: fim });
    mostrarAviso({
      texto: `Sono salvo (${textoDuracao(new Date(fim.fim!).getTime() - new Date(r.inicio).getTime(), true)})`,
      desfazer: () => gravar({ tipo: 'registro', dado: r }),
    });
  }
  return (
    <section className="cartao cronometro t-sono pilha" aria-label="Sono em andamento">
      <div className="linha entre">
        <span className="linha" style={{ gap: 8 }}>
          <span className="pulso" aria-hidden="true" />
          <strong>Dormindo</strong>
        </span>
        <span className="mudo">
          desde {desde(r.inicio)}
          {r.criado_por ? ` · ${nomeDe(r.criado_por)}` : ''}
        </span>
      </div>
      <div className="grande">{relogio(agora.getTime() - new Date(r.inicio).getTime())}</div>
      <button className="botao primario largo" onClick={toque(acordou)}>
        Acordou
      </button>
    </section>
  );
}

// ---------- Editar qualquer registro (Histórico) ----------

export function FolhaEditar({ r, aoFechar }: { r: Registro; aoFechar: () => void }) {
  const { gravar, mostrarAviso, nomeDe, leite } = useDados();
  const salvar = useSalvar();
  const [msg, setMsg] = useState<string | null>(null);
  // Extração guardada no estoque: o pote tem o mesmo id do registro
  const pote = r.tipo === 'extracao' ? leite.find((p) => p.id === r.id) : undefined;

  function excluir() {
    if (!confirm(pote ? 'Excluir este registro? O pote do estoque também sai.' : 'Excluir este registro?')) return;
    gravar({ tipo: 'excluir', dado: { alvo: 'registro', id: r.id } }, ...(pote ? [{ tipo: 'excluir' as const, dado: { alvo: 'leite' as const, id: pote.id } }] : []));
    mostrarAviso({
      texto: 'Registro excluído',
      desfazer: () => gravar({ tipo: 'registro', dado: r }, ...(pote ? [{ tipo: 'colecao' as const, colecao: 'leite' as const, dado: pote }] : [])),
    });
    aoFechar();
  }

  function salvarExtracao(novo: Registro, extra?: { pote?: PoteLeite }) {
    const p = extra?.pote;
    gravar({ tipo: 'registro', dado: novo }, ...(p ? [{ tipo: 'colecao' as const, colecao: 'leite' as const, dado: p }] : []));
    mostrarAviso({
      texto: 'Extração atualizada',
      desfazer: () =>
        gravar(
          { tipo: 'registro', dado: r },
          ...(p ? [pote ? { tipo: 'colecao' as const, colecao: 'leite' as const, dado: pote } : { tipo: 'excluir' as const, dado: { alvo: 'leite' as const, id: p.id } }] : []),
        ),
    });
    aoFechar();
  }

  const rodape = (
    <div className="pilha-p" style={{ marginTop: 6 }}>
      {r.criado_por && <p className="mudo">Registrado por {nomeDe(r.criado_por)}</p>}
      <button type="button" className="botao perigo" onClick={excluir}>
        <Icone nome="lixeira" /> Excluir
      </button>
    </div>
  );

  const titulos = {
    mamada: 'Editar mamada',
    mamadeira: 'Editar mamadeira',
    fralda: 'Editar fralda',
    sono: 'Editar sono',
    remedio: 'Editar remédio',
    temperatura: 'Editar temperatura',
    extracao: 'Editar extração',
    refeicao: 'Editar refeição',
  } as const;
  const atualizar = (texto: string) => (novo: Registro) => {
    salvar(novo, texto, r);
    aoFechar();
  };

  return (
    <Folha titulo={titulos[r.tipo]} aoFechar={aoFechar}>
      {r.tipo === 'mamadeira' && (
        <FormMamadeira
          inicial={r}
          aoSalvar={(novo) => {
            salvar(novo, 'Mamadeira atualizada', r);
            aoFechar();
          }}
          rodape={rodape}
        />
      )}
      {r.tipo === 'mamada' && <EditarMamada r={r} aoSalvar={(novo) => (salvar(novo, 'Mamada atualizada', r), aoFechar())} rodape={rodape} setMsg={setMsg} msg={msg} />}
      {r.tipo === 'fralda' && <EditarFralda r={r} aoSalvar={(novo) => (salvar(novo, 'Fralda atualizada', r), aoFechar())} rodape={rodape} setMsg={setMsg} msg={msg} />}
      {r.tipo === 'sono' && <EditarSono r={r} aoSalvar={(novo) => (salvar(novo, 'Sono atualizado', r), aoFechar())} rodape={rodape} setMsg={setMsg} msg={msg} />}
      {r.tipo === 'remedio' && <FormRemedio inicial={r} aoSalvar={atualizar('Remédio atualizado')} rodape={rodape} />}
      {r.tipo === 'temperatura' && <FormTemperatura inicial={r} aoSalvar={atualizar('Temperatura atualizada')} rodape={rodape} />}
      {r.tipo === 'extracao' && <FormExtracao inicial={r} aoSalvar={salvarExtracao} rodape={rodape} />}
      {r.tipo === 'refeicao' && <FormRefeicao inicial={r} aoSalvar={atualizar('Refeição atualizada')} rodape={rodape} />}
    </Folha>
  );
}

interface PropsEditar<T> {
  r: T;
  aoSalvar: (r: T) => void;
  rodape: ReactNode;
  msg: string | null;
  setMsg: (m: string | null) => void;
}

function EditarMamada({ r, aoSalvar, rodape, msg, setMsg }: PropsEditar<RegistroDe<'mamada'>>) {
  const d = duracaoPorLado(r, new Date());
  const [inicio, setInicio] = useState(paraCampoDataHora(r.inicio));
  const [min, setMin] = useState({ E: d.E ? String(Math.round(d.E / 60_000)) : '', D: d.D ? String(Math.round(d.D / 60_000)) : '' });
  const [primeiro, setPrimeiro] = useState<Lado>(r.dados.segmentos[0]?.lado ?? 'E');
  const [obs, setObs] = useState(r.observacao ?? '');
  // Valores de quando abriu: se só a observação mudar, os trechos (e o lado em que terminou) ficam como estão
  const [original] = useState(() => ({ inicio: paraCampoDataHora(r.inicio), E: min.E, D: min.D, primeiro }));
  if (!r.fim) {
    return (
      <div className="pilha">
        <p className="texto-2">Esta mamada está em andamento. Dá para trocar de lado pelo cronômetro na tela Hoje, ou finalizar aqui.</p>
        <button type="button" className="botao primario" onClick={() => aoSalvar(finalizarMamada(r, new Date()))}>
          <Icone nome="parar" /> Finalizar agora
        </button>
        {rodape}
      </div>
    );
  }
  return (
    <form
      className="pilha"
      onSubmit={(e) => {
        e.preventDefault();
        const ini = deCampoDataHora(inicio);
        if (!ini) return setMsg('Informe a hora do início.');
        const mudou = inicio !== original.inicio || min.E !== original.E || min.D !== original.D || primeiro !== original.primeiro;
        const novo = mudou
          ? { ...mamadaManual(r, ini, { E: Number(min.E) || 0, D: Number(min.D) || 0 }, primeiro), observacao: obs.trim() || null }
          : { ...r, observacao: obs.trim() || null };
        const problema = validarRegistro(novo, new Date());
        if (problema) return setMsg(problema);
        aoSalvar(novo);
      }}
    >
      <CampoHora rotulo="Começou" valor={inicio} aoMudar={setInicio} />
      <div className="grade">
        {(['E', 'D'] as Lado[]).map((l) => (
          <Campo key={l} rotulo={`Peito ${NOME_LADO[l].toLowerCase()} (min)`}>
            <input inputMode="numeric" pattern="[0-9]*" value={min[l]} onChange={(e) => setMin({ ...min, [l]: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
          </Campo>
        ))}
      </div>
      <Campo rotulo="Começou pelo" grupo>
        <Escolhas
          opcoes={[
            { valor: 'E' as Lado, rotulo: 'Esquerdo' },
            { valor: 'D' as Lado, rotulo: 'Direito' },
          ]}
          valor={primeiro}
          aoMudar={setPrimeiro}
        />
      </Campo>
      <CampoObservacao valor={obs} aoMudar={setObs} />
      <Erro msg={msg} />
      <button className="botao primario">Salvar</button>
      {rodape}
    </form>
  );
}

function EditarFralda({ r, aoSalvar, rodape, msg, setMsg }: PropsEditar<RegistroDe<'fralda'>>) {
  const [inicio, setInicio] = useState(paraCampoDataHora(r.inicio));
  const [xixi, setXixi] = useState(r.dados.xixi);
  const [coco, setCoco] = useState(r.dados.coco);
  const [cor, setCor] = useState<CorFezes | null>(r.dados.cor ?? null);
  const [obs, setObs] = useState(r.observacao ?? '');
  return (
    <form
      className="pilha"
      onSubmit={(e) => {
        e.preventDefault();
        const ini = deCampoDataHora(inicio);
        if (!ini) return setMsg('Informe a hora.');
        const novo: RegistroDe<'fralda'> = { ...r, inicio: ini, fim: ini, dados: { xixi, coco, cor: coco ? cor : null }, observacao: obs.trim() || null };
        const problema = validarRegistro(novo, new Date());
        if (problema) return setMsg(problema);
        aoSalvar(novo);
      }}
    >
      <div className="grandes t-fralda">
        <button type="button" className={`botao-grande ${xixi ? 'marcado' : ''}`} aria-pressed={xixi} onClick={() => setXixi(!xixi)}>
          💧<span>Xixi</span>
        </button>
        <button type="button" className={`botao-grande ${coco ? 'marcado' : ''}`} aria-pressed={coco} onClick={() => setCoco(!coco)}>
          💩<span>Cocô</span>
        </button>
      </div>
      {coco && (
        <Campo rotulo="Cor do cocô" grupo>
          <EscolhaCor valor={cor} aoMudar={setCor} />
        </Campo>
      )}
      <CampoHora rotulo="Hora" valor={inicio} aoMudar={setInicio} />
      <CampoObservacao valor={obs} aoMudar={setObs} />
      <Erro msg={msg} />
      <button className="botao primario">Salvar</button>
      {rodape}
    </form>
  );
}

function EditarSono({ r, aoSalvar, rodape, msg, setMsg }: PropsEditar<RegistroDe<'sono'>>) {
  const { registros } = useDados();
  const [inicio, setInicio] = useState(paraCampoDataHora(r.inicio));
  const [fim, setFim] = useState(r.fim ? paraCampoDataHora(r.fim) : '');
  const [obs, setObs] = useState(r.observacao ?? '');
  return (
    <form
      className="pilha"
      onSubmit={(e) => {
        e.preventDefault();
        const ini = deCampoDataHora(inicio);
        if (!ini) return setMsg('Informe quando dormiu.');
        const novo: RegistroDe<'sono'> = { ...r, inicio: ini, fim: deCampoDataHora(fim), observacao: obs.trim() || null };
        if (!novo.fim && registros.some((x) => x.tipo === 'sono' && !x.fim && x.id !== r.id)) return setMsg('Já tem outro sono sendo contado. Informe quando acordou.');
        const problema = validarRegistro(novo, new Date());
        if (problema) return setMsg(problema);
        aoSalvar(novo);
      }}
    >
      <CampoHora rotulo="Dormiu" valor={inicio} aoMudar={setInicio} />
      <CampoHora rotulo="Acordou (vazio = ainda dormindo)" valor={fim} aoMudar={setFim} opcional />
      <CampoObservacao valor={obs} aoMudar={setObs} />
      <Erro msg={msg} />
      <button className="botao primario">Salvar</button>
      {rodape}
    </form>
  );
}
