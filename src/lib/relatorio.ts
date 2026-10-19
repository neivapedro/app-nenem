// Relatório em PDF para levar ao pediatra (carregado só quando pedido).
import { jsPDF } from 'jspdf';
import { autoTable, type RowInput } from 'jspdf-autotable';

type Rgb = [number, number, number];

export interface KpiPdf {
  rotulo: string;
  valor: string;
  /** Ex.: "+4% vs 7 dias antes" (null = sem comparação) */
  delta: string | null;
  detalhe?: string;
  cor: Rgb;
  /** Valores de cada dia (minigráfico) */
  serie?: number[];
}

export interface GraficoPdf {
  titulo: string;
  nota?: string;
  rotulos: string[];
  series: { nome: string; cor: Rgb; valores: number[] }[];
  media?: { valor: number; texto: string };
  formatarEixo: (v: number) => string;
}

export interface MapaPdf {
  titulo: string;
  linhas: string[];
  matriz: number[][];
  cor: Rgb;
}

export interface PainelPdf {
  comparacao: string;
  kpis: KpiPdf[];
  graficos: GraficoPdf[];
  mapas: MapaPdf[];
  /** Ex.: lado do peito */
  proporcao?: { titulo: string; partes: { nome: string; valor: number; texto: string; cor: Rgb }[] };
}

export interface ModeloRelatorio {
  titulo: string;
  subtitulo: string;
  periodo: string;
  destaques: [string, string][];
  /** Página de painel com indicadores e gráficos */
  painel?: PainelPdf;
  /** Tabela do resumo: por dia (períodos curtos) ou por mês (longos) */
  resumo: { titulo: string; cabecalho: string[]; linhas: RowInput[] };
  medidas: RowInput[];
  vacinasAplicadas: RowInput[];
  vacinasPendentes: RowInput[];
  remedios: RowInput[];
  temperaturas: RowInput[];
  observacoes: RowInput[];
  geradoEm: string;
}

const CINZA: Rgb = [110, 110, 115];
const TEXTO: Rgb = [28, 28, 32];
const LINHA: Rgb = [226, 225, 222];
const FUNDO: Rgb = [247, 246, 243];
const LARGURA = 182;

/** Teto "redondo" do eixo e o passo das linhas de grade */
function escala(max: number): { teto: number; passo: number } {
  if (!(max > 0)) return { teto: 1, passo: 0.5 };
  const bruto = max / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((k) => k * pot).find((p) => p >= bruto) ?? 10 * pot;
  return { teto: Math.ceil(max / passo) * passo, passo };
}

/** Mistura a cor com o branco (t = 0 branco, 1 cor cheia) */
const clarear = (c: Rgb, t: number): Rgb => c.map((v) => Math.round(255 - (255 - v) * t)) as Rgb;

function cartao(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(...LINHA);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.25);
  doc.roundedRect(x, y, w, h, 2.5, 2.5, 'FD');
}

function legenda(doc: jsPDF, x: number, y: number, itens: { nome: string; cor: Rgb; linha?: boolean }[]) {
  doc.setFontSize(7.5);
  doc.setTextColor(...CINZA);
  for (const it of itens) {
    if (it.linha) {
      doc.setDrawColor(...CINZA);
      doc.setLineWidth(0.5);
      doc.line(x, y - 1, x + 3.5, y - 1);
    } else {
      doc.setFillColor(...it.cor);
      doc.roundedRect(x, y - 2.4, 2.6, 2.6, 0.6, 0.6, 'F');
    }
    doc.text(it.nome, x + 4.4, y);
    x += 4.4 + doc.getTextWidth(it.nome) + 4;
  }
}

