import { describe, expect, it } from 'vitest';
import { calendarioDoBebe, dosesDoCalendario, DOSES, porIdade } from './vacinas.ts';

describe('calendário de vacinas', () => {
  it('ids únicos e cada dose em pelo menos um calendário', () => {
    expect(new Set(DOSES.map((d) => d.id)).size).toBe(DOSES.length);
    for (const d of DOSES) expect(d.calendarios.length).toBeGreaterThan(0);
    for (const d of DOSES) if (d.apos) expect(DOSES.some((x) => x.id === d.apos!.id)).toBe(true);
  });

  it('SUS tem as doses de rotina e não tem as só particulares', () => {
    const pni = dosesDoCalendario('pni').map((d) => d.id);
    expect(pni).toEqual(expect.arrayContaining(['bcg', 'hepb-nascer', 'penta-1', 'vip-1', 'rota-1', 'pneumo-1', 'meningo-1', 'meningo-reforco', 'fa-1', 'scr-1', 'hepa-sus']));
    expect(pni).not.toContain('menb-1');
    expect(pni).not.toContain('pneumo-3');
    const sbp = dosesDoCalendario('sbp').map((d) => d.id);
    expect(sbp).toEqual(expect.arrayContaining(['menb-1', 'pneumo-3', 'varicela-12m', 'hepa-sbp-1']));
    expect(sbp).not.toContain('hepa-sus');
  });

  it('datas a partir do nascimento e situação de cada dose', () => {
    const lista = calendarioDoBebe('2026-11-15', 'pni', [{ dose_id: 'bcg', status: 'aplicada', data: '2026-11-15' }], '2027-01-20');
    const por = Object.fromEntries(lista.map((d) => [d.dose.id, d]));
    expect(por['bcg'].situacao).toBe('aplicada');
    expect(por['hepb-nascer'].situacao).toBe('atrasada');
    expect(por['penta-1'].prevista).toBe('2027-01-15');
    expect(por['penta-1'].situacao).toBe('agora');
    expect(por['meningo-1'].prevista).toBe('2027-02-15');
    expect(por['meningo-1'].situacao).toBe('proxima');
    expect(por['fa-1'].situacao).toBe('futura');
  });

  it('dose dependente respeita o intervalo mínimo da anterior', () => {
    // Gripe: 1ª aos 6 meses aplicada com atraso; a 2ª fica 30 dias depois dela
    const lista = calendarioDoBebe('2026-11-15', 'pni', [{ dose_id: 'gripe-1', status: 'aplicada', data: '2027-07-01' }], '2027-07-02');
    expect(lista.find((d) => d.dose.id === 'gripe-2')!.prevista).toBe('2027-07-31');
  });

  it('dose pulada não conta como atrasada e agrupa por idade', () => {
    const lista = calendarioDoBebe('2026-11-15', 'pni', [{ dose_id: 'hepb-nascer', status: 'pulada', data: null }], '2027-03-01');
    expect(lista.find((d) => d.dose.id === 'hepb-nascer')!.situacao).toBe('pulada');
    const g = porIdade(lista);
    expect(g[0].idade_texto).toBe('Ao nascer');
    expect(g.find((x) => x.idade_meses === 48)?.idade_texto).toBe('4 anos');
  });
});
