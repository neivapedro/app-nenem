// Momentos especiais: mesversário, aniversário, resumo do mês e lembranças "Há 1 mês…".
// Só regras e contas (sem tela), para testar com vitest.
import { somarMeses } from '../../supabase/functions/_shared/tempo.ts';
import { MARCOS_CADERNETA } from './conteudo';
import { chaveDia, dataBr, diasEntre, inicioDoDia, somarDiasLocal } from './datas';
import type { Bebe, Marco, Medida, Registro } from './tipos';

/** Meses completos de vida no dia `hoje` (31/jan faz 1 mês em 28/fev, como no resto do app) */
export function mesesCompletos(nascimentoIso: string, hoje: string): number {
  const n = chaveDia(nascimentoIso);
  if (hoje < n) return -1;
  const [a1, m1] = n.split('-').map(Number);
  const [a2, m2] = hoje.split('-').map(Number);
  let m = (a2 - a1) * 12 + (m2 - m1);
  while (m > 0 && somarMeses(n, m) > hoje) m--;
  return m;
}

export interface Mesversario {
  /** Meses completos hoje (12 = 1 ano) */
  meses: number;
  /** Aniversário de anos (meses múltiplo de 12) */
  aniversario: boolean;
  /** "2 meses", "1 ano", "1 ano e 3 meses" */
  idade: string;
}

/** "2 meses", "1 ano", "1 ano e 3 meses", "Nascimento" (0) */
export function textoMeses(meses: number): string {
  if (meses <= 0) return 'Nascimento';
  const anos = Math.floor(meses / 12);
  const m = meses % 12;
  const tm = m === 1 ? '1 mês' : `${m} meses`;
  if (!anos) return tm;
  const ta = anos === 1 ? '1 ano' : `${anos} anos`;
  return m ? `${ta} e ${tm}` : ta;
}

/** Hoje é mesversário (ou aniversário)? null nos outros dias e antes do nascimento */
export function mesversarioHoje(nascimentoIso: string | null | undefined, hoje: string): Mesversario | null {
  if (!nascimentoIso) return null;
  const meses = mesesCompletos(nascimentoIso, hoje);
  if (meses < 1 || somarMeses(chaveDia(nascimentoIso), meses) !== hoje) return null;
  return { meses, aniversario: meses % 12 === 0, idade: textoMeses(meses) };
}

/** Título da comemoração: "Heitor faz 2 meses! 🎉" / "Alice faz 1 ano! 🎂" / sem nome: "O bebê…" ou "A bebê…" */
export function tituloComemoracao(nome: string | null | undefined, m: Pick<Mesversario, 'meses' | 'aniversario' | 'idade'>, sexo?: 'M' | 'F' | null): string {
  const quem = nome?.trim() || (sexo === 'F' ? 'A bebê' : 'O bebê');
  return `${quem} faz ${m.idade}! ${m.aniversario ? '🎂' : '🎉'}`;
}

/** Com a preposição certa: "de 1 mês", "dos 2 meses", "de 1 ano", "dos 2 anos", "de 1 ano e 3 meses" */
export function deMeses(meses: number): string {
  const t = textoMeses(meses);
  return `${t.startsWith('1 ') ? 'de' : 'dos'} ${t}`;
}

/** "Foto do nascimento", "Foto de 1 mês", "Foto dos 2 meses", "Foto de 1 ano" */
export function textoFotoDoMes(meses: number): string {
  return meses <= 0 ? 'Foto do nascimento' : `Foto ${deMeses(meses)}`;
}

// ---------- Resumo do mês ----------

export interface MarcoDoMes {
  id: string;
  titulo: string;
  data: string;
  tipo: 'caderneta' | 'primeira-vez';
  foto: string | null;
}

export interface Crescimento {
  /** Valor mais recente até a data */
  atual: number;
  /** Data da medida mais recente */
  data: string;
  /** Diferença para a medida de antes do período (só se houve medida no período) */
  ganho: number | null;
  /** Data da medida de comparação */
  desde: string | null;
  /** A medida mais recente é a do nascimento (nenhuma medida depois) */
  aoNascer: boolean;
  /** A medida mais recente é de muito antes do fim do período (não é "o peso de agora") */
  antiga: boolean;
}

