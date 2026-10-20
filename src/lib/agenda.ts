import { EMOJI_TIPO } from '../../supabase/functions/_shared/ics.ts';
import { chaveDia, dataBr, diasEntre, nomeDia } from './datas';
import type { Compromisso, TipoCompromisso } from './tipos';

export { EMOJI_TIPO };

export const NOMES_COMPROMISSO: Record<TipoCompromisso, string> = {
  consulta: 'Consulta',
  exame: 'Exame',
  vacina: 'Vacina',
  outro: 'Outro',
};

/** Opções de aviso. Dia inteiro: contado a partir das 8h do dia. */
export const OPCOES_AVISO: { valor: number | null; rotulo: string; diaInteiro?: string }[] = [
  { valor: null, rotulo: 'Sem aviso' },
  { valor: 0, rotulo: 'Na hora', diaInteiro: 'No dia, às 8h' },
  { valor: 30, rotulo: '30 min antes', diaInteiro: 'No dia, às 7h30' },
  { valor: 60, rotulo: '1 hora antes', diaInteiro: 'No dia, às 7h' },
  { valor: 120, rotulo: '2 horas antes', diaInteiro: 'No dia, às 6h' },
  { valor: 1440, rotulo: '1 dia antes', diaInteiro: '1 dia antes, às 8h' },
  { valor: 2880, rotulo: '2 dias antes', diaInteiro: '2 dias antes, às 8h' },
  { valor: 10080, rotulo: '1 semana antes', diaInteiro: '1 semana antes, às 8h' },
];

export function textoAviso(c: Pick<Compromisso, 'avisar_min' | 'hora'>): string {
  const o = OPCOES_AVISO.find((x) => x.valor === c.avisar_min);
  if (!o) return c.avisar_min === null ? 'Sem aviso' : `${c.avisar_min} min antes`;
  return (!c.hora && o.diaInteiro) || o.rotulo;
}

/** Instante de término (para separar próximos de anteriores). Dia inteiro: fim do dia. */
export function fimCompromisso(c: Compromisso): number {
  const [a, m, d] = c.data.split('-').map(Number);
  if (!c.hora) return new Date(a, m - 1, d + 1).getTime();
  const [h, min] = c.hora.split(':').map(Number);
  return new Date(a, m - 1, d, h, min).getTime() + c.duracao_min * 60_000;
}

const ordem = (a: Compromisso, b: Compromisso) => `${a.data}${a.hora ?? '00:00'}`.localeCompare(`${b.data}${b.hora ?? '00:00'}`);

export function proximosCompromissos(lista: Compromisso[], agora: Date): Compromisso[] {
  return lista.filter((c) => fimCompromisso(c) > agora.getTime()).sort(ordem);
}

export function compromissosAnteriores(lista: Compromisso[], agora: Date): Compromisso[] {
  return lista.filter((c) => fimCompromisso(c) <= agora.getTime()).sort((a, b) => ordem(b, a));
}

/** "Hoje às 09:30", "Amanhã (dia inteiro)", "sexta, 13 nov às 14:00 · em 5 dias" */
export function textoQuando(c: Compromisso, hoje: string): string {
  const dia = nomeDia(c.data, hoje);
  const hora = c.hora ? ` às ${c.hora}` : ' (dia inteiro)';
  const dif = diasEntre(hoje, c.data);
  const extra = dif > 1 && dif <= 30 ? ` · em ${dif} dias` : '';
  return `${dia}${hora}${extra}`;
}

export function dataCurta(c: Compromisso): string {
  return dataBr(c.data);
}

/** Já começou (dia inteiro: o dia já passou) */
export function compromissoJaPassou(c: Pick<Compromisso, 'data' | 'hora'>, agora: Date): boolean {
  if (!c.hora) return c.data < chaveDia(agora);
  const [a, m, d] = c.data.split('-').map(Number);
  const [h, min] = c.hora.split(':').map(Number);
  return new Date(a, m - 1, d, h, min).getTime() <= agora.getTime();
}

/** Compromisso novo: hoje às 9h; depois das 9h, amanhã às 9h. */
export function compromissoVazio(familiaId: string, criadoPor: string | null, agora = new Date()): Compromisso {
  const dia = agora.getHours() >= 9 ? new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1) : agora;
  return {
    id: crypto.randomUUID(),
    familia_id: familiaId,
    tipo: 'consulta',
    titulo: '',
    data: chaveDia(dia),
    hora: '09:00',
    duracao_min: 60,
    local: null,
    observacao: null,
    avisar_min: 60,
    criado_por: criadoPor,
  };
}

export function validarCompromisso(c: Compromisso): string | null {
  if (!c.titulo.trim()) return 'Dê um nome ao compromisso (ex.: Pediatra).';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.data)) return 'Informe a data.';
  if (c.hora !== null && !/^\d{2}:\d{2}$/.test(c.hora)) return 'Informe a hora ou marque "dia inteiro".';
  return null;
}
