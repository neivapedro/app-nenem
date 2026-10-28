// O dia num relógio de 24 h: ângulos, cortes na janela das últimas 24 h e o
// "dia típico" (sono e alimentações por hora). Funções puras, testadas no vitest.
//
// Meia-noite fica no topo e o dia corre no sentido horário (6h à direita, 12h
// embaixo, 18h à esquerda): é o mesmo sentido de qualquer relógio e a mesma
// ordem da faixa linear (horas da esquerda para a direita).
import { chaveDia, horaCurta, somarDiasLocal } from './datas';
import { duracaoCurta, mapaHorarios } from './painel';
import { duracaoPorLado, juntarIntervalos, ladoFinal, textoFralda } from './registros';
import type { ConteudoMamadeira, Lado, Registro } from './tipos';

export const HORA_MS = 3_600_000;
export const DIA_MS = 24 * HORA_MS;
const ms = (iso: string) => new Date(iso).getTime();

// ---------- Geometria ----------

/** Ângulo (graus, sentido horário a partir do topo) da hora local do instante: 0h = 0°, 6h = 90°, 12h = 180° */
export function anguloDoInstante(t: number | Date): number {
  const d = typeof t === 'number' ? new Date(t) : t;
  const min = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60_000;
  return (min / 1440) * 360;
}

