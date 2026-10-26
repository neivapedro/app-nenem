// Cálculos do painel ao vivo da tela Hoje: previsão da próxima alimentação,
// médias dos últimos dias e textos curtos para caber nos anéis.
import { chaveDia, horaCurta, somarDiasLocal } from './datas';
import { diasDoPeriodo, intervaloMedioAlimentacao } from './padroes';
import { ladoFinal, ultimaAlimentacao } from './registros';
import type { Registro, RegistroDe } from './tipos';

const MIN = 60_000;
const HORA = 3_600_000;

/** Janela usada para o intervalo médio entre alimentações */
export const JANELA_PREVISAO_H = 72;
/** Faltando menos que isso, o anel fica âmbar */
export const AVISO_ANTES_MS = 15 * MIN;

/** Duração curta, sem quebrar linha: "44 min", "1h46", "2h", "13h05" */
export function duracaoCurta(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / MIN));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export type EstadoPrevisao = 'cedo' | 'perto' | 'passou';

export interface PainelAlimentacao {
  ultima: RegistroDe<'mamada'> | RegistroDe<'mamadeira'>;
  /** Tempo desde o início da última alimentação */
  desdeMs: number;
  /** "terminou no E" ou "90 ml" */
  detalhe: string | null;
  /** Intervalo médio (ms) entre o início de alimentações seguidas; null sem dados suficientes */
  intervaloMs: number | null;
  /** Horário previsto da próxima (só com intervalo médio) */
  proxima: Date | null;
  /** Até a próxima (negativo quando já passou) */
  faltaMs: number | null;
  /** Quanto do intervalo médio já passou (0 a 1); sem previsão, 0 */
  fracao: number;
  estado: EstadoPrevisao;
}

/**
 * Última alimentação e, com pelo menos 3 alimentações nas últimas 72 h, a
 * previsão da próxima (início da última + intervalo médio). Sem nenhuma
 * alimentação, null. Se a última foi há mais de 12 h (app parado), não prevê.
 */
export function painelAlimentacao(registros: Registro[], agora: Date): PainelAlimentacao | null {
  const ultima = ultimaAlimentacao(registros);
  if (!ultima) return null;
  const desdeMs = Math.max(0, agora.getTime() - new Date(ultima.inicio).getTime());
  const detalhe =
    ultima.tipo === 'mamada'
      ? ladoFinal(ultima)
        ? `terminou no ${ladoFinal(ultima)}`
        : null
      : Number(ultima.dados.ml)
        ? `${Number(ultima.dados.ml)} ml`
        : null;

  const desde = new Date(agora.getTime() - JANELA_PREVISAO_H * HORA);
  const naJanela = registros.filter((r) => (r.tipo === 'mamada' || r.tipo === 'mamadeira') && new Date(r.inicio) >= desde && new Date(r.inicio) <= agora).length;
  const media = naJanela >= 3 && desdeMs <= 12 * HORA ? intervaloMedioAlimentacao(registros, desde, agora) : null;
  // Intervalos curtos demais (ex.: registros duplicados) não viram previsão
  const intervaloMs = media && media >= 20 * MIN ? media : null;
  if (!intervaloMs) return { ultima, desdeMs, detalhe, intervaloMs: null, proxima: null, faltaMs: null, fracao: 0, estado: 'cedo' };

  const proxima = new Date(new Date(ultima.inicio).getTime() + intervaloMs);
  const faltaMs = proxima.getTime() - agora.getTime();
  return {
    ultima,
    desdeMs,
    detalhe,
    intervaloMs,
    proxima,
    faltaMs,
    fracao: Math.min(1, Math.max(0, desdeMs / intervaloMs)),
    estado: faltaMs <= 0 ? 'passou' : faltaMs < AVISO_ANTES_MS ? 'perto' : 'cedo',
  };
}

/** "21:10" */
export function horaPrevista(p: PainelAlimentacao): string | null {
  return p.proxima ? horaCurta(p.proxima.toISOString()) : null;
}

export interface MediasDia {
  /** Quantos dias entraram na média */
  dias: number;
  alimentacoes: number;
  peitoMs: number;
  ml: number;
  fraldas: number;
  xixi: number;
  coco: number;
  sonoMs: number;
}

/**
 * Média por dia dos últimos `n` dias completos (hoje fica de fora). Só conta
 * dias desde o nascimento e com algum registro (dias sem uso do app não puxam
 * a média para baixo). Sem nenhum dia assim, null.
 */
export function mediasUltimosDias(registros: Registro[], hoje: string, agora: Date, nascimento: string | null, n = 7): MediasDia | null {
  let de = somarDiasLocal(hoje, -n);
  const nasc = nascimento ? chaveDia(nascimento) : null;
  if (nasc && nasc > de) de = nasc;
  const ate = somarDiasLocal(hoje, -1);
  if (de > ate) return null;
  const dias = diasDoPeriodo(registros, de, ate, agora).filter((d) => d.alimentacoes + d.fraldas + d.sonoMs > 0);
  if (!dias.length) return null;
  const m = (f: (d: (typeof dias)[number]) => number) => dias.reduce((s, d) => s + f(d), 0) / dias.length;
  return {
    dias: dias.length,
    alimentacoes: m((d) => d.alimentacoes),
    peitoMs: m((d) => d.peitoMs),
    ml: m((d) => d.ml),
    fraldas: m((d) => d.fraldas),
    xixi: m((d) => d.xixi),
    coco: m((d) => d.coco),
    sonoMs: m((d) => d.sonoMs),
  };
}

/** Progresso de hoje em relação à média (0 a 1; acima da média fica cheio) */
export function progresso(valor: number, media: number | null | undefined): number {
  if (!media || media <= 0) return valor > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, valor / media));
}

/** Média arredondada para leitura: contagens inteiras, ml de 10 em 10, tempo de 10 em 10 min */
export function aproximar(valor: number, tipo: 'contagem' | 'ml' | 'duracao'): string {
  if (tipo === 'contagem') return String(Math.round(valor));
  if (tipo === 'ml') return `${Math.round(valor / 10) * 10} ml`;
  return duracaoCurta(Math.round(valor / (10 * MIN)) * 10 * MIN);
}
