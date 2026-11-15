// Prévia do documento no cartão da frente da carteira: miniatura da foto ou da 1ª página do PDF.
import { useCallback, useEffect, useState } from 'react';
import { useDados } from '../dados/contexto';
import type { Repositorio } from '../dados/repositorio';
import { arquivoDaPrevia, CHAVE_PREVIA, chavePrevia, LARGURA_PREVIA, lerPreferenciaPrevia, type ArquivoPrevia } from '../lib/doc-previa';
import type { Documento } from '../lib/tipos';
import { obterArquivo } from './doc-arquivos';

/** Miniaturas já prontas (em memória), por documento+arquivo; falha não fica guardada */
const cache = new Map<string, Promise<Blob | null>>();

async function miniaturaFoto(blob: Blob): Promise<Blob | null> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error('foto'));
      i.src = url;
    });
    const escala = Math.min(1, LARGURA_PREVIA / img.naturalWidth);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * escala));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const saida = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/jpeg', 0.8));
    canvas.width = canvas.height = 0;
    return saida;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function miniaturaPdf(blob: Blob): Promise<Blob | null> {
  const { desenharPdf } = await import('../lib/pdf-render');
  let pagina: string | null = null;
  // Só a 1ª página: depois dela o renderizador para
  await desenharPdf(
    await blob.arrayBuffer(),
    LARGURA_PREVIA,
    (url) => {
      pagina = url;
    },
    () => pagina !== null,
  );
  if (!pagina) return null;
  try {
    return await (await fetch(pagina)).blob();
  } finally {
    URL.revokeObjectURL(pagina);
  }
}

function obterPrevia(repo: Repositorio, idDoc: string, arq: ArquivoPrevia): Promise<Blob | null> {
  const chave = chavePrevia(idDoc, arq.caminho);
  let p = cache.get(chave);
  if (!p) {
    p = (async () => {
      const bruto = await obterArquivo(repo, arq.caminho);
      return arq.tipo === 'pdf' ? miniaturaPdf(bruto) : miniaturaFoto(bruto);
    })().catch(() => null);
    cache.set(chave, p);
    void p.then((b) => {
      if (!b) cache.delete(chave);
    });
  }
  return p;
}

/** Endereço da prévia do documento (null = carregando, falhou ou não tem). Revoga ao sair. */
export function usePrevia(doc: Documento, ativa: boolean): string | null {
  const { repo } = useDados();
  const arq = ativa ? arquivoDaPrevia(doc.arquivos) : null;
  const caminho = arq?.caminho ?? null;
  const tipo = arq?.tipo ?? null;
  const [pronta, setPronta] = useState<{ chave: string; url: string } | null>(null);
  const idDoc = doc.id;
  useEffect(() => {
    if (!caminho || !tipo) return;
    let vivo = true;
    let url: string | null = null;
    void obterPrevia(repo, idDoc, { caminho, tipo }).then((blob) => {
      if (!vivo || !blob) return;
      url = URL.createObjectURL(blob);
      setPronta({ chave: chavePrevia(idDoc, caminho), url });
    });
    return () => {
      vivo = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [repo, idDoc, caminho, tipo]);
  return caminho && pronta?.chave === chavePrevia(idDoc, caminho) ? pronta.url : null;
}

/** Prévias ligadas ou escondidas (lembrado neste aparelho; padrão: ligadas) */
export function usePreviaLigada(): [boolean, () => void] {
  const [ligada, setLigada] = useState(() => {
    try {
      return lerPreferenciaPrevia(localStorage.getItem(CHAVE_PREVIA));
    } catch {
      return true;
    }
  });
  const alternar = useCallback(
    () =>
      setLigada((l) => {
        try {
          localStorage.setItem(CHAVE_PREVIA, l ? '0' : '1');
        } catch {
          /* nada */
        }
        return !l;
      }),
    [],
  );
  return [ligada, alternar];
}

/** Camada da prévia dentro do cartão: imagem cheia + degradês para o texto ficar legível */
export function CamadaPrevia({ url }: { url: string }) {
  return (
    <span className="cc-previa" aria-hidden="true">
      <img src={url} alt="" draggable={false} />
    </span>
  );
}
