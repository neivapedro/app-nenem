// Mantém no celular a cópia de todos os arquivos dos documentos (para abrir sem
// internet). Roda em segundo plano enquanto o app está aberto.
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useDados } from '../dados/contexto';
import { pedirArmazenamentoPersistente, sincronizar, type EstadoOffline } from '../lib/offline-docs';

type Estado = EstadoOffline & { sincronizando: boolean };

let atual: Estado = { total: 0, guardados: 0, bytes: 0, sincronizando: false };
const ouvintes = new Set<() => void>();
function publicar(e: Estado) {
  atual = e;
  for (const o of ouvintes) o();
}

/** Quantos arquivos já estão no celular */
export function useEstadoOffline(): Estado {
  return useSyncExternalStore(
    (cb) => {
      ouvintes.add(cb);
      return () => ouvintes.delete(cb);
    },
    () => atual,
  );
}

export function SincronizarDocumentos() {
  const { documentos, cofrinho_movimentos, repo } = useDados();
  // Arquivos dos documentos e os comprovantes do cofrinho
  const arquivos = useMemo(
    () => [
      ...documentos.flatMap((d) => d.arquivos.map((a) => ({ caminho: a.caminho, tamanho: a.tamanho }))),
      ...cofrinho_movimentos.flatMap((m) => (m.comprovante ? [{ caminho: m.comprovante.caminho, tamanho: m.comprovante.tamanho }] : [])),
    ],
    [documentos, cofrinho_movimentos],
  );
  // Só refaz quando a lista de arquivos muda de verdade
  const assinatura = useMemo(() => arquivos.map((a) => a.caminho).sort().join('|'), [arquivos]);

  useEffect(() => {
    let cancelado = false;
    let tentativa: ReturnType<typeof setTimeout> | undefined;
    const rodar = async () => {
      if (cancelado) return;
      publicar({ ...atual, sincronizando: true });
      const fim = await sincronizar(arquivos, (c) => repo.baixarArquivo(c), (e) => !cancelado && publicar({ ...e, sincronizando: true })).catch(() => null);
      if (cancelado) return;
      publicar({ ...(fim ?? atual), sincronizando: false });
      // Faltou algum (sem internet): tenta de novo quando a conexão voltar ou em 2 min
      if (fim && fim.guardados < fim.total) tentativa = setTimeout(() => void rodar(), 120_000);
    };
    if (arquivos.length) pedirArmazenamentoPersistente();
    // Espera um pouco: o app abre primeiro, a cópia vem depois
    const inicio = setTimeout(() => void rodar(), 2500);
    const voltou = () => void rodar();
    window.addEventListener('online', voltou);
    return () => {
      cancelado = true;
      clearTimeout(inicio);
      clearTimeout(tentativa);
      window.removeEventListener('online', voltou);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, repo]);

  return null;
}
