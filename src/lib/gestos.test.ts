import { describe, expect, it } from 'vitest';
import { abaVizinha, decidirTroca, deslocamentoLado, intencao, limiarTroca, LIMIAR_PUXAR, MAXIMO_PUXAR, naBorda, progressoPuxar, resistencia } from './gestos';

describe('intencao', () => {
  it('espera mexer um pouco antes de decidir', () => {
    expect(intencao(0, 0)).toBeNull();
    expect(intencao(6, 3)).toBeNull();
    expect(intencao(-9, 0)).toBeNull();
  });
  it('lado só quando bem horizontal', () => {
    expect(intencao(20, 2)).toBe('lado');
    expect(intencao(-30, 10)).toBe('lado');
    expect(intencao(20, 15)).toBe('vertical');
    expect(intencao(12, 12)).toBe('vertical');
    expect(intencao(2, 40)).toBe('vertical');
  });
});

describe('naBorda', () => {
  it('reserva as bordas para os gestos do sistema', () => {
    expect(naBorda(10, 390)).toBe(true);
    expect(naBorda(23, 390)).toBe(true);
    expect(naBorda(24, 390)).toBe(false);
    expect(naBorda(200, 390)).toBe(false);
    expect(naBorda(380, 390)).toBe(true);
  });
});

describe('decidirTroca', () => {
  it('dedo para a esquerda vai para a próxima aba, para a direita volta', () => {
    expect(decidirTroca(-120, 5, 400, 390)).toBe('proxima');
    expect(decidirTroca(120, -5, 400, 390)).toBe('anterior');
  });
  it('arrasto curto e lento não troca', () => {
    expect(decidirTroca(-60, 0, 500, 390)).toBeNull();
    expect(decidirTroca(-30, 0, 30, 390)).toBeNull();
  });
  it('movimento rápido troca mesmo curto', () => {
    expect(decidirTroca(-50, 4, 80, 390)).toBe('proxima');
  });
  it('movimento muito inclinado não troca', () => {
    expect(decidirTroca(-120, 100, 200, 390)).toBeNull();
  });
  it('limiar acompanha a largura com mínimo e máximo', () => {
    expect(limiarTroca(320)).toBeCloseTo(76.8);
    expect(limiarTroca(200)).toBe(64);
    expect(limiarTroca(1024)).toBe(110);
  });
});

describe('abaVizinha', () => {
  it('não dá a volta nas pontas', () => {
    expect(abaVizinha(0, 7, 'anterior')).toBeNull();
    expect(abaVizinha(0, 7, 'proxima')).toBe(1);
    expect(abaVizinha(6, 7, 'proxima')).toBeNull();
    expect(abaVizinha(6, 7, 'anterior')).toBe(5);
    expect(abaVizinha(-1, 7, 'proxima')).toBeNull();
  });
});

describe('resistencia e puxar', () => {
  it('cresce sempre, mas nunca passa do máximo', () => {
    expect(resistencia(0)).toBe(0);
    expect(resistencia(-20)).toBe(0);
    const a = resistencia(50);
    const b = resistencia(150);
    const c = resistencia(5000);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(c).toBeLessThan(MAXIMO_PUXAR);
    // No começo rende menos que o dedo (é elástico)
    expect(a).toBeLessThan(50);
  });
  it('é preciso puxar uns 160 px de dedo para chegar ao limiar', () => {
    expect(resistencia(120)).toBeLessThan(LIMIAR_PUXAR);
    expect(resistencia(170)).toBeGreaterThanOrEqual(LIMIAR_PUXAR);
  });
  it('progresso de 0 a 1', () => {
    expect(progressoPuxar(0)).toBe(0);
    expect(progressoPuxar(LIMIAR_PUXAR / 2)).toBeCloseTo(0.5);
    expect(progressoPuxar(LIMIAR_PUXAR * 3)).toBe(1);
  });
  it('deslocamento lateral é pequeno e respeita o sentido', () => {
    expect(deslocamentoLado(-200, true)).toBeLessThan(0);
    expect(deslocamentoLado(-200, true)).toBeGreaterThan(-36);
    expect(Math.abs(deslocamentoLado(200, false))).toBeLessThan(12);
  });
});
