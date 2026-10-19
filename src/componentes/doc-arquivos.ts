// Arquivos dos documentos: endereço para mostrar, envio, leitura (do celular ou
// do servidor) e a folha de compartilhar do iPhone.
import { useEffect, useState } from 'react';
import { useDados } from '../dados/contexto';
import type { Repositorio } from '../dados/repositorio';
import { dataBr } from '../lib/datas';
import { LIMITE_ARQUIVO, NOME_CATEGORIA, tamanhoTexto } from '../lib/documentos';
import { reduzirFoto } from '../lib/imagem';
import { guardarLocal, lerLocal, urlLocal } from '../lib/offline-docs';
import type { DocParaPdf } from '../lib/pdf-documentos';
import type { ArquivoDocumento, Documento } from '../lib/tipos';

/** Endereço do arquivo: a cópia do celular (funciona sem internet) ou, se não tiver, o servidor */
export function useUrlArquivo(caminho: string | null): string | null {
  const { repo } = useDados();
  const [url, setUrl] = useState<{ caminho: string; url: string } | null>(null);
  useEffect(() => {
    if (!caminho) return;
    let vivo = true;
    (async () => {
      const local = await urlLocal(caminho).catch(() => null);
      const u = local ?? (await repo.urlArquivo(caminho).catch(() => null));
      if (vivo && u) setUrl({ caminho, url: u });
    })();
    return () => {
      vivo = false;
    };
  }, [repo, caminho]);
  return caminho && url?.caminho === caminho ? url.url : null;
}

/** O arquivo em si: do celular, se tiver; senão baixa (e já guarda a cópia) */
export async function obterArquivo(repo: Repositorio, caminho: string): Promise<Blob> {
  const local = await lerLocal(caminho).catch(() => null);
  if (local) return local;
  const blob = await repo.baixarArquivo(caminho);
  void guardarLocal(caminho, blob).catch(() => undefined);
  return blob;
}

/**
 * Abre a folha de compartilhar do iPhone (WhatsApp, e-mail, AirDrop, Salvar em
 * Arquivos, Imprimir...). 'bloqueado' = o iPhone pediu um toque novo (o PDF
 * demorou para ficar pronto): a tela mostra um botão para compartilhar.
 */
export async function compartilhar(arquivos: File[], titulo: string): Promise<'ok' | 'bloqueado'> {
  if (navigator.canShare?.({ files: arquivos })) {
    try {
      await navigator.share({ files: arquivos, title: titulo });
      return 'ok';
    } catch (e) {
      const nome = (e as Error).name;
      if (nome === 'AbortError') return 'ok';
      if (nome === 'NotAllowedError') return 'bloqueado';
    }
  }
  // Sem a folha de compartilhar (computador): baixa
  for (const arquivo of arquivos) {
    const url = URL.createObjectURL(arquivo);
    const a = document.createElement('a');
    a.href = url;
    a.download = arquivo.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return 'ok';
}

export const ehPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
export const ehImagem = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp|gif)$/i.test(f.name);

/** Nome do arquivo: a câmera do iPhone manda "image.jpg"; aí vira "Foto 2.jpg" */
export function nomeGuardado(f: File, ordem: number): string {
  if (ehPdf(f)) return f.name || `Documento ${ordem}.pdf`;
  const base = f.name.replace(/\.[^.]+$/, '');
  return /^(image|img_\d+|photo|imagem|foto)$/i.test(base) || !base ? `Foto ${ordem}.jpg` : `${base}.jpg`;
}

/** Envia uma foto já pronta (JPEG) e guarda a cópia no celular */
export async function enviarFotoPronta(repo: Repositorio, blob: Blob, nome: string): Promise<ArquivoDocumento> {
  const caminho = await repo.enviarArquivo(blob, 'jpg');
  void guardarLocal(caminho, blob).catch(() => undefined);
  return { caminho, nome, tipo: 'image/jpeg', tamanho: blob.size };
}

/** Prepara (foto reduzida para JPEG nítido; PDF como está) e envia. */
export async function prepararEEnviar(repo: Repositorio, f: File, ordem: number): Promise<ArquivoDocumento> {
  if (ehPdf(f)) {
    if (f.size > LIMITE_ARQUIVO) throw new Error(`"${f.name}" tem ${tamanhoTexto(f.size)}; o limite é 20 MB.`);
    const caminho = await repo.enviarArquivo(f, 'pdf');
    void guardarLocal(caminho, f).catch(() => undefined);
    return { caminho, nome: nomeGuardado(f, ordem), tipo: 'application/pdf', tamanho: f.size };
  }
  if (ehImagem(f)) {
    // 2400 px no lado maior: dá para ler letras pequenas e ocupa pouco
    const blob = await reduzirFoto(f, 2400, 0.86);
    return enviarFotoPronta(repo, blob, nomeGuardado(f, ordem));
  }
  throw new Error(`"${f.name}" não é foto nem PDF. Para Word ou outros, salve como PDF antes.`);
}

/** Documentos no formato do gerador de PDF (lê os arquivos do celular ou do servidor) */
export async function paraPdf(repo: Repositorio, docs: Documento[], aoProgredir?: (feito: number, total: number) => void): Promise<DocParaPdf[]> {
  const total = docs.reduce((s, d) => s + d.arquivos.length, 0);
  let feito = 0;
  const saida: DocParaPdf[] = [];
  for (const d of docs) {
    const arquivos = [];
    for (const a of d.arquivos) {
      const blob = await obterArquivo(repo, a.caminho);
      arquivos.push({ nome: a.nome, tipo: a.tipo, bytes: await blob.arrayBuffer() });
      aoProgredir?.(++feito, total);
    }
    saida.push({
      titulo: d.titulo,
      categoria: NOME_CATEGORIA[d.categoria],
      numero: d.numero,
      data: d.data ? dataBr(d.data) : null,
      validade: d.validade ? dataBr(d.validade) : null,
      observacao: d.observacao,
      arquivos,
    });
  }
  return saida;
}

/** PDF pronto para compartilhar (bytes do pdf-lib viram arquivo) */
export function arquivoPdf(bytes: Uint8Array, nome: string): File {
  return new File([bytes as BlobPart], nome, { type: 'application/pdf' });
}
