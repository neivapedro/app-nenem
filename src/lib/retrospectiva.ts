// Retrospectiva do ano (estilo "stories"): totais, recordes curiosos, crescimento, marcos,
// vacinas, fotos do mês e cofrinho, e quais telas mostrar. Só contas (sem tela), para o vitest.
import { DOSES } from '../../supabase/functions/_shared/vacinas.ts';
import { somarMeses } from '../../supabase/functions/_shared/tempo.ts';
import { resumo as resumoCofrinho, ehDeposito } from './cofrinho';
import { diasPrematuridade, escoreZ, faixaPercentil, idadeParaOms, percentilInteiro } from './crescimento';
import { chaveDia, diasEntre, inicioDoDia, somarDiasLocal } from './datas';
import { fotoDoMes, marcosNoPeriodo, mesesCompletos, textoMeses, type MarcoDoMes } from './momentos';
import { diasDoPeriodo } from './padroes';
import { juntarIntervalos } from './registros';
import type { Bebe, ContaCofrinho, Marco, Medida, MovimentoCofrinho, Registro, VacinaRegistro } from './tipos';

const HORA = 3_600_000;

// ---------- Período ----------

/** A partir de quantos meses de vida dá para ver a "retrospectiva até agora" */
export const MESES_MINIMOS_PARCIAL = 3;

export interface PeriodoRetro {
  /** 1 = primeiro ano */
  ano: number;
  /** Primeiro dia (nascimento ou aniversário anterior) */
  inicio: string;
  /** Aniversário que fecha o ano (exclusivo nos registros) ou, na parcial, hoje (inclusive) */
  fim: string;
  /** Último dia que entra nos totais */
  ultimoDia: string;
  /** O ano já fechou (aniversário de anos) */
  completo: boolean;
  /** Meses que o período cobre (12 no ano completo) */
  meses: number;
}

/**
 * Qual retrospectiva faz sentido hoje: o último ano completo (do 1º aniversário em diante)
 * ou, entre 3 e 11 meses, a parcial "até agora". `ano` força um ano completo (ex.: a
 * comemoração do 2º aniversário). null = ainda não nasceu ou tem menos de 3 meses.
 */
export function periodoRetrospectiva(nascimentoIso: string | null | undefined, hoje: string, ano?: number): PeriodoRetro | null {
  if (!nascimentoIso) return null;
  const n = chaveDia(nascimentoIso);
  const meses = mesesCompletos(nascimentoIso, hoje);
  const anoFechado = ano ?? Math.floor(meses / 12);
  if (anoFechado >= 1 && meses >= anoFechado * 12) {
    const inicio = somarMeses(n, (anoFechado - 1) * 12);
    const fim = somarMeses(n, anoFechado * 12);
    return { ano: anoFechado, inicio, fim, ultimoDia: somarDiasLocal(fim, -1), completo: true, meses: 12 };
  }
  if (ano != null || meses < MESES_MINIMOS_PARCIAL) return null;
  return { ano: 1, inicio: n, fim: hoje, ultimoDia: hoje, completo: false, meses };
}

