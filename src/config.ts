// Mesmo projeto Supabase do Diário de Carga e do app-dieta (mesmo login).
// Estes valores são públicos por natureza: a chave publicável e a chave VAPID
// pública podem ficar no código. Os dados são protegidos pelas regras (RLS) de
// cada tabela, que só deixam cada família ver o que é dela.
// Variáveis VITE_* (arquivo .env.local) têm prioridade, para testes locais.
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? 'https://dqxpiyjdwwrcwkcuuyys.supabase.co';
export const SUPABASE_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'sb_publishable_C3h222kH6rRIV1K7p2TNIA_TWNTU3h3';
/** Chave pública de notificações (a privada fica só nos segredos do Supabase) */
export const VAPID_PUBLICA: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? 'BP0ONir-WP30mDUG7_gsYN_EAw0J-p_WSyBVZ4l51bBukAqn-_rGmlvoke_ruLmNX350OsXPn7l4cuEhpB1K2Qk';
/** Endereço do calendário assinado; o token individual vai no final */
export const CALENDARIO_URL = `${SUPABASE_URL}/functions/v1/nenem-calendario?t=`;
export const SITE_URL = 'https://neivapedro.github.io/app-nenem/';
