import { describe, expect, it } from 'vitest';
import { analisarTexto, deveAnimar, interpolar, suavizar, textoMinutos } from './animar';

describe('interpolar', () => {
  it('começa, termina e não passa do alvo', () => {
    expect(interpolar(0, 100, 0)).toBe(0);
    expect(interpolar(0, 100, 1)).toBe(100);
    expect(interpolar(0, 100, 2)).toBe(100);
    expect(interpolar(10, 0, 1)).toBe(0);
    const meio = interpolar(0, 100, 0.5);
    expect(meio).toBeGreaterThan(50); // sai rápido
    expect(meio).toBeLessThan(100);
  });
  it('suavizar é crescente de 0 a 1', () => {
    expect(suavizar(0)).toBe(0);
    expect(suavizar(1)).toBe(1);
    expect(suavizar(0.3)).toBeLessThan(suavizar(0.6));
  });
});

describe('deveAnimar', () => {
  it('não anima o que muda pouco', () => {
    expect(deveAnimar(5, 5)).toBe(false);
    expect(deveAnimar(5, 6)).toBe(false);
    expect(deveAnimar(0, 7)).toBe(true);
    // Contagem regressiva perdendo 30 s de 1h46
    expect(deveAnimar(6_360_000, 6_330_000, 60_000)).toBe(false);
    expect(deveAnimar(1000, 1020, 1)).toBe(false); // menos de 3%
    expect(deveAnimar(Number.NaN, 3)).toBe(false);
  });
});

describe('analisarTexto', () => {
  it('durações no formato do app', () => {
    const a = analisarTexto('1h46')!;
    expect(a.valor).toBe(106);
    expect(a.formatar(30)).toBe('30 min');
    expect(a.formatar(65.4)).toBe('1h05');
    expect(analisarTexto('2h')!.valor).toBe(120);
    expect(analisarTexto('45 min')!.valor).toBe(45);
    const p = analisarTexto('+1h05')!;
    expect(p.valor).toBe(65);
    expect(p.formatar(12)).toBe('+12 min');
  });
  it('números com vírgula decimal e ponto de milhar', () => {
    const h = analisarTexto('14,2 h')!;
    expect(h.valor).toBeCloseTo(14.2);
    expect(h.formatar(7.25)).toBe('7,3 h');
    expect(h.minimo).toBeCloseTo(0.1);
    const ml = analisarTexto('1.234 ml')!;
    expect(ml.valor).toBe(1234);
    expect(ml.formatar(987.6)).toBe('988 ml');
    expect(analisarTexto('7')!.formatar(3.4)).toBe('3');
    const r = analisarTexto('R$ 1.008,50')!;
    expect(r.valor).toBeCloseTo(1008.5);
    expect(r.formatar(12.345)).toBe('R$ 12,35');
  });
  it('sem número (ou mais de um): não anima', () => {
    expect(analisarTexto('—')).toBeNull();
    expect(analisarTexto('3 · 2')).toBeNull();
  });
  it('textoMinutos', () => {
    expect(textoMinutos(59.6)).toBe('1h00');
    expect(textoMinutos(-3)).toBe('0 min');
  });
});
