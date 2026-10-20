import { describe, expect, it } from 'vitest';
import { diasPainel } from './painel';
import { textoParaPdf } from './relatorio';
import type { Registro } from './tipos';

describe('relatório do pediatra', () => {
  it('tira emoji e troca símbolos que a fonte do PDF não tem', () => {
    expect(textoParaPdf('Heitor 👶 tomou 💊 ≥ 5 ml → ok ✓')).toBe('Heitor tomou >= 5 ml -> ok v');
    expect(textoParaPdf('Ação · 36,8 °C – “ótimo”')).toBe('Ação · 36,8 °C – “ótimo”');
  });

  it('2 anos de registros não travam a tela', () => {
    const regs: Registro[] = [];
    const ini = new Date('2025-01-01T00:00:00-03:00').getTime();
    for (let d = 0; d < 730; d++)
      for (let i = 0; i < 25; i++) {
        const t = new Date(ini + d * 86_400_000 + i * 3_456_000).toISOString();
        regs.push({ id: `${d}-${i}`, familia_id: 'f', bebe_id: 'b', criado_por: null, observacao: null, tipo: i % 5 === 0 ? 'sono' : 'fralda', inicio: t, fim: i % 5 === 0 ? new Date(Date.parse(t) + 3_000_000).toISOString() : t, dados: i % 5 === 0 ? {} : { xixi: true, coco: false } } as Registro);
      }
    const t0 = performance.now();
    const dias = diasPainel(regs, '2025-01-01', '2026-12-31', new Date('2027-01-01T12:00:00-03:00'));
    expect(dias).toHaveLength(730);
    expect(dias[100].fraldas).toBe(20);
    expect(performance.now() - t0).toBeLessThan(2500);
  });
});
