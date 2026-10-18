import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Protecao } from './componentes/Protecao';
import { Icone, Marca } from './componentes/ui';
import { useAgora, useDados } from './dados/contexto';
import { idadeBebe, semanasGestacao } from './lib/datas';
import { Agenda } from './paginas/Agenda';
import { Ajustes } from './paginas/Ajustes';
import { Configurar } from './paginas/Configurar';
import { Entrar, NovaSenha } from './paginas/Entrar';
import { Historico } from './paginas/Historico';
import { Hoje } from './paginas/Hoje';

const ABAS = [
  { para: '/', rotulo: 'Hoje', icone: 'hoje' },
  { para: '/historico', rotulo: 'Histórico', icone: 'historico' },
  { para: '/agenda', rotulo: 'Agenda', icone: 'agenda' },
  { para: '/ajustes', rotulo: 'Ajustes', icone: 'ajustes' },
];

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

function Cabecalho() {
  const { bebe, hoje } = useDados();
  const { pathname } = useLocation();
  const agora = useAgora(60_000);
  const aba = ABAS.find((a) => a.para === pathname);
  const nome = bebe?.nome.trim() || 'Bebê';
  let sub = '';
  if (bebe?.nascimento) sub = idadeBebe(bebe.nascimento, agora);
  else if (bebe?.data_prevista) {
    const g = semanasGestacao(bebe.data_prevista, hoje);
    sub = g.faltam > 0 ? `chega em ${g.faltam} ${g.faltam === 1 ? 'dia' : 'dias'}` : 'chegando!';
  }
  return (
    <header className="topo">
      <div className="topo-marca">
        <Marca classe="marca-mini" />
        <div style={{ minWidth: 0 }}>
          <h1>{pathname === '/' ? nome : aba?.rotulo}</h1>
          {pathname === '/' && sub && <div className="sub">{sub}</div>}
        </div>
      </div>
    </header>
  );
}

function Estrutura() {
  const { pathname } = useLocation();
  // Cada aba abre do topo
  useEffect(() => {
    window.scrollTo(0, 0);
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
              <Route path="/agenda" element={<Agenda />} />
              <Route path="/ajustes" element={<Ajustes />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Protecao>
        </main>
      </div>
      <AvisoRapido />
      <nav className="nav" aria-label="Navegação principal">
        <div className="nav-itens">
          {ABAS.map((a) => (
            <NavLink key={a.para} to={a.para} end className={({ isActive }) => (isActive ? 'ativo' : '')}>
              <Icone nome={a.icone} />
              {a.rotulo}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}

function SemConexao() {
  const { recarregar, carregando } = useDados();
  return (
    <div className="centro">
      <div className="entrada pilha" style={{ textAlign: 'center' }}>
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
  if (recuperandoSenha) return <NovaSenha />;
  if (semConexao) return <SemConexao />;
  if (carregando && !membro) {
    return (
      <div className="centro">
        <p className="mudo">Carregando…</p>
      </div>
    );
  }
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
      <Estrutura />
    </BrowserRouter>
  );
}
