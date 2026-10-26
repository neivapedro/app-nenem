import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SUPABASE_KEY, SUPABASE_URL } from '../config';
import { hojeLocal, inicioDoDia, somarDiasLocal } from '../lib/datas';
import { ehErroDeRede, ehSessaoExpirada, traduzirErro } from '../lib/erros';
import { esquecerAparelho, sincronizarInscricao } from '../lib/notificacoes';
import { COLECOES, type Bebe, type Compromisso, type Membro, type Registro } from '../lib/tipos';
import { apagarTudoLocal } from '../lib/offline-docs';
import { apagarDadosLocais, aplicarFila, enfileirar, executarOperacao, gravarCache, gravarFila, lerCache, lerFila, LISTAS_VAZIAS, type ItemFila, type ListasColecoes, type Operacao } from './fila';
import { RepositorioLocal } from './local';
import type { Repositorio, Usuario } from './repositorio';
import { RepositorioSupabase } from './supabase';

export const repositorio: Repositorio = SUPABASE_URL && SUPABASE_KEY ? new RepositorioSupabase(SUPABASE_URL, SUPABASE_KEY) : new RepositorioLocal();

/** Quantos dias de registros o app carrega ao abrir (o Histórico pode pedir mais) */
const DIAS_INICIAIS = 45;

interface Dados extends ListasColecoes {
  membro: Membro | null;
  membros: Membro[];
  bebe: Bebe | null;
  registros: Registro[];
  compromissos: Compromisso[];
}

const VAZIO: Dados = { ...LISTAS_VAZIAS, membro: null, membros: [], bebe: null, registros: [], compromissos: [] };

export interface AvisoRapido {
  texto: string;
  desfazer?: () => void;
}

interface Contexto extends Dados {
  repo: Repositorio;
  usuario: Usuario | null;
  carregando: boolean;
  erro: string | null;
  setErro: (msg: string | null) => void;
  /** Aviso curto no rodapé ("Fralda registrada · Desfazer") */
  aviso: AvisoRapido | null;
  mostrarAviso: (a: AvisoRapido | null) => void;
  /** Sem conexão: mostrando a última cópia guardada no aparelho (data/hora ISO) */
  offlineDesde: string | null;
  /** O último envio da fila falhou por falta de conexão */
  falhaRede: boolean;
  /** Abriu sem internet e sem cópia guardada */
  semConexao: boolean;
  /** A última carga falhou (não confundir com conta nova sem família) */
  falhouCarregar: boolean;
  /** Gravações guardadas no aparelho esperando internet */
  pendentes: number;
  recuperandoSenha: boolean;
  encerrarRecuperacao: () => void;
  recarregar: () => Promise<void>;
  sair: () => Promise<void>;
  /** Executa uma gravação direta (precisa de internet) e recarrega os dados */
  executar: (fn: (repo: Repositorio) => Promise<unknown>) => Promise<boolean>;
  /** Grava pela fila: a tela muda na hora e o envio funciona mesmo sem internet */
  gravar: (...ops: Operacao[]) => void;
  /** Data de hoje (vira à meia-noite mesmo com o app aberto) */
  hoje: string;
  /** Primeiro dia com registros carregados */
  carregadoDesde: string;
  carregarMais: () => Promise<void>;
  /** Nome curto de quem registrou ("você" para a própria conta) */
  nomeDe: (userId: string | null) => string;
  /** Campos comuns de um registro novo */
  baseRegistro: () => Pick<Registro, 'id' | 'familia_id' | 'bebe_id' | 'criado_por'>;
}

const Ctx = createContext<Contexto | null>(null);

