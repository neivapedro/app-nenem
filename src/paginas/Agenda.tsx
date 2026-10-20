import { useState } from 'react';
import { Campo, Escolhas, Folha, Icone, Selo } from '../componentes/ui';
import { useAgora, useDados } from '../dados/contexto';
import {
  compromissoJaPassou,
  compromissosAnteriores,
  compromissoVazio,
  EMOJI_TIPO,
  NOMES_COMPROMISSO,
  OPCOES_AVISO,
  proximosCompromissos,
  textoAviso,
  textoQuando,
  validarCompromisso,
} from '../lib/agenda';
import type { Compromisso, TipoCompromisso } from '../lib/tipos';

const DURACOES = [15, 30, 45, 60, 90, 120, 180];

function FolhaCompromisso({ inicial, novo, aoFechar }: { inicial: Compromisso; novo: boolean; aoFechar: () => void }) {
  const { gravar, mostrarAviso, nomeDe } = useDados();
  const [c, setC] = useState<Compromisso>(inicial);
  const [msg, setMsg] = useState<string | null>(null);
  const mudar = (p: Partial<Compromisso>) => setC((x) => ({ ...x, ...p }));

  function salvar() {
    const final = { ...c, titulo: c.titulo.trim(), local: c.local?.trim() || null, observacao: c.observacao?.trim() || null };
    const problema = validarCompromisso(final);
    if (problema) return setMsg(problema);
    if (novo && compromissoJaPassou(final, new Date()) && !confirm('Essa data/hora já passou. Salvar mesmo assim?')) return;
    gravar({ tipo: 'compromisso', dado: final });
    mostrarAviso({ texto: novo ? 'Compromisso salvo na agenda' : 'Compromisso atualizado' });
    aoFechar();
  }

  function excluir() {
    if (!confirm(`Excluir "${inicial.titulo}" da agenda?`)) return;
    gravar({ tipo: 'excluir', dado: { alvo: 'compromisso', id: inicial.id } });
    mostrarAviso({ texto: 'Compromisso excluído', desfazer: () => gravar({ tipo: 'compromisso', dado: inicial }) });
    aoFechar();
  }

  return (
    <Folha titulo={novo ? 'Novo compromisso' : 'Compromisso'} aoFechar={aoFechar}>
      <form
        className="pilha"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <Campo rotulo="Tipo" grupo>
          <Escolhas
            opcoes={(Object.keys(NOMES_COMPROMISSO) as TipoCompromisso[]).map((t) => ({ valor: t, rotulo: `${EMOJI_TIPO[t]} ${NOMES_COMPROMISSO[t]}` }))}
            valor={c.tipo}
            aoMudar={(tipo) => mudar({ tipo })}
          />
        </Campo>
        <Campo rotulo="O quê">
          <input value={c.titulo} maxLength={200} onChange={(e) => mudar({ titulo: e.target.value })} placeholder="Ex.: Pediatra – consulta de 1 mês" autoCapitalize="sentences" />
        </Campo>
        <div className="grade">
          <Campo rotulo="Data">
            <input type="date" value={c.data} onChange={(e) => mudar({ data: e.target.value })} required />
          </Campo>
          <Campo rotulo="Hora">
            <input type="time" value={c.hora ?? ''} disabled={c.hora === null} onChange={(e) => mudar({ hora: e.target.value || '09:00' })} />
          </Campo>
        </div>
        <label className="marcar">
          <input type="checkbox" checked={c.hora === null} onChange={(e) => mudar({ hora: e.target.checked ? null : '09:00' })} />
          <span>Dia inteiro (sem hora marcada)</span>
        </label>
        {c.hora !== null && (
          <Campo rotulo="Duração">
            <select value={c.duracao_min} onChange={(e) => mudar({ duracao_min: Number(e.target.value) })}>
              {[...new Set([...DURACOES, c.duracao_min])]
                .sort((a, b) => a - b)
                .map((d) => (
                  <option key={d} value={d}>
                    {d < 60 ? `${d} min` : d % 60 ? `${Math.floor(d / 60)}h${d % 60}` : `${d / 60}h`}
                  </option>
                ))}
            </select>
          </Campo>
        )}
        <Campo rotulo="Aviso" dica="Aparece no Calendário do iPhone e como aviso do app (se os avisos estiverem ligados em Ajustes).">
          <select value={c.avisar_min === null ? '' : String(c.avisar_min)} onChange={(e) => mudar({ avisar_min: e.target.value === '' ? null : Number(e.target.value) })}>
            {OPCOES_AVISO.map((o) => (
              <option key={String(o.valor)} value={o.valor === null ? '' : String(o.valor)}>
                {(c.hora === null && o.diaInteiro) || o.rotulo}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Local (opcional)">
          <input value={c.local ?? ''} maxLength={300} onChange={(e) => mudar({ local: e.target.value })} placeholder="Clínica, UBS, endereço" />
        </Campo>
        <Campo rotulo="Observação (opcional)">
          <textarea value={c.observacao ?? ''} maxLength={2000} onChange={(e) => mudar({ observacao: e.target.value })} placeholder="Levar a caderneta, dúvidas para o pediatra…" />
        </Campo>
        {msg && (
          <div className="alerta erro" role="alert">
            {msg}
          </div>
        )}
        <button className="botao primario">Salvar</button>
        {!novo && (
          <>
            {inicial.criado_por && <p className="mudo">Marcado por {nomeDe(inicial.criado_por)}</p>}
            <button type="button" className="botao perigo" onClick={excluir}>
              <Icone nome="lixeira" /> Excluir
            </button>
          </>
        )}
      </form>
    </Folha>
  );
}

function ItemCompromisso({ c, aoAbrir }: { c: Compromisso; aoAbrir: () => void }) {
  const { hoje } = useDados();
  return (
    <button className="item t-agenda" onClick={aoAbrir}>
      <Selo tipo="agenda" />
      <div className="cresce">
        <div className="titulo">
          {EMOJI_TIPO[c.tipo]} {c.titulo}
        </div>
        <div className="detalhe">
          {textoQuando(c, hoje)}
          {c.local ? ` · ${c.local}` : ''}
        </div>
        <div className="detalhe">{textoAviso(c)}</div>
      </div>
    </button>
  );
}

export function Agenda() {
  const { compromissos, membro, usuario } = useDados();
  const agora = useAgora(60_000);
  const [aberto, setAberto] = useState<{ c: Compromisso; novo: boolean } | null>(null);
  const [verAnteriores, setVerAnteriores] = useState(false);
  const proximos = proximosCompromissos(compromissos, agora);
  const anteriores = compromissosAnteriores(compromissos, agora);

  return (
    <div className="pilha">
      <button className="botao primario" onClick={() => membro && setAberto({ c: compromissoVazio(membro.familia_id, usuario?.id ?? null), novo: true })}>
        <Icone nome="mais" /> Novo compromisso
      </button>

      <section className="cartao" aria-label="Próximos compromissos">
        <h2>Próximos</h2>
        {proximos.length ? (
          <div className="lista">
            {proximos.map((c) => (
              <ItemCompromisso key={c.id} c={c} aoAbrir={() => setAberto({ c, novo: false })} />
            ))}
          </div>
        ) : (
          <p className="mudo">Nada marcado. Consultas, exames e vacinas que vocês marcarem aqui aparecem no Calendário do iPhone dos dois.</p>
        )}
      </section>


      {anteriores.length > 0 && (
        <section className="cartao" aria-label="Compromissos anteriores">
          <div className="cartao-cab" style={{ marginBottom: verAnteriores ? 12 : 0 }}>
            <h2>Anteriores</h2>
            <button className="botao pequeno" onClick={() => setVerAnteriores(!verAnteriores)}>
              {verAnteriores ? 'Esconder' : `Ver (${anteriores.length})`}
            </button>
          </div>
          {verAnteriores && (
            <div className="lista">
              {anteriores.map((c) => (
                <ItemCompromisso key={c.id} c={c} aoAbrir={() => setAberto({ c, novo: false })} />
              ))}
            </div>
          )}
        </section>
      )}

      {aberto && <FolhaCompromisso inicial={aberto.c} novo={aberto.novo} aoFechar={() => setAberto(null)} />}
    </div>
  );
}