function desenharKpi(doc: jsPDF, k: KpiPdf, x: number, y: number, w: number, h: number) {
  cartao(doc, x, y, w, h);
  doc.setFillColor(...k.cor);
  doc.circle(x + 4.2, y + 5, 0.9, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...CINZA);
  doc.text(k.rotulo, x + 6.2, y + 5.9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...TEXTO);
  doc.text(k.valor, x + 3.5, y + 13.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...CINZA);
  const rodape = [k.delta, k.detalhe].filter(Boolean).join(' · ');
  if (rodape) doc.text(rodape, x + 3.5, y + h - 3);
  // Minigráfico à direita do valor
  const pts = k.serie && k.serie.length > 1 ? k.serie : null;
  if (pts) {
    const max = Math.max(...pts, 1e-9);
    const sx = x + w - 25;
    const sw = 21;
    const sy = y + 8;
    const sh = 7;
    doc.setDrawColor(...k.cor);
    doc.setLineWidth(0.45);
    for (let i = 1; i < pts.length; i++) {
      doc.line(sx + ((i - 1) / (pts.length - 1)) * sw, sy + sh - (pts[i - 1] / max) * sh, sx + (i / (pts.length - 1)) * sw, sy + sh - (pts[i] / max) * sh);
    }
  }
}

function desenharGrafico(doc: jsPDF, g: GraficoPdf, x: number, y: number, w: number, h: number) {
  cartao(doc, x, y, w, h);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXTO);
  doc.text(g.titulo, x + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  if (g.nota) {
    doc.setFontSize(7);
    doc.setTextColor(...CINZA);
    doc.text(g.nota, x + w - 4, y + 6, { align: 'right' });
  }
  legenda(doc, x + 4, y + 11, [...(g.series.length > 1 ? g.series : []), ...(g.media ? [{ nome: g.media.texto, cor: CINZA, linha: true }] : [])]);

  const n = g.rotulos.length;
  const totais = g.rotulos.map((_, i) => g.series.reduce((s, se) => s + (se.valores[i] ?? 0), 0));
  const { teto, passo } = escala(Math.max(...totais, g.media?.valor ?? 0));
  const ex = x + 12;
  const ew = w - 16;
  const ey = y + 15;
  const eh = h - 23;
  const base = ey + eh;
  // Grade
  doc.setFontSize(6.5);
  doc.setLineWidth(0.15);
  for (let v = 0; v <= teto + 1e-9; v += passo) {
    const yy = base - (v / teto) * eh;
    doc.setDrawColor(...LINHA);
    doc.line(ex, yy, ex + ew, yy);
    doc.setTextColor(...CINZA);
    doc.text(g.formatarEixo(v), ex - 1.5, yy + 0.9, { align: 'right' });
  }
  if (!n) return;
  const slot = ew / n;
  const bw = Math.min(6, slot * 0.68);
  for (let i = 0; i < n; i++) {
    let topo = base;
    const bx = ex + slot * i + (slot - bw) / 2;
    g.series.forEach((se, k) => {
      const v = se.valores[i] ?? 0;
      if (v <= 0) return;
      const alt = (v / teto) * eh;
      // 0,3 mm de folga branca entre as partes da coluna
      const folga = k > 0 && topo < base ? 0.3 : 0;
      doc.setFillColor(...se.cor);
      doc.rect(bx, topo - alt + folga, bw, Math.max(0.2, alt - folga), 'F');
      topo -= alt;
    });
  }
  if (g.media && g.media.valor > 0) {
    const yy = base - (g.media.valor / teto) * eh;
    doc.setDrawColor(...CINZA);
    doc.setLineWidth(0.4);
    doc.line(ex, yy, ex + ew, yy);
  }
  // Rótulos: no máximo uns 10, espaçados
  const cada = Math.max(1, Math.ceil(n / 10));
  doc.setTextColor(...CINZA);
  doc.setFontSize(6.3);
  for (let i = 0; i < n; i++) {
    if ((n - 1 - i) % cada) continue;
    doc.text(g.rotulos[i], ex + slot * i + slot / 2, base + 3.6, { align: 'center' });
  }
}

