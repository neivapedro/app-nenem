// Convite por link: https://…/app-nenem/?convite=ABC123
// O código fica guardado no aparelho até a pessoa entrar na família (sobrevive
// ao cadastro e ao link de confirmação do e-mail, que abre o app sem o código).

const CHAVE = 'app-nenem:convite';

export function normalizarCodigo(c: string): string {
  return c.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

/** Lê o código do endereço (uma vez, ao abrir) e tira do endereço */
export function capturarConviteDaUrl(): void {
  try {
    const url = new URL(location.href);
    const c = url.searchParams.get('convite');
    if (!c) return;
    const codigo = normalizarCodigo(c);
    if (codigo.length === 6) localStorage.setItem(CHAVE, codigo);
    url.searchParams.delete('convite');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  } catch {
    /* sem armazenamento: a pessoa digita o código */
  }
}

export function conviteGuardado(): string | null {
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function limparConvite(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* nada */
  }
}

export function linkConvite(site: string, codigo: string): string {
  return `${site}?convite=${codigo}`;
}
