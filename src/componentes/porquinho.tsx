import { useId } from 'react';
import '../estilos/porquinho.css';

/**
 * Porquinho do Cofrinho: ilustração vetorial (nítida em qualquer tamanho e tela) em 3D suave,
 * com brilho, sombra no chão e uma moeda dourada entrando na fenda.
 */
export function Porquinho({ classe = '' }: { classe?: string }) {
  const id = useId().replace(/:/g, '');
  const g = (nome: string) => `url(#${id}-${nome})`;
  return (
    <svg className={`porquinho ${classe}`} viewBox="0 0 320 270" role="img" aria-label="Cofrinho de porquinho com uma moeda dourada">
      <defs>
        <radialGradient id={`${id}-corpo`} cx="34%" cy="28%" r="82%">
          <stop offset="0" stopColor="#ffd3e6" />
          <stop offset="0.38" stopColor="#ff9cc6" />
          <stop offset="0.78" stopColor="#ec5f9d" />
          <stop offset="1" stopColor="#c93f82" />
        </radialGradient>
        <linearGradient id={`${id}-pata`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e96a9f" />
          <stop offset="1" stopColor="#b93578" />
        </linearGradient>
        <linearGradient id={`${id}-orelha`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff8fbe" />
          <stop offset="1" stopColor="#c93f82" />
        </linearGradient>
        <radialGradient id={`${id}-focinho`} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#ffe0ee" />
          <stop offset="0.6" stopColor="#ffa9cd" />
          <stop offset="1" stopColor="#ea6aa2" />
        </radialGradient>
        <radialGradient id={`${id}-moeda`} cx="36%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset="0.5" stopColor="#ffd24d" />
          <stop offset="1" stopColor="#e69a14" />
        </radialGradient>
        <linearGradient id={`${id}-fenda`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7d2152" />
          <stop offset="1" stopColor="#a8396e" />
        </linearGradient>
        <filter id={`${id}-desfoque`} filterUnits="userSpaceOnUse" x="0" y="0" width="320" height="270">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={`${id}-suave`} filterUnits="userSpaceOnUse" x="0" y="0" width="320" height="270">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <clipPath id={`${id}-recorte`}>
          <ellipse cx="160" cy="152" rx="108" ry="82" />
        </clipPath>
      </defs>

      {/* Sombra no chão */}
      <ellipse cx="164" cy="246" rx="102" ry="13" fill="#3a1030" opacity="0.22" filter={g('desfoque')} />

      {/* Rabinho */}
      <path d="M56 154c-20 2-34-8-32-22 2-12 18-14 22-4 3 8-8 10-10 4" fill="none" stroke="#d24b8c" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />

      {/* Patas de trás */}
      <rect x="92" y="196" width="36" height="46" rx="16" fill={g('pata')} />
      {/* Corpo */}
      <ellipse cx="160" cy="152" rx="108" ry="82" fill={g('corpo')} />
      {/* Sombra interna da barriga e brilho do topo */}
      <g clipPath={g('recorte')}>
        <ellipse cx="170" cy="236" rx="118" ry="40" fill="#8e2a63" opacity="0.38" filter={g('suave')} />
        <ellipse cx="120" cy="100" rx="58" ry="22" fill="#fff" opacity="0.42" filter={g('suave')} transform="rotate(-22 120 100)" />
      </g>
      {/* Patas da frente */}
      <rect x="192" y="196" width="36" height="46" rx="16" fill={g('pata')} />
      <rect x="196" y="200" width="10" height="16" rx="5" fill="#fff" opacity="0.28" />

      {/* Orelha */}
      <path d="M208 84c10-30 36-34 46-18 4 18-8 34-30 42z" fill={g('orelha')} />
      <path d="M220 86c6-14 18-18 26-10 0 9-6 17-18 22z" fill="#ffb3d3" opacity="0.55" />

      {/* Fenda da moeda */}
      <rect x="126" y="76" width="70" height="12" rx="6" fill={g('fenda')} />
      <rect x="130" y="76" width="62" height="3.5" rx="1.75" fill="#000" opacity="0.28" />

      {/* Focinho, narinas e olho */}
      <ellipse cx="266" cy="162" rx="25" ry="29" fill={g('focinho')} />
      <ellipse cx="270" cy="150" rx="7" ry="10" fill="#fff" opacity="0.35" filter={g('suave')} />
      <ellipse cx="262" cy="170" rx="4.2" ry="6.2" fill="#a42d69" />
      <ellipse cx="278" cy="168" rx="4.2" ry="6.2" fill="#a42d69" />
      <circle cx="226" cy="124" r="7.5" fill="#3d1633" />
      <circle cx="228.5" cy="121.5" r="2.4" fill="#fff" />
      <ellipse cx="232" cy="154" rx="13" ry="9" fill="#ff7fb0" opacity="0.55" filter={g('suave')} />
      <path d="M238 178c6 6 14 8 22 4" fill="none" stroke="#a42d69" strokeWidth="3.4" strokeLinecap="round" opacity="0.75" />

      {/* Moeda dourada entrando na fenda */}
      <g className="porquinho-moeda">
        <ellipse cx="161" cy="42" rx="22" ry="26" fill={g('moeda')} transform="rotate(12 161 42)" />
        <ellipse cx="161" cy="42" rx="14.5" ry="18.5" fill="none" stroke="#c7840f" strokeWidth="2.4" opacity="0.7" transform="rotate(12 161 42)" />
        <path d="M156 32c4-4 11-3 13 2" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <path d="M0 -9L2.6 -3L9 -2.8L4.2 1.4L5.6 7.8L0 4.4L-5.6 7.8L-4.2 1.4L-9 -2.8L-2.6 -3Z" transform="translate(161 43) rotate(12)" fill="#b9770c" opacity="0.7" />
      </g>

      {/* Brilhos */}
      <g className="porquinho-brilho" fill="#ffe27a">
        <path d="M70 62l3.5 9 9 3.5-9 3.5L70 87l-3.5-9-9-3.5 9-3.5z" />
        <path d="M262 42l2.8 7 7 2.8-7 2.8-2.8 7-2.8-7-7-2.8 7-2.8z" />
      </g>
      <g className="porquinho-brilho porquinho-brilho-2" fill="#fff">
        <path d="M244 214l2.2 5.4 5.4 2.2-5.4 2.2-2.2 5.4-2.2-5.4-5.4-2.2 5.4-2.2z" opacity="0.9" />
        <circle cx="46" cy="190" r="3.2" opacity="0.8" />
      </g>
    </svg>
  );
}

/** Porquinho pequeno (selo do cartão de saldo e estados vazios): só decorativo */
export function PorquinhoMini({ classe = '' }: { classe?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg className={`porquinho-mini ${classe}`} viewBox="0 0 64 58" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-c`} cx="34%" cy="28%" r="85%">
          <stop offset="0" stopColor="#ffd3e6" />
          <stop offset="0.4" stopColor="#ff9cc6" />
          <stop offset="1" stopColor="#c93f82" />
        </radialGradient>
        <radialGradient id={`${id}-m`} cx="36%" cy="30%" r="80%">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset="0.55" stopColor="#ffd24d" />
          <stop offset="1" stopColor="#e69a14" />
        </radialGradient>
      </defs>
      <ellipse cx="32" cy="54" rx="20" ry="2.6" fill="#3a1030" opacity="0.18" />
      <rect x="15" y="42" width="9" height="11" rx="4" fill="#d9548f" />
      <rect x="39" y="42" width="9" height="11" rx="4" fill="#d9548f" />
      <path d="M8 36c-5 1-8-2-7-5 1-3 5-3 6-1" fill="none" stroke="#d24b8c" strokeWidth="2.2" strokeLinecap="round" />
      <ellipse cx="31" cy="34" rx="24" ry="18" fill={`url(#${id}-c)`} />
      <ellipse cx="21" cy="26" rx="11" ry="4.2" fill="#fff" opacity="0.4" transform="rotate(-20 21 26)" />
      <path d="M42 20c1-7 8-9 10-5 1 4-2 7-7 9z" fill="#ff8fbe" />
      <ellipse cx="54" cy="35" rx="6" ry="7" fill="#ffa9cd" />
      <ellipse cx="52.6" cy="37" rx="1.1" ry="1.6" fill="#a42d69" />
      <ellipse cx="56.4" cy="36.6" rx="1.1" ry="1.6" fill="#a42d69" />
      <circle cx="45.5" cy="29" r="2" fill="#3d1633" />
      <rect x="23" y="17" width="17" height="3.2" rx="1.6" fill="#7d2152" />
      <ellipse cx="32" cy="9" rx="5.6" ry="6.8" fill={`url(#${id}-m)`} transform="rotate(10 32 9)" />
      <ellipse cx="32" cy="9" rx="3.4" ry="4.6" fill="none" stroke="#c7840f" strokeWidth="0.9" opacity="0.7" transform="rotate(10 32 9)" />
    </svg>
  );
}
