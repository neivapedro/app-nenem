// "Scanner" da foto: endireita o documento a partir dos 4 cantos marcados
// (correção de perspectiva) e realça para leitura e impressão. Sem bibliotecas.

export interface Ponto {
  x: number;
  y: number;
}

/** Cantos na ordem: superior esquerdo, superior direito, inferior direito, inferior esquerdo */
export type Cantos = [Ponto, Ponto, Ponto, Ponto];

export type Filtro = 'original' | 'realcar' | 'pb';

/**
 * Transformação do quadrado (0..1 × 0..1) para o quadrilátero dos cantos
 * (Heckbert). Devolve a função que leva (u, v) ao ponto da foto.
 */
export function quadradoParaQuadrilatero([p0, p1, p2, p3]: Cantos): (u: number, v: number) => Ponto {
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  let a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    a = p1.x - p0.x;
    b = p2.x - p1.x;
    c = p0.x;
    d = p1.y - p0.y;
    e = p2.y - p1.y;
    f = p0.y;
    g = h = 0;
  } else {
    const dx1 = p1.x - p2.x;
    const dx2 = p3.x - p2.x;
    const dy1 = p1.y - p2.y;
    const dy2 = p3.y - p2.y;
    const det = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - sy * dx2) / det;
    h = (dx1 * sy - dy1 * sx) / det;
    a = p1.x - p0.x + g * p1.x;
    b = p3.x - p0.x + h * p3.x;
    c = p0.x;
    d = p1.y - p0.y + g * p1.y;
    e = p3.y - p0.y + h * p3.y;
    f = p0.y;
  }
  return (u, v) => {
    const w = g * u + h * v + 1;
    return { x: (a * u + b * v + c) / w, y: (d * u + e * v + f) / w };
  };
}

const distancia = (p: Ponto, q: Ponto) => Math.hypot(p.x - q.x, p.y - q.y);

/** Tamanho da foto endireitada: o maior de cada par de lados, limitado a `max` no lado maior */
export function tamanhoSaida([p0, p1, p2, p3]: Cantos, max = 2400): { w: number; h: number } {
  let w = Math.max(distancia(p0, p1), distancia(p3, p2));
  let h = Math.max(distancia(p0, p3), distancia(p1, p2));
  const k = Math.min(1, max / Math.max(w, h));
  w = Math.max(1, Math.round(w * k));
  h = Math.max(1, Math.round(h * k));
  return { w, h };
}

/** Cantos iniciais: um pouco para dentro da borda (o usuário ajusta) */
export function cantosIniciais(w: number, h: number, margem = 0.06): Cantos {
  const mx = w * margem;
  const my = h * margem;
  return [
    { x: mx, y: my },
    { x: w - mx, y: my },
    { x: w - mx, y: h - my },
    { x: mx, y: h - my },
  ];
}

/** Os 4 cantos formam um quadrilátero convexo (dá para endireitar) */
export function cantosValidos(c: Cantos): boolean {
  let sinal = 0;
  for (let i = 0; i < 4; i++) {
    const a = c[i];
    const b = c[(i + 1) % 4];
    const d = c[(i + 2) % 4];
    const z = (b.x - a.x) * (d.y - b.y) - (b.y - a.y) * (d.x - b.x);
    if (Math.abs(z) < 1e-6) return false;
    const s = Math.sign(z);
    if (sinal && s !== sinal) return false;
    sinal = s;
  }
  return true;
}

interface Imagem {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const ajuste = (v: number, contraste: number, brilho: number) => (v - 128) * contraste + 128 + brilho;

/**
 * Endireita (amostragem bilinear) e aplica o filtro. `origem` e `destino` são
 * ImageData (ou o mesmo formato, nos testes).
 */
export function endireitar(origem: Imagem, cantos: Cantos, destino: Imagem, filtro: Filtro = 'original'): void {
  const mapa = quadradoParaQuadrilatero(cantos);
  const { width: W, height: H, data: src } = origem;
  const { width: w, height: h, data: out } = destino;
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const p = mapa((x + 0.5) / w, v);
      let sx = p.x - 0.5;
      let sy = p.y - 0.5;
      sx = sx < 0 ? 0 : sx > W - 1 ? W - 1 : sx;
      sy = sy < 0 ? 0 : sy > H - 1 ? H - 1 : sy;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1 < W ? x0 + 1 : x0;
      const y1 = y0 + 1 < H ? y0 + 1 : y0;
      const fx = sx - x0;
      const fy = sy - y0;
      const i00 = (y0 * W + x0) * 4;
      const i10 = (y0 * W + x1) * 4;
      const i01 = (y1 * W + x0) * 4;
      const i11 = (y1 * W + x1) * 4;
      const o = (y * w + x) * 4;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let k = 0; k < 3; k++) {
        const val = (src[i00 + k] * (1 - fx) + src[i10 + k] * fx) * (1 - fy) + (src[i01 + k] * (1 - fx) + src[i11 + k] * fx) * fy;
        if (k === 0) r = val;
        else if (k === 1) g = val;
        else b = val;
      }
      if (filtro === 'realcar') {
        r = ajuste(r, 1.3, 12);
        g = ajuste(g, 1.3, 12);
        b = ajuste(b, 1.3, 12);
      } else if (filtro === 'pb') {
        // Tons de cinza com contraste forte: fundo branco, letra preta (bom para imprimir)
        const l = ajuste(0.299 * r + 0.587 * g + 0.114 * b, 1.7, 30);
        r = g = b = l;
      }
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = 255;
    }
  }
}
