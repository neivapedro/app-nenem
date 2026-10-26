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

/** As 5 faixas de percentil mostradas no destaque do crescimento */
export type FaixaDetalhada = 'abaixo-p3' | 'p3-p15' | 'p15-p85' | 'p85-p97' | 'acima-p97';

const Z_P3 = 1.880794;
const Z_P15 = 1.036433;

export function faixaDetalhada(z: number): FaixaDetalhada {
  if (z < -Z_P3) return 'abaixo-p3';
  if (z < -Z_P15) return 'p3-p15';
  if (z <= Z_P15) return 'p15-p85';
  if (z <= Z_P3) return 'p85-p97';
  return 'acima-p97';
}

/** Régua de faixas: cada faixa ocupa uma largura fixa (o P15–P85 fica no meio, mais largo) */
export const REGUA_FAIXAS: { id: FaixaDetalhada; de: number; ate: number; pDe: number; pAte: number }[] = [
  { id: 'abaixo-p3', de: 0, ate: 0.12, pDe: 0, pAte: 3 },
  { id: 'p3-p15', de: 0.12, ate: 0.3, pDe: 3, pAte: 15 },
  { id: 'p15-p85', de: 0.3, ate: 0.7, pDe: 15, pAte: 85 },
  { id: 'p85-p97', de: 0.7, ate: 0.88, pDe: 85, pAte: 97 },
  { id: 'acima-p97', de: 0.88, ate: 1, pDe: 97, pAte: 100 },
];

/** Posição (0 a 1) do escore-z na régua de faixas */
export function posicaoNaRegua(z: number): number {
  const f = REGUA_FAIXAS.find((r) => r.id === faixaDetalhada(z))!;
  // Fora das curvas: de 1,88 a 3,5 desvios ocupam a faixa da ponta (sem encostar na borda)
  if (f.id === 'abaixo-p3') return f.ate - Math.min(1, (-z - Z_P3) / (3.5 - Z_P3)) * (f.ate - f.de - 0.02);
  if (f.id === 'acima-p97') return f.de + Math.min(1, (z - Z_P3) / (3.5 - Z_P3)) * (f.ate - f.de - 0.02);
  const p = percentilDoZ(z);
  return f.de + ((p - f.pDe) / (f.pAte - f.pDe)) * (f.ate - f.de);
}

/** Percentil inteiro para o destaque (1 a 99) */
export function percentilInteiro(z: number): number {
  return Math.min(99, Math.max(1, Math.round(percentilDoZ(z))));
}

/** Períodos do gráfico (até o dia) */
export const PERIODOS_GRAFICO = [
  { dias: 183, rotulo: '0–6 m', nome: '0 a 6 meses' },
  { dias: 365, rotulo: '0–1 ano', nome: '0 a 1 ano' },
  { dias: 731, rotulo: '0–2 anos', nome: '0 a 2 anos' },
  { dias: 1826, rotulo: '0–5 anos', nome: '0 a 5 anos' },
] as const;

/** Período automático pela idade: o menor que mostra a idade atual com folga de ~1 mês */
export function periodoAutomatico(idadeDias: number): number {
  for (const p of PERIODOS_GRAFICO) if (idadeDias + 30 <= p.dias) return p.dias;
  return DIA_MAX;
}

/** Idade em texto curto a partir dos dias: "5 dias", "3 semanas", "4 meses e 10 dias", "1 ano e 2 meses" */
export function textoIdadeDias(dia: number): string {
  if (dia < 14) return dia === 1 ? '1 dia' : `${dia} dias`;
  if (dia < 61) {
    const s = Math.floor(dia / 7);
    const r = dia % 7;
    return `${s} semanas${r ? ` e ${r === 1 ? '1 dia' : `${r} dias`}` : ''}`;
  }
  const meses = Math.floor(dia / 30.4375);
  if (meses < 24) {
    const r = Math.floor(dia - meses * 30.4375);
    const m = meses === 1 ? '1 mês' : `${meses} meses`;
    return r ? `${m} e ${r === 1 ? '1 dia' : `${r} dias`}` : m;
  }
  const anos = Math.floor(meses / 12);
  const rm = meses % 12;
  return `${anos} anos${rm ? ` e ${rm === 1 ? '1 mês' : `${rm} meses`}` : ''}`;
}
