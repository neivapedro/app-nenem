/** Reduz a foto (lado maior até `max` px) e devolve JPEG, para subir rápido e ocupar pouco. */
export async function reduzirFoto(arquivo: File, max = 1600, qualidade = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error('Não foi possível abrir a foto.'));
      i.src = url;
    });
    const escala = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * escala);
    const h = Math.round(img.naturalHeight * escala);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Não foi possível preparar a foto.'))), 'image/jpeg', qualidade));
  } finally {
    URL.revokeObjectURL(url);
  }
}