const ORDINAIS = ['primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'sexto'];

/** "primeiro", "segundo"… (depois do sexto: "7º") */
export const ordinalAno = (ano: number) => ORDINAIS[ano - 1] ?? `${ano}º`;

type QuemBebe = { nome?: string | null; sexo?: 'M' | 'F' | null };

/** Como chamar o bebê: "Heitor" / "o bebê" / "a bebê", com "do Heitor", "ele", "o"/"a" */
export function quemE(bebe: QuemBebe): { nome: string; temNome: boolean; do: string; ele: string; o: string; Nome: string } {
  const nome = bebe.nome?.trim() ?? '';
  const f = bebe.sexo === 'F';
  if (!nome) return { nome: f ? 'a bebê' : 'o bebê', Nome: f ? 'A bebê' : 'O bebê', temNome: false, do: f ? 'da bebê' : 'do bebê', ele: f ? 'ela' : 'ele', o: f ? 'a' : 'o' };
  const g = bebe.sexo === 'M' ? { do: 'do', ele: 'ele', o: 'o' } : f ? { do: 'da', ele: 'ela', o: 'a' } : { do: 'do(a)', ele: nome, o: 'o(a)' };
  return { nome, Nome: nome, temNome: true, do: `${g.do} ${nome}`, ele: g.ele, o: g.o };
}

/** "O primeiro ano do Heitor" / "Os primeiros 5 meses da Alice" */
export function tituloRetrospectiva(p: Pick<PeriodoRetro, 'ano' | 'completo' | 'meses'>, bebe: QuemBebe): string {
  const q = quemE(bebe);
  if (p.completo) return `O ${ordinalAno(p.ano)} ano ${q.do}`;
  return p.meses === 1 ? `O primeiro mês ${q.do}` : `Os primeiros ${p.meses} meses ${q.do}`;
}

/** Adjetivo com o gênero do bebê ("corajoso"/"corajosa"; sem sexo: "corajoso(a)") */
export function flexao(sexo: 'M' | 'F' | null | undefined, masc: string, fem: string): string {
  if (sexo === 'F') return fem;
  if (sexo === 'M') return masc;
  return `${masc}(${fem.slice(masc.length - 1)})`;
}

// ---------- Totais e recordes ----------

export interface Recorde {
  valor: number;
  dia: string;
}

export interface TotaisRetro {
  /** Dias do período (até o último dia que entra) */
  dias: number;
  /** Dias com algum registro */
  diasComRegistro: number;
  /** Registros no período (todos os tipos) */
  registros: number;
  mamadas: number;
  peitoMs: number;
  mamadeiras: number;
  ml: number;
  fraldas: number;
  xixi: number;
  coco: number;
  sonoMs: number;
  /** Maior sono seguido (sonos que se encostam contam juntos) */
  maiorSono: { ms: number; dia: string } | null;
  /** Noites com um sono seguido de 6 h ou mais começando entre 18h e 3h */
  noitesInteiras: number;
  primeiraNoiteInteira: string | null;
  diaMaisMamadas: Recorde | null;
  diaMaisFraldas: Recorde | null;
  /** Hora (0–23) em que mais acordou de manhã (fim de sono de 2 h+ entre 4h e 11h) */
  horaAcordar: { hora: number; vezes: number } | null;
  /** Mês de vida (1 = 1º mês) com mais sono por dia (dias com registro) */
  mesMaisSono: { mes: number; mediaMs: number } | null;
  /** Mês de vida com mais alimentações por dia */
  mesMaisMamadas: { mes: number; media: number } | null;
}

/** Duração mínima de uma "noite inteira" */
export const NOITE_INTEIRA_MS = 6 * HORA;

function maior<T>(lista: T[], valor: (x: T) => number): T | null {
  let melhor: T | null = null;
  let v = -Infinity;
  for (const x of lista) {
    const y = valor(x);
    if (y > v) {
      v = y;
      melhor = x;
    }
  }
  return melhor;
}

/**
 * Totais do período [inicio, ultimoDia] (dias no fuso do aparelho).
 * O sono conta só a parte dentro do período; sonos sobrepostos (dois celulares) contam uma vez.
 */
export function totaisDoPeriodo(registros: Registro[], nascimentoIso: string, inicio: string, ultimoDia: string, agora: Date): TotaisRetro {
  const dias = ultimoDia >= inicio ? diasDoPeriodo(registros, inicio, ultimoDia, agora) : [];
  const de = inicioDoDia(inicio).getTime();
  const ate = Math.min(inicioDoDia(somarDiasLocal(ultimoDia, 1)).getTime(), agora.getTime());
  const t: TotaisRetro = {
    dias: dias.length,
    diasComRegistro: 0,
    registros: 0,
    mamadas: 0,
    peitoMs: 0,
    mamadeiras: 0,
    ml: 0,
    fraldas: 0,
    xixi: 0,
    coco: 0,
    sonoMs: 0,
    maiorSono: null,
    noitesInteiras: 0,
    primeiraNoiteInteira: null,
    diaMaisMamadas: null,
    diaMaisFraldas: null,
    horaAcordar: null,
    mesMaisSono: null,
    mesMaisMamadas: null,
  };
  const comRegistro = new Set<string>();
  const sonos: [number, number][] = [];
  for (const r of registros) {
    const ini = new Date(r.inicio).getTime();
    if (r.tipo === 'sono') {
      if (!r.fim) continue;
      const a = Math.max(ini, de);
      const b = Math.min(new Date(r.fim).getTime(), ate);
      if (b > a) {
        sonos.push([ini, new Date(r.fim).getTime()]);
        t.registros++;
        comRegistro.add(chaveDia(new Date(a)));
      }
      continue;
    }
    if (ini < de || ini >= ate) continue;
    t.registros++;
    comRegistro.add(chaveDia(r.inicio));
  }
  t.diasComRegistro = comRegistro.size;

  const porMes = new Map<number, { dias: number; sonoMs: number; alimentacoes: number }>();
  for (const d of dias) {
    t.mamadas += d.mamadas;
    t.peitoMs += d.peitoMs;
    t.mamadeiras += d.mamadeiras;
    t.ml += d.ml;
    t.fraldas += d.fraldas;
    t.xixi += d.xixi;
    t.coco += d.coco;
    t.sonoMs += d.sonoMs;
    if (!comRegistro.has(d.dia)) continue;
    const mes = mesesCompletos(nascimentoIso, d.dia) + 1;
    const m = porMes.get(mes) ?? { dias: 0, sonoMs: 0, alimentacoes: 0 };
    m.dias++;
    m.sonoMs += d.sonoMs;
    m.alimentacoes += d.alimentacoes;
    porMes.set(mes, m);
  }

  const mais = maior(dias, (d) => d.alimentacoes);
  if (mais && mais.alimentacoes > 0) t.diaMaisMamadas = { valor: mais.alimentacoes, dia: mais.dia };
  const maisF = maior(dias, (d) => d.fraldas);
  if (maisF && maisF.fraldas > 0) t.diaMaisFraldas = { valor: maisF.fraldas, dia: maisF.dia };

  // Meses com pelo menos 7 dias registrados; só vale comparar com dois meses ou mais
  const meses = [...porMes.entries()].filter(([, m]) => m.dias >= 7);
  if (meses.length >= 2) {
    const s = maior(meses, ([, m]) => m.sonoMs / m.dias);
    if (s && s[1].sonoMs > 0) t.mesMaisSono = { mes: s[0], mediaMs: s[1].sonoMs / s[1].dias };
    const a = maior(meses, ([, m]) => m.alimentacoes / m.dias);
    if (a && a[1].alimentacoes > 0) t.mesMaisMamadas = { mes: a[0], media: a[1].alimentacoes / a[1].dias };
  }

  // Sono seguido: junta os que se sobrepõem ou se encostam
  const seguidos = juntarIntervalos(sonos.map(([a, b]) => [a, b + 60_000] as [number, number])).map(([a, b]) => [a, b - 60_000] as [number, number]);
  const noites = new Set<string>();
  const acordou = new Map<number, number>();
  for (const [a, b] of seguidos) {
    if (b <= de || a >= ate) continue;
    const dur = b - a;
    if (!t.maiorSono || dur > t.maiorSono.ms) t.maiorSono = { ms: dur, dia: chaveDia(new Date(a)) };
    const hIni = new Date(a).getHours();
    if (dur >= NOITE_INTEIRA_MS && (hIni >= 18 || hIni < 3)) {
      // A noite é a do dia em que ela começou à tardinha (quem dormiu à 1h é da noite anterior)
      const noite = chaveDia(new Date(a - 12 * HORA));
      if (!noites.has(noite)) {
        noites.add(noite);
        if (!t.primeiraNoiteInteira || noite < t.primeiraNoiteInteira) t.primeiraNoiteInteira = noite;
      }
    }
    const hFim = new Date(b).getHours();
    if (dur >= 2 * HORA && hFim >= 4 && hFim < 11 && b <= ate) acordou.set(hFim, (acordou.get(hFim) ?? 0) + 1);
  }
  t.noitesInteiras = noites.size;
  const totalAcordou = [...acordou.values()].reduce((s, v) => s + v, 0);
  if (totalAcordou >= 5) {
    const [hora, vezes] = [...acordou.entries()].sort((x, y) => y[1] - x[1] || x[0] - y[0])[0];
    t.horaAcordar = { hora, vezes };
  }
  return t;
}

// ---------- Crescimento ----------

export interface MedidaRetro {
  de: number;
  deData: string;
  /** A primeira medida é a do nascimento */
  deNascer: boolean;
  ate: number;
  ateData: string;
  /** Percentil (OMS) da última medida; null sem sexo, fora das curvas ou sem idade para comparar */
  percentil: number | null;
}

export interface CrescimentoRetro {
  /** gramas */
  peso: MedidaRetro | null;
  /** cm */
  altura: MedidaRetro | null;
}

type Ponto = { data: string; valor: number };

function serie(bebe: Bebe, medidas: Medida[], campo: 'peso_g' | 'comprimento_cm'): { pontos: Ponto[]; nascer: Ponto | null } {
  const pontos: Ponto[] = medidas
    .filter((m) => m[campo] != null && (m[campo] as number) > 0 && m.data && (!m.bebe_id || m.bebe_id === bebe.id))
    .map((m) => ({ data: m.data, valor: m[campo] as number }));
  const v = campo === 'peso_g' ? bebe.peso_nascer_g : bebe.altura_nascer_cm;
  const nascer = v && bebe.nascimento ? { data: chaveDia(bebe.nascimento), valor: v } : null;
  return { pontos: pontos.sort((a, b) => a.data.localeCompare(b.data)), nascer };
}

/** Do começo ao fim do período: a primeira medida (no 1º ano, a do nascimento) e a última (até 7 dias depois do fim) */
function medidaDoPeriodo(bebe: Bebe, medidas: Medida[], campo: 'peso_g' | 'comprimento_cm', p: Pick<PeriodoRetro, 'ano' | 'inicio' | 'fim' | 'completo'>, hoje: string): MedidaRetro | null {
  const { pontos, nascer } = serie(bebe, medidas, campo);
  const limite = [p.completo ? somarDiasLocal(p.fim, 7) : p.fim, hoje].sort()[0];
  let primeira: Ponto | null;
  if (p.ano === 1 && nascer) primeira = nascer;
  else {
    // A medida mais perto do começo do período (até 30 dias depois dele)
    const antes = pontos.filter((x) => x.data <= p.inicio);
    const logo = pontos.find((x) => x.data > p.inicio && diasEntre(p.inicio, x.data) <= 30);
    primeira = antes[antes.length - 1] ?? logo ?? (p.ano === 1 ? pontos[0] ?? null : null);
  }
  const ateLimite = pontos.filter((x) => x.data <= limite);
  const ultima = ateLimite[ateLimite.length - 1];
  if (!primeira || !ultima || ultima.data <= primeira.data) return null;
  // A última precisa ser do período (e não de antes dele)
  if (ultima.data < p.inicio) return null;
  let percentil: number | null = null;
  if (bebe.sexo && bebe.nascimento) {
    const nasc = chaveDia(bebe.nascimento);
    const idade = idadeParaOms(diasEntre(nasc, ultima.data), diasPrematuridade(nasc, bebe.data_prevista));
    const valor = campo === 'peso_g' ? ultima.valor / 1000 : ultima.valor;
    const z = idade ? escoreZ(campo === 'peso_g' ? 'peso' : 'comprimento', bebe.sexo, idade.dia, valor) : null;
    // Fora das curvas não vira número de festa: isso é conversa com o pediatra
    if (z != null && faixaPercentil(z) === 'normal') percentil = percentilInteiro(z);
  }
  return { de: primeira.valor, deData: primeira.data, deNascer: !!nascer && primeira === nascer, ate: ultima.valor, ateData: ultima.data, percentil };
}

export function crescimentoDoPeriodo(bebe: Bebe, medidas: Medida[], p: Pick<PeriodoRetro, 'ano' | 'inicio' | 'fim' | 'completo'>, hoje: string): CrescimentoRetro {
  return { peso: medidaDoPeriodo(bebe, medidas, 'peso_g', p, hoje), altura: medidaDoPeriodo(bebe, medidas, 'comprimento_cm', p, hoje) };
}

// ---------- Marcos, vacinas, fotos, cofrinho ----------

export interface MarcoRetro extends MarcoDoMes {
  /** "com 2 meses", "com 1 mês e 3 dias", "no dia do nascimento" */
  idade: string | null;
  emoji: string;
}

/** "com 12 dias", "com 1 mês e 3 dias" (idade numa data); null antes do nascimento */
export function idadeNaData(nascimentoIso: string, dia: string): string | null {
  const n = chaveDia(nascimentoIso);
  if (dia < n) return null;
  const m = mesesCompletos(nascimentoIso, dia);
  const d = diasEntre(somarMeses(n, m), dia);
  if (!m && !d) return 'no dia do nascimento';
  const anos = Math.floor(m / 12);
  const meses = m % 12;
  const partes = [anos ? `${anos} ${anos === 1 ? 'ano' : 'anos'}` : '', meses ? `${meses} ${meses === 1 ? 'mês' : 'meses'}` : '', !anos && d ? `${d} ${d === 1 ? 'dia' : 'dias'}` : ''].filter(Boolean);
  return partes.length ? `com ${partes.join(' e ')}` : null;
}

const EMOJIS: [RegExp, string][] = [
  [/sorri/, '😊'],
  [/risad|riu|gargalh/, '😂'],
  [/banh/, '🛁'],
  [/passeio|parque|praia/, '🌳'],
  [/rol/, '🔄'],
  [/sent/, '🪑'],
  [/dent/, '🦷'],
  [/papa|papinha|comeu|fruta|refei|aliment/, '🥣'],
  [/engatinh/, '🐾'],
  [/palavra|falou|mam[aã]e|papai|s[ií]laba|jarg/, '💬'],
  [/passo|andou|anda/, '👣'],
  [/viag|avi[aã]o/, '✈️'],
  [/cabelo|corte/, '✂️'],
  [/natal|anivers|festa/, '🎉'],
  [/vov[oóô]|av[oóô]/, '👵'],
  [/dorm|noite/, '🌙'],
  [/cabe[cç]a|bru[cç]os/, '💪'],
  [/m[aã]o|segura|pin[cç]a/, '✋'],
  [/olh|rosto/, '👀'],
  [/som|ouv/, '👂'],
  [/tchau|imita|bate palm/, '👋'],
];

/** Emoji pela palavra do título ("Primeiro sorriso" → 😊) */
export function emojiDoMarco(titulo: string, tipo: 'caderneta' | 'primeira-vez'): string {
  const t = titulo.toLocaleLowerCase('pt-BR');
  return EMOJIS.find(([r]) => r.test(t))?.[1] ?? (tipo === 'caderneta' ? '⭐' : '✨');
}

/** Marcos e "1ª vez" do período, em ordem, com a idade de cada um */
export function marcosDoPeriodo(marcos: Marco[], nascimentoIso: string, p: Pick<PeriodoRetro, 'ano' | 'inicio' | 'fim' | 'ultimoDia' | 'completo'>): MarcoRetro[] {
  return marcosNoPeriodo(marcos, p.inicio, p.completo ? p.fim : p.ultimoDia, p.ano === 1).map((m) => ({ ...m, idade: idadeNaData(nascimentoIso, m.data), emoji: emojiDoMarco(m.titulo, m.tipo) }));
}

/**
 * Os marcos para caber numa tela: as "1ª vez" (escritas pela família) vêm antes dos da Caderneta,
 * espalhados pelo ano (sempre o primeiro e o último), e mostrados em ordem de data.
 */
export function destaqueMarcos<T extends Pick<MarcoRetro, 'id' | 'data' | 'tipo'>>(lista: T[], max: number): T[] {
  if (lista.length <= max) return lista;
  const espalhar = (xs: T[], n: number): T[] => {
    if (xs.length <= n) return xs;
    if (n <= 1) return xs.slice(-1);
    return Array.from({ length: n }, (_, i) => xs[Math.round((i * (xs.length - 1)) / (n - 1))]);
  };
  const vezes = lista.filter((m) => m.tipo === 'primeira-vez');
  const escolhidos = espalhar(vezes, max);
  if (escolhidos.length < max) escolhidos.push(...espalhar(lista.filter((m) => m.tipo !== 'primeira-vez'), max - escolhidos.length));
  return escolhidos.sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id));
}

