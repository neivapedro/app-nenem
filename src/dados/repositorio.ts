import type { Bebe, Compromisso, Convite, Membro, NovaFamilia, PreferenciasMembro, Registro } from '../lib/tipos';

export interface Usuario {
  id: string;
  email: string;
}

export interface InscricaoPush {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** A família da conta logada: o próprio membro, os outros membros e o bebê. */
export interface Familia {
  membro: Membro;
  membros: Membro[];
  bebe: Bebe | null;
}

/** Tudo que o app lê e grava. Cada implementação só enxerga a família do usuário logado. */
export interface Repositorio {
  readonly modo: 'nuvem' | 'local';

  usuarioAtual(): Promise<Usuario | null>;
  aoMudarUsuario(cb: (u: Usuario | null) => void): () => void;
  entrar(email: string, senha: string): Promise<void>;
  cadastrar(email: string, senha: string): Promise<{ confirmarEmail: boolean }>;
  recuperarSenha(email: string): Promise<void>;
  /** Avisa quando o app foi aberto pelo link de "Esqueci minha senha" */
  aoRecuperarSenha(cb: () => void): () => void;
  definirSenha(nova: string): Promise<void>;
  sair(): Promise<void>;

  /** null = a conta ainda não faz parte de uma família */
  obterFamilia(): Promise<Familia | null>;
  criarFamilia(f: NovaFamilia): Promise<void>;
  criarConvite(): Promise<Convite>;
  entrarFamilia(codigo: string, nome: string): Promise<void>;
  salvarPreferencias(p: PreferenciasMembro): Promise<void>;
  /** Troca o endereço secreto do calendário (o antigo para de funcionar) */
  novoTokenCalendario(): Promise<string>;

  salvarBebe(b: Bebe): Promise<void>;

  /** Registros com início a partir de `desde` (ISO) */
  listarRegistros(desde: string): Promise<Registro[]>;
  salvarRegistro(r: Registro): Promise<void>;
  excluirRegistro(id: string): Promise<void>;

  listarCompromissos(): Promise<Compromisso[]>;
  salvarCompromisso(c: Compromisso): Promise<void>;
  excluirCompromisso(id: string): Promise<void>;

  salvarInscricaoPush(i: InscricaoPush): Promise<void>;
  removerInscricaoPush(endpoint: string): Promise<void>;

  /** Avisa quando outro membro mudou algo (tempo real). Devolve a função para parar. */
  aoMudarDados(cb: () => void): () => void;
}