/** Medida mais velha que isto (antes do mesversário) não é "atual": mostra a data e não o ganho */
export const DIAS_MEDIDA_ATUAL = 45;

export interface ResumoMes {
  meses: number;
  /** Primeiro dia do período (mesversário anterior, ou o nascimento) */
  inicio: string;
  /** Dia do mesversário (fim do período) */
  fim: string;
  peso: Crescimento | null;
  altura: Crescimento | null;
  marcos: MarcoDoMes[];
  /** Mamadas no peito + mamadeiras no último mês */
  mamadas: number;
  fraldas: number;
  /** Total de sono no último mês (ms) */
  sonoMs: number;
  /** Dias do período com algum registro (para a média de sono por dia) */
  diasComRegistro: number;
  /** Foto do mês (caminho), se houver */
  foto: string | null;
}

const descricaoCaderneta = new Map(MARCOS_CADERNETA.map((m) => [m.id, m.descricao]));

/** Título legível de um marco (caderneta: a descrição oficial) */
export function tituloMarco(m: Pick<Marco, 'tipo' | 'marco_id' | 'titulo'>): string {
  if (m.tipo === 'caderneta') return descricaoCaderneta.get(m.marco_id ?? '') ?? m.titulo ?? 'Marco';
  return m.titulo?.trim() || (m.tipo === 'mes' ? 'Foto do mês' : 'Primeira vez');
}

/** Período do mês N: do mesversário N-1 (ou de N-12 no aniversário de anos) até o mesversário N */
export function periodoDoMes(nascimentoIso: string, meses: number, ano = false): { inicio: string; fim: string } {
  const n = chaveDia(nascimentoIso);
  const volta = ano && meses >= 12 ? 12 : 1;
  return { inicio: somarMeses(n, Math.max(0, meses - volta)), fim: somarMeses(n, Math.max(0, meses)) };
}

type Ponto = { data: string; valor: number };

function pontos(bebe: Bebe, medidas: Medida[], campo: 'peso_g' | 'comprimento_cm'): Ponto[] {
  const lista: Ponto[] = medidas.filter((m) => m[campo] != null && m.data).map((m) => ({ data: m.data, valor: m[campo] as number }));
  const aoNascer = campo === 'peso_g' ? bebe.peso_nascer_g : bebe.altura_nascer_cm;
  if (aoNascer && bebe.nascimento) lista.push({ data: chaveDia(bebe.nascimento), valor: aoNascer });
  return lista.sort((a, b) => a.data.localeCompare(b.data));
}

/**
 * Peso ou altura até `ate`: a medida mais recente e, se ela é do período (depois de `inicio`),
 * quanto mudou desde a última medida de antes do período (ou do nascimento).
 * `fim` (o dia do mesversário) e `nascimento` dizem se a medida é antiga ou a do nascimento:
 * medida de mais de DIAS_MEDIDA_ATUAL dias antes do fim fica sem ganho (não é o crescimento do período).
 */
export function crescimentoNoPeriodo(lista: Ponto[], inicio: string, ate: string, fim: string = ate, nascimento: string | null = null): Crescimento | null {
  const ate_ = lista.filter((p) => p.data <= ate);
  const atual = ate_[ate_.length - 1];
  if (!atual) return null;
  const antiga = diasEntre(atual.data, fim) > DIAS_MEDIDA_ATUAL;
  const aoNascer = !!nascimento && atual.data === nascimento;
  let ganho: number | null = null;
  let desde: string | null = null;
  if (atual.data > inicio && !antiga) {
    const antes = ate_.filter((p) => p.data <= inicio);
    const ref = antes[antes.length - 1];
    if (ref) {
      ganho = atual.valor - ref.valor;
      desde = ref.data;
    }
  }
  return { atual: atual.valor, data: atual.data, ganho, desde, aoNascer, antiga };
}

/**
 * Quando foi a medida mostrada, para não parecer "o peso de hoje": "ao nascer", "em 28/04"
 * (com o ano se for outro ano que o do mesversário). null quando o ganho do período já diz tudo.
 */