export interface VacinasRetro {
  doses: number;
  /** Nomes das vacinas (sem repetir), na ordem em que foram tomadas */
  nomes: string[];
}

const nomeDaDose = new Map(DOSES.map((d) => [d.id, d.vacina]));
/** Nome curto que a família reconhece */
const APELIDO_VACINA: Record<string, string> = { Influenza: 'Gripe', 'Poliomielite inativada': 'Pólio (VIP)', 'Pneumocócica conjugada': 'Pneumocócica', 'Meningocócica conjugada': 'Meningocócica' };

/** Vacinas aplicadas no período (o dia do aniversário entra: as vacinas de 12 meses) */
export function vacinasDoPeriodo(vacinas: VacinaRegistro[], p: Pick<PeriodoRetro, 'inicio' | 'fim'>, bebeId?: string): VacinasRetro {
  const lista = vacinas
    .filter((v) => v.status === 'aplicada' && v.data && v.data >= p.inicio && v.data <= p.fim && (!bebeId || !v.bebe_id || v.bebe_id === bebeId))
    .sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''));
  const nomes: string[] = [];
  for (const v of lista) {
    const bruto = (nomeDaDose.get(v.dose_id) ?? v.nome?.trim() ?? v.dose_id.replace(/^extra:/, '')).replace(/\s*\(.*\)\s*$/, '');
    const nome = APELIDO_VACINA[bruto] ?? bruto;
    if (nome && !nomes.includes(nome)) nomes.push(nome);
  }
  return { doses: lista.length, nomes };
}

