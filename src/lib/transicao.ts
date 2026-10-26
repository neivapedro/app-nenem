/**
 * Transição suave entre telas (View Transitions API, Safari 18+).
 * Sem a API ou com "Reduzir movimento" ligado no iPhone, troca de tela na hora, sem animação.
 */

type Transicao = { ready: Promise<void>; finished: Promise<void> };
type DocumentoComTransicao = Document & { startViewTransition?: (atualizar: () => Promise<void>) => Transicao };

export type Direcao = 'frente' | 'tras';

// Avisos de "a tela nova já foi desenhada" (a Estrutura chama telaTrocada() ao mudar o endereço)
const esperando = new Set<() => void>();
// Transições em andamento (dois toques rápidos: a 2ª pula a 1ª)
let ativas = 0;

export function telaTrocada() {
  for (const f of esperando) f();
  esperando.clear();
}

export function podeAnimar(): boolean {
  const doc = document as DocumentoComTransicao;
  if (typeof doc.startViewTransition !== 'function') return false;
  try {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Troca de tela com animação: `trocar` muda o endereço (navigate). Devolve false se não animou
 * (aí quem chamou segue o caminho normal).
 */
export function trocarComTransicao(trocar: () => void, direcao: Direcao = 'frente'): boolean {
  if (!podeAnimar()) return false;
  const doc = document as DocumentoComTransicao;
  const raiz = document.documentElement;
  raiz.dataset.transicao = direcao;
  ativas++;
  const acabou = () => {
    ativas = Math.max(0, ativas - 1);
    if (!ativas) delete raiz.dataset.transicao;
  };
  let t: Transicao;
  try {
    t = doc.startViewTransition!(
      () =>
        new Promise<void>((ok) => {
          let feito = false;
          const fim = () => {
            if (feito) return;
            feito = true;
            esperando.delete(fim);
            ok();
          };
          esperando.add(fim);
          // Garantia: nunca segura a tela congelada se a troca não avisar
          setTimeout(fim, 500);
          trocar();
        }),
    );
  } catch {
    acabou();
    trocar();
    return true;
  }
  // Transição pulada (ex.: dois toques rápidos) não é erro
  t.ready.catch(() => undefined);
  t.finished.catch(() => undefined).finally(acabou);
  return true;
}
