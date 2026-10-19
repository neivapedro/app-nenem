/**
 * Id fixo (formato uuid) a partir de um texto: o mesmo item (ex.: a dose "bcg"
 * do bebê X) recebe sempre o mesmo id nos dois celulares, então marcar a mesma
 * coisa nos dois aparelhos atualiza um registro só, em vez de duplicar.
 */
export function idFixo(texto: string): string {
  // Quatro hashes FNV-1a de 32 bits com sementes diferentes = 128 bits
  const partes = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b].map((semente) => {
    let h = semente >>> 0;
    for (let i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  });
  const hex = partes.join('');
  // Versão 5 e variante RFC 4122, para ser um uuid válido
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
