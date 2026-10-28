// Imagens da retrospectiva para compartilhar (stories, 1080×1920): o resumo em números,
// crescimento e conquistas, e as fotos do mês em grade. Fundo em degradê, como as telas.
import { encaixeFoto } from './cartao-imagem';

export const TAMANHO_RETRO = { w: 1080, h: 1920 } as const;

export interface NumeroImagem {
  valor: string;
  rotulo: string;
  /** Cor da bolinha */
  cor: string;
}

export interface DadosImagensRetro {
  /** "O primeiro ano do Heitor" */
  titulo: string;
  /** "28/10/2025 a 28/10/2026" */
  periodo: string;
  /** Nome para o arquivo */
  nome: string;
  foto: CanvasImageSource | null;
  numeros: NumeroImagem[];
  /** Peso e altura: "3,35 kg → 9,6 kg" */
  crescimento: { rotulo: string; de: string; ate: string; detalhe: string | null }[];
  /** Os marcos em destaque (até 5) e quantos são no total */
  marcos: { emoji: string; titulo: string; idade: string | null }[];
  totalMarcos: number;
  /** Linhas extras na 2ª imagem ("18 vacinas tomadas") */
  extras: string[];
  fotos: { img: CanvasImageSource; rotulo: string }[];
}

const FONTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const FONTE_ROUND = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const BRANCO = '#ffffff';
const BRANCO_2 = 'rgb(255 255 255 / 0.82)';
const BRANCO_3 = 'rgb(255 255 255 / 0.62)';

function retanguloRedondo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function cortar(ctx: CanvasRenderingContext2D, texto: string, larguraMax: number): string {
  if (ctx.measureText(texto).width <= larguraMax) return texto;
  let s = texto;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > larguraMax) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/** Quebra em linhas (no máximo `max`; a última leva "…" se sobrar texto) */
function linhas(ctx: CanvasRenderingContext2D, texto: string, largura: number, max: number): string[] {
  const palavras = texto.split(/\s+/);
  const out: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const t = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(t).width <= largura || !atual) atual = t;
    else {
      out.push(atual);
      atual = p;
    }
  }
  if (atual) out.push(atual);
  if (out.length <= max) return out;
  const fica = out.slice(0, max);
  fica[max - 1] = cortar(ctx, `${fica[max - 1]} ${out.slice(max).join(' ')}`, largura);
  return fica;
}

function tamanhoFonte(img: CanvasImageSource): { w: number; h: number } {
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) return { w: img.width, h: img.height };
  if (img instanceof HTMLImageElement) return { w: img.naturalWidth, h: img.naturalHeight };
  if (img instanceof HTMLCanvasElement) return { w: img.width, h: img.height };
  return { w: 1, h: 1 };
}

/** Foto cobrindo a área (recorte puxando para o rosto nas fotos em pé) */
function fotoCobrindo(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number) {
  const t = tamanhoFonte(img);
  const escala = Math.max(w / t.w, h / t.h);
  const sw = w / escala;
  const sh = h / escala;
  const emPe = t.h > t.w * 1.05;
  ctx.drawImage(img, (t.w - sw) / 2, (t.h - sh) * (emPe ? 0.2 : 0.4), sw, sh, x, y, w, h);
}

function estrela(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const raio = i % 2 ? r * 0.45 : r;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * raio, cy + Math.sin(a) * raio);
  }
  ctx.closePath();
}

type Paleta = [string, string, string];
const PALETAS: Record<'resumo' | 'crescimento' | 'fotos', Paleta> = {
  resumo: ['#6925d5', '#c62585', '#f2994a'],
  crescimento: ['#1e71bb', '#6925d5', '#c62585'],
  fotos: ['#1c754b', '#1e71bb', '#6925d5'],
};

