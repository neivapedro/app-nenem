// Números que "contam" até o valor (requestAnimationFrame + suavização).
// Aparecem direto com "Reduzir movimento", quando o valor muda pouco e quando
// a tela já foi vista nesta sessão (não fica contando de novo a cada visita).
import { useEffect, useRef, useState } from 'react';

/** Sai rápido e chega devagar */
export const suavizar = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/** Valor no instante t (0 a 1) da animação de `de` até `para` */
export function interpolar(de: number, para: number, t: number): number {
  if (t >= 1) return para;
  return de + (para - de) * suavizar(t);
}

/** Vale a pena animar? Não quando a diferença é pequena (absoluta ou menos de 3% do valor). */
export function deveAnimar(de: number, para: number, minimo = 1): boolean {
  if (!isFinite(de) || !isFinite(para) || de === para) return false;
  const d = Math.abs(para - de);
  if (d <= minimo) return false;
  return d / Math.max(Math.abs(de), Math.abs(para)) >= 0.03;
}

const menosMovimento = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Chaves já mostradas nesta sessão (a mesma tela de novo: o número aparece direto) */
const vistos = new Set<string>();

export interface OpcoesAnimar {
  /** Duração em ms (padrão 700) */
  duracao?: number;
  /** Identifica o número: na 2ª vez que aparece (outra visita à tela), não conta de novo */
  chave?: string;
  /** Diferença que não anima (padrão 1) */
  minimo?: number;
  /** false: acompanha o valor sem animar (ex.: valores escondidos) */
  ativo?: boolean;
}

/**
 * O número exibido enquanto conta até `valor`. Na 1ª vez (por chave) parte do
 * zero; depois anima só mudanças grandes, a partir do que estava na tela.
 */
export function useNumeroAnimado(valor: number, { duracao = 700, chave, minimo = 1, ativo = true }: OpcoesAnimar = {}): number {
  const [inicial] = useState(() => {
    const primeira = ativo && !(chave && vistos.has(chave)) && !menosMovimento() && deveAnimar(0, valor, minimo);
    return primeira ? 0 : valor;
  });
  const [exibido, setExibido] = useState(inicial);
  const atual = useRef(inicial);
  const quadro = useRef(0);

  useEffect(() => {
    cancelAnimationFrame(quadro.current);
    const de = atual.current;
    if (ativo && chave) vistos.add(chave);
    if (!ativo || menosMovimento() || !deveAnimar(de, valor, minimo) || typeof requestAnimationFrame !== 'function') {
      atual.current = valor;
      setExibido(valor);
      return;
    }
    let comeco: number | null = null;
    const passo = (agora: number) => {
      comeco ??= agora;
      const t = (agora - comeco) / duracao;
      const v = interpolar(de, valor, t);
      atual.current = v;
      setExibido(v);
      if (t < 1) quadro.current = requestAnimationFrame(passo);
    };
    quadro.current = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro.current);
  }, [valor, duracao, minimo, ativo, chave]);

  return exibido;
}

// ---------- Texto já formatado ("14,2 h", "1h46", "620 ml", "+12 min") ----------

export interface TextoNumerico {
  valor: number;
  /** Volta ao mesmo formato (pt-BR) para um valor intermediário */
  formatar: (n: number) => string;
  /** Diferença que não vale animar, na unidade de `valor` */
  minimo: number;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Minutos no formato do app: "45 min", "1h05", "2h00" */
export function textoMinutos(min: number): string {
  const m = Math.max(0, Math.round(min));
  return m >= 60 ? `${Math.floor(m / 60)}h${pad2(m % 60)}` : `${m} min`;
}

/**
 * Lê um número já formatado em pt-BR e devolve como refazer o texto para os
 * valores do meio da animação. null quando não há exatamente um número.
 */
export function analisarTexto(texto: string): TextoNumerico | null {
  // Duração: "1h46", "2h", "45 min" (com sinal opcional na frente, ex.: "+1h05")
  const dur = /^([+−-]?)(?:(\d+)h(\d{2})?|(\d+) min)$/.exec(texto);
  if (dur) {
    const [, sinal, h, m, soMin] = dur;
    const valor = soMin !== undefined ? Number(soMin) : Number(h) * 60 + Number(m ?? 0);
    return { valor, formatar: (n) => `${sinal}${textoMinutos(n)}`, minimo: 1 };
  }
  // Número: "14,2 h", "1.234 ml", "7" (o ponto separa milhar; a vírgula, os decimais)
  const num = /^([^\d]*?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?([^\d]*)$/.exec(texto);
  if (num) {
    const [, antes, inteiro, decimais, depois] = num;
    const casas = decimais?.length ?? 0;
    const valor = Number(`${inteiro.replace(/\./g, '')}.${decimais ?? '0'}`);
    const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
    return { valor, formatar: (n) => `${antes}${fmt.format(n)}${depois}`, minimo: casas ? 10 ** -casas : 1 };
  }
  return null;
}

/** O texto como aparece durante a animação (termina exatamente igual a `texto`). */
export function useTextoAnimado(texto: string, opcoes: Omit<OpcoesAnimar, 'minimo'> = {}): string {
  const lido = analisarTexto(texto);
  const n = useNumeroAnimado(lido?.valor ?? 0, { ...opcoes, minimo: lido?.minimo ?? 1, ativo: !!lido && opcoes.ativo !== false });
  if (!lido || n === lido.valor) return texto;
  return lido.formatar(n);
}
