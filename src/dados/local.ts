import type { Bebe, Colecoes, Compromisso, Convite, Membro, NomeColecao, NovaFamilia, PreferenciasMembro, Registro } from '../lib/tipos';
import type { Familia, InscricaoPush, Repositorio, Usuario } from './repositorio';

// Modo demonstração (sem Supabase): tudo fica no navegador. Serve para testar
// o app localmente ("npm run dev:local"). Uma família só, para quem entrar.

interface Banco {
  usuarios: { id: string; email: string; senha: string }[];
  sessao: string | null;
  familiaId: string | null;
  membros: Membro[];
  bebe: Bebe | null;
  registros: Registro[];
  compromissos: Compromisso[];
  colecoes?: Partial<Record<NomeColecao, { id: string }[]>>;
}

const CHAVE = 'app-nenem:local';

function ler(): Banco {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? 'null');
    if (v) return v as Banco;
  } catch {
    /* começa vazio */
  }
  return { usuarios: [], sessao: null, familiaId: null, membros: [], bebe: null, registros: [], compromissos: [] };
}

function gravar(b: Banco) {
  localStorage.setItem(CHAVE, JSON.stringify(b));
}

const espera = () => new Promise((r) => setTimeout(r, 30));

export class RepositorioLocal implements Repositorio {
  readonly modo = 'local' as const;
  private ouvintes = new Set<(u: Usuario | null) => void>();

  private eu(b = ler()): Usuario | null {
    const u = b.usuarios.find((x) => x.id === b.sessao);
    return u ? { id: u.id, email: u.email } : null;
  }

  private avisar() {
    const u = this.eu();
    this.ouvintes.forEach((cb) => cb(u));
  }

  private exigir(b: Banco): string {
    const u = this.eu(b);
    if (!u) throw new Error('Sessão expirada. Entre novamente.');
    return u.id;
  }

  async usuarioAtual() {
    return this.eu();
  }

  aoMudarUsuario(cb: (u: Usuario | null) => void) {
    this.ouvintes.add(cb);
    return () => this.ouvintes.delete(cb);
  }

