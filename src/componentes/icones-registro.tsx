// Ícones duotone das folhas de registro (substituem os emojis 💧 💩). Mesmo desenho
// do <Icone>: preenchimento suave por trás e traço de 2 px por cima.
import type { ReactNode } from 'react';

function Base({ fundo, children, classe }: { fundo?: ReactNode; children: ReactNode; classe?: string }) {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`ic-reg ${classe ?? ''}`}>
      {fundo && (
        <g fill="currentColor" stroke="none" opacity="0.28">
          {fundo}
        </g>
      )}
      {children}
    </svg>
  );
}

const GOTA = 'M12 3s-6 6.2-6 10.6a6 6 0 0 0 12 0C18 9.2 12 3 12 3z';
const COCO = 'M12 3c1.5 1.4 1.2 3-.5 4M7.5 12.5C5.7 13.2 4.5 14.5 4.5 16.2 4.5 18.9 7.6 21 12 21s7.5-2.1 7.5-4.8c0-1.7-1.2-3-3-3.7M8.5 12.5C8.8 10.6 10 9.5 12 9.5s3.2 1.1 3.5 3';

/** Xixi: gota */
export function IconeXixi() {
  return (
    <Base classe="ic-reg-xixi" fundo={<path d={GOTA} />}>
      <path d={GOTA} />
    </Base>
  );
}

/** Cocô: montinho em espiral */
export function IconeCoco() {
  return (
    <Base classe="ic-reg-coco" fundo={<path d="M4.5 16.2C4.5 18.9 7.6 21 12 21s7.5-2.1 7.5-4.8c0-1.7-1.2-3-3-3.7L15.5 12.5C15.2 10.6 14 9.5 12 9.5s-3.2 1.1-3.5 3l-1 0C5.7 13.2 4.5 14.5 4.5 16.2z" />}>
      <path d={COCO} />
    </Base>
  );
}

/** Os dois: gota e montinho lado a lado, menores */
export function IconeXixiCoco() {
  return (
    <Base classe="ic-reg-dois" fundo={<path d="M8 3.5s-4.5 4.7-4.5 8a4.5 4.5 0 0 0 9 0C12.5 8.2 8 3.5 8 3.5z" />}>
      <path d="M8 3.5s-4.5 4.7-4.5 8a4.5 4.5 0 0 0 9 0C12.5 8.2 8 3.5 8 3.5z" />
      <path d="M17 11c.9.8.7 1.8-.3 2.5M14.5 15.5c-1 .4-1.5 1.2-1.5 2.1 0 1.7 1.8 2.9 4 2.9s4-1.2 4-2.9c0-.9-.6-1.7-1.5-2.1M15.5 15.5c.2-1 .8-1.5 1.5-1.5s1.3.5 1.5 1.5" />
    </Base>
  );
}

/** Cor do cocô: gota de tinta com respingo (paleta simples) */
export function IconeCor() {
  return (
    <Base fundo={<circle cx="12" cy="12" r="9" />}>
      <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.6-1.5-1.7-1.5-3 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3z" />
      <path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01" />
    </Base>
  );
}

/** Foi em outro horário: relógio */
export function IconeOutraHora() {
  return (
    <Base fundo={<circle cx="12" cy="12" r="9" />}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </Base>
  );
}