function fundo(ctx: CanvasRenderingContext2D, W: number, H: number, [a, b, c]: Paleta) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, a);
  g.addColorStop(0.62, b);
  g.addColorStop(1, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Manchas de luz e confete discreto (posições fixas: a imagem sai sempre igual)
  for (const [cx, cy, r, alfa] of [
    [W * 0.95, H * 0.06, W * 0.6, 0.16],
    [W * 0.05, H * 0.55, W * 0.5, 0.1],
    [W * 0.8, H * 0.95, W * 0.55, 0.12],
  ]) {
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    rg.addColorStop(0, `rgb(255 255 255 / ${alfa})`);
    rg.addColorStop(1, 'rgb(255 255 255 / 0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  }
  let s = 13;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 30; i++) {
    const x = rnd() * W;
    const y = rnd() < 0.5 ? rnd() * 200 : H - rnd() * 230;
    ctx.save();
    ctx.globalAlpha = 0.18 + rnd() * 0.2;
    ctx.fillStyle = ['#ffffff', '#ffd36e', '#ffc2e2', '#c9e8ff'][i % 4];
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI);
    if (i % 3 === 0) estrela(ctx, 0, 0, 10 + rnd() * 8);
    else if (i % 3 === 1) retanguloRedondo(ctx, -11, -4, 22, 8, 4);
    else {
      ctx.beginPath();
      ctx.arc(0, 0, 6 + rnd() * 5, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }
}

/** Cabeçalho: selo "Retrospectiva", título e período. Devolve o y depois dele */
function cabecalho(ctx: CanvasRenderingContext2D, W: number, y: number, titulo: string, periodo: string, sobre: string, grande = true): number {
  const M = 84;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 30px ${FONTE}`;
  const sw = ctx.measureText(sobre.toUpperCase()).width + 56;
  ctx.fillStyle = 'rgb(255 255 255 / 0.2)';
  retanguloRedondo(ctx, M, y, sw, 58, 29);
  ctx.fill();
  ctx.fillStyle = BRANCO;
  ctx.fillText(sobre.toUpperCase(), M + 28, y + 40);
  y += 58 + 40;
  let tam = grande ? 96 : 68;
  ctx.font = `800 ${tam}px ${FONTE_ROUND}`;
  let ls = linhas(ctx, titulo, W - M * 2, 3);
  while (ls.length > (grande ? 2 : 1) && tam > (grande ? 70 : 52)) {
    tam -= 6;
    ctx.font = `800 ${tam}px ${FONTE_ROUND}`;
    ls = linhas(ctx, titulo, W - M * 2, 3);
  }
  for (const l of ls) {
    y += tam * 1.02;
    ctx.fillText(l, M, y);
  }
  y += 56;
  ctx.font = `500 36px ${FONTE}`;
  ctx.fillStyle = BRANCO_2;
  ctx.fillText(cortar(ctx, periodo, W - M * 2), M, y);
  return y + 30;
}

function rodape(ctx: CanvasRenderingContext2D, W: number, H: number, texto: string) {
  ctx.textAlign = 'center';
  ctx.font = `600 30px ${FONTE}`;
  ctx.fillStyle = BRANCO_3;
  ctx.fillText(texto, W / 2, H - 150);
  ctx.textAlign = 'left';
}

function paraBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, falhou) => canvas.toBlob((b) => (b ? ok(b) : falhou(new Error('Não deu para gerar a imagem.'))), 'image/png'));
}

function novaTela(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = TAMANHO_RETRO.w;
  canvas.height = TAMANHO_RETRO.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este aparelho não conseguiu montar a imagem.');
  return { canvas, ctx };
}

/** 1ª imagem: foto, título e os números do ano */
async function imagemResumo(d: DadosImagensRetro): Promise<Blob> {
  const { canvas, ctx } = novaTela();
  const { w: W, h: H } = TAMANHO_RETRO;
  fundo(ctx, W, H, PALETAS.resumo);
  let y = cabecalho(ctx, W, 200, d.titulo, d.periodo, 'Retrospectiva');
  const M = 84;
  // Foto redonda com anel branco
  if (d.foto) {
    const r = d.numeros.length > 4 ? 165 : 200;
    const cx = W / 2;
    const cy = y + 40 + r;
    ctx.save();
    ctx.shadowColor = 'rgb(30 0 40 / 0.35)';
    ctx.shadowBlur = 40;
    ctx.fillStyle = BRANCO;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    fotoCobrindo(ctx, d.foto, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    y = cy + r + 64;
  } else y += 60;
  // Números em cartões (2 colunas)
  const nums = d.numeros.slice(0, 6);
  const gap = 28;
  const cw = (W - M * 2 - gap) / 2;
  const linhasN = Math.ceil(nums.length / 2);
  const espaco = H - 260 - y;
  const ch = Math.min(220, (espaco - gap * (linhasN - 1)) / Math.max(1, linhasN));
  nums.forEach((n, i) => {
    const x = M + (i % 2) * (cw + gap);
    const yy = y + Math.floor(i / 2) * (ch + gap);
    ctx.fillStyle = 'rgb(255 255 255 / 0.16)';
    retanguloRedondo(ctx, x, yy, cw, ch, 36);
    ctx.fill();
    ctx.fillStyle = n.cor;
    ctx.beginPath();
    ctx.arc(x + 44, yy + 50, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = BRANCO_2;
    ctx.font = `700 28px ${FONTE}`;
    ctx.fillText(cortar(ctx, n.rotulo.toUpperCase(), cw - 90), x + 66, yy + 60);
    // O número embaixo do rótulo (nunca por cima): a fonte diminui se o cartão for baixo ou o número largo
    let tam = Math.max(44, Math.min(88, (ch - 104) / 0.78));
    ctx.font = `800 ${tam}px ${FONTE_ROUND}`;
    while (ctx.measureText(n.valor).width > cw - 64 && tam > 44) {
      tam -= 4;
      ctx.font = `800 ${tam}px ${FONTE_ROUND}`;
    }
    ctx.fillStyle = BRANCO;
    ctx.fillText(n.valor, x + 34, yy + 84 + tam * 0.78);
  });
  rodape(ctx, W, H, '💛 Um ano inteirinho de amor');
  return paraBlob(canvas);
}

/** 2ª imagem: crescimento e conquistas */
async function imagemCrescimento(d: DadosImagensRetro): Promise<Blob> {
  const { canvas, ctx } = novaTela();
  const { w: W, h: H } = TAMANHO_RETRO;
  const M = 84;
  fundo(ctx, W, H, PALETAS.crescimento);
  let y = cabecalho(ctx, W, 200, d.titulo, d.periodo, 'Cresceu!', false);
  y += 30;
  for (const c of d.crescimento) {
    ctx.fillStyle = 'rgb(255 255 255 / 0.16)';
    const h = c.detalhe ? 236 : 176;
    retanguloRedondo(ctx, M, y, W - M * 2, h, 40);
    ctx.fill();
    ctx.fillStyle = BRANCO_2;
    ctx.font = `700 30px ${FONTE}`;
    ctx.fillText(c.rotulo.toUpperCase(), M + 44, y + 64);
    ctx.font = `800 80px ${FONTE_ROUND}`;
    const txt = `${c.de}  →  ${c.ate}`;
    let tam = 80;
    while (ctx.measureText(txt).width > W - M * 2 - 88 && tam > 48) {
      tam -= 4;
      ctx.font = `800 ${tam}px ${FONTE_ROUND}`;
    }
    ctx.fillStyle = BRANCO;
    ctx.fillText(txt, M + 44, y + 82 + tam * 0.78);
    if (c.detalhe) {
      ctx.font = `600 34px ${FONTE}`;
      ctx.fillStyle = BRANCO_2;
      ctx.fillText(cortar(ctx, c.detalhe, W - M * 2 - 88), M + 44, y + h - 30);
    }
    y += h + 24;
  }
  if (d.marcos.length) {
    y += 30;
    ctx.fillStyle = BRANCO;
    ctx.font = `800 40px ${FONTE}`;
    ctx.fillText('CONQUISTAS', M, y + 36);
    y += 76;
    const cabem = Math.max(1, Math.floor((H - 250 - y - (d.extras.length ? 80 : 0) - 50) / 82));
    const lista = d.marcos.slice(0, cabem);
    for (const m of lista) {
      ctx.fillStyle = 'rgb(255 255 255 / 0.2)';
      ctx.beginPath();
      ctx.arc(M + 36, y + 36, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `40px ${FONTE}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = BRANCO;
      ctx.fillText(m.emoji, M + 36, y + 51);
      ctx.textAlign = 'left';
      ctx.font = `700 40px ${FONTE}`;
      ctx.fillText(cortar(ctx, m.titulo, W - M * 2 - 110), M + 100, y + 32);
      if (m.idade) {
        ctx.font = `500 30px ${FONTE}`;
        ctx.fillStyle = BRANCO_2;
        ctx.fillText(m.idade, M + 100, y + 72);
      }
      y += 82;
    }
    const resto = d.totalMarcos - lista.length;
    if (resto > 0) {
      ctx.font = `600 32px ${FONTE}`;
      ctx.fillStyle = BRANCO_2;
      ctx.fillText(`e mais ${resto} ${resto === 1 ? 'conquista' : 'conquistas'} ✨`, M + 100, y + 30);
      y += 60;
    }
  }
  if (d.extras.length) {
    y += 30;
    ctx.font = `700 36px ${FONTE}`;
    ctx.fillStyle = BRANCO;
    for (const e of d.extras.slice(0, 2)) {
      ctx.fillText(cortar(ctx, e, W - M * 2), M, y + 36);
      y += 56;
    }
  }
  rodape(ctx, W, H, '💛 Cada conquista, uma festa');
  return paraBlob(canvas);
}

