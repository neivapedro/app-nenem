/**
 * Decisões dos gestos de toque (deslizar entre abas e puxar para atualizar).
 * Funções puras: recebem os números do toque e dizem o que fazer, sem tocar na tela.
 */

/** Movimento mínimo (px) antes de decidir se o dedo vai para os lados ou para cima/baixo */
export const FOLGA_INTENCAO = 10;
/** Começo do toque perto da borda esquerda: é o "voltar" do iPhone, não troca de aba */
export const BORDA_SISTEMA = 24;
/** Distância (já com resistência) que o indicador de "puxar para atualizar" precisa descer */
export const LIMIAR_PUXAR = 64;
/** Até onde o indicador desce, no máximo */
export const MAXIMO_PUXAR = 130;

export type Intencao = 'lado' | 'vertical' | null;
export type Sentido = 'proxima' | 'anterior';

/**
 * Para onde o dedo quer ir. Até mexer `FOLGA_INTENCAO` px, ainda não dá para saber (null).
 * Só é "lado" se o movimento for claramente horizontal (bem mais para o lado que para cima):
 * na dúvida, é rolagem vertical e o gesto de aba não atrapalha.
 */
export function intencao(dx: number, dy: number, folga = FOLGA_INTENCAO): Intencao {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < folga) return null;
  return ax > ay * 1.6 ? 'lado' : 'vertical';
}

/**
 * O toque começou na borda esquerda (o "voltar" do iPhone)? A direita fica livre:
 * no app da Tela de Início não há gesto do sistema por lá.
 */
export function naBorda(x: number, margem = BORDA_SISTEMA): boolean {
  return x < margem;
}

/** Distância horizontal mínima para trocar de aba sem "lançar" o dedo */
export function limiarTroca(largura: number): number {
  return Math.min(110, Math.max(64, largura * 0.24));
}

/**
 * Ao soltar o dedo: troca de aba? Dedo para a esquerda → próxima aba; para a direita → anterior.
 * Vale arrastar além do limiar ou um movimento rápido (≥ 0,45 px/ms) de pelo menos 40 px.
 * Movimento que ficou muito inclinado no fim (|dy| grande) não conta.
 */
export function decidirTroca(dx: number, dy: number, ms: number, largura: number): Sentido | null {
  const ax = Math.abs(dx);
  if (ax < 40 || Math.abs(dy) > ax * 0.75) return null;
  const velocidade = ax / Math.max(ms, 1);
  if (ax < limiarTroca(largura) && velocidade < 0.45) return null;
  return dx < 0 ? 'proxima' : 'anterior';
}

/** Índice da aba vizinha (sem dar a volta: na última, "próxima" não existe) */
export function abaVizinha(atual: number, total: number, sentido: Sentido): number | null {
  if (atual < 0) return null;
  const nova = sentido === 'proxima' ? atual + 1 : atual - 1;
  return nova >= 0 && nova < total ? nova : null;
}

/**
 * Resistência elástica (como o "elástico" do iOS): no começo acompanha o dedo,
 * depois cada pixel puxado rende menos, sem nunca passar de `maximo`.
 */
export function resistencia(distancia: number, maximo = MAXIMO_PUXAR): number {
  if (distancia <= 0) return 0;
  return maximo * (1 - 1 / ((distancia * 0.8) / maximo + 1));
}

/**
 * Acompanhamento visual do arrasto para os lados (px): segue o dedo de leve,
 * com resistência; no fim da fila de abas (sem vizinha) segue bem menos.
 */
export function deslocamentoLado(dx: number, temVizinha: boolean): number {
  const maximo = temVizinha ? 36 : 12;
  return Math.sign(dx) * resistencia(Math.abs(dx), maximo);
}

/** Andamento do puxar para atualizar: 0 a 1 (1 = soltar agora atualiza) */
export function progressoPuxar(puxado: number, limiar = LIMIAR_PUXAR): number {
  return Math.max(0, Math.min(1, puxado / limiar));
}