export interface FotoRetro {
  /** Mês de vida (0 = nascimento) */
  meses: number;
  rotulo: string;
  foto: string;
  data: string | null;
}

/** Fotos do mês do período (do nascimento/aniversário anterior até o aniversário), em ordem */
export function fotosDoPeriodo(marcos: Marco[], p: Pick<PeriodoRetro, 'ano' | 'completo' | 'meses'>): FotoRetro[] {
  const de = (p.ano - 1) * 12;
  const ate = p.completo ? p.ano * 12 : p.meses;
  const fotos: FotoRetro[] = [];
  for (let n = de; n <= ate; n++) {
    const m = fotoDoMes(marcos, n);
    if (m?.foto) fotos.push({ meses: n, rotulo: n === 0 ? 'Nascimento' : textoMeses(n), foto: m.foto, data: m.data });
  }
  return fotos;
}

export interface CofrinhoRetro {
  /** Saldo no fim do período (centavos) */
  saldo: number;
  /** Depósitos no período */
  depositos: number;
  /** Quanto entrou em depósitos no período (centavos) */
  depositado: number;
  /** Pessoas diferentes que depositaram no período */
  pessoas: number;
}

export function cofrinhoDoPeriodo(contas: ContaCofrinho[], movs: MovimentoCofrinho[], p: Pick<PeriodoRetro, 'inicio' | 'fim'>, bebeId?: string): CofrinhoRetro | null {
  const minhas = contas.filter((c) => !bebeId || !c.bebe_id || c.bebe_id === bebeId);
  const ids = new Set(minhas.map((c) => c.id));
  const meus = movs.filter((m) => ids.has(m.conta_id));
  if (!meus.length) return null;
  const { saldo } = resumoCofrinho(minhas, meus, p.fim);
  const doPeriodo = meus.filter((m) => ehDeposito(m) && m.data >= p.inicio && m.data <= p.fim);
  const pessoas = new Set(doPeriodo.map((m) => m.de?.trim().toLocaleLowerCase('pt-BR')).filter(Boolean));
  const r = { saldo, depositos: doPeriodo.length, depositado: doPeriodo.reduce((s, m) => s + m.valor_centavos, 0), pessoas: pessoas.size };
  return r.saldo > 0 || r.depositos > 0 ? r : null;
}

