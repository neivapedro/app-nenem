import { useEffect, useState } from 'react';
import { useDados } from '../dados/contexto';
import { conviteGuardado } from '../lib/convite';

export interface InfoConvite {
  codigo: string;
  convidou: string;
  bebe: string;
}

/** Convite guardado no aparelho (vindo do link) com quem convidou */
export function useConvite(): { convite: InfoConvite | null; invalido: boolean } {
  const { repo } = useDados();
  const [codigo] = useState(conviteGuardado);
  const [convite, setConvite] = useState<InfoConvite | null>(null);
  const [invalido, setInvalido] = useState(false);
  useEffect(() => {
    if (!codigo) return;
    let vivo = true;
    repo
      .infoConvite(codigo)
      .then((i) => {
        if (!vivo) return;
        if (i) setConvite({ codigo, ...i });
        else setInvalido(true);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [repo, codigo]);
  return { convite, invalido: !!codigo && invalido };
}

export function FaixaConvite({ convite, texto }: { convite: InfoConvite; texto: string }) {
  return (
    <div className="alerta info" style={{ flexDirection: 'column', gap: 4 }}>
      <strong>
        {convite.convidou} convidou você para acompanhar {convite.bebe === 'o bebê' ? 'o bebê' : `o ${convite.bebe}`} 💛
      </strong>
      <span>{texto}</span>
    </div>
  );
}
