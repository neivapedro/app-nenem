import { chaveDia, horaCurta, inicioDoDia, somarDiasLocal, textoDuracao } from './datas';
import type { CorFezes, Lado, Registro, RegistroDe, Segmento, TipoRegistro } from './tipos';

export const NOMES_TIPO: Record<TipoRegistro, string> = {
  mamada: 'Mamada',
  mamadeira: 'Mamadeira',
  fralda: 'Fralda',
  sono: 'Sono',
  remedio: 'Remédio',
  temperatura: 'Temperatura',
  extracao: 'Extração de leite',
  refeicao: 'Refeição',
};

export const NOME_LADO: Record<Lado, string> = { E: 'Esquerdo', D: 'Direito' };

export const outroLado = (l: Lado): Lado => (l === 'E' ? 'D' : 'E');

export interface OpcaoCorFezes {
  valor: CorFezes;
  rotulo: string;
  cor: string;
  /** Cor clara: sinal de alerta na Caderneta da Criança */
  alerta: boolean;
}

export const CORES_FEZES: OpcaoCorFezes[] = [
  { valor: 'meconio', rotulo: 'Mecônio (escuro)', cor: '#2f3a24', alerta: false },
  { valor: 'amarela', rotulo: 'Amarela', cor: '#e8b629', alerta: false },
  { valor: 'mostarda', rotulo: 'Mostarda', cor: '#b98a1c', alerta: false },
  { valor: 'verde', rotulo: 'Verde', cor: '#5f7d2a', alerta: false },
  { valor: 'marrom', rotulo: 'Marrom', cor: '#7a4a1f', alerta: false },
  { valor: 'amarelo-claro', rotulo: 'Amarelo-clara', cor: '#f2e3a0', alerta: true },
  { valor: 'cinza', rotulo: 'Cinza', cor: '#bdbab0', alerta: true },
  { valor: 'branca', rotulo: 'Esbranquiçada', cor: '#f1efe8', alerta: true },
];

export const AVISO_FEZES_CLARAS =
  'Cocô claro (esbranquiçado, cinza ou amarelo-claro) é sinal de alerta na Caderneta da Criança: pode indicar problema no fígado. Mostre ao pediatra o quanto antes.';

export function corFezes(valor: CorFezes | null | undefined): OpcaoCorFezes | null {
  return CORES_FEZES.find((c) => c.valor === valor) ?? null;
}

const ms = (iso: string) => new Date(iso).getTime();

export function ordenarRecentes<T extends { inicio: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => ms(b.inicio) - ms(a.inicio));
}

// ---------- Mamada no peito ----------

export function duracaoPorLado(r: RegistroDe<'mamada'>, agora: Date): { E: number; D: number; total: number } {
  const t = { E: 0, D: 0 };
  for (const s of r.dados.segmentos ?? []) {
    const fim = s.fim ? ms(s.fim) : agora.getTime();
    t[s.lado] += Math.max(0, fim - ms(s.inicio));
  }
  return { ...t, total: t.E + t.D };
}

/** Lado em que o bebê está mamando agora (null = pausada ou finalizada) */
export function ladoAtivo(r: RegistroDe<'mamada'>): Lado | null {
  if (r.fim) return null;
  return r.dados.segmentos.find((s) => !s.fim)?.lado ?? null;
}

/** Lado em que terminou a mamada (o último trecho) */
export function ladoFinal(r: RegistroDe<'mamada'>): Lado | null {
  const segs = r.dados.segmentos;
  return segs.length ? segs[segs.length - 1].lado : null;
}

/** Em que lado terminou a mamada mais recente (para mostrar ao começar a próxima) */
export function ultimoLado(registros: Registro[]): Lado | null {
  const ultima = ordenarRecentes(registros.filter((r): r is RegistroDe<'mamada'> => r.tipo === 'mamada'))[0];
  return ultima ? ladoFinal(ultima) : null;
}

type Base = Pick<Registro, 'id' | 'familia_id' | 'bebe_id' | 'criado_por'>;

