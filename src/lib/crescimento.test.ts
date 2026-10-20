import { describe, expect, it } from 'vitest';
import { diasPrematuridade, escoreZ, idadeParaOms, lmsNaIdade, percentilDoZ, textoPercentil, valorNoPercentil } from './crescimento';

describe('curvas da OMS', () => {
  it('mediana ao nascer confere com a tabela da OMS', () => {
    expect(lmsNaIdade('peso', 'M', 0)?.m).toBeCloseTo(3.3464, 4);
    expect(lmsNaIdade('peso', 'F', 0)?.m).toBeCloseTo(3.2322, 4);
    expect(lmsNaIdade('comprimento', 'M', 0)?.m).toBeCloseTo(49.8842, 4);
    expect(lmsNaIdade('pc', 'M', 0)?.m).toBeCloseTo(34.4618, 4);
  });

  it('a mediana tem escore-z 0 e percentil 50', () => {
    const m = lmsNaIdade('peso', 'M', 183)!.m;
    expect(escoreZ('peso', 'M', 183, m)).toBeCloseTo(0, 6);
    expect(textoPercentil(0)).toBe('P50');
  });

  it('percentis de referência batem com as tabelas de percentis da OMS', () => {
    // Menino, peso ao nascer: P3 2,5 kg; P97 4,3 kg (tabela de percentis da OMS)
    expect(valorNoPercentil('peso', 'M', 0, 3)).toBeCloseTo(2.5, 1);
    expect(valorNoPercentil('peso', 'M', 0, 97)).toBeCloseTo(4.3, 1);
    // Menina aos 12 meses (365 dias): mediana ~8,9 kg
    expect(valorNoPercentil('peso', 'F', 365, 50)).toBeCloseTo(8.9, 1);
  });

  it('interpola entre as semanas da tabela', () => {
    const a = lmsNaIdade('peso', 'M', 28)!.m;
    const b = lmsNaIdade('peso', 'M', 35)!.m;
    const meio = lmsNaIdade('peso', 'M', 31)!.m;
    expect(meio).toBeGreaterThan(a);
    expect(meio).toBeLessThan(b);
  });

  it('extremos do peso usam a correção da OMS e o texto não alarma à toa', () => {
    const z = escoreZ('peso', 'M', 0, 5.5)!;
    expect(z).toBeGreaterThan(3);
    expect(textoPercentil(z)).toBe('acima do P97');
    expect(textoPercentil(-2.5)).toBe('abaixo do P3');
    expect(percentilDoZ(1.036433)).toBeCloseTo(85, 1);
  });

  it('fora da faixa da tabela não calcula', () => {
    expect(escoreZ('peso', 'M', -1, 3)).toBeNull();
    expect(escoreZ('peso', 'M', 2000, 15)).toBeNull();
  });
});

describe('idade corrigida (prematuros)', () => {
  it('só conta como prematuro com 3 semanas ou mais antes da data prevista', () => {
    expect(diasPrematuridade('2026-02-15', null)).toBe(0);
    expect(diasPrematuridade('2026-02-15', '2026-03-07')).toBe(0); // 20 dias
    expect(diasPrematuridade('2026-02-15', '2026-03-08')).toBe(21);
    expect(diasPrematuridade('2026-02-15', '2026-04-12')).toBe(56); // 8 semanas, atravessa o fim do horário de verão
    expect(diasPrematuridade('2026-02-15', '2026-02-01')).toBe(0); // nasceu depois da data prevista
  });

  it('desconta a prematuridade até 2 anos e não compara antes da data prevista', () => {
    expect(idadeParaOms(100, 0)).toEqual({ dia: 100, corrigida: false });
    expect(idadeParaOms(100, 56)).toEqual({ dia: 44, corrigida: true });
    expect(idadeParaOms(56, 56)).toEqual({ dia: 0, corrigida: true });
    expect(idadeParaOms(30, 56)).toBeNull();
    expect(idadeParaOms(730, 56)).toEqual({ dia: 674, corrigida: true });
    expect(idadeParaOms(731, 56)).toEqual({ dia: 731, corrigida: false });
  });
});
