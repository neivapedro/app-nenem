import { useEffect, useRef, useState } from 'react';
import { somarMeses } from '../../supabase/functions/_shared/tempo.ts';
import { useDados } from '../dados/contexto';
import { FONTE_MARCOS, MARCOS_CADERNETA, ORIENTACAO_MARCOS } from '../lib/conteudo';
import { chaveDia, dataBr, hojeLocal } from '../lib/datas';
import { traduzirErro } from '../lib/erros';
import { idFixo } from '../lib/ids';
import { reduzirFoto } from '../lib/imagem';
import type { Marco } from '../lib/tipos';
import { Campo, Folha, Icone } from './ui';

/** Mostra uma foto guardada (endereço temporário pedido ao servidor) */
export function Foto({ caminho, classe, alt = '' }: { caminho: string; classe?: string; alt?: string }) {
  const { repo } = useDados();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    repo
      .urlFoto(caminho)
      .then((u) => vivo && setUrl(u))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [repo, caminho]);
  return url ? <img className={classe} src={url} alt={alt} loading="lazy" /> : <span className="mudo">carregando…</span>;
}

/** Escolher foto (câmera ou galeria): reduz e envia na hora (precisa de internet) */
function useEnviarFoto() {
  const { repo, setErro } = useDados();
  const [enviando, setEnviando] = useState(false);
  const enviar = async (arquivo: File | undefined): Promise<string | null> => {
    if (!arquivo) return null;
    setEnviando(true);
    try {
      return await repo.enviarFoto(await reduzirFoto(arquivo));
    } catch (e) {
      setErro(`A foto não foi enviada: ${traduzirErro(e)}`);
      return null;
    } finally {
      setEnviando(false);
    }
  };
  return { enviar, enviando };
}

function CampoFoto({ foto, aoMudar }: { foto: string | null; aoMudar: (caminho: string | null) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const { enviar, enviando } = useEnviarFoto();
  return (
    <div className="pilha-p">
      {foto && <Foto caminho={foto} classe="foto-grande" />}
      <div className="linha">
        <button type="button" className="botao pequeno" disabled={enviando} onClick={() => entrada.current?.click()}>
          <Icone nome="camera" /> {enviando ? 'Enviando…' : foto ? 'Trocar foto' : 'Adicionar foto'}
        </button>
        {foto && (
          <button type="button" className="botao pequeno texto" onClick={() => aoMudar(null)}>
            Tirar a foto
          </button>
        )}
      </div>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const c = await enviar(e.target.files?.[0]);
          e.target.value = '';
          if (c) aoMudar(c);
        }}
      />
    </div>
  );
}

