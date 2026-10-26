import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { somarMeses } from '../../supabase/functions/_shared/tempo.ts';
import { useDados } from '../dados/contexto';
import { FONTE_MARCOS, MARCOS_CADERNETA, ORIENTACAO_MARCOS } from '../lib/conteudo';
import { generoBebe } from '../lib/chegada';
import { chaveDia, dataBr, diasEntre, hojeLocal } from '../lib/datas';
import { traduzirErro } from '../lib/erros';
import { idFixo } from '../lib/ids';
import { reduzirFoto } from '../lib/imagem';
import type { Marco } from '../lib/tipos';
import { Campo, Folha, Icone } from './ui';
import '../estilos/desenvolvimento.css';

/** Mostra uma foto guardada (endereço temporário pedido ao servidor) */
export function Foto({ caminho, classe, alt = '', reserva }: { caminho: string; classe?: string; alt?: string; reserva?: ReactNode }) {
  const { repo } = useDados();
  // undefined = buscando; null = não deu para abrir (sem internet ou foto apagada)
  const [url, setUrl] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    setUrl(undefined);
    repo
      .urlFoto(caminho)
      .then((u) => vivo && setUrl(u))
      .catch(() => vivo && setUrl(null));
    return () => {
      vivo = false;
    };
  }, [repo, caminho]);
  if (url === undefined) return <span className="mudo">carregando…</span>;
  if (url === null)
    return (
      <>
        {reserva ?? (
          <span className="mudo foto-falhou" role="img" aria-label="Foto indisponível agora (sem internet?)">
            <Icone nome="camera" />
          </span>
        )}
      </>
    );
  return <img className={classe} src={url} alt={alt} loading="lazy" onError={() => setUrl(null)} />;
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

/** "com 12 dias", "com 1 mês e 3 dias" (idade do bebê numa data); null antes do nascimento */
function idadeNaData(nascimentoIso: string, dia: string): string | null {
  const n = chaveDia(nascimentoIso);
  if (dia < n) return null;
  const m = idadeEmMeses(nascimentoIso, dia);
  const d = diasEntre(somarMeses(n, m), dia);
  if (!m && !d) return 'no dia do nascimento';
  const meses = m ? `${m} ${m === 1 ? 'mês' : 'meses'}` : '';
  const dias = d ? `${d} ${d === 1 ? 'dia' : 'dias'}` : '';
  return `com ${[meses, dias].filter(Boolean).join(' e ')}`;
}

const FAIXAS = [...new Set(MARCOS_CADERNETA.map((m) => m.idade_meses))];

/** Faixa da Caderneta em que o bebê está hoje (a primeira que termina depois da idade dele) */
function faixaAtual(nascimento: string | null, hoje: string): number {
  const idade = nascimento ? idadeEmMeses(nascimento, hoje) : 0;
  return FAIXAS.find((f) => f > idade) ?? FAIXAS[FAIXAS.length - 1];
}

/** Para a prévia no Mais: quantos marcos da faixa de idade atual já foram marcados */
export function progressoMarcos(nascimento: string | null, marcos: Marco[], hoje: string): { feitos: number; total: number; faixa: string } {
  const atual = faixaAtual(nascimento, hoje);
  const itens = MARCOS_CADERNETA.filter((m) => m.idade_meses === atual);
  const marcados = new Set(marcos.filter((m) => m.tipo === 'caderneta').map((m) => m.marco_id));
  return { feitos: itens.filter((m) => marcados.has(m.id)).length, total: itens.length, faixa: itens[0].faixa };
}

