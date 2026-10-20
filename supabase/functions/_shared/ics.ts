// Monta o calendário assinado (iCalendar, RFC 5545) com a agenda da família.
// Sem dependências externas: testado pelo app (vitest) e usado pela função
// nenem-calendario (Deno).

import { inicioTarefa, prazoTarefa, TAREFAS_PADRAO } from './primeiros-dias.ts';
import { dataNoFuso, localParaUtc, somarDias, somarMeses } from './tempo.ts';
import { calendarioDoBebe, type AplicacaoVacina, type Calendario } from './vacinas.ts';

export type TipoCompromisso = 'consulta' | 'exame' | 'vacina' | 'outro';

export interface CompromissoIcs {
  id: string;
  tipo: TipoCompromisso;
  titulo: string;
  data: string;
  /** HH:MM; vazio = dia inteiro */
  hora: string | null;
  duracao_min: number;
  local: string | null;
  observacao: string | null;
  /** Antecedência do aviso em minutos; vazio = sem aviso */
  avisar_min: number | null;
}

export interface BebeIcs {
  id: string;
  nome: string;
  nascimento: string | null;
}

export const EMOJI_TIPO: Record<TipoCompromisso, string> = {
  consulta: '🩺',
  exame: '🧪',
  vacina: '💉',
  outro: '📌',
};

/** Hora padrão do aviso de compromissos de dia inteiro */
export const HORA_AVISO_DIA_INTEIRO = '08:00';
/** Mesversários até esta idade (em meses) */
export const MESES_MESVERSARIO = 24;

export function escaparIcs(t: string): string {
  // CR sozinho também é quebra de linha; outros caracteres de controle saem (não podem injetar propriedades)
  return t
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
}

/** Dobra linhas em 75 octetos (RFC 5545), sem quebrar caracteres UTF-8. */
export function dobrarIcs(linha: string): string {
  const enc = new TextEncoder();
  const partes: string[] = [];
  let atual = '';
  for (const ch of linha) {
    const limite = partes.length === 0 ? 75 : 74;
    if (enc.encode(atual + ch).length > limite) {
      partes.push(atual);
      atual = ch;
    } else atual += ch;
  }
  partes.push(atual);
  return partes.join('\r\n ');
}

const carimbo = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const soData = (s: string) => s.replace(/-/g, '');

/** Duração no formato do iCalendar, com sinal: -PT90M, PT8H */
function duracaoIcs(minutos: number): string {
  const sinal = minutos < 0 ? '-' : '';
  const m = Math.abs(Math.round(minutos));
  if (m === 0) return 'PT0M';
  if (m % 1440 === 0) return `${sinal}P${m / 1440}D`;
  if (m % 60 === 0) return `${sinal}PT${m / 60}H`;
  return `${sinal}PT${m}M`;
}

/** Texto da idade no mesversário: "1 mês", "5 meses", "1 ano", "1 ano e 3 meses" */
export function textoMeses(n: number): string {
  const anos = Math.floor(n / 12);
  const meses = n % 12;
  const txtAnos = anos === 1 ? '1 ano' : `${anos} anos`;
  const txtMeses = meses === 1 ? '1 mês' : `${meses} meses`;
  if (!anos) return txtMeses;
  return meses ? `${txtAnos} e ${txtMeses}` : txtAnos;
}

function eventoCompromisso(c: CompromissoIcs, fuso: string, agora: Date, site: string): string[] {
  const emoji = EMOJI_TIPO[c.tipo] ?? EMOJI_TIPO.outro;
  const descricao = [c.observacao?.trim(), `Agenda do app Heitor: ${site}`].filter(Boolean).join('\n\n');
  const linhas = ['BEGIN:VEVENT', `UID:compromisso-${c.id}@app-nenem`, `DTSTAMP:${carimbo(agora)}`];
  if (c.hora) {
    const inicio = localParaUtc(c.data, c.hora, fuso);
    const fim = new Date(inicio.getTime() + c.duracao_min * 60_000);
    linhas.push(`DTSTART:${carimbo(inicio)}`, `DTEND:${carimbo(fim)}`);
  } else {
    linhas.push(`DTSTART;VALUE=DATE:${soData(c.data)}`, `DTEND;VALUE=DATE:${soData(somarDias(c.data, 1))}`, 'TRANSP:TRANSPARENT');
  }
  linhas.push(`SUMMARY:${escaparIcs(`${emoji} ${c.titulo}`)}`);
  if (c.local?.trim()) linhas.push(`LOCATION:${escaparIcs(c.local.trim())}`);
  linhas.push(`DESCRIPTION:${escaparIcs(descricao)}`, `URL:${site}`);
  if (c.avisar_min !== null && c.avisar_min !== undefined) {
    // Dia inteiro: o aviso é contado a partir das 8h do dia (começo do evento = meia-noite)
    const [h, m] = HORA_AVISO_DIA_INTEIRO.split(':').map(Number);
    const gatilho = c.hora ? -c.avisar_min : h * 60 + m - c.avisar_min;
    linhas.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escaparIcs(`${emoji} ${c.titulo}`)}`, `TRIGGER:${duracaoIcs(gatilho)}`, 'END:VALARM');
  }
  linhas.push('END:VEVENT');
  return linhas;
}

function eventosMesversario(b: BebeIcs, fuso: string, agora: Date): string[] {
  if (!b.nascimento) return [];
  const nasceu = dataNoFuso(new Date(b.nascimento), fuso);
  const nome = b.nome.trim() || 'O bebê';
  const linhas: string[] = [];
  for (let n = 1; n <= MESES_MESVERSARIO; n++) {
    const dia = somarMeses(nasceu, n);
    linhas.push(
      'BEGIN:VEVENT',
      `UID:mesversario-${b.id}-${n}@app-nenem`,
      `DTSTAMP:${carimbo(agora)}`,
      `DTSTART;VALUE=DATE:${soData(dia)}`,
      `DTEND;VALUE=DATE:${soData(somarDias(dia, 1))}`,
      `SUMMARY:${escaparIcs(`🎂 ${nome} faz ${textoMeses(n)}`)}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  return linhas;
}