// ---------- Telas ----------

export type IdTela = 'abertura' | 'alimentacao' | 'fraldas' | 'sono' | 'recordes' | 'crescimento' | 'marcos' | 'vacinas' | 'fotos' | 'cofrinho' | 'encerramento';

export interface DadosRetro {
  periodo: PeriodoRetro;
  totais: TotaisRetro;
  crescimento: CrescimentoRetro;
  marcos: MarcoRetro[];
  vacinas: VacinasRetro;
  fotos: FotoRetro[];
  cofrinho: CofrinhoRetro | null;
}

/** Os recordes que existem, na ordem de mostrar (no máximo 4) */
export function recordesDisponiveis(t: TotaisRetro): ('mamadas' | 'acordar' | 'mesSono' | 'fraldas' | 'mesMamadas')[] {
  const lista: ('mamadas' | 'acordar' | 'mesSono' | 'fraldas' | 'mesMamadas')[] = [];
  if (t.diaMaisMamadas && t.diaMaisMamadas.valor >= 3) lista.push('mamadas');
  if (t.horaAcordar) lista.push('acordar');
  if (t.mesMaisSono) lista.push('mesSono');
  if (t.diaMaisFraldas && t.diaMaisFraldas.valor >= 3) lista.push('fraldas');
  if (t.mesMaisMamadas && lista.length < 4) lista.push('mesMamadas');
  return lista.slice(0, 4);
}