export function iniciarMamada(base: Base, lado: Lado, agora: Date): RegistroDe<'mamada'> {
  const inicio = agora.toISOString();
  return { ...base, tipo: 'mamada', inicio, fim: null, observacao: null, dados: { segmentos: [{ lado, inicio, fim: null }] } };
}

function fecharAtivo(segs: Segmento[], agora: Date): Segmento[] {
  const fim = agora.toISOString();
  return segs.map((s) => (s.fim ? s : { ...s, fim: ms(fim) < ms(s.inicio) ? s.inicio : fim }));
}

/** Troca de peito: fecha o trecho atual e abre o outro lado. Pausada: retoma no lado indicado. */
export function trocarLado(r: RegistroDe<'mamada'>, agora: Date, lado?: Lado): RegistroDe<'mamada'> {
  const atual = ladoAtivo(r);
  const proximo = lado ?? (atual ? outroLado(atual) : outroLado(ladoFinal(r) ?? 'D'));
  const segs = fecharAtivo(r.dados.segmentos, agora);
  return { ...r, fim: null, dados: { segmentos: [...segs, { lado: proximo, inicio: agora.toISOString(), fim: null }] } };
}

export function pausarMamada(r: RegistroDe<'mamada'>, agora: Date): RegistroDe<'mamada'> {
  return { ...r, dados: { segmentos: fecharAtivo(r.dados.segmentos, agora) } };
}

export function finalizarMamada(r: RegistroDe<'mamada'>, agora: Date): RegistroDe<'mamada'> {
  const segs = fecharAtivo(r.dados.segmentos, agora);
  const ultimoFim = segs.reduce((m, s) => Math.max(m, ms(s.fim!)), ms(r.inicio));
  return { ...r, fim: new Date(ultimoFim).toISOString(), dados: { segmentos: segs } };
}

/** Finaliza numa hora do passado (cronômetro esquecido): o que veio depois dessa hora é cortado. */
export function finalizarMamadaEm(r: RegistroDe<'mamada'>, quando: Date): RegistroDe<'mamada'> {
  const t = Math.max(quando.getTime(), ms(r.inicio));
  const segmentos = r.dados.segmentos.filter((s) => ms(s.inicio) < t).map((s) => ({ ...s, fim: new Date(Math.min(s.fim ? ms(s.fim) : t, t)).toISOString() }));
  return { ...r, fim: new Date(t).toISOString(), dados: { segmentos } };
}

/**
 * Finaliza na hora escolhida na folha "Esqueceu o cronômetro?". O campo tem só
 * minutos: se a hora é "agora" ou (mamada pausada) a hora da pausa, mantém os
 * trechos como estão, sem perder os segundos.
 */
export function finalizarMamadaNaHora(r: RegistroDe<'mamada'>, quando: Date, agora = new Date()): RegistroDe<'mamada'> {
  if (agora.getTime() - quando.getTime() < 60_000) return finalizarMamada(r, agora);
  const pausada = r.dados.segmentos.every((s) => s.fim);
  const ultimoFim = Math.max(ms(r.inicio), ...r.dados.segmentos.map((s) => (s.fim ? ms(s.fim) : 0)));
  if (pausada && quando.getTime() >= ultimoFim - 60_000) return finalizarMamada(r, quando);
  return finalizarMamadaEm(r, quando);
}

/** Cronômetro aberto há tempo demais (provavelmente esquecido): mamada > 3 h, sono > 14 h */
export const LIMITE_ESQUECIDO_MS = { mamada: 3 * 3_600_000, sono: 14 * 3_600_000 } as const;
export function cronometroEsquecido(r: Registro, agora: Date): boolean {
  if (r.fim || (r.tipo !== 'mamada' && r.tipo !== 'sono')) return false;
  return agora.getTime() - ms(r.inicio) > LIMITE_ESQUECIDO_MS[r.tipo];
}

