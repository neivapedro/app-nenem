/** Momentos especiais na tela Hoje: mesversário (tela comemorativa + cartão para compartilhar) e lembranças "Há 1 mês…" */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useDados } from '../dados/contexto';
import { carregarImagem, gerarCartao, nomeArquivoCartao, type DadosCartao, type FormatoCartao } from '../lib/cartao-imagem';
import { generoBebe } from '../lib/chegada';
import { chaveDia, dataBr } from '../lib/datas';
import {
  comemoracaoVista,
  dataExtenso,
  dispensarLembranca,
  lembrancaDispensada,
  lembrancaDoDia,
  marcarComemoracaoVista,
  mesversarioHoje,
  periodoDoMes,
  resumoDoMes,
  textoAltura,
  textoGanhoPeso,
  textoHoras,
  textoMeses,
  textoPeso,
  tituloComemoracao,
  type Lembranca,
  type Mesversario,
  type ResumoMes,
} from '../lib/momentos';
import type { Bebe } from '../lib/tipos';
import { compartilhar } from './doc-arquivos';
import { Escolhas, Folha, Icone } from './ui';

const reduzMovimento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Endereço temporário de uma foto guardada (null = sem foto ou não abriu) */
function useUrlFoto(caminho: string | null | undefined): string | null {
  const { repo } = useDados();
  const [url, setUrl] = useState<{ caminho: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!caminho) return;
    let vivo = true;
    repo
      .urlFoto(caminho)
      .then((u) => vivo && setUrl({ caminho, url: u }))
      .catch(() => vivo && setUrl({ caminho, url: null }));
    return () => {
      vivo = false;
    };
  }, [repo, caminho]);
  return caminho && url?.caminho === caminho ? url.url : null;
}

// ---------- Cartão em imagem ----------

/** Dados do cartão do mês N (0 = nascimento) a partir do que está guardado */
function dadosDoCartao(bebe: Bebe, resumo: ResumoMes | null, meses: number): { dados: Omit<DadosCartao, 'foto'>; foto: string | null } {
  const g = generoBebe(bebe.sexo, true);
  const nome = bebe.nome?.trim() || 'Nosso bebê';
  if (meses === 0 || !resumo) {
    return {
      dados: {
        nome,
        idade: g.o === 'a' ? 'Recém-nascida' : 'Recém-nascido',
        selo: g.o === 'a' ? 'Bem-vinda!' : 'Bem-vindo!',
        data: bebe.nascimento ? dataExtenso(chaveDia(bebe.nascimento)) : '',
        peso: bebe.peso_nascer_g ? textoPeso(bebe.peso_nascer_g) : null,
        altura: bebe.altura_nascer_cm ? textoAltura(bebe.altura_nascer_cm) : null,
        marcos: resumo?.marcos.map((m) => m.titulo) ?? [],
        sexo: bebe.sexo,
      },
      foto: resumo?.foto ?? bebe.foto ?? null,
    };
  }
  const ano = meses >= 12 && meses % 12 === 0;
  return {
    dados: {
      nome,
      idade: textoMeses(meses),
      data: dataExtenso(resumo.fim),
      peso: resumo.peso ? textoPeso(resumo.peso.atual) : null,
      altura: resumo.altura ? textoAltura(resumo.altura.atual) : null,
      marcos: resumo.marcos.map((m) => m.titulo),
      rotuloMarcos: ano ? 'Conquistas do ano' : 'Conquistas do mês',
      selo: ano ? 'Aniversário' : 'Mesversário',
      sexo: bebe.sexo,
    },
    foto: resumo.foto ?? bebe.foto ?? null,
  };
}

/**
 * Folha com a prévia do cartão do mês N e o botão de compartilhar (no iPhone: WhatsApp,
 * Instagram, Salvar imagem). A imagem fica pronta antes do toque: assim a folha de
 * compartilhar do iPhone abre na hora, sem pedir um segundo toque.
 */
