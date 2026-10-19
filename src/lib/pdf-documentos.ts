// Junta documentos (fotos e PDFs) num PDF só, com capa e índice opcionais.
// Carregado só quando alguém exporta (pdf-lib não entra no carregamento do app).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export interface ArquivoParaPdf {
  nome: string;
  tipo: string;
  bytes: ArrayBuffer;
}

export interface DocParaPdf {
  titulo: string;
  categoria: string;
  numero: string | null;
  /** Já no formato dd/mm/aaaa */
  data: string | null;
  validade: string | null;
  observacao: string | null;
  arquivos: ArquivoParaPdf[];
}

export interface Capa {
  titulo: string;
  subtitulo: string;
  geradoEm: string;
}

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 36;
const CINZA = rgb(0.42, 0.42, 0.45);
const ESCURO = rgb(0.1, 0.1, 0.12);
const LINHAS_INDICE_1 = 24;
const LINHAS_INDICE_N = 28;

/** As fontes padrão do PDF só têm o alfabeto latino: o resto vira "?" */
function limpador(fonte: PDFFont) {
  const cache = new Map<string, string>();
  return (s: string) =>
    [...s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/→/g, '->')]
      .map((c) => {
        let ok = cache.get(c);
        if (ok === undefined) {
          try {
            fonte.encodeText(c);
            ok = c;
          } catch {
            ok = c.trim() ? '?' : ' ';
          }
          cache.set(c, ok);
        }
        return ok;
      })
      .join('');
}

function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split(/\n/)) {
    let atual = '';
    for (const palavra of paragrafo.split(/\s+/)) {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(teste, tamanho) > largura && atual) {
        linhas.push(atual);
        atual = palavra;
      } else atual = teste;
    }
    linhas.push(atual);
  }
  return linhas;
}

function cortar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string {
  if (fonte.widthOfTextAtSize(texto, tamanho) <= largura) return texto;
  let t = texto;
  while (t.length > 1 && fonte.widthOfTextAtSize(`${t}...`, tamanho) > largura) t = t.slice(0, -1);
  return `${t}...`;
}

function detalhes(d: DocParaPdf): string {
  return [d.numero && `Nº ${d.numero}`, d.data && `Data: ${d.data}`, d.validade && `Validade: ${d.validade}`].filter(Boolean).join('   ·   ');
}

