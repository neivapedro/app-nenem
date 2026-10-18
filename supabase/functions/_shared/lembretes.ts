// Decide quais avisos mandar agora. Sem dependências externas: testado pelo
// app (vitest) e usado pela função nenem-lembretes (Deno), que roda a cada 5 min.

import { EMOJI_TIPO, HORA_AVISO_DIA_INTEIRO, type CompromissoIcs } from './ics.ts';
import { dataNoFuso, diferencaDias, horaNoFuso, localParaUtc } from './tempo.ts';

export interface MembroAviso {
  user_id: string;
  fuso_horario: string;
  lembrete_mamada: boolean;
  lembrete_mamada_min: number;
  lembrete_agenda: boolean;
}

export interface Alimentacao {
  id: string;
  tipo: 'mamada' | 'mamadeira';
  inicio: string;
  fim: string | null;
  dados: Record<string, unknown> | null;
}

export interface Aviso {
  chave: string;
  titulo: string;
  corpo: string;
  tag: string;
  url: string;
}

/** Depois do intervalo, o aviso da mamada ainda vale por esta janela (não avisa horas depois). */
export const JANELA_MAMADA_MIN = 180;
/** O aviso da agenda ainda sai até esta janela depois do horário (servidor parado, atraso do agendador). */
export const JANELA_AGENDA_MIN = 360;

function textoDuracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m} min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

function detalheAlimentacao(a: Alimentacao): string {
  if (a.tipo === 'mamadeira') {
    const ml = Number(a.dados?.ml);
    return ml > 0 ? `mamadeira · ${ml} ml` : 'mamadeira';
  }
  const segs = Array.isArray(a.dados?.segmentos) ? (a.dados!.segmentos as { lado?: string }[]) : [];
  const lados = [...new Set(segs.map((s) => s.lado).filter((l) => l === 'E' || l === 'D'))];
  if (!lados.length) return 'peito';
  return lados.length === 2 ? 'peito E e D' : `peito ${lados[0]}`;
}

/**
 * "Já faz 3h desde a última mamada": a partir do início da última mamada ou
 * mamadeira. Não avisa com mamada em andamento nem depois da janela.
 */
export function avisoMamada(m: MembroAviso, ultima: Alimentacao | null, emAndamento: boolean, agora: Date, site: string): Aviso | null {
  if (!m.lembrete_mamada || !ultima || emAndamento) return null;
  const decorrido = (agora.getTime() - new Date(ultima.inicio).getTime()) / 60_000;
  if (decorrido < m.lembrete_mamada_min || decorrido > m.lembrete_mamada_min + JANELA_MAMADA_MIN) return null;
  const hora = horaNoFuso(new Date(ultima.inicio), m.fuso_horario);
  return {
    chave: `mamada:${ultima.id}:${m.user_id}`,
    titulo: `🍼 Já faz ${textoDuracao(decorrido)} desde a última mamada`,
    corpo: `Última: ${hora} (${detalheAlimentacao(ultima)}).`,
    tag: 'mamada',
    url: site,
  };
}

function quando(c: CompromissoIcs, fuso: string, agora: Date): string {
  const hoje = dataNoFuso(agora, fuso);
  const dias = diferencaDias(hoje, c.data);
  const [, mes, dia] = c.data.split('-');
  const dataTxt = dias === 0 ? 'Hoje' : dias === 1 ? 'Amanhã' : `Dia ${dia}/${mes}`;
  return c.hora ? `${dataTxt} às ${c.hora.slice(0, 5)}` : `${dataTxt} (dia inteiro)`;
}

/** Instante do aviso de um compromisso (dia inteiro: contado a partir das 8h do dia). */
export function instanteAviso(c: CompromissoIcs, fuso: string): Date | null {
  if (c.avisar_min === null || c.avisar_min === undefined) return null;
  const base = localParaUtc(c.data, c.hora ? c.hora.slice(0, 5) : HORA_AVISO_DIA_INTEIRO, fuso);
  return new Date(base.getTime() - c.avisar_min * 60_000);
}

/** Avisos de compromissos da agenda que já chegaram na hora. */
export function avisosAgenda(m: MembroAviso, compromissos: CompromissoIcs[], agora: Date, site: string): Aviso[] {
  if (!m.lembrete_agenda) return [];
  const fuso = m.fuso_horario;
  const avisos: Aviso[] = [];
  for (const c of compromissos) {
    const inst = instanteAviso(c, fuso);
    if (!inst) continue;
    const atraso = (agora.getTime() - inst.getTime()) / 60_000;
    if (atraso < 0 || atraso > JANELA_AGENDA_MIN) continue;
    // Compromisso com hora que já começou: não avisa mais
    if (c.hora && agora.getTime() >= localParaUtc(c.data, c.hora.slice(0, 5), fuso).getTime()) continue;
    const local = c.local?.trim() ? ` · ${c.local.trim()}` : '';
    avisos.push({
      chave: `agenda:${c.id}:${c.data}T${c.hora ?? 'dia'}:${c.avisar_min}:${m.user_id}`,
      titulo: `${EMOJI_TIPO[c.tipo] ?? EMOJI_TIPO.outro} ${c.titulo}`,
      corpo: `${quando(c, fuso, agora)}${local}`,
      tag: `agenda-${c.id}`,
      url: `${site}agenda`,
    });
  }
  return avisos;
}
