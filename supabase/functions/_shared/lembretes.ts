// Decide quais avisos mandar agora. Sem dependências externas: testado pelo
// app (vitest) e usado pela função nenem-lembretes (Deno), que roda a cada 5 min.

import { EMOJI_TIPO, HORA_AVISO_DIA_INTEIRO, type CompromissoIcs } from './ics.ts';
import { inicioTarefa, TAREFAS_PADRAO } from './primeiros-dias.ts';
import { dataNoFuso, diferencaDias, horaNoFuso, localParaUtc, somarDias } from './tempo.ts';
import { calendarioDoBebe, type AplicacaoVacina, type Calendario } from './vacinas.ts';

export interface MembroAviso {
  user_id: string;
  fuso_horario: string;
  lembrete_mamada: boolean;
  lembrete_mamada_min: number;
  lembrete_agenda: boolean;
  lembrete_remedio?: boolean;
  lembrete_vacina?: boolean;
  lembrete_documento?: boolean;
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

/** Janela do aviso de remédio depois da hora da dose */
export const JANELA_REMEDIO_MIN = 120;

/** Minutos desde a hora local `hhmm` de hoje (negativo = ainda não chegou) */
function minutosDesde(agora: Date, fuso: string, hhmm: string): number {
  return (agora.getTime() - localParaUtc(dataNoFuso(agora, fuso), hhmm, fuso).getTime()) / 60_000;
}

/**
 * Vacinas: na véspera às 8h (doses do dia seguinte, num aviso só) e uma vez
 * quando uma dose fica atrasada (até 30 dias depois).
 */
export function avisosVacina(
  m: MembroAviso,
  bebe: { id: string; nome: string; nascimento: string; calendario: Calendario },
  aplicacoes: AplicacaoVacina[],
  agora: Date,
  site: string,
): Aviso[] {
  if (m.lembrete_vacina === false) return [];
  const fuso = m.fuso_horario;
  const hoje = dataNoFuso(agora, fuso);
  const desde8 = minutosDesde(agora, fuso, '08:00');
  if (desde8 < 0 || desde8 > 12 * 60) return [];
  const lista = calendarioDoBebe(bebe.nascimento, bebe.calendario, aplicacoes, hoje);
  const avisos: Aviso[] = [];
  const amanha = somarDias(hoje, 1);
  const deAmanha = lista.filter((d) => d.prevista === amanha && (d.situacao === 'proxima' || d.situacao === 'futura'));
  if (deAmanha.length) {
    const nomes = [...new Set(deAmanha.map((d) => d.dose.vacina.split(' (')[0].split(' /')[0]))];
    avisos.push({
      chave: `vacina-vespera:${bebe.id}:${amanha}:${m.user_id}`,
      titulo: `💉 Amanhã: ${nomes.length === 1 ? 'vacina' : `${nomes.length} vacinas`}`,
      corpo: nomes.join(', '),
      tag: `vacina-${amanha}`,
      url: `${site}saude?aba=vacinas`,
    });
  }
  for (const d of lista) {
    if (d.situacao !== 'atrasada') continue;
    if (diferencaDias(d.prevista, hoje) > 45) continue;
    avisos.push({
      chave: `vacina-atrasada:${bebe.id}:${d.dose.id}:${m.user_id}`,
      titulo: `💉 Vacina atrasada: ${d.dose.vacina.split(' (')[0]}`,
      corpo: `${d.dose.dose}, indicada desde ${d.prevista.split('-').reverse().slice(0, 2).join('/')}. Se já tomou, marque no app.`,
      tag: `vacina-${d.dose.id}`,
      url: `${site}saude?aba=vacinas`,
    });
  }
  return avisos;
}

export interface RemedioAviso {
  id: string;
  nome: string;
  dose: string | null;
  intervalo_h: number | null;
  /** Última dose dada (id e início) */
  ultima: { id: string; inicio: string } | null;
}

/** Remédio com intervalo: avisa quando chega a hora da próxima dose. */
export function avisosRemedio(m: MembroAviso, remedios: RemedioAviso[], agora: Date, site: string): Aviso[] {
  if (m.lembrete_remedio === false) return [];
  const avisos: Aviso[] = [];
  for (const r of remedios) {
    if (!r.intervalo_h || !r.ultima) continue;
    const proxima = new Date(r.ultima.inicio).getTime() + r.intervalo_h * 3_600_000;
    const atraso = (agora.getTime() - proxima) / 60_000;
    if (atraso < 0 || atraso > JANELA_REMEDIO_MIN) continue;
    avisos.push({
      chave: `remedio:${r.ultima.id}:${m.user_id}`,
      titulo: `💊 Hora do remédio: ${r.nome}`,
      corpo: `${r.dose ? `${r.dose} · ` : ''}última dose às ${horaNoFuso(new Date(r.ultima.inicio), m.fuso_horario)}. Toque em "Dei agora" no app.`,
      tag: `remedio-${r.id}`,
      url: `${site}saude?aba=remedios`,
    });
  }
  return avisos;
}

/** Primeiros dias: às 8h do dia em que a janela abre (ou do prazo), se ainda não foi feito. */
export function avisosTarefas(
  m: MembroAviso,
  familiaId: string,
  nascimento: string | null,
  tarefas: { item_id: string | null; id: string; titulo: string | null; data: string | null; feito_em: string | null }[],
  agora: Date,
  site: string,
): Aviso[] {
  if (!m.lembrete_agenda) return [];
  const fuso = m.fuso_horario;
  const hoje = dataNoFuso(agora, fuso);
  const desde8 = minutosDesde(agora, fuso, '08:00');
  if (desde8 < 0 || desde8 > 12 * 60) return [];
  const feitas = new Set(tarefas.filter((t) => t.item_id && t.feito_em).map((t) => t.item_id));
  const avisos: Aviso[] = [];
  if (nascimento) {
    for (const t of TAREFAS_PADRAO) {
      if (t.prazo_dias === undefined || feitas.has(t.id)) continue;
      const prazo = somarDias(nascimento, t.prazo_dias);
      const dia = inicioTarefa(t, nascimento) ?? prazo;
      if (dia !== hoje) continue;
      avisos.push({
        chave: `tarefa:${familiaId}:${t.id}:${dia}:${m.user_id}`,
        titulo: `📋 ${t.titulo}`,
        corpo: dia === prazo ? 'Prazo: hoje.' : `Até ${prazo.split('-').reverse().slice(0, 2).join('/')}.`,
        tag: `tarefa-${t.id}`,
        url: `${site}mais/primeiros-dias`,
      });
    }
  }
  for (const t of tarefas) {
    if (t.item_id || t.feito_em || t.data !== hoje || !t.titulo) continue;
    avisos.push({ chave: `tarefa:${t.id}:${hoje}:${m.user_id}`, titulo: `📋 ${t.titulo}`, corpo: 'Prazo: hoje.', tag: `tarefa-${t.id}`, url: `${site}mais/primeiros-dias` });
  }
  return avisos;
}

export interface DocumentoAviso {
  id: string;
  titulo: string;
  validade: string | null;
}

/** Dias antes do vencimento em que o aviso sai (às 8h) */
export const AVISO_DOCUMENTO_DIAS = [30, 7, 0];

/** Documento vencendo: 30 dias antes, 7 dias antes e no dia, às 8h. */
export function avisosDocumentos(m: MembroAviso, documentos: DocumentoAviso[], agora: Date, site: string): Aviso[] {
  if (m.lembrete_documento === false) return [];
  const fuso = m.fuso_horario;
  const desde8 = minutosDesde(agora, fuso, '08:00');
  if (desde8 < 0 || desde8 > 12 * 60) return [];
  const hoje = dataNoFuso(agora, fuso);
  const avisos: Aviso[] = [];
  for (const d of documentos) {
    if (!d.validade) continue;
    const faltam = diferencaDias(hoje, d.validade);
    if (!AVISO_DOCUMENTO_DIAS.includes(faltam)) continue;
    const data = d.validade.split('-').reverse().join('/');
    avisos.push({
      chave: `documento:${d.id}:${d.validade}:${faltam}:${m.user_id}`,
      titulo: faltam === 0 ? `📄 ${d.titulo} vence hoje` : `📄 ${d.titulo} vence em ${faltam} dias`,
      corpo: faltam === 0 ? `Validade: ${data}. Depois de renovar, troque a foto na aba Documentos.` : `Validade: ${data}. Dá tempo de renovar com calma.`,
      tag: `documento-${d.id}`,
      url: `${site}documentos`,
    });
  }
  return avisos;
}
