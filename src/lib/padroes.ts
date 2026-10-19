// Séries por dia para os gráficos de padrão e o relatório do pediatra.
import { somarDiasLocal } from './datas';
import { duracaoPorLado, ordenarRecentes, resumoDia, type ResumoDia } from './registros';
import type { Registro } from './tipos';

export interface DiaResumo extends ResumoDia {
  dia: string;
}

/** Resumo de cada um dos últimos `n` dias (do mais antigo para hoje) */
export function ultimosDias(registros: Registro[], hoje: string, n: number, agora: Date): DiaResumo[] {
  return Array.from({ length: n }, (_, i) => {
    const dia = somarDiasLocal(hoje, i - n + 1);
    return { dia, ...resumoDia(registros, dia, agora) };
  });
}

/** Intervalo médio (ms) entre o início de alimentações seguidas (mamada ou mamadeira) no período */
export function intervaloMedioAlimentacao(registros: Registro[], desde: Date, ate: Date): number | null {
  const lista = ordenarRecentes(
    registros.filter((r) => (r.tipo === 'mamada' || r.tipo === 'mamadeira') && new Date(r.inicio) >= desde && new Date(r.inicio) <= ate),
  ).reverse();
  if (lista.length < 2) return null;
  let soma = 0;
  let n = 0;
  for (let i = 1; i < lista.length; i++) {
    const d = new Date(lista[i].inicio).getTime() - new Date(lista[i - 1].inicio).getTime();
    // Ignora intervalos acima de 8 h (dias sem registro não puxam a média)
    if (d > 0 && d <= 8 * 3_600_000) {
      soma += d;
      n++;
    }
  }
  return n ? soma / n : null;
}

/** Duração média de uma mamada no peito (ms) no período */
export function duracaoMediaMamada(registros: Registro[], desde: Date, ate: Date, agora: Date): number | null {
  const lista = registros.filter((r) => r.tipo === 'mamada' && r.fim && new Date(r.inicio) >= desde && new Date(r.inicio) <= ate);
  if (!lista.length) return null;
  return lista.reduce((s, r) => s + (r.tipo === 'mamada' ? duracaoPorLado(r, agora).total : 0), 0) / lista.length;
}

export function media(valores: number[]): number {
  return valores.length ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
}