/** Ponto do círculo de centro (cx, cy) e raio r no ângulo dado (0° = topo, sentido horário) */
export function pontoNoCirculo(cx: number, cy: number, r: number, graus: number): { x: number; y: number } {
  const rad = (graus * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

const arred = (n: number) => Math.round(n * 100) / 100;

/**
 * Caminho SVG de um arco de `de` a `ate` graus (sentido horário; `ate` pode passar
 * de 360). Um arco de volta inteira vira dois meios arcos (o SVG não desenha um
 * arco que começa e termina no mesmo ponto).
 */
export function caminhoArco(cx: number, cy: number, r: number, de: number, ate: number): string {
  const vao = Math.min(360, Math.max(0, ate - de));
  if (vao >= 359.99) {
    const a = pontoNoCirculo(cx, cy, r, de);
    const b = pontoNoCirculo(cx, cy, r, de + 180);
    return `M${arred(a.x)} ${arred(a.y)}A${r} ${r} 0 1 1 ${arred(b.x)} ${arred(b.y)}A${r} ${r} 0 1 1 ${arred(a.x)} ${arred(a.y)}`;
  }
  const a = pontoNoCirculo(cx, cy, r, de);
  const b = pontoNoCirculo(cx, cy, r, de + vao);
  return `M${arred(a.x)} ${arred(a.y)}A${r} ${r} 0 ${vao > 180 ? 1 : 0} 1 ${arred(b.x)} ${arred(b.y)}`;
}

/** Caminho de um setor de anel (para o dia típico): entre os raios r0 < r1, de `de` a `ate` graus */
export function caminhoSetor(cx: number, cy: number, r0: number, r1: number, de: number, ate: number): string {
  const grande = ate - de > 180 ? 1 : 0;
  const a = pontoNoCirculo(cx, cy, r1, de);
  const b = pontoNoCirculo(cx, cy, r1, ate);
  const c = pontoNoCirculo(cx, cy, r0, ate);
  const d = pontoNoCirculo(cx, cy, r0, de);
  return `M${arred(a.x)} ${arred(a.y)}A${r1} ${r1} 0 ${grande} 1 ${arred(b.x)} ${arred(b.y)}L${arred(c.x)} ${arred(c.y)}A${r0} ${r0} 0 ${grande} 0 ${arred(d.x)} ${arred(d.y)}Z`;
}

/** Ângulo (0 a 360) de um ponto (x, y) em relação ao centro — o inverso de pontoNoCirculo */
export function anguloDoPonto(cx: number, cy: number, x: number, y: number): { graus: number; raio: number } {
  const dx = x - cx;
  const dy = y - cy;
  const g = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return { graus: (g + 360) % 360, raio: Math.hypot(dx, dy) };
}

/** O instante da janela [agora − 24 h, agora] que cai no ângulo dado (o ponteiro é a costura) */
export function instanteDoAngulo(graus: number, agora: Date): number {
  const atras = (((anguloDoInstante(agora) - graus) % 360) + 360) % 360;
  return agora.getTime() - (atras / 360) * DIA_MS;
}

// ---------- O que entra no relógio ----------

export type TipoItemRelogio = 'sono' | 'mamada' | 'mamadeira' | 'fralda';

export interface ItemRelogio {
  /** id do registro (sonos sobrepostos juntados levam o id do primeiro) */
  id: string;
  tipo: TipoItemRelogio;
  /** Início e fim reais (ms). Fim = agora quando está em andamento */
  ini: number;
  fim: number;
  /** O trecho que cabe na janela (ms) */
  de: number;
  ate: number;
  /** Ângulos do trecho na janela; `a1` pode passar de 360 (atravessa a meia-noite) */
  a0: number;
  a1: number;
  emAndamento: boolean;
  /** Começou antes da janela (aparece cortado no ponteiro) */
  cortado: boolean;
  /** Mamada: tempo em cada peito e o lado em que terminou */
  lados?: { E: number; D: number };
  ladoFinal?: Lado | null;
  /** Mamadeira */
  ml?: number;
  conteudo?: ConteudoMamadeira;
  /** Fralda */
  xixi?: boolean;
  coco?: boolean;
}

export interface Relogio24h {
  de: number;
  ate: number;
  sono: ItemRelogio[];
  alimentacoes: ItemRelogio[];
  fraldas: ItemRelogio[];
  /** Sono dentro da janela (sobreposições contam uma vez só) */
  sonoMs: number;
  /** Sono em andamento agora (o arco cresce até o ponteiro) */
  sonoAtual: ItemRelogio | null;
  /** Fim do último sono terminado (para "acordado há…") */
  acordouEm: number | null;
  vazio: boolean;
}

/** Um sono esquecido aberto não pinta o relógio inteiro de roxo para sempre: no máximo 3 dias */
const SONO_MAX_MS = 72 * HORA_MS;

/** Monta o relógio das últimas 24 h (janela que termina em `agora`) */
export function montarRelogio(registros: Registro[], agora: Date): Relogio24h {
  const ate = agora.getTime();
  const de = ate - DIA_MS;
  const angulos = (a: number, b: number) => {
    const a0 = anguloDoInstante(a);
    return { a0, a1: a0 + ((b - a) / DIA_MS) * 360 };
  };
  const base = (id: string, tipo: TipoItemRelogio, ini: number, fim: number, emAndamento: boolean): ItemRelogio => {
    const x = Math.max(ini, de);
    const y = Math.min(Math.max(fim, ini), ate);
    return { id, tipo, ini, fim, de: x, ate: y, ...angulos(x, y), emAndamento, cortado: ini < de };
  };

  // Sono: junta os sobrepostos (os dois celulares marcaram "Dormiu")
  const sonos = registros
    .filter((r) => r.tipo === 'sono')
    .map((r) => {
      const ini = ms(r.inicio);
      const aberto = !r.fim;
      const fim = aberto ? Math.min(ate, ini + SONO_MAX_MS) : ms(r.fim!);
      return { id: r.id, ini, fim, aberto };
    })
    .filter((s) => s.fim > de && s.ini < ate && s.fim > s.ini)
    .sort((a, b) => a.ini - b.ini);
  const sono: ItemRelogio[] = [];
  for (const s of sonos) {
    const ult = sono[sono.length - 1];
    if (ult && s.ini <= ult.fim) {
      const fim = Math.max(ult.fim, s.fim);
      const novo = base(ult.id, 'sono', ult.ini, fim, ult.emAndamento || (s.aberto && s.fim >= ate));
      sono[sono.length - 1] = novo;
    } else sono.push(base(s.id, 'sono', s.ini, s.fim, s.aberto && s.fim >= ate));
  }
  const sonoMs = juntarIntervalos(sono.map((s) => [s.de, s.ate])).reduce((t, [a, b]) => t + (b - a), 0);
  const sonoAtual = sono.find((s) => s.emAndamento) ?? null;

  const alimentacoes: ItemRelogio[] = [];
  const fraldas: ItemRelogio[] = [];
  for (const r of registros) {
    const ini = ms(r.inicio);
    if (r.tipo === 'mamada') {
      const fim = r.fim ? ms(r.fim) : ate;
      if (fim < de || ini > ate) continue;
      const l = duracaoPorLado(r, agora);
      alimentacoes.push({ ...base(r.id, 'mamada', ini, fim, !r.fim), lados: { E: l.E, D: l.D }, ladoFinal: ladoFinal(r) });
    } else if (r.tipo === 'mamadeira') {
      if (ini < de || ini > ate) continue;
      alimentacoes.push({ ...base(r.id, 'mamadeira', ini, ini, false), ml: Number(r.dados.ml) || 0, conteudo: r.dados.conteudo });
    } else if (r.tipo === 'fralda') {
      if (ini < de || ini > ate) continue;
      fraldas.push({ ...base(r.id, 'fralda', ini, ini, false), xixi: !!r.dados.xixi, coco: !!r.dados.coco });
    }
  }
  alimentacoes.sort((a, b) => a.ini - b.ini);
  fraldas.sort((a, b) => a.ini - b.ini);

  // "Acordado há…": o fim do sono terminado mais recente (mesmo antes da janela)
  let acordouEm: number | null = null;
  for (const r of registros) if (r.tipo === 'sono' && r.fim && ms(r.fim) <= ate) acordouEm = Math.max(acordouEm ?? 0, ms(r.fim));

  return { de, ate, sono, alimentacoes, fraldas, sonoMs, sonoAtual, acordouEm, vazio: !sono.length && !alimentacoes.length && !fraldas.length };
}

/** Todos os itens do relógio em ordem de tempo (para percorrer com o dedo e para o leitor de tela) */
export function itensEmOrdem(r: Relogio24h): ItemRelogio[] {
  return [...r.sono, ...r.alimentacoes, ...r.fraldas].sort((a, b) => a.de - b.de || a.ate - b.ate);
}

/** Distância (ms) de um instante até um item: zero dentro dele */
export function distanciaAte(item: ItemRelogio, t: number): number {
  if (t < item.de) return item.de - t;
  if (t > item.ate) return t - item.ate;
  return 0;
}

/** O item mais perto do instante, até `maximo` ms de distância (dentro de um trecho ganha o mais curto) */
export function itemMaisPerto(itens: ItemRelogio[], t: number, maximo: number): ItemRelogio | null {
  let melhor: ItemRelogio | null = null;
  let melhorD = Infinity;
  for (const it of itens) {
    const d = distanciaAte(it, t);
    const desempate = melhor && d === melhorD && it.ate - it.de < melhor.ate - melhor.de;
    if (d < melhorD || desempate) {
      melhor = it;
      melhorD = d;
    }
  }
  return melhorD <= maximo ? melhor : null;
}

// ---------- Textos ----------

const NOME_ITEM: Record<TipoItemRelogio, string> = { sono: 'Sono', mamada: 'Peito', mamadeira: 'Mamadeira', fralda: 'Fralda' };
export const nomeItem = (t: TipoItemRelogio) => NOME_ITEM[t];

/** "22:10 (ontem)" quando o instante é de outro dia que o de `agora` */
function horaComDia(t: number, agora: Date): string {
  const h = horaCurta(new Date(t).toISOString());
  const dia = chaveDia(new Date(t));
  const hoje = chaveDia(agora);
  if (dia === hoje) return h;
  if (dia === somarDiasLocal(hoje, -1)) return `${h} de ontem`;
  return `${h} de ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

export interface DetalheItem {
  titulo: string;
  /** "13:05–15:20" ou "15:30" */
  quando: string;
  /** "2h15", "120 ml" */
  valor: string;
  /** Linha extra: lados, conteúdo, xixi/cocô */
  extra: string | null;
  /** Frase completa para a dica e o leitor de tela */
  frase: string;
}

export function detalheItem(it: ItemRelogio, agora: Date): DetalheItem {
  const h = (t: number) => horaCurta(new Date(t).toISOString());
  if (it.tipo === 'sono') {
    const dur = duracaoCurta(it.fim - it.ini);
    const quando = it.emAndamento ? `desde ${h(it.ini)}` : `${h(it.ini)}–${h(it.fim)}`;
    const extra = it.emAndamento ? 'dormindo agora' : it.cortado ? `começou às ${horaComDia(it.ini, agora)}` : null;
    const frase = it.emAndamento
      ? `Sono desde ${horaComDia(it.ini, agora)}, dormindo há ${dur}`
      : `Sono das ${horaComDia(it.ini, agora)} às ${horaComDia(it.fim, agora)}, ${dur}`;
    return { titulo: 'Sono', quando, valor: dur, extra, frase };
  }
  if (it.tipo === 'mamada') {
    const l = it.lados ?? { E: 0, D: 0 };
    const total = l.E + l.D || it.fim - it.ini;
    const dur = duracaoCurta(total);
    const partes = [l.E ? `E ${duracaoCurta(l.E)}` : '', l.D ? `D ${duracaoCurta(l.D)}` : ''].filter(Boolean).join(' · ');
    const quando = it.emAndamento ? `desde ${h(it.ini)}` : `${h(it.ini)}–${h(it.fim)}`;
    const fimLado = !it.emAndamento && it.ladoFinal ? `, terminou no ${it.ladoFinal === 'E' ? 'esquerdo' : 'direito'}` : '';
    const frase = `${it.emAndamento ? 'Mamando no peito' : 'Mamada no peito'} ${it.emAndamento ? `desde ${horaComDia(it.ini, agora)}` : `às ${horaComDia(it.ini, agora)}`}, ${dur}${partes ? ` (${partes.replace(' · ', ' e ')})` : ''}${fimLado}`;
    return { titulo: 'Peito', quando, valor: dur, extra: partes || null, frase };
  }
  if (it.tipo === 'mamadeira') {
    const conteudo = it.conteudo === 'formula' ? 'fórmula' : 'leite materno';
    return {
      titulo: 'Mamadeira',
      quando: h(it.ini),
      valor: `${it.ml ?? 0} ml`,
      extra: conteudo,
      frase: `Mamadeira às ${horaComDia(it.ini, agora)}, ${it.ml ?? 0} ml de ${conteudo}`,
    };
  }
  const oque = textoFralda({ xixi: !!it.xixi, coco: !!it.coco });
  return { titulo: 'Fralda', quando: h(it.ini), valor: oque, extra: null, frase: `Fralda às ${horaComDia(it.ini, agora)}: ${oque.toLowerCase()}` };
}

/** O resumo lido pelo leitor de tela no lugar do desenho */
export function resumoRelogio(r: Relogio24h, agora: Date): string {
  if (r.vazio) return 'Relógio das últimas 24 horas: nenhum sono, alimentação ou fralda registrado.';
  const peito = r.alimentacoes.filter((a) => a.tipo === 'mamada').length;
  const mamadeira = r.alimentacoes.length - peito;
  const partes = [
    r.sono.length ? `${duracaoCurta(r.sonoMs)} de sono em ${r.sono.length} ${r.sono.length === 1 ? 'trecho' : 'trechos'}` : 'nenhum sono',
    r.alimentacoes.length
      ? `${r.alimentacoes.length} ${r.alimentacoes.length === 1 ? 'alimentação' : 'alimentações'} (${peito} no peito, ${mamadeira} de mamadeira)`
      : 'nenhuma alimentação',
    r.fraldas.length ? `${r.fraldas.length} ${r.fraldas.length === 1 ? 'fralda' : 'fraldas'}` : 'nenhuma fralda',
  ];
  const atual = r.sonoAtual ? ` Dormindo há ${duracaoCurta(agora.getTime() - r.sonoAtual.ini)}.` : '';
  return `Relógio das últimas 24 horas, até ${horaCurta(agora.toISOString())}: ${partes.join(', ')}.${atual}`;
}

// ---------- Dia típico (padrão médio dos últimos dias) ----------

export interface DiaTipico {
  dias: string[];
  /** Fração de cada hora em que o bebê dormiu, em média (0 a 1), 24 posições */
  sono: number[];
  /** Alimentações que começaram em cada hora, por dia em média */
  alimentacoes: number[];
  /** Sono médio por dia */
  sonoMs: number;
}

/**
 * Os últimos `n` dias inteiros (sem hoje) que têm algum registro de sono ou de
 * alimentação, a partir de `inicio` (nascimento/primeiro registro) quando houver.
 */
export function diasDoPadrao(registros: Registro[], hoje: string, n: number, inicio: string | null): string[] {
  const comDados = new Set<string>();
  for (const r of registros) if (r.tipo === 'sono' || r.tipo === 'mamada' || r.tipo === 'mamadeira') comDados.add(chaveDia(r.inicio));
  const dias: string[] = [];
  for (let i = 1; i <= n; i++) {
    const d = somarDiasLocal(hoje, -i);
    if (inicio && d < inicio) break;
    if (comDados.has(d)) dias.unshift(d);
  }
  return dias;
}

export function diaTipico(registros: Registro[], dias: string[], agora: Date): DiaTipico | null {
  if (!dias.length) return null;
  const sono = mapaHorarios(registros, dias, 'sono', agora);
  const alim = mapaHorarios(registros, dias, 'alimentacoes', agora);
  const mediaHora = (m: number[][], h: number) => m.reduce((s, l) => s + l[h], 0) / m.length;
  const fracao = Array.from({ length: 24 }, (_, h) => Math.min(1, mediaHora(sono, h) / 60));
  return {
    dias,
    sono: fracao,
    alimentacoes: Array.from({ length: 24 }, (_, h) => mediaHora(alim, h)),
    sonoMs: fracao.reduce((s, f) => s + f, 0) * HORA_MS,
  };
}

/** Os trechos do dia típico em que o bebê costuma dormir (mais da metade dos dias), juntando horas vizinhas */
export function horasDeSonoTipicas(sono: number[], limite = 0.5): { de: number; ate: number }[] {
  const out: { de: number; ate: number }[] = [];
  for (let h = 0; h < 24; h++) {
    if (sono[h] < limite) continue;
    const ult = out[out.length - 1];
    if (ult && ult.ate === h) ult.ate = h + 1;
    else out.push({ de: h, ate: h + 1 });
  }
  // Atravessa a meia-noite: junta o último com o primeiro
  if (out.length > 1 && out[0].de === 0 && out[out.length - 1].ate === 24) {
    const ult = out.pop()!;
    out[0] = { de: ult.de, ate: out[0].ate + 24 };
  }
  return out;
}