function FolhaMarco({ inicial, novo, titulo, aoFechar }: { inicial: Marco; novo: boolean; titulo: string; aoFechar: () => void }) {
  const { gravar, mostrarAviso, nomeDe, repo } = useDados();
  const [m, setM] = useState<Marco>(inicial);
  const [msg, setMsg] = useState<string | null>(null);
  const livre = inicial.tipo === 'primeira-vez';
  // A foto apagada sai do armazenamento na hora: aí não dá para desfazer
  const apagarFoto = (caminho: string | null) => {
    if (caminho) void repo.excluirFoto(caminho).catch(() => undefined);
  };
  return (
    <Folha titulo={titulo} aoFechar={aoFechar}>
      <form
        className="pilha"
        onSubmit={(e) => {
          e.preventDefault();
          if (livre && !m.titulo?.trim()) return setMsg('Escreva o que aconteceu (ex.: primeiro sorriso).');
          const final = { ...m, titulo: m.titulo?.trim() || null, observacao: m.observacao?.trim() || null };
          gravar({ tipo: 'colecao', colecao: 'marcos', dado: final });
          const trocouFoto = !novo && !!inicial.foto && inicial.foto !== final.foto;
          if (trocouFoto) apagarFoto(inicial.foto);
          mostrarAviso({
            texto: 'Guardado ✨',
            desfazer: novo
              ? () => {
                  gravar({ tipo: 'excluir', dado: { alvo: 'marcos', id: m.id } });
                  apagarFoto(final.foto);
                }
              : trocouFoto
                ? undefined
                : () => gravar({ tipo: 'colecao', colecao: 'marcos', dado: inicial }),
          });
          aoFechar();
        }}
      >
        {livre && (
          <Campo rotulo="O quê">
            <input
              value={m.titulo ?? ''}
              maxLength={200}
              onChange={(e) => {
                setM({ ...m, titulo: e.target.value });
                setMsg(null);
              }}
              placeholder="Ex.: primeiro sorriso"
              autoCapitalize="sentences"
            />
          </Campo>
        )}
        <Campo rotulo="Quando">
          <input type="date" value={m.data ?? ''} max={hojeLocal()} onChange={(e) => setM({ ...m, data: e.target.value || null })} />
        </Campo>
        <Campo rotulo="Anotação (opcional)">
          <textarea value={m.observacao ?? ''} maxLength={2000} onChange={(e) => setM({ ...m, observacao: e.target.value })} />
        </Campo>
        <CampoFoto foto={m.foto} aoMudar={(foto) => setM({ ...m, foto })} />
        {msg && (
          <div className="alerta erro" role="alert">
            {msg}
          </div>
        )}
        <button className="botao primario">Salvar</button>
        {!novo && (
          <>
            {inicial.criado_por && <p className="mudo">Registrado por {nomeDe(inicial.criado_por)}</p>}
            <button
              type="button"
              className="botao perigo"
              onClick={() => {
                if (inicial.foto && !confirm(`${livre ? 'Excluir' : 'Desmarcar'}? A foto também será apagada e não dá para desfazer.`)) return;
                gravar({ tipo: 'excluir', dado: { alvo: 'marcos', id: inicial.id } });
                apagarFoto(inicial.foto);
                mostrarAviso({ texto: livre ? 'Excluído' : 'Marcação desfeita', desfazer: inicial.foto ? undefined : () => gravar({ tipo: 'colecao', colecao: 'marcos', dado: inicial }) });
                aoFechar();
              }}
            >
              {livre ? (
                <>
                  <Icone nome="lixeira" /> Excluir
                </>
              ) : (
                'Desmarcar'
              )}
            </button>
          </>
        )}
      </form>
    </Folha>
  );
}

function useNovoMarco() {
  const { bebe, membro, usuario } = useDados();
  return (tipo: Marco['tipo'], marcoId: string | null, extra: Partial<Marco> = {}): Marco | null =>
    bebe && membro
      ? {
          id: marcoId ? idFixo(`${bebe.id}:marco:${marcoId}`) : crypto.randomUUID(),
          familia_id: membro.familia_id,
          bebe_id: bebe.id,
          criado_por: usuario?.id ?? null,
          tipo,
          marco_id: marcoId,
          titulo: null,
          data: hojeLocal(),
          observacao: null,
          foto: null,
          ...extra,
        }
      : null;
}

function idadeEmMeses(nascimentoIso: string, hoje: string): number {
  const n = chaveDia(nascimentoIso);
  let m = 0;
  while (m < 60 && somarMeses(n, m + 1) <= hoje) m++;
  return m;
}

