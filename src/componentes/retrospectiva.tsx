/**
 * Retrospectiva do ano em tela cheia, como "stories": barras no topo, toque à direita avança e à
 * esquerda volta, segurar pausa. Cada tela passa sozinha em ~5 s (com "Reduzir movimento", só no toque).
 * Os totais pedem ao banco os registros do período inteiro (o app abre só com os últimos 45 dias);
 * sem internet, conta o que já está no celular e avisa.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as PE, type ReactNode } from 'react';
import { useDados } from '../dados/contexto';
import { useRegistrosDesde } from '../dados/historico';
import { carregarImagem } from '../lib/cartao-imagem';
import { reais } from '../lib/cofrinho';
import { dataBr, textoDuracao } from '../lib/datas';
import { textoAltura, textoGanhoPeso, textoMeses } from '../lib/momentos';
import {
  destaqueMarcos,
  diasDormindo,
  flexao,
  intervaloFraldas,
  milhar,
  montarRetrospectiva,
  periodoRetrospectiva,
  plural,
  quemE,
  recordesDisponiveis,
  selecionarTelas,
  textoHorasLongas,
  textoKg,
  textoLeite,
  textoMesDeVida,
  textoSonoSeguido,
  tituloRetrospectiva,
  vezesPeso,
  type DadosRetro,
  type FotoRetro,
  type IdTela,
} from '../lib/retrospectiva';
import type { Bebe } from '../lib/tipos';
import { compartilhar } from './doc-arquivos';
import { NumeroAnimado } from './numero-animado';
import { CarregandoRetro } from './retrospectiva-entrada';
import { Icone } from './ui';

const reduzMovimento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Tempo de cada tela (ms) */
const TEMPO_TELA = 5200;
const TEMPO_FOTO = 650;
/** Segurar mais que isto pausa (e não conta como toque) */
const TOQUE_MAX_MS = 260;

interface Pronto {
  dados: DadosRetro;
  telas: IdTela[];
  /** Fotos do período que abriram (caminho → endereço) */
  fotos: (FotoRetro & { url: string })[];
  /** Foto da abertura (a mais recente do período ou a do perfil) */
  capa: string | null;
  /** Sem internet: contou só o que estava no celular (dia desde quando) */
  offlineDesde: string | null;
}

/** Endereços das fotos do período (com prazo: sem internet não fica esperando para sempre) */
function useUrlsFotos(caminhos: string[] | null): Map<string, string> | null {
  const { repo } = useDados();
  const [urls, setUrls] = useState<{ chave: string; mapa: Map<string, string> } | null>(null);
  const chave = caminhos ? caminhos.join('|') : null;
  useEffect(() => {
    if (chave === null) return;
    let vivo = true;
    const lista = chave ? chave.split('|') : [];
    const mapa = new Map<string, string>();
    const prazo = new Promise<void>((ok) => setTimeout(ok, 6000));
    const todas = Promise.all(
      lista.map((c) =>
        repo
          .urlFoto(c)
          .then((u) => {
            if (u) mapa.set(c, u);
          })
          .catch(() => undefined),
      ),
    );
    void Promise.race([todas, prazo]).then(() => vivo && setUrls({ chave, mapa: new Map(mapa) }));
    return () => {
      vivo = false;
    };
  }, [chave, repo]);
  return urls && urls.chave === chave ? urls.mapa : null;
}

