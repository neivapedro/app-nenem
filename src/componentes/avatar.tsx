import { useEffect, useRef, useState } from 'react';
import { useDados } from '../dados/contexto';
import { traduzirErro } from '../lib/erros';
import { reduzirFoto } from '../lib/imagem';
import { Icone, Marca } from './ui';

// Miniatura da foto guardada no aparelho: o topo abre com a foto na hora (e sem internet),
// sem piscar a ilustração enquanto o endereço temporário da foto é pedido ao servidor.
const CHAVE = 'heitor:foto-bebe';
const LADO = 240;

function lerMiniatura(caminho: string): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as { caminho: string; dados: string } | null;
    return v?.caminho === caminho ? v.dados : null;
  } catch {
    return null;
  }
}

function guardarMiniatura(caminho: string, dados: string) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ caminho, dados }));
  } catch {
    /* sem espaço: segue sem miniatura */
  }
}

/** Recorte quadrado (centro) e pequeno da foto, em JPEG (data URL) */
async function miniatura(foto: Blob): Promise<string> {
  const url = URL.createObjectURL(foto);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error('foto'));
      i.src = url;
    });
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = LADO;
    canvas.getContext('2d')!.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, LADO, LADO);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Foto redonda do bebê; sem foto (ou sem conseguir carregar), a ilustração do app.
 * `classe` dá o tamanho (ex.: "marca-mini" no topo, "avatar-grande" em Ajustes).
 */
export function AvatarBebe({ classe }: { classe: string }) {
  const { bebe, repo } = useDados();
  const caminho = bebe?.foto ?? null;
  const [src, setSrc] = useState<string | null>(() => (caminho ? lerMiniatura(caminho) : null));

  useEffect(() => {
    if (!caminho) {
      setSrc(null);
      return;
    }
    const guardada = lerMiniatura(caminho);
    setSrc(guardada);
    if (guardada) return;
    let vivo = true;
    repo
      .urlFoto(caminho)
      .then(async (url) => {
        if (!vivo || !url) return;
        setSrc(url);
        // Guarda a miniatura para as próximas aberturas (falhar aqui não atrapalha)
        const r = await fetch(url);
        if (!r.ok) return;
        const dados = await miniatura(await r.blob());
        guardarMiniatura(caminho, dados);
        if (vivo) setSrc(dados);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [repo, caminho]);

  if (!caminho || !src) return <Marca classe={`avatar ${classe}`} />;
  return <img className={`avatar avatar-foto ${classe}`} src={src} alt="" decoding="async" onError={() => setSrc(null)} />;
}

/** Escolher, trocar ou tirar a foto do bebê (grava na hora; precisa de internet para enviar) */
export function EscolherFotoBebe() {
  const { bebe, repo, gravar, mostrarAviso, setErro } = useDados();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  if (!bebe) return null;
  const antiga = bebe.foto ?? null;

  async function escolher(arquivo: File | undefined) {
    if (!arquivo || !bebe) return;
    setEnviando(true);
    try {
      const reduzida = await reduzirFoto(arquivo, 1200, 0.85);
      const caminho = await repo.enviarFoto(reduzida);
      // A miniatura já fica pronta no aparelho: o topo troca na hora
      await miniatura(reduzida)
        .then((d) => guardarMiniatura(caminho, d))
        .catch(() => undefined);
      gravar({ tipo: 'bebe', dado: { ...bebe, foto: caminho } });
      if (antiga) void repo.excluirFoto(antiga).catch(() => undefined);
      mostrarAviso({ texto: antiga ? 'Foto trocada' : 'Foto do bebê guardada 📸' });
    } catch (e) {
      setErro(`A foto não foi enviada: ${traduzirErro(e)}`);
    } finally {
      setEnviando(false);
    }
  }

  function tirar() {
    if (!bebe || !antiga) return;
    if (!confirm('Tirar a foto do bebê? Ela será apagada e o app volta a mostrar a ilustração.')) return;
    gravar({ tipo: 'bebe', dado: { ...bebe, foto: null } });
    void repo.excluirFoto(antiga).catch(() => undefined);
    mostrarAviso({ texto: 'Foto tirada' });
  }

  return (
    <div className="linha">
      <button type="button" className="botao pequeno" disabled={enviando} onClick={() => entrada.current?.click()}>
        <Icone nome="camera" /> {enviando ? 'Enviando…' : antiga ? 'Trocar foto' : 'Escolher foto'}
      </button>
      {antiga && !enviando && (
        <button type="button" className="botao pequeno texto" onClick={tirar}>
          Tirar a foto
        </button>
      )}
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = '';
          void escolher(arquivo);
        }}
      />
    </div>
  );
}
