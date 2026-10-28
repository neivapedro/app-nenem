import type { CSSProperties, ReactNode } from 'react';

/**
 * Ilustrações das telas vazias, todas no mesmo traço: linhas arredondadas, formas suaves e
 * 2–3 tons tirados dos tokens do tema (a cor do tipo, a superfície e a cor do app como brilho).
 * Assim funcionam no claro, no escuro, na noite âmbar e com qualquer cor escolhida.
 * Classes das formas (src/estilos/ilustracoes.css):
 * - il-fundo: mancha de fundo bem clarinha · il-papel: objeto na cor do cartão, com traço
 * - il-suave / il-forte: preenchidos com a cor (fraco / mais forte) · il-dois: a 2ª cor
 * - il-linha: só traço · il-fraco: traço apagado (linhas de "texto") · il-brilho: brilhos na cor do app
 */

export type NomeIlustracao =
  | 'mamadeira'
  | 'historico'
  | 'sono'
  | 'graficos'
  | 'vacinas'
  | 'crescimento'
  | 'remedios'
  | 'termometro'
  | 'documentos'
  | 'cofrinho'
  | 'agenda'
  | 'primeiras'
  | 'fotos'
  | 'leite'
  | 'sem-internet';

type Cor = 'mamada' | 'mamadeira' | 'fralda' | 'sono' | 'agenda' | 'neutro';

/** Cor principal e a segunda de cada desenho (as mesmas dos tipos/seções a que ele pertence) */
const CORES: Record<NomeIlustracao, [Cor, Cor]> = {
  mamadeira: ['mamadeira', 'mamada'],
  historico: ['sono', 'fralda'],
  sono: ['sono', 'fralda'],
  graficos: ['fralda', 'mamada'],
  vacinas: ['agenda', 'fralda'],
  crescimento: ['fralda', 'agenda'],
  remedios: ['agenda', 'mamadeira'],
  termometro: ['mamadeira', 'fralda'],
  documentos: ['fralda', 'agenda'],
  cofrinho: ['mamada', 'mamadeira'],
  agenda: ['agenda', 'mamada'],
  primeiras: ['mamadeira', 'mamada'],
  fotos: ['sono', 'mamadeira'],
  leite: ['mamada', 'fralda'],
  'sem-internet': ['neutro', 'fralda'],
};

const varCor = (c: Cor) => (c === 'neutro' ? 'var(--texto-3)' : `var(--c-${c})`);

/** Brilho de 4 pontas (centro x, y; tamanho r) */
const Brilho = ({ x, y, r = 6, atraso = 0 }: { x: number; y: number; r?: number; atraso?: number }) => (
  <path
    className="il-brilho"
    style={{ '--il-atraso': `${atraso}ms` } as CSSProperties}
    d={`M${x} ${y - r}C${x + r * 0.18} ${y - r * 0.18} ${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}C${x + r * 0.18} ${y + r * 0.18} ${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}C${x - r * 0.18} ${y + r * 0.18} ${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}C${x - r * 0.18} ${y - r * 0.18} ${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}z`}
  />
);
const Ponto = ({ x, y, r = 2.6 }: { x: number; y: number; r?: number }) => <circle className="il-ponto" cx={x} cy={y} r={r} />;

/** Mancha de fundo (forma orgânica, levemente diferente em cada desenho) */
const FUNDOS = [
  'M82 12c28-1 54 14 58 40 4 27-16 52-46 56-31 4-64-5-72-31-8-27 22-64 60-65z',
  'M76 14c31-4 60 10 63 38 3 29-21 52-52 55-30 3-62-9-66-36-4-28 24-53 55-57z',
  'M84 13c26 2 52 18 53 44 1 27-24 49-55 50-30 1-60-15-61-42-1-28 32-55 63-52z',
];