export default function Retrospectiva({ ano, aoFechar }: { ano?: number; aoFechar: () => void }) {
  const { bebe, marcos, medidas, vacinas, cofrinho_contas, cofrinho_movimentos, registros: doApp, carregadoDesde, hoje } = useDados();
  const periodo = useMemo(() => periodoRetrospectiva(bebe?.nascimento, hoje, ano), [bebe?.nascimento, hoje, ano]);
  const { registros, erro } = useRegistrosDesde(periodo?.inicio ?? null);
  // Sem internet: segue com os registros do app (os últimos dias) e avisa
  const lista = registros ?? (erro ? doApp : null);
  const offline = !registros && !!erro;

  const caminhos = useMemo(() => {
    if (!bebe || !periodo) return null;
    const fotos = montarRetrospectiva(bebe, { registros: [], medidas: [], marcos, vacinas: [], contas: [], movimentos: [] }, periodo, hoje, new Date())?.fotos ?? [];
    const c = fotos.map((f) => f.foto);
    if (bebe.foto) c.push(bebe.foto);
    return [...new Set(c)];
  }, [bebe, periodo, marcos, hoje]);
  const urls = useUrlsFotos(caminhos);

  // Monta uma vez (o outro responsável registrar algo não muda as telas no meio)
  const [pronto, setPronto] = useState<Pronto | null>(null);
  useEffect(() => {
    if (pronto || !bebe || !periodo || !lista || !urls) return;
    const dados = montarRetrospectiva(bebe, { registros: lista, medidas, marcos, vacinas, contas: cofrinho_contas, movimentos: cofrinho_movimentos }, periodo, hoje, new Date());
    if (!dados) return;
    const fotos = dados.fotos.filter((f) => urls.has(f.foto)).map((f) => ({ ...f, url: urls.get(f.foto)! }));
    const ultima = fotos[fotos.length - 1];
    setPronto({
      dados,
      telas: selecionarTelas(dados, fotos.length),
      fotos,
      capa: ultima?.url ?? (bebe.foto ? urls.get(bebe.foto) ?? null : null),
      offlineDesde: offline ? carregadoDesde : null,
    });
  }, [pronto, bebe, periodo, lista, urls, medidas, marcos, vacinas, cofrinho_contas, cofrinho_movimentos, hoje, offline, carregadoDesde]);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  if (!bebe || !periodo) {
    return (
      <CarregandoRetro
        texto={bebe?.nascimento ? 'A retrospectiva aparece a partir dos 3 meses de vida.' : 'A retrospectiva começa depois do nascimento.'}
        aoFechar={aoFechar}
      />
    );
  }
  if (!pronto) return <CarregandoRetro texto={`Juntando ${periodo.completo ? 'o ano' : 'os meses'} ${quemE(bebe).do}…`} aoFechar={aoFechar} />;
  return <Stories bebe={bebe} pronto={pronto} aoFechar={aoFechar} />;
}

// ---------- Tocador ----------

function duracaoTela(id: IdTela, p: Pronto): number {
  if (id === 'fotos') return Math.max(TEMPO_TELA, p.fotos.length * TEMPO_FOTO + 1800);
  if (id === 'marcos') return TEMPO_TELA + Math.min(4, p.dados.marcos.length) * 400;
  if (id === 'recordes') return TEMPO_TELA + 1200;
  return TEMPO_TELA;
}

