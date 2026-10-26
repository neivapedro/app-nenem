import { useState, type ReactNode } from 'react';
import { useDados } from '../dados/contexto';
import { avaliarTemperatura, FONTE_FEBRE } from '../lib/conteudo';
import { agoraIso, deCampoDataHora, diasEntre, chaveDia, paraCampoDataHora } from '../lib/datas';
import { validarRegistro } from '../lib/registros';
import { remedioEmUso } from '../lib/saude';
import type { Aceitacao, PoteLeite, Registro, RegistroDe } from '../lib/tipos';
import { Campo, Escolhas, Folha, Icone } from './ui';

// Formulários dos registros da Fase 2: remédio, temperatura, extração de leite e refeição.
// Cada um serve para registrar (novo) e para editar (Histórico).

function CampoHora({ valor, aoMudar, rotulo = 'Hora' }: { valor: string; aoMudar: (v: string) => void; rotulo?: string }) {
  return (
    <Campo rotulo={rotulo}>
      <div className="linha" style={{ flexWrap: 'nowrap' }}>
        <input type="datetime-local" className="cresce" value={valor} onChange={(e) => aoMudar(e.target.value)} required />
        <button type="button" className="botao pequeno" onClick={() => aoMudar(paraCampoDataHora(agoraIso()))}>
          Agora
        </button>
      </div>
    </Campo>
  );
}

function Erro({ msg }: { msg: string | null }) {
  return msg ? (
    <div className="alerta erro" role="alert">
      {msg}
    </div>
  ) : null;
}

const numero = (v: string) => Number(v.replace(',', '.'));

interface PropsForm<T> {
  inicial: T;
  aoSalvar: (r: T, extra?: { pote?: PoteLeite }) => void;
  rodape?: ReactNode;
}

// ---------- Remédio (dose dada) ----------

export function FormRemedio({ inicial, aoSalvar, rodape }: PropsForm<RegistroDe<'remedio'>>) {
  const { remedios, hoje } = useDados();
  // Em uso: ativo e dentro do prazo do tratamento
  const ativos = remedios.filter((m) => remedioEmUso(m, hoje));
  const [remedioId, setRemedioId] = useState<string | null>(inicial.dados.remedio_id);
  const [nome, setNome] = useState(inicial.dados.nome);
  const [dose, setDose] = useState(inicial.dados.dose ?? '');
  const [inicio, setInicio] = useState(paraCampoDataHora(inicial.inicio));
  const [obs, setObs] = useState(inicial.observacao ?? '');
  const [msg, setMsg] = useState<string | null>(null);

  function escolher(id: string | null) {
    setRemedioId(id);
    const m = remedios.find((x) => x.id === id);
    if (m) {
      setNome(m.nome);
      setDose(m.dose ?? '');
    }
  }

  return (
    <form
      className="pilha"
      onSubmit={(e) => {
        e.preventDefault();
        const ini = deCampoDataHora(inicio);
        if (!ini) return setMsg('Informe a hora.');
        const r: RegistroDe<'remedio'> = { ...inicial, inicio: ini, fim: ini, dados: { remedio_id: remedioId, nome: nome.trim(), dose: dose.trim() || null }, observacao: obs.trim() || null };
        const p = validarRegistro(r, new Date());
        if (p) return setMsg(p);
        aoSalvar(r);
      }}
    >
      {ativos.length > 0 && (
        <div className="chips" role="radiogroup" aria-label="Remédio em uso">
          {ativos.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={remedioId === m.id} className={`chip ${remedioId === m.id ? 'ativo' : ''}`} onClick={() => escolher(m.id)}>
              {m.nome}
            </button>
          ))}
          <button type="button" role="radio" aria-checked={remedioId === null} className={`chip ${remedioId === null ? 'ativo' : ''}`} onClick={() => escolher(null)}>
            Outro
          </button>
        </div>
      )}
      <Campo rotulo="Remédio">
        <input value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: vitamina D" autoCapitalize="sentences" />
      </Campo>
      <Campo rotulo="Dose (opcional)">
        <input value={dose} maxLength={120} onChange={(e) => setDose(e.target.value)} placeholder="Ex.: 2 gotas, 2,5 ml" />
      </Campo>
      <CampoHora valor={inicio} aoMudar={setInicio} />
      <Campo rotulo="Observação (opcional)">
        <textarea value={obs} maxLength={2000} onChange={(e) => setObs(e.target.value)} />
      </Campo>
      <Erro msg={msg} />
      <button className="botao primario">Salvar</button>
      {rodape}
    </form>
  );
}

// ---------- Temperatura ----------