function Marcos() {
  const { bebe, marcos, hoje } = useDados();
  const novoMarco = useNovoMarco();
  const [aberto, setAberto] = useState<{ m: Marco; novo: boolean; titulo: string } | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  if (!bebe) return null;
  const idade = bebe.nascimento ? idadeEmMeses(bebe.nascimento, hoje) : 0;
  const faixas = [...new Set(MARCOS_CADERNETA.map((m) => m.idade_meses))];
  // Faixa atual = a primeira que termina depois da idade de hoje
  const atual = faixas.find((f) => f > idade) ?? faixas[faixas.length - 1];
  const visiveis = verTodos ? faixas : faixas.filter((f) => f <= atual + 3 && f >= Math.min(atual, faixas[0]));
  const porId = new Map(marcos.filter((m) => m.tipo === 'caderneta').map((m) => [m.marco_id, m]));

  return (
    <div className="pilha">
      <div className="alerta info">
        <span>{ORIENTACAO_MARCOS}</span>
      </div>
      {visiveis.map((f) => {
        const itens = MARCOS_CADERNETA.filter((m) => m.idade_meses === f);
        const feitos = itens.filter((m) => porId.has(m.id)).length;
        return (
          <section key={f} className="cartao" aria-label={itens[0].faixa} style={f === atual ? { borderColor: 'color-mix(in srgb, var(--c-agenda) 55%, var(--borda))' } : undefined}>
            <div className="grupo-cab">
              <h2>{itens[0].faixa}</h2>
              <span className="mudo">
                {f === atual ? 'idade atual · ' : ''}
                {feitos} de {itens.length}
              </span>
            </div>
            <div className="lista">
              {itens.map((mc) => {
                const feito = porId.get(mc.id);
                return (
                  <button
                    key={mc.id}
                    className="item"
                    onClick={() => {
                      const m = feito ?? novoMarco('caderneta', mc.id);
                      if (m) setAberto({ m, novo: !feito, titulo: mc.descricao });
                    }}
                  >
                    <span className={`selo ${feito ? 't-agenda' : ''}`}>{feito ? <Icone nome="check" /> : <span style={{ width: 20 }} />}</span>
                    <div className="cresce">
                      <div className="titulo" style={{ fontWeight: feito ? 600 : 500 }}>
                        {mc.descricao}
                      </div>
                      {feito?.data && <div className="detalhe">{dataBr(feito.data)}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      {!verTodos && (
        <button className="botao" onClick={() => setVerTodos(true)}>
          Ver todas as faixas (até 3 anos)
        </button>
      )}
      <p className="fonte">
        Marcos do{' '}
        <a href={FONTE_MARCOS.url} target="_blank" rel="noreferrer">
          {FONTE_MARCOS.nome}
        </a>
        .
      </p>
      {aberto && <FolhaMarco inicial={aberto.m} novo={aberto.novo} titulo={aberto.titulo} aoFechar={() => setAberto(null)} />}
    </div>
  );
}

const SUGESTOES = ['Primeiro sorriso', 'Primeiro banho', 'Primeiro passeio', 'Rolou', 'Sentou sozinho', 'Primeiro dentinho', 'Primeira papinha', 'Engatinhou', 'Primeira palavra', 'Primeiros passos'];

function PrimeirasVezes() {
  const { marcos } = useDados();
  const novoMarco = useNovoMarco();
  const [aberto, setAberto] = useState<{ m: Marco; novo: boolean } | null>(null);
  const lista = marcos.filter((m) => m.tipo === 'primeira-vez').sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));
  const usados = new Set(lista.map((m) => m.titulo?.toLocaleLowerCase('pt-BR')));
  const abrirNovo = (titulo: string | null) => {
    const m = novoMarco('primeira-vez', null, { titulo });
    if (m) setAberto({ m, novo: true });
  };
  return (
    <div className="pilha">
      <button className="botao primario" onClick={() => abrirNovo(null)}>
        <Icone nome="estrela" /> Nova primeira vez
      </button>
      <div className="chips">
        {SUGESTOES.filter((s) => !usados.has(s.toLocaleLowerCase('pt-BR'))).map((s) => (
          <button key={s} className="chip" onClick={() => abrirNovo(s)}>
            + {s}
          </button>
        ))}
      </div>
      {lista.length ? (
        <section className="cartao">
          <div className="lista">
            {lista.map((m) => (
              <button key={m.id} className="item" onClick={() => setAberto({ m, novo: false })}>
                {m.foto ? (
                  <span className="selo" style={{ overflow: 'hidden', padding: 0 }}>
                    <Foto caminho={m.foto} classe="foto-mini" />
                  </span>
                ) : (
                  <span className="selo t-mamadeira">
                    <Icone nome="estrela" />
                  </span>
                )}
                <div className="cresce">
                  <div className="titulo">{m.titulo}</div>
                  <div className="detalhe">
                    {m.data ? dataBr(m.data) : ''}
                    {m.observacao ? ` · ${m.observacao}` : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <div className="cartao mudo">Guardem aqui as primeiras vezes, com data e foto.</div>
      )}
      {aberto && <FolhaMarco inicial={aberto.m} novo={aberto.novo} titulo={aberto.novo ? 'Primeira vez' : aberto.m.titulo ?? 'Primeira vez'} aoFechar={() => setAberto(null)} />}
    </div>
  );
}

function FotosDoMes() {
  const { bebe, marcos, gravar, mostrarAviso, hoje, repo } = useDados();
  const novoMarco = useNovoMarco();
  const entrada = useRef<HTMLInputElement>(null);
  const [alvo, setAlvo] = useState<number | null>(null);
  const [aberta, setAberta] = useState<Marco | null>(null);
  const { enviar, enviando } = useEnviarFoto();
  if (!bebe) return null;
  if (!bebe.nascimento) return <div className="cartao mudo">As fotos do mês começam depois do nascimento.</div>;
  const nasc = chaveDia(bebe.nascimento);
  const idade = idadeEmMeses(bebe.nascimento, hoje);
  const ate = Math.min(24, Math.max(idade + 1, 3));
  const porMes = new Map(marcos.filter((m) => m.tipo === 'mes').map((m) => [m.marco_id, m]));
  const meses = Array.from({ length: ate + 1 }, (_, i) => i);

  return (
    <div className="pilha">
      <p className="texto-2">Uma foto por mês (de preferência no mesmo lugar ou com o mesmo bichinho, para ver o crescimento).</p>
      <div className="foto-grade">
        {meses.map((n) => {
          const m = porMes.get(`mes-${n}`);
          const rotulo = n === 0 ? 'Nascimento' : n === 1 ? '1 mês' : `${n} meses`;
          const futuro = somarMeses(nasc, n) > hoje;
          return (
            <button
              key={n}
              className={`foto-slot ${m?.foto ? 'cheio' : ''}`}
              disabled={enviando || (futuro && !m)}
              onClick={() => {
                if (m?.foto) setAberta(m);
                else {
                  setAlvo(n);
                  entrada.current?.click();
                }
              }}
              aria-label={`${rotulo}${m?.foto ? ', ver foto' : ', adicionar foto'}`}
            >
              {m?.foto ? (
                <Foto caminho={m.foto} />
              ) : (
                <>
                  <Icone nome="camera" />
                  {futuro ? dataBr(somarMeses(nasc, n)).slice(0, 5) : enviando && alvo === n ? 'enviando…' : 'adicionar'}
                </>
              )}
              <span className="legenda">{rotulo}</span>
            </button>
          );
        })}
      </div>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const n = alvo;
          const caminho = await enviar(e.target.files?.[0]);
          e.target.value = '';
          if (caminho === null || n === null) return;
          const existente = porMes.get(`mes-${n}`);
          const m = existente ?? novoMarco('mes', `mes-${n}`, { data: somarMeses(nasc, n), titulo: n === 0 ? 'Nascimento' : `${n} ${n === 1 ? 'mês' : 'meses'}` });
          if (!m) return;
          gravar({ tipo: 'colecao', colecao: 'marcos', dado: { ...m, foto: caminho } });
          mostrarAviso({ texto: 'Foto guardada 📸' });
        }}
      />
      {aberta?.foto && (
        <Folha titulo={aberta.titulo ?? 'Foto'} aoFechar={() => setAberta(null)}>
          <div className="pilha">
            <Foto caminho={aberta.foto} classe="foto-grande" />
            <button
              className="botao perigo"
              onClick={() => {
                if (!confirm('Tirar esta foto? Ela será apagada e não dá para desfazer.')) return;
                gravar({ tipo: 'excluir', dado: { alvo: 'marcos', id: aberta.id } });
                if (aberta.foto) void repo.excluirFoto(aberta.foto).catch(() => undefined);
                mostrarAviso({ texto: 'Foto tirada do mês' });
                setAberta(null);
              }}
            >
              <Icone nome="lixeira" /> Tirar esta foto
            </button>
          </div>
        </Folha>
      )}
    </div>
  );
}

export function SecaoDesenvolvimento() {
  const [aba, setAba] = useState<'marcos' | 'primeiras' | 'fotos'>('marcos');
  return (
    <div className="pilha">
      <div className="abas" role="tablist">
        <button role="tab" aria-selected={aba === 'marcos'} className={aba === 'marcos' ? 'ativo' : ''} onClick={() => setAba('marcos')}>
          Marcos
        </button>
        <button role="tab" aria-selected={aba === 'primeiras'} className={aba === 'primeiras' ? 'ativo' : ''} onClick={() => setAba('primeiras')}>
          1ª vez
        </button>
        <button role="tab" aria-selected={aba === 'fotos'} className={aba === 'fotos' ? 'ativo' : ''} onClick={() => setAba('fotos')}>
          Foto do mês
        </button>
      </div>
      {aba === 'marcos' && <Marcos />}
      {aba === 'primeiras' && <PrimeirasVezes />}
      {aba === 'fotos' && <FotosDoMes />}
    </div>
  );
}