export function quandoMedida(c: Crescimento, fim: string): string | null {
  if (c.aoNascer) return 'ao nascer';
  if (c.ganho != null) return null;
  const br = dataBr(c.data);
  return `em ${c.data.slice(0, 4) === fim.slice(0, 4) ? br.slice(0, 5) : br}`;
}

/** Marcos (caderneta e "1ª vez") com data no período: depois de `inicio` (no 1º mês, desde o nascimento) até `fim` */
export function marcosNoPeriodo(marcos: Marco[], inicio: string, fim: string, incluirInicio = false): MarcoDoMes[] {
  return marcos
    .filter((m): m is Marco & { tipo: 'caderneta' | 'primeira-vez'; data: string } => (m.tipo === 'caderneta' || m.tipo === 'primeira-vez') && !!m.data)
    .filter((m) => (incluirInicio ? m.data >= inicio : m.data > inicio) && m.data <= fim)
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((m) => ({ id: m.id, titulo: tituloMarco(m), data: m.data, tipo: m.tipo, foto: m.foto }));
}

/** Foto do mês N (e, se não tiver, null) */
export function fotoDoMes(marcos: Marco[], meses: number): Marco | null {
  return marcos.find((m) => m.tipo === 'mes' && m.marco_id === `mes-${meses}` && !!m.foto) ?? null;
}

export interface FotoAnterior {
  /** Mês da foto (0 = nascimento) */
  meses: number;
  /** "Há 1 mês" / "Há 1 ano" */
  quando: string;
  /** "Foto de 1 mês", "Foto do nascimento" */
  titulo: string;
  foto: string;
}

/**
 * A foto do mês anterior, para o "Há 1 mês" dentro da comemoração do mesversário N
 * (no aniversário de anos, a de 1 ano antes). Ela foi gravada com a data do mesversário
 * anterior, que cai justamente no dia de hoje, quando a lembrança do topo fica escondida.
 */
export function fotoAnterior(marcos: Marco[], meses: number): FotoAnterior | null {
  if (meses < 1) return null;
  const ano = meses >= 12 && meses % 12 === 0;
  const antes = meses - (ano ? 12 : 1);
  const m = fotoDoMes(marcos, antes);
  if (!m?.foto) return null;
  return { meses: antes, quando: ano ? 'Há 1 ano' : 'Há 1 mês', titulo: textoFotoDoMes(antes), foto: m.foto };
}

/** Quanto do intervalo [a, b) cai dentro de [de, ate) (ms) */
function sobreposicao(a: number, b: number, de: number, ate: number): number {
  return Math.max(0, Math.min(b, ate) - Math.max(a, de));
}

/** Contas dos registros entre os dias `inicio` (inclusive) e `fim` (exclusive) */
export function contarRegistros(registros: Registro[], inicio: string, fim: string): Pick<ResumoMes, 'mamadas' | 'fraldas' | 'sonoMs' | 'diasComRegistro'> {
  const de = inicioDoDia(inicio).getTime();
  const ate = inicioDoDia(fim).getTime();
  let mamadas = 0;
  let fraldas = 0;
  let sonoMs = 0;
  const dias = new Set<string>();
  for (const r of registros) {
    const t = new Date(r.inicio).getTime();
    if (r.tipo === 'sono') {
      if (!r.fim) continue;
      const s = sobreposicao(t, new Date(r.fim).getTime(), de, ate);
      if (s > 0) {
        sonoMs += s;
        dias.add(chaveDia(r.inicio));
      }
      continue;
    }
    if (t < de || t >= ate) continue;
    dias.add(chaveDia(r.inicio));
    if (r.tipo === 'mamada' || r.tipo === 'mamadeira') mamadas++;
    else if (r.tipo === 'fralda') fraldas++;
  }
  return { mamadas, fraldas, sonoMs, diasComRegistro: dias.size };
}

