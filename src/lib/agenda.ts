import { EMOJI_TIPO, MESES_MESVERSARIO, textoMeses } from '../../supabase/functions/_shared/ics.ts';
import { somarDias, somarMeses } from '../../supabase/functions/_shared/tempo.ts';
import { calendarioDoBebe, type AplicacaoVacina } from '../../supabase/functions/_shared/vacinas.ts';
import { chaveDia, dataBr, diasEntre, nomeDia } from './datas';
import type { Bebe, Compromisso, TipoCompromisso } from './tipos';

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

// ---------- Compromisso que se repete ----------

export type Repeticao = 'nao' | 'semana' | 'quinzena' | 'mes';

export const OPCOES_REPETICAO: { valor: Repeticao; rotulo: string }[] = [
  { valor: 'nao', rotulo: 'Não' },
  { valor: 'semana', rotulo: 'Toda semana' },
  { valor: 'quinzena', rotulo: 'A cada 15 dias' },
  { valor: 'mes', rotulo: 'Todo mês' },
];

/** Quantas vezes, por padrão (o usuário escolhe de 2 a 12) */
export const VEZES_PADRAO: Record<Exclude<Repeticao, 'nao'>, number> = { semana: 4, quinzena: 4, mes: 6 };
export const VEZES_MIN = 2;
export const VEZES_MAX = 12;

/** Datas da série, começando na própria data. Mensal: mesmo dia do mês (31 vira o último dia do mês curto). */
export function datasRepetidas(data: string, repeticao: Repeticao, vezes: number): string[] {
  if (repeticao === 'nao') return [data];
  const n = Math.min(VEZES_MAX, Math.max(VEZES_MIN, Math.round(vezes)));
  return Array.from({ length: n }, (_, i) => (repeticao === 'mes' ? somarMeses(data, i) : somarDias(data, i * (repeticao === 'semana' ? 7 : 14))));
}

/** Compromissos separados (cada um com id próprio), com a mesma hora, duração e aviso. O primeiro mantém o id. */
export function serieCompromissos(c: Compromisso, repeticao: Repeticao, vezes: number): Compromisso[] {
  return datasRepetidas(c.data, repeticao, vezes).map((data, i) => ({ ...c, id: i === 0 ? c.id : crypto.randomUUID(), data }));
}

// ---------- Itens automáticos (vacinas previstas e mesversários) ----------

export interface ItemAutomatico {
  chave: string;
  tipo: 'vacina' | 'mesversario';
  /** AAAA-MM-DD (vacina: a data prevista) */
  data: string;
  titulo: string;
  detalhe: string;
  situacao?: 'atrasada' | 'agora' | 'proxima';
}

/** Quantos mesversários futuros aparecem na lista */
export const MESVERSARIOS_NA_LISTA = 3;

const nomeCurtoVacina = (v: string) => v.split(' (')[0].split(' /')[0];

/** "ao nascer", "de 1 mês", "dos 2 meses", "dos 4 anos" */
function idadeDaVacina(meses: number): string {
  if (meses === 0) return 'ao nascer';
  if (meses === 1) return 'de 1 mês';
  if (meses < 24) return `dos ${meses} meses`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  return `dos ${anos} anos${resto ? ` e ${resto} meses` : ''}`;
}

/**
 * Vacinas que estão chegando (próximas 30 dias, já pode tomar ou atrasadas), agrupadas pela data
 * prevista, e os próximos mesversários. Mesmo cálculo da tela de vacinas: sem nascimento, usa a data
 * prevista do parto (prévia); mesversários só depois do nascimento.
 */
export function itensAutomaticos(bebe: Bebe | null, aplicacoes: AplicacaoVacina[], hoje: string): ItemAutomatico[] {
  if (!bebe) return [];
  const itens: ItemAutomatico[] = [];
  const nasc = bebe.nascimento ? chaveDia(bebe.nascimento) : null;
  const base = nasc ?? bebe.data_prevista;
  if (base) {
    const grupos = new Map<string, { meses: number; nomes: string[]; situacao: 'atrasada' | 'agora' | 'proxima' }>();
    for (const d of calendarioDoBebe(base, bebe.calendario_vacinal, aplicacoes, hoje)) {
      if (d.situacao !== 'atrasada' && d.situacao !== 'agora' && d.situacao !== 'proxima') continue;
      // Prévia (ainda não nasceu): só as que estão chegando, nunca "atrasada" antes do parto
      if (!nasc && d.situacao !== 'proxima') continue;
      const g = grupos.get(d.prevista) ?? { meses: d.dose.idade_meses, nomes: [], situacao: d.situacao };
      g.meses = Math.min(g.meses, d.dose.idade_meses);
      const nome = nomeCurtoVacina(d.dose.vacina);
      if (!g.nomes.includes(nome)) g.nomes.push(nome);
      if (d.situacao === 'atrasada' || (d.situacao === 'agora' && g.situacao === 'proxima')) g.situacao = d.situacao;
      grupos.set(d.prevista, g);
    }
    for (const [data, g] of grupos) {
      itens.push({
        chave: `vacinas-${data}`,
        tipo: 'vacina',
        data,
        titulo: `💉 ${g.nomes.length === 1 ? 'Vacina' : 'Vacinas'} ${idadeDaVacina(g.meses)}`,
        detalhe: g.nomes.join(', '),
        situacao: g.situacao,
      });
    }
  }
  if (nasc) {
    const nome = bebe.nome.trim().split(/\s+/)[0] || 'O bebê';
    for (let n = 1; n <= MESES_MESVERSARIO && itens.filter((i) => i.tipo === 'mesversario').length < MESVERSARIOS_NA_LISTA; n++) {
      const data = somarMeses(nasc, n);
      if (data < hoje) continue;
      itens.push({ chave: `mesversario-${n}`, tipo: 'mesversario', data, titulo: `🎂 ${nome} faz ${textoMeses(n)}`, detalhe: 'Mesversário' });
    }
  }
  return itens.sort((a, b) => a.data.localeCompare(b.data));
}

/** "Hoje", "sexta, 13 nov · em 5 dias" (dia inteiro, sem hora) */
export function textoDiaAutomatico(data: string, hoje: string): string {
  const dif = diasEntre(hoje, data);
  return `${nomeDia(data, hoje)}${dif > 1 && dif <= 30 ? ` · em ${dif} dias` : ''}`;
}

/** Última consulta que já começou (para o relatório "desde a última consulta") */
export function ultimaConsulta(lista: Compromisso[], agora: Date): Compromisso | null {
  // Consulta de hoje (ex.: na sala de espera) não conta: o relatório é para levar a ela, desde a anterior
  const hoje = chaveDia(agora);
  return lista.filter((c) => c.tipo === 'consulta' && c.data < hoje && compromissoJaPassou(c, agora)).sort((a, b) => ordem(b, a))[0] ?? null;
}