/** Monta o PDF. `avisos` lista arquivos que não puderam entrar (ex.: PDF protegido por senha). */
export async function montarPdfDocumentos(docs: DocParaPdf[], capa: Capa | null): Promise<{ bytes: Uint8Array; avisos: string[] }> {
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const limpo = limpador(fonte);
  const avisos: string[] = [];
  const largura = A4[0] - MARGEM * 2;

  const cabecalho = (pagina: PDFPage, texto: string) => {
    pagina.drawText(cortar(limpo(texto), fonte, 8, largura), { x: MARGEM, y: A4[1] - 22, size: 8, font: fonte, color: CINZA });
  };

  const paginaDeAviso = (titulo: string, linhas: string[]) => {
    const p = pdf.addPage(A4);
    let y = A4[1] - MARGEM - 20;
    p.drawText(cortar(limpo(titulo), negrito, 16, largura), { x: MARGEM, y, size: 16, font: negrito, color: ESCURO });
    y -= 26;
    for (const l of linhas.flatMap((t) => quebrar(limpo(t), fonte, 11, largura))) {
      p.drawText(l, { x: MARGEM, y, size: 11, font: fonte, color: ESCURO });
      y -= 16;
      if (y < MARGEM) break;
    }
    return p;
  };

  // Páginas da capa/índice: calculadas antes para numerar certo
  const paginasIndice = capa ? 1 + Math.max(0, Math.ceil((docs.length - LINHAS_INDICE_1) / LINHAS_INDICE_N)) : 0;
  const inicio: number[] = [];

  for (const d of docs) {
    inicio.push(pdf.getPageCount() + paginasIndice + 1);
    const extra = detalhes(d);
    if (!d.arquivos.length) {
      paginaDeAviso(d.titulo, [d.categoria, extra, d.observacao ?? '', '(Sem arquivo anexado: só os dados.)'].filter(Boolean));
      continue;
    }
    let n = 0;
    const total = d.arquivos.length;
    for (const a of d.arquivos) {
      n++;
      const rotulo = `${d.titulo}${total > 1 ? `  (${n} de ${total})` : ''}${extra ? `   ·   ${extra}` : ''}`;
      try {
        if (a.tipo === 'application/pdf') {
          const origem = await PDFDocument.load(a.bytes, { ignoreEncryption: true });
          const paginas = await pdf.copyPages(origem, origem.getPageIndices());
          for (const p of paginas) pdf.addPage(p);
        } else {
          const img = a.tipo === 'image/png' ? await pdf.embedPng(a.bytes) : await pdf.embedJpg(a.bytes);
          // Foto deitada vai numa página deitada
          const deitada = img.width > img.height;
          const tam: [number, number] = deitada ? [A4[1], A4[0]] : A4;
          const p = pdf.addPage(tam);
          const caixaW = tam[0] - MARGEM * 2;
          const caixaH = tam[1] - MARGEM * 2 - 10;
          const escala = Math.min(caixaW / img.width, caixaH / img.height);
          const w = img.width * escala;
          const h = img.height * escala;
          p.drawImage(img, { x: (tam[0] - w) / 2, y: MARGEM + (caixaH - h) / 2, width: w, height: h });
          p.drawText(cortar(limpo(rotulo), fonte, 8, caixaW), { x: MARGEM, y: tam[1] - 22, size: 8, font: fonte, color: CINZA });
        }
      } catch {
        avisos.push(`${d.titulo}: o arquivo "${a.nome}" não pôde entrar no PDF (pode estar protegido por senha ou danificado).`);
        const p = paginaDeAviso(d.titulo, [`O arquivo "${a.nome}" não pôde ser incluído aqui (pode estar protegido por senha ou danificado).`, 'Abra o documento no app Heitor para ver o original.']);
        cabecalho(p, rotulo);
      }
    }
  }

  if (capa) {
    for (let i = 0; i < paginasIndice; i++) {
      const p = pdf.insertPage(i, A4);
      let y = A4[1] - MARGEM - 10;
      if (i === 0) {
        p.drawText(cortar(limpo(capa.titulo), negrito, 24, largura), { x: MARGEM, y: y - 14, size: 24, font: negrito, color: ESCURO });
        y -= 44;
        p.drawText(cortar(limpo(capa.subtitulo), fonte, 11, largura), { x: MARGEM, y, size: 11, font: fonte, color: CINZA });
        y -= 34;
        p.drawText('Documentos', { x: MARGEM, y, size: 13, font: negrito, color: ESCURO });
        y -= 22;
      }
      const de = i === 0 ? 0 : LINHAS_INDICE_1 + (i - 1) * LINHAS_INDICE_N;
      const ate = i === 0 ? LINHAS_INDICE_1 : de + LINHAS_INDICE_N;
      docs.slice(de, ate).forEach((d, j) => {
        const k = de + j;
        const pag = `p. ${inicio[k]}`;
        const wPag = fonte.widthOfTextAtSize(pag, 10);
        p.drawText(cortar(limpo(d.titulo), negrito, 10.5, largura - wPag - 16), { x: MARGEM, y, size: 10.5, font: negrito, color: ESCURO });
        p.drawText(pag, { x: A4[0] - MARGEM - wPag, y, size: 10, font: fonte, color: CINZA });
        const sub = [d.categoria, detalhes(d)].filter(Boolean).join('   ·   ');
        p.drawText(cortar(limpo(sub), fonte, 8.5, largura - wPag - 16), { x: MARGEM, y: y - 12, size: 8.5, font: fonte, color: CINZA });
        y -= 26;
      });
      p.drawText(limpo(`Gerado pelo app Heitor em ${capa.geradoEm}`), { x: MARGEM, y: MARGEM - 12, size: 8, font: fonte, color: CINZA });
    }
  }

  pdf.setTitle(capa?.titulo ?? docs[0]?.titulo ?? 'Documentos');
  pdf.setCreator('App Heitor');
  return { bytes: await pdf.save(), avisos };
}

// ---------- Cópia em tamanho real ----------

/** Milímetros para pontos do PDF */
const mm = (v: number) => (v * 72) / 25.4;