/** Resumo do mês que terminou no mesversário N (no aniversário de anos, marcos e crescimento do ano) */
export function resumoDoMes(bebe: Bebe, dados: { registros: Registro[]; marcos: Marco[]; medidas: Medida[] }, meses: number, hoje: string): ResumoMes | null {
  if (!bebe.nascimento) return null;
  const ano = meses >= 12 && meses % 12 === 0;
  const { inicio, fim } = periodoDoMes(bebe.nascimento, meses, ano);
  const mes = periodoDoMes(bebe.nascimento, meses);
  // Medidas da consulta logo depois do mesversário ainda contam (até 7 dias, nunca depois de hoje)
  const ateMedida = [somarDiasLocal(fim, 7), hoje].sort()[0];
  const n = chaveDia(bebe.nascimento);
  return {
    meses,
    inicio,
    fim,
    peso: crescimentoNoPeriodo(pontos(bebe, dados.medidas, 'peso_g'), inicio, ateMedida, fim, n),
    altura: crescimentoNoPeriodo(pontos(bebe, dados.medidas, 'comprimento_cm'), inicio, ateMedida, fim, n),
    marcos: marcosNoPeriodo(dados.marcos, inicio, fim, meses - (ano ? 12 : 1) <= 0),
    ...contarRegistros(dados.registros, mes.inicio, mes.fim),
    foto: fotoDoMes(dados.marcos, meses)?.foto ?? null,
  };
}

// ---------- Textos ----------

