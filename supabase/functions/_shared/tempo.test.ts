import { describe, expect, it } from 'vitest';
import { dataNoFuso, horaNoFuso, localParaUtc, somarMeses } from './tempo.ts';

describe('fusos e datas', () => {
  it('converte hora local em UTC e volta', () => {
    expect(localParaUtc('2026-11-25', '09:30', 'America/Sao_Paulo').toISOString()).toBe('2026-11-25T12:30:00.000Z');
    expect(localParaUtc('2026-07-01', '09:30', 'Europe/Lisbon').toISOString()).toBe('2026-07-01T08:30:00.000Z');
    const d = new Date('2026-11-26T02:10:00Z');
    expect(dataNoFuso(d, 'America/Sao_Paulo')).toBe('2026-11-25');
    expect(horaNoFuso(d, 'America/Sao_Paulo')).toBe('23:10');
  });

  it('soma meses sem estourar o fim do mês', () => {
    expect(somarMeses('2027-01-31', 1)).toBe('2027-02-28');
    expect(somarMeses('2028-01-31', 1)).toBe('2028-02-29');
    expect(somarMeses('2026-11-15', 14)).toBe('2028-01-15');
  });
});