/** Quanto precisa ter para a tela valer a pena (menos que isso, ela é pulada) */
export const MINIMO = { alimentacoes: 10, fraldas: 10, sonoMs: 10 * HORA, fotos: 2 } as const;

/** Telas a mostrar, em ordem: as sem dado suficiente ficam de fora (abertura e encerramento sempre) */
export function selecionarTelas(d: DadosRetro, fotosDisponiveis = d.fotos.length): IdTela[] {
  const t = d.totais;
  const telas: IdTela[] = ['abertura'];
  if (t.mamadas + t.mamadeiras >= MINIMO.alimentacoes) telas.push('alimentacao');
  if (t.fraldas >= MINIMO.fraldas) telas.push('fraldas');
  if (t.sonoMs >= MINIMO.sonoMs) telas.push('sono');
  if (recordesDisponiveis(t).length >= 2) telas.push('recordes');
  if (d.crescimento.peso || d.crescimento.altura) telas.push('crescimento');
  if (d.marcos.length) telas.push('marcos');
  if (d.vacinas.doses) telas.push('vacinas');
  if (fotosDisponiveis >= MINIMO.fotos) telas.push('fotos');
  if (d.cofrinho) telas.push('cofrinho');
  telas.push('encerramento');
  return telas;
}

/** Junta tudo o que a retrospectiva precisa */
export function montarRetrospectiva(
  bebe: Bebe,
  dados: { registros: Registro[]; medidas: Medida[]; marcos: Marco[]; vacinas: VacinaRegistro[]; contas: ContaCofrinho[]; movimentos: MovimentoCofrinho[] },
  periodo: PeriodoRetro,
  hoje: string,
  agora: Date,
): DadosRetro | null {
  if (!bebe.nascimento) return null;
  return {
    periodo,
    totais: totaisDoPeriodo(dados.registros, bebe.nascimento, periodo.inicio, periodo.ultimoDia, agora),
    crescimento: crescimentoDoPeriodo(bebe, dados.medidas, periodo, hoje),
    marcos: marcosDoPeriodo(dados.marcos, bebe.nascimento, periodo),
    vacinas: vacinasDoPeriodo(dados.vacinas, periodo, bebe.id),
    fotos: fotosDoPeriodo(dados.marcos, periodo),
    cofrinho: cofrinhoDoPeriodo(dados.contas, dados.movimentos, periodo, bebe.id),
  };
}

