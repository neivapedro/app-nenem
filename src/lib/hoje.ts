// Cálculos do painel ao vivo da tela Hoje: previsão da próxima alimentação,
// médias dos últimos dias e textos curtos para caber nos anéis.
import { chaveDia, horaCurta, inicioDoDia, somarDiasLocal } from './datas';
import { diasDoPeriodo, intervaloMedioAlimentacao } from './padroes';
import { ultimaAlimentacao } from './registros';
import type { Lado, Registro, RegistroDe } from './tipos';

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
      ? textoPeito(ladosDoRegistro(ultima))
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
 * dias depois do nascimento e com algum registro (dias sem uso do app não puxam
 * a média para baixo). Sem nenhum dia assim, null.
 */
export function mediasUltimosDias(registros: Registro[], hoje: string, agora: Date, nascimento: string | null, n = 7): MediasDia | null {
  let de = somarDiasLocal(hoje, -n);
  const nasc = nascimento ? chaveDia(nascimento) : null;
  // O dia do nascimento é incompleto: fica de fora
  if (nasc && nasc >= de) de = somarDiasLocal(nasc, 1);
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

/** Progresso de hoje em relação à média (0 a 1; acima da média fica cheio). Sem média ainda, vazio. */
export function progresso(valor: number, media: number | null | undefined): number {
  if (media === null || media === undefined) return 0;
  if (media <= 0) return valor > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, valor / media));
}

/** Média arredondada para leitura: contagens inteiras, ml de 10 em 10, tempo de 10 em 10 min */
export function aproximar(valor: number, tipo: 'contagem' | 'ml' | 'duracao'): string {
  if (tipo === 'contagem') return String(Math.round(valor));
  if (tipo === 'ml') return `${Math.round(valor / 10) * 10} ml`;
  return duracaoCurta(Math.round(valor / (10 * MIN)) * 10 * MIN);
}

export interface Resumo24h {
  mamadas: number;
  peito: number;
  mamadeiras: number;
  fraldas: number;
  xixi: number;
  coco: number;
  /** Sono dentro da janela (sonos sobrepostos contam uma vez só) */
  sonoMs: number;
  maiorSonoMs: number;
}

/** Números simples das últimas 24 h para o cartão do Hoje (de `de` até `ate`) */
export function resumo24h(registros: Registro[], de: Date, ate: Date): Resumo24h {
  const a = de.getTime();
  const b = ate.getTime();
  const r: Resumo24h = { mamadas: 0, peito: 0, mamadeiras: 0, fraldas: 0, xixi: 0, coco: 0, sonoMs: 0, maiorSonoMs: 0 };
  const sonos: [number, number][] = [];
  for (const x of registros) {
    const ini = new Date(x.inicio).getTime();
    if (x.tipo === 'sono') {
      const fim = x.fim ? new Date(x.fim).getTime() : b;
      const i = Math.max(ini, a);
      const f = Math.min(fim, b);
      if (f > i) sonos.push([i, f]);
      continue;
    }
    if (ini < a || ini > b) continue;
    if (x.tipo === 'mamada') {
      r.mamadas++;
      r.peito++;
    } else if (x.tipo === 'mamadeira') {
      r.mamadas++;
      r.mamadeiras++;
    } else if (x.tipo === 'fralda') {
      r.fraldas++;
      if (x.dados.coco) r.coco++;
      if (x.dados.xixi) r.xixi++;
    }
  }
  sonos.sort((p, q) => p[0] - q[0]);
  let atual: [number, number] | null = null;
  const fecha = () => {
    if (!atual) return;
    const d = atual[1] - atual[0];
    r.sonoMs += d;
    r.maiorSonoMs = Math.max(r.maiorSonoMs, d);
  };
  for (const s of sonos) {
    if (atual && s[0] <= atual[1]) atual[1] = Math.max(atual[1], s[1]);
    else {
      fecha();
      atual = [s[0], s[1]];
    }
  }
  fecha();
  return r;
}


// ---------- Mamadas de hoje (hora e lado; sem duração) ----------
// Helpers locais: tolerantes a registros antigos (vários segmentos, em andamento).

export const nomeLado = (l: Lado) => (l === 'E' ? 'esquerdo' : 'direito');
export const ladoOposto = (l: Lado): Lado => (l === 'E' ? 'D' : 'E');

/** Lados do registro de mamada na ordem em que apareceram, sem repetir (nova: 1; antiga: 1 ou 2) */
export function ladosDoRegistro(r: RegistroDe<'mamada'>): Lado[] {
  const out: Lado[] = [];
  for (const s of r.dados?.segmentos ?? []) if ((s.lado === 'E' || s.lado === 'D') && !out.includes(s.lado)) out.push(s.lado);
  return out;
}

/** "peito direito" / "peito esquerdo e direito" / "peito" (sem lado) */
export function textoPeito(lados: Lado[]): string {
  if (!lados.length) return 'peito';
  if (lados.length === 2) return 'peito esquerdo e direito';
  return `peito ${nomeLado(lados[0])}`;
}

export interface AlimentacaoDoDia {
  id: string;
  tipo: 'mamada' | 'mamadeira';
  inicio: string;
  lados: Lado[];
  ml: number;
}

