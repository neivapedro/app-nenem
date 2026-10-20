import { describe, expect, it } from 'vitest';
import { deCampoDataHora, haQuanto, idadeBebe, nomeDia, paraCampoDataHora, relogio, semanasGestacao, textoDuracao } from './datas';

const t = (s: string) => new Date(`${s}-03:00`);

describe('datas', () => {
  it('formata durações e cronômetro', () => {
    expect(textoDuracao(45_000, true)).toBe('45 s');
    expect(textoDuracao(12 * 60_000)).toBe('12 min');
    expect(textoDuracao(65 * 60_000)).toBe('1h 05min');
    expect(textoDuracao(180 * 60_000)).toBe('3h');
    expect(relogio(7 * 60_000 + 42_000)).toBe('07:42');
    expect(relogio(3600_000 + 7 * 60_000 + 42_000)).toBe('1:07:42');
    expect(haQuanto(t('2026-11-15T10:00').toISOString(), t('2026-11-15T11:20'))).toBe('há 1h 20min');
    expect(haQuanto(t('2026-11-15T10:00').toISOString(), t('2026-11-15T10:00'))).toBe('agora');
  });

  it('idade do bebê em dias, semanas, meses e anos', () => {
    const nasc = t('2026-11-15T03:10').toISOString();
    expect(idadeBebe(nasc, t('2026-11-15T23:00'))).toBe('Nasceu hoje');
    expect(idadeBebe(nasc, t('2026-11-16T01:00'))).toBe('1 dia');
    expect(idadeBebe(nasc, t('2026-11-25T08:00'))).toBe('10 dias');
    expect(idadeBebe(nasc, t('2026-12-01T08:00'))).toBe('2 semanas e 2 dias');
    expect(idadeBebe(nasc, t('2026-12-15T08:00'))).toBe('1 mês');
    expect(idadeBebe(nasc, t('2026-12-19T08:00'))).toBe('1 mês e 4 dias');
    expect(idadeBebe(nasc, t('2027-05-15T08:00'))).toBe('6 meses');
    expect(idadeBebe(nasc, t('2028-01-20T08:00'))).toBe('1 ano e 2 meses');
  });

  it('nascido dia 31: o mês seguinte conta pelo último dia', () => {
    const nasc = t('2027-01-31T10:00').toISOString();
    // Em fevereiro o mesversário é o dia 28 (igual aos meses de vida)
    expect(idadeBebe(nasc, t('2027-02-27T10:00'))).toBe('3 semanas e 6 dias');
    expect(idadeBebe(nasc, t('2027-02-28T10:00'))).toBe('1 mês');
    expect(idadeBebe(nasc, t('2027-03-03T10:00'))).toBe('1 mês e 3 dias');
    expect(idadeBebe(t('2026-11-30T10:00').toISOString(), t('2027-02-28T10:00'))).toBe('3 meses');
  });

  it('antes de nascer não diz "nasceu hoje"', () => {
    expect(idadeBebe(t('2026-11-15T10:00').toISOString(), t('2026-11-10T10:00'))).toBe('Ainda não nasceu');
    expect(idadeBebe(t('2026-11-15T10:00').toISOString(), t('2026-11-15T22:00'))).toBe('Nasceu hoje');
  });

  it('semanas de gestação pela data prevista', () => {
    expect(semanasGestacao('2026-11-15', '2026-10-18')).toEqual({ semanas: 36, dias: 0, faltam: 28 });
    expect(semanasGestacao('2026-11-15', '2026-11-17')).toEqual({ semanas: 40, dias: 2, faltam: -2 });
  });

  it('nomeia os dias', () => {
    expect(nomeDia('2026-11-15', '2026-11-15')).toBe('Hoje');
    expect(nomeDia('2026-11-14', '2026-11-15')).toBe('Ontem');
    expect(nomeDia('2026-11-13', '2026-11-15')).toBe('sexta, 13 nov');
  });

  it('campo de data e hora ida e volta', () => {
    const iso = t('2026-11-15T09:05').toISOString();
    expect(paraCampoDataHora(iso)).toBe('2026-11-15T09:05');
    expect(deCampoDataHora('2026-11-15T09:05')).toBe(iso);
    expect(deCampoDataHora('')).toBeNull();
  });
});
