import { describe, expect, it } from 'vitest';
import { baseDoTexto, decidirRecolher } from './vidro';

describe('baseDoTexto', () => {
  it('padrão do iPhone (17) vira a base de 16 px do app', () => expect(baseDoTexto(17)).toBe(16));
  it('limita nos extremos', () => {
    expect(baseDoTexto(11)).toBe(14);
    expect(baseDoTexto(53)).toBe(22);
  });
  it('valor inválido volta ao padrão', () => expect(baseDoTexto(NaN)).toBe(16));
});

describe('decidirRecolher', () => {
  const l = { inicio: 80, passo: 4, fim: 2000 };
  it('recolhe ao descer, volta ao subir', () => {
    expect(decidirRecolher(false, 300, 20, l)).toBe(true);
    expect(decidirRecolher(true, 280, -20, l)).toBe(false);
  });
  it('movimento pequeno mantém o estado', () => expect(decidirRecolher(true, 300, 1, l)).toBe(true));
  it('no topo e no fim da página fica inteira', () => {
    expect(decidirRecolher(true, 40, 20, l)).toBe(false);
    expect(decidirRecolher(true, 2100, 20, l)).toBe(false);
  });
});