const desenhos: Record<NomeIlustracao, ReactNode> = {
  mamadeira: (
    <>
      <g className="il-obj">
        <g transform="rotate(-10 80 62)">
          <path className="il-suave" d="M73 27c0-7 3-11 7-11s7 4 7 11z" />
          <rect className="il-forte" x="67" y="26" width="26" height="11" rx="4" />
          <rect className="il-papel" x="63" y="37" width="34" height="64" rx="12" />
          <path className="il-suave il-sem-traco" d="M64.5 64h31v25a10.5 10.5 0 0 1-10.5 10.5h-10A10.5 10.5 0 0 1 64.5 89z" />
          <rect className="il-linha" x="63" y="37" width="34" height="64" rx="12" />
          <path className="il-fraco" d="M63 52h9M63 64h9M63 76h9" />
        </g>
      </g>
      <Brilho x={118} y={32} r={7} atraso={250} />
      <Brilho x={40} y={46} r={5} atraso={380} />
      <Ponto x={124} y={84} />
      <Ponto x={36} y={86} r={2} />
    </>
  ),
  historico: (
    <>
      <g className="il-obj">
        <rect className="il-papel" x="38" y="22" width="80" height="82" rx="13" transform="rotate(-4 78 63)" />
        <g transform="rotate(-4 78 63)">
          <path className="il-fraco" d="M57 42v42" />
          <circle className="il-forte" cx="57" cy="42" r="5.5" />
          <circle className="il-dois" cx="57" cy="63" r="5.5" />
          <circle className="il-suave" cx="57" cy="84" r="5.5" />
          <path className="il-fraco" d="M70 42h32M70 63h24M70 84h28" />
        </g>
        <circle className="il-suave" cx="118" cy="88" r="15" />
        <path className="il-linha" d="M118 80v8l6 4" />
      </g>
      <Brilho x={128} y={34} r={6} atraso={300} />
      <Ponto x={30} y={74} />
    </>
  ),
  sono: (
    <>
      <g className="il-obj">
        <path className="il-suave il-esc" transform="translate(28 4) scale(4)" d="M20.5 13.3A8.5 8.5 0 1 1 10.7 3.5a6.6 6.6 0 0 0 9.8 9.8z" />
        <path className="il-papel" d="M60 104h46a13 13 0 0 0 1-26 17 17 0 0 0-32-5 13 13 0 0 0-15 31z" />
      </g>
      <Brilho x={118} y={30} r={7} atraso={250} />
      <Brilho x={132} y={58} r={4.5} atraso={420} />
      <Ponto x={34} y={40} />
    </>
  ),
  graficos: (
    <>
      <g className="il-obj">
        <rect className="il-papel" x="32" y="24" width="96" height="76" rx="13" />
        <rect className="il-suave" x="48" y="66" width="13" height="20" rx="4" />
        <rect className="il-forte" x="68" y="52" width="13" height="34" rx="4" />
        <rect className="il-dois" x="88" y="60" width="13" height="26" rx="4" />
        <rect className="il-suave" x="108" y="46" width="8" height="40" rx="4" opacity="0.7" />
        <path className="il-fraco" d="M44 88h74" />
        <path className="il-linha" d="M46 54c9-7 15-14 25-14s14 7 24 1 12-11 21-11" />
      </g>
      <Brilho x={136} y={22} r={6.5} atraso={300} />
      <Ponto x={26} y={60} />
    </>
  ),
  vacinas: (
    <>
      <g className="il-obj">
        <g transform="rotate(-38 76 62)">
          <path className="il-linha" d="M38 62h14M38 53v18" />
          <path className="il-linha" d="M58 48v28" />
          <rect className="il-papel" x="58" y="51" width="50" height="22" rx="6" />
          <rect className="il-suave il-sem-traco" x="76" y="55" width="28" height="14" rx="3" />
          <rect className="il-linha" x="58" y="51" width="50" height="22" rx="6" />
          <path className="il-fraco" d="M84 51v7M94 51v7" />
          <path className="il-linha" d="M108 62h18" />
        </g>
        <path className="il-dois" d="M116 66l15 5.5v11c0 9.5-6.5 16-15 19-8.5-3-15-9.5-15-19v-11z" />
        <path className="il-linha" d="M110 84l4.5 4.5 8-8.5" />
      </g>
      <Brilho x={42} y={86} r={6} atraso={300} />
      <Ponto x={130} y={36} />
    </>
  ),
  crescimento: (
    <>
      <g className="il-obj">
        <rect className="il-suave" x="38" y="16" width="24" height="88" rx="7" />
        <path className="il-linha" d="M38 30h8M38 42h12M38 54h8M38 66h12M38 78h8M38 90h12" />
        <path className="il-dois" d="M76 70c4 15 50 15 56 0z" />
        <path className="il-linha" d="M104 82v10" />
        <path className="il-papel" d="M80 92h48a6 6 0 0 1 6 6v2H74v-2a6 6 0 0 1 6-6z" />
        <path className="il-forte" d="M104 66c-3-3-9-6-9-11a4.5 4.5 0 0 1 9-1.5 4.5 4.5 0 0 1 9 1.5c0 5-6 8-9 11z" />
        <path className="il-linha" d="M74 42l9-9 9 9M83 33v16" />
      </g>
      <Brilho x={126} y={30} r={6.5} atraso={300} />
      <Ponto x={140} y={60} r={2.2} />
    </>
  ),
  remedios: (
    <>
      <g className="il-obj">
        <rect className="il-forte" x="48" y="24" width="38" height="15" rx="5" />
        <rect className="il-papel" x="44" y="39" width="46" height="62" rx="11" />
        <rect className="il-suave" x="52" y="56" width="30" height="26" rx="5" />
        <path className="il-linha" d="M67 62v14M60 69h14" />
        <g transform="rotate(-35 116 78)">
          <path className="il-dois il-sem-traco" d="M104 70h12v16h-12a8 8 0 0 1 0-16z" />
          <rect className="il-linha" x="96" y="70" width="40" height="16" rx="8" />
          <path className="il-linha" d="M116 70v16" />
        </g>
      </g>
      <Brilho x={120} y={30} r={6.5} atraso={300} />
      <Ponto x={34} y={60} />
    </>
  ),
  termometro: (
    <>
      <g className="il-obj">
        <g transform="rotate(14 80 60)">
          <path className="il-papel il-esc" transform="translate(32 6) scale(4)" d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z" />
          <circle className="il-forte il-sem-traco" cx="80" cy="78" r="9" />
          <rect className="il-forte il-sem-traco" x="77" y="40" width="6" height="40" rx="3" />
          <path className="il-fraco" d="M95 32h7M95 44h7M95 56h7" />
        </g>
      </g>
      <path className="il-dois-linha" d="M118 50c4 4 4 9 0 13s-4 9 0 13M130 44c4 4 4 9 0 13s-4 9 0 13" />
      <Brilho x={42} y={38} r={6} atraso={300} />
      <Ponto x={40} y={92} />
    </>
  ),
  documentos: (
    <>
      <g className="il-obj">
        <rect className="il-dois" x="42" y="16" width="76" height="46" rx="10" transform="rotate(-6 80 39)" />
        <rect className="il-suave" x="34" y="30" width="88" height="52" rx="11" transform="rotate(3 78 56)" />
        <rect className="il-papel" x="26" y="46" width="100" height="58" rx="12" />
        <rect className="il-forte il-sem-traco" x="38" y="60" width="20" height="15" rx="4" />
        <path className="il-fraco" d="M38 86h44M38 94h28" />
        <circle className="il-forte" cx="120" cy="98" r="12" />
        <path className="il-linha il-claro" d="M120 92v12M114 98h12" />
      </g>
      <Brilho x={136} y={34} r={6} atraso={300} />
      <Ponto x={22} y={32} />
    </>
  ),
  cofrinho: (
    <>
      <g className="il-obj">
        <circle className="il-dois" cx="80" cy="25" r="11" />
        <path className="il-linha" d="M80 20v10" />
        <path className="il-suave" d="M60 46l-5-13 15 6" />
        <rect className="il-suave" x="52" y="86" width="12" height="18" rx="5" />
        <rect className="il-suave" x="90" y="86" width="12" height="18" rx="5" />
        <ellipse className="il-suave" cx="78" cy="70" rx="40" ry="29" />
        <rect className="il-forte" x="111" y="60" width="13" height="19" rx="6.5" />
        <path className="il-linha" d="M116 66v.5M119.5 72v.5" />
        <circle className="il-olho" cx="100" cy="59" r="3.2" />
        <path className="il-linha" d="M70 47h16" />
        <path className="il-linha" d="M38 66c-8-1-10 7-4 8s5-7-1-8" />
      </g>
      <Brilho x={122} y={30} r={6.5} atraso={300} />
      <Brilho x={40} y={34} r={4.5} atraso={420} />
    </>
  ),
  agenda: (
    <>
      <g className="il-obj">
        <rect className="il-papel" x="34" y="26" width="92" height="76" rx="13" />
        <path className="il-forte" d="M34 39a13 13 0 0 1 13-13h66a13 13 0 0 1 13 13v8H34z" />
        <rect className="il-linha" x="34" y="26" width="92" height="76" rx="13" />
        <path className="il-linha" d="M58 18v14M102 18v14" />
        <g className="il-grade">
          <circle cx="54" cy="62" r="3.4" />
          <circle cx="70" cy="62" r="3.4" />
          <circle cx="86" cy="62" r="3.4" />
          <circle cx="102" cy="62" r="3.4" />
          <circle cx="54" cy="80" r="3.4" />
          <circle cx="70" cy="80" r="3.4" />
          <circle cx="86" cy="80" r="3.4" />
        </g>
        <circle className="il-dois" cx="105" cy="81" r="11" />
        <path className="il-linha" d="M105 87c-2.5-2-6-4.2-6-7.4a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 3.2-3.5 5.4-6 7.4z" />
      </g>
      <Brilho x={138} y={50} r={6} atraso={300} />
      <Ponto x={24} y={70} />
    </>
  ),
  primeiras: (
    <>
      <g className="il-obj">
        <path className="il-suave il-esc" transform="translate(32 10) scale(4)" d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />
        <circle className="il-olho" cx="72" cy="57" r="3" />
        <circle className="il-olho" cx="88" cy="57" r="3" />
        <path className="il-linha" d="M74 66c3 3.5 9 3.5 12 0" />
        <circle className="il-dois il-sem-traco" cx="66" cy="66" r="3.5" opacity="0.8" />
        <circle className="il-dois il-sem-traco" cx="94" cy="66" r="3.5" opacity="0.8" />
      </g>
      <Brilho x={126} y={28} r={7} atraso={250} />
      <Brilho x={34} y={44} r={5} atraso={380} />
      <Brilho x={128} y={90} r={4} atraso={500} />
      <Ponto x={36} y={92} />
    </>
  ),
  fotos: (
    <>
      <g className="il-obj">
        <g transform="rotate(9 100 56)">
          <rect className="il-papel" x="72" y="22" width="56" height="66" rx="7" />
          <rect className="il-dois il-sem-traco" x="78" y="28" width="44" height="40" rx="4" />
        </g>
        <g transform="rotate(-7 62 66)">
          <rect className="il-papel" x="32" y="30" width="60" height="72" rx="7" />
          <rect className="il-suave il-sem-traco" x="38" y="36" width="48" height="44" rx="4" />
          <circle className="il-forte il-sem-traco" cx="51" cy="49" r="5.5" />
          <path className="il-linha" d="M38 74l14-12 10 8 8-6 16 12" />
          <path className="il-fraco" d="M44 91h22" />
        </g>
      </g>
      <Brilho x={136} y={98} r={6} atraso={300} />
      <Ponto x={26} y={40} />
    </>
  ),
  leite: (
    <>
      <g className="il-obj">
        <path className="il-papel" d="M57 26h38v9l7 11v46a11 11 0 0 1-11 11H61a11 11 0 0 1-11-11V46l7-11z" />
        <path className="il-suave il-sem-traco" d="M51.5 64h49v28a9.5 9.5 0 0 1-9.5 9.5H61a9.5 9.5 0 0 1-9.5-9.5z" />
        <path className="il-linha" d="M57 26h38v9l7 11v46a11 11 0 0 1-11 11H61a11 11 0 0 1-11-11V46l7-11z" />
        <path className="il-fraco" d="M57 35h38" />
        <path className="il-papel" d="M76 70c-4 5-6.5 8.5-6.5 11.5a6.5 6.5 0 0 0 13 0c0-3-2.5-6.5-6.5-11.5z" />
        <path className="il-dois-linha" d="M124 40v28M112 47l24 14M112 61l24-14" />
      </g>
      <Brilho x={34} y={40} r={6} atraso={300} />
      <Ponto x={126} y={90} />
    </>
  ),
  'sem-internet': (
    <>
      <g className="il-obj">
        <path className="il-papel" d="M50 94h62a20 20 0 0 0 3-39.8A28 28 0 0 0 62 48a22 22 0 0 0-12 46z" />
        <path className="il-fraco" d="M70 76a14 14 0 0 1 20 0M64 68a22 22 0 0 1 32 0" />
        <circle className="il-forte il-sem-traco" cx="80" cy="84" r="3.5" />
        <path className="il-corte" d="M46 30l70 70" />
      </g>
      <Brilho x={128} y={30} r={6} atraso={300} />
      <Ponto x={32} y={60} />
    </>
  ),
};

