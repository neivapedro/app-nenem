import { describe, expect, it } from 'vitest';
import { mesesDeVida } from './padroes';
import type { RegistroDe } from './tipos';

const base = {
  familia_id: 'f',
  bebe_id: 'b',
  criado_por: 'u1',
  observacao: null,
};
const em = (dia: string, hhmm: string) => new Date(`${dia}T${hhmm}:00-03:00`).toISOString();

function mamadeira(id: string, dia: string, ml: number): RegistroDe<'mamadeira'> {
  const iso = em(dia, '10:00');
  return {
    ...base,
    id,
    tipo: 'mamadeira',
    inicio: iso,
    fim: iso,
    dados: { ml, conteudo: 'materno' },
  };
}
function sono(id: string, inicio: string, fim: string): RegistroDe<'sono'> {
  return {
    ...base,
    id,
    tipo: 'sono',
    inicio,
    fim,
    dados: {},
  } as RegistroDe<'sono'>;
}

describe('meses de vida', () => {
  it('fecha cada mês no mesversário e faz a média por dia', () => {
    // Nasceu em 15/11: 1º mês vai de 15/11 a 14/12 (30 dias)
    const registros = [
      mamadeira('a', '2026-11-15', 60),
      mamadeira('b', '2026-11-15', 60),
      mamadeira('c', '2026-12-14', 90),
      mamadeira('d', '2026-12-15', 120),
      // Sono que atravessa a meia-noite da virada do mês
      sono('s', em('2026-12-14', '23:00'), em('2026-12-15', '01:00')),
    ];
    const meses = mesesDeVida(registros, '2026-11-15', '2026-12-20', new Date(em('2026-12-20', '12:00')));
    expect(meses).toHaveLength(2);
    const [m1, m2] = meses;
    expect(m1).toMatchObject({
      mes: 1,
      inicio: '2026-11-15',
      fim: '2026-12-14',
      dias: 30,
      emAndamento: false,
    });
    expect(m1.alimentacoes).toBeCloseTo(3 / 30);
    expect(m1.ml).toBeCloseTo(210 / 30);
    expect(m1.sonoMs).toBeCloseTo(3_600_000 / 30);
    // 2º mês: 15/12 a 19/12 (hoje, 20/12, não conta)
    expect(m2).toMatchObject({
      mes: 2,
      inicio: '2026-12-15',
      fim: '2027-01-14',
      dias: 5,
      emAndamento: true,
    });
    expect(m2.alimentacoes).toBeCloseTo(1 / 5);
    expect(m2.sonoMs).toBeCloseTo(3_600_000 / 5);
  });

  it('não mostra nada no dia do nascimento e respeita meses curtos', () => {
    expect(mesesDeVida([], '2026-11-15', '2026-11-15', new Date())).toEqual([]);
    const meses = mesesDeVida([], '2027-01-31', '2027-03-05', new Date(em('2027-03-05', '12:00')));
    expect(meses.map((m) => [m.inicio, m.fim])).toEqual([
      ['2027-01-31', '2027-02-27'],
      ['2027-02-28', '2027-03-30'],
    ]);
  });
});

import { diasDoPeriodo, mediasPorMes } from './padroes';

describe('relatório por período', () => {
  it('dias do período e médias por mês do calendário', () => {
    const registros = [mamadeira('a', '2026-11-30', 60), mamadeira('b', '2026-12-01', 90), mamadeira('c', '2026-12-01', 90)];
    const dias = diasDoPeriodo(registros, '2026-11-29', '2026-12-02', new Date(em('2026-12-03', '12:00')));
    expect(dias.map((d) => [d.dia, d.alimentacoes])).toEqual([
      ['2026-11-29', 0],
      ['2026-11-30', 1],
      ['2026-12-01', 2],
      ['2026-12-02', 0],
    ]);
    const meses = mediasPorMes(dias);
    expect(meses.map((m) => [m.mes, m.dias, m.alimentacoes])).toEqual([
      ['2026-11', 2, 0.5],
      ['2026-12', 2, 1],
    ]);
    expect(meses[1].ml).toBe(90);
  });
});