function desenharMapa(doc: jsPDF, m: MapaPdf, x: number, y: number, w: number, h: number) {
  cartao(doc, x, y, w, h);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...TEXTO);
  doc.text(m.titulo, x + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  const lx = x + 15;
  const cw = (w - 19) / 24;
  const linhas = Math.max(1, m.linhas.length);
  const ch = Math.min(3.6, (h - 22) / linhas);
  const y0 = y + 12;
  const max = Math.max(...m.matriz.flat(), 1e-9);
  doc.setFontSize(6);
  doc.setTextColor(...CINZA);
  for (const hr of [0, 6, 12, 18]) doc.text(`${hr}h`, lx + cw * hr, y0 - 1.2);
  m.matriz.forEach((linha, r) => {
    doc.setTextColor(...CINZA);
    doc.text(m.linhas[r], lx - 1.5, y0 + ch * r + ch * 0.75, { align: 'right' });
    linha.forEach((v, c) => {
      const t = v > 0 ? [0.18, 0.36, 0.56, 0.78, 1][Math.min(4, Math.floor((v / max) * 5 - 1e-9))] : 0;
      doc.setFillColor(...(t ? clarear(m.cor, t) : FUNDO));
      doc.roundedRect(lx + cw * c + 0.2, y0 + ch * r + 0.2, cw - 0.4, ch - 0.4, 0.4, 0.4, 'F');
    });
  });
  // Escala
  const ly = y + h - 4;
  doc.setFontSize(6.3);
  doc.setTextColor(...CINZA);
  doc.text('menos', lx, ly);
  let sx = lx + doc.getTextWidth('menos') + 1.5;
  for (const t of [0.18, 0.36, 0.56, 0.78, 1]) {
    doc.setFillColor(...clarear(m.cor, t));
    doc.roundedRect(sx, ly - 2.3, 2.6, 2.6, 0.4, 0.4, 'F');
    sx += 3.1;
  }
  doc.text('mais', sx + 0.8, ly);
}

function desenharProporcao(doc: jsPDF, p: NonNullable<PainelPdf['proporcao']>, x: number, y: number, w: number) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXTO);
  doc.text(p.titulo, x, y);
  doc.setFont('helvetica', 'normal');
  const total = p.partes.reduce((s, q) => s + q.valor, 0) || 1;
  let bx = x;
  p.partes.forEach((q, i) => {
    const bw = (q.valor / total) * w;
    doc.setFillColor(...q.cor);
    doc.rect(bx, y + 2, Math.max(0, bw - (i < p.partes.length - 1 ? 0.4 : 0)), 3, 'F');
    bx += bw;
  });
  legenda(
    doc,
    x,
    y + 9.5,
    p.partes.map((q) => ({ nome: q.texto, cor: q.cor })),
  );
}

/** Página 1: indicadores, colunas por dia e mapa de horários */
function desenharPainel(doc: jsPDF, pn: PainelPdf, margem: number, y0: number): number {
  let y = y0;
  doc.setFontSize(7.5);
  doc.setTextColor(...CINZA);
  doc.text(pn.comparacao, margem, y);
  y += 3;
  const cols = 3;
  const gap = 4;
  const kw = (LARGURA - gap * (cols - 1)) / cols;
  const kh = 21;
  pn.kpis.forEach((k, i) => desenharKpi(doc, k, margem + (kw + gap) * (i % cols), y + (kh + gap) * Math.floor(i / cols), kw, kh));
  y += Math.ceil(pn.kpis.length / cols) * (kh + gap) + 1;

  const gw = (LARGURA - gap) / 2;
  const gh = 54;
  pn.graficos.forEach((g, i) => {
    if (i % 2 === 0 && i > 0) y += gh + gap;
    desenharGrafico(doc, g, margem + (gw + gap) * (i % 2), y, gw, gh);
  });
  // Lado do peito no espaço livre, quando o número de gráficos é ímpar
  const sobra = pn.graficos.length % 2 === 1;
  if (pn.proporcao && sobra) {
    const px = margem + gw + gap;
    cartao(doc, px, y, gw, gh);
    desenharProporcao(doc, pn.proporcao, px + 4, y + 7, gw - 8);
  }
  y += gh + gap;
  if (pn.proporcao && !sobra) {
    desenharProporcao(doc, pn.proporcao, margem, y + 3, LARGURA);
    y += 15;
  }
  if (pn.mapas.length) {
    const mh = Math.min(70, 286 - y - 4);
    pn.mapas.slice(0, 2).forEach((m, i) => desenharMapa(doc, m, margem + (gw + gap) * i, y, gw, mh));
    y += mh + gap;
  }
  return y;
}

