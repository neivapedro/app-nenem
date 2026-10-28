// Cartão do mesversário em imagem (canvas): foto do mês, nome e idade, peso e altura,
// conquistas do mês e a data. 1080×1350 (feed/WhatsApp) ou 1080×1920 (stories).
// Tema sempre claro e delicado (é para mandar para a família), com as cores do app.

export type FormatoCartao = 'feed' | 'stories';

export const TAMANHO_CARTAO: Record<FormatoCartao, { w: number; h: number }> = {
  feed: { w: 1080, h: 1350 },
  stories: { w: 1080, h: 1920 },
};

export interface DadosCartao {
  /** "Heitor" */
  nome: string;
  /** "2 meses", "1 ano", "Nascimento" */
  idade: string;
  /** "28 de outubro de 2026" */
  data: string;
  /** "4,35 kg" */
  peso?: string | null;
  /** "54 cm" */
  altura?: string | null;
  /** Rótulo do selo do peso quando a medida não é de agora ("Peso ao nascer", "Peso em 28/04"); padrão "Peso" */
  rotuloPeso?: string | null;
  /** Idem para a altura; padrão "Altura" */
  rotuloAltura?: string | null;
  /** Títulos das conquistas do mês */
  marcos: string[];
  /** Rótulo da lista ("Conquistas do mês", "Conquistas do ano") */
  rotuloMarcos?: string;
  /** Foto já decodificada (ver carregarImagem); sem foto = ilustração */
  foto?: CanvasImageSource | null;
  /** Selo sobre a foto ("Mesversário", "Aniversário"); vazio = a idade */
  selo?: string | null;
  /** Menina: o detalhe da ilustração puxa para o rosa; menino: para o azul */
  sexo?: 'M' | 'F' | null;
}

// Cores do app (tema claro): mamada (rosa), sono (lilás), fralda (azul), agenda (verde)
const COR = {
  texto: '#1b1a1f',
  texto2: '#57555e',
  texto3: '#7a7882',
  rosa: '#c62585',
  rosaClaro: '#f63ea9',
  lilas: '#6925d5',
  lilasClaro: '#9b63f4',
  azul: '#1e71bb',
  azulClaro: '#2da0d9',
  verde: '#1c754b',
  fundoA: '#fbf7f2',
  fundoB: '#f7eef5',
};

const FONTE = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const FONTE_ROUND = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/**
 * Baixa a foto e decodifica sem "sujar" o canvas: fetch → blob → createImageBitmap
 * (endereço assinado do Supabase é de outra origem; com <img src> direto o toBlob falharia).
 */
export async function carregarImagem(url: string): Promise<CanvasImageSource | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await decodificar(await r.blob());
  } catch {
    return null;
  }
}

async function decodificar(blob: Blob): Promise<CanvasImageSource | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Safari antigo com alguns JPEG: tenta pela <img>
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

function tamanhoFonte(img: CanvasImageSource): { w: number; h: number } {
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) return { w: img.width, h: img.height };
  if (img instanceof HTMLImageElement) return { w: img.naturalWidth, h: img.naturalHeight };
  if (img instanceof HTMLCanvasElement) return { w: img.width, h: img.height };
  return { w: 1, h: 1 };
}

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

function estrela(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, pontas = 5, interno = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < pontas * 2; i++) {
    const raio = i % 2 ? r * interno : r;
    const a = (Math.PI / pontas) * i - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(a) * raio, cy + Math.sin(a) * raio);
  }
  ctx.closePath();
}

function coracao(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.35);
  ctx.bezierCurveTo(cx - s * 0.9, cy - s * 0.25, cx - s * 0.45, cy - s * 0.95, cx, cy - s * 0.45);
  ctx.bezierCurveTo(cx + s * 0.45, cy - s * 0.95, cx + s * 0.9, cy - s * 0.25, cx, cy + s * 0.35);
  ctx.closePath();
}

/** Texto que cabe na largura: diminui a fonte até um mínimo e, se ainda não couber, corta com "…" */
function caber(ctx: CanvasRenderingContext2D, texto: string, larguraMax: number, peso: string, tam: number, min: number, familia: string): { texto: string; tam: number } {
  let t = tam;
  ctx.font = `${peso} ${t}px ${familia}`;
  while (ctx.measureText(texto).width > larguraMax && t > min) {
    t -= 2;
    ctx.font = `${peso} ${t}px ${familia}`;
  }
  return { texto: cortar(ctx, texto, larguraMax), tam: t };
}

