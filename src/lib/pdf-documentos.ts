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
