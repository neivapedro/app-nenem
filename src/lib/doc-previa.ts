// Prévia do documento no cartão da carteira: regras puras (qual arquivo, chave do cache, preferência).
import type { ArquivoDocumento } from './tipos';

export const CHAVE_PREVIA = 'app-nenem:docs-previa';
/** Largura da miniatura (px): leve na memória, nítida no cartão do celular */
export const LARGURA_PREVIA = 600;

export interface ArquivoPrevia {
  caminho: string;
  tipo: 'foto' | 'pdf';
}

const ehFotoPrevia = (a: ArquivoDocumento) => /^image\/(jpeg|jpg|png|webp)$/i.test(a.tipo) || (!a.tipo && /\.(jpe?g|png|webp)$/i.test(a.nome));
const ehPdfPrevia = (a: ArquivoDocumento) => a.tipo === 'application/pdf' || (!a.tipo && /\.pdf$/i.test(a.nome));

/** O primeiro arquivo do documento que dá para mostrar (foto JPEG/PNG ou PDF); null = sem prévia */
export function arquivoDaPrevia(arquivos: ArquivoDocumento[]): ArquivoPrevia | null {
  for (const a of arquivos) {
    if (!a.caminho) continue;
    if (ehFotoPrevia(a)) return { caminho: a.caminho, tipo: 'foto' };
    if (ehPdfPrevia(a)) return { caminho: a.caminho, tipo: 'pdf' };
  }
  return null;
}

/** Chave do cache em memória: muda se o documento ou o arquivo mudar */
export const chavePrevia = (idDoc: string, caminho: string): string => `${idDoc}::${caminho}`;

/** Lê a escolha guardada ('0' = escondida); o padrão é mostrar */
export function lerPreferenciaPrevia(valor: string | null): boolean {
  return valor !== '0';
}
