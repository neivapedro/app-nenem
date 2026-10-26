// Painel de gráficos: números de cada dia, comparação com o período anterior,
// mapa de horários e linha do tempo. Sem dependências: testado no vitest.
import { chaveDia, inicioDoDia, somarDiasLocal } from './datas';
import { media } from './padroes';
import { duracaoPorLado, juntarIntervalos, registrosPorDia, resumoDia, type ResumoDia } from './registros';
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
  // Cada dia olha só os registros que podem tocá-lo (com 2 anos de dados, varrer tudo em cada dia travava a tela)
  const doDia = registrosPorDia(perto);
  const dias: DiaPainel[] = [];
  for (let dia = de; dia <= ate && dias.length < 4000; dia = somarDiasLocal(dia, 1)) {
    const lista = doDia(dia);
    const base = resumoDia(lista, dia, agora);
    const z = inicioDoDia(dia).getTime();
    const z1 = inicioDoDia(somarDiasLocal(dia, 1)).getTime();
    let maior = 0;
    const trechos: [number, number][] = [];
    for (const s of lista) {
      if (s.tipo !== 'sono') continue;
      const a = ms(s.inicio);
      const b = s.fim ? ms(s.fim) : agora.getTime();
      trechos.push([Math.max(a, z), Math.min(b, z1)]);
      if (a >= z && a < z1) maior = Math.max(maior, b - a);
    }
    // Sonos sobrepostos (os dois celulares) contam uma vez só, igual ao total do dia
    let noite = 0;
    for (const [x, y] of juntarIntervalos(trechos)) noite += partesNoite(x, y);
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

/**
 * Médias por dia (sem o dia de hoje, que ainda não acabou, quando há outros dias).
 * `desde` = primeiro dia com dados (nascimento ou primeiro registro): os dias
 * antes dele não entram, senão a média de um recém-nascido sai lá embaixo.
 */
export function mediasPeriodo(dias: DiaPainel[], hoje: string, desde?: string | null): MediasPeriodo {
  const validos = desde ? dias.filter((d) => d.dia >= desde) : dias;
  const completos = validos.length > 1 ? validos.filter((d) => d.dia !== hoje) : validos;
  return {
    alimentacoes: media(completos.map((d) => d.alimentacoes)),
    fraldas: media(completos.map((d) => d.fraldas)),
    sonoMs: media(completos.map((d) => d.sonoMs)),
    maiorSonoMs: media(completos.map((d) => d.maiorSonoMs).filter((v) => v > 0)),
    ml: media(completos.map((d) => d.ml)),
    dias: completos.length,
  };
}

/**
 * Primeiro dia com dados: o nascimento ou, sem ele, o dia do registro mais antigo.
 * Sem nada, null (todos os dias contam).
 */
export function inicioDosDados(nascimentoDia: string | null, registros: Registro[], hoje?: string): string | null {
  // O dia do nascimento é só um pedaço de dia: com outros dias inteiros depois dele, as médias começam no dia seguinte
  if (nascimentoDia) return hoje && hoje > somarDiasLocal(nascimentoDia, 1) ? somarDiasLocal(nascimentoDia, 1) : nascimentoDia;
  let primeiro: string | null = null;
  for (const r of registros) {
    const d = chaveDia(r.inicio);
    if (!primeiro || d < primeiro) primeiro = d;
  }
  return primeiro;
}

/** Dá para comparar com o período anterior só se ele inteiro já tinha dados */
export const periodoCoberto = (deAnterior: string, inicio: string | null) => !inicio || inicio <= deAnterior;

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
  if (metrica === 'sono') {
    // Sonos sobrepostos contam uma vez só; cada um no máximo 3 dias (um cronômetro esquecido não trava)
    const sonos = juntarIntervalos(
      registros.filter((r) => r.tipo === 'sono').map((r) => {
        const a = ms(r.inicio);
        return [a, Math.min(r.fim ? ms(r.fim) : agora.getTime(), a + 72 * HORA)] as [number, number];
      }),
    );
    for (const [a, b] of sonos) {
      for (let h = Math.floor(a / HORA) * HORA, n = 0; h < b && n < 72 * 3; h += HORA, n++) {
        const d = new Date(h);
        const i = indice.get(chaveDia(d));
        if (i === undefined) continue;
        linhas[i][d.getHours()] += Math.max(0, Math.min(b, h + HORA) - Math.max(a, h)) / 60_000;
      }
    }
    return linhas;
  }
  for (const r of registros) {
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

// ---------- Dia fora do padrão ----------

export interface ForaDoPadrao {
  indice: number;
  valor: number;
  /** Média dos dias considerados (a mesma linha de média do gráfico) */
  media: number;
  acima: boolean;
}

/**
 * O dia mais distante da média, só quando ele destoa de verdade dos outros:
 * pelo menos `minimo` de diferença, 25% da média dos outros dias e 2 desvios
 * padrão. `considerar` deixa de fora hoje (incompleto) e os dias sem dados.
 */
export function foraDoPadrao(valores: number[], considerar: boolean[], minimo: number): ForaDoPadrao | null {
  const idx = valores.map((_, i) => i).filter((i) => considerar[i] && isFinite(valores[i]));
  if (idx.length < 5) return null;
  const m = media(idx.map((i) => valores[i]));
  let escolhido = -1;
  let dist = -1;
  // Empate: fica o dia mais recente
  for (const i of idx) {
    const d = Math.abs(valores[i] - m);
    if (d >= dist - 1e-9) {
      dist = d;
      escolhido = i;
    }
  }
  const outros = idx.filter((i) => i !== escolhido).map((i) => valores[i]);
  const mo = media(outros);
  const dp = Math.sqrt(media(outros.map((v) => (v - mo) ** 2)));
  const dif = valores[escolhido] - mo;
  if (Math.abs(dif) < minimo || (mo > 0 && Math.abs(dif) / mo < 0.25) || Math.abs(dif) < 2 * dp) return null;
  return { indice: escolhido, valor: valores[escolhido], media: m, acima: dif > 0 };
}

// ---------- Narrativa automática (frases a partir de regras, sem IA) ----------

export type IconeFrase = 'sono' | 'recorde' | 'intervalo' | 'alimentacao' | 'mamadeira' | 'fralda';
/** Pedaço da frase: texto simples ou o número em destaque (negrito) */
export type ParteFrase = string | { destaque: string };

export interface FraseNarrativa {
  id: 'sono' | 'maior-sono' | 'intervalo' | 'alimentacoes' | 'mamadeira' | 'fraldas';
  icone: IconeFrase;
  partes: ParteFrase[];
  /** A frase inteira em texto simples (leitor de tela e testes) */
  texto: string;
}

export interface EntradaNarrativa {
  /** Dias do período (o último é hoje) */
  dias: DiaPainel[];
  /** Período anterior, do mesmo tamanho */
  anteriores: DiaPainel[];
  hoje: string;
  /** Primeiro dia com dados (`inicioDosDados`) */
  inicio: string | null;
  /** Intervalo médio entre alimentações no período e no anterior (ms) */
  intervaloMs?: number | null;
  intervaloAntesMs?: number | null;
  sexo?: 'M' | 'F' | null;
}

const MIN = 60_000;
const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const um = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/** 40 min, 2h34 (arredonda os minutos antes: nunca "1h60") */
export function duracaoCurta(msTotal: number): string {
  const min = Math.round(msTotal / MIN);
  return min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min} min`;
}

function palavrasPeriodo(n: number) {
  if (n === 7) return { agora: 'Esta semana', antes: 'na anterior', antesLongo: 'na semana anterior' };
  if (n === 14) return { agora: 'Nestas 2 semanas', antes: 'nas 2 anteriores', antesLongo: 'nas 2 semanas anteriores' };
  return { agora: `Nestes ${n} dias`, antes: `nos ${n} anteriores`, antesLongo: `nos ${n} dias anteriores` };
}

/** "na terça (21/10)", "no sábado (24/10)", "ontem (25/10)" */
function quandoFoi(dia: string, hoje: string): string {
  if (dia === somarDiasLocal(hoje, -1)) return `ontem (${ddmm(dia)})`;
  const w = inicioDoDia(dia).getDay();
  return `${w === 0 || w === 6 ? 'no' : 'na'} ${SEMANA[w]} (${ddmm(dia)})`;
}

const maisMenos = (d: number) => (d > 0 ? 'a mais' : 'a menos');

/**
 * 2 a 4 frases curtas sobre o período, em linguagem de pai e mãe. Só entra o
 * que é significativo (variação de 5% ou mais e uma diferença mínima em
 * minutos, ml ou unidades); nada com poucos dias de dados nem comparação com
 * um período anterior incompleto. Só descreve: nada de diagnóstico.
 */
export function narrativa(e: EntradaNarrativa): FraseNarrativa[] {
  const { dias, anteriores, hoje, inicio } = e;
  const n = dias.length;
  const comDados = (d: DiaPainel) => d.alimentacoes + d.fraldas > 0 || d.sonoMs > 0;
  // Dias inteiros: sem hoje (ainda não acabou) e sem os dias antes do nascimento/primeiro registro
  const completos = dias.filter((d) => (!inicio || d.dia >= inicio) && d.dia !== hoje);
  if (completos.filter(comDados).length < 3) return [];
  const cobre = (lista: DiaPainel[], f: (d: DiaPainel) => boolean) => lista.length > 0 && lista.filter(f).length >= Math.max(3, Math.ceil(lista.length * 0.8));
  const comparavel = n > 0 && anteriores.length === n && periodoCoberto(anteriores[0].dia, inicio) && cobre(anteriores, comDados);
  const a = mediasPeriodo(dias, hoje, inicio);
  const b = mediasPeriodo(anteriores, hoje, inicio);
  const P = palavrasPeriodo(n);
  const ORDEM: FraseNarrativa['id'][] = ['sono', 'maior-sono', 'intervalo', 'alimentacoes', 'mamadeira', 'fraldas'];
  const candidatas: { f: FraseNarrativa; peso: number }[] = [];
  const add = (id: FraseNarrativa['id'], icone: IconeFrase, partes: ParteFrase[], peso: number) => {
    const texto = partes.map((p) => (typeof p === 'string' ? p : p.destaque)).join('');
    candidatas.push({ f: { id, icone, partes, texto }, peso });
  };
  const ambos = (f: (d: DiaPainel) => boolean) => comparavel && cobre(completos, f) && cobre(anteriores, f);

  // Sono por dia
  if (ambos((d) => d.sonoMs > 0) && b.sonoMs > 0) {
    const dif = a.sonoMs - b.sonoMs;
    const rel = dif / b.sonoMs;
    const quanto = { destaque: `${duracaoCurta(Math.abs(dif))} ${maisMenos(dif)}` };
    // 14 h de sono por dia: 40 min já é bastante, mesmo sendo menos de 5%
    if (Math.abs(dif) >= 15 * MIN && Math.abs(rel) >= 0.03) {
      const pronome = e.sexo === 'M' ? 'ele' : e.sexo === 'F' ? 'ela' : null;
      add(
        'sono',
        'sono',
        pronome ? [`${P.agora} ${pronome} dormiu `, quanto, ` por dia do que ${P.antes}`] : [`${P.agora} foram `, quanto, ` de sono por dia do que ${P.antes}`],
        10 + Math.abs(rel) * 100,
      );
    } else if (Math.abs(rel) < 0.02 && Math.abs(dif) < 10 * MIN) add('sono', 'sono', ['Sono estável: ', { destaque: `${um(a.sonoMs / HORA)} h por dia` }, `, como ${P.antesLongo}`], 1.8);
  }

  // Maior sono seguido do período
  const comSono = completos.filter((d) => d.maiorSonoMs > 0);
  if (comSono.length >= 3) {
    const top = comSono.reduce((x, y) => (y.maiorSonoMs >= x.maiorSonoMs ? y : x));
    const rel = top.maiorSonoMs / media(comSono.map((d) => d.maiorSonoMs)) - 1;
    add('maior-sono', 'recorde', ['Maior sono seguido: ', { destaque: duracaoCurta(top.maiorSonoMs) }, ` ${quandoFoi(top.dia, hoje)}`], rel >= 0.15 ? 4 + Math.min(10, rel * 20) : 1.5);
  }

  // Intervalo entre alimentações
  const quem = completos.some((d) => d.mamadas > 0) ? 'mamadas' : 'mamadeiras';
  let temIntervalo = false;
  if (comparavel && e.intervaloMs && e.intervaloAntesMs) {
    const dif = e.intervaloMs - e.intervaloAntesMs;
    const rel = dif / e.intervaloAntesMs;
    if (Math.abs(dif) >= 5 * MIN && Math.abs(rel) >= 0.05) {
      temIntervalo = true;
      add(
        'intervalo',
        'intervalo',
        [`As ${quem} estão mais ${dif > 0 ? 'espaçadas' : 'próximas'}: `, { destaque: duracaoCurta(e.intervaloMs) }, ` em média (${dif > 0 ? '+' : '−'}${duracaoCurta(Math.abs(dif))})`],
        8 + Math.abs(rel) * 100,
      );
    }
  }

  // Alimentações por dia (se o intervalo já contou a história, não repete)
  if (!temIntervalo && ambos((d) => d.alimentacoes > 0) && b.alimentacoes > 0) {
    const dif = a.alimentacoes - b.alimentacoes;
    const rel = dif / b.alimentacoes;
    if (Math.abs(dif) >= 0.5 && Math.abs(rel) >= 0.08)
      add('alimentacoes', 'alimentacao', ['Foram ', { destaque: `${um(a.alimentacoes)} alimentações por dia` }, `, ${um(Math.abs(dif))} ${maisMenos(dif)} que ${P.antesLongo}`], 5 + Math.abs(rel) * 60);
  }

  // Mamadeira (ml por dia), só quando ela faz parte da rotina nos dois períodos
  if (ambos((d) => d.ml > 0) && b.ml > 0) {
    const dif = a.ml - b.ml;
    const rel = dif / b.ml;
    const ml = { destaque: `${Math.round(a.ml)} ml/dia` };
    if (Math.abs(dif) >= 20 && Math.abs(rel) >= 0.08) add('mamadeira', 'mamadeira', ['Mamadeira: ', ml, `, ${Math.round(Math.abs(dif))} ml ${maisMenos(dif)} que ${P.antesLongo}`], 5 + Math.abs(rel) * 60);
    else if (Math.abs(rel) < 0.05) add('mamadeira', 'mamadeira', ['Mamadeira: ', ml, ', estável'], 2);
  }

  // Fraldas: o dia que se destacou ou a variação da média (a mais forte das duas)
  const comFralda = completos.filter((d) => d.fraldas > 0);
  if (comFralda.length >= 4 && cobre(completos, (d) => d.fraldas > 0)) {
    const max = Math.max(...comFralda.map((d) => d.fraldas));
    const m = media(comFralda.map((d) => d.fraldas));
    const doMax = comFralda.filter((d) => d.fraldas === max);
    if (doMax.length === 1 && max - m >= Math.max(2, m * 0.25)) {
      const d = doMax[0];
      const nome = d.dia === somarDiasLocal(hoje, -1) ? 'ontem' : `${SEMANA[inicioDoDia(d.dia).getDay()]}${n > 7 ? `, ${ddmm(d.dia)}` : ''}`;
      add('fraldas', 'fralda', ['Dia com mais fraldas: ', { destaque: `${nome} (${max})` }], 3 + (max / m - 1) * 20);
    }
  }
  if (ambos((d) => d.fraldas > 0) && b.fraldas > 0) {
    const dif = a.fraldas - b.fraldas;
    const rel = dif / b.fraldas;
    if (Math.abs(dif) >= 1 && Math.abs(rel) >= 0.12)
      add('fraldas', 'fralda', ['Foram ', { destaque: `${um(a.fraldas)} fraldas por dia` }, `, ${um(Math.abs(dif))} ${maisMenos(dif)} que ${P.antesLongo}`], 3 + Math.abs(rel) * 50);
  }

  // Uma frase por assunto (a de maior peso), até 4; as "estáveis" só completam até 3
  const porId = new Map<FraseNarrativa['id'], { f: FraseNarrativa; peso: number }>();
  for (const c of candidatas) if (!porId.has(c.f.id) || porId.get(c.f.id)!.peso < c.peso) porId.set(c.f.id, c);
  const ordenadas = [...porId.values()].sort((x, y) => y.peso - x.peso);
  const fortes = ordenadas.filter((c) => c.peso > 2).slice(0, 4);
  const escolhidas = [...fortes, ...ordenadas.filter((c) => c.peso <= 2).slice(0, Math.max(0, 3 - fortes.length))];
  return escolhidas.sort((x, y) => ORDEM.indexOf(x.f.id) - ORDEM.indexOf(y.f.id)).map((c) => c.f);
}