export function FolhaCartaoMes({ meses, aoFechar }: { meses: number; aoFechar: () => void }) {
  const { bebe, registros, marcos, medidas, hoje, repo } = useDados();
  const [formato, setFormato] = useState<FormatoCartao>('feed');
  const [pronto, setPronto] = useState<{ formato: FormatoCartao; arquivo: File; url: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const fotos = useRef(new Map<string, Promise<CanvasImageSource | null>>());

  const cartao = useMemo(() => {
    if (!bebe?.nascimento) return null;
    const resumo = resumoDoMes(bebe, { registros, marcos, medidas }, meses, hoje);
    return dadosDoCartao(bebe, resumo, meses);
  }, [bebe, registros, marcos, medidas, meses, hoje]);
  const chave = JSON.stringify(cartao);

  useEffect(() => {
    if (!cartao) return;
    let vivo = true;
    let url: string | null = null;
    setPronto(null);
    setErro(null);
    (async () => {
      let foto: CanvasImageSource | null = null;
      if (cartao.foto) {
        let p = fotos.current.get(cartao.foto);
        if (!p) {
          const caminho = cartao.foto;
          p = repo
            .urlFoto(caminho)
            .then((u) => (u ? carregarImagem(u) : null))
            .catch(() => null);
          fotos.current.set(caminho, p);
        }
        foto = await p;
      }
      const blob = await gerarCartao({ ...cartao.dados, foto }, formato);
      if (!vivo) return;
      url = URL.createObjectURL(blob);
      const arquivo = new File([blob], nomeArquivoCartao(cartao.dados.nome, cartao.dados.idade, formato), { type: 'image/png' });
      setPronto({ formato, arquivo, url });
    })().catch((e) => vivo && setErro((e as Error).message || 'Não deu para gerar a imagem.'));
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
    // A chave resume os dados do cartão (o objeto muda a cada desenho da tela)
  }, [chave, formato, repo]);

  if (!bebe || !cartao) return null;
  const titulo = `${cartao.dados.nome} · ${cartao.dados.idade}`;
  const atual = pronto?.formato === formato ? pronto : null;

  return (
    <Folha titulo="Cartão para compartilhar" aoFechar={aoFechar} classe="mom-folha-cartao">
      <div className="pilha">
        <Escolhas
          rotulo="Formato"
          valor={formato}
          opcoes={[
            { valor: 'feed', rotulo: 'WhatsApp / feed' },
            { valor: 'stories', rotulo: 'Stories' },
          ]}
          aoMudar={(v) => {
            setFormato(v);
            setAviso(null);
          }}
        />
        <div className={`mom-previa ${formato}`} aria-live="polite">
          {atual ? <img src={atual.url} alt={`Cartão: ${titulo}`} /> : erro ? null : <span className="mudo">Preparando o cartão…</span>}
        </div>
        {erro && (
          <div className="alerta erro" role="alert">
            {erro}
          </div>
        )}
        {aviso && <div className="alerta info">{aviso}</div>}
        <button
          className="botao primario"
          disabled={!atual}
          onClick={async () => {
            if (!atual) return;
            setAviso(null);
            const r = await compartilhar([atual.arquivo], titulo);
            if (r === 'bloqueado') setAviso('Imagem pronta! Toque de novo em Compartilhar.');
          }}
        >
          <Icone nome="compartilhar" /> Compartilhar
        </button>
        <p className="mudo">No iPhone abre a folha de compartilhar: WhatsApp, Instagram ou “Salvar imagem”. No computador, a imagem é baixada.</p>
      </div>
    </Folha>
  );
}

// ---------- Tela comemorativa ----------

/** Confete leve (CSS), uma vez só; desligado com "Reduzir movimento" */
function Confete() {
  const [vivo, setVivo] = useState(() => !reduzMovimento());
  useEffect(() => {
    if (!vivo) return;
    const t = setTimeout(() => setVivo(false), 4600);
    return () => clearTimeout(t);
  }, [vivo]);
  const pecas = useMemo(() => {
    let s = 11;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    return Array.from({ length: 44 }, (_, i) => ({
      x: rnd() * 100,
      atraso: rnd() * 0.9,
      duracao: 2.2 + rnd() * 1.4,
      giro: 180 + rnd() * 540,
      deriva: (rnd() - 0.5) * 120,
      forma: i % 3,
      cor: i % 4,
    }));
  }, []);
  if (!vivo) return null;
  return (
    <div className="mom-confete" aria-hidden="true">
      {pecas.map((p, i) => (
        <i
          key={i}
          className={`f${p.forma} c${p.cor}`}
          style={{ '--x': `${p.x}%`, '--atraso': `${p.atraso}s`, '--dur': `${p.duracao}s`, '--giro': `${p.giro}deg`, '--deriva': `${p.deriva}px` } as CSSProperties}
        />
      ))}
    </div>
  );
}

function Comemoracao({ mv, aoFechar }: { mv: Mesversario; aoFechar: () => void }) {
  const { bebe, registros, marcos, medidas, hoje } = useDados();
  const navigate = useNavigate();
  const [cartao, setCartao] = useState(false);
  const tela = useRef<HTMLDivElement>(null);
  const resumo = useMemo(() => (bebe ? resumoDoMes(bebe, { registros, marcos, medidas }, mv.meses, hoje) : null), [bebe, registros, marcos, medidas, mv.meses, hoje]);
  const fotoUrl = useUrlFoto(resumo?.foto ?? bebe?.foto ?? null);

  useEffect(() => {
    tela.current?.focus({ preventScroll: true });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);
  useEffect(() => {
    if (cartao) return; // a folha do cartão cuida do Esc dela
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [aoFechar, cartao]);

  if (!bebe || !resumo) return null;
  const g = generoBebe(bebe.sexo, !!bebe.nome?.trim());
  const titulo = tituloComemoracao(bebe.nome, mv);
  const ano = mv.aniversario;
  const frase = ano
    ? mv.meses === 12
      ? `Um ano inteirinho de amor. Parabéns, família! 💛`
      : `Mais um ano de muitas descobertas para ${g.ele}. 💛`
    : `Um mês cheio de novidades para ${g.ele}. 💛`;
  const mes = periodoDoMes(bebe.nascimento!, mv.meses);
  const diasMes = Math.max(1, Math.round((new Date(mes.fim).getTime() - new Date(mes.inicio).getTime()) / 86_400_000));
  const temContas = resumo.mamadas + resumo.fraldas + resumo.sonoMs > 0;
  const desde = (d: string | null) => (d ? ` desde ${dataBr(d).slice(0, 5)}` : '');
  const ir = (rota: string) => {
    aoFechar();
    navigate(rota);
  };

  return createPortal(
    <div ref={tela} tabIndex={-1} className={`mom-tela ${ano ? 'aniversario' : ''}`} role="dialog" aria-modal="true" aria-labelledby="mom-titulo">
      <Confete />
      <div className="mom-conteudo">
        <div className="mom-topo">
          <span className="mom-sobre">{ano ? 'Aniversário' : 'Mesversário'}</span>
          <button className="icone-botao mom-x" onClick={aoFechar} aria-label="Fechar">
            <Icone nome="fechar" />
          </button>
        </div>
        <header className="mom-heroi">
          <span className="mom-emoji" aria-hidden="true">
            {ano ? '🎁' : '🎈'}
          </span>
          <h1 id="mom-titulo">{titulo}</h1>
          <p className="mom-frase">{frase}</p>
          <p className="mom-data">{dataExtenso(hoje)}</p>
        </header>

        {fotoUrl ? (
          <figure className="mom-foto">
            <img src={fotoUrl} alt={resumo.foto ? `Foto dos ${mv.idade}` : `Foto ${g.do} ${bebe.nome}`} />
            {resumo.foto && <figcaption>Foto dos {mv.idade}</figcaption>}
          </figure>
        ) : (
          !resumo.foto && (
            <button type="button" className="mom-sem-foto" onClick={() => ir('/mais/desenvolvimento')}>
              <span aria-hidden="true">📸</span>
              <span className="cresce">
                <strong>Hoje é dia da foto do mês</strong>
                <span className="texto-2">Guardem a foto dos {mv.idade} em Desenvolvimento → Foto do mês.</span>
              </span>
              <Icone nome="seta" />
            </button>
          )
        )}

        {(resumo.peso || resumo.altura) && (
          <section className="mom-secao" aria-label="Crescimento">
            <h2>Crescimento</h2>
            <div className="grade">
              {resumo.peso && (
                <div className="bloco mom-bloco peso">
                  <div className="rotulo">Peso</div>
                  <div className="valor">{textoPeso(resumo.peso.atual)}</div>
                  {resumo.peso.ganho != null && (
                    <div className="mom-ganho">
                      {textoGanhoPeso(resumo.peso.ganho)}
                      {desde(resumo.peso.desde)}
                    </div>
                  )}
                </div>
              )}
              {resumo.altura && (
                <div className="bloco mom-bloco altura">
                  <div className="rotulo">Altura</div>
                  <div className="valor">{textoAltura(resumo.altura.atual)}</div>
                  {resumo.altura.ganho != null && (
                    <div className="mom-ganho">
                      {textoAltura(resumo.altura.ganho, true)}
                      {desde(resumo.altura.desde)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {temContas && (
          <section className="mom-secao" aria-label="No último mês">
            <h2>No último mês</h2>
            <div className="grade grade-3">
              <div className="bloco mom-bloco t-mamada">
                <div className="rotulo">Mamadas</div>
                <div className="valor">{resumo.mamadas}</div>
              </div>
              <div className="bloco mom-bloco t-fralda">
                <div className="rotulo">Fraldas</div>
                <div className="valor">{resumo.fraldas}</div>
              </div>
              <div className="bloco mom-bloco t-sono">
                <div className="rotulo">Sono</div>
                <div className="valor">{textoHoras(resumo.sonoMs)}</div>
                {resumo.sonoMs > 0 && <div className="mom-ganho">~{Math.round(resumo.sonoMs / 3_600_000 / Math.max(1, Math.min(diasMes, resumo.diasComRegistro)))} h/dia</div>}
              </div>
            </div>
          </section>
        )}

        <section className="mom-secao" aria-label={ano ? 'Conquistas do ano' : 'Conquistas do mês'}>
          <h2>{ano ? 'Conquistas do ano' : 'Conquistas do mês'}</h2>
          {resumo.marcos.length ? (
            <ul className="mom-marcos">
              {resumo.marcos.map((m) => (
                <li key={m.id}>
                  <span aria-hidden="true">{m.tipo === 'caderneta' ? '⭐' : '✨'}</span>
                  <span className="cresce">{m.titulo}</span>
                  <span className="mudo">{dataBr(m.data).slice(0, 5)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="texto-2">
              Nenhum marco ou “1ª vez” registrado {ano ? 'neste ano' : 'neste mês'}.{' '}
              <button type="button" className="mom-link" onClick={() => ir('/mais/desenvolvimento')}>
                Marcar em Desenvolvimento
              </button>
            </p>
          )}
        </section>

        <div className="mom-acoes">
          <button className="botao primario" onClick={() => setCartao(true)}>
            <Icone nome="compartilhar" /> Compartilhar cartão
          </button>
          <button className="botao" onClick={aoFechar}>
            Fechar
          </button>
        </div>
      </div>
      {cartao && <FolhaCartaoMes meses={mv.meses} aoFechar={() => setCartao(false)} />}
    </div>,
    document.body,
  );
}

/** Mesversário de hoje: abre a comemoração uma vez por aparelho; depois, um cartão pequeno */
function MesversarioDoDia({ bebe, mv }: { bebe: Bebe; mv: Mesversario }) {
  const [aberta, setAberta] = useState(() => !comemoracaoVista(bebe.id, mv.meses));
  useEffect(() => {
    if (aberta) marcarComemoracaoVista(bebe.id, mv.meses);
  }, [aberta, bebe.id, mv.meses]);
  const fechar = useCallback(() => setAberta(false), []);
  const nome = bebe.nome?.trim();
  return (
    <>
      <button type="button" className={`mom-cartao ${mv.aniversario ? 'aniversario' : ''}`} onClick={() => setAberta(true)}>
        <span className="mom-cartao-emoji" aria-hidden="true">
          {mv.aniversario ? '🎂' : '🎉'}
        </span>
        <span className="cresce">
          <strong>{mv.aniversario ? 'Hoje é aniversário!' : 'Hoje é mesversário!'}</strong>
          <span className="texto-2">
            {nome ? `${nome} faz ${mv.idade}` : `${mv.idade} hoje`} · Ver resumo
          </span>
        </span>
        <Icone nome="seta" />
      </button>
      {aberta && <Comemoracao mv={mv} aoFechar={fechar} />}
    </>
  );
}

// ---------- Lembranças ----------

function Miniatura({ l }: { l: Lembranca }) {
  const url = useUrlFoto(l.foto);
  if (url) return <img className="mom-mini" src={url} alt="" />;
  return (
    <span className="mom-mini vazio" aria-hidden="true">
      {l.tipo === 'registro' ? '📝' : l.tipo === 'caderneta' ? '⭐' : l.tipo === 'mes' ? '📸' : '✨'}
    </span>
  );
}

function FolhaLembranca({ l, aoFechar }: { l: Lembranca; aoFechar: () => void }) {
  const url = useUrlFoto(l.foto);
  const fotoMes = l.tipo === 'mes' ? Number(l.marco?.marco_id?.replace('mes-', '')) : NaN;
  const [cartao, setCartao] = useState(false);
  if (cartao && Number.isFinite(fotoMes)) return <FolhaCartaoMes meses={fotoMes} aoFechar={aoFechar} />;
  return (
    <Folha titulo={l.quando} aoFechar={aoFechar}>
      <div className="pilha">
        {l.foto && (url ? <img className="foto-grande mom-foto-lembranca" src={url} alt={l.titulo} /> : <span className="mudo">carregando a foto…</span>)}
        <div className="pilha-p">
          <h3 className="mom-lembranca-titulo">{l.titulo}</h3>
          <span className="texto-2">
            {dataBr(l.data)}
            {l.detalhe ? ` · ${l.detalhe}` : ''}
          </span>
          {l.marco?.observacao && l.marco.observacao.trim() !== l.detalhe && <p>{l.marco.observacao}</p>}
        </div>
        {Number.isFinite(fotoMes) && (
          <button className="botao primario" onClick={() => setCartao(true)}>
            <Icone nome="compartilhar" /> Compartilhar cartão
          </button>
        )}
        <Link to={l.tipo === 'registro' ? '/historico' : '/mais/desenvolvimento'} className="botao" onClick={aoFechar}>
          {l.tipo === 'registro' ? 'Ver no Histórico' : 'Ver em Desenvolvimento'}
        </Link>
      </div>
    </Folha>
  );
}

function LembrancaDoDia({ l, hoje }: { l: Lembranca; hoje: string }) {
  const [fechada, setFechada] = useState(() => lembrancaDispensada(hoje, l.id));
  const [aberta, setAberta] = useState(false);
  if (fechada) return null;
  return (
    <>
      <div className="mom-lembranca">
        <button type="button" className="mom-lembranca-abrir" onClick={() => setAberta(true)}>
          <Miniatura l={l} />
          <span className="cresce">
            <span className="mom-quando">{l.quando}…</span>
            <span className="mom-lembranca-texto">{l.titulo}</span>
          </span>
        </button>
        <button
          type="button"
          className="mom-lembranca-x"
          aria-label="Dispensar lembrança"
          onClick={() => {
            dispensarLembranca(hoje, l.id);
            setFechada(true);
          }}
        >
          <Icone nome="fechar" />
        </button>
      </div>
      {aberta && <FolhaLembranca l={l} aoFechar={() => setAberta(false)} />}
    </>
  );
}

/** Topo da tela Hoje: mesversário ou, nos outros dias, no máximo uma lembrança */
export function MomentosDoDia() {
  const { bebe, marcos, registros, hoje } = useDados();
  const mv = useMemo(() => mesversarioHoje(bebe?.nascimento, hoje), [bebe?.nascimento, hoje]);
  const lembranca = useMemo(() => (mv ? null : lembrancaDoDia(bebe, marcos, registros, hoje)), [mv, bebe, marcos, registros, hoje]);
  if (!bebe?.nascimento) return null;
  if (mv) return <MesversarioDoDia key={`${bebe.id}:${mv.meses}`} bebe={bebe} mv={mv} />;
  if (lembranca) return <LembrancaDoDia key={`${hoje}:${lembranca.id}`} l={lembranca} hoje={hoje} />;
  return null;
}
