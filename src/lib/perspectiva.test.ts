import { describe, expect, it } from 'vitest';
import { cantosIniciais, cantosValidos, endireitar, quadradoParaQuadrilatero, tamanhoSaida, type Cantos } from './perspectiva';

describe('endireitar documento', () => {
  it('leva os cantos do quadrado aos cantos marcados (também em perspectiva)', () => {
    const trapezio: Cantos = [
      { x: 30, y: 10 },
      { x: 170, y: 20 },
      { x: 190, y: 150 },
      { x: 5, y: 140 },
    ];
    const m = quadradoParaQuadrilatero(trapezio);
    const perto = (p: { x: number; y: number }, q: { x: number; y: number }) => {
      expect(p.x).toBeCloseTo(q.x, 6);
      expect(p.y).toBeCloseTo(q.y, 6);
    };
    perto(m(0, 0), trapezio[0]);
    perto(m(1, 0), trapezio[1]);
    perto(m(1, 1), trapezio[2]);
    perto(m(0, 1), trapezio[3]);
    // retângulo: o meio vai para o meio
    const r = quadradoParaQuadrilatero(cantosIniciais(100, 50, 0));
    perto(r(0.5, 0.5), { x: 50, y: 25 });
  });

  it('tamanho de saída, cantos válidos e recorte de verdade', () => {
    expect(tamanhoSaida(cantosIniciais(4000, 3000, 0))).toEqual({ w: 2400, h: 1800 });
    expect(cantosValidos(cantosIniciais(100, 100))).toBe(true);
    // cantos cruzados (gravata-borboleta) não valem
    expect(
      cantosValidos([
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
      ]),
    ).toBe(false);

    // Foto 4×4: metade esquerda preta, direita branca; recorta só a direita
    const W = 4;
    const H = 4;
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) data.fill(x >= 2 ? 255 : 0, (y * W + x) * 4, (y * W + x) * 4 + 3), (data[(y * W + x) * 4 + 3] = 255);
    const out = { width: 2, height: 2, data: new Uint8ClampedArray(16) };
    endireitar({ width: W, height: H, data }, [
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 4 },
      { x: 2, y: 4 },
    ], out);
    expect([...out.data].filter((_, i) => i % 4 === 0).every((v) => v > 200)).toBe(true);
    // preto e branco: cinza vira mais claro ou mais escuro, nunca colorido
    const cinza = { width: 1, height: 1, data: new Uint8ClampedArray([200, 100, 50, 255]) };
    const pb = { width: 1, height: 1, data: new Uint8ClampedArray(4) };
    endireitar(cinza, cantosIniciais(1, 1, 0), pb, 'pb');
    expect(pb.data[0]).toBe(pb.data[1]);
    expect(pb.data[1]).toBe(pb.data[2]);
  });
});