// ---------- Textos ----------

/** 2874 → "2.874" */
export const milhar = (n: number) => Math.round(n).toLocaleString('pt-BR');

/** 38450 ml → "38,5 litros"; 850 → "850 ml" */
export function textoLeite(ml: number): string {
  if (ml < 1000) return `${Math.round(ml)} ml`;
  const l = ml / 1000;
  const t = l.toLocaleString('pt-BR', { maximumFractionDigits: l >= 100 ? 0 : 1 });
  return `${t} ${t === '1' ? 'litro' : 'litros'}`;
}

/** Horas inteiras ("5.120 horas"; "1 hora") */
export function textoHorasLongas(ms: number): string {
  const h = Math.round(ms / HORA);
  return `${milhar(h)} ${h === 1 ? 'hora' : 'horas'}`;
}

/** "8h40" (sono seguido) */
export function textoSonoSeguido(ms: number): string {
  const min = Math.round(ms / 60_000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`;
}

/** Quantos dias inteiros o sono soma ("213 dias") */
export function diasDormindo(ms: number): number {
  return Math.floor(ms / (24 * HORA));
}

/** Intervalo médio entre trocas de fralda (ms) nos dias com registro */
export function intervaloFraldas(t: Pick<TotaisRetro, 'fraldas' | 'diasComRegistro'>): number | null {
  if (t.fraldas < MINIMO.fraldas || !t.diasComRegistro) return null;
  return (t.diasComRegistro * 24 * HORA) / t.fraldas;
}

/** "1º mês", "3º mês" */
export const textoMesDeVida = (mes: number) => `${mes}º mês`;

/** Plural simples: (1, 'mamada') → "1 mamada"; (3, 'mamada') → "3 mamadas" */
export function plural(n: number, um: string, varios = `${um}s`): string {
  return `${milhar(n)} ${Math.round(n) === 1 ? um : varios}`;
}

/** Peso em kg ou g com vírgula: 9600 → "9,6 kg" */
export function textoKg(g: number): string {
  return `${(g / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;
}

/** "2,9×" (quantas vezes o peso de nascer) */
export function vezesPeso(de: number, ate: number): string | null {
  if (!(de > 0) || ate / de < 1.5) return null;
  return `${(ate / de).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}×`;
}