/** Um emoji por marco: vira o "selo" da conquista */
const EMOJI_MARCO: Record<string, string> = {
  'c01-postura': '🛌', 'c01-rosto': '👀', 'c01-som': '👂', 'c01-cabeca': '💪',
  'c02-sorriso': '😊', 'c02-maos': '✋', 'c02-sons': '🗣️', 'c02-membros': '🦵',
  'c04-contato': '🤗', 'c04-segura': '✊', 'c04-sons': '🎶', 'c04-brucos': '🙌',
  'c06-busca': '🔍', 'c06-boca': '👄', 'c06-localiza': '🔔', 'c06-rola': '🔄',
  'c09-esconde': '🙈', 'c09-transfere': '🤲', 'c09-silabas': '💬', 'c09-senta': '🪑',
  'c12-imita': '👋', 'c12-pinca': '🤏', 'c12-jargao': '🗨️', 'c12-anda-apoio': '🚶',
  'c15-mostra': '👉', 'c15-blocos': '🧱', 'c15-palavra': '💬', 'c15-anda': '👣',
  'c18-colher': '🥄', 'c18-torre2': '🧱', 'c18-palavras': '🔤', 'c18-tras': '↩️',
  'c24-roupa': '👕', 'c24-torre3': '🧱', 'c24-figuras': '🖼️', 'c24-chuta': '⚽',
  'c30-veste': '👖', 'c30-torre6': '🏗️', 'c30-frases': '💬', 'c30-pula': '🦘',
  'c36-brinca': '🧸', 'c36-linha': '✏️', 'c36-acoes': '🎭', 'c36-arremessa': '🏀',
};

/** Anel de progresso (feitos de total) */
function Anel({ feitos, total }: { feitos: number; total: number }) {
  const r = 26;
  const volta = 2 * Math.PI * r;
  return (
    <svg className="dev-anel" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r={r} className="dev-anel-fundo" />
      <circle cx="32" cy="32" r={r} className="dev-anel-cheio" strokeDasharray={`${(feitos / Math.max(1, total)) * volta} ${volta}`} transform="rotate(-90 32 32)" />
      <text x="32" y="37" textAnchor="middle">
        {feitos}/{total}
      </text>
    </svg>
  );
}

