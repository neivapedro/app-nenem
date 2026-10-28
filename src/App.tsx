import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { BrowserRouter, Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AvatarBebe, FotoCapa } from './componentes/avatar';
import { Ilustracao } from './componentes/ilustracoes';
import { GestosNavegacao } from './componentes/navegacao-gestos';
import { Protecao } from './componentes/Protecao';
import { Icone } from './componentes/ui';
import { useAgora, useDados } from './dados/contexto';
import { idadeBebe, semanasGestacao } from './lib/datas';
import { limparConvite } from './lib/convite';
import { telaTrocada, trocarComTransicao, type Direcao } from './lib/transicao';
import { Agenda } from './paginas/Agenda';
import { Configurar } from './paginas/Configurar';
import { SincronizarDocumentos } from './componentes/doc-offline';
import { SecaoDocumentos } from './componentes/documentos';
import { Cofrinho } from './paginas/Cofrinho';
import { SECOES_MAIS, TelaMais } from './paginas/Mais';
import { Noite } from './paginas/Noite';
import { Saude } from './paginas/Saude';
import { Entrar, NovaSenha } from './paginas/Entrar';
import { Historico } from './paginas/Historico';
import { Hoje } from './paginas/Hoje';

const ABAS = [
  { para: '/', rotulo: 'Hoje', icone: 'hoje' },
  { para: '/historico', rotulo: 'Histórico', icone: 'historico' },
  { para: '/saude', rotulo: 'Saúde', icone: 'saude' },
  { para: '/documentos', rotulo: 'Documentos', icone: 'documento', curto: 'Docs' },
  { para: '/cofrinho', rotulo: 'Cofrinho', icone: 'cofrinho' },
  { para: '/agenda', rotulo: 'Agenda', icone: 'agenda' },
  { para: '/mais', rotulo: 'Mais', icone: 'menu' },
];

const semBarra = (p: string) => p.replace(/\/+$/, '') || '/';

/** Posição da tela na ordem das abas (subtelas de "Mais" ficam depois de "Mais") */
function ordemTela(p: string): number {
  const i = ABAS.findIndex((a) => a.para === p);
  if (i >= 0) return i;
  return p.startsWith('/mais/') ? ABAS.length : ABAS.length - 1;
}

/**
 * Clique num link interno com a transição entre telas (abas da esquerda para a direita
 * deslizam para a frente). Sem suporte ou com "Reduzir movimento", o link segue normal.
 */
function useLinkComTransicao() {
  const navegar = useNavigate();
  const { pathname } = useLocation();
  return (para: string, direcao?: Direcao) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const atual = semBarra(pathname);
    if (atual === para) return;
    const dir = direcao ?? (ordemTela(para) < ordemTela(atual) ? 'tras' : 'frente');
    if (trocarComTransicao(() => navegar(para), dir)) e.preventDefault();
  };
}

function AvisoNovaVersao() {
  const [nova, setNova] = useState(() => !!(window as { novaVersao?: boolean }).novaVersao);
  useEffect(() => {
    const ver = () => setNova(true);
    window.addEventListener('nova-versao', ver);
    return () => window.removeEventListener('nova-versao', ver);
  }, []);
  if (!nova) return null;
  return (
    <div className="alerta info" style={{ marginBottom: 14, alignItems: 'center' }}>
      <span className="cresce">Nova versão do app disponível.</span>
      <button className="botao pequeno primario" onClick={() => location.reload()}>
        Atualizar
      </button>
    </div>
  );
}

