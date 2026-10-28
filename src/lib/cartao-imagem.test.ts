import { describe, expect, it } from 'vitest';
import { encaixeFoto } from './cartao-imagem';

// Área da foto no cartão feed com medidas e 3 conquistas (~936×645)
const W = 936;
const H = 645;

describe('encaixe da foto no cartão', () => {
  it('foto em pé (9:16): mostra pelo menos 64% da altura, recorte puxado para o topo e laterais desfocadas', () => {
    const e = encaixeFoto(1080, 1920, W, H);
    expect(e.sh / 1920).toBeGreaterThanOrEqual(0.639);
    expect(e.laterais).toBe(true);
    expect(e.dh).toBeCloseTo(H);
    expect(e.dx).toBeGreaterThan(0);
    // corta mais embaixo que em cima (rosto no terço de cima)
    expect(e.sy).toBeLessThan((1920 - e.sh) * 0.25);
    expect(e.sy + e.sh).toBeLessThanOrEqual(1920);
  });

  it('3:4 também ganha laterais; 1:1 e 4:3 preenchem a área (cover)', () => {
    expect(encaixeFoto(1200, 1600, W, H).laterais).toBe(true);
    for (const [fw, fh] of [
      [1200, 1200],
      [1600, 1200],
    ]) {
      const e = encaixeFoto(fw, fh, W, H);
      expect(e.laterais).toBe(false);
      expect(e.dw).toBeCloseTo(W);
      expect(e.dh).toBeCloseTo(H);
      expect(e.sx).toBeGreaterThanOrEqual(0);
      expect(e.sy).toBeGreaterThanOrEqual(0);
    }
  });

  it('stories (área quase quadrada): 3:4 preenche, 9:16 encolhe só o necessário', () => {
    expect(encaixeFoto(1200, 1600, 936, 880).laterais).toBe(false);
    const e = encaixeFoto(1080, 1920, 936, 880);
    expect(e.laterais).toBe(true);
    expect(e.sh / 1920).toBeCloseTo(0.64, 2);
  });
});
