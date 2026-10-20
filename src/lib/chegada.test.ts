import { describe, expect, it } from 'vitest';
import { CUIDADOS, generoBebe, itemFamilia, PESSOAS, RECOMENDACOES, textoParaFamilia, TOTAL_ITENS, VACINAS } from './chegada';

describe('chegada do bebê', () => {
  it('cada pessoa tem recomendações válidas e ids únicos', () => {
    const ids = PESSOAS.flatMap((p) => RECOMENDACOES[p.id].map((r) => itemFamilia(p.id, r.vacina)));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(TOTAL_ITENS);
    for (const p of PESSOAS) for (const r of RECOMENDACOES[p.id]) expect(VACINAS[r.vacina]).toBeDefined();
    // coqueluche para todos os adultos da casa
    for (const p of ['mae', 'pai', 'avos', 'cuidadores'] as const) expect(RECOMENDACOES[p].some((r) => r.vacina === 'dtpa')).toBe(true);
    expect(CUIDADOS.find((c) => c.id === 'alerta-bebe')!.itens[0]).toContain('37,5');
  });
  it('mensagem para a família', () => {
    const t = textoParaFamilia('Heitor', 'M');
    expect(t).toContain('A chegada do Heitor');
    expect(t).toContain('*Avós*');
    expect(t).toContain('dTpa');
    expect(t).not.toContain('*Mãe*');
  });
  it('mensagem respeita o sexo do bebê', () => {
    expect(textoParaFamilia('Heitor', 'M')).toContain('A chegada do Heitor: vamos proteger ele');
    expect(textoParaFamilia('Maria', 'F')).toContain('A chegada da Maria: vamos proteger ela');
    expect(textoParaFamilia('Sol', null)).toContain('A chegada do(a) Sol: vamos proteger o bebê');
    expect(generoBebe(null, false)).toEqual({ o: 'o', do: 'do', ele: 'ele' });
  });
});