export function FormTemperatura({ inicial, aoSalvar, rodape }: PropsForm<RegistroDe<'temperatura'>>) {
  const { bebe } = useDados();
  const [graus, setGraus] = useState(inicial.dados.graus ? String(inicial.dados.graus).replace('.', ',') : '');
  const [inicio, setInicio] = useState(paraCampoDataHora(inicial.inicio));
  const [obs, setObs] = useState(inicial.observacao ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const valor = numero(graus);
  const idadeDias = bebe?.nascimento ? diasEntre(chaveDia(bebe.nascimento), chaveDia(new Date())) : null;
  const avaliacao = valor >= 30 && valor <= 44 ? avaliarTemperatura(valor, idadeDias) : null;

  return (
    <form
      className="pilha"
      onSubmit={(e) => {
        e.preventDefault();
        const ini = deCampoDataHora(inicio);
        if (!ini) return setMsg('Informe a hora.');
        const r: RegistroDe<'temperatura'> = { ...inicial, inicio: ini, fim: ini, dados: { graus: Math.round(valor * 10) / 10 }, observacao: obs.trim() || null };
        const p = validarRegistro(r, new Date());
        if (p) return setMsg(p);
        aoSalvar(r);
      }}
    >
      <Campo rotulo="Temperatura (°C, na axila)">
        <input inputMode="decimal" value={graus} onChange={(e) => setGraus(e.target.value.replace(/[^\d,.]/g, '').slice(0, 4))} placeholder="36,8" />
      </Campo>
      {avaliacao && avaliacao.nivel !== 'normal' && (
        <div className={`alerta ${avaliacao.nivel === 'urgente' ? 'erro' : ''}`}>
          <Icone nome="alerta" />
          <span>
            {avaliacao.texto}{' '}
            <a href={FONTE_FEBRE.url} target="_blank" rel="noreferrer">
              Fonte
            </a>
          </span>
        </div>
      )}
      <CampoHora valor={inicio} aoMudar={setInicio} />
      <Campo rotulo="Observação (opcional)">
        <textarea value={obs} maxLength={2000} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: deu antitérmico, estava agitado" />
      </Campo>
      <Erro msg={msg} />
      <button className="botao primario">Salvar</button>
      {rodape}
    </form>
  );
}

// ---------- Extração de leite ----------

export function FormExtracao({ inicial, aoSalvar, rodape, novo }: PropsForm<RegistroDe<'extracao'>> & { novo?: boolean }) {
  const { membro, usuario, leite } = useDados();
  // O pote do estoque tem o mesmo id da extração (editar/excluir a extração mexe nele)
  const poteAtual = novo ? undefined : leite.find((p) => p.id === inicial.id);
  const [e, setE] = useState(inicial.dados.ml_e ? String(inicial.dados.ml_e) : '');
  const [d, setD] = useState(inicial.dados.ml_d ? String(inicial.dados.ml_d) : '');
  const [inicio, setInicio] = useState(paraCampoDataHora(inicial.inicio));
  const [guardar, setGuardar] = useState<'nao' | 'geladeira' | 'freezer'>('nao');
  const [msg, setMsg] = useState<string | null>(null);
  const total = (Number(e) || 0) + (Number(d) || 0);

  return (
    <form
      className="pilha"
      onSubmit={(ev) => {
        ev.preventDefault();
        const ini = deCampoDataHora(inicio);
        if (!ini) return setMsg('Informe a hora.');
        const r: RegistroDe<'extracao'> = { ...inicial, inicio: ini, fim: ini, dados: { ml_e: Number(e) || 0, ml_d: Number(d) || 0 } };
        const p = validarRegistro(r, new Date());
        if (p) return setMsg(p);
        if ((poteAtual || guardar !== 'nao') && total > 1000) return setMsg('Um pote do estoque vai até 1000 ml. Divida em dois registros ou escolha "Não" em guardar.');
        const pote: PoteLeite | undefined = poteAtual
          ? { ...poteAtual, ml: total, extraido_em: ini }
          : guardar !== 'nao' && membro
            ? {
                id: inicial.id,
                familia_id: membro.familia_id,
                criado_por: usuario?.id ?? null,
                extraido_em: ini,
                ml: total,
                local: guardar,
                usado_em: null,
                descartado_em: null,
                observacao: null,
              }
            : undefined;
        aoSalvar(r, { pote });
      }}
    >
      <div className="grade">
        <Campo rotulo="Peito esquerdo (ml)">
          <input inputMode="numeric" pattern="[0-9]*" value={e} onChange={(x) => setE(x.target.value.replace(/\D/g, '').slice(0, 3))} />
        </Campo>
        <Campo rotulo="Peito direito (ml)">
          <input inputMode="numeric" pattern="[0-9]*" value={d} onChange={(x) => setD(x.target.value.replace(/\D/g, '').slice(0, 3))} />
        </Campo>
      </div>
      {total > 0 && <p className="texto-2">Total: {total} ml</p>}
      <CampoHora valor={inicio} aoMudar={setInicio} />
      {poteAtual ? (
        <p className="mudo">Está no estoque ({poteAtual.local === 'freezer' ? 'freezer' : 'geladeira'}): ao salvar, o pote também muda.</p>
      ) : (
        <Campo rotulo="Guardar no estoque?" grupo dica="Validade: 12 horas na geladeira, 15 dias no freezer (Ministério da Saúde).">
          <Escolhas
            opcoes={[
              { valor: 'nao' as const, rotulo: 'Não' },
              { valor: 'geladeira' as const, rotulo: 'Geladeira' },
              { valor: 'freezer' as const, rotulo: 'Freezer' },
            ]}
            valor={guardar}
            aoMudar={setGuardar}
          />
        </Campo>
      )}
      <Erro msg={msg} />
      <button className="botao primario">Salvar</button>
      {rodape}
    </form>
  );
}

// ---------- Refeição (introdução alimentar) ----------

export function FormRefeicao({ inicial, aoSalvar, rodape }: PropsForm<RegistroDe<'refeicao'>>) {
  const { registros } = useDados();
  const [alimentos, setAlimentos] = useState<string[]>(inicial.dados.alimentos);
  const [novoAlimento, setNovoAlimento] = useState('');
  const [aceitacao, setAceitacao] = useState<Aceitacao>(inicial.dados.aceitacao);
  const [teveReacao, setTeveReacao] = useState(!!inicial.dados.reacao);
  const [reacao, setReacao] = useState(inicial.dados.reacao ?? '');
  const [inicio, setInicio] = useState(paraCampoDataHora(inicial.inicio));
  const [msg, setMsg] = useState<string | null>(null);
  // Sugestões: alimentos já oferecidos antes
  const ja = [...new Set(registros.flatMap((r) => (r.tipo === 'refeicao' ? r.dados.alimentos : [])))].filter((a) => !alimentos.includes(a)).slice(0, 12);

  function adicionar(nome: string) {
    const n = nome.trim();
    if (n && !alimentos.some((a) => a.toLocaleLowerCase('pt-BR') === n.toLocaleLowerCase('pt-BR'))) setAlimentos([...alimentos, n]);
    setNovoAlimento('');
  }

  return (
    <form
      className="pilha"
      onSubmit={(e) => {
        e.preventDefault();
        const ini = deCampoDataHora(inicio);
        if (!ini) return setMsg('Informe a hora.');
        const lista = novoAlimento.trim() ? [...alimentos, novoAlimento.trim()] : alimentos;
        const r: RegistroDe<'refeicao'> = { ...inicial, inicio: ini, fim: ini, dados: { alimentos: lista, aceitacao, reacao: teveReacao ? reacao.trim() || 'sim' : null } };
        const p = validarRegistro(r, new Date());
        if (p) return setMsg(p);
        aoSalvar(r);
      }}
    >
      <Campo rotulo="Alimentos">
        <div className="linha" style={{ flexWrap: 'nowrap' }}>
          <input
            className="cresce"
            value={novoAlimento}
            maxLength={60}
            onChange={(e) => setNovoAlimento(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                adicionar(novoAlimento);
              }
            }}
            placeholder="Ex.: abóbora"
            autoCapitalize="sentences"
          />
          <button type="button" className="botao pequeno" onClick={() => adicionar(novoAlimento)}>
            Incluir
          </button>
        </div>
      </Campo>
      {alimentos.length > 0 && (
        <div className="chips">
          {alimentos.map((a) => (
            <button key={a} type="button" className="chip ativo" onClick={() => setAlimentos(alimentos.filter((x) => x !== a))} aria-label={`Tirar ${a}`}>
              {a} <Icone nome="fechar" />
            </button>
          ))}
        </div>
      )}
      {ja.length > 0 && (
        <div className="pilha-p">
          <span className="rotulo">Já oferecidos</span>
          <div className="chips">
            {ja.map((a) => (
              <button key={a} type="button" className="chip" onClick={() => adicionar(a)}>
                + {a}
              </button>
            ))}
          </div>
        </div>
      )}
      <Campo rotulo="Como foi" grupo>
        <Escolhas
          opcoes={[
            { valor: 'bem' as Aceitacao, rotulo: 'Aceitou bem' },
            { valor: 'pouco' as Aceitacao, rotulo: 'Comeu pouco' },
            { valor: 'recusou' as Aceitacao, rotulo: 'Recusou' },
          ]}
          valor={aceitacao}
          aoMudar={setAceitacao}
        />
      </Campo>
      <label className="marcar">
        <input type="checkbox" checked={teveReacao} onChange={(e) => setTeveReacao(e.target.checked)} />
        <span>Teve alguma reação (manchas, vômito, inchaço, diarreia)</span>
      </label>
      {teveReacao && (
        <>
          <Campo rotulo="O que aconteceu">
            <textarea value={reacao} maxLength={500} onChange={(e) => setReacao(e.target.value)} />
          </Campo>
          <div className="alerta erro">
            <Icone nome="alerta" />
            <span>Mostre ao pediatra. Falta de ar, inchaço no rosto ou na boca ou muitos vômitos: procure atendimento na hora.</span>
          </div>
        </>
      )}
      <CampoHora valor={inicio} aoMudar={setInicio} />
      <Erro msg={msg} />
      <button className="botao primario">Salvar</button>
      {rodape}
    </form>
  );
}