export function ProvedorDados({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [dados, setDados] = useState<Dados>(VAZIO);
  const dadosRef = useRef<Dados>(VAZIO);
  const mudarDados = useCallback((fn: (d: Dados) => Dados) => {
    dadosRef.current = fn(dadosRef.current);
    setDados(dadosRef.current);
  }, []);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErroBruto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<AvisoRapido | null>(null);
  const [offlineDesde, setOfflineDesde] = useState<string | null>(null);
  const [semConexao, setSemConexao] = useState(false);
  const [falhouCarregar, setFalhouCarregar] = useState(false);
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);
  const [hoje, setHoje] = useState(() => hojeLocal());
  const [dias, setDias] = useState(DIAS_INICIAIS);
  const diasRef = useRef(DIAS_INICIAIS);
  const carregouNaSessao = useRef(false);
  /** Hora da última carga completa (o tempo real não recarrega de novo logo em seguida) */
  const ultimaRecarga = useRef(0);

  const uid = useRef<string | null>(null);
  const geracao = useRef(0);
  const fila = useRef<ItemFila[]>([]);
  const versao = useRef(0);
  const [pendentes, setPendentes] = useState(0);
  const [falhaRede, setFalhaRede] = useState(false);
  const enviando = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const timerErro = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const timerAviso = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const setErro = useCallback((msg: string | null) => {
    setErroBruto(msg);
    clearTimeout(timerErro.current);
    if (msg) timerErro.current = setTimeout(() => setErroBruto(null), 8000);
  }, []);

  const mostrarAviso = useCallback((a: AvisoRapido | null) => {
    setAviso(a);
    clearTimeout(timerAviso.current);
    if (a) timerAviso.current = setTimeout(() => setAviso(null), 6000);
  }, []);

  const atualizarFila = useCallback((nova: ItemFila[]) => {
    fila.current = nova;
    if (uid.current) gravarFila(uid.current, nova);
    setPendentes(nova.length);
  }, []);

  /** true = buscou do servidor; false = ficou com o que tinha (sem internet ou sem conta) */
  const carregar = useCallback(async (): Promise<boolean> => {
    // Cada carga tem um número: uma carga lenta que termina depois de outra mais nova não sobrescreve a tela
    const minha = ++geracao.current;
    const u = await repositorio.usuarioAtual();
    // Mesmo usuário: mantém o objeto (senão o tempo real se reinscreve a cada carga)
    setUsuario((antes) => (antes?.id === u?.id && antes?.email === u?.email ? antes : u));
    if (!u) {
      uid.current = null;
      // A fila de outra conta não pode ser enviada sem sessão (ela continua guardada no aparelho)
      fila.current = [];
      setPendentes(0);
      mudarDados(() => VAZIO);
      return false;
    }
    if (uid.current !== u.id) {
      uid.current = u.id;
      fila.current = lerFila(u.id);
      versao.current = Math.max(versao.current, 0, ...fila.current.map((i) => i.versao));
      setPendentes(fila.current.length);
    }
    // Primeira carga: mostra logo a cópia guardada (abrir sem internet não fica em "Carregando…")
    if (!carregouNaSessao.current && repositorio.modo === 'nuvem') {
      const c = lerCache<Dados>(u.id);
      if (c) {
        mudarDados(() => aplicarFila({ ...VAZIO, ...c.dados }, fila.current));
        // Sem internet nenhuma (modo avião): nem tenta o servidor
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          setOfflineDesde(c.em);
          return false;
        }
      }
    }
    let base: Dados;
    try {
      const familia = await repositorio.obterFamilia();
      if (!familia) {
        base = VAZIO;
        // Saiu ou foi tirado da família: a cópia guardada dela não pode reaparecer na próxima abertura
        if (repositorio.modo === 'nuvem') apagarDadosLocais(u.id);
      } else {
        const desde = inicioDoDia(somarDiasLocal(hojeLocal(), -diasRef.current)).toISOString();
        const [registros, compromissos, ...listas] = await Promise.all([
          repositorio.listarRegistros(desde),
          repositorio.listarCompromissos(),
          ...COLECOES.map((c) => repositorio.listarColecao(c)),
        ]);
        const colecoes = Object.fromEntries(COLECOES.map((c, i) => [c, listas[i]])) as unknown as ListasColecoes;
        base = { ...colecoes, membro: familia.membro, membros: familia.membros, bebe: familia.bebe, registros, compromissos };
        if (minha !== geracao.current) return false;
        if (repositorio.modo === 'nuvem') gravarCache(u.id, base);
      }
      setFalhouCarregar(false);
      carregouNaSessao.current = true;
      ultimaRecarga.current = Date.now();
      setOfflineDesde(null);
      setSemConexao(false);
    } catch (e) {
      if (minha !== geracao.current) return false;
      if (!ehErroDeRede(e)) {
        setFalhouCarregar(true);
        throw e;
      }
      // Já carregou nesta sessão: a tela tem dados mais novos que a cópia guardada
      if (carregouNaSessao.current) {
        setOfflineDesde((d) => d ?? new Date().toISOString());
        return false;
      }
      const cache = lerCache<Dados>(u.id);
      if (!cache) {
        setSemConexao(true);
        return false;
      }
      base = { ...VAZIO, ...cache.dados };
      setOfflineDesde(cache.em);
      mudarDados(() => aplicarFila(base, fila.current));
      return false;
    }
    if (minha !== geracao.current) return false;
    mudarDados(() => aplicarFila(base, fila.current));
    return true;
  }, [mudarDados]);

  // Envia a fila, uma operação de cada vez
  const processarFila = useCallback(async () => {
    clearTimeout(timer.current);
    if (enviando.current || !fila.current.length) return;
    enviando.current = true;
    let enviou = false;
    let esperar = false;
    try {
      while (fila.current.length) {
        const item = fila.current[0];
        try {
          await executarOperacao(repositorio, item);
          enviou = true;
          if (uid.current && repositorio.modo === 'nuvem') {
            const c = lerCache<Dados>(uid.current);
            if (c) gravarCache(uid.current, aplicarFila(c.dados, [item]), c.em);
          }
          // Só sai da fila se não foi substituída por uma edição mais nova durante o envio
          atualizarFila(fila.current.filter((i) => !(i.chave === item.chave && i.versao === item.versao)));
        } catch (e) {
          if (ehErroDeRede(e)) {
            esperar = true;
            setFalhaRede(true);
            timer.current = setTimeout(() => void processarFila(), 15000);
            return;
          }
          if (ehSessaoExpirada(e)) {
            esperar = true;
            setFalhaRede(true);
            setErro('Sessão expirada. Entre novamente: o que você registrou continua guardado no aparelho.');
            // O token costuma renovar sozinho: tenta de novo daqui a pouco
            timer.current = setTimeout(() => void processarFila(), 15000);
            return;
          }
          // Erro de dados: descarta a operação e mostra o motivo
          atualizarFila(fila.current.filter((i) => i !== item));
          setErro(traduzirErro(e));
          await carregar().catch(() => undefined);
        }
      }
      setFalhaRede(false);
      if (enviou) await carregar().catch(() => undefined);
    } finally {
      enviando.current = false;
      if (!esperar && fila.current.length) void processarFila();
    }
  }, [atualizarFila, carregar, setErro]);

  const gravar = useCallback(
    (...ops: Operacao[]) => {
      let nova = fila.current;
      for (const op of ops) nova = enfileirar(nova, op, ++versao.current);
      atualizarFila(nova);
      mudarDados((d) => aplicarFila(d, ops));
      void processarFila();
    },
    [atualizarFila, mudarDados, processarFila],
  );

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      await carregar();
      await processarFila();
    } catch (e) {
      setErro(traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  }, [carregar, processarFila, setErro]);

  // Recarga em segundo plano (mudança do outro membro, volta ao app): sem "Carregando…"
  const timerSilencioso = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const recarregarSilencioso = useCallback(() => {
    clearTimeout(timerSilencioso.current);
    timerSilencioso.current = setTimeout(() => {
      // Com gravações saindo, a fila recarrega sozinha ao terminar (fila parada não impede: o pendente é reaplicado por cima)
      if (enviando.current || !uid.current) return;
      carregar().catch(() => undefined);
    }, 400);
  }, [carregar]);

  const sair = useCallback(async () => {
    const id = uid.current;
    await esquecerAparelho(repositorio).catch(() => undefined);
    await repositorio.sair();
    if (id) apagarDadosLocais(id);
    await apagarTudoLocal();
    try {
      localStorage.removeItem('heitor:foto-bebe'); // miniatura da foto do bebê (avatar.tsx)
    } catch {
      /* sem armazenamento */
    }
    carregouNaSessao.current = false;
    await recarregar();
  }, [recarregar]);

  const executar = useCallback(
    async (fn: (repo: Repositorio) => Promise<unknown>) => {
      try {
        await fn(repositorio);
        await carregar();
        return true;
      } catch (e) {
        setErro(traduzirErro(e));
        return false;
      }
    },
    [carregar, setErro],
  );

  const carregarMais = useCallback(async () => {
    // Só passa a dizer que carregou mais dias se a busca deu certo (sem internet, volta como estava)
    const antes = diasRef.current;
    diasRef.current += 60;
    const ok = await carregar().catch((e) => {
      setErro(traduzirErro(e));
      return false;
    });
    if (ok) setDias(diasRef.current);
    else {
      diasRef.current = antes;
      setErro('Sem internet: não deu para buscar os dias mais antigos.');
    }
  }, [carregar, setErro]);

  // Abertura, login/logout e link de nova senha
  useEffect(() => {
    void recarregar();
    const pararUsuario = repositorio.aoMudarUsuario((u) => {
      if ((u?.id ?? null) !== uid.current) {
        carregouNaSessao.current = false;
        void recarregar();
      }
    });
    const pararRecuperacao = repositorio.aoRecuperarSenha(() => setRecuperandoSenha(true));
    return () => {
      pararUsuario();
      pararRecuperacao();
    };
  }, [recarregar]);

  // Tempo real: o que o outro membro registra aparece aqui
  const temFamilia = !!dados.membro;
  const usuarioId = usuario?.id ?? null;
  useEffect(() => {
    if (!usuarioId || !temFamilia) return;
    return repositorio.aoMudarDados(() => {
      // Logo depois de uma carga completa, a confirmação da conexão não precisa recarregar
      if (Date.now() - ultimaRecarga.current < 1500) return;
      recarregarSilencioso();
    });
  }, [usuarioId, temFamilia, recarregarSilencioso]);

  // Ao voltar para o app: dados novos, fila pendente e a data de hoje
  useEffect(() => {
    const voltar = () => {
      if (document.visibilityState !== 'visible') return;
      setHoje(hojeLocal());
      recarregarSilencioso();
      void processarFila();
    };
    const online = () => void processarFila().then(recarregarSilencioso);
    document.addEventListener('visibilitychange', voltar);
    window.addEventListener('online', online);
    // Rede de segurança se o tempo real cair: confere a cada minuto com o app aberto
    const intervalo = setInterval(() => {
      setHoje(hojeLocal());
      if (document.visibilityState === 'visible') recarregarSilencioso();
    }, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', voltar);
      window.removeEventListener('online', online);
      clearInterval(intervalo);
    };
  }, [processarFila, recarregarSilencioso]);

  // Aparelho com avisos ligados: garante a inscrição para a conta atual
  useEffect(() => {
    if (usuarioId && temFamilia) sincronizarInscricao(repositorio).catch(() => undefined);
  }, [usuarioId, temFamilia]);

  const nomeDe = useCallback(
    (userId: string | null) => {
      if (!userId) return '';
      if (userId === usuario?.id) return 'você';
      const m = dados.membros.find((x) => x.user_id === userId);
      return m?.nome.split(' ')[0] || 'outro responsável';
    },
    [dados.membros, usuario],
  );

  const baseRegistro = useCallback(
    () => ({
      id: crypto.randomUUID(),
      familia_id: dadosRef.current.membro?.familia_id ?? '',
      bebe_id: dadosRef.current.bebe?.id ?? '',
      criado_por: uid.current,
    }),
    [],
  );

  const valor = useMemo<Contexto>(
    () => ({
      ...dados,
      repo: repositorio,
      usuario,
      carregando,
      erro,
      setErro,
      aviso,
      mostrarAviso,
      offlineDesde,
      falhaRede,
      semConexao,
      falhouCarregar,
      pendentes,
      recuperandoSenha,
      encerrarRecuperacao: () => setRecuperandoSenha(false),
      recarregar,
      sair,
      executar,
      gravar,
      hoje,
      carregadoDesde: somarDiasLocal(hoje, -dias),
      carregarMais,
      nomeDe,
      baseRegistro,
    }),
    [
      dados,
      usuario,
      carregando,
      erro,
      setErro,
      aviso,
      mostrarAviso,
      offlineDesde,
      falhaRede,
      semConexao,
      falhouCarregar,
      pendentes,
      recuperandoSenha,
      recarregar,
      sair,
      executar,
      gravar,
      hoje,
      dias,
      carregarMais,
      nomeDe,
      baseRegistro,
    ],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useDados(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDados fora do ProvedorDados');
  return c;
}

/** Relógio que atualiza a cada `ms` (para cronômetros e "há X min") */
export function useAgora(ms = 1000): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), ms);
    const voltar = () => document.visibilityState === 'visible' && setAgora(new Date());
    document.addEventListener('visibilitychange', voltar);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', voltar);
    };
  }, [ms]);
  return agora;
}
