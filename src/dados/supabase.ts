import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ehErroDeRede } from '../lib/erros';
import type { Bebe, Colecoes, Compromisso, Convite, Membro, NomeColecao, NovaFamilia, PreferenciasMembro, Registro } from '../lib/tipos';
import type { Familia, InscricaoPush, Repositorio, Usuario } from './repositorio';

// O isolamento entre famílias é garantido no banco (Row Level Security, ver
// supabase/migrations): mesmo que o app pedisse dados de outra família, o
// Postgres só devolve as linhas da família da conta logada.

/** Erro do servidor com o status HTTP e o código do PostgREST (separa falha temporária de erro de dados). */
export class ErroServidor extends Error {
  constructor(
    mensagem: string,
    readonly status?: number,
    readonly code?: string,
  ) {
    super(mensagem);
  }
}

function erro<T>(r: { data: T; error: { message: string; code?: string } | null; status?: number }): T {
  if (r.error) throw new ErroServidor(r.error.message, r.status, r.error.code);
  return r.data;
}

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

/** Mensagens do login em português. */
function traduzirAuth(msg: string): string {
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/already registered/i.test(msg)) return 'Esse e-mail já tem conta. Use Entrar (é o mesmo login do Diário de Carga e do app-dieta).';
  if (/rate limit|for security purposes/i.test(msg)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  if (/should be different/i.test(msg)) return 'A senha nova precisa ser diferente da atual.';
  if (/signups not allowed|signup is disabled/i.test(msg)) return 'O cadastro de contas novas está fechado.';
  if (/password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
  return msg;
}

function fusoDoAparelho(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
}

function paraMembro(d: any): Membro {
  return {
    familia_id: d.familia_id,
    user_id: d.user_id,
    nome: d.nome ?? '',
    fuso_horario: d.fuso_horario ?? 'America/Sao_Paulo',
    lembrete_mamada: d.lembrete_mamada === true,
    lembrete_mamada_min: Number(d.lembrete_mamada_min ?? 180),
    lembrete_agenda: d.lembrete_agenda !== false,
    // Colunas da Fase 2 (ausentes no banco antigo = padrão)
    lembrete_remedio: d.lembrete_remedio !== false,
    lembrete_vacina: d.lembrete_vacina !== false,
    token_calendario: d.token_calendario ?? null,
  };
}

function paraBebe(d: any): Bebe {
  return {
    id: d.id,
    familia_id: d.familia_id,
    nome: d.nome ?? '',
    sexo: d.sexo ?? null,
    data_prevista: d.data_prevista ?? null,
    nascimento: d.nascimento ?? null,
    peso_nascer_g: num(d.peso_nascer_g),
    altura_nascer_cm: num(d.altura_nascer_cm),
    pc_nascer_cm: num(d.pc_nascer_cm),
    calendario_vacinal: d.calendario_vacinal === 'sbp' ? 'sbp' : 'pni',
  };
}

function paraRegistro(d: any): Registro {
  const dados = d.dados ?? {};
  if (d.tipo === 'mamada' && !Array.isArray(dados.segmentos)) dados.segmentos = [];
  return {
    id: d.id,
    familia_id: d.familia_id,
    bebe_id: d.bebe_id,
    tipo: d.tipo,
    inicio: new Date(d.inicio).toISOString(),
    fim: d.fim ? new Date(d.fim).toISOString() : null,
    dados,
    observacao: d.observacao ?? null,
    criado_por: d.criado_por ?? null,
  } as Registro;
}

/** Tabela de cada coleção e os campos numéricos (o PostgREST devolve numeric como texto) */
const TABELAS: Record<NomeColecao, { tabela: string; numeros: string[]; ordem: string }> = {
  medidas: { tabela: 'nenem_medidas', numeros: ['peso_g', 'comprimento_cm', 'pc_cm'], ordem: 'data' },
  vacinas: { tabela: 'nenem_vacinas', numeros: [], ordem: 'data' },
  remedios: { tabela: 'nenem_remedios', numeros: ['intervalo_h'], ordem: 'criado_em' },
  leite: { tabela: 'nenem_leite', numeros: ['ml'], ordem: 'extraido_em' },
  marcos: { tabela: 'nenem_marcos', numeros: [], ordem: 'data' },
  tarefas: { tabela: 'nenem_tarefas', numeros: [], ordem: 'criado_em' },
  documentos: { tabela: 'nenem_documentos', numeros: [], ordem: 'criado_em' },
};

/** Só os campos do app (sem criado_em/atualizado_em) e números como número */
function paraItem<K extends NomeColecao>(nome: K, d: any): Colecoes[K] {
  const { criado_em: _c, atualizado_em: _a, ...resto } = d;
  for (const k of TABELAS[nome].numeros) resto[k] = num(resto[k]);
  if (nome === 'leite') resto.extraido_em = new Date(resto.extraido_em).toISOString();
  return resto as Colecoes[K];
}

function paraCompromisso(d: any): Compromisso {
  return {
    id: d.id,
    familia_id: d.familia_id,
    tipo: d.tipo,
    titulo: d.titulo,
    data: d.data,
    hora: d.hora ? String(d.hora).slice(0, 5) : null,
    duracao_min: Number(d.duracao_min ?? 60),
    local: d.local ?? null,
    observacao: d.observacao ?? null,
    avisar_min: num(d.avisar_min),
    criado_por: d.criado_por ?? null,
  };
}

export class RepositorioSupabase implements Repositorio {
  readonly modo = 'nuvem' as const;
  private sb: SupabaseClient;
  private chaveSessao: string;
  // O link de recuperação chega com #...type=recovery; o cliente limpa o endereço logo ao iniciar
  private abertoParaRecuperar = /type=recovery/.test(location.hash + location.search);

  constructor(url: string, chave: string) {
    this.sb = createClient(url, chave, { auth: { persistSession: true, autoRefreshToken: true } });
    this.chaveSessao = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  }

  /** Sessão guardada no aparelho: sem internet o token não renova, mas você continua logado. */
  private usuarioGuardado(): Usuario | null {
    try {
      const s = JSON.parse(localStorage.getItem(this.chaveSessao) ?? 'null');
      const u = s?.user ?? s?.currentSession?.user;
      return u?.id ? { id: u.id, email: u.email ?? '' } : null;
    } catch {
      return null;
    }
  }

  private async uid(): Promise<string> {
    const u = await this.usuarioAtual();
    if (!u) throw new Error('Sessão expirada. Entre novamente.');
    return u.id;
  }

  async usuarioAtual(): Promise<Usuario | null> {
    // Sem internet, não espera o cliente tentar renovar o acesso: usa a sessão guardada
    const guardado = this.usuarioGuardado();
    if (guardado && typeof navigator !== 'undefined' && navigator.onLine === false) return guardado;
    try {
      const sessao = this.sb.auth.getSession();
      const limite = guardado ? new Promise<'tempo'>((r) => setTimeout(() => r('tempo'), 4000)) : null;
      const resposta = limite ? await Promise.race([sessao, limite]) : await sessao;
      if (resposta === 'tempo') return guardado;
      const { data, error } = resposta;
      const u = data.session?.user;
      if (u) return { id: u.id, email: u.email ?? '' };
      if (error && ehErroDeRede(error)) return this.usuarioGuardado();
      return null;
    } catch (e) {
      if (ehErroDeRede(e)) return this.usuarioGuardado();
      throw e;
    }
  }

  aoRecuperarSenha(cb: () => void) {
    if (this.abertoParaRecuperar) setTimeout(cb, 0);
    const { data } = this.sb.auth.onAuthStateChange((e) => e === 'PASSWORD_RECOVERY' && cb());
    return () => data.subscription.unsubscribe();
  }

  async definirSenha(nova: string) {
    const { error } = await this.sb.auth.updateUser({ password: nova });
    if (error) throw new Error(traduzirAuth(error.message));
    this.abertoParaRecuperar = false;
  }

  aoMudarUsuario(cb: (u: Usuario | null) => void) {
    const { data } = this.sb.auth.onAuthStateChange((_e, s) => cb(s?.user ? { id: s.user.id, email: s.user.email ?? '' } : null));
    return () => data.subscription.unsubscribe();
  }

  async entrar(email: string, senha: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : traduzirAuth(error.message));
  }

  async cadastrar(email: string, senha: string) {
    const { data, error } = await this.sb.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.origin + import.meta.env.BASE_URL } });
    if (error) throw new Error(traduzirAuth(error.message));
    // E-mail que já tem conta: o Supabase responde "ok" sem enviar e-mail nenhum (lista de identidades vazia)
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('Esse e-mail já tem conta (é o mesmo login do Diário de Carga e do app-dieta). Toque em Entrar e use a mesma senha.');
    }
    return { confirmarEmail: !data.session };
  }

  async recuperarSenha(email: string) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + import.meta.env.BASE_URL });
    if (error) throw new Error(traduzirAuth(error.message));
  }

  async sair() {
    // 'local' remove a sessão do aparelho mesmo sem internet
    const { error } = await this.sb.auth.signOut({ scope: 'local' });
    if (error && !ehErroDeRede(error)) throw new Error(error.message);
    if (error) localStorage.removeItem(this.chaveSessao);
  }

  async obterFamilia(): Promise<Familia | null> {
    const uid = await this.uid();
    const eu = erro(await this.sb.from('nenem_membros').select('*').eq('user_id', uid).maybeSingle());
    if (!eu) return null;
    const [membros, bebes] = await Promise.all([
      this.sb.from('nenem_membros').select('*').eq('familia_id', eu.familia_id).order('criado_em'),
      this.sb.from('nenem_bebes').select('*').eq('familia_id', eu.familia_id).order('criado_em').limit(1),
    ]);
    return {
      membro: paraMembro(eu),
      membros: (erro(membros) ?? []).map(paraMembro),
      bebe: (erro(bebes) ?? []).map(paraBebe)[0] ?? null,
    };
  }

  async criarFamilia(f: NovaFamilia) {
    erro(
      await this.sb.rpc('nenem_criar_familia', {
        p_nome: f.nome,
        p_fuso: fusoDoAparelho(),
        p_bebe_nome: f.bebe_nome,
        p_sexo: f.sexo,
        p_data_prevista: f.data_prevista,
        p_nascimento: f.nascimento,
      }),
    );
  }

  async criarConvite(): Promise<Convite> {
    const d = erro(await this.sb.rpc('nenem_criar_convite'));
    const linha = Array.isArray(d) ? d[0] : d;
    if (!linha?.codigo) throw new Error('Não foi possível gerar o convite.');
    return { codigo: linha.codigo, expira_em: linha.expira_em };
  }

  async entrarFamilia(codigo: string, nome: string) {
    erro(await this.sb.rpc('nenem_entrar_familia', { p_codigo: codigo, p_nome: nome, p_fuso: fusoDoAparelho() }));
  }

  async infoConvite(codigo: string) {
    const { data, error } = await this.sb.rpc('nenem_info_convite', { p_codigo: codigo });
    if (error) return null;
    const linha = Array.isArray(data) ? data[0] : data;
    return linha?.convidou ? { convidou: String(linha.convidou), bebe: String(linha.bebe) } : null;
  }

  async salvarPreferencias(p: PreferenciasMembro) {
    const uid = await this.uid();
    erro(await this.sb.from('nenem_membros').update({ ...p, fuso_horario: fusoDoAparelho() }).eq('user_id', uid));
  }

  async novoTokenCalendario(): Promise<string> {
    const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '');
    erro(await this.sb.from('nenem_membros').update({ token_calendario: token }).eq('user_id', await this.uid()));
    return token;
  }

  async listarColecao<K extends NomeColecao>(nome: K): Promise<Colecoes[K][]> {
    const { tabela, ordem } = TABELAS[nome];
    const r = await this.sb.from(tabela).select('*').order(ordem);
    // Tabela da Fase 2 que ainda não existe no banco: lista vazia (o resto do app segue)
    if (r.error && /does not exist|Could not find|schema cache/i.test(r.error.message)) return [];
    return (erro(r) ?? []).map((d) => paraItem(nome, d));
  }

  async salvarColecao<K extends NomeColecao>(nome: K, item: Colecoes[K]) {
    erro(await this.sb.from(TABELAS[nome].tabela).upsert({ ...item } as Record<string, unknown>));
  }

  async excluirColecao(nome: NomeColecao, id: string) {
    erro(await this.sb.from(TABELAS[nome].tabela).delete().eq('id', id));
  }

  private urls = new Map<string, { url: string; ate: number }>();

  async enviarFoto(arquivo: Blob): Promise<string> {
    const eu = erro(await this.sb.from('nenem_membros').select('familia_id').eq('user_id', await this.uid()).single());
    const familia = (eu as { familia_id: string } | null)?.familia_id;
    if (!familia) throw new Error('Família não encontrada.');
    const caminho = `${familia}/${crypto.randomUUID()}.jpg`;
    const { error } = await this.sb.storage.from('nenem-fotos').upload(caminho, arquivo, { contentType: arquivo.type || 'image/jpeg', upsert: false });
    if (error) throw new ErroServidor(error.message, (error as { statusCode?: number }).statusCode);
    return caminho;
  }

  async urlFoto(caminho: string): Promise<string | null> {
    const guardada = this.urls.get(caminho);
    if (guardada && guardada.ate > Date.now()) return guardada.url;
    const { data, error } = await this.sb.storage.from('nenem-fotos').createSignedUrl(caminho, 60 * 60);
    if (error || !data) return null;
    this.urls.set(caminho, { url: data.signedUrl, ate: Date.now() + 50 * 60_000 });
    return data.signedUrl;
  }

  async excluirFoto(caminho: string) {
    await this.sb.storage.from('nenem-fotos').remove([caminho]);
    this.urls.delete(caminho);
  }

  async enviarArquivo(arquivo: Blob, extensao: 'jpg' | 'pdf'): Promise<string> {
    const eu = erro(await this.sb.from('nenem_membros').select('familia_id').eq('user_id', await this.uid()).single());
    const familia = (eu as { familia_id: string } | null)?.familia_id;
    if (!familia) throw new Error('Família não encontrada.');
    const caminho = `${familia}/${crypto.randomUUID()}.${extensao}`;
    const tipo = extensao === 'pdf' ? 'application/pdf' : 'image/jpeg';
    const { error } = await this.sb.storage.from('nenem-documentos').upload(caminho, arquivo, { contentType: tipo, upsert: false });
    if (error) throw new ErroServidor(error.message, (error as { statusCode?: number }).statusCode);
    return caminho;
  }

  async urlArquivo(caminho: string): Promise<string | null> {
    const chave = `doc:${caminho}`;
    const guardada = this.urls.get(chave);
    if (guardada && guardada.ate > Date.now()) return guardada.url;
    const { data, error } = await this.sb.storage.from('nenem-documentos').createSignedUrl(caminho, 60 * 60);
    if (error || !data) return null;
    this.urls.set(chave, { url: data.signedUrl, ate: Date.now() + 50 * 60_000 });
    return data.signedUrl;
  }

  async baixarArquivo(caminho: string): Promise<Blob> {
    const { data, error } = await this.sb.storage.from('nenem-documentos').download(caminho);
    if (error || !data) throw new ErroServidor(error?.message ?? 'Arquivo não encontrado.', (error as { statusCode?: number } | null)?.statusCode);
    return data;
  }

  async excluirArquivos(caminhos: string[]) {
    if (!caminhos.length) return;
    await this.sb.storage.from('nenem-documentos').remove(caminhos);
    for (const c of caminhos) this.urls.delete(`doc:${c}`);
  }

  async salvarBebe(b: Bebe) {
    erro(await this.sb.from('nenem_bebes').upsert(b));
  }

  async listarRegistros(desde: string): Promise<Registro[]> {
    // Paginado: o PostgREST devolve no máximo 1.000 linhas por pedido
    const todos: Registro[] = [];
    for (let de = 0; ; de += 1000) {
      const d = erro(await this.sb.from('nenem_registros').select('*').gte('inicio', desde).order('inicio', { ascending: false }).range(de, de + 999));
      todos.push(...(d ?? []).map(paraRegistro));
      if (!d || d.length < 1000) break;
    }
    // Em andamento antigos (cronômetro esquecido) também aparecem
    const abertos = erro(await this.sb.from('nenem_registros').select('*').is('fim', null).lt('inicio', desde));
    todos.push(...(abertos ?? []).map(paraRegistro));
    return todos;
  }

  async salvarRegistro(r: Registro) {
    erro(await this.sb.from('nenem_registros').upsert({ ...r } as Record<string, unknown>));
  }

  async excluirRegistro(id: string) {
    erro(await this.sb.from('nenem_registros').delete().eq('id', id));
  }

  async listarCompromissos(): Promise<Compromisso[]> {
    const d = erro(await this.sb.from('nenem_compromissos').select('*').order('data').order('hora', { nullsFirst: true }));
    return (d ?? []).map(paraCompromisso);
  }

  async salvarCompromisso(c: Compromisso) {
    erro(await this.sb.from('nenem_compromissos').upsert(c));
  }

  async excluirCompromisso(id: string) {
    erro(await this.sb.from('nenem_compromissos').delete().eq('id', id));
  }

  async salvarInscricaoPush(i: InscricaoPush) {
    erro(await this.sb.rpc('nenem_assumir_inscricao_push', { p_endpoint: i.endpoint, p_p256dh: i.p256dh, p_auth: i.auth }));
  }

  async removerInscricaoPush(endpoint: string) {
    erro(await this.sb.from('nenem_inscricoes_push').delete().eq('endpoint', endpoint));
  }

  aoMudarDados(cb: () => void) {
    // Sem filtro por família: o banco já só entrega as linhas que a conta pode ver
    // (e exclusões chegam só com o id, então não daria para filtrar)
    const canal = this.sb.channel(`nenem-${crypto.randomUUID()}`);
    for (const tabela of ['nenem_registros', 'nenem_compromissos', 'nenem_bebes', 'nenem_membros', ...Object.values(TABELAS).map((t) => t.tabela)]) {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, () => cb());
    }
    canal.subscribe((estado) => {
      // Reconectou (ex.: voltou do segundo plano): pode ter perdido mudanças
      if (estado === 'SUBSCRIBED') cb();
    });
    return () => {
      void this.sb.removeChannel(canal);
    };
  }
}