/** Mamada registrada depois: minutos em cada peito, um depois do outro, a partir do início. */
export function mamadaManual(base: Base, inicioIso: string, minutos: { E: number; D: number }, primeiro: Lado): RegistroDe<'mamada'> {
  const ordem: Lado[] = [primeiro, outroLado(primeiro)];
  let t = ms(inicioIso);
  const segmentos: Segmento[] = [];
  for (const lado of ordem) {
    const min = Math.max(0, Math.round(minutos[lado] || 0));
    if (!min) continue;
    const fim = t + min * 60_000;
    segmentos.push({ lado, inicio: new Date(t).toISOString(), fim: new Date(fim).toISOString() });
    t = fim;
  }
  return { ...base, tipo: 'mamada', inicio: inicioIso, fim: new Date(t).toISOString(), observacao: null, dados: { segmentos } };
}

// ---------- Sono ----------

export function iniciarSono(base: Base, agora: Date): RegistroDe<'sono'> {
  return { ...base, tipo: 'sono', inicio: agora.toISOString(), fim: null, observacao: null, dados: {} };
}

export function finalizarSono(r: RegistroDe<'sono'>, agora: Date): RegistroDe<'sono'> {
  const fim = Math.max(agora.getTime(), ms(r.inicio));
  return { ...r, fim: new Date(fim).toISOString() };
}

// ---------- Situação atual ----------

export function emAndamento(registros: Registro[]): { mamada: RegistroDe<'mamada'> | null; sono: RegistroDe<'sono'> | null } {
  const recentes = ordenarRecentes(registros.filter((r) => !r.fim));
  return {
    mamada: (recentes.find((r) => r.tipo === 'mamada') as RegistroDe<'mamada'> | undefined) ?? null,
    sono: (recentes.find((r) => r.tipo === 'sono') as RegistroDe<'sono'> | undefined) ?? null,
  };
}

export function ultimaAlimentacao(registros: Registro[]): RegistroDe<'mamada'> | RegistroDe<'mamadeira'> | null {
  return (
    (ordenarRecentes(registros.filter((r) => r.tipo === 'mamada' || r.tipo === 'mamadeira'))[0] as
      | RegistroDe<'mamada'>
      | RegistroDe<'mamadeira'>
      | undefined) ?? null
  );
}

export function ultimoDoTipo<T extends TipoRegistro>(registros: Registro[], tipo: T): RegistroDe<T> | null {
  return (ordenarRecentes(registros.filter((r) => r.tipo === tipo))[0] as RegistroDe<T> | undefined) ?? null;
}

// ---------- Resumo do dia ----------

export interface ResumoDia {
  mamadas: number;
  peitoMs: number;
  mamadeiras: number;
  ml: number;
  fraldas: number;
  xixi: number;
  coco: number;
  sonoMs: number;
  /** Mamadas + mamadeiras */
  alimentacoes: number;
}

/** Totais de um dia (fuso do aparelho). O sono conta só a parte dentro do dia. */
export function resumoDia(registros: Registro[], dia: string, agora: Date): ResumoDia {
  const r: ResumoDia = { mamadas: 0, peitoMs: 0, mamadeiras: 0, ml: 0, fraldas: 0, xixi: 0, coco: 0, sonoMs: 0, alimentacoes: 0 };
  const ini = inicioDoDia(dia).getTime();
  const fimDia = inicioDoDia(somarDiasLocal(dia, 1)).getTime();
  // Sonos que se sobrepõem (ex.: os dois celulares marcaram "Dormiu") contam uma vez só
  const sonos: [number, number][] = [];
  for (const x of registros) {
    if (x.tipo === 'sono') {
      const a = Math.max(ms(x.inicio), ini);
      const b = Math.min(x.fim ? ms(x.fim) : agora.getTime(), fimDia);
      if (b > a) sonos.push([a, b]);
      continue;
    }
    if (chaveDia(x.inicio) !== dia) continue;
    if (x.tipo === 'mamada') {
      r.mamadas++;
      r.peitoMs += duracaoPorLado(x, agora).total;
    } else if (x.tipo === 'mamadeira') {
      r.mamadeiras++;
      r.ml += Number(x.dados.ml) || 0;
    } else if (x.tipo === 'fralda') {
      r.fraldas++;
      if (x.dados.xixi) r.xixi++;
      if (x.dados.coco) r.coco++;
    }
  }
  sonos.sort((x, y) => x[0] - y[0]);
  let fimAte = -Infinity;
  for (const [a, b] of sonos) {
    const de = Math.max(a, fimAte);
    if (b > de) r.sonoMs += b - de;
    fimAte = Math.max(fimAte, b);
  }
  r.alimentacoes = r.mamadas + r.mamadeiras;
  return r;
}

