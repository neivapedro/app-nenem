// Percentis das curvas da OMS pelo método LMS (o mesmo do software Anthro da OMS).
import { OMS, type LinhaLMS } from './oms-dados';

export type Indicador = 'peso' | 'comprimento' | 'pc';
export type Sexo = 'M' | 'F';

export const NOMES_INDICADOR: Record<Indicador, string> = {
  peso: 'Peso',
  comprimento: 'Comprimento',
  pc: 'Perímetro cefálico',
};

export const UNIDADE_INDICADOR: Record<Indicador, string> = { peso: 'kg', comprimento: 'cm', pc: 'cm' };

/** Linhas de referência desenhadas no gráfico */
export const PERCENTIS_REFERENCIA = [3, 15, 50, 85, 97] as const;

const DIA_MAX = 1826;

/** L, M e S na idade em dias (interpolação linear entre as linhas da tabela). */
export function lmsNaIdade(ind: Indicador, sexo: Sexo, dia: number): { l: number; m: number; s: number } | null {
  if (dia < 0 || dia > DIA_MAX) return null;
  const t = OMS[ind][sexo];
  let i = 0;
  // Busca binária pela linha anterior
  let lo = 0;
  let hi = t.length - 1;
  while (lo <= hi) {
    const meio = (lo + hi) >> 1;
    if (t[meio][0] <= dia) {
      i = meio;
      lo = meio + 1;
    } else hi = meio - 1;
  }
  const a: LinhaLMS = t[i];
  const b: LinhaLMS = t[Math.min(i + 1, t.length - 1)];
  if (a[0] === dia || a === b) return { l: a[1], m: a[2], s: a[3] };
  const f = (dia - a[0]) / (b[0] - a[0]);
  return { l: a[1] + (b[1] - a[1]) * f, m: a[2] + (b[2] - a[2]) * f, s: a[3] + (b[3] - a[3]) * f };
}

function valorEmZ(lms: { l: number; m: number; s: number }, z: number): number {
  const { l, m, s } = lms;
  return l === 0 ? m * Math.exp(s * z) : m * Math.pow(1 + l * s * z, 1 / l);
}

/**
 * Escore-z. No peso, além de ±3 a OMS usa a distância entre os desvios 2 e 3
 * (para a assimetria da curva não exagerar os extremos).
 */
export function escoreZ(ind: Indicador, sexo: Sexo, dia: number, valor: number): number | null {
  const lms = lmsNaIdade(ind, sexo, dia);
  if (!lms || !(valor > 0)) return null;
  const { l, m, s } = lms;
  const z = l === 0 ? Math.log(valor / m) / s : (Math.pow(valor / m, l) - 1) / (l * s);
  if (ind !== 'peso' || Math.abs(z) <= 3) return z;
  if (z > 3) {
    const sd3 = valorEmZ(lms, 3);
    return 3 + (valor - sd3) / (sd3 - valorEmZ(lms, 2));
  }
  const sd3n = valorEmZ(lms, -3);
  return -3 + (valor - sd3n) / (valorEmZ(lms, -2) - sd3n);
}

/** Função de distribuição normal (aproximação de Abramowitz-Stegun, erro < 1e-7). */
function normalAcumulada(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - p : p;
}

const Z_DO_PERCENTIL: Record<number, number> = { 3: -1.880794, 15: -1.036433, 50: 0, 85: 1.036433, 97: 1.880794 };

export function percentilDoZ(z: number): number {
  return normalAcumulada(z) * 100;
}

/** Valor da curva de referência (ex.: percentil 50) na idade */
export function valorNoPercentil(ind: Indicador, sexo: Sexo, dia: number, p: (typeof PERCENTIS_REFERENCIA)[number]): number | null {
  const lms = lmsNaIdade(ind, sexo, dia);
  return lms ? valorEmZ(lms, Z_DO_PERCENTIL[p]) : null;
}

/** "P50", "P97", "abaixo do P3", "acima do P97" */
export function textoPercentil(z: number): string {
  if (z < -1.880794) return 'abaixo do P3';
  if (z > 1.880794) return 'acima do P97';
  const p = percentilDoZ(z);
  return `P${p < 1 ? '<1' : p > 99 ? '>99' : Math.round(p)}`;
}

/** Faixa para dar contexto sem alarmar: só "fora das curvas" chama atenção */
export function faixaPercentil(z: number): 'abaixo' | 'normal' | 'acima' {
  if (z < -1.880794) return 'abaixo';
  if (z > 1.880794) return 'acima';
  return 'normal';
}

const diaUtc = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return Date.UTC(a, m - 1, d) / 86_400_000;
};

/** Prematuridade mínima (dias antes da data prevista) para usar a idade corrigida: nasceu com menos de 37 semanas */
export const PREMATURO_DIAS = 21;
/** Até quando (idade cronológica em dias) a idade corrigida é usada: 2 anos */
const CORRIGIR_ATE_DIA = 731;

/** Dias que faltavam para a data prevista quando nasceu (0 se não é prematuro ou não há data prevista) */
export function diasPrematuridade(nascimento: string, dataPrevista: string | null): number {
  if (!dataPrevista) return 0;
  const d = Math.round(diaUtc(dataPrevista) - diaUtc(nascimento));
  return d >= PREMATURO_DIAS ? d : 0;
}

/**
 * Idade (dias) para comparar com as curvas da OMS. Prematuros usam a idade corrigida
 * até 2 anos de idade cronológica. null = antes da data prevista (não compara com a OMS).
 */
export function idadeParaOms(diaCronologico: number, prematuridade: number): { dia: number; corrigida: boolean } | null {
  if (prematuridade <= 0 || diaCronologico >= CORRIGIR_ATE_DIA) return { dia: diaCronologico, corrigida: false };
  const dia = diaCronologico - prematuridade;
  return dia < 0 ? null : { dia, corrigida: true };
}

/** Valor da medida no indicador (peso em kg) */
export function valorMedida(m: { peso_g: number | null; comprimento_cm: number | null; pc_cm: number | null }, ind: Indicador): number | null {
  if (ind === 'peso') return m.peso_g ? m.peso_g / 1000 : null;
  if (ind === 'comprimento') return m.comprimento_cm;
  return m.pc_cm;
}

/** Ganho de peso por dia entre duas medidas (g/dia) */
export function ganhoPorDia(a: { data: string; peso_g: number | null }, b: { data: string; peso_g: number | null }): number | null {
  if (!a.peso_g || !b.peso_g) return null;
  const dias = (new Date(`${b.data}T12:00:00`).getTime() - new Date(`${a.data}T12:00:00`).getTime()) / 86_400_000;
  return dias > 0 ? (b.peso_g - a.peso_g) / dias : null;
}
