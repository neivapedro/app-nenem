import { useEffect, useRef, useState } from 'react';
import { useDados } from '../dados/contexto';
import { traduzirErro } from '../lib/erros';
import { reduzirFoto } from '../lib/imagem';
import { Icone, Marca } from './ui';

// Miniatura da foto guardada no aparelho: o topo abre com a foto na hora (e sem internet),
// sem piscar a ilustração enquanto o endereço temporário da foto é pedido ao servidor.
// Junto vai uma versão maior para a capa do Hoje (mesma chave: some junto ao Sair).
const CHAVE = 'heitor:foto-bebe'; // também apagada ao Sair (contexto.tsx)
const LADO = 240;
// Capa: largura máxima e altura no máximo igual à largura (a capa mostra uma faixa larga)
const LARGURA_CAPA = 780;

type Guardada = { caminho: string; dados: string; capa?: string };
export type VarianteFoto = 'mini' | 'capa';

function lerGuardada(caminho: string): Guardada | null {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE) ?? 'null') as Guardada | null;
    return v?.caminho === caminho ? v : null;
  } catch {
    return null;
  }
}

function lerMiniatura(caminho: string, variante: VarianteFoto = 'mini'): string | null {
  const v = lerGuardada(caminho);
  return (variante === 'capa' ? v?.capa : v?.dados) ?? null;
}

function guardarMiniatura(caminho: string, dados: { dados?: string; capa?: string }) {
  const antes = lerGuardada(caminho);
  const nova = { caminho, dados: dados.dados ?? antes?.dados, capa: dados.capa ?? antes?.capa };
  if (!nova.dados) return;
  try {
    localStorage.setItem(CHAVE, JSON.stringify(nova));
  } catch {
    // Sem espaço: guarda ao menos a miniatura pequena
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ caminho, dados: nova.dados }));
    } catch {
      /* segue sem miniatura */
    }
  }
}

async function abrirImagem(foto: Blob): Promise<{ img: HTMLImageElement; fechar: () => void }> {
  const url = URL.createObjectURL(foto);
  try {
    const img = await new Promise<HTMLImageElement>((ok, falha) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => falha(new Error('foto'));
      i.src = url;
    });
    return { img, fechar: () => URL.revokeObjectURL(url) };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

/** Recorte quadrado (centro) e pequeno da foto, em JPEG (data URL) */
async function miniatura(foto: Blob): Promise<string> {
  const { img, fechar } = await abrirImagem(foto);
  try {
    const lado = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = LADO;
    canvas.getContext('2d')!.drawImage(img, (img.naturalWidth - lado) / 2, (img.naturalHeight - lado) / 2, lado, lado, 0, 0, LADO, LADO);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    fechar();
  }
}

/**
 * Versão da capa: até 780 px de largura; foto em pé é cortada num quadrado puxado para cima
 * (é onde costuma estar o rosto), o mesmo enquadramento da capa (object-position 50% 30%).
 */
async function fotoCapa(foto: Blob): Promise<string> {
  const { img, fechar } = await abrirImagem(foto);
  try {
    const w = img.naturalWidth;
    const h = Math.min(img.naturalHeight, w);
    const sy = (img.naturalHeight - h) * 0.3;
    const escala = Math.min(1, LARGURA_CAPA / w);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * escala);
    canvas.height = Math.round(h * escala);
    canvas.getContext('2d')!.drawImage(img, 0, sy, w, h, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.74);
  } finally {
    fechar();
  }
}

/**
 * Endereço da foto do bebê para mostrar (null = sem foto: mostra a ilustração).
 * Abre com a cópia guardada no aparelho; sem ela, pede ao servidor e guarda para a próxima.
 * Na capa, enquanto a versão grande não existe, usa a miniatura (e depois troca).
 */