/**
 * Para resumir muitos dias sem varrer todos os registros em cada dia: devolve,
 * para um dia, os registros que podem tocá-lo (os do dia, os da véspera — sono
 * que passa da meia-noite — e os longos ou ainda abertos).
 */
export function registrosPorDia(registros: Registro[]): (dia: string) => Registro[] {
  const porDia = new Map<string, Registro[]>();
  const longos: Registro[] = [];
  for (const r of registros) {
    const k = chaveDia(r.inicio);
    const lista = porDia.get(k);
    if (lista) lista.push(r);
    else porDia.set(k, [r]);
    if (!r.fim || chaveDia(r.fim) > somarDiasLocal(k, 1)) longos.push(r);
  }
  return (dia) => {
    const vespera = somarDiasLocal(dia, -1);
    const base = [...(porDia.get(vespera) ?? []), ...(porDia.get(dia) ?? [])];
    return [...base, ...longos.filter((r) => chaveDia(r.inicio) < vespera)];
  };
}

/** Junta intervalos que se sobrepõem (ex.: os dois celulares marcaram o mesmo sono) */
export function juntarIntervalos(lista: [number, number][]): [number, number][] {
  const ord = lista.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: [number, number][] = [];
  for (const [a, b] of ord) {
    const ult = out[out.length - 1];
    if (ult && a <= ult[1]) ult[1] = Math.max(ult[1], b);
    else out.push([a, b]);
  }
  return out;
}

/** Registros agrupados por dia (mais recente primeiro) */
export function agruparPorDia(registros: Registro[]): { dia: string; itens: Registro[] }[] {
  const grupos = new Map<string, Registro[]>();
  for (const r of ordenarRecentes(registros)) {
    const dia = chaveDia(r.inicio);
    grupos.set(dia, [...(grupos.get(dia) ?? []), r]);
  }
  return [...grupos.entries()].map(([dia, itens]) => ({ dia, itens }));
}

// ---------- Texto ----------

export function textoFralda(d: { xixi: boolean; coco: boolean }): string {
  if (d.xixi && d.coco) return 'xixi e cocô';
  if (d.coco) return 'cocô';
  if (d.xixi) return 'xixi';
  return 'seca';
}

/** Hora; com o dia junto quando não é hoje (ex.: cronômetro esquecido aberto) */
const quando = (iso: string, agora: Date) => (chaveDia(iso) === chaveDia(agora) ? horaCurta(iso) : `${chaveDia(iso).slice(8, 10)}/${chaveDia(iso).slice(5, 7)} ${horaCurta(iso)}`);