export type FormatoCopiaPdf = 'cartao' | 'meia' | 'folha';

/**
 * Frente e verso (ou mais páginas) no tamanho do documento físico, para imprimir
 * como cópia: cartão = 8,6 × 5,4 cm (com linha de corte), meia folha ou folha A4.
 */
export async function montarCopiaTamanhoReal(imagens: ArquivoParaPdf[], formato: FormatoCopiaPdf, rotulo: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const limpo = limpador(fonte);
  const embutidas = [];
  for (const a of imagens) {
    if (a.tipo === 'application/pdf') continue;
    embutidas.push(a.tipo === 'image/png' ? await pdf.embedPng(a.bytes) : await pdf.embedJpg(a.bytes));
  }
  if (!embutidas.length) throw new Error('A cópia em tamanho real é feita a partir de fotos.');

  if (formato === 'folha') {
    for (const img of embutidas) {
      const p = pdf.addPage(A4);
      const caixaW = A4[0] - MARGEM * 2;
      const caixaH = A4[1] - MARGEM * 2;
      const k = Math.min(caixaW / img.width, caixaH / img.height);
      p.drawImage(img, { x: (A4[0] - img.width * k) / 2, y: (A4[1] - img.height * k) / 2, width: img.width * k, height: img.height * k });
    }
  } else {
    // Caixa de cada página do documento: cartão deitado (ou em pé, se a foto for em pé) ou meia folha
    // Meia folha: duas por folha A4 (descontadas margens, cabeçalho e o espaço entre elas)
    const meia = (A4[1] - MARGEM * 3 - 14) / 2;
    const caixa = (deitada: boolean): [number, number] =>
      formato === 'cartao' ? (deitada ? [mm(85.6), mm(54)] : [mm(54), mm(85.6)]) : deitada ? [A4[0] - MARGEM * 2, meia] : [meia * 0.707, meia];
    const espaco = formato === 'cartao' ? mm(12) : MARGEM;
    let p: PDFPage | null = null;
    let y = 0;
    for (const img of embutidas) {
      const [cw, ch] = caixa(img.width >= img.height);
      if (!p || y - ch < MARGEM - 0.5) {
        p = pdf.addPage(A4);
        p.drawText(cortar(limpo(`Cópia · ${rotulo}${formato === 'cartao' ? ' · tamanho real (8,6 × 5,4 cm): imprima em 100%, sem ajustar à página' : ''}`), fonte, 8, A4[0] - MARGEM * 2), {
          x: MARGEM,
          y: A4[1] - 24,
          size: 8,
          font: fonte,
          color: CINZA,
        });
        y = A4[1] - MARGEM - 14;
      }
      const x = (A4[0] - cw) / 2;
      const k = Math.min(cw / img.width, ch / img.height);
      const w = img.width * k;
      const h = img.height * k;
      p.drawImage(img, { x: x + (cw - w) / 2, y: y - ch + (ch - h) / 2, width: w, height: h });
      // Linha de corte
      p.drawRectangle({ x, y: y - ch, width: cw, height: ch, borderColor: CINZA, borderWidth: 0.5, borderDashArray: [3, 3] });
      y -= ch + espaco;
    }
  }
  pdf.setTitle(`Cópia – ${rotulo}`);
  pdf.setCreator('App Heitor');
  return pdf.save();
}

// ---------- Comprovante de vacinação ----------

export interface CarteiraVacinacaoPdf {
  nome: string;
  nascimento: string | null;
  calendario: string;
  identificacao: [string, string][];
  aplicadas: [string, string, string, string][];
  pendentes: [string, string, string, string][];
  geradoEm: string;
}