function hora(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date().toDateString() === d.toDateString();
  return d.toLocaleString('pt-BR', hoje ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Sem internet, gravações na fila, erros: avisos curtos no topo */
function Avisos() {
  const { erro, setErro, offlineDesde, falhaRede, pendentes, recarregar } = useDados();
  return (
    <>
      <AvisoNovaVersao />
      {offlineDesde && (
        <div className="alerta" style={{ marginBottom: 14, alignItems: 'center' }}>
          <span className="cresce">
            Sem conexão · dados de {hora(offlineDesde)}
            {pendentes ? ` · ${pendentes} registro(s) guardado(s) para enviar` : ''}
          </span>
          <button className="botao pequeno" onClick={() => void recarregar()}>
            Tentar
          </button>
        </div>
      )}
      {!offlineDesde && pendentes > 0 && falhaRede && (
        <div className="alerta" style={{ marginBottom: 14, alignItems: 'center' }}>
          <span className="cresce">Sem conexão · {pendentes} registro(s) guardado(s) no aparelho, enviando quando a internet voltar</span>
          <button className="botao pequeno" onClick={() => void recarregar()}>
            Tentar
          </button>
        </div>
      )}
      {erro && (
        <div className="alerta erro" style={{ marginBottom: 14, alignItems: 'center' }} role="alert">
          <span className="cresce">{erro}</span>
          <button className="icone-botao" aria-label="Fechar aviso" onClick={() => setErro(null)} style={{ width: 32, height: 32 }}>
            <Icone nome="fechar" />
          </button>
        </div>
      )}
    </>
  );
}

function AvisoRapido() {
  const { aviso, mostrarAviso } = useDados();
  if (!aviso) return null;
  return (
    <div className="aviso-rapido" role="status">
      <span className="cresce">{aviso.texto}</span>
      {aviso.desfazer && (
        <button
          onClick={() => {
            aviso.desfazer?.();
            mostrarAviso(null);
          }}
        >
          Desfazer
        </button>
      )}
    </div>
  );
}

/** Capa encolhe com a rolagem por CSS (animation-timeline: scroll()); sem esse recurso (Safari até o 18), um ouvinte leve de rolagem */
const capaPorCss = () => {
  try {
    return CSS.supports('animation-timeline: scroll()');
  } catch {
    return false;
  }
};

/**
 * Capa do Hoje: foto grande do bebê (ou a ilustração) que se funde com o fundo, nome e idade em
 * destaque. Ao rolar, encolhe até o topo compacto (foto redonda + nome), que fica grudado.
 * A altura é fixa desde o início (a foto chegando depois não empurra a tela).
 */
function CapaHoje({ nome, sub }: { nome: string; sub: string }) {
  const ref = useRef<HTMLElement>(null);
  const [porJs] = useState(() => !capaPorCss());
  useEffect(() => {
    const el = ref.current;
    if (!porJs || !el) return;
    let quadro = 0;
    let percurso = 1;
    const medir = () => {
      percurso = Math.max(1, -parseFloat(getComputedStyle(el).top) || 1);
    };
    const pintar = () => {
      quadro = 0;
      const p = Math.min(1, Math.max(0, window.scrollY / percurso));
      el.style.setProperty('--capa-p', p.toFixed(4));
    };
    const rolar = () => {
      if (!quadro) quadro = requestAnimationFrame(pintar);
    };
    const redimensionar = () => {
      medir();
      rolar();
    };
    medir();
    pintar();
    window.addEventListener('scroll', rolar, { passive: true });
    window.addEventListener('resize', redimensionar);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener('scroll', rolar);
      window.removeEventListener('resize', redimensionar);
    };
  }, [porJs]);
  return (
    <header ref={ref} className={`topo capa${porJs ? ' capa-js' : ''}`}>
      <div className="capa-foto" aria-hidden="true">
        <FotoCapa classe="capa-img" />
      </div>
      <div className="capa-grande" aria-hidden="true">
        <span className="capa-nome">{nome}</span>
        {sub && <span className="capa-idade">{sub}</span>}
      </div>
      <div className="capa-barra">
        <div className="topo-marca capa-compacta">
          <AvatarBebe classe="marca-mini" />
          <div style={{ minWidth: 0 }}>
            <h1>{nome}</h1>
            {sub && <div className="sub">{sub}</div>}
          </div>
        </div>
        <Link to="/noite" className="icone-botao capa-lua" aria-label="Modo noite">
          <Icone nome="lua" />
        </Link>
      </div>
    </header>
  );
}

function Cabecalho() {
  const { bebe, hoje } = useDados();
  const { pathname: bruto } = useLocation();
  const comTransicao = useLinkComTransicao();
  // "/historico/" é a mesma tela que "/historico"
  const pathname = semBarra(bruto);
  const agora = useAgora(60_000);
  const aba = ABAS.find((a) => a.para === pathname);
  const secao = pathname.startsWith('/mais/') ? SECOES_MAIS.find((s) => pathname === `/mais/${s.id}`) : null;
  const nome = bebe?.nome.trim() || 'Bebê';
  let sub = '';
  if (bebe?.nascimento) sub = idadeBebe(bebe.nascimento, agora);
  else if (bebe?.data_prevista) {
    const g = semanasGestacao(bebe.data_prevista, hoje);
    sub = g.faltam > 0 ? `chega em ${g.faltam} ${g.faltam === 1 ? 'dia' : 'dias'}` : 'chegando!';
  }
  if (pathname === '/') return <CapaHoje nome={nome} sub={sub} />;
  return (
    <header className="topo">
      <div className="topo-marca">
        {secao ? (
          <Link to="/mais" className="icone-botao" aria-label="Voltar" onClick={comTransicao('/mais', 'tras')}>
            <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
              <Icone nome="seta" />
            </span>
          </Link>
        ) : (
          <AvatarBebe classe="marca-mini" />
        )}
        <div style={{ minWidth: 0 }}>
          <h1>{secao?.titulo ?? aba?.rotulo ?? 'Mais'}</h1>
        </div>
      </div>
    </header>
  );
}

const ROTAS_ABAS = ABAS.map((a) => a.para);

function Estrutura() {
  const { pathname } = useLocation();
  const { recarregar } = useDados();
  const navegar = useNavigate();
  const comTransicao = useLinkComTransicao();
  // Cada aba abre do topo; antes da tela aparecer, para a transição já mostrar o topo da tela nova
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    telaTrocada();
  }, [pathname]);
  return (
    <>
      <div className="app">
        <Cabecalho />
        <Avisos />
        <main>
          <Protecao chave={pathname}>
            <Routes>
              <Route path="/" element={<Hoje />} />
              <Route path="/historico" element={<Historico />} />
              <Route path="/saude" element={<Saude />} />
              <Route path="/documentos" element={<SecaoDocumentos />} />
              <Route path="/cofrinho" element={<Cofrinho />} />
              <Route path="/mais/documentos" element={<Navigate to="/documentos" replace />} />
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/mais" element={<TelaMais />} />
              <Route path="/mais/:secao" element={<TelaMais />} />
              <Route path="/ajustes" element={<Navigate to="/mais/ajustes" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Protecao>
        </main>
      </div>
      <AvisoRapido />
      <SincronizarDocumentos />
      <GestosNavegacao
        abas={ROTAS_ABAS}
        atual={semBarra(pathname)}
        atualizar={recarregar}
        irPara={(para, sentido, antes) => {
          const ir = () => {
            antes();
            navegar(para);
          };
          if (!trocarComTransicao(ir, sentido === 'proxima' ? 'frente' : 'tras')) ir();
        }}
      />
      <nav className="nav" aria-label="Navegação principal">
        <div className="nav-itens">
          {ABAS.map((a) => (
            <NavLink key={a.para} to={a.para} end={a.para !== '/mais'} className={({ isActive }) => (isActive ? 'ativo' : '')} onClick={comTransicao(a.para)}>
              <Icone nome={a.icone} />
              {'curto' in a && a.curto ? (
                <>
                  <span className="rotulo-longo">{a.rotulo}</span>
                  <span className="rotulo-curto" aria-hidden="true">
                    {a.curto}
                  </span>
                </>
              ) : (
                a.rotulo
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}

/** Enquanto carrega: o formato da tela (topo, cartões e abas) com um brilho suave, no lugar de "Carregando…" */
function Esqueleto() {
  const linha = (largura: string, classe = '') => <span className={`esq esq-linha ${classe}`} style={{ width: largura }} />;
  // Fora do roteador: a rota vem do endereço (o Hoje tem a capa alta)
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const naCapa = semBarra(location.pathname.slice(base.length) || '/') === '/';
  return (
    <div className="esqueleto" role="status" aria-busy="true">
      <span className="oculto-visual">Carregando…</span>
      <div className="app" aria-hidden="true">
        {naCapa ? (
          // No Hoje, a mesma altura da capa (foto grande): o conteúdo não pula quando os dados chegam
          <div className="topo capa esq-capa">
            <span className="esq esq-capa-foto" />
            <div className="capa-grande">
              {linha('150px', 'esq-capa-nome')}
              {linha('76px', 'esq-capa-idade')}
            </div>
          </div>
        ) : (
          <div className="topo">
            <div className="topo-marca">
              <span className="esq esq-avatar" />
              <div className="pilha-p" style={{ gap: 8 }}>
                {linha('120px', 'esq-titulo')}
                {linha('84px')}
              </div>
            </div>
          </div>
        )}
        <div className="pilha">
          <div className="cartao destaque pilha-p">
            {linha('40%')}
            {linha('62%', 'esq-numero')}
            {linha('75%')}
          </div>
          <div className="acoes">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="acao">
                <span className="esq esq-selo" />
                {linha('58%')}
                {linha('80%')}
              </div>
            ))}
          </div>
          <div className="cartao pilha">
            {linha('34%')}
            {[0, 1, 2].map((i) => (
              <div key={i} className="linha" style={{ flexWrap: 'nowrap' }}>
                <span className="esq esq-selo" />
                <div className="cresce pilha-p">
                  {linha('55%')}
                  {linha('35%')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="nav" aria-hidden="true">
        <div className="nav-itens">
          {ABAS.map((a) => (
            <span key={a.para} className="esq-aba">
              <span className="esq esq-icone" />
              <span className="esq esq-rotulo" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SemConexao() {
  const { recarregar, carregando } = useDados();
  return (
    <div className="centro">
      <div className="entrada pilha" style={{ textAlign: 'center' }}>
        <Ilustracao nome="sem-internet" classe="sem-conexao-ilustracao" />
        <h1>Sem conexão com o servidor</h1>
        <p className="mudo">Confira a internet. Se estiver com sinal, o servidor pode estar pausado ou fora do ar.</p>
        <button className="botao primario" disabled={carregando} onClick={() => void recarregar()}>
          {carregando ? 'Tentando…' : 'Tentar de novo'}
        </button>
      </div>
    </div>
  );
}

export function App() {
  const { usuario, carregando, membro, erro, semConexao, recuperandoSenha, falhouCarregar, recarregar } = useDados();
  // Já está numa família: um convite guardado (ex.: abriu o próprio link) não serve mais
  const temFamilia = !!membro;
  useEffect(() => {
    if (temFamilia) limparConvite();
  }, [temFamilia]);
  if (recuperandoSenha) return <NovaSenha />;
  if (semConexao) return <SemConexao />;
  if (carregando && !membro) return <Esqueleto />;
  if (!usuario) return <Entrar />;
  if (!membro) {
    // Falha ao carregar não é conta nova: não abre o primeiro acesso por cima dos dados
    return erro || falhouCarregar ? (
      <div className="centro">
        <div className="pilha" style={{ alignItems: 'center' }}>
          <div className="alerta erro">{erro ?? 'Não foi possível carregar os dados.'}</div>
          <button className="botao primario" onClick={() => void recarregar()}>
            Tentar de novo
          </button>
        </div>
      </div>
    ) : (
      <Configurar />
    );
  }
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route path="/noite" element={<Protecao chave="noite"><Noite /></Protecao>} />
        <Route path="*" element={<Estrutura />} />
      </Routes>
    </BrowserRouter>
  );
}
