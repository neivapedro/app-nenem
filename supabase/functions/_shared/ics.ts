// Monta o calendário assinado (iCalendar, RFC 5545) com a agenda da família.
// Sem dependências externas: testado pelo app (vitest) e usado pela função
// nenem-calendario (Deno).

import { dataNoFuso, localParaUtc, somarDias, somarMeses } from './tempo.ts';

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
  return t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
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
  const descricao = [c.observacao?.trim(), `Agenda do app Nenê: ${site}`].filter(Boolean).join('\n\n');
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

export interface EntradaIcs {
  compromissos: CompromissoIcs[];
  bebes: BebeIcs[];
  fuso: string;
  agora: Date;
  site: string;
  nomeCalendario?: string;
}

export function montarIcs({ compromissos, bebes, fuso, agora, site, nomeCalendario }: EntradaIcs): string {
  const eventos = [
    ...compromissos.flatMap((c) => eventoCompromisso(c, fuso, agora, site)),
    ...bebes.flatMap((b) => eventosMesversario(b, fuso, agora)),
  ];
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//app-nenem//Nenê//PT-BR',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escaparIcs(nomeCalendario ?? 'Nenê')}`,
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
