/**
 * Transição suave entre telas (View Transitions API, Safari 18+).
 * Sem a API ou com "Reduzir movimento" ligado no iPhone, troca de tela na hora, sem animação.
 */

type Transicao = { ready: Promise<void>; finished: Promise<void> };
type DocumentoComTransicao = Document & { startViewTransition?: (atualizar: () => Promise<void>) => Transicao };

export type Direcao = 'frente' | 'tras';

/** Passos extras de uma troca (ex.: o "zoom" do cartão em src/lib/zoom.ts) */
export type OpcoesTransicao = {
  /** Logo antes de começar: o estado antigo da tela ainda vai ser fotografado */
  antes?: () => void;
  /** A tela nova já foi desenhada; o estado novo ainda vai ser fotografado */
  depois?: () => void;
  /** A troca terminou (ou foi pulada por outra) */
  fim?: () => void;
};

/**
 * Quem chama trocarComTransicao sem opções (abas, botão Voltar, gestos) passa por aqui:
 * o zoom usa isso para encolher a tela de volta no cartão de origem.
 */
let ganchoPadrao: ((direcao: Direcao) => OpcoesTransicao | undefined) | null = null;
export function definirGanchoTransicao(f: typeof ganchoPadrao) {
  ganchoPadrao = f;
}

// Quem quer saber de toda troca de tela (com ou sem animação)
const ouvintesTroca = new Set<() => void>();
export function aoTrocarTela(f: () => void): () => void {
  ouvintesTroca.add(f);
  return () => ouvintesTroca.delete(f);
}

// Avisos de "a tela nova já foi desenhada" (a Estrutura chama telaTrocada() ao mudar o endereço)
const esperando = new Set<() => void>();
// Transições em andamento (dois toques rápidos: a 2ª pula a 1ª)
let ativas = 0;

export function telaTrocada() {
  for (const f of [...esperando]) f();
  esperando.clear();
  for (const f of ouvintesTroca) {
    try {
      f();
    } catch {
      /* um ouvinte com erro não trava a troca */
    }
  }
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
export function trocarComTransicao(trocar: () => void, direcao: Direcao = 'frente', opcoes?: OpcoesTransicao): boolean {
  if (!podeAnimar()) return false;
  const doc = document as DocumentoComTransicao;
  const raiz = document.documentElement;
  const op = opcoes ?? ganchoPadrao?.(direcao) ?? {};
  const seguro = (f?: () => void) => {
    try {
      f?.();
    } catch {
      /* um passo extra com erro não pode travar a tela */
    }
  };
  raiz.dataset.transicao = direcao;
  ativas++;
  seguro(op.antes);
  let terminou = false;
  const acabou = () => {
    if (terminou) return;
    terminou = true;
    ativas = Math.max(0, ativas - 1);
    if (!ativas) delete raiz.dataset.transicao;
    seguro(op.fim);
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
            seguro(op.depois);
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