function Stories({ bebe, pronto, aoFechar }: { bebe: Bebe; pronto: Pronto; aoFechar: () => void }) {
  const { telas } = pronto;
  const [i, setI] = useState(0);
  const [segurando, setSegurando] = useState(false);
  const [pausadoBotao, setPausadoBotao] = useState(false);
  const [escondida, setEscondida] = useState(false);
  const [rodada, setRodada] = useState(0);
  const [auto] = useState(() => !reduzMovimento());
  const raiz = useRef<HTMLDivElement>(null);
  const toque = useRef<{ t: number; x: number; y: number; timer: ReturnType<typeof setTimeout> | undefined } | null>(null);
  const ultima = telas.length - 1;
  const pausado = segurando || pausadoBotao || escondida;
  const id = telas[Math.min(i, ultima)];

  const ir = useCallback((n: number) => setI(Math.max(0, Math.min(ultima, n))), [ultima]);
  const avancar = useCallback(() => setI((x) => Math.min(ultima, x + 1)), [ultima]);
  const voltar = useCallback(() => setI((x) => Math.max(0, x - 1)), []);

  useEffect(() => {
    raiz.current?.focus({ preventScroll: true });
    const vis = () => setEscondida(document.hidden);
    document.addEventListener('visibilitychange', vis);
    return () => document.removeEventListener('visibilitychange', vis);
  }, []);

  // Teclado (no topo da captura: o Esc não fecha também a comemoração que está atrás)
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar();
      else if (e.key === 'ArrowRight') avancar();
      else if (e.key === 'ArrowLeft') voltar();
      else if (e.key === ' ' && !(e.target as HTMLElement)?.closest?.('button')) setPausadoBotao((p) => !p);
      else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [aoFechar, avancar, voltar]);

  const tempo = duracaoTela(id, pronto);

  // Toque: rápido = navega (1/3 da esquerda volta); segurado = pausa; arrastar para baixo = fecha
  const aoTocar = (e: PE<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a, input')) return;
    const timer = setTimeout(() => setSegurando(true), 180);
    toque.current = { t: Date.now(), x: e.clientX, y: e.clientY, timer };
  };
  const aoSoltar = (e: PE<HTMLDivElement>) => {
    const t = toque.current;
    toque.current = null;
    if (!t) return;
    clearTimeout(t.timer);
    setSegurando(false);
    const dy = e.clientY - t.y;
    const dx = e.clientX - t.x;
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) return aoFechar();
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) return dx < 0 ? avancar() : voltar();
    if (Date.now() - t.t > TOQUE_MAX_MS) return;
    const larg = raiz.current?.clientWidth ?? window.innerWidth;
    if (e.clientX < larg / 3) voltar();
    else avancar();
  };
  const aoCancelar = () => {
    if (toque.current) clearTimeout(toque.current.timer);
    toque.current = null;
    setSegurando(false);
  };

  const titulo = tituloRetrospectiva(pronto.dados.periodo, bebe);
  // As imagens para compartilhar ficam prontas antes da última tela (o iPhone só abre a folha de
  // compartilhar logo depois do toque: com a imagem já feita, abre na hora)
  const [gerar, setGerar] = useState(false);
  useEffect(() => {
    if (i >= ultima - 1) setGerar(true);
  }, [i, ultima]);
  const imagens = useImagens(bebe, pronto, gerar);

  return (
    <div
      ref={raiz}
      tabIndex={-1}
      className={`retro ${pausado ? 'pausado' : ''} ${auto ? '' : 'manual'} retro-fundo-${id}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Retrospectiva: ${titulo}`}
    >
      <div className="retro-barras" aria-hidden="true">
        {telas.map((t, n) => (
          <span key={t} className={n < i ? 'cheia' : n === i ? 'atual' : ''}>
            {n === i ? (
              <span
                key={`${i}-${rodada}`}
                style={{ animationDuration: `${tempo}ms` } as CSSProperties}
                onAnimationEnd={() => {
                  if (n < ultima) avancar();
                }}
              />
            ) : (
              <span />
            )}
          </span>
        ))}
      </div>
      <div className="retro-topo">
        <span className="retro-marca">
          <span aria-hidden="true">✨</span> Retrospectiva
        </span>
        <span className="cresce" />
        {auto && (
          <button type="button" className="retro-botao" onClick={() => setPausadoBotao((p) => !p)} aria-label={pausadoBotao ? 'Continuar' : 'Pausar'}>
            <Icone nome={pausadoBotao ? 'tocar' : 'pausar'} />
          </button>
        )}
        <button type="button" className="retro-botao" onClick={aoFechar} aria-label="Fechar">
          <Icone nome="fechar" />
        </button>
      </div>
      <div className="retro-palco" onPointerDown={aoTocar} onPointerUp={aoSoltar} onPointerCancel={aoCancelar} onContextMenu={(e) => e.preventDefault()}>
        <section key={`${id}-${rodada}`} className={`retro-tela tela-${id}`} aria-roledescription="tela" aria-label={`Tela ${i + 1} de ${telas.length}`}>
          <Tela id={id} bebe={bebe} pronto={pronto} pausado={pausado} auto={auto} imagens={imagens} aoRever={() => (setRodada((r) => r + 1), ir(0))} aoFechar={aoFechar} />
        </section>
      </div>
      <div className="retro-navegar">
        <button type="button" className="retro-nav" onClick={voltar} disabled={i === 0} aria-label="Tela anterior">
          <Icone nome="seta" />
        </button>
        <span className="retro-conta" aria-live="polite">
          {i + 1} de {telas.length}
        </span>
        <button type="button" className="retro-nav prox" onClick={avancar} disabled={i === ultima} aria-label="Próxima tela">
          <Icone nome="seta" />
        </button>
      </div>
    </div>
  );
}

// ---------- Telas ----------

/** Elemento que entra com atraso (em ordem: 0, 1, 2…) */
function E({ n, children, classe = '', como: Tag = 'div' }: { n: number; children: ReactNode; classe?: string; como?: 'div' | 'p' | 'h1' | 'h2' | 'li' | 'span' }) {
  return (
    <Tag className={`retro-e ${classe}`} style={{ '--n': n } as CSSProperties}>
      {children}
    </Tag>
  );
}

/** Número grande que conta do zero */
function Grande({ valor, formatar = milhar, rotulo }: { valor: number; formatar?: (n: number) => string; rotulo?: string }) {
  return (
    <div className="retro-grande">
      <strong className="retro-numero">
        <NumeroAnimado valor={valor} formatar={formatar} duracao={1400} />
      </strong>
      {rotulo && <span className="retro-rotulo">{rotulo}</span>}
    </div>
  );
}

