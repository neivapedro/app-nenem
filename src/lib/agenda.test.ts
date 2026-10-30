import { describe, expect, it } from 'vitest';
import { datasRepetidas, itensAutomaticos, serieCompromissos, ultimaConsulta } from './agenda';
import type { Bebe, Compromisso } from './tipos';

const comp = (o: Partial<Compromisso>): Compromisso => ({
  id: crypto.randomUUID(),
  familia_id: 'f',
  tipo: 'consulta',
  titulo: 'Pediatra',
  data: '2026-12-01',
  hora: '09:00',
  duracao_min: 60,
  local: null,
  observacao: null,
  avisar_min: 60,
  criado_por: null,
  ...o,
});

const bebe = (o: Partial<Bebe>): Bebe => ({
  id: 'b',
  familia_id: 'f',
  nome: 'Heitor Pedro',
  sexo: 'M',
  data_prevista: '2026-11-20',
  nascimento: null,
  peso_nascer_g: null,
  altura_nascer_cm: null,
  pc_nascer_cm: null,
  calendario_vacinal: 'pni',
  ...o,
});

describe('compromisso que se repete', () => {
  it('semanal e quinzenal', () => {
    expect(datasRepetidas('2026-12-28', 'semana', 3)).toEqual(['2026-12-28', '2027-01-04', '2027-01-11']);
    expect(datasRepetidas('2026-12-28', 'quinzena', 2)).toEqual(['2026-12-28', '2027-01-11']);
    expect(datasRepetidas('2026-12-28', 'nao', 6)).toEqual(['2026-12-28']);
  });

  it('mensal: mesmo dia do mês; 31 vira o último dia do mês curto e volta a 31', () => {
    expect(datasRepetidas('2027-01-31', 'mes', 4)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31', '2027-04-30']);
    expect(datasRepetidas('2026-11-15', 'mes', 2)).toEqual(['2026-11-15', '2026-12-15']);
  });

  it('limita de 2 a 12 vezes', () => {
    expect(datasRepetidas('2026-11-15', 'mes', 40)).toHaveLength(12);
    expect(datasRepetidas('2026-11-15', 'semana', 1)).toHaveLength(2);
  });

  it('cria compromissos separados, com id próprio e o resto igual', () => {
    const c = comp({ data: '2026-11-30', hora: '14:30', duracao_min: 45, avisar_min: 1440 });
    const s = serieCompromissos(c, 'mes', 3);
    expect(s.map((x) => x.data)).toEqual(['2026-11-30', '2026-12-30', '2027-01-30']);
    expect(s[0].id).toBe(c.id);
    expect(new Set(s.map((x) => x.id)).size).toBe(3);
    expect(s.every((x) => x.hora === '14:30' && x.duracao_min === 45 && x.avisar_min === 1440 && x.titulo === 'Pediatra')).toBe(true);
  });
});

describe('itens automáticos da agenda', () => {
  it('antes de nascer: só a prévia das vacinas que estão chegando, sem mesversário', () => {
    const itens = itensAutomaticos(bebe({}), [], '2026-11-01');
    expect(itens.length).toBeGreaterThan(0);
    expect(itens.every((i) => i.tipo === 'vacina' && i.situacao === 'proxima')).toBe(true);
    expect(itens[0].titulo).toMatch(/ao nascer/);
    // Data prevista já passou e não nasceu: nada de "atrasada"
    expect(itensAutomaticos(bebe({ data_prevista: '2026-09-01' }), [], '2026-11-01').some((i) => i.situacao === 'atrasada' || i.situacao === 'agora')).toBe(false);
  });

  it('depois de nascer: vacinas agrupadas pela data e os 3 próximos mesversários', () => {
    const b = bebe({ nascimento: new Date('2026-11-10T08:00:00-03:00').toISOString() });
    const itens = itensAutomaticos(b, [], '2026-12-20');
    const mes = itens.filter((i) => i.tipo === 'mesversario');
    expect(mes.map((i) => [i.data, i.titulo])).toEqual([
      ['2027-01-10', 'Heitor faz 2 meses'],
      ['2027-02-10', 'Heitor faz 3 meses'],
      ['2027-03-10', 'Heitor faz 4 meses'],
    ]);
    const doisMeses = itens.find((i) => i.data === '2027-01-10' && i.tipo === 'vacina');
    expect(doisMeses?.titulo).toBe('Vacinas dos 2 meses');
    expect(doisMeses?.situacao).toBe('proxima');
    expect(doisMeses?.detalhe).toContain('Pentavalente');
    // As do nascimento, sem marcar, passaram da tolerância
    expect(itens.find((i) => i.data === '2026-11-10')?.situacao).toBe('atrasada');
    // Ordenado por data
    expect([...itens].sort((a, b) => a.data.localeCompare(b.data))).toEqual(itens);
  });

  it('mesversário de hoje aparece; aplicadas saem da lista', () => {
    const b = bebe({ nascimento: new Date('2026-11-10T08:00:00-03:00').toISOString() });
    expect(itensAutomaticos(b, [], '2026-12-10').find((i) => i.tipo === 'mesversario')?.data).toBe('2026-12-10');
    const doses = itensAutomaticos(b, [], '2026-11-10').filter((i) => i.tipo === 'vacina');
    expect(doses[0].situacao).toBe('agora');
  });

  it('sem bebê: nada', () => {
    expect(itensAutomaticos(null, [], '2026-11-01')).toEqual([]);
  });
});

describe('última consulta', () => {
  it('a mais recente antes de hoje (a de hoje é a que o relatório vai levar)', () => {
    const agora = new Date('2026-12-10T10:00:00-03:00');
    const lista = [
      comp({ titulo: 'A', data: '2026-11-20' }),
      comp({ titulo: 'B', data: '2026-12-01', hora: null }),
      comp({ titulo: 'Exame', tipo: 'exame', data: '2026-12-05' }),
      comp({ titulo: 'Hoje mais tarde', data: '2026-12-10', hora: '15:00' }),
      comp({ titulo: 'Futura', data: '2026-12-20' }),
    ];
    expect(ultimaConsulta(lista, agora)?.titulo).toBe('B');
    // Consulta de hoje, mesmo já começada (pais na sala de espera), não vira o início do período
    expect(ultimaConsulta([...lista, comp({ titulo: 'Hoje cedo', data: '2026-12-10', hora: '08:00' })], agora)?.titulo).toBe('B');
    // Dia inteiro hoje ainda não conta
    expect(ultimaConsulta([comp({ data: '2026-12-10', hora: null })], agora)).toBeNull();
  });
});
