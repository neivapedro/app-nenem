function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
}

/**
 * Falha de conexão ou falha temporária do servidor (sem sinal, fora do ar, pausado,
 * 5xx do Supabase ou do Cloudflare), não um erro de dados: a gravação deve esperar.
 */
export function ehErroDeRede(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const nome = (e as { name?: string })?.name ?? '';
  const status = (e as { status?: unknown })?.status;
  const code = (e as { code?: unknown })?.code;
  // Tabela ou coluna que falta (SQL de evolução não rodou) é erro de dados, não de rede:
  // a mensagem também cita o "schema cache", mas tentar de novo não resolve
  if (typeof code === 'string' && ['PGRST204', 'PGRST205', '42703', '42P01'].includes(code)) return false;
  if (typeof status === 'number' && status >= 500) return true;
  // Muitas requisições: é temporário, a fila espera e tenta de novo
  if (status === 429 || /too many requests|rate limit/i.test(mensagem(e))) return true;
  if (code === 'PGRST002') return true;
  const msg = mensagem(e);
  if (/Could not find the (table|.* column)|column .* does not exist|relation .* does not exist/i.test(msg)) return false;
  return (
    /Retryable/i.test(nome) ||
    /failed to fetch|load failed|networkerror|network request failed|fetch failed|timed? ?out|aborted|ERR_INTERNET|ERR_NETWORK/i.test(msg) ||
    /Could not query the database for the schema cache|bad gateway|service unavailable|gateway time-?out|error code: 5\d\d|^\s*<(!doctype|html)/i.test(msg)
  );
}

/** Acesso vencido ou revogado: a fila espera um novo login em vez de descartar o que foi marcado. */
export function ehSessaoExpirada(e: unknown): boolean {
  const status = (e as { status?: unknown })?.status;
  return status === 401 || /sess[aã]o expirada|sem sess[aã]o|jwt expired|invalid jwt|refresh token/i.test(mensagem(e));
}

/** Mensagem curta em português para mostrar na tela. */
export function traduzirErro(e: unknown): string {
  if (ehErroDeRede(e)) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  const msg = mensagem(e);
  if (ehSessaoExpirada(e)) return 'Sessão expirada. Entre novamente.';
  if (/duplicate key|already exists/i.test(msg)) return 'Esse registro já existe.';
  if (/row-level security/i.test(msg)) return 'Sem permissão para gravar esse dado. Entre novamente.';
  if (/violates check constraint/i.test(msg)) return 'Algum valor está fora do permitido. Confira os números.';
  if (/foreign key/i.test(msg)) return 'Esse item depende de outro que ainda não chegou ao servidor (ou foi excluído). Tente de novo.';
  if (/not-null constraint/i.test(msg)) return 'Falta preencher um campo obrigatório.';
  if (/JSON object requested|multiple \(or no\) rows/i.test(msg)) return 'Não foi possível concluir. Tente de novo.';
  if (/exceeded the maximum allowed size|payload too large|entity too large/i.test(msg)) return 'Arquivo grande demais (máximo 20 MB).';
  if (/mime type .* is not supported|invalid mime/i.test(msg)) return 'Tipo de arquivo não aceito. Use foto (JPG) ou PDF.';
  if (/permission denied/i.test(msg)) return 'Sem permissão para isso. Entre novamente.';
  if (/invalid input syntax/i.test(msg)) return 'Esse registro ainda não chegou ao servidor. Tente de novo em instantes.';
  if (/Importing a module script failed|dynamically imported module|error loading/i.test(msg)) return 'Parte do app não carregou. Recarregue a página.';
  // Nunca mostrar HTML ou corpo cru do servidor
  if (/<[a-z!]/i.test(msg) || msg.length > 200) return 'O servidor recusou a gravação. Tente de novo.';
  return msg;
}