  async entrar(email: string, senha: string) {
    await espera();
    const b = ler();
    const u = b.usuarios.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.senha === senha);
    if (!u) throw new Error('E-mail ou senha incorretos.');
    b.sessao = u.id;
    gravar(b);
    this.avisar();
  }

  async cadastrar(email: string, senha: string) {
    await espera();
    const b = ler();
    if (b.usuarios.some((x) => x.email.toLowerCase() === email.toLowerCase())) throw new Error('Esse e-mail já tem conta. Use Entrar.');
    const u = { id: crypto.randomUUID(), email, senha };
    b.usuarios.push(u);
    b.sessao = u.id;
    gravar(b);
    this.avisar();
    return { confirmarEmail: false };
  }

  async recuperarSenha() {
    throw new Error('Indisponível no modo demonstração.');
  }

  aoRecuperarSenha() {
    return () => undefined;
  }

  async definirSenha() {
    /* nada */
  }

  async sair() {
    const b = ler();
    b.sessao = null;
    gravar(b);
    this.avisar();
  }

  async obterFamilia(): Promise<Familia | null> {
    await espera();
    const b = ler();
    const uid = this.exigir(b);
    const membro = b.membros.find((m) => m.user_id === uid);
    if (!membro) return null;
    return { membro, membros: b.membros, bebe: b.bebe };
  }

  private novoMembro(b: Banco, uid: string, nome: string): Membro {
    return {
      familia_id: b.familiaId!,
      user_id: uid,
      nome,
      fuso_horario: 'America/Sao_Paulo',
      lembrete_mamada: false,
      lembrete_mamada_min: 180,
      lembrete_agenda: true,
      lembrete_remedio: true,
      lembrete_vacina: true,
      lembrete_documento: true,
      token_calendario: crypto.randomUUID().replace(/-/g, ''),
    };
  }

  async criarFamilia(f: NovaFamilia) {
    const b = ler();
    const uid = this.exigir(b);
    b.familiaId = crypto.randomUUID();
    b.membros = [this.novoMembro(b, uid, f.nome)];
    b.bebe = {
      id: crypto.randomUUID(),
      familia_id: b.familiaId,
      nome: f.bebe_nome,
      sexo: f.sexo,
      data_prevista: f.data_prevista,
      nascimento: f.nascimento,
      peso_nascer_g: null,
      altura_nascer_cm: null,
      pc_nascer_cm: null,
      calendario_vacinal: 'pni',
    };
    gravar(b);
  }

  async criarConvite(): Promise<Convite> {
    return { codigo: 'DEMO42', expira_em: new Date(Date.now() + 7 * 86_400_000).toISOString() };
  }

  async entrarFamilia(_codigo: string, nome: string) {
    const b = ler();
    const uid = this.exigir(b);
    if (!b.familiaId) throw new Error('Código de convite inválido ou vencido. Peça um código novo.');
    b.membros.push(this.novoMembro(b, uid, nome));
    gravar(b);
  }

  async infoConvite() {
    const b = ler();
    return b.familiaId ? { convidou: b.membros[0]?.nome.split(' ')[0] || 'Alguém', bebe: b.bebe?.nome || 'o bebê' } : null;
  }

  async salvarPreferencias(p: PreferenciasMembro) {
    const b = ler();
    const uid = this.exigir(b);
    b.membros = b.membros.map((m) => (m.user_id === uid ? { ...m, ...p } : m));
    gravar(b);
  }

  async novoTokenCalendario() {
    const b = ler();
    const uid = this.exigir(b);
    const token = crypto.randomUUID().replace(/-/g, '');
    b.membros = b.membros.map((m) => (m.user_id === uid ? { ...m, token_calendario: token } : m));
    gravar(b);
    return token;
  }

  async listarColecao<K extends NomeColecao>(nome: K): Promise<Colecoes[K][]> {
    await espera();
    return (ler().colecoes?.[nome] ?? []) as unknown as Colecoes[K][];
  }

  async salvarColecao<K extends NomeColecao>(nome: K, item: Colecoes[K]) {
    const b = ler();
    const lista = (b.colecoes?.[nome] ?? []).filter((x) => x.id !== item.id);
    b.colecoes = { ...b.colecoes, [nome]: [...lista, item] };
    gravar(b);
  }

  async excluirColecao(nome: NomeColecao, id: string) {
    const b = ler();
    b.colecoes = { ...b.colecoes, [nome]: (b.colecoes?.[nome] ?? []).filter((x) => x.id !== id) };
    gravar(b);
  }

  // Fotos só na memória desta aba (modo demonstração)
  private fotos = new Map<string, string>();

  async enviarFoto(arquivo: Blob) {
    const caminho = `local/${crypto.randomUUID()}.jpg`;
    this.fotos.set(caminho, URL.createObjectURL(arquivo));
    return caminho;
  }

  async urlFoto(caminho: string) {
    return this.fotos.get(caminho) ?? null;
  }

  async excluirFoto(caminho: string) {
    this.fotos.delete(caminho);
  }

  // Arquivos de documentos também só na memória desta aba
  private arquivos = new Map<string, { blob: Blob; url: string }>();

  async enviarArquivo(arquivo: Blob, extensao: 'jpg' | 'pdf') {
    await espera();
    const caminho = `local/${crypto.randomUUID()}.${extensao}`;
    this.arquivos.set(caminho, { blob: arquivo, url: URL.createObjectURL(arquivo) });
    return caminho;
  }

  async urlArquivo(caminho: string) {
    return this.arquivos.get(caminho)?.url ?? null;
  }

  async baixarArquivo(caminho: string) {
    const a = this.arquivos.get(caminho);
    if (!a) throw new Error('Arquivo não encontrado (no modo demonstração os arquivos somem ao recarregar).');
    return a.blob;
  }

  async excluirArquivos(caminhos: string[]) {
    for (const c of caminhos) this.arquivos.delete(c);
  }

  async salvarBebe(bebe: Bebe) {
    await espera();
    const b = ler();
    b.bebe = bebe;
    gravar(b);
  }

  async listarRegistros(desde: string) {
    await espera();
    const t = new Date(desde).getTime();
    return ler().registros.filter((r) => new Date(r.inicio).getTime() >= t || !r.fim);
  }

  async salvarRegistro(r: Registro) {
    await espera();
    const b = ler();
    b.registros = [...b.registros.filter((x) => x.id !== r.id), r];
    gravar(b);
  }

  async excluirRegistro(id: string) {
    const b = ler();
    b.registros = b.registros.filter((x) => x.id !== id);
    gravar(b);
  }

  async listarCompromissos() {
    await espera();
    return ler().compromissos;
  }

  async salvarCompromisso(c: Compromisso) {
    const b = ler();
    b.compromissos = [...b.compromissos.filter((x) => x.id !== c.id), c];
    gravar(b);
  }

  async excluirCompromisso(id: string) {
    const b = ler();
    b.compromissos = b.compromissos.filter((x) => x.id !== id);
    gravar(b);
  }

  async salvarInscricaoPush(_i: InscricaoPush) {
    /* sem servidor de avisos */
  }

  async removerInscricaoPush() {
    /* nada */
  }

  aoMudarDados(cb: () => void) {
    // Outra aba do mesmo navegador mudou algo
    const ouvir = (e: StorageEvent) => e.key === CHAVE && cb();
    window.addEventListener('storage', ouvir);
    return () => window.removeEventListener('storage', ouvir);
  }
}
