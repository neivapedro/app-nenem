// Histórico em linha do tempo: uma semana por vez, itens de cada dia (com o
// sono que veio da noite anterior) e a mini-fita das 24 h. Sem React: testado no vitest.
import { chaveDia, diasEntre, horaCurta, inicioDoDia, somarDiasLocal } from './datas';
import { linhaDoTempo, type LinhaDoTempo } from './painel';
import type { Registro, TipoRegistro } from './tipos';

/** Dias carregados por vez */
export const DIAS_SEMANA = 7;

export interface Janela {
  /** Primeiro dia mostrado (o mais antigo) */
  de: string;
  /** Último dia mostrado (o mais recente) */
  ate: string;
}

/** Os 7 dias mais recentes */
export const janelaInicial = (hoje: string): Janela => ({ de: somarDiasLocal(hoje, -(DIAS_SEMANA - 1)), ate: hoje });

/** Mais 7 dias para trás (sem passar do começo, quando se sabe qual é) */
export function semanaAnterior(j: Janela, inicio?: string | null): Janela {
  const de = somarDiasLocal(j.de, -DIAS_SEMANA);
  return { ...j, de: inicio && de < inicio ? (inicio < j.de ? inicio : j.de) : de };
}

/**
 * A semana em volta de um dia escolhido: o dia fica no meio (3 dias depois e
 * 3 antes), sem passar de hoje nem do começo do histórico.
 */
export function janelaDaData(dia: string, hoje: string, inicio?: string | null): Janela {
  let alvo = dia > hoje ? hoje : dia;
  if (inicio && alvo < inicio) alvo = inicio;
  let ate = somarDiasLocal(alvo, 3);
  if (ate > hoje) ate = hoje;
  let de = somarDiasLocal(ate, -(DIAS_SEMANA - 1));
  if (inicio && de < inicio) {
    de = inicio;
    const fim = somarDiasLocal(inicio, DIAS_SEMANA - 1);
    ate = fim > hoje ? hoje : fim;
  }
  return { de, ate };
}

/** Os dias da janela, do mais recente para o mais antigo */
export function diasDaJanela(j: Janela): string[] {
  const n = Math.max(0, Math.min(4000, diasEntre(j.de, j.ate) + 1));
  return Array.from({ length: n }, (_, i) => somarDiasLocal(j.ate, -i));
}

/** Um ponto da linha do tempo do dia */
export interface ItemDia {
  r: Registro;
  /** Sono que começou num dia anterior e entrou neste (aparece no fim do dia) */
  continuacao: boolean;
  /** Quanto do sono cai neste dia (para o tamanho da barra); 0 nos outros tipos */
  sonoMs: number;
  /** Sono que termina depois deste dia */
  passaDoDia: boolean;
  /** Sono ainda em andamento */
  emAndamento: boolean;
}

const ms = (iso: string) => new Date(iso).getTime();

/**
 * O que aparece na linha do tempo de um dia (mais recente primeiro): os registros
 * que começaram nele e, no fim, o sono que veio da noite anterior.
 */
export function itensDoDia(registros: Registro[], dia: string, tipos: readonly TipoRegistro[], agora: Date): ItemDia[] {
  const z = inicioDoDia(dia).getTime();
  const z1 = inicioDoDia(somarDiasLocal(dia, 1)).getTime();
  const doDia: ItemDia[] = [];
  const continuacoes: ItemDia[] = [];
  for (const r of registros) {
    if (!tipos.includes(r.tipo)) continue;
    const ini = ms(r.inicio);
    if (r.tipo === 'sono') {
      const fim = r.fim ? ms(r.fim) : agora.getTime();
      const parte = Math.max(0, Math.min(fim, z1) - Math.max(ini, z));
      const base = { r, sonoMs: parte, passaDoDia: fim > z1, emAndamento: !r.fim };
      if (ini >= z && ini < z1) doDia.push({ ...base, continuacao: false });
      else if (ini < z && fim > z) continuacoes.push({ ...base, continuacao: true });
      continue;
    }
    if (ini >= z && ini < z1) doDia.push({ r, continuacao: false, sonoMs: 0, passaDoDia: false, emAndamento: !r.fim });
  }
  const recentes = (a: ItemDia, b: ItemDia) => ms(b.r.inicio) - ms(a.r.inicio) || (a.r.id < b.r.id ? -1 : 1);
  return [...doDia.sort(recentes), ...continuacoes.sort(recentes)];
}

/** Altura (px) do trecho de sono na linha do tempo: proporcional à duração, com limites */
export function alturaSono(duracaoMs: number): number {
  const PX_POR_HORA = 44;
  return Math.round(Math.min(250, Math.max(76, (duracaoMs / 3_600_000) * PX_POR_HORA + 40)));
}

/** Tira a hora do começo do detalhe (a hora já aparece em destaque ao lado) */
export function detalheSemHora(detalhe: string): string {
  return detalhe.replace(/^(\d\d\/\d\d )?\d\d:\d\d(\s·\s|$)/, '');
}

/** Texto do fim de um sono na linha do tempo do dia */
export function textoFimSono(item: ItemDia, dia: string): string {
  const { r } = item;
  if (item.continuacao) {
    const desde = diasEntre(chaveDia(r.inicio), dia) === 1 ? 'ontem' : `${chaveDia(r.inicio).slice(8, 10)}/${chaveDia(r.inicio).slice(5, 7)}`;
    return `${item.emAndamento ? 'dormindo' : `acordou às ${horaCurta(r.fim!)}`} · começou ${desde} às ${horaCurta(r.inicio)}`;
  }
  if (item.emAndamento) return 'dormindo agora';
  return item.passaDoDia ? `até ${horaCurta(r.fim!)} do dia seguinte` : `até ${horaCurta(r.fim!)}`;
}

export interface FitaDia extends LinhaDoTempo {
  marcas: { em: number; texto: string }[];
  agoraFracao?: number;
}

/** A mini-fita das 24 h do dia (frações de 0 a 1), com o "agora" quando é hoje */
export function fitaDoDia(registros: Registro[], dia: string, agora: Date): FitaDia {
  const de = inicioDoDia(dia);
  const ate = inicioDoDia(somarDiasLocal(dia, 1));
  const total = ate.getTime() - de.getTime();
  const marcas = [6, 12, 18].map((h) => {
    const t = new Date(de);
    t.setHours(h, 0, 0, 0);
    return { em: (t.getTime() - de.getTime()) / total, texto: `${h}h` };
  });
  const hoje = agora.getTime() >= de.getTime() && agora.getTime() < ate.getTime();
  // Um sono em andamento vai até agora; o que veio da noite anterior começa na meia-noite
  const lt = linhaDoTempo(registros, de, ate, agora);
  return { ...lt, marcas, agoraFracao: hoje ? (agora.getTime() - de.getTime()) / total : undefined };
}

/** "13 a 19 out" (ou "28 set a 4 out") */
export function textoSemana(de: string, ate: string): string {
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const a = inicioDoDia(de);
  const b = inicioDoDia(ate);
  if (de === ate) return `${b.getDate()} ${MESES[b.getMonth()]}`;
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    ? `${a.getDate()} a ${b.getDate()} ${MESES[b.getMonth()]}`
    : `${a.getDate()} ${MESES[a.getMonth()]} a ${b.getDate()} ${MESES[b.getMonth()]}`;
}