export function gerarRelatorioPdf(m: ModeloRelatorio): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margem = 14;
  let y = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(m.titulo, margem, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...CINZA);
  doc.text(m.subtitulo, margem, y);
  y += 5;
  doc.text(m.periodo, margem, y);
  doc.setTextColor(0, 0, 0);
  y += 6;

  if (m.painel) {
    desenharPainel(doc, m.painel, margem, y);
    // As tabelas começam na página seguinte
    doc.addPage();
    y = 16;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Indicadores do período', margem, y);
    doc.setFont('helvetica', 'normal');
    y += 2;
  }

  autoTable(doc, {
    startY: y,
    body: m.destaques.map(([a, b]) => [a, b]),
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.5 },
    columnStyles: { 0: { textColor: CINZA, cellWidth: 70 }, 1: { fontStyle: 'bold' } },
    margin: { left: margem, right: margem },
  });

  const secao = (titulo: string, cabecalho: string[], linhas: RowInput[], vazio: string) => {
    const docComTabela = doc as unknown as { lastAutoTable?: { finalY: number } };
    let inicio = (docComTabela.lastAutoTable?.finalY ?? y) + 8;
    if (inicio > 265) {
      doc.addPage();
      inicio = 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(titulo, margem, inicio);
    doc.setFont('helvetica', 'normal');
    if (!linhas.length) {
      doc.setFontSize(9);
      doc.setTextColor(...CINZA);
      doc.text(vazio, margem, inicio + 5);
      doc.setTextColor(0, 0, 0);
      autoTable(doc, { startY: inicio + 6, body: [], margin: { left: margem, right: margem } });
      return;
    }
    autoTable(doc, {
      startY: inicio + 2,
      head: [cabecalho],
      body: linhas,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 1.6, lineColor: [220, 220, 224], lineWidth: 0.2 },
      headStyles: { fillColor: [244, 243, 241], textColor: [40, 40, 45], fontStyle: 'bold' },
      margin: { left: margem, right: margem },
    });
  };

  secao(m.resumo.titulo, m.resumo.cabecalho, m.resumo.linhas, 'Sem registros no período.');
  secao('Crescimento (percentis da OMS)', ['Data', 'Idade', 'Peso', 'Comprimento', 'Perímetro cefálico'], m.medidas, 'Sem medidas registradas.');
  secao('Vacinas aplicadas', ['Data', 'Vacina', 'Dose', 'Onde'], m.vacinasAplicadas, 'Nenhuma vacina marcada no app.');
  secao('Próximas vacinas e atrasadas', ['A partir de', 'Vacina', 'Dose', 'Situação'], m.vacinasPendentes, 'Nenhuma pendência.');
  secao('Remédios (doses no período)', ['Quando', 'Remédio', 'Dose'], m.remedios, 'Nenhum remédio registrado no período.');
  secao('Temperaturas', ['Quando', 'Temperatura', 'Observação'], m.temperaturas, 'Nenhuma medição no período.');
  secao('Observações anotadas', ['Quando', 'Registro', 'Observação'], m.observacoes, 'Nenhuma observação no período.');

  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text(`Gerado pelo app Heitor em ${m.geradoEm} · página ${p} de ${paginas}`, margem, 290);
  }
  return doc.output('blob');
}