export function useFotoBebe(variante: VarianteFoto = 'mini'): [string | null, () => void] {
  const { bebe, repo } = useDados();
  const caminho = bebe?.foto ?? null;
  const inicial = () => (caminho ? (lerMiniatura(caminho, variante) ?? (variante === 'capa' ? lerMiniatura(caminho) : null)) : null);
  const [src, setSrc] = useState<string | null>(inicial);

  useEffect(() => {
    if (!caminho) {
      setSrc(null);
      return;
    }
    const pronta = lerMiniatura(caminho, variante);
    setSrc(pronta ?? (variante === 'capa' ? lerMiniatura(caminho) : null));
    if (pronta) return;
    let vivo = true;
    repo
      .urlFoto(caminho)
      .then(async (url) => {
        if (!vivo || !url) return;
        // Na capa, a miniatura (se houver) segura a tela até a versão grande ficar pronta
        if (variante === 'mini' || !lerMiniatura(caminho)) setSrc(url);
        // Guarda a cópia para as próximas aberturas (falhar aqui não atrapalha)
        const r = await fetch(url);
        if (!r.ok) return;
        const blob = await r.blob();
        if (variante === 'capa') {
          const capa = await fotoCapa(blob);
          guardarMiniatura(caminho, { capa, dados: lerMiniatura(caminho) ?? (await miniatura(blob)) });
          if (vivo) setSrc(capa);
        } else {
          const dados = await miniatura(blob);
          guardarMiniatura(caminho, { dados });
          if (vivo) setSrc(dados);
        }
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [repo, caminho, variante]);

  return [caminho ? src : null, () => setSrc(null)];
}

/**
 * Foto redonda do bebê; sem foto (ou sem conseguir carregar), a ilustração do app.
 * `classe` dá o tamanho (ex.: "marca-mini" no topo, "avatar-grande" em Ajustes).
 */
export function AvatarBebe({ classe }: { classe: string }) {
  const [src, falhou] = useFotoBebe('mini');
  if (!src) return <Marca classe={`avatar ${classe}`} />;
  return <img className={`avatar avatar-foto ${classe}`} src={src} alt="" decoding="async" onError={falhou} />;
}

/** Foto grande da capa do Hoje (sem foto, a ilustração do app) */
export function FotoCapa({ classe }: { classe: string }) {
  const [src, falhou] = useFotoBebe('capa');
  if (!src) return <Marca classe={`${classe} capa-ilustracao`} />;
  return <img className={classe} src={src} alt="" decoding="async" onError={falhou} />;
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
      // A miniatura e a capa já ficam prontas no aparelho: o topo troca na hora
      await Promise.all([miniatura(reduzida), fotoCapa(reduzida).catch(() => undefined)])
        .then(([dados, capa]) => guardarMiniatura(caminho, { dados, capa }))
        .catch(() => undefined);
      try {
        await repo.salvarFotoBebe(bebe.id, caminho);
      } catch (e) {
        void repo.excluirFoto(caminho).catch(() => undefined);
        throw e;
      }
      gravar({ tipo: 'bebe', dado: { ...bebe, foto: caminho } });
      // Só agora (foto nova já gravada) a antiga pode ser apagada
      if (antiga) void repo.excluirFoto(antiga).catch(() => undefined);
      mostrarAviso({ texto: antiga ? 'Foto trocada' : 'Foto do bebê guardada 📸' });
    } catch (e) {
      setErro(`A foto não foi enviada: ${traduzirErro(e)}`);
    } finally {
      setEnviando(false);
    }
  }

  async function tirar() {
    if (!bebe || !antiga) return;
    if (!confirm('Tirar a foto do bebê? Ela será apagada e o app volta a mostrar a ilustração.')) return;
    setEnviando(true);
    try {
      await repo.salvarFotoBebe(bebe.id, null);
      gravar({ tipo: 'bebe', dado: { ...bebe, foto: null } });
      try {
        localStorage.removeItem(CHAVE);
      } catch {
        /* sem armazenamento */
      }
      void repo.excluirFoto(antiga).catch(() => undefined);
      mostrarAviso({ texto: 'Foto tirada' });
    } catch (e) {
      setErro(`A foto não foi tirada: ${traduzirErro(e)}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="linha">
      <button type="button" className="botao pequeno" disabled={enviando} onClick={() => entrada.current?.click()}>
        <Icone nome="camera" /> {enviando ? 'Enviando…' : antiga ? 'Trocar foto' : 'Escolher foto'}
      </button>
      {antiga && !enviando && (
        <button type="button" className="botao pequeno texto" onClick={() => void tirar()}>
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
