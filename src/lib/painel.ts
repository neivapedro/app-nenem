// Painel de gráficos: números de cada dia, comparação com o período anterior,
// mapa de horários e linha do tempo. Sem dependências: testado no vitest.
import { chaveDia, inicioDoDia, somarDiasLocal } from './datas';
import { media } from './padroes';
import { duracaoPorLado, resumoDia, type ResumoDia } from './registros';
import type { Registro } from './tipos';

/** Noite = das 19h às 7h (o resto é sono de dia: as sonecas) */
export const NOITE_INICIO = 19;
export const NOITE_FIM = 7;

export interface DiaPainel extends ResumoDia {
  dia: string;
  sonoNoiteMs: number;
  sonoDiaMs: number;
  /** Maior sono seguido que começou no dia */
  maiorSonoMs: number;
  /** Fraldas sem cocô (só xixi ou secas) */
  semCoco: number;
}

const ms = (iso: string) => new Date(iso).getTime();
const HORA = 3_600_000;

/** Quanto do intervalo [a, b) cai na noite de cada dia (das 19h às 7h) */
function partesNoite(a: number, b: number): number {
  let noite = 0;
  // Percorre os dias que o intervalo toca
  for (let d = chaveDia(new Date(a)), i = 0; inicioDoDia(d).getTime() < b && i < 40; d = somarDiasLocal(d, 1), i++) {
    const zero = inicioDoDia(d).getTime();
    const faixas: [number, number][] = [
      [zero, zero + NOITE_FIM * HORA],
      [zero + NOITE_INICIO * HORA, inicioDoDia(somarDiasLocal(d, 1)).getTime()],
    ];
    for (const [x, y] of faixas) noite += Math.max(0, Math.min(b, y) - Math.max(a, x));
  }
  return noite;
}

/** Os números de cada dia entre `de` e `ate` (inclusive) */
export function diasPainel(registros: Registro[], de: string, ate: string, agora: Date): DiaPainel[] {
  const ini = inicioDoDia(somarDiasLocal(de, -1)).getTime();
  const fim = inicioDoDia(somarDiasLocal(ate, 1)).getTime();
  const perto = registros.filter((r) => {
    const t = ms(r.inicio);
    return t >= ini && t < fim;
  });
  const sonos = perto.filter((r) => r.tipo === 'sono');
  const dias: DiaPainel[] = [];
  for (let dia = de; dia <= ate && dias.length < 4000; dia = somarDiasLocal(dia, 1)) {
    const base = resumoDia(perto, dia, agora);
    const z = inicioDoDia(dia).getTime();
    const z1 = inicioDoDia(somarDiasLocal(dia, 1)).getTime();
    let noite = 0;
    let maior = 0;
    for (const s of sonos) {
      const a = ms(s.inicio);
      const b = s.fim ? ms(s.fim) : agora.getTime();
      const x = Math.max(a, z);
      const y = Math.min(b, z1);
      if (y > x) noite += partesNoite(x, y);
      if (a >= z && a < z1) maior = Math.max(maior, b - a);
    }
    dias.push({ ...base, dia, sonoNoiteMs: noite, sonoDiaMs: Math.max(0, base.sonoMs - noite), maiorSonoMs: maior, semCoco: base.fraldas - base.coco });
  }
  return dias;
}

export interface MediasPeriodo {
  alimentacoes: number;
  fraldas: number;
  sonoMs: number;
  maiorSonoMs: number;
  ml: number;
  dias: number;
}

/** Médias por dia (sem o dia de hoje, que ainda não acabou, quando há mais de um dia) */
export function mediasPeriodo(dias: DiaPainel[], hoje: string): MediasPeriodo {
  const completos = dias.length > 1 ? dias.filter((d) => d.dia !== hoje) : dias;
  return {
    alimentacoes: media(completos.map((d) => d.alimentacoes)),
    fraldas: media(completos.map((d) => d.fraldas)),
    sonoMs: media(completos.map((d) => d.sonoMs)),
    maiorSonoMs: media(completos.map((d) => d.maiorSonoMs).filter((v) => v > 0)),
    ml: media(completos.map((d) => d.ml)),
    dias: completos.length,
  };
}