/** Mamadas e mamadeiras que começaram no dia, da mais antiga para a mais nova */
export function alimentacoesDoDia(registros: Registro[], dia: string): AlimentacaoDoDia[] {
  const a = inicioDoDia(dia).getTime();
  const b = inicioDoDia(somarDiasLocal(dia, 1)).getTime();
  const out: AlimentacaoDoDia[] = [];
  for (const r of registros) {
    if (r.tipo !== 'mamada' && r.tipo !== 'mamadeira') continue;
    const t = new Date(r.inicio).getTime();
    if (!(t >= a && t < b)) continue;
    out.push(r.tipo === 'mamada' ? { id: r.id, tipo: 'mamada', inicio: r.inicio, lados: ladosDoRegistro(r), ml: 0 } : { id: r.id, tipo: 'mamadeira', inicio: r.inicio, lados: [], ml: Number(r.dados?.ml) || 0 });
  }
  return out.sort((x, y) => new Date(x.inicio).getTime() - new Date(y.inicio).getTime());
}

export interface ContagemDoDia {
  /** Mamadas no peito + mamadeiras */
  total: number;
  peito: number;
  esquerdo: number;
  direito: number;
  mamadeiras: number;
  ml: number;
}

/** Quantas vezes cada lado (registro antigo com os dois lados conta nos dois, mas é uma mamada só) */
export function contagemDoDia(itens: AlimentacaoDoDia[]): ContagemDoDia {
  const c: ContagemDoDia = { total: itens.length, peito: 0, esquerdo: 0, direito: 0, mamadeiras: 0, ml: 0 };
  for (const i of itens) {
    if (i.tipo === 'mamadeira') {
      c.mamadeiras++;
      c.ml += i.ml;
    } else {
      c.peito++;
      if (i.lados.includes('E')) c.esquerdo++;
      if (i.lados.includes('D')) c.direito++;
    }
  }
  return c;
}

/** Lado para começar a próxima: o oposto do último peito (null sem peito registrado) */
export function proximoLado(registros: Registro[]): Lado | null {
  let melhor: RegistroDe<'mamada'> | null = null;
  for (const r of registros) if (r.tipo === 'mamada' && ladosDoRegistro(r).length && (!melhor || new Date(r.inicio) > new Date(melhor.inicio))) melhor = r;
  if (!melhor) return null;
  const segs = melhor.dados.segmentos;
  return ladoOposto(segs[segs.length - 1].lado);
}

/** "14:20 · peito direito" / "14:20 · mamadeira 90 ml" */
export function textoAlimentacao(a: AlimentacaoDoDia): string {
  const o = a.tipo === 'mamada' ? textoPeito(a.lados) : a.ml ? `mamadeira ${a.ml} ml` : 'mamadeira';
  return `${horaCurta(a.inicio)} · ${o}`;
}

export const REFERENCIA_OMS = { min: 8, max: 12 } as const;
export const DIAS_DO_RITMO = 3;

export interface RitmoEsperado {
  fonte: 'proprio' | 'oms';
  /** Dias inteiros que entraram na média (0 na referência) */
  dias: number;
  /** Média de mamadas por dia (ritmo próprio) */
  media: number | null;
  /** Mamadas esperadas no dia: média arredondada, ou 8 (início da faixa da OMS) */
  esperado: number;
  /** Quantas faltam até o fim do dia (nunca negativo; considera a hora) */
  faltam: number;
}

/**
 * Ritmo do bebê: média de mamadas por dia dos últimos `n` dias inteiros com dados
 * (olha até 7 dias para trás; hoje e o dia do nascimento ficam de fora). Com menos
 * de 2 dias assim, usa a referência da OMS (8 a 12 em 24 h). "Faltam" nunca é
 * negativo e, no ritmo próprio, não passa do que cabe no resto do dia.
 */
export function ritmoEsperado(registros: Registro[], hoje: string, agora: Date, nascimento: string | null, n = DIAS_DO_RITMO): RitmoEsperado {
  const feitas = alimentacoesDoDia(registros, hoje).length;
  const nasc = nascimento ? chaveDia(nascimento) : null;
  const contagens: number[] = [];
  for (let i = 1; i <= 7 && contagens.length < n; i++) {
    const dia = somarDiasLocal(hoje, -i);
    if (nasc && dia <= nasc) break;
    const c = alimentacoesDoDia(registros, dia).length;
    if (c > 0) contagens.push(c);
  }
  if (contagens.length < 2) return { fonte: 'oms', dias: 0, media: null, esperado: REFERENCIA_OMS.min, faltam: Math.max(0, REFERENCIA_OMS.min - feitas) };
  const media = contagens.reduce((s, x) => s + x, 0) / contagens.length;
  const esperado = Math.max(1, Math.round(media));
  const restante = Math.max(0, 1 - (agora.getHours() * 60 + agora.getMinutes()) / 1440);
  const faltam = Math.max(0, Math.min(esperado - feitas, Math.ceil(media * restante)));
  return { fonte: 'proprio', dias: contagens.length, media, esperado, faltam };
}

/** Faz mais de 3h30 desde a última alimentação? Só informativo (até 24 h) */
export const AVISO_DEPOIS_MS = 3.5 * HORA;
export function textoSemAlimentar(ultimoInicio: string | null, agora: Date): string | null {
  if (!ultimoInicio) return null;
  const ms = agora.getTime() - new Date(ultimoInicio).getTime();
  if (ms <= AVISO_DEPOIS_MS || ms > 24 * HORA) return null;
  return `Faz ${duracaoCurta(ms)} desde a última mamada.`;
}

/** "há 1h10" (curto, sem espaço no meio); menos de 1 min = "agora"; depois de 1 dia, em dias */
export function haCurto(iso: string, agora: Date): string {
  const ms = agora.getTime() - new Date(iso).getTime();
  if (ms < MIN) return 'agora';
  if (ms >= 24 * HORA) {
    const d = Math.floor(ms / (24 * HORA));
    return d === 1 ? 'há 1 dia' : `há ${d} dias`;
  }
  return `há ${duracaoCurta(ms)}`;
}