/** Evento de dia inteiro (vacinas e prazos dos primeiros dias) */
export interface EventoDia {
  uid: string;
  inicio: string;
  /** Último dia (inclusive); vazio = só o dia do início */
  fim?: string;
  titulo: string;
  descricao: string;
  /** Aviso em minutos contados a partir das 8h do 1º dia (negativo = antes); vazio = sem aviso */
  aviso?: number;
}

function eventoDia(e: EventoDia, agora: Date, site: string): string[] {
  const linhas = [
    'BEGIN:VEVENT',
    `UID:${e.uid}@app-nenem`,
    `DTSTAMP:${carimbo(agora)}`,
    `DTSTART;VALUE=DATE:${soData(e.inicio)}`,
    `DTEND;VALUE=DATE:${soData(somarDias(e.fim ?? e.inicio, 1))}`,
    `SUMMARY:${escaparIcs(e.titulo)}`,
    `DESCRIPTION:${escaparIcs([e.descricao, `App Heitor: ${site}`].filter(Boolean).join('\n\n'))}`,
    `URL:${site}`,
    'TRANSP:TRANSPARENT',
  ];
  if (e.aviso !== undefined) {
    const [h, m] = HORA_AVISO_DIA_INTEIRO.split(':').map(Number);
    linhas.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escaparIcs(e.titulo)}`, `TRIGGER:${duracaoIcs(h * 60 + m + e.aviso)}`, 'END:VALARM');
  }
  linhas.push('END:VEVENT');
  return linhas;
}

const primeiroNome = (v: string) => v.split(' (')[0].split(' /')[0];

/**
 * Vacinas no calendário: as aplicadas (✓, sem aviso) e as pendentes agrupadas por
 * dia, com aviso na véspera às 8h. Dose atrasada aparece hoje, marcada "atrasada".
 * Dose que passou da idade máxima fica fora (sem alarme diário): só no app, para falar com o pediatra.
 */
export function eventosVacinas(bebeId: string, nascimento: string, cal: Calendario, aplicacoes: AplicacaoVacina[], hoje: string): EventoDia[] {
  const lista = calendarioDoBebe(nascimento, cal, aplicacoes, hoje);
  const eventos: EventoDia[] = [];
  const pendentes = new Map<string, { nomes: string[]; atrasada: boolean }>();
  for (const d of lista) {
    if (d.situacao === 'pulada' || d.situacao === 'passou') continue;
    if (d.situacao === 'aplicada') {
      if (d.aplicacao?.data) {
        eventos.push({ uid: `vacina-${bebeId}-${d.dose.id}`, inicio: d.aplicacao.data, titulo: `✓ 💉 ${primeiroNome(d.dose.vacina)} (${d.dose.dose})`, descricao: 'Aplicada.' });
      }
      continue;
    }
    const atrasada = d.situacao === 'atrasada';
    const dia = atrasada || d.prevista < hoje ? hoje : d.prevista;
    const g = pendentes.get(dia) ?? { nomes: [], atrasada: false };
    g.nomes.push(`${primeiroNome(d.dose.vacina)} (${d.dose.dose})`);
    g.atrasada ||= atrasada;
    pendentes.set(dia, g);
  }
  for (const [dia, g] of pendentes) {
    eventos.push({
      uid: `vacinas-${bebeId}-${dia}`,
      inicio: dia,
      titulo: `💉 ${g.nomes.length === 1 ? 'Vacina' : 'Vacinas'}${g.atrasada ? ' (atrasada)' : ''}: ${g.nomes.map((n) => n.split(' (')[0]).join(', ')}`,
      descricao: `${g.nomes.join('\n')}\n\nMarque no app (Saúde → Vacinas) depois de aplicar.`,
      aviso: dia === hoje ? 0 : -1440,
    });
  }
  return eventos;
}

export interface TarefaIcs {
  item_id: string | null;
  id: string;
  titulo: string | null;
  data: string | null;
  feito_em: string | null;
}

/** Prazos pendentes dos primeiros dias (lista padrão + itens criados por vocês) */
export function eventosTarefas(familiaId: string, nascimento: string | null, tarefas: TarefaIcs[]): EventoDia[] {
  const feitas = new Set(tarefas.filter((t) => t.item_id && t.feito_em).map((t) => t.item_id));
  const eventos: EventoDia[] = [];
  if (nascimento) {
    for (const t of TAREFAS_PADRAO) {
      const prazo = prazoTarefa(t, nascimento);
      if (!prazo || feitas.has(t.id)) continue;
      const inicio = inicioTarefa(t, nascimento) ?? prazo;
      eventos.push({ uid: `tarefa-${familiaId}-${t.id}`, inicio, fim: prazo, titulo: `📋 ${t.titulo}`, descricao: t.detalhe, aviso: 0 });
    }
  }
  for (const t of tarefas) {
    if (t.item_id || t.feito_em || !t.data || !t.titulo) continue;
    eventos.push({ uid: `tarefa-${t.id}`, inicio: t.data, titulo: `📋 ${t.titulo}`, descricao: '', aviso: 0 });
  }
  return eventos;
}

export interface DocumentoIcs {
  id: string;
  titulo: string;
  validade: string | null;
}

/** Validade dos documentos: aviso 30 dias antes ("renovar") e no dia do vencimento */
export function eventosDocumentos(documentos: DocumentoIcs[]): EventoDia[] {
  const eventos: EventoDia[] = [];
  for (const d of documentos) {
    if (!d.validade) continue;
    const data = d.validade.split('-').reverse().join('/');
    eventos.push({ uid: `documento-${d.id}-${d.validade}`, inicio: d.validade, titulo: `📄 Vence: ${d.titulo}`, descricao: `Validade: ${data}. Depois de renovar, troque a foto na aba Documentos do app.`, aviso: 0 });
    eventos.push({ uid: `documento-renovar-${d.id}-${d.validade}`, inicio: somarDias(d.validade, -30), titulo: `📄 Renovar: ${d.titulo}`, descricao: `Vence em 30 dias (${data}).`, aviso: 0 });
  }
  return eventos;
}

/** Dia do cofrinho nos próximos 12 meses (o mês atual só se ainda não depositaram e o dia não passou) */
export function eventosCofrinho(familiaId: string, nomeBebe: string, diaAporte: number | null, aporteCentavos: number, depositouNoMes: boolean, hoje: string): EventoDia[] {
  if (!diaAporte) return [];
  const eventos: EventoDia[] = [];
  const valor = aporteCentavos > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(aporteCentavos / 100).replace(/\u00a0/g, ' ') : null;
  for (let i = 0; i < 12; i++) {
    const dia = `${somarMeses(`${hoje.slice(0, 7)}-01`, i).slice(0, 7)}-${String(diaAporte).padStart(2, '0')}`;
    if (i === 0 && (depositouNoMes || dia < hoje)) continue;
    eventos.push({
      uid: `cofrinho-${familiaId}-${dia.slice(0, 7)}`,
      inicio: dia,
      titulo: `🐷 Dia do cofrinho${nomeBebe ? ` do ${nomeBebe}` : ''}`,
      descricao: valor ? `Depósito planejado: ${valor}. Depois de depositar, registre no app (aba Cofrinho).` : 'Depois de depositar, registre no app (aba Cofrinho).',
      aviso: 60,
    });
  }
  return eventos;
}

export interface EntradaIcs {
  compromissos: CompromissoIcs[];
  bebes: BebeIcs[];
  /** Vacinas e prazos (eventos de dia inteiro) */
  eventos?: EventoDia[];
  fuso: string;
  agora: Date;
  site: string;
  nomeCalendario?: string;
}

export function montarIcs({ compromissos, bebes, eventos: extras, fuso, agora, site, nomeCalendario }: EntradaIcs): string {
  const eventos = [
    ...compromissos.flatMap((c) => eventoCompromisso(c, fuso, agora, site)),
    ...bebes.flatMap((b) => eventosMesversario(b, fuso, agora)),
    ...(extras ?? []).flatMap((e) => eventoDia(e, agora, site)),
  ];
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//app-nenem//Nenê//PT-BR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escaparIcs(nomeCalendario ?? 'Heitor')}`,
      `X-WR-TIMEZONE:${fuso}`,
      // Cor sugerida ao assinar: rosa-claro
      'X-APPLE-CALENDAR-COLOR:#F28AB2',
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
      ...eventos,
      'END:VCALENDAR',
    ]
      .map(dobrarIcs)
      .join('\r\n') + '\r\n'
  );
}
