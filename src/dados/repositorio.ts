import type { Bebe, Colecoes, Compromisso, Convite, Membro, NomeColecao, NovaFamilia, PreferenciasMembro, Registro } from '../lib/tipos';

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
  /** Cancela o convite ainda não usado (ex.: link enviado para a pessoa errada) */
  cancelarConvite(): Promise<void>;
  /** Tira da família alguém que entrou depois de você */
  removerMembro(userId: string): Promise<void>;
  /** Sai da família (só se houver outro responsável) */
  sairFamilia(): Promise<void>;
  entrarFamilia(codigo: string, nome: string): Promise<void>;
  /** Quem convidou e o nome do bebê (null = código inválido, vencido ou já usado) */
  infoConvite(codigo: string): Promise<{ convidou: string; bebe: string } | null>;
  salvarPreferencias(p: PreferenciasMembro): Promise<void>;
  /** Troca o endereço secreto do calendário (o antigo para de funcionar) */
  novoTokenCalendario(): Promise<string>;

  salvarBebe(b: Bebe): Promise<void>;
  /** Grava só a foto do bebê, na hora (fora da fila): a foto antiga só é apagada depois disso dar certo */
  salvarFotoBebe(bebeId: string, caminho: string | null): Promise<void>;

  /** Registros com início a partir de `desde` (ISO) */
  listarRegistros(desde: string): Promise<Registro[]>;
  salvarRegistro(r: Registro): Promise<void>;
  excluirRegistro(id: string): Promise<void>;

  listarCompromissos(): Promise<Compromisso[]>;
  salvarCompromisso(c: Compromisso): Promise<void>;
  excluirCompromisso(id: string): Promise<void>;

  /** Medidas, vacinas, remédios, estoque de leite, marcos e primeiros dias */
  listarColecao<K extends NomeColecao>(nome: K): Promise<Colecoes[K][]>;
  salvarColecao<K extends NomeColecao>(nome: K, item: Colecoes[K]): Promise<void>;
  excluirColecao(nome: NomeColecao, id: string): Promise<void>;

  /** Guarda uma foto (já reduzida) da família e devolve o caminho */
  enviarFoto(arquivo: Blob): Promise<string>;
  /** Endereço temporário para mostrar a foto */
  urlFoto(caminho: string): Promise<string | null>;
  excluirFoto(caminho: string): Promise<void>;

  /** Guarda um arquivo de documento (foto em JPEG ou PDF) da família e devolve o caminho */
  enviarArquivo(arquivo: Blob, extensao: 'jpg' | 'pdf'): Promise<string>;
  /** Endereço temporário para abrir o arquivo */
  urlArquivo(caminho: string): Promise<string | null>;
  /** O arquivo em si (para montar o PDF e compartilhar) */
  baixarArquivo(caminho: string): Promise<Blob>;
  excluirArquivos(caminhos: string[]): Promise<void>;

  salvarInscricaoPush(i: InscricaoPush): Promise<void>;
  removerInscricaoPush(endpoint: string): Promise<void>;

  /** Avisa quando outro membro mudou algo (tempo real). Devolve a função para parar. */
  aoMudarDados(cb: () => void): () => void;
}
