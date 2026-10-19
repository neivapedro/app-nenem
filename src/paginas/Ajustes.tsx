import { useEffect, useState } from 'react';
import { FolhaBebe } from '../componentes/bebe';
import { CartaoCalendario } from '../componentes/calendario';
import { Campo, Icone } from '../componentes/ui';
import { SITE_URL } from '../config';
import { useAgora, useDados } from '../dados/contexto';
import { chaveDia, dataBr, horaCurta, idadeBebe } from '../lib/datas';
import { ehErroDeRede, traduzirErro } from '../lib/erros';
import {
  ativarNotificacoes,
  desativarNotificacoes,
  ehIOS,
  estadoNotificacao,
  instaladoComoApp,
  notificacaoTeste,
  type EstadoNotificacao,
} from '../lib/notificacoes';
import type { Convite, Membro, PreferenciasMembro } from '../lib/tipos';

function preferencias(m: Membro): PreferenciasMembro {
  return {
    nome: m.nome,
    lembrete_mamada: m.lembrete_mamada,
    lembrete_mamada_min: m.lembrete_mamada_min,
    lembrete_agenda: m.lembrete_agenda,
    lembrete_remedio: m.lembrete_remedio,
    lembrete_vacina: m.lembrete_vacina,
  };
}

const TEXTO_ESTADO: Record<EstadoNotificacao, string> = {
  'sem-suporte': 'Este navegador não suporta avisos.',
  'ios-instalar': 'No iPhone, os avisos só funcionam com o app instalado: no Safari, toque em Compartilhar → "Adicionar à Tela de Início", abra pelo ícone e volte aqui.',
  negado: 'Os avisos foram bloqueados. Libere em Ajustes do iPhone → Notificações → Heitor.',
  pendente: 'Avisos ainda não ativados neste aparelho.',
  ativo: 'Avisos ativos neste aparelho.',
  'ativo-sem-servidor': 'Permissão concedida, mas o envio automático exige a nuvem configurada.',
};

const INTERVALOS = [90, 120, 150, 180, 210, 240];
const textoIntervalo = (m: number) => (m % 60 ? `${Math.floor(m / 60)}h${m % 60}` : `${m / 60}h`);