// ---------- Folhas de registro novo ----------

type TipoMais = 'remedio' | 'temperatura' | 'extracao' | 'refeicao';

const TITULOS: Record<TipoMais, string> = { remedio: 'Remédio', temperatura: 'Temperatura', extracao: 'Extração de leite', refeicao: 'Refeição' };
const SALVO: Record<TipoMais, string> = { remedio: 'Remédio registrado', temperatura: 'Temperatura registrada', extracao: 'Extração registrada', refeicao: 'Refeição registrada' };

export function novoRegistroMais(tipo: TipoMais, base: Pick<Registro, 'id' | 'familia_id' | 'bebe_id' | 'criado_por'>, remedioId?: string): Registro {
  const agora = agoraIso();
  const comum = { ...base, inicio: agora, fim: agora, observacao: null };
  if (tipo === 'remedio') return { ...comum, tipo, dados: { remedio_id: remedioId ?? null, nome: '', dose: null } };
  if (tipo === 'temperatura') return { ...comum, tipo, dados: { graus: 0 } };
  if (tipo === 'extracao') return { ...comum, tipo, dados: { ml_e: 0, ml_d: 0 } };
  return { ...comum, tipo, dados: { alimentos: [], aceitacao: 'bem', reacao: null } };
}

export function FolhaRegistroMais({ tipo, aoFechar, remedioId }: { tipo: TipoMais; aoFechar: () => void; remedioId?: string }) {
  const { baseRegistro, gravar, mostrarAviso, remedios, hoje } = useDados();
  const [inicial] = useState(() => {
    const r = novoRegistroMais(tipo, baseRegistro(), remedioId);
    // Sem remédio escolhido e um só em uso: ele já vem marcado
    const emUso = remedios.filter((x) => remedioEmUso(x, hoje));
    const m = remedios.find((x) => x.id === remedioId) ?? (!remedioId && emUso.length === 1 ? emUso[0] : undefined);
    if (r.tipo === 'remedio' && m) r.dados = { remedio_id: m.id, nome: m.nome, dose: m.dose };
    return r;
  });
  const salvar = (r: Registro, extra?: { pote?: PoteLeite }) => {
    const ops = [{ tipo: 'registro' as const, dado: r }, ...(extra?.pote ? [{ tipo: 'colecao' as const, colecao: 'leite' as const, dado: extra.pote }] : [])];
    gravar(...ops);
    mostrarAviso({
      texto: SALVO[tipo],
      desfazer: () =>
        gravar(
          { tipo: 'excluir', dado: { alvo: 'registro', id: r.id } },
          ...(extra?.pote ? [{ tipo: 'excluir' as const, dado: { alvo: 'leite' as const, id: extra.pote.id } }] : []),
        ),
    });
    aoFechar();
  };
  return (
    <Folha titulo={TITULOS[tipo]} aoFechar={aoFechar}>
      {inicial.tipo === 'remedio' && <FormRemedio inicial={inicial} aoSalvar={salvar} />}
      {inicial.tipo === 'temperatura' && <FormTemperatura inicial={inicial} aoSalvar={salvar} />}
      {inicial.tipo === 'extracao' && <FormExtracao inicial={inicial} aoSalvar={salvar} novo />}
      {inicial.tipo === 'refeicao' && <FormRefeicao inicial={inicial} aoSalvar={salvar} />}
    </Folha>
  );
}
