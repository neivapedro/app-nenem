// Cópia dos arquivos dos documentos no próprio celular, para abrir sem internet
// (hospital, cartório, avião). Fica no Cache Storage do app instalado; o service
// worker não apaga este cache nas atualizações.

export const CACHE_DOCUMENTOS = 'heitor-documentos-v1';

const chave = (caminho: string) => new Request(`${location.origin}/__documentos/${encodeURIComponent(caminho)}`);

async function abrir(): Promise<Cache | null> {
  try {
    return typeof caches === 'undefined' ? null : await caches.open(CACHE_DOCUMENTOS);
  } catch {
    return null;
  }
}

/** Endereços já criados (um por arquivo, para não vazar memória) */
const urls = new Map<string, string>();

export async function lerLocal(caminho: string): Promise<Blob | null> {
  const c = await abrir();
  const r = await c?.match(chave(caminho));
  return r ? await r.blob() : null;
}

/** Endereço do arquivo guardado no celular (null = ainda não tem cópia) */
export async function urlLocal(caminho: string): Promise<string | null> {
  const ja = urls.get(caminho);
  if (ja) return ja;
  const blob = await lerLocal(caminho);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(caminho, url);
  return url;
}

export async function guardarLocal(caminho: string, blob: Blob): Promise<void> {
  const c = await abrir();
  if (!c) return;
  await c.put(chave(caminho), new Response(blob, { headers: { 'Content-Type': blob.type || 'application/octet-stream', 'Content-Length': String(blob.size) } }));
}

export async function temLocal(caminho: string): Promise<boolean> {
  const c = await abrir();
  return !!(await c?.match(chave(caminho)));
}

export interface EstadoOffline {
  total: number;
  guardados: number;
  bytes: number;
}

/**
 * Baixa o que falta e apaga do celular o que saiu do app. `baixar` busca o
 * arquivo no servidor. Para no primeiro erro de rede (tenta de novo depois).
 */
export async function sincronizar(
  arquivos: { caminho: string; tamanho: number }[],
  baixar: (caminho: string) => Promise<Blob>,
  aoProgredir?: (e: EstadoOffline) => void,
): Promise<EstadoOffline> {
  const c = await abrir();
  const estado: EstadoOffline = { total: arquivos.length, guardados: 0, bytes: 0 };
  if (!c) return estado;
  const queremos = new Set(arquivos.map((a) => chave(a.caminho).url));
  // Limpa arquivos que não estão mais em nenhum documento
  for (const req of await c.keys()) {
    if (!queremos.has(req.url)) {
      await c.delete(req);
      const caminho = decodeURIComponent(new URL(req.url).pathname.replace('/__documentos/', ''));
      const u = urls.get(caminho);
      if (u) URL.revokeObjectURL(u);
      urls.delete(caminho);
    }
  }
  const faltam: typeof arquivos = [];
  for (const a of arquivos) {
    if (await c.match(chave(a.caminho))) {
      estado.guardados++;
      estado.bytes += a.tamanho;
    } else faltam.push(a);
  }
  aoProgredir?.({ ...estado });
  for (const a of faltam) {
    try {
      const blob = await baixar(a.caminho);
      await c.put(chave(a.caminho), new Response(blob, { headers: { 'Content-Type': blob.type || 'application/octet-stream' } }));
      estado.guardados++;
      estado.bytes += a.tamanho;
      aoProgredir?.({ ...estado });
    } catch {
      break;
    }
  }
  return estado;
}

/** Ao sair da conta: nada dos documentos fica no aparelho */
export async function apagarTudoLocal(): Promise<void> {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
  try {
    if (typeof caches !== 'undefined') await caches.delete(CACHE_DOCUMENTOS);
  } catch {
    /* nada */
  }
}

/** Pede ao iPhone para não apagar o armazenamento do app quando faltar espaço */
export function pedirArmazenamentoPersistente(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* nada */
  }
}