function CartaoBebe() {
  const { bebe } = useDados();
  const agora = useAgora(60_000);
  const [editar, setEditar] = useState(false);
  if (!bebe) return null;
  return (
    <section className="cartao pilha" aria-label="Bebê">
      <div className="cartao-cab" style={{ marginBottom: 0 }}>
        <div className="linha">
          <Icone nome="bebe" />
          <h2>{bebe.nome || 'Bebê'}</h2>
        </div>
        <button className="botao pequeno" onClick={() => setEditar(true)}>
          Editar
        </button>
      </div>
      {bebe.nascimento ? (
        <div className="pilha-p">
          <p>{idadeBebe(bebe.nascimento, agora)}</p>
          <p className="texto-2">
            Nascimento: {dataBr(chaveDia(bebe.nascimento))} às {horaCurta(bebe.nascimento)}
          </p>
          {(bebe.peso_nascer_g || bebe.altura_nascer_cm || bebe.pc_nascer_cm) && (
            <p className="texto-2">
              Ao nascer:{' '}
              {[
                bebe.peso_nascer_g && `${bebe.peso_nascer_g.toLocaleString('pt-BR')} g`,
                bebe.altura_nascer_cm && `${String(bebe.altura_nascer_cm).replace('.', ',')} cm`,
                bebe.pc_nascer_cm && `cabeça ${String(bebe.pc_nascer_cm).replace('.', ',')} cm`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
      ) : (
        <p className="texto-2">{bebe.data_prevista ? `Previsão de chegada: ${dataBr(bebe.data_prevista)}` : 'Data prevista não informada.'}</p>
      )}
      {editar && <FolhaBebe aoFechar={() => setEditar(false)} />}
    </section>
  );
}

function CartaoFamilia() {
  const { membros, usuario, repo } = useDados();
  const [convite, setConvite] = useState<Convite | null>(null);
  const [gerando, setGerando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function convidar() {
    setGerando(true);
    setMsg(null);
    try {
      setConvite(await repo.criarConvite());
    } catch (e) {
      setMsg(traduzirErro(e));
    } finally {
      setGerando(false);
    }
  }

  const texto = convite
    ? `Entre no app do bebê: abra ${SITE_URL} no Safari do iPhone, crie sua conta (ou entre) e escolha "Tenho um código de convite". Código: ${convite.codigo}`
    : '';

  return (
    <section className="cartao pilha" aria-label="Família">
      <div className="linha">
        <Icone nome="pessoas" />
        <h2>Família</h2>
      </div>
      <div className="lista">
        {membros.map((m) => (
          <div key={m.user_id} className="item" style={{ cursor: 'default' }}>
            <div className="cresce">
              <div className="titulo">{m.nome || 'Sem nome'}</div>
              {m.user_id === usuario?.id && <div className="detalhe">você · {usuario.email}</div>}
            </div>
          </div>
        ))}
      </div>
      {membros.length < 2 && <p className="mudo">Convide o outro responsável: tudo o que um registrar aparece na hora para o outro.</p>}
      {!convite ? (
        <button className="botao" disabled={gerando} onClick={() => void convidar()}>
          {gerando ? 'Gerando…' : membros.length < 2 ? 'Convidar o outro responsável' : 'Convidar mais alguém'}
        </button>
      ) : (
        <div className="pilha-p">
          <div className="codigo" aria-label={`Código ${convite.codigo.split('').join(' ')}`}>
            {convite.codigo}
          </div>
          <p className="mudo" style={{ textAlign: 'center' }}>
            Vale até {new Date(convite.expira_em).toLocaleDateString('pt-BR')} e só pode ser usado uma vez.
          </p>
          <button
            className="botao primario"
            onClick={() => {
              if (navigator.share) navigator.share({ text: texto }).catch(() => undefined);
              else navigator.clipboard.writeText(texto).then(() => setMsg('Convite copiado.')).catch(() => setMsg(texto));
            }}
          >
            <Icone nome="compartilhar" /> Enviar convite
          </button>
        </div>
      )}
      {msg && <div className="alerta info">{msg}</div>}
      {repo.modo === 'local' && <div className="alerta info">Modo demonstração: o convite não funciona sem a nuvem.</div>}
    </section>
  );
}

function CartaoAvisos() {
  const { repo, membro, executar } = useDados();
  const [estado, setEstado] = useState<EstadoNotificacao | null>(null);
  const [msg, setMsg] = useState<{ tipo: string; texto: string } | null>(null);

  useEffect(() => {
    estadoNotificacao().then(setEstado).catch(() => setEstado('sem-suporte'));
  }, []);

  async function ativar() {
    setMsg(null);
    try {
      setEstado(await ativarNotificacoes(repo));
    } catch (e) {
      setMsg({ tipo: 'erro', texto: ehErroDeRede(e) ? traduzirErro(e) : `Não foi possível ativar: ${traduzirErro(e)}` });
    }
  }

  async function desativar() {
    setMsg(null);
    try {
      const noServidor = await desativarNotificacoes(repo);
      if (!noServidor) setMsg({ tipo: 'info', texto: 'Avisos desativados neste aparelho.' });
    } catch (e) {
      setMsg({ tipo: 'erro', texto: traduzirErro(e) });
    }
    setEstado(await estadoNotificacao().catch(() => 'sem-suporte' as const));
  }

  function mudar(p: Partial<PreferenciasMembro>) {
    if (!membro) return;
    void executar((r) => r.salvarPreferencias({ ...preferencias(membro), ...p }));
  }

  return (
    <section className="cartao pilha" aria-label="Avisos">
      <div className="linha">
        <Icone nome="sino" />
        <h2>Avisos neste iPhone</h2>
      </div>
      {estado && <div className={`alerta ${estado === 'ativo' ? 'info' : ''}`}>{TEXTO_ESTADO[estado]}</div>}
      <div className="linha">
        {(estado === 'pendente' || estado === 'ativo-sem-servidor') && (
          <button className="botao primario" onClick={() => void ativar()}>
            Ativar avisos
          </button>
        )}
        {(estado === 'ativo' || estado === 'ativo-sem-servidor') && (
          <button className="botao" onClick={() => notificacaoTeste().catch((e) => setMsg({ tipo: 'erro', texto: traduzirErro(e) }))}>
            Enviar teste
          </button>
        )}
        {estado === 'ativo' && (
          <button className="botao perigo" onClick={() => void desativar()}>
            Desativar
          </button>
        )}
      </div>
      {msg && <div className={`alerta ${msg.tipo}`}>{msg.texto}</div>}
      {membro && (
        <div className="pilha" style={{ marginTop: 4 }}>
          <label className="marcar">
            <input type="checkbox" checked={membro.lembrete_mamada} onChange={(e) => mudar({ lembrete_mamada: e.target.checked })} />
            <span>
              Avisar quando passar muito tempo desde a última mamada
              <small className="texto-2" style={{ display: 'block' }}>
                Conta a partir do início da última mamada ou mamadeira. Não avisa com mamada em andamento.
              </small>
            </span>
          </label>
          {membro.lembrete_mamada && (
            <Campo rotulo="Avisar depois de">
              <select value={membro.lembrete_mamada_min} onChange={(e) => mudar({ lembrete_mamada_min: Number(e.target.value) })}>
                {[...new Set([...INTERVALOS, membro.lembrete_mamada_min])]
                  .sort((a, b) => a - b)
                  .map((m) => (
                    <option key={m} value={m}>
                      {textoIntervalo(m)}
                    </option>
                  ))}
              </select>
            </Campo>
          )}
          <label className="marcar">
            <input type="checkbox" checked={membro.lembrete_agenda} onChange={(e) => mudar({ lembrete_agenda: e.target.checked })} />
            <span>Avisar dos compromissos da agenda e dos prazos dos primeiros dias</span>
          </label>
          <label className="marcar">
            <input type="checkbox" checked={membro.lembrete_vacina} onChange={(e) => mudar({ lembrete_vacina: e.target.checked })} />
            <span>
              Avisar das vacinas
              <small className="texto-2" style={{ display: 'block' }}>
                Na véspera, às 8h, e se alguma dose atrasar.
              </small>
            </span>
          </label>
          <label className="marcar">
            <input type="checkbox" checked={membro.lembrete_remedio} onChange={(e) => mudar({ lembrete_remedio: e.target.checked })} />
            <span>
              Avisar a hora do próximo remédio
              <small className="texto-2" style={{ display: 'block' }}>
                Para remédios com intervalo definido (ex.: de 8 em 8 horas).
              </small>
            </span>
          </label>
          <p className="mudo">Cada responsável escolhe os próprios avisos. Eles chegam em até 5 minutos depois do horário.</p>
        </div>
      )}
    </section>
  );
}

function CartaoConta() {
  const { usuario, membro, executar, sair } = useDados();
  const [nome, setNome] = useState(membro?.nome ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section className="cartao pilha" aria-label="Sua conta">
      <h2>Sua conta</h2>
      <p className="mudo">{usuario?.email}</p>
      <form
        className="linha"
        style={{ alignItems: 'flex-end', flexWrap: 'nowrap' }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!membro || !nome.trim()) return;
          void executar((r) => r.salvarPreferencias({ ...preferencias(membro), nome: nome.trim() })).then((ok) => ok && setMsg('Nome salvo.'));
        }}
      >
        <div className="cresce">
          <Campo rotulo="Seu nome (aparece nos registros)">
            <input value={nome} maxLength={60} onChange={(e) => setNome(e.target.value)} autoCapitalize="words" />
          </Campo>
        </div>
        <button className="botao">Salvar</button>
      </form>
      {msg && <div className="alerta info">{msg}</div>}
      <button className="botao perigo" onClick={() => confirm('Sair da conta neste aparelho?') && void sair()}>
        Sair
      </button>
    </section>
  );
}

export function Ajustes() {
  return (
    <div className="pilha">
      {ehIOS() && !instaladoComoApp() && (
        <div className="alerta">
          <span>
            Para usar como app (e receber avisos): no Safari, toque em <b>Compartilhar</b> → <b>Adicionar à Tela de Início</b> e abra pelo ícone.
          </span>
        </div>
      )}
      <CartaoBebe />
      <CartaoFamilia />
      <CartaoAvisos />
      <CartaoCalendario />
      <CartaoConta />
      <p className="mudo" style={{ textAlign: 'center' }}>
        Heitor · versão {__VERSAO_APP__}
      </p>
    </div>
  );
}
