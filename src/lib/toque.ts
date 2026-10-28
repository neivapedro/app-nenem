// Decisões dos gestos de toque (funções puras, testáveis): arrastar a folha
// para baixo para fechar e deslizar um item da lista para revelar ações.

/** Deslocamento mínimo (px) antes de decidir a direção do gesto */
export const FOLGA_GESTO = 8;

export type Eixo = 'espera' | 'horizontal' | 'vertical';

/** Direção dominante do gesto; 'espera' enquanto o dedo mal saiu do lugar. */
export function decidirEixo(dx: number, dy: number, folga = FOLGA_GESTO): Eixo {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < folga) return 'espera';
  // Horizontal só quando claramente mais de lado do que para cima/baixo (a rolagem vertical tem prioridade)
  return ax > ay * 1.2 ? 'horizontal' : 'vertical';
}

/** Elástico: além do limite, o movimento rende cada vez menos (nunca passa de `maximo`). */
export function elastico(excesso: number, maximo = 40): number {
  if (excesso <= 0) return 0;
  return maximo * (1 - 1 / (1 + excesso / (maximo * 2.5)));
}

// ---------- Folha ----------

/** Posição da folha para o quanto o dedo desceu: acompanha o dedo; para cima, só um elástico curto. */
export function posicaoFolha(dy: number): number {
  return dy >= 0 ? dy : -elastico(-dy, 24);
}

/**
 * Soltou o dedo: fecha se desceu bastante (30% da altura, no máximo 160 px)
 * ou se foi um gesto rápido para baixo; senão a folha volta.
 * `velocidade` em px/ms (positiva = para baixo).
 */
export function deveFecharFolha(desceu: number, velocidade: number, altura: number): boolean {
  if (desceu <= 0) return false;
  const limiar = Math.min(160, Math.max(80, altura * 0.3));
  if (desceu >= limiar) return true;
  // Rápido para baixo, mas não um tremido de poucos pixels
  return velocidade > 0.55 && desceu > 28;
}

/** Quanto o fundo escurecido some enquanto a folha desce (1 = normal, 0 = some) */
export function opacidadeFundo(desceu: number, altura: number): number {
  if (desceu <= 0 || altura <= 0) return 1;
  return Math.max(0, 1 - desceu / altura);
}

// ---------- Deslizar item ----------

export interface MedidasDeslize {
  /** Largura das ações reveladas (ex.: Editar + Apagar) */
  acoes: number;
  /** Largura do item */
  largura: number;
}

/** A partir de quanto (px para a esquerda) soltar o dedo apaga direto */
export function limiarApagar({ acoes, largura }: MedidasDeslize): number {
  return Math.min(largura - 16, Math.max(acoes + 48, largura * 0.6));
}

/** Posição do item (negativa = para a esquerda) para a base (0 ou -acoes) mais o arrasto. */
export function posicaoDeslize(base: number, dx: number, m: MedidasDeslize): number {
  const x = base + dx;
  // Para a direita do lugar: só um elástico curto
  if (x > 0) return elastico(x, 16);
  return Math.max(x, -m.largura);
}

export type FimDeslize = 'fechado' | 'aberto' | 'apagar';

/**
 * Soltou o dedo: apaga se passou do limiar (só pela distância, nunca só pela
 * velocidade, para não apagar sem querer), abre se passou da metade das ações
 * ou foi um gesto rápido para a esquerda; senão fecha.
 * `velocidade` em px/ms (negativa = para a esquerda).
 */
export function soltarDeslize(x: number, velocidade: number, m: MedidasDeslize): FimDeslize {
  if (-x >= limiarApagar(m)) return 'apagar';
  if (velocidade < -0.35 && x < 0) return 'aberto';
  if (velocidade > 0.35) return 'fechado';
  return -x > m.acoes / 2 ? 'aberto' : 'fechado';
}

/** Velocidade (px/ms) pelas últimas amostras do dedo (até ~100 ms atrás) */
export function velocidade(amostras: { v: number; t: number }[], janela = 100): number {
  if (amostras.length < 2) return 0;
  const ultima = amostras[amostras.length - 1];
  let primeira = amostras[0];
  for (let i = amostras.length - 2; i >= 0; i--) {
    primeira = amostras[i];
    if (ultima.t - amostras[i].t >= janela) break;
  }
  const dt = ultima.t - primeira.t;
  return dt > 0 ? (ultima.v - primeira.v) / dt : 0;
}