/** Só o desenho (para usar dentro de um layout próprio) */
export function Ilustracao({ nome, classe }: { nome: NomeIlustracao; classe?: string }) {
  const [cor, cor2] = CORES[nome];
  const fundo = FUNDOS[(nome.length + nome.charCodeAt(0)) % FUNDOS.length];
  return (
    <svg
      className={`ilustracao il-${nome}${classe ? ` ${classe}` : ''}`}
      viewBox="0 0 160 120"
      aria-hidden="true"
      focusable="false"
      style={{ '--il-cor': varCor(cor), '--il-cor2': varCor(cor2) } as CSSProperties}
    >
      <path className="il-fundo" d={fundo} />
      {desenhos[nome]}
    </svg>
  );
}

/**
 * Tela/trecho vazio: desenho, título e um texto curto (e uma ação, se houver).
 * `compacto`: desenho pequeno ao lado do texto (dentro de listas e cartões com outras coisas).
 * `solto`: sem o cartão em volta (quando já está dentro de um cartão).
 */
export function EstadoVazio({
  ilustracao,
  titulo,
  texto,
  acao,
  compacto,
  solto,
  classe,
}: {
  ilustracao: NomeIlustracao;
  titulo?: ReactNode;
  texto?: ReactNode;
  acao?: ReactNode;
  compacto?: boolean;
  solto?: boolean;
  classe?: string;
}) {
  return (
    <div className={['ev', compacto ? 'ev-compacto' : '', solto ? 'ev-solto' : 'cartao', classe ?? ''].filter(Boolean).join(' ')}>
      <Ilustracao nome={ilustracao} />
      <div className="ev-texto">
        {titulo && <strong className="ev-titulo">{titulo}</strong>}
        {texto && <p className="ev-detalhe">{texto}</p>}
        {acao && <div className="ev-acao">{acao}</div>}
      </div>
    </div>
  );
}