/** Variação em relação ao período anterior (0,12 = +12%); null sem base para comparar */
export function variacao(atual: number, anterior: number): number | null {
  if (!anterior || !isFinite(anterior)) return null;
  return (atual - anterior) / anterior;
}

export type MetricaMapa = 'alimentacoes' | 'sono' | 'fraldas';

/**
 * Mapa de horários: uma linha por dia, 24 colunas (horas). Alimentações e
 * fraldas = quantas começaram naquela hora; sono = minutos dormidos naquela hora.
 */
export function mapaHorarios(registros: Registro[], dias: string[], metrica: MetricaMapa, agora: Date): number[][] {
  const linhas = dias.map(() => Array<number>(24).fill(0));
  const indice = new Map(dias.map((d, i) => [d, i]));
  for (const r of registros) {
    if (metrica === 'sono') {
      if (r.tipo !== 'sono') continue;
      const a = ms(r.inicio);
      const b = r.fim ? ms(r.fim) : agora.getTime();
      // Hora a hora (limita a 3 dias por registro, para um sono esquecido não travar)
      for (let h = Math.floor(a / HORA) * HORA, n = 0; h < b && n < 72; h += HORA, n++) {
        const d = new Date(h);
        const i = indice.get(chaveDia(d));
        if (i === undefined) continue;
        linhas[i][d.getHours()] += Math.max(0, Math.min(b, h + HORA) - Math.max(a, h)) / 60_000;
      }
      continue;
    }
    const conta = metrica === 'alimentacoes' ? r.tipo === 'mamada' || r.tipo === 'mamadeira' : r.tipo === 'fralda';
    if (!conta) continue;
    const d = new Date(r.inicio);
    const i = indice.get(chaveDia(d));
    if (i !== undefined) linhas[i][d.getHours()]++;
  }
  return linhas;
}

/** Soma das linhas do mapa por hora do dia (o "dia típico" do período) */
export function perfilPorHora(mapa: number[][]): number[] {
  return Array.from({ length: 24 }, (_, h) => (mapa.length ? mapa.reduce((s, l) => s + l[h], 0) / mapa.length : 0));
}

export interface LinhaDoTempo {
  sono: { de: number; ate: number }[];
  alimentacoes: { em: number; tipo: 'mamada' | 'mamadeira'; ate: number }[];
  fraldas: { em: number; coco: boolean }[];
}

/** O que aconteceu entre `de` e `ate`, em frações de 0 a 1 do intervalo (para desenhar a linha do tempo) */
export function linhaDoTempo(registros: Registro[], de: Date, ate: Date, agora: Date): LinhaDoTempo {
  const a0 = de.getTime();
  const total = ate.getTime() - a0;
  const f = (t: number) => Math.min(1, Math.max(0, (t - a0) / total));
  const out: LinhaDoTempo = { sono: [], alimentacoes: [], fraldas: [] };
  for (const r of registros) {
    const ini = ms(r.inicio);
    const fim = r.fim ? ms(r.fim) : agora.getTime();
    if (fim < a0 || ini > ate.getTime()) continue;
    if (r.tipo === 'sono') out.sono.push({ de: f(ini), ate: f(fim) });
    else if (r.tipo === 'mamada' || r.tipo === 'mamadeira') out.alimentacoes.push({ em: f(ini), tipo: r.tipo, ate: f(Math.max(fim, ini)) });
    else if (r.tipo === 'fralda') out.fraldas.push({ em: f(ini), coco: !!r.dados.coco });
  }
  return out;
}

/** Tempo no peito de cada lado no período */
export function ladosDoPeito(registros: Registro[], de: Date, ate: Date, agora: Date): { E: number; D: number } {
  const t = { E: 0, D: 0 };
  for (const r of registros) {
    if (r.tipo !== 'mamada') continue;
    const i = ms(r.inicio);
    if (i < de.getTime() || i >= ate.getTime()) continue;
    const l = duracaoPorLado(r, agora);
    t.E += l.E;
    t.D += l.D;
  }
  return t;
}