export function descrever(r: Registro, agora: Date): { titulo: string; detalhe: string } {
  if (r.tipo === 'mamada') {
    const d = duracaoPorLado(r, agora);
    // Menos de 1 minuto aparece em segundos (e não "0 min")
    const lados = (['E', 'D'] as Lado[]).filter((l) => d[l] > 0).map((l) => `${l} ${textoDuracao(d[l], true)}`);
    const ativo = ladoAtivo(r);
    return {
      titulo: `Mamada · ${textoDuracao(d.total, true)}`,
      detalhe: r.fim
        ? `${horaCurta(r.inicio)} · ${lados.join(' · ') || 'peito'}`
        : `${quando(r.inicio, agora)} · em andamento${ativo ? ` (peito ${ativo})` : ' (pausada)'}`,
    };
  }
  if (r.tipo === 'mamadeira') {
    return {
      titulo: `Mamadeira · ${r.dados.ml} ml`,
      detalhe: `${horaCurta(r.inicio)} · ${r.dados.conteudo === 'formula' ? 'fórmula' : 'leite materno'}`,
    };
  }
  if (r.tipo === 'fralda') {
    const cor = corFezes(r.dados.cor);
    return {
      titulo: `Fralda · ${textoFralda(r.dados)}`,
      detalhe: `${horaCurta(r.inicio)}${r.dados.coco && cor ? ` · ${cor.rotulo.toLowerCase()}` : ''}`,
    };
  }
  if (r.tipo === 'remedio') {
    return { titulo: `Remédio · ${r.dados.nome}`, detalhe: `${horaCurta(r.inicio)}${r.dados.dose ? ` · ${r.dados.dose}` : ''}` };
  }
  if (r.tipo === 'temperatura') {
    return { titulo: `Temperatura · ${r.dados.graus.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`, detalhe: horaCurta(r.inicio) };
  }
  if (r.tipo === 'extracao') {
    const total = (r.dados.ml_e || 0) + (r.dados.ml_d || 0);
    const lados = [r.dados.ml_e ? `E ${r.dados.ml_e} ml` : '', r.dados.ml_d ? `D ${r.dados.ml_d} ml` : ''].filter(Boolean).join(' · ');
    return { titulo: `Extração · ${total} ml`, detalhe: `${horaCurta(r.inicio)}${lados ? ` · ${lados}` : ''}` };
  }
  if (r.tipo === 'refeicao') {
    const aceitou = { bem: 'aceitou bem', pouco: 'comeu pouco', recusou: 'recusou' }[r.dados.aceitacao];
    return { titulo: `Refeição · ${r.dados.alimentos.join(', ') || 'sem alimentos'}`, detalhe: `${horaCurta(r.inicio)} · ${aceitou}${r.dados.reacao ? ' · teve reação' : ''}` };
  }
  const dur = (r.fim ? ms(r.fim) : agora.getTime()) - ms(r.inicio);
  return {
    titulo: `Sono · ${textoDuracao(dur)}`,
    detalhe: r.fim ? `${horaCurta(r.inicio)} – ${horaCurta(r.fim)}` : `${quando(r.inicio, agora)} · dormindo`,
  };
}

/** Problemas que impedem salvar (mensagem curta) ou null */
export function validarRegistro(r: Registro, agora: Date): string | null {
  if (Number.isNaN(ms(r.inicio))) return 'Informe a hora.';
  if (ms(r.inicio) > agora.getTime() + 5 * 60_000) return 'A hora está no futuro.';
  if (r.fim && ms(r.fim) < ms(r.inicio)) return 'O fim está antes do início.';
  if (r.fim && ms(r.fim) > agora.getTime() + 5 * 60_000) return 'O fim está no futuro.';
  if ((r.tipo === 'mamada' || r.tipo === 'sono') && r.fim && ms(r.fim) - ms(r.inicio) > 24 * 3_600_000) return 'Duração acima de 24 h: confira as horas.';
  if (r.tipo === 'sono' && r.fim && ms(r.fim) - ms(r.inicio) < 60_000) return 'O sono precisa ter pelo menos 1 minuto.';
  if (r.tipo === 'mamadeira' && !(r.dados.ml > 0 && r.dados.ml <= 500)) return 'Informe a quantidade (até 500 ml).';
  if (r.tipo === 'mamada' && r.fim && duracaoPorLado(r, agora).total <= 0) return 'Informe os minutos em pelo menos um peito.';
  if (r.tipo === 'fralda' && !r.dados.xixi && !r.dados.coco) return 'Marque xixi, cocô ou os dois.';
  if (r.tipo === 'remedio' && !r.dados.nome.trim()) return 'Informe o remédio.';
  if (r.tipo === 'temperatura' && !(r.dados.graus >= 30 && r.dados.graus <= 44)) return 'Temperatura entre 30 e 44 °C (ex.: 36,8).';
  if (r.tipo === 'extracao' && !((r.dados.ml_e || 0) + (r.dados.ml_d || 0) > 0)) return 'Informe os ml de pelo menos um peito.';
  if (r.tipo === 'extracao' && ((r.dados.ml_e || 0) > 500 || (r.dados.ml_d || 0) > 500)) return 'Até 500 ml por peito.';
  if (r.tipo === 'refeicao' && !r.dados.alimentos.length) return 'Informe pelo menos um alimento.';
  return null;
}
