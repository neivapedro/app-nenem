import type { ReactNode } from 'react';
import type { OcasiaoCofrinho } from '../lib/tipos';

/* Ícones duotone das ocasiões do depósito (traço + preenchimento suave), no mesmo estilo do <Icone> do app */
const desenhos: Record<OcasiaoCofrinho, { fundo: ReactNode; traco: ReactNode }> = {
  mensal: {
    fundo: <rect x="3" y="5" width="18" height="16" rx="3" />,
    traco: <path d="M8 3v4M16 3v4M3 10h18M3 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" />,
  },
  presente: {
    fundo: <rect x="3.5" y="11" width="17" height="10" rx="2" />,
    traco: <path d="M20 12v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20v-8M3 8h18v4H3zM12 8v13.5M12 8c-1.5-4-5.5-4-5.5-1.5S9 8 12 8zm0 0c1.5-4 5.5-4 5.5-1.5S15 8 12 8z" />,
  },
  aniversario: {
    fundo: <path d="M4 13h16v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />,
    traco: <path d="M4 19v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 16c2 1.5 3.3 1.5 4 0 .8 1.5 2.2 1.5 4 0 1.8 1.5 3.2 1.5 4 0 .7 1.5 2 1.5 4 0M12 11V8M12 3.5c1 1 1.2 2 0 3-1.2-1-1-2 0-3z" />,
  },
  mesversario: {
    fundo: <path d="M5 12h14l-1.6 8.500a1.5 1.5 0 0 1-1.5 1.200H8.100a1.5 1.5 0 0 1-1.5-1.200z" />,
    traco: <path d="M5 12h14l-1.6 8.500a1.5 1.5 0 0 1-1.5 1.200H8.100a1.5 1.5 0 0 1-1.5-1.200zM6 12a3 3 0 0 1 2-5.5 4 4 0 0 1 8 0A3 3 0 0 1 18 12M10 15.500v3M14 15.500v3" />,
  },
  natal: {
    fundo: <path d="M12 3 5 13h14zM12 8 4 19h16z" />,
    traco: <path d="m12 3-6 8h3.500L5 17h14l-4.5-6H18zM12 17v4" />,
  },
  batizado: {
    fundo: <path d="M12 3c3.5 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 2.5-6.5 6-11z" />,
    traco: <path d="M12 3c3.5 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 2.5-6.5 6-11zM9 14.500a3 3 0 0 0 3 3" />,
  },
  outro: {
    fundo: <path d="M12 20.500S3.5 15.5 3.5 9.500A4.5 4.5 0 0 1 12 7.3 4.5 4.5 0 0 1 20.5 9.500c0 6-8.5 11-8.5 11z" />,
    traco: <path d="M12 20.500S3.5 15.5 3.5 9.500A4.5 4.5 0 0 1 12 7.3 4.5 4.5 0 0 1 20.5 9.500c0 6-8.5 11-8.5 11z" />,
  },
};

export function IconeOcasiao({ id }: { id: OcasiaoCofrinho }) {
  const d = desenhos[id] ?? desenhos.outro;
  return (
    <svg className="td-ico-ocasiao" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g fill="currentColor" stroke="none" opacity="0.28">
        {d.fundo}
      </g>
      {d.traco}
    </svg>
  );
}