/** 3ª imagem: as fotos do mês em grade, com a idade de cada uma */
async function imagemFotos(d: DadosImagensRetro): Promise<Blob> {
  const { canvas, ctx } = novaTela();
  const { w: W, h: H } = TAMANHO_RETRO;
  const M = 72;
  fundo(ctx, W, H, PALETAS.fotos);
  const y0 = cabecalho(ctx, W, 200, d.titulo, d.periodo, 'Mês a mês', false) + 40;
  const fotos = d.fotos.slice(0, 16);
  const n = fotos.length;
  const cols = n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const linhasF = Math.ceil(n / cols);
  const gap = 18;
  const area = H - 230 - y0;
  const cw = (W - M * 2 - gap * (cols - 1)) / cols;
  const ch = Math.min(cw * 1.25, (area - gap * (linhasF - 1)) / linhasF);
  const altTotal = linhasF * ch + gap * (linhasF - 1);
  const y = y0 + Math.max(0, (area - altTotal) / 2);
  fotos.forEach((f, i) => {
    const x = M + (i % cols) * (cw + gap);
    const yy = y + Math.floor(i / cols) * (ch + gap);
    ctx.save();
    retanguloRedondo(ctx, x, yy, cw, ch, 24);
    ctx.clip();
    const t = tamanhoFonte(f.img);
    const e = encaixeFoto(t.w, t.h, cw, ch);
    // Sem faixas: aqui a foto sempre cobre (são miniaturas)
    if (e.laterais) fotoCobrindo(ctx, f.img, x, yy, cw, ch);
    else ctx.drawImage(f.img, e.sx, e.sy, e.sw, e.sh, x + e.dx, yy + e.dy, e.dw, e.dh);
    const g = ctx.createLinearGradient(0, yy + ch * 0.6, 0, yy + ch);
    g.addColorStop(0, 'rgb(0 0 0 / 0)');
    g.addColorStop(1, 'rgb(0 0 0 / 0.55)');
    ctx.fillStyle = g;
    ctx.fillRect(x, yy, cw, ch);
    ctx.restore();
    ctx.fillStyle = BRANCO;
    ctx.font = `700 ${cols === 4 ? 26 : 32}px ${FONTE}`;
    ctx.fillText(cortar(ctx, f.rotulo, cw - 28), x + 16, yy + ch - 18);
  });
  rodape(ctx, W, H, '💛 Olha como cresceu!');
  return paraBlob(canvas);
}

function nomeArquivo(nome: string, parte: string): string {
  const base = `${nome || 'bebe'}-retrospectiva-${parte}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base}.png`;
}

/** As imagens que fazem sentido (1 a 3), prontas para compartilhar */
export async function gerarImagensRetro(d: DadosImagensRetro): Promise<File[]> {
  try {
    await document.fonts?.ready;
  } catch {
    /* segue com o que tiver */
  }
  const arquivos: File[] = [];
  arquivos.push(new File([await imagemResumo(d)], nomeArquivo(d.nome, '1-resumo'), { type: 'image/png' }));
  if (d.crescimento.length || d.totalMarcos >= 2) arquivos.push(new File([await imagemCrescimento(d)], nomeArquivo(d.nome, '2-conquistas'), { type: 'image/png' }));
  if (d.fotos.length >= 2) arquivos.push(new File([await imagemFotos(d)], nomeArquivo(d.nome, '3-fotos'), { type: 'image/png' }));
  return arquivos;
}
