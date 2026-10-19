// Mostra PDFs dentro do app (página por página, como imagem), inclusive sem internet.
// Carregado só quando alguém abre um PDF no visualizador.
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import trabalhador from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = trabalhador;

/** Lado maior de cada página desenhada (nitidez para dar zoom sem pesar demais) */
const MAX_LADO = 2600;

/**
 * Desenha cada página e devolve o endereço da imagem dela em `aoPagina`, na
 * ordem. Para quando `cancelado()` ficar verdadeiro (visualizador fechado).
 */
export async function desenharPdf(
  bytes: ArrayBuffer,
  largura: number,
  aoPagina: (url: string, numero: number, total: number) => void,
  cancelado: () => boolean,
): Promise<void> {
  const doc = await getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
  try {
    for (let i = 1; i <= doc.numPages && !cancelado(); i++) {
      const pagina = await doc.getPage(i);
      const base = pagina.getViewport({ scale: 1 });
      const escala = Math.min(largura / base.width, MAX_LADO / Math.max(base.width, base.height), 4);
      const vp = pagina.getViewport({ scale: escala });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await pagina.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.92));
      canvas.width = canvas.height = 0;
      if (blob && !cancelado()) aoPagina(URL.createObjectURL(blob), i, doc.numPages);
      pagina.cleanup();
    }
  } finally {
    void doc.destroy();
  }
}