function Marcos() {
  const { bebe, marcos, hoje } = useDados();
  const novoMarco = useNovoMarco();
  const [aberto, setAberto] = useState<{ m: Marco; novo: boolean; titulo: string } | null>(null);
  const [verTodos, setVerTodos] = useState(false);
  const [expandidas, setExpandidas] = useState<Set<number>>(new Set());
  if (!bebe) return null;
  const atual = faixaAtual(bebe.nascimento, hoje);
  // Antes da faixa atual: resumidas (toque para abrir); depois: até 3 meses à frente, ou todas
  const visiveis = verTodos ? FAIXAS : FAIXAS.filter((f) => f <= atual + 3);
  const porId = new Map(marcos.filter((m) => m.tipo === 'caderneta').map((m) => [m.marco_id, m]));
  const itensAtual = MARCOS_CADERNETA.filter((m) => m.idade_meses === atual);
  const feitosAtual = itensAtual.filter((m) => porId.has(m.id)).length;
  const feitosTotal = MARCOS_CADERNETA.filter((m) => porId.has(m.id)).length;
  const conquistas = MARCOS_CADERNETA.filter((m) => porId.has(m.id))
    .map((mc) => ({ mc, m: porId.get(mc.id)! }))
    .sort((a, b) => (b.m.data ?? '').localeCompare(a.m.data ?? ''));
  const abrir = (mc: (typeof MARCOS_CADERNETA)[number]) => {
    const feito = porId.get(mc.id);
    const m = feito ?? novoMarco('caderneta', mc.id);
    if (m) setAberto({ m, novo: !feito, titulo: mc.descricao });
  };
  const alternar = (f: number) =>
    setExpandidas((s) => {
      const n = new Set(s);
      if (n.has(f)) n.delete(f);
      else n.add(f);
      return n;
    });

  return (
    <div className="pilha">
      <section className="cartao dev-heroi" aria-label="Faixa de idade atual">
        <Anel feitos={feitosAtual} total={itensAtual.length} />
        <div className="cresce">
          <span className="dev-sobre">{bebe.nascimento ? 'Idade atual' : 'Primeira faixa'}</span>
          <h2>{itensAtual[0].faixa}</h2>
          <p className="texto-2">
            {!bebe.nascimento
              ? 'Depois do nascimento, marquem aqui cada conquista.'
              : `${feitosAtual === itensAtual.length ? 'Todos os marcos da faixa! 🎉' : `${feitosAtual} de ${itensAtual.length} marcos da faixa`} · ${feitosTotal} no total`}
          </p>
        </div>
      </section>
      {conquistas.length > 0 && (
        <div className="dev-selos" aria-label="Últimas conquistas">
          {conquistas.slice(0, 6).map(({ mc, m }) => (
            <button key={mc.id} type="button" className="dev-selo" onClick={() => abrir(mc)}>
              <span aria-hidden="true">{EMOJI_MARCO[mc.id] ?? '⭐'}</span>
              <span className="dev-selo-texto">{mc.descricao}</span>
              {m.data && <span className="dev-selo-data">{dataBr(m.data).slice(0, 5)}</span>}
            </button>
          ))}
        </div>
      )}
      <ol className="trilha" aria-label="Marcos por faixa de idade">
        {visiveis.map((f) => {
          const itens = MARCOS_CADERNETA.filter((m) => m.idade_meses === f);
          const feitos = itens.filter((m) => porId.has(m.id)).length;
          const passada = f < atual;
          const resumida = passada && !expandidas.has(f);
          const estado = f === atual ? 'atual' : passada ? 'passada' : 'futura';
          return (
            <li key={f} className={`trilha-etapa ${estado} ${feitos === itens.length ? 'completa' : ''}`}>
              <span className="trilha-no" aria-hidden="true">
                {feitos === itens.length ? <Icone nome="check" /> : f === atual ? <span className="trilha-pulso" /> : null}
              </span>
              <section className="trilha-cartao" aria-label={itens[0].faixa}>
                <div className="trilha-cab">
                  <div className="cresce">
                    {f === atual && bebe.nascimento && <span className="dev-sobre">Agora</span>}
                    <h3>{itens[0].faixa}</h3>
                  </div>
                  <span className="trilha-conta">
                    {feitos} de {itens.length}
                  </span>
                </div>
                <div className="trilha-barra" aria-hidden="true">
                  <span style={{ width: `${(feitos / itens.length) * 100}%` }} />
                </div>
                {resumida ? (
                  <button type="button" className="trilha-resumo" onClick={() => alternar(f)} aria-expanded={false}>
                    <span className="trilha-emojis" aria-hidden="true">
                      {itens.map((mc) => (
                        <span key={mc.id} className={porId.has(mc.id) ? 'sim' : ''}>
                          {EMOJI_MARCO[mc.id] ?? '⭐'}
                        </span>
                      ))}
                    </span>
                    <span className="mudo">Ver os marcos</span>
                  </button>
                ) : (
                  <div className="trilha-marcos">
                    {itens.map((mc) => {
                      const feito = porId.get(mc.id);
                      return (
                        <button key={mc.id} type="button" className={`marco ${feito ? 'conquistado' : ''}`} onClick={() => abrir(mc)} aria-label={`${mc.descricao}${feito ? `, conquistado${feito.data ? ` em ${dataBr(feito.data)}` : ''}` : ', marcar'}`}>
                          <span className="marco-selo" aria-hidden="true">
                            {feito ? EMOJI_MARCO[mc.id] ?? '⭐' : null}
                          </span>
                          <span className="marco-texto">{mc.descricao}</span>
                          {feito?.data && <span className="marco-data">{dataBr(feito.data).slice(0, 5)}</span>}
                        </button>
                      );
                    })}
                    {passada && (
                      <button type="button" className="trilha-fechar mudo" onClick={() => alternar(f)} aria-expanded={true}>
                        Recolher
                      </button>
                    )}
                  </div>
                )}
              </section>
            </li>
          );
        })}
      </ol>
      {!verTodos && visiveis.length < FAIXAS.length && (
        <button className="botao" onClick={() => setVerTodos(true)}>
          Ver todas as faixas (até 3 anos)
        </button>
      )}
      <div className="alerta info">
        <span>{ORIENTACAO_MARCOS}</span>
      </div>
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

/** Emoji pela palavra do título ("Primeiro sorriso" → 😊) */
const EMOJIS_PRIMEIRA: [RegExp, string][] = [
  [/sorri/, '😊'],
  [/banh/, '🛁'],
  [/passeio|parque|praia/, '🌳'],
  [/rol/, '🔄'],
  [/sent/, '🪑'],
  [/dent/, '🦷'],
  [/papa|papinha|comeu|fruta|refei/, '🥣'],
  [/engatinh/, '🐾'],
  [/palavra|falou|mam[aã]e|papai/, '💬'],
  [/passo|andou/, '👣'],
  [/viag|avi[aã]o/, '✈️'],
  [/risad|riu/, '😂'],
  [/cabelo|corte/, '✂️'],
  [/natal|anivers|festa/, '🎉'],
  [/vov[oóô]|av[oóô]/, '👵'],
  [/dorm|noite/, '🌙'],
];
const emojiPrimeira = (titulo: string | null) => EMOJIS_PRIMEIRA.find(([r]) => r.test((titulo ?? '').toLocaleLowerCase('pt-BR')))?.[1] ?? '⭐';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function PrimeirasVezes() {
  const { marcos, bebe } = useDados();
  const novoMarco = useNovoMarco();
  const [aberto, setAberto] = useState<{ m: Marco; novo: boolean } | null>(null);
  const lista = marcos.filter((m) => m.tipo === 'primeira-vez').sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));
  const usados = new Set(lista.map((m) => m.titulo?.toLocaleLowerCase('pt-BR')));
  const abrirNovo = (titulo: string | null) => {
    const m = novoMarco('primeira-vez', null, { titulo });
    if (m) setAberto({ m, novo: true });
  };
  // Agrupa por mês do calendário (o mais recente em cima)
  const grupos: { chave: string; itens: Marco[] }[] = [];
  for (const m of lista) {
    const chave = m.data?.slice(0, 7) ?? '';
    const g = grupos[grupos.length - 1];
    if (g && g.chave === chave) g.itens.push(m);
    else grupos.push({ chave, itens: [m] });
  }
  const nomeMes = (chave: string) => (chave ? `${MESES[Number(chave.slice(5, 7)) - 1]} de ${chave.slice(0, 4)}` : 'Sem data');

  return (
    <div className="pilha">
      <button className="botao primario" onClick={() => abrirNovo(null)}>
        <Icone nome="estrela" /> Nova primeira vez
      </button>
      <div className="chips">
        {SUGESTOES.filter((s) => !usados.has(s.toLocaleLowerCase('pt-BR'))).map((s) => (
          <button key={s} className="chip" onClick={() => abrirNovo(s)}>
            <span aria-hidden="true">{emojiPrimeira(s)}</span> {s}
          </button>
        ))}
      </div>
      {lista.length ? (
        <div className="pv-tempo">
          {grupos.map((g) => (
            <section key={g.chave} className="pv-grupo" aria-label={nomeMes(g.chave)}>
              <h3 className="pv-mes">{nomeMes(g.chave)}</h3>
              <ol className="pv-lista">
                {g.itens.map((m) => {
                  const idade = bebe?.nascimento && m.data ? idadeNaData(bebe.nascimento, m.data) : null;
                  return (
                    <li key={m.id} className="pv-item">
                      <span className="pv-dia" aria-hidden="true">
                        {m.data ? (
                          <>
                            <strong>{Number(m.data.slice(8, 10))}</strong>
                            {MESES_CURTOS[Number(m.data.slice(5, 7)) - 1]}
                          </>
                        ) : (
                          '–'
                        )}
                      </span>
                      <span className="pv-no" aria-hidden="true">
                        {emojiPrimeira(m.titulo)}
                      </span>
                      <button type="button" className="pv-cartao" onClick={() => setAberto({ m, novo: false })}>
                        <span className="pv-titulo">{m.titulo}</span>
                        <span className="pv-detalhe">{[m.data ? dataBr(m.data) : null, idade].filter(Boolean).join(' · ')}</span>
                        {m.observacao && <span className="pv-obs">{m.observacao}</span>}
                        {m.foto && <Foto caminho={m.foto} classe="pv-foto" />}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <div className="cartao dev-vazio">
          <span aria-hidden="true">🌟</span>
          <p className="texto-2">Guardem aqui as primeiras vezes, com data e foto. Elas viram uma linha do tempo.</p>
        </div>
      )}
      {aberto && <FolhaMarco inicial={aberto.m} novo={aberto.novo} titulo={aberto.novo ? 'Primeira vez' : aberto.m.titulo ?? 'Primeira vez'} aoFechar={() => setAberto(null)} />}
    </div>
  );
}

const reduzMovimento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const TEMPO_SLIDE = 2800;

/** "Ver como ele cresceu": as fotos do mês em sequência, em tela cheia */
function VerCrescer({ fotos, aoFechar }: { fotos: { id: string; foto: string; rotulo: string; data: string | null }[]; aoFechar: () => void }) {
  const [i, setI] = useState(0);
  const [tocando, setTocando] = useState(() => !reduzMovimento());
  const ultimo = fotos.length - 1;
  const ir = useCallback((n: number) => setI(Math.max(0, Math.min(ultimo, n))), [ultimo]);

  useEffect(() => {
    if (!tocando) return;
    if (i >= ultimo) {
      setTocando(false);
      return;
    }
    const t = setTimeout(() => setI((x) => Math.min(ultimo, x + 1)), TEMPO_SLIDE);
    return () => clearTimeout(t);
  }, [tocando, i, ultimo]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
      else if (e.key === 'ArrowRight') ir(i + 1);
      else if (e.key === 'ArrowLeft') ir(i - 1);
    };
    document.addEventListener('keydown', tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = overflow;
    };
  }, [aoFechar, ir, i]);

  // A lista pode encolher com a tela aberta (o outro responsável apagou uma foto)
  const atual = fotos[Math.min(i, fotos.length - 1)];
  if (!atual) return null;
  return (
    <div className="crescer" role="dialog" aria-modal="true" aria-label="Ver como cresceu">
      <div className="crescer-barras" aria-hidden="true">
        {fotos.map((f, n) => (
          <span key={f.id} className={n < i ? 'cheia' : n === i ? (tocando ? 'andando' : 'cheia') : ''}>
            <span key={n === i ? `${i}-${tocando}` : 'x'} />
          </span>
        ))}
      </div>
      <div className="crescer-topo">
        <button type="button" className="crescer-botao" onClick={() => setTocando((t) => !t)} aria-label={tocando ? 'Pausar' : 'Tocar'}>
          <Icone nome={tocando ? 'pausar' : 'tocar'} />
        </button>
        <span className="crescer-conta" aria-live="polite">
          {i + 1} de {fotos.length}
        </span>
        <button type="button" className="crescer-botao" onClick={aoFechar} aria-label="Fechar">
          <Icone nome="fechar" />
        </button>
      </div>
      <div className="crescer-palco">
        {fotos.map((f, n) => (
          <div key={f.id} className={`crescer-foto ${n === i ? 'ativa' : ''}`} aria-hidden={n !== i}>
            <Foto caminho={f.foto} alt={f.rotulo} />
          </div>
        ))}
        <button type="button" className="crescer-zona voltar" aria-label="Foto anterior" disabled={i === 0} onClick={(e) => (e.stopPropagation(), ir(i - 1))} />
        <button type="button" className="crescer-zona avancar" aria-label="Próxima foto" disabled={i === ultimo} onClick={(e) => (e.stopPropagation(), ir(i + 1))} />
      </div>
      <div className="crescer-legenda">
        <strong key={atual.id}>{atual.rotulo}</strong>
        {atual.data && <span>{dataBr(atual.data)}</span>}
        {i === ultimo && fotos.length > 1 ? (
          <button
            type="button"
            className="botao pequeno crescer-denovo"
            onClick={() => {
              setI(0);
              setTocando(!reduzMovimento());
            }}
          >
            Ver de novo
          </button>
        ) : (
          <span className="crescer-dica">Toque para avançar · na esquerda, volta</span>
        )}
      </div>
    </div>
  );
}

function FotosDoMes() {
  const { bebe, marcos, gravar, mostrarAviso, hoje, repo } = useDados();
  const novoMarco = useNovoMarco();
  const entrada = useRef<HTMLInputElement>(null);
  const [alvo, setAlvo] = useState<number | null>(null);
  const [aberta, setAberta] = useState<Marco | null>(null);
  const [vendo, setVendo] = useState(false);
  const { enviar, enviando } = useEnviarFoto();
  const porMes = useMemo(() => new Map(marcos.filter((m) => m.tipo === 'mes').map((m) => [m.marco_id, m])), [marcos]);
  if (!bebe) return null;
  if (!bebe.nascimento)
    return (
      <div className="cartao dev-vazio">
        <span aria-hidden="true">📸</span>
        <p className="texto-2">As fotos do mês começam depois do nascimento: uma por mês, para ver o crescimento.</p>
      </div>
    );
  const nasc = chaveDia(bebe.nascimento);
  const idade = idadeEmMeses(bebe.nascimento, hoje);
  const ate = Math.min(24, Math.max(idade + 1, 3));
  const meses = Array.from({ length: ate + 1 }, (_, i) => i);
  const rotuloMes = (n: number) => (n === 0 ? 'Nascimento' : n === 1 ? '1 mês' : `${n} meses`);
  // Todas as fotos guardadas, em ordem de idade (inclusive as de meses depois dos que aparecem na grade)
  const sequencia = [...porMes.values()]
    .filter((m) => m.foto && m.marco_id?.startsWith('mes-'))
    .map((m) => ({ n: Number(m.marco_id!.slice(4)), m }))
    .sort((a, b) => a.n - b.n)
    .map(({ n, m }) => ({ id: m.id, foto: m.foto!, rotulo: rotuloMes(n), data: m.data }));
  const g = generoBebe(bebe.sexo, !!bebe.nome?.trim());

  return (
    <div className="pilha">
      <p className="texto-2">Uma foto por mês (de preferência no mesmo lugar ou com o mesmo bichinho, para ver o crescimento).</p>
      {sequencia.length >= 2 && (
        <button className="botao primario crescer-abrir" onClick={() => setVendo(true)}>
          <Icone nome="tocar" /> Ver como {g.ele} cresceu
        </button>
      )}
      <div className="fotos-mes">
        {meses.map((n) => {
          const m = porMes.get(`mes-${n}`);
          const rotulo = rotuloMes(n);
          const dia = somarMeses(nasc, n);
          const futuro = dia > hoje;
          const proximo = !m?.foto && !futuro && n === idade;
          return (
            <button
              key={n}
              type="button"
              className={`foto-mes ${m?.foto ? 'cheio' : ''} ${futuro ? 'futuro' : ''} ${proximo ? 'proximo' : ''}`}
              disabled={enviando || (futuro && !m)}
              onClick={() => {
                if (m?.foto) setAberta(m);
                else {
                  setAlvo(n);
                  entrada.current?.click();
                }
              }}
              aria-label={`${rotulo}${m?.foto ? ', ver foto' : futuro ? `, a partir de ${dataBr(dia)}` : ', adicionar foto'}`}
            >
              {m?.foto ? (
                <Foto caminho={m.foto} />
              ) : (
                <span className="foto-mes-vazio">
                  <Icone nome={futuro ? 'agenda' : 'camera'} />
                  <span>{futuro ? dataBr(dia).slice(0, 5) : enviando && alvo === n ? 'enviando…' : 'adicionar'}</span>
                </span>
              )}
              <span className="foto-mes-rotulo">
                <strong>{rotulo}</strong>
                {m?.foto && <span>{dataBr(m.data ?? dia).slice(0, 5)}</span>}
              </span>
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
          // Trocou a foto: a antiga sai do armazenamento
          if (existente?.foto && existente.foto !== caminho) void repo.excluirFoto(existente.foto).catch(() => undefined);
          setAberta(null);
          mostrarAviso({ texto: existente?.foto ? 'Foto trocada 📸' : 'Foto guardada 📸' });
        }}
      />
      {vendo && sequencia.length > 0 && <VerCrescer fotos={sequencia} aoFechar={() => setVendo(false)} />}
      {aberta?.foto && (
        <Folha titulo={aberta.titulo ?? 'Foto'} aoFechar={() => setAberta(null)}>
          <div className="pilha">
            <Foto caminho={aberta.foto} classe="foto-grande" />
            <button
              className="botao"
              disabled={enviando}
              onClick={() => {
                const n = Number(aberta.marco_id?.replace('mes-', ''));
                if (!Number.isFinite(n)) return;
                setAlvo(n);
                entrada.current?.click();
              }}
            >
              <Icone nome="camera" /> {enviando ? 'Enviando…' : 'Trocar foto'}
            </button>
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