function Tela(props: { id: IdTela; bebe: Bebe; pronto: Pronto; pausado: boolean; auto: boolean; imagens: Imagens; aoRever: () => void; aoFechar: () => void }) {
  const { id, bebe, pronto } = props;
  const { dados } = pronto;
  const t = dados.totais;
  const q = quemE(bebe);
  const p = dados.periodo;
  const noAno = p.completo ? 'no ano' : 'até agora';

  switch (id) {
    case 'abertura':
      return (
        <div className="retro-centro">
          <E n={0} classe="retro-capa">
            {pronto.capa ? <img src={pronto.capa} alt="" /> : <span aria-hidden="true">{p.completo ? '🎂' : '✨'}</span>}
          </E>
          <E n={1} como="p" classe="retro-sobre">
            {p.completo ? `${textoMeses(p.ano * 12)} de vida` : `${textoMeses(p.meses)} de vida`}
          </E>
          <E n={2} como="h1" classe="retro-titulo">
            {tituloRetrospectiva(p, bebe)}
          </E>
          <E n={3} como="p" classe="retro-datas">
            {dataBr(p.inicio)} a {dataBr(p.completo ? p.fim : p.ultimoDia)}
          </E>
          <E n={4} como="p" classe="retro-texto">
            {t.registros > 0 ? `${plural(t.registros, 'registro')} em ${plural(t.diasComRegistro, 'dia')}. Vamos relembrar?` : 'Vamos relembrar?'}
          </E>
          {pronto.offlineDesde && (
            <E n={5} como="p" classe="retro-aviso">
              Sem internet: os números contam só os registros guardados no celular (desde {dataBr(pronto.offlineDesde).slice(0, 5)}).
            </E>
          )}
          <E n={6} como="p" classe="retro-dica">
            {props.auto ? 'Toque à direita para avançar · segure para pausar' : 'Toque à direita para avançar · à esquerda, volta'}
          </E>
        </div>
      );

    case 'alimentacao': {
      const peito = t.mamadas > 0;
      const porDia = t.diasComRegistro ? (t.mamadas + t.mamadeiras) / t.diasComRegistro : 0;
      return (
        <div className="retro-centro">
          <E n={0} como="p" classe="retro-sobre">
            {p.completo ? 'Neste ano foram' : 'Até agora foram'}
          </E>
          <E n={1}>
            <Grande valor={peito ? t.mamadas : t.mamadeiras} rotulo={peito ? (t.mamadas === 1 ? 'mamada no peito' : 'mamadas no peito') : t.mamadeiras === 1 ? 'mamadeira' : 'mamadeiras'} />
          </E>
          {peito && t.mamadeiras > 0 && (
            <E n={2} classe="retro-linha">
              <span className="retro-mais">+</span> {plural(t.mamadeiras, 'mamadeira')}
            </E>
          )}
          {t.ml > 0 && (
            <E n={3} classe="retro-pilula">
              🍼 {textoLeite(t.ml)} de leite na mamadeira
            </E>
          )}
          {t.peitoMs >= 3_600_000 && (
            <E n={4} como="p" classe="retro-texto">
              São {textoHorasLongas(t.peitoMs)} no peito. Haja colo! 🤱
            </E>
          )}
          {porDia > 0 && (
            <E n={5} como="p" classe="retro-texto suave">
              Uma média de {porDia.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por dia.
            </E>
          )}
        </div>
      );
    }

    case 'fraldas': {
      const intervalo = intervaloFraldas(t);
      return (
        <div className="retro-centro">
          <E n={0} como="p" classe="retro-sobre">
            E vocês trocaram
          </E>
          <E n={1}>
            <Grande valor={t.fraldas} rotulo={t.fraldas === 1 ? 'fralda' : 'fraldas'} />
          </E>
          <E n={2} classe="retro-duas">
            <span>
              <strong>{milhar(t.xixi)}</strong> com xixi
            </span>
            <span>
              <strong>{milhar(t.coco)}</strong> com cocô
            </span>
          </E>
          {intervalo && (
            <E n={3} como="p" classe="retro-texto">
              Uma troca a cada {textoDuracao(intervalo)}, em média.
            </E>
          )}
          <E n={4} como="p" classe="retro-texto destaque">
            Equipe de troca nota 10! 🏅
          </E>
        </div>
      );
    }

    case 'sono': {
      const dias = diasDormindo(t.sonoMs);
      return (
        <div className="retro-centro">
          <E n={0} como="p" classe="retro-sobre">
            {q.Nome} dormiu
          </E>
          <E n={1}>
            <Grande valor={Math.round(t.sonoMs / 3_600_000)} rotulo={Math.round(t.sonoMs / 3_600_000) === 1 ? 'hora de sono' : 'horas de sono'} />
          </E>
          {dias >= 1 && (
            <E n={2} como="p" classe="retro-texto">
              {dias === 1 ? 'Dá 1 dia inteirinho dormindo. 😴' : `Dá ${milhar(dias)} dias inteirinhos dormindo. 😴`}
            </E>
          )}
          <div className="retro-cartoes">
            {t.maiorSono && (
              <E n={3} classe="retro-cartao">
                <span className="retro-cartao-rotulo">Maior sono seguido</span>
                <strong>{textoSonoSeguido(t.maiorSono.ms)}</strong>
                <span className="retro-cartao-sub">em {dataBr(t.maiorSono.dia)}</span>
              </E>
            )}
            {t.noitesInteiras > 0 && (
              <E n={4} classe="retro-cartao">
                <span className="retro-cartao-rotulo">Noites inteiras</span>
                <strong>{milhar(t.noitesInteiras)}</strong>
                <span className="retro-cartao-sub">de 6 h ou mais{t.primeiraNoiteInteira ? ` · a 1ª em ${dataBr(t.primeiraNoiteInteira)}` : ''}</span>
              </E>
            )}
          </div>
        </div>
      );
    }

    case 'recordes': {
      const itens = recordesDisponiveis(t);
      return (
        <div className="retro-centro">
          <E n={0} como="h2" classe="retro-titulo-2">
            Recordes curiosos 🏆
          </E>
          <ul className="retro-recordes">
            {itens.map((r, n) => {
              const [emoji, rotulo, valor, sub] =
                r === 'mamadas'
                  ? ['🍼', 'Dia com mais mamadas', plural(t.diaMaisMamadas!.valor, 'mamada'), `em ${dataBr(t.diaMaisMamadas!.dia)}`]
                  : r === 'acordar'
                    ? ['☀️', 'Hora mais comum de acordar', `por volta das ${t.horaAcordar!.hora}h`, `em ${plural(t.horaAcordar!.vezes, 'manhã')}`]
                    : r === 'mesSono'
                      ? ['🌙', 'Mês que mais dormiu', textoMesDeVida(t.mesMaisSono!.mes), `~${(t.mesMaisSono!.mediaMs / 3_600_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h por dia`]
                      : r === 'fraldas'
                        ? ['🧷', 'Dia com mais fraldas', plural(t.diaMaisFraldas!.valor, 'fralda'), `em ${dataBr(t.diaMaisFraldas!.dia)}`]
                        : ['😋', 'Mês mais comilão', textoMesDeVida(t.mesMaisMamadas!.mes), `~${t.mesMaisMamadas!.media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mamadas por dia`];
              return (
                <E key={r} n={n + 1} como="li" classe="retro-recorde">
                  <span className="retro-recorde-emoji" aria-hidden="true">
                    {emoji}
                  </span>
                  <span className="cresce">
                    <span className="retro-cartao-rotulo">{rotulo}</span>
                    <strong>{valor}</strong>
                    <span className="retro-cartao-sub">{sub}</span>
                  </span>
                </E>
              );
            })}
          </ul>
        </div>
      );
    }

    case 'crescimento': {
      const { peso, altura } = dados.crescimento;
      const percentis = [peso?.percentil != null ? `${peso.percentil} no peso` : null, altura?.percentil != null ? `${altura.percentil} na altura` : null].filter(Boolean);
      return (
        <div className="retro-centro">
          <E n={0} como="h2" classe="retro-titulo-2">
            {q.Nome} cresceu! 🌱
          </E>
          {peso && <Medida n={1} rotulo="Peso" de={textoKg(peso.de)} ate={textoKg(peso.ate)} deTexto={peso.deNascer ? 'ao nascer' : dataBr(peso.deData).slice(0, 5)} ateTexto={dataBr(peso.ateData).slice(0, 5)} ganho={`${textoGanhoPeso(peso.ate - peso.de)}${vezesPeso(peso.de, peso.ate) ? ` · ${vezesPeso(peso.de, peso.ate)} o peso ${peso.deNascer ? 'de nascer' : 'do começo'}` : ''}`} proporcao={peso.de / peso.ate} />}
          {altura && <Medida n={2} rotulo="Altura" de={textoAltura(altura.de)} ate={textoAltura(altura.ate)} deTexto={altura.deNascer ? 'ao nascer' : dataBr(altura.deData).slice(0, 5)} ateTexto={dataBr(altura.ateData).slice(0, 5)} ganho={textoAltura(altura.ate - altura.de, true)} proporcao={altura.de / altura.ate} />}
          {percentis.length > 0 && (
            <E n={3} como="p" classe="retro-texto suave">
              Na curva da OMS para a idade: percentil {percentis.join(' e ')}.
            </E>
          )}
        </div>
      );
    }

    case 'marcos': {
      const max = 6;
      const lista = destaqueMarcos(dados.marcos, max);
      const resto = dados.marcos.length - lista.length;
      return (
        <div className="retro-centro">
          <E n={0} como="h2" classe="retro-titulo-2">
            {p.completo ? 'Conquistas do ano' : 'Conquistas até agora'}
          </E>
          <ol className="retro-linha-tempo">
            {lista.map((m, n) => (
              <E key={m.id} n={n + 1} como="li" classe="retro-marco">
                <span className="retro-marco-no" aria-hidden="true">
                  {m.emoji}
                </span>
                <span className="cresce">
                  <strong>{m.titulo}</strong>
                  <span>{[m.idade, dataBr(m.data).slice(0, 5)].filter(Boolean).join(' · ')}</span>
                </span>
              </E>
            ))}
          </ol>
          {resto > 0 && (
            <E n={max + 1} como="p" classe="retro-texto suave">
              e mais {plural(resto, 'conquista')} ✨
            </E>
          )}
        </div>
      );
    }

    case 'vacinas': {
      const v = dados.vacinas;
      const nomes = v.nomes.slice(0, 8);
      const coragem = bebe.sexo ? `Que ${flexao(bebe.sexo, 'corajoso', 'corajosa')}! 💪` : 'Quanta coragem! 💪';
      return (
        <div className="retro-centro">
          <E n={0} como="p" classe="retro-sobre">
            {noAno === 'no ano' ? 'No ano foram' : 'Até agora foram'}
          </E>
          <E n={1}>
            <Grande valor={v.doses} rotulo={v.doses === 1 ? 'vacina tomada' : 'vacinas tomadas'} />
          </E>
          <E n={2} classe="retro-chips">
            {nomes.map((n) => (
              <span key={n}>{n}</span>
            ))}
            {v.nomes.length > nomes.length && <span>+{v.nomes.length - nomes.length}</span>}
          </E>
          <E n={3} como="p" classe="retro-texto destaque">
            {coragem}
          </E>
          <E n={4} como="p" classe="retro-texto suave">
            Cada picadinha, uma proteção a mais.
          </E>
        </div>
      );
    }

    case 'fotos':
      return <TelaFotos fotos={pronto.fotos} pausado={props.pausado} titulo={`Olha como ${q.ele} cresceu`} />;

    case 'cofrinho': {
      const c = dados.cofrinho!;
      return (
        <div className="retro-centro">
          <E n={0} como="p" classe="retro-sobre">
            No cofrinho 🐷
          </E>
          <E n={1}>
            <Grande valor={c.saldo} formatar={(n) => reais(Math.round(n))} rotulo={`guardados para o futuro ${q.do}`} />
          </E>
          {c.depositos > 0 && (
            <E n={2} como="p" classe="retro-texto">
              {plural(c.depositos, 'depósito')} {noAno}
              {c.pessoas > 1 ? `, de ${c.pessoas} pessoas queridas` : c.pessoas === 1 ? ', com muito carinho' : ''}. 💛
            </E>
          )}
        </div>
      );
    }

    case 'encerramento':
      return <TelaFinal bebe={bebe} pronto={pronto} imagens={props.imagens} aoRever={props.aoRever} aoFechar={props.aoFechar} />;
  }
}

function Medida({ n, rotulo, de, ate, deTexto, ateTexto, ganho, proporcao }: { n: number; rotulo: string; de: string; ate: string; deTexto: string; ateTexto: string; ganho: string; proporcao: number }) {
  return (
    <E n={n} classe="retro-medida">
      <span className="retro-cartao-rotulo">{rotulo}</span>
      <div className="retro-medida-valores">
        <span>
          <small>{deTexto}</small>
          {de}
        </span>
        <span className="retro-seta" aria-hidden="true">
          →
        </span>
        <span className="agora">
          <small>{ateTexto}</small>
          {ate}
        </span>
      </div>
      <div className="retro-medida-barras" aria-hidden="true">
        <span style={{ '--p': Math.max(0.08, Math.min(1, proporcao)) } as CSSProperties} />
        <span style={{ '--p': 1 } as CSSProperties} />
      </div>
      <span className="retro-ganho">{ganho}</span>
    </E>
  );
}

/** As fotos do mês em sequência (time-lapse); com "Reduzir movimento", em grade */
function TelaFotos({ fotos, pausado, titulo }: { fotos: Pronto['fotos']; pausado: boolean; titulo: string }) {
  const [k, setK] = useState(0);
  const [mover] = useState(() => !reduzMovimento());
  useEffect(() => {
    if (!mover || pausado || k >= fotos.length - 1) return;
    const t = setTimeout(() => setK((x) => x + 1), k === 0 ? TEMPO_FOTO + 500 : TEMPO_FOTO);
    return () => clearTimeout(t);
  }, [mover, pausado, k, fotos.length]);
  if (!mover)
    return (
      <div className="retro-centro">
        <h2 className="retro-titulo-2">{titulo}</h2>
        <div className="retro-grade-fotos">
          {fotos.map((f) => (
            <figure key={f.meses}>
              <img src={f.url} alt={f.rotulo} />
              <figcaption>{f.rotulo}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    );
  const atual = fotos[k];
  return (
    <div className="retro-fotos">
      <h2 className="retro-titulo-2 retro-e" style={{ '--n': 0 } as CSSProperties}>
        {titulo}
      </h2>
      <div className="retro-lapso">
        {fotos.map((f, n) => (
          <img key={f.meses} src={f.url} alt={n === k ? f.rotulo : ''} aria-hidden={n !== k} className={n === k ? 'ativa' : n < k ? 'passou' : ''} />
        ))}
        <span key={atual.meses} className="retro-lapso-rotulo">
          {atual.rotulo}
        </span>
      </div>
      <div className="retro-lapso-pontos" aria-hidden="true">
        {fotos.map((f, n) => (
          <span key={f.meses} className={n <= k ? 'sim' : ''} />
        ))}
      </div>
    </div>
  );
}

/** Confete leve (uma vez); some com "Reduzir movimento" */
function Confete() {
  const pecas = useMemo(() => {
    let s = 23;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 48 }, (_, i) => ({ x: rnd() * 100, atraso: rnd() * 1.2, dur: 2.4 + rnd() * 1.6, giro: 180 + rnd() * 540, deriva: (rnd() - 0.5) * 140, forma: i % 3, cor: i % 4 }));
  }, []);
  if (reduzMovimento()) return null;
  return (
    <div className="retro-confete" aria-hidden="true">
      {pecas.map((p, i) => (
        <i key={i} className={`f${p.forma} c${p.cor}`} style={{ '--x': `${p.x}%`, '--atraso': `${p.atraso}s`, '--dur': `${p.dur}s`, '--giro': `${p.giro}deg`, '--deriva': `${p.deriva}px` } as CSSProperties} />
      ))}
    </div>
  );
}

/** Imagens para compartilhar (1080×1920), feitas assim que a última tela abre */
type Imagens = { arquivos: File[]; urls: string[] } | { erro: string } | null;

function useImagens(bebe: Bebe, pronto: Pronto, gerar: boolean): Imagens {
  const [estado, setEstado] = useState<Imagens>(null);
  useEffect(() => {
    if (!gerar) return;
    let vivo = true;
    let urls: string[] = [];
    (async () => {
      const { gerarImagensRetro } = await import('../lib/retrospectiva-imagem');
      const d = pronto.dados;
      const t = d.totais;
      const q = quemE(bebe);
      const fotos = (await Promise.all(pronto.fotos.slice(0, 16).map(async (f) => ({ img: await carregarImagem(f.url), rotulo: f.rotulo })))).filter((f): f is { img: CanvasImageSource; rotulo: string } => !!f.img);
      const capa = pronto.capa ? await carregarImagem(pronto.capa) : null;
      const numeros = [
        t.mamadas ? { valor: milhar(t.mamadas), rotulo: 'Mamadas', cor: '#ffb3dc' } : null,
        t.mamadeiras ? { valor: t.ml >= 1000 ? textoLeite(t.ml).replace(' litros', ' L').replace(' litro', ' L') : milhar(t.mamadeiras), rotulo: t.ml >= 1000 ? 'Leite na mamadeira' : 'Mamadeiras', cor: '#ffd08a' } : null,
        t.fraldas ? { valor: milhar(t.fraldas), rotulo: 'Fraldas', cor: '#a9dcff' } : null,
        t.sonoMs >= 3_600_000 ? { valor: `${milhar(Math.round(t.sonoMs / 3_600_000))} h`, rotulo: 'De sono', cor: '#d6c2ff' } : null,
        d.marcos.length ? { valor: milhar(d.marcos.length), rotulo: d.marcos.length === 1 ? 'Conquista' : 'Conquistas', cor: '#ffe27a' } : null,
        d.vacinas.doses ? { valor: milhar(d.vacinas.doses), rotulo: 'Vacinas', cor: '#a8f0c6' } : null,
      ].filter((x): x is { valor: string; rotulo: string; cor: string } => !!x);
      const cres = [
        d.crescimento.peso ? { rotulo: 'Peso', de: textoKg(d.crescimento.peso.de), ate: textoKg(d.crescimento.peso.ate), detalhe: textoGanhoPeso(d.crescimento.peso.ate - d.crescimento.peso.de) } : null,
        d.crescimento.altura ? { rotulo: 'Altura', de: textoAltura(d.crescimento.altura.de), ate: textoAltura(d.crescimento.altura.ate), detalhe: textoAltura(d.crescimento.altura.ate - d.crescimento.altura.de, true) } : null,
      ].filter((x): x is { rotulo: string; de: string; ate: string; detalhe: string } => !!x);
      const arquivos = await gerarImagensRetro({
        titulo: tituloRetrospectiva(d.periodo, bebe),
        periodo: `${dataBr(d.periodo.inicio)} a ${dataBr(d.periodo.completo ? d.periodo.fim : d.periodo.ultimoDia)}`,
        nome: q.temNome ? q.nome : 'bebe',
        foto: capa,
        numeros,
        crescimento: cres,
        marcos: destaqueMarcos(d.marcos, 5).map((m) => ({ emoji: m.emoji, titulo: m.titulo, idade: m.idade })),
        totalMarcos: d.marcos.length,
        extras: d.vacinas.doses ? [`💉 ${plural(d.vacinas.doses, 'vacina tomada', 'vacinas tomadas')}`] : [],
        fotos,
      });
      if (!vivo) return;
      urls = arquivos.map((a) => URL.createObjectURL(a));
      setEstado({ arquivos, urls });
    })().catch((e) => vivo && setEstado({ erro: (e as Error).message || 'Não deu para gerar as imagens.' }));
    return () => {
      vivo = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [bebe, pronto, gerar]);
  return estado;
}

function TelaFinal({ bebe, pronto, imagens, aoRever, aoFechar }: { bebe: Bebe; pronto: Pronto; imagens: Imagens; aoRever: () => void; aoFechar: () => void }) {
  const p = pronto.dados.periodo;
  const q = quemE(bebe);
  const [aviso, setAviso] = useState<string | null>(null);
  const prontas = imagens && 'arquivos' in imagens ? imagens : null;
  const titulo = p.completo ? (q.temNome ? `Feliz ${textoMeses(p.ano * 12)}, ${q.nome}!` : `Feliz ${textoMeses(p.ano * 12)}!`) : q.temNome ? `Que começo, ${q.nome}!` : 'Que começo!';
  return (
    <div className="retro-centro retro-final">
      <Confete />
      <E n={0} classe="retro-final-emoji">
        <span aria-hidden="true">{p.completo ? '🎂' : '💛'}</span>
      </E>
      <E n={1} como="h1" classe="retro-titulo">
        {titulo}
      </E>
      <E n={2} como="p" classe="retro-texto">
        Obrigado por cada registro, cada colo e cada madrugada. Vocês são incríveis. 💛
      </E>
      <E n={3} classe="retro-previas">
        {prontas ? prontas.urls.map((u, n) => <img key={u} src={u} alt={`Imagem ${n + 1} para compartilhar`} />) : 'erro' in (imagens ?? {}) ? null : <span className="retro-texto suave">Preparando as imagens…</span>}
      </E>
      {imagens && 'erro' in imagens && (
        <p className="retro-aviso" role="alert">
          {imagens.erro}
        </p>
      )}
      {aviso && <p className="retro-aviso">{aviso}</p>}
      <E n={4} classe="retro-acoes">
        <button
          type="button"
          className="botao primario retro-compartilhar"
          disabled={!prontas}
          onClick={async () => {
            if (!prontas) return;
            setAviso(null);
            const r = await compartilhar(prontas.arquivos, tituloRetrospectiva(p, bebe));
            if (r === 'bloqueado') setAviso('Imagens prontas! Toque de novo em Compartilhar.');
          }}
        >
          <Icone nome="compartilhar" /> {prontas ? `Compartilhar ${prontas.arquivos.length === 1 ? 'a imagem' : `${prontas.arquivos.length} imagens`}` : 'Compartilhar'}
        </button>
        <div className="retro-acoes-2">
          <button type="button" className="botao" onClick={aoRever}>
            Ver de novo
          </button>
          <button type="button" className="botao" onClick={aoFechar}>
            Fechar
          </button>
        </div>
      </E>
    </div>
  );
}
