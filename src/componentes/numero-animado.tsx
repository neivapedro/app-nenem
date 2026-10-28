// Número que conta até o valor. O leitor de tela lê só o valor final
// (os intermediários ficam escondidos dele).
import { useNumeroAnimado, useTextoAnimado, type OpcoesAnimar } from '../lib/animar';

/** Mostra `formatar(n)` contando até `valor` */
export function NumeroAnimado({ valor, formatar, ...opcoes }: { valor: number; formatar: (n: number) => string } & OpcoesAnimar) {
  const n = useNumeroAnimado(valor, opcoes);
  return <Exibir final={formatar(valor)} agora={n === valor ? formatar(valor) : formatar(n)} />;
}

/** Texto já formatado ("14,2 h", "1h46", "620 ml"): anima o número dentro dele */
export function TextoAnimado({ texto, ...opcoes }: { texto: string } & Omit<OpcoesAnimar, 'minimo'>) {
  const agora = useTextoAnimado(texto, opcoes);
  return <Exibir final={texto} agora={agora} />;
}

function Exibir({ final, agora }: { final: string; agora: string }) {
  if (agora === final) return <>{final}</>;
  return (
    <>
      <span aria-hidden="true">{agora}</span>
      <span className="oculto-visual">{final}</span>
    </>
  );
}
