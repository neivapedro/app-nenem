import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Campo, Escolhas, Folha, Icone, Selo } from '../componentes/ui';
import { useAgora, useDados } from '../dados/contexto';
import {
  compromissoJaPassou,
  compromissosAnteriores,
  compromissoVazio,
  datasRepetidas,
  EMOJI_TIPO,
  itensAutomaticos,
  NOMES_COMPROMISSO,
  OPCOES_AVISO,
  OPCOES_REPETICAO,
  proximosCompromissos,
  serieCompromissos,
  textoAviso,
  textoDiaAutomatico,
  textoQuando,
  validarCompromisso,
  VEZES_MAX,
  VEZES_MIN,
  VEZES_PADRAO,
  type ItemAutomatico,
  type Repeticao,
} from '../lib/agenda';
import { dataBr } from '../lib/datas';
import type { Compromisso, TipoCompromisso } from '../lib/tipos';

const DURACOES = [15, 30, 45, 60, 90, 120, 180];

function FolhaCompromisso({ inicial, novo, aoFechar }: { inicial: Compromisso; novo: boolean; aoFechar: () => void }) {
  const { gravar, mostrarAviso, nomeDe } = useDados();
  const [c, setC] = useState<Compromisso>(inicial);
  const [msg, setMsg] = useState<string | null>(null);
  const [repeticao, setRepeticao] = useState<Repeticao>('nao');
  const [vezes, setVezes] = useState(VEZES_PADRAO.mes);
  const mudar = (p: Partial<Compromisso>) => setC((x) => ({ ...x, ...p }));
  const datasSerie = novo && repeticao !== 'nao' && /^\d{4}-\d{2}-\d{2}$/.test(c.data) ? datasRepetidas(c.data, repeticao, vezes) : null;

  function salvar() {
    const final = { ...c, titulo: c.titulo.trim(), local: c.local?.trim() || null, observacao: c.observacao?.trim() || null };
    const problema = validarCompromisso(final);
    if (problema) return setMsg(problema);
    if (novo && compromissoJaPassou(final, new Date()) && !confirm('Essa data/hora já passou. Salvar mesmo assim?')) return;
    if (novo && repeticao !== 'nao') {
      const serie = serieCompromissos(final, repeticao, vezes);
      gravar(...serie.map((x) => ({ tipo: 'compromisso' as const, dado: x })));
      mostrarAviso({
        texto: `${serie.length} compromissos salvos na agenda`,
        desfazer: () => gravar(...serie.map((x) => ({ tipo: 'excluir' as const, dado: { alvo: 'compromisso' as const, id: x.id } }))),
      });
      return aoFechar();
    }
    gravar({ tipo: 'compromisso', dado: final });
    mostrarAviso(
      novo
        ? { texto: 'Compromisso salvo na agenda', desfazer: () => gravar({ tipo: 'excluir', dado: { alvo: 'compromisso', id: final.id } }) }
        : { texto: 'Compromisso atualizado', desfazer: () => gravar({ tipo: 'compromisso', dado: inicial }) },
    );
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
        {novo && (
          <>
            <div className="grade">
              <Campo rotulo="Repetir">
                <select
                  value={repeticao}
                  onChange={(e) => {
                    const r = e.target.value as Repeticao;
                    setRepeticao(r);
                    if (r !== 'nao') setVezes(VEZES_PADRAO[r]);
                  }}
                >
                  {OPCOES_REPETICAO.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </option>
                  ))}
                </select>
              </Campo>
              {repeticao !== 'nao' && (
                <Campo rotulo="Quantas vezes">
                  <select value={vezes} onChange={(e) => setVezes(Number(e.target.value))}>
                    {Array.from({ length: VEZES_MAX - VEZES_MIN + 1 }, (_, i) => VEZES_MIN + i).map((n) => (
                      <option key={n} value={n}>
                        {n} vezes
                      </option>
                    ))}
                  </select>
                </Campo>
              )}
            </div>
            {datasSerie && (
              <p className="mudo" style={{ margin: 0 }}>
                São criados {datasSerie.length} compromissos separados: {datasSerie.map((d) => dataBr(d).slice(0, 5)).join(', ')}. Depois, cada um é editado ou excluído
                sozinho.
              </p>
            )}
          </>
        )}
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
        <button className="botao primario">{datasSerie ? `Salvar ${datasSerie.length} compromissos` : 'Salvar'}</button>
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

const CHAVE_AUTOMATICOS = 'app-nenem:agenda-automaticos';

