/** Botões que abrem a retrospectiva do ano (a tela em si é carregada só quando abre) */
import { lazy, Suspense, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDados } from '../dados/contexto';
import { ordinalAno, periodoRetrospectiva, quemE, tituloRetrospectiva } from '../lib/retrospectiva';
import { Icone } from './ui';

const Retrospectiva = lazy(() => import('./retrospectiva'));

/** Tela de espera (enquanto baixa a tela e, depois, enquanto busca os registros do ano) */
export function CarregandoRetro({ texto, aoFechar }: { texto: string; aoFechar?: () => void }) {
  return (
    <div className="retro-espera" role="status" aria-live="polite">
      {aoFechar && (
        <button type="button" className="retro-botao retro-espera-x" onClick={aoFechar} aria-label="Fechar">
          <Icone nome="fechar" />
        </button>
      )}
      <div className="retro-espera-bolhas" aria-hidden="true">
        <span>🍼</span>
        <span>🌙</span>
        <span>⭐</span>
      </div>
      <p className="retro-espera-texto">{texto}</p>
      <div className="retro-espera-barra" aria-hidden="true">
        <span />
      </div>
    </div>
  );
}

/** A retrospectiva em tela cheia (`ano` = um ano fechado; sem ele, o que fizer sentido hoje) */
export function AbrirRetrospectiva({ ano, aoFechar }: { ano?: number; aoFechar: () => void }) {
  return createPortal(
    <Suspense fallback={<CarregandoRetro texto="Abrindo a retrospectiva…" aoFechar={aoFechar} />}>
      <Retrospectiva ano={ano} aoFechar={aoFechar} />
    </Suspense>,
    document.body,
  );
}

/**
 * Cartão de entrada (Desenvolvimento → Marcos): do 1º aniversário em diante, a retrospectiva do
 * último ano completo; entre 3 e 11 meses, a "Retrospectiva até agora". Antes disso, nada.
 */
export function CartaoRetrospectiva() {
  const { bebe, hoje } = useDados();
  const [aberta, setAberta] = useState(false);
  const periodo = useMemo(() => periodoRetrospectiva(bebe?.nascimento, hoje), [bebe?.nascimento, hoje]);
  if (!bebe || !periodo) return null;
  const q = quemE(bebe);
  const titulo = periodo.completo ? `Retrospectiva do ${periodo.ano}º ano` : 'Retrospectiva até agora';
  const detalhe = periodo.completo ? `Reviva o ${ordinalAno(periodo.ano)} ano ${q.do}, tela por tela` : `${tituloRetrospectiva(periodo, bebe)}, em números e fotos`;
  return (
    <>
      <button type="button" className={`retro-entrada ${periodo.completo ? 'completa' : ''}`} onClick={() => setAberta(true)}>
        <span className="retro-entrada-emoji" aria-hidden="true">
          {periodo.completo ? '🎂' : '✨'}
        </span>
        <span className="cresce">
          <strong>{titulo}</strong>
          <span>{detalhe}</span>
        </span>
        <Icone nome="tocar" />
      </button>
      {aberta && <AbrirRetrospectiva ano={periodo.completo ? periodo.ano : undefined} aoFechar={() => setAberta(false)} />}
    </>
  );
}

/** Botão da comemoração do aniversário de anos */
export function BotaoRetrospectiva({ ano, aoAbrir }: { ano: number; aoAbrir: () => void }) {
  return (
    <button type="button" className="botao retro-botao-aniversario" onClick={aoAbrir}>
      <span aria-hidden="true">✨</span> Ver a retrospectiva {ano === 1 ? 'do ano' : `do ${ano}º ano`}
    </button>
  );
}