/** Tabela simples: cabeçalho e linhas, quebrando de página quando precisa */
function tabela(pdf: PDFDocument, estado: { p: PDFPage; y: number }, fontes: { n: PDFFont; b: PDFFont }, colunas: { titulo: string; largura: number }[], linhas: string[][], limpo: (s: string) => string) {
  const x0 = MARGEM;
  const alturaLinha = 15;
  const cab = () => {
    let x = x0;
    for (const c of colunas) {
      estado.p.drawText(limpo(c.titulo), { x, y: estado.y, size: 8.5, font: fontes.b, color: CINZA });
      x += c.largura;
    }
    estado.y -= 6;
    estado.p.drawLine({ start: { x: x0, y: estado.y }, end: { x: A4[0] - MARGEM, y: estado.y }, thickness: 0.5, color: CINZA });
    estado.y -= 11;
  };
  cab();
  for (const l of linhas) {
    if (estado.y < MARGEM + 20) {
      estado.p = pdf.addPage(A4);
      estado.y = A4[1] - MARGEM - 10;
      cab();
    }
    let x = x0;
    l.forEach((v, i) => {
      estado.p.drawText(cortar(limpo(v), fontes.n, 9, colunas[i].largura - 6), { x, y: estado.y, size: 9, font: fontes.n, color: ESCURO });
      x += colunas[i].largura;
    });
    estado.y -= alturaLinha;
  }
}

export async function montarCarteiraVacinacao(m: CarteiraVacinacaoPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const n = await pdf.embedFont(StandardFonts.Helvetica);
  const b = await pdf.embedFont(StandardFonts.HelveticaBold);
  const limpo = limpador(n);
  const p = pdf.addPage(A4);
  const estado = { p, y: A4[1] - MARGEM - 14 };
  p.drawText(limpo('Comprovante de vacinação'), { x: MARGEM, y: estado.y, size: 20, font: b, color: ESCURO });
  estado.y -= 26;
  p.drawText(cortar(limpo(m.nome), b, 13, A4[0] - MARGEM * 2), { x: MARGEM, y: estado.y, size: 13, font: b, color: ESCURO });
  estado.y -= 18;
  const info = [m.nascimento && `Nascimento: ${m.nascimento}`, `Calendário: ${m.calendario}`, ...m.identificacao.map(([k, v]) => `${k}: ${v}`)].filter(Boolean) as string[];
  for (const l of info) {
    p.drawText(cortar(limpo(l), n, 10, A4[0] - MARGEM * 2), { x: MARGEM, y: estado.y, size: 10, font: n, color: ESCURO });
    estado.y -= 14;
  }
  estado.y -= 12;
  const largura = A4[0] - MARGEM * 2;
  const cols = [
    { titulo: 'Data', largura: largura * 0.14 },
    { titulo: 'Vacina', largura: largura * 0.44 },
    { titulo: 'Dose', largura: largura * 0.18 },
    { titulo: 'Rede · local · lote', largura: largura * 0.24 },
  ];
  estado.p.drawText(limpo(`Doses aplicadas (${m.aplicadas.length})`), { x: MARGEM, y: estado.y, size: 12, font: b, color: ESCURO });
  estado.y -= 18;
  if (m.aplicadas.length) tabela(pdf, estado, { n, b }, cols, m.aplicadas, limpo);
  else {
    estado.p.drawText(limpo('Nenhuma dose marcada no app ainda.'), { x: MARGEM, y: estado.y, size: 10, font: n, color: CINZA });
    estado.y -= 16;
  }
  if (m.pendentes.length) {
    estado.y -= 14;
    if (estado.y < MARGEM + 60) {
      estado.p = pdf.addPage(A4);
      estado.y = A4[1] - MARGEM - 10;
    }
    estado.p.drawText(limpo('Próximas doses'), { x: MARGEM, y: estado.y, size: 12, font: b, color: ESCURO });
    estado.y -= 18;
    tabela(pdf, estado, { n, b }, [{ ...cols[0], titulo: 'A partir de' }, cols[1], cols[2], { ...cols[3], titulo: 'Situação' }], m.pendentes, limpo);
  }
  const rodape = `Gerado pelo app Heitor em ${m.geradoEm} a partir das doses marcadas pela família. Não substitui a Caderneta da Criança nem o registro oficial (Meu SUS Digital).`;
  const linhas = quebrar(limpo(rodape), n, 8, largura);
  const pags = pdf.getPages();
  linhas.forEach((l, i) => pags[pags.length - 1].drawText(l, { x: MARGEM, y: MARGEM - 4 + (linhas.length - 1 - i) * 10, size: 8, font: n, color: CINZA }));
  pdf.setTitle(`Comprovante de vacinação – ${m.nome}`);
  pdf.setCreator('App Heitor');
  return pdf.save();
}