/** Vacina prevista ou mesversário: calculado pelo app, não dá para editar */
function ItemAuto({ i, previa }: { i: ItemAutomatico; previa: boolean }) {
  const { hoje } = useDados();
  const quando = i.tipo === 'vacina' && i.situacao !== 'proxima' ? `indicada desde ${dataBr(i.data).slice(0, 5)}` : textoDiaAutomatico(i.data, hoje);
  const conteudo = (
    <>
      <span className="selo t-saude" style={{ background: 'transparent', border: '1.5px dashed color-mix(in srgb, var(--cor) 60%, transparent)' }}>
        <Icone nome={i.tipo === 'vacina' ? 'vacina' : 'bebe'} />
      </span>
      <div className="cresce">
        <div className="titulo">{i.titulo}</div>
        {i.tipo === 'vacina' && <div className="detalhe">{i.detalhe}</div>}
        <div className="detalhe">
          {quando} · automático{previa && i.tipo === 'vacina' ? ' (prévia pela data prevista do parto)' : ''}
        </div>
      </div>
      {i.situacao === 'atrasada' && <span className="etiqueta ruim">Atrasada</span>}
      {i.situacao === 'agora' && <span className="etiqueta aviso">Já pode tomar</span>}
    </>
  );
  return i.tipo === 'vacina' ? (
    <Link to="/saude?aba=vacinas" className="item" style={{ textDecoration: 'none', color: 'inherit' }} aria-label={`${i.titulo}: ${i.detalhe}. Abrir vacinas`}>
      {conteudo}
    </Link>
  ) : (
    <div className="item" style={{ cursor: 'default' }}>
      {conteudo}
    </div>
  );
}

export function Agenda() {
  const { compromissos, membro, usuario, bebe, vacinas, hoje } = useDados();
  const agora = useAgora(60_000);
  const [aberto, setAberto] = useState<{ c: Compromisso; novo: boolean } | null>(null);
  const [verAnteriores, setVerAnteriores] = useState(false);
  const [verAutomaticos, setVerAutomaticos] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_AUTOMATICOS) !== '0';
    } catch {
      return true;
    }
  });
  const proximos = proximosCompromissos(compromissos, agora);
  const anteriores = compromissosAnteriores(compromissos, agora);
  const automaticos = useMemo(() => itensAutomaticos(bebe, vacinas, hoje), [bebe, vacinas, hoje]);
  // Compromissos e itens automáticos juntos, por data (os automáticos são de dia inteiro: vêm antes no mesmo dia)
  const lista: ({ c: Compromisso } | { i: ItemAutomatico })[] = [
    ...proximos.map((c) => ({ c, chave: `${c.data}${c.hora ?? '00:00'}1` })),
    ...(verAutomaticos ? automaticos : []).map((i) => ({ i, chave: `${i.data}00:000` })),
  ].sort((a, b) => a.chave.localeCompare(b.chave));
  const previa = !bebe?.nascimento;

  function mudarAutomaticos(v: boolean) {
    setVerAutomaticos(v);
    try {
      localStorage.setItem(CHAVE_AUTOMATICOS, v ? '1' : '0');
    } catch {
      /* nada */
    }
  }

  return (
    <div className="pilha">
      <button className="botao primario" onClick={() => membro && setAberto({ c: compromissoVazio(membro.familia_id, usuario?.id ?? null), novo: true })}>
        <Icone nome="mais" /> Novo compromisso
      </button>

      <section className="cartao" aria-label="Próximos compromissos">
        <h2>Próximos</h2>
        {lista.length ? (
          <div className="lista">
            {lista.map((x) =>
              'c' in x ? (
                <ItemCompromisso key={x.c.id} c={x.c} aoAbrir={() => setAberto({ c: x.c, novo: false })} />
              ) : (
                <ItemAuto key={x.i.chave} i={x.i} previa={previa} />
              ),
            )}
          </div>
        ) : (
          <p className="mudo">Nada marcado. Consultas, exames e vacinas que vocês marcarem aqui aparecem no Calendário do iPhone dos dois.</p>
        )}
        {automaticos.length > 0 && (
          <label className="marcar" style={{ marginTop: 8 }}>
            <input type="checkbox" checked={verAutomaticos} onChange={(e) => mudarAutomaticos(e.target.checked)} />
            <span>
              Mostrar vacinas previstas e mesversários <span className="mudo">({automaticos.length})</span>
            </span>
          </label>
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