/** 4350 → "4,35 kg" */
export function textoPeso(g: number): string {
  return `${(g / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

/** +650 → "+650 g"; +1250 → "+1,25 kg" */
export function textoGanhoPeso(g: number): string {
  const sinal = g > 0 ? '+' : g < 0 ? '−' : '';
  const a = Math.abs(g);
  return a >= 1000 ? `${sinal}${(a / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg` : `${sinal}${Math.round(a)} g`;
}

/** 54.5 → "54,5 cm" */
export function textoAltura(cm: number, sinal = false): string {
  const s = sinal ? (cm > 0 ? '+' : cm < 0 ? '−' : '') : '';
  return `${s}${Math.abs(cm).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} cm`;
}

/** 412 h → "412 h" */
export function textoHoras(ms: number): string {
  return `${Math.round(ms / 3_600_000)} h`;
}

const MESES_EXTENSO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "28 de outubro de 2026" */
export function dataExtenso(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number);
  return `${d} de ${MESES_EXTENSO[m - 1]} de ${a}`;
}

// ---------- Lembranças "Há 1 mês…" ----------

export interface Lembranca {
  /** id estável (para dispensar) */
  id: string;
  /** "Há 1 semana", "Há 2 meses", "Há 1 ano" */
  quando: string;
  titulo: string;
  detalhe: string | null;
  data: string;
  foto: string | null;
  tipo: 'mes' | 'caderneta' | 'primeira-vez' | 'registro';
  /** Para abrir: o marco ou o registro */
  marco?: Marco;
  registro?: Registro;
}

/** Quantos meses exatos separam `dia` de `hoje` (0 = não é um "mesversário" do dia) */
function mesesExatos(dia: string, hoje: string): number {
  if (dia >= hoje) return 0;
  const [a1, m1] = dia.split('-').map(Number);
  const [a2, m2] = hoje.split('-').map(Number);
  const k = (a2 - a1) * 12 + (m2 - m1);
  return k >= 1 && somarMeses(dia, k) === hoje ? k : 0;
}

/** "Há 1 semana", "Há 1 mês", "Há 3 meses", "Há 1 ano", "Há 1 ano e 2 meses"; null se não é data redonda */
export function textoHaQuanto(dia: string, hoje: string): string | null {
  if (diasEntre(dia, hoje) === 7) return 'Há 1 semana';
  const k = mesesExatos(dia, hoje);
  if (!k) return null;
  return `Há ${textoMeses(k)}`;
}

/** Peso da lembrança: foto do mês > marco/1ª vez com foto > marco/1ª vez > registro com anotação; e mais antigo antes */
function prioridade(tipo: Lembranca['tipo'], comFoto: boolean): number {
  if (tipo === 'mes') return 4;
  if (tipo === 'registro') return 1;
  return comFoto ? 3 : 2;
}

const NOME_REGISTRO: Record<Registro['tipo'], string> = {
  mamada: 'Mamada',
  mamadeira: 'Mamadeira',
  fralda: 'Fralda',
  sono: 'Sono',
  remedio: 'Remédio',
  temperatura: 'Temperatura',
  extracao: 'Extração',
  refeicao: 'Refeição',
};

/**
 * A lembrança do dia (no máximo uma): algo de exatamente 1 semana, 1 mês, 2 meses… atrás.
 * Não aparece antes do nascimento nem no dia do mesversário (aí a comemoração já ocupa o topo
 * e mostra a foto do mês anterior: ver fotoAnterior).
 *
 * Marcos e fotos (que vêm todos) valem em qualquer data redonda: N meses ou anos.
 * Registros com anotação só em "Há 1 semana" e "Há 1 mês": o app só carrega os últimos
 * 45 dias de registros, então datas mais antigas nunca teriam o que mostrar.
 */
export function lembrancaDoDia(bebe: Bebe | null, marcos: Marco[], registros: Registro[], hoje: string): Lembranca | null {
  if (!bebe?.nascimento || mesversarioHoje(bebe.nascimento, hoje)) return null;
  const nasc = chaveDia(bebe.nascimento);
  const candidatas: (Lembranca & { peso: number; distancia: number })[] = [];
  for (const m of marcos) {
    if (!m.data || m.data < nasc) continue;
    if (m.tipo === 'mes' && !m.foto) continue;
    const quando = textoHaQuanto(m.data, hoje);
    if (!quando) continue;
    const n = m.tipo === 'mes' ? Number(m.marco_id?.replace('mes-', '')) : NaN;
    candidatas.push({
      id: `marco:${m.id}`,
      quando,
      titulo: m.tipo === 'mes' ? (Number.isFinite(n) ? textoFotoDoMes(n) : 'Foto do mês') : tituloMarco(m),
      detalhe: m.observacao?.trim() || (m.tipo === 'primeira-vez' ? 'Primeira vez' : m.tipo === 'caderneta' ? 'Marco do desenvolvimento' : null),
      data: m.data,
      foto: m.foto,
      tipo: m.tipo,
      marco: m,
      peso: prioridade(m.tipo, !!m.foto),
      distancia: diasEntre(m.data, hoje),
    });
  }
  for (const r of registros) {
    const obs = r.observacao?.trim();
    if (!obs) continue;
    const dia = chaveDia(r.inicio);
    if (dia < nasc) continue;
    const quando = textoHaQuanto(dia, hoje);
    if (quando !== 'Há 1 semana' && quando !== 'Há 1 mês') continue;
    candidatas.push({ id: `registro:${r.id}`, quando, titulo: obs, detalhe: NOME_REGISTRO[r.tipo], data: dia, foto: null, tipo: 'registro', registro: r, peso: 1, distancia: diasEntre(dia, hoje) });
  }
  candidatas.sort((a, b) => b.peso - a.peso || b.distancia - a.distancia || a.id.localeCompare(b.id));
  const melhor = candidatas[0];
  if (!melhor) return null;
  const { peso: _p, distancia: _d, ...l } = melhor;
  return l;
}

/** "28/09/2026" (para mostrar a data da lembrança) */
export const dataLembranca = (l: Pick<Lembranca, 'data'>) => dataBr(l.data);

// ---------- Lembrar no aparelho ----------

const CHAVE_VISTO = 'app-nenem:mesversario-visto';
const CHAVE_LEMBRANCA = 'app-nenem:lembranca-dispensada';

/** Chave da comemoração: uma vez por mesversário (por bebê) neste aparelho */
export const chaveComemoracao = (bebeId: string, meses: number) => `${bebeId}:${meses}`;

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}
function escrever(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* sem armazenamento: só não lembra */
  }
}

export const comemoracaoVista = (bebeId: string, meses: number) => ler(CHAVE_VISTO) === chaveComemoracao(bebeId, meses);
export const marcarComemoracaoVista = (bebeId: string, meses: number) => escrever(CHAVE_VISTO, chaveComemoracao(bebeId, meses));
export const lembrancaDispensada = (hoje: string, id: string) => ler(CHAVE_LEMBRANCA) === `${hoje}|${id}`;
export const dispensarLembranca = (hoje: string, id: string) => escrever(CHAVE_LEMBRANCA, `${hoje}|${id}`);
