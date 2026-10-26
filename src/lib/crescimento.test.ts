import { describe, expect, it } from 'vitest';
import { diasPrematuridade, escoreZ, faixaDetalhada, idadeParaOms, lmsNaIdade, percentilDoZ, percentilInteiro, periodoAutomatico, posicaoNaRegua, textoIdadeDias, textoPercentil, valorNoPercentil } from './crescimento';

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

describe('destaque e gráfico do crescimento', () => {
  it('5 faixas de percentil nas fronteiras certas', () => {
    expect(faixaDetalhada(-2)).toBe('abaixo-p3');
    expect(faixaDetalhada(-1.5)).toBe('p3-p15');
    expect(faixaDetalhada(0)).toBe('p15-p85');
    expect(faixaDetalhada(1.036433)).toBe('p15-p85');
    expect(faixaDetalhada(1.5)).toBe('p85-p97');
    expect(faixaDetalhada(2.5)).toBe('acima-p97');
  });

  it('posição na régua: P50 no meio, P15 e P85 nas bordas da faixa do meio, extremos sem encostar', () => {
    expect(posicaoNaRegua(0)).toBeCloseTo(0.5, 3);
    expect(posicaoNaRegua(-1.036433)).toBeCloseTo(0.3, 2);
    expect(posicaoNaRegua(1.036433)).toBeCloseTo(0.7, 2);
    expect(posicaoNaRegua(-1.880794)).toBeCloseTo(0.12, 2);
    expect(posicaoNaRegua(-9)).toBeCloseTo(0.02, 3);
    expect(posicaoNaRegua(9)).toBeCloseTo(0.98, 3);
    // Sempre crescente
    let ant = -1;
    for (let z = -4; z <= 4; z += 0.1) {
      const p = posicaoNaRegua(z);
      expect(p).toBeGreaterThanOrEqual(ant);
      ant = p;
    }
  });

  it('percentil inteiro entre 1 e 99', () => {
    expect(percentilInteiro(0)).toBe(50);
    expect(percentilInteiro(-0.3)).toBe(38);
    expect(percentilInteiro(-5)).toBe(1);
    expect(percentilInteiro(5)).toBe(99);
  });

  it('período automático pela idade', () => {
    expect(periodoAutomatico(0)).toBe(183);
    expect(periodoAutomatico(46)).toBe(183);
    expect(periodoAutomatico(160)).toBe(365);
    expect(periodoAutomatico(548)).toBe(731);
    expect(periodoAutomatico(800)).toBe(1826);
  });

  it('idade em texto', () => {
    expect(textoIdadeDias(0)).toBe('0 dias');
    expect(textoIdadeDias(1)).toBe('1 dia');
    expect(textoIdadeDias(30)).toBe('1 mês');
    expect(textoIdadeDias(16)).toBe('2 semanas e 2 dias');
    expect(textoIdadeDias(28)).toBe('4 semanas');
    expect(textoIdadeDias(92)).toBe('3 meses');
    expect(textoIdadeDias(130)).toBe('4 meses e 8 dias');
    expect(textoIdadeDias(548)).toBe('18 meses');
    expect(textoIdadeDias(800)).toBe('2 anos e 2 meses');
  });
});
