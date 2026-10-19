// Séries por dia para os gráficos de padrão e o relatório do pediatra.
import { somarMeses } from '../../supabase/functions/_shared/tempo.ts';
import { inicioDoDia, somarDiasLocal } from './datas';
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

export interface MesResumo {
  /** 1 = primeiro mês de vida */
  mes: number;
  /** Primeiro dia do mês de vida (dia do mesversário) */
  inicio: string;
  /** Último dia do mês de vida */
  fim: string;
  /** Dias completos que entraram na média (hoje não conta) */
  dias: number;
  alimentacoes: number;
  fraldas: number;
  sonoMs: number;
  ml: number;
  /** O mês ainda não terminou */
  emAndamento: boolean;
}

/**
 * Médias por dia de cada mês de vida (1º mês = do nascimento até a véspera do
 * 1º mesversário). Só dias completos: hoje fica de fora.
 */
export function mesesDeVida(registros: Registro[], nascimento: string, hoje: string, agora: Date): MesResumo[] {
  const meses: MesResumo[] = [];
  for (let m = 1; ; m++) {
    const inicio = somarMeses(nascimento, m - 1);
    if (inicio >= hoje) break;
    const fim = somarDiasLocal(somarMeses(nascimento, m), -1);
    const ultimo = fim < hoje ? fim : somarDiasLocal(hoje, -1);
    // Só os registros perto do mês (o sono pode começar na véspera)
    const de = inicioDoDia(somarDiasLocal(inicio, -1)).getTime();
    const ate = inicioDoDia(somarDiasLocal(ultimo, 1)).getTime();
    const doMes = registros.filter((r) => {
      const t = new Date(r.inicio).getTime();
      return t >= de && t < ate;
    });
    let dias = 0;
    const soma = { alimentacoes: 0, fraldas: 0, sonoMs: 0, ml: 0 };
    for (let dia = inicio; dia <= ultimo; dia = somarDiasLocal(dia, 1)) {
      const r = resumoDia(doMes, dia, agora);
      soma.alimentacoes += r.alimentacoes;
      soma.fraldas += r.fraldas;
      soma.sonoMs += r.sonoMs;
      soma.ml += r.ml;
      dias++;
    }
    if (!dias) break;
    meses.push({
      mes: m,
      inicio,
      fim,
      dias,
      alimentacoes: soma.alimentacoes / dias,
      fraldas: soma.fraldas / dias,
      sonoMs: soma.sonoMs / dias,
      ml: soma.ml / dias,
      emAndamento: fim >= hoje,
    });
  }
  return meses;
}

/** Resumo de cada dia entre `de` e `ate` (inclusive), do mais antigo para o mais novo */
export function diasDoPeriodo(registros: Registro[], de: string, ate: string, agora: Date): DiaResumo[] {
  const dias: DiaResumo[] = [];
  // Só os registros perto do período (o sono pode começar na véspera)
  const ini = inicioDoDia(somarDiasLocal(de, -1)).getTime();
  const fim = inicioDoDia(somarDiasLocal(ate, 1)).getTime();
  const perto = registros.filter((r) => {
    const t = new Date(r.inicio).getTime();
    return t >= ini && t < fim;
  });
  for (let dia = de; dia <= ate && dias.length < 4000; dia = somarDiasLocal(dia, 1)) dias.push({ dia, ...resumoDia(perto, dia, agora) });
  return dias;
}

export interface MesDoPeriodo {
  /** AAAA-MM */
  mes: string;
  dias: number;
  alimentacoes: number;
  peitoMs: number;
  ml: number;
  fraldas: number;
  xixi: number;
  coco: number;
  sonoMs: number;
}

/** Médias por dia de cada mês do calendário dentro dos dias dados */
export function mediasPorMes(dias: DiaResumo[]): MesDoPeriodo[] {
  const grupos = new Map<string, DiaResumo[]>();
  for (const d of dias) grupos.set(d.dia.slice(0, 7), [...(grupos.get(d.dia.slice(0, 7)) ?? []), d]);
  return [...grupos.entries()].map(([mes, ds]) => {
    const m = (f: (d: DiaResumo) => number) => media(ds.map(f));
    return { mes, dias: ds.length, alimentacoes: m((d) => d.alimentacoes), peitoMs: m((d) => d.peitoMs), ml: m((d) => d.ml), fraldas: m((d) => d.fraldas), xixi: m((d) => d.xixi), coco: m((d) => d.coco), sonoMs: m((d) => d.sonoMs) };
  });
}