function cortar(ctx: CanvasRenderingContext2D, texto: string, larguraMax: number): string {
  if (ctx.measureText(texto).width <= larguraMax) return texto;
  let s = texto;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > larguraMax) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/** Confete discreto espalhado (posições fixas: o mesmo cartão sai sempre igual) */
function confete(ctx: CanvasRenderingContext2D, zonas: { x0: number; x1: number; y0: number; y1: number }[]) {
  const cores = [COR.rosaClaro, COR.lilasClaro, COR.azulClaro, '#f2b84b'];
  let semente = 7;
  const rnd = () => {
    semente = (semente * 16807) % 2147483647;
    return semente / 2147483647;
  };
  for (let i = 0; i < 46; i++) {
    const z = zonas[i % zonas.length];
    const x = z.x0 + rnd() * (z.x1 - z.x0);
    const y = z.y0 + rnd() * (z.y1 - z.y0);
    ctx.save();
    ctx.globalAlpha = 0.18 + rnd() * 0.22;
    ctx.fillStyle = cores[i % cores.length];
    ctx.translate(x, y);
    ctx.rotate(rnd() * Math.PI);
    const tipo = i % 3;
    if (tipo === 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 5 + rnd() * 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (tipo === 1) {
      retanguloRedondo(ctx, -10, -4, 20, 8, 4);
      ctx.fill();
    } else {
      estrela(ctx, 0, 0, 9 + rnd() * 6);
      ctx.fill();
    }
    ctx.restore();
  }
}

/** Ilustração quando não há foto: carinha de bebê dormindo, lua e estrelas */
function ilustracao(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, sexo?: 'M' | 'F' | null) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#efe6fb');
  g.addColorStop(1, sexo === 'F' ? '#fbe3ef' : '#e3eefb');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const cx = x + w / 2;
  const cy = y + h / 2 + h * 0.02;
  const r = Math.min(w, h) * 0.24;
  // Estrelinhas
  ctx.fillStyle = 'rgb(255 255 255 / 0.9)';
  for (const [dx, dy, s] of [
    [-0.36, -0.3, 22],
    [0.34, -0.34, 16],
    [0.4, 0.22, 20],
    [-0.4, 0.26, 14],
    [-0.18, -0.42, 12],
    [0.2, 0.4, 12],
  ]) {
    estrela(ctx, cx + dx * w, cy + dy * h, s);
    ctx.fill();
  }
  // Lua
  ctx.fillStyle = '#f7d77a';
  ctx.beginPath();
  ctx.arc(cx + r * 1.35, cy - r * 1.05, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = sexo === 'F' ? '#f6e4f2' : '#e9e8fb';
  ctx.beginPath();
  ctx.arc(cx + r * 1.47, cy - r * 1.13, r * 0.27, 0, Math.PI * 2);
  ctx.fill();
  // Rosto
  ctx.fillStyle = '#fde3cf';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Cachinho
  ctx.strokeStyle = '#8a5a3c';
  ctx.lineWidth = r * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx + r * 0.08, cy - r * 0.92, r * 0.16, Math.PI * 0.9, Math.PI * 2.3);
  ctx.stroke();
  // Olhos fechados
  ctx.strokeStyle = '#5b4636';
  ctx.lineWidth = r * 0.06;
  for (const lado of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx + lado * r * 0.36, cy - r * 0.02, r * 0.14, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  // Bochechas
  ctx.fillStyle = 'rgb(246 62 169 / 0.22)';
  for (const lado of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + lado * r * 0.58, cy + r * 0.28, r * 0.17, r * 0.11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Sorriso
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.3, r * 0.16, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
}

/** Parte mínima da altura da foto que fica visível (em pé numa área mais "deitada": sobram faixas laterais) */
const ALTURA_VISIVEL_MIN = 0.64;

/**
 * Como a foto entra na área: preenche (cover) enquanto aparecer pelo menos ALTURA_VISIVEL_MIN da
 * altura; se for preciso cortar mais que isso (foto em pé numa área larga), ela encolhe e as
 * laterais ganham a própria foto desfocada. O recorte vertical puxa para o topo nas fotos em pé
 * (o rosto costuma ficar no terço de cima). Exportada para os testes.
 */
export function encaixeFoto(fw: number, fh: number, w: number, h: number) {
  const cover = Math.max(w / fw, h / fh);
  const contain = Math.min(w / fw, h / fh);
  const escala = Math.max(contain, Math.min(cover, h / (fh * ALTURA_VISIVEL_MIN)));
  const dw = Math.min(w, fw * escala);
  const dh = Math.min(h, fh * escala);
  const sw = dw / escala;
  const sh = dh / escala;
  const emPe = fh > fw * 1.05;
  const sx = (fw - sw) / 2;
  const sy = (fh - sh) * (emPe ? 0.18 : 0.38);
  return { sx, sy, sw, sh, dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh, laterais: dw < w - 1 };
}

/** A própria foto, bem desfocada, cobrindo a área (fundo das laterais). Sem ctx.filter (Safari antigo): reduz e amplia */
function fundoDesfocado(ctx: CanvasRenderingContext2D, img: CanvasImageSource, t: { w: number; h: number }, x: number, y: number, w: number, h: number) {
  const escala = Math.max(w / t.w, h / t.h);
  const sw = w / escala;
  const sh = h / escala;
  // Bem pequenininho (1/28) e depois um meio-termo (1/7): ampliar em dois passos deixa o desfoque liso
  const tela = (div: number) => {
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(w / div));
    c.height = Math.max(2, Math.round(h / div));
    const cx = c.getContext('2d');
    if (cx) {
      cx.imageSmoothingEnabled = true;
      cx.imageSmoothingQuality = 'high';
    }
    return { c, cx };
  };
  const p = tela(28);
  const m = tela(7);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (p.cx && m.cx) {
    p.cx.drawImage(img, (t.w - sw) / 2, (t.h - sh) / 2, sw, sh, 0, 0, p.c.width, p.c.height);
    m.cx.drawImage(p.c, 0, 0, m.c.width, m.c.height);
    ctx.drawImage(m.c, x, y, w, h);
  } else {
    ctx.fillStyle = '#efe6fb';
    ctx.fillRect(x, y, w, h);
  }
  // Véu claro: as laterais ficam suaves e a foto principal se destaca
  ctx.fillStyle = 'rgb(251 247 242 / 0.3)';
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function desenharFoto(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number) {
  const t = tamanhoFonte(img);
  const e = encaixeFoto(t.w, t.h, w, h);
  if (e.laterais) {
    fundoDesfocado(ctx, img, t, x, y, w, h);
    // Sombra leve separando a foto das laterais
    ctx.save();
    ctx.shadowColor = 'rgb(40 20 40 / 0.28)';
    ctx.shadowBlur = 28;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + e.dx, y + e.dy, e.dw, e.dh);
    ctx.restore();
  }
  ctx.drawImage(img, e.sx, e.sy, e.sw, e.sh, x + e.dx, y + e.dy, e.dw, e.dh);
}

/** Selo arredondado com bolinha colorida: "● 4,35 kg" */
function selo(ctx: CanvasRenderingContext2D, x: number, y: number, texto: string, rotulo: string, cor: string, s: number): number {
  const alt = 88 * s;
  ctx.font = `600 ${22 * s}px ${FONTE}`;
  const wr = ctx.measureText(rotulo.toUpperCase()).width;
  ctx.font = `700 ${40 * s}px ${FONTE_ROUND}`;
  const wt = ctx.measureText(texto).width;
  const w = Math.max(wr, wt) + 64 * s;
  ctx.save();
  ctx.shadowColor = 'rgb(60 30 60 / 0.10)';
  ctx.shadowBlur = 18 * s;
  ctx.shadowOffsetY = 4 * s;
  ctx.fillStyle = '#ffffff';
  retanguloRedondo(ctx, x, y, w, alt, 26 * s);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.arc(x + 22 * s, y + 25 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COR.texto3;
  ctx.font = `600 ${22 * s}px ${FONTE}`;
  ctx.fillText(rotulo.toUpperCase(), x + 36 * s, y + 33 * s);
  ctx.fillStyle = COR.texto;
  ctx.font = `700 ${40 * s}px ${FONTE_ROUND}`;
  ctx.fillText(texto, x + 22 * s, y + 74 * s);
  return w;
}

/**
 * Nome e idade: numa linha só ("Heitor · 2 meses") se couber com fonte de pelo menos 54px;
 * senão, o nome em cima (cortado com "…" só se nem assim couber) e a idade embaixo, sempre inteira.
 */
function medirTitulo(ctx: CanvasRenderingContext2D, nome: string, idade: string, largura: number) {
  const linha = `${nome} · ${idade}`;
  const um = caber(ctx, linha, largura, '800', 92, 54, FONTE_ROUND);
  if (um.texto === linha) return { linhas: 1 as const, tam: um.tam, nome, altura: 110 };
  const n = caber(ctx, nome, largura, '800', 84, 50, FONTE_ROUND);
  const i = caber(ctx, idade, largura, '800', n.tam, 44, FONTE_ROUND);
  return { linhas: 2 as const, tam: n.tam, tamIdade: i.tam, nome: n.texto, altura: Math.round(n.tam * 0.92 + i.tam * 1.12 + 30) };
}

/** Desenha o cartão e devolve o PNG */
export async function gerarCartao(dados: DadosCartao, formato: FormatoCartao = 'feed'): Promise<Blob> {
  const { w: W, h: H } = TAMANHO_CARTAO[formato];
  // Espera as fontes do sistema (no iPhone a primeira medida de texto pode vir com a fonte errada)
  try {
    await document.fonts?.ready;
  } catch {
    /* segue com o que tiver */
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este aparelho não conseguiu montar a imagem.');

  const stories = formato === 'stories';
  const M = 72; // margem lateral
  // Stories: deixa livre o topo e o rodapé (onde o Instagram põe o nome e a caixa de resposta)
  const topo = stories ? 220 : 72;
  const baseLivre = stories ? 250 : 64;
  const temMedidas = !!(dados.peso || dados.altura);
  const marcos = dados.marcos.slice(0, stories ? 4 : 3);
  const restantes = dados.marcos.length - marcos.length;

  // Fundo: creme com manchas suaves de rosa, lilás e azul
  const fundo = ctx.createLinearGradient(0, 0, 0, H);
  fundo.addColorStop(0, COR.fundoA);
  fundo.addColorStop(1, COR.fundoB);
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, W, H);
  for (const [cx, cy, r, cor] of [
    [W * 0.95, H * 0.04, W * 0.55, 'rgb(246 62 169 / 0.13)'],
    [W * 0.02, H * 0.6, W * 0.6, 'rgb(155 99 244 / 0.12)'],
    [W * 0.9, H * 0.98, W * 0.5, 'rgb(45 160 217 / 0.10)'],
  ] as const) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, cor);
    g.addColorStop(1, 'rgb(255 255 255 / 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Altura do bloco de texto (para a foto ocupar o resto)
  const nome = dados.nome.trim() || 'Nosso bebê';
  const tit = medirTitulo(ctx, nome, dados.idade, W - M * 2);
  const hTitulo = tit.altura;
  const hData = 54;
  const gapMedidas = 22;
  const hMedidas = temMedidas ? 88 + 32 : 0;
  const hCabMarcos = 50;
  const hLinha = 53;
  const hMarcos = marcos.length ? hCabMarcos + marcos.length * hLinha + (restantes > 0 ? 44 : 0) : 0;
  const gapFoto = 46;
  const blocoTexto = hTitulo + hData + (temMedidas ? gapMedidas : 0) + hMedidas + (marcos.length ? 8 : 0) + hMarcos;
  const fotoW = W - M * 2;
  const fotoH = Math.max(stories ? 760 : 480, H - topo - baseLivre - gapFoto - blocoTexto);
  const fotoX = M;
  const fotoY = topo;


  // Moldura da foto (branca, com sombra) e a foto ou a ilustração
  const borda = 16;
  ctx.save();
  ctx.shadowColor = 'rgb(60 30 60 / 0.16)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#ffffff';
  retanguloRedondo(ctx, fotoX - borda, fotoY - borda, fotoW + borda * 2, fotoH + borda * 2, 52);
  ctx.fill();
  ctx.restore();
  ctx.save();
  retanguloRedondo(ctx, fotoX, fotoY, fotoW, fotoH, 38);
  ctx.clip();
  if (dados.foto) desenharFoto(ctx, dados.foto, fotoX, fotoY, fotoW, fotoH);
  else ilustracao(ctx, fotoX, fotoY, fotoW, fotoH, dados.sexo);
  ctx.restore();

  // Selo da idade sobre o canto da foto
  {
    const txt = dados.selo ?? dados.idade;
    ctx.font = `800 40px ${FONTE_ROUND}`;
    const tw = ctx.measureText(txt).width;
    const bw = tw + 76;
    const bx = fotoX + fotoW - bw - 26;
    const by = fotoY + fotoH - 92;
    ctx.save();
    ctx.shadowColor = 'rgb(105 37 213 / 0.35)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    const g = ctx.createLinearGradient(bx, by, bx + bw, by + 68);
    g.addColorStop(0, COR.lilas);
    g.addColorStop(1, COR.rosa);
    ctx.fillStyle = g;
    retanguloRedondo(ctx, bx, by, bw, 68, 34);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    estrela(ctx, bx + 32, by + 34, 12);
    ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, bx + 54, by + 36);
    ctx.textBaseline = 'alphabetic';
  }

  // Textos
  let y = fotoY + fotoH + gapFoto;
  ctx.textAlign = 'left';
  {
    // Nome em tinta escura, idade em degradê lilás → rosa
    const idadeEm = (px: number, base: number, tam: number) => {
      ctx.font = `800 ${tam}px ${FONTE_ROUND}`;
      const iw = ctx.measureText(dados.idade).width;
      const g = ctx.createLinearGradient(px, 0, px + iw, 0);
      g.addColorStop(0, COR.lilas);
      g.addColorStop(1, COR.rosa);
      ctx.fillStyle = g;
      ctx.fillText(dados.idade, px, base);
    };
    ctx.font = `800 ${tit.tam}px ${FONTE_ROUND}`;
    const base = y + tit.tam * 0.92;
    ctx.fillStyle = COR.texto;
    if (tit.linhas === 1) {
      const prefixo = `${nome} · `;
      ctx.fillText(prefixo, M, base);
      idadeEm(M + ctx.measureText(prefixo).width, base, tit.tam);
    } else {
      ctx.fillText(tit.nome, M, base);
      idadeEm(M, base + tit.tamIdade * 1.12, tit.tamIdade);
    }
    y += hTitulo;
  }
  ctx.fillStyle = COR.texto2;
  ctx.font = `500 36px ${FONTE}`;
  ctx.fillText(cortar(ctx, dados.data, W - M * 2 - 60), M, y + 30);
  coracao(ctx, Math.min(W - M - 20, M + ctx.measureText(dados.data).width + 34), y + 22, 26);
  ctx.fillStyle = COR.rosaClaro;
  ctx.fill();
  y += hData;

  if (temMedidas) {
    y += gapMedidas;
    let x = M;
    if (dados.peso) x += selo(ctx, x, y, dados.peso, dados.rotuloPeso || 'Peso', COR.rosaClaro, 1) + 20;
    if (dados.altura) selo(ctx, x, y, dados.altura, dados.rotuloAltura || 'Altura', COR.azulClaro, 1);
    y += hMedidas;
  }

  if (marcos.length) {
    y += 8;
    ctx.fillStyle = COR.lilas;
    ctx.font = `700 26px ${FONTE}`;
    ctx.fillText((dados.rotuloMarcos ?? 'Conquistas do mês').toUpperCase(), M, y + 26);
    y += hCabMarcos;
    for (const [i, t] of marcos.entries()) {
      ctx.fillStyle = [COR.rosaClaro, COR.lilasClaro, COR.azulClaro, '#f2b84b'][i % 4];
      estrela(ctx, M + 16, y + 22, 15);
      ctx.fill();
      ctx.fillStyle = COR.texto;
      ctx.font = `500 38px ${FONTE}`;
      ctx.fillText(cortar(ctx, t, W - M * 2 - 52), M + 48, y + 35);
      y += hLinha;
    }
    if (restantes > 0) {
      ctx.fillStyle = COR.texto3;
      ctx.font = `500 32px ${FONTE}`;
      ctx.fillText(`e mais ${restantes} ${restantes === 1 ? 'conquista' : 'conquistas'}`, M + 48, y + 30);
    }
  }

  // Confete só nas bordas (nunca por cima da foto ou dos textos)
  const fimTexto = Math.min(H, y + 60);
  confete(ctx, [
    { x0: 0, x1: W, y0: 0, y1: fotoY - borda - 14 },
    { x0: W - M + 12, x1: W, y0: fotoY + fotoH + borda + 20, y1: H },
    { x0: 0, x1: M - 24, y0: fotoY + fotoH + borda + 20, y1: H },
    { x0: 0, x1: W, y0: fimTexto, y1: H },
  ]);

  return await new Promise<Blob>((ok, falhou) =>
    canvas.toBlob((b) => (b ? ok(b) : falhou(new Error('Não deu para gerar a imagem.'))), 'image/png'),
  );
}

/** Nome do arquivo: "heitor-2-meses.png" */
export function nomeArquivoCartao(nome: string, idade: string, formato: FormatoCartao): string {
  const base = `${nome || 'bebe'}-${idade}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base}${formato === 'stories' ? '-stories' : ''}.png`;
}
