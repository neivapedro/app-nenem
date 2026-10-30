// Painel ao vivo da tela Hoje: anel até a próxima alimentação, faixa das
// últimas 24 h e os números do dia em mini-anéis (comparados com a média).
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import '../estilos/hoje.css';
import { linhaDoTempo } from '../lib/painel';
import { useZoom } from '../lib/zoom';
import { duracaoCurta, horaPrevista, painelAlimentacao, JANELA_PREVISAO_H, type MediasDia } from '../lib/hoje';
import type { ResumoDia } from '../lib/registros';
import type { Registro } from '../lib/tipos';
import { NumeroAnimado } from './numero-animado';
import { LinhaTempo } from './painel';
import { Icone } from './ui';

const HORA = 3_600_000;

// ---------- Anel ----------

interface Arco {
  fracao: number;
  cor: string;
}

/** Anel de progresso (um ou dois arcos concêntricos). O texto vai por cima, em HTML. */
export function Anel({ arcos, espessura = 8, rotulo, classe, children }: { arcos: Arco[]; espessura?: number; rotulo: string; classe?: string; children?: ReactNode }) {
  const folga = 3;
  return (
    <span className={`hp-anel ${classe ?? ''}`}>
      <svg viewBox="0 0 100 100" role="img" aria-label={rotulo}>
        {arcos.map((a, i) => {
          const r = 50 - espessura / 2 - 1 - i * (espessura + folga);
          const c = 2 * Math.PI * r;
          const f = Math.min(1, Math.max(0, a.fracao));
          return (
            <g key={i} style={{ '--hp-arco-cor': a.cor } as CSSProperties}>
              <circle cx={50} cy={50} r={r} className="hp-trilho" strokeWidth={espessura} />
              {f > 0.004 && (
                <circle
                  cx={50}
                  cy={50}
                  r={r}
                  className="hp-arco"
                  strokeWidth={espessura}
                  strokeDasharray={c}
                  transform="rotate(-90 50 50)"
                  style={{ strokeDashoffset: c * (1 - f), '--hp-c': c, animationDelay: `${i * 90}ms` } as CSSProperties}
                />
              )}
            </g>
          );
        })}
      </svg>
      {children && <span className="hp-anel-centro">{children}</span>}
    </span>
  );
}

// ---------- Próxima alimentação ----------

const COR_ESTADO = { cedo: 'var(--c-mamada)', perto: 'var(--aviso)', passou: 'var(--ruim)' } as const;

export function CartaoProximaMamada({ registros, agora, aoTocar }: { registros: Registro[]; agora: Date; aoTocar: () => void }) {
  const p = painelAlimentacao(registros, agora);

  if (!p)
    return (
      <button type="button" className="hp-proxima hp-entra hp-cedo" onClick={aoTocar}>
        <Anel arcos={[{ fracao: 0, cor: COR_ESTADO.cedo }]} espessura={9} rotulo="Nenhuma alimentação registrada" classe="hp-anel-grande">
          <span className="hp-centro-icone">
            <Icone nome="mamada" />
          </span>
        </Anel>
        <span className="hp-proxima-texto">
          <span className="hp-rotulo">Alimentação</span>
          <span className="hp-ultima">Nenhuma registrada ainda</span>
          <span className="hp-dica">Toque para registrar a primeira mamada. Com alguns registros, o app prevê a próxima.</span>
        </span>
      </button>
    );

  const nome = p.ultima.tipo === 'mamada' ? 'Última mamada' : 'Última mamadeira';
  const ha = p.desdeMs < 60_000 ? 'agora' : `há ${duracaoCurta(p.desdeMs)}`;
  const hora = horaPrevista(p);
  const cor = COR_ESTADO[p.estado];
  const centro =
    p.faltaMs === null
      ? { valor: duracaoCurta(p.desdeMs), ms: p.desdeMs, sinal: '', legenda: 'desde' }
      : p.faltaMs > 0
        ? { valor: duracaoCurta(p.faltaMs), ms: p.faltaMs, sinal: '', legenda: 'faltam' }
        : { valor: `+${duracaoCurta(-p.faltaMs)}`, ms: -p.faltaMs, sinal: '+', legenda: 'passou' };
  const rotuloAnel =
    p.faltaMs === null
      ? `${nome} ${ha}`
      : `${Math.round(p.fracao * 100)}% do intervalo médio; ${p.faltaMs > 0 ? `faltam ${duracaoCurta(p.faltaMs)}` : `passou ${duracaoCurta(-p.faltaMs)} do horário previsto`}`;

  return (
    <button type="button" className={`hp-proxima hp-entra hp-${p.estado}`} style={{ '--hp-cor': cor } as CSSProperties} onClick={aoTocar}>
      <Anel arcos={[{ fracao: p.fracao, cor }]} espessura={9} rotulo={rotuloAnel} classe="hp-anel-grande">
        <span className={`hp-centro-valor ${centro.valor.length >= 7 ? 'hp-longo' : ''}`}>
          <NumeroAnimado valor={centro.ms} formatar={(n) => `${centro.sinal}${duracaoCurta(n)}`} chave="hoje:proxima" minimo={60_000} />
        </span>
        <span className="hp-centro-legenda">{centro.legenda}</span>
      </Anel>
      <span className="hp-proxima-texto">
        <span className="hp-rotulo">{nome}</span>
        <span className="hp-ultima">
          <span className="hp-sem-quebra">{ha}</span>
          {p.detalhe && (
            <>
              {' · '}
              <span className="hp-sem-quebra">{p.detalhe}</span>
            </>
          )}
        </span>
        {hora ? (
          <>
            <span className="hp-rotulo hp-espaco">{p.estado === 'passou' ? 'Prevista para' : 'Próxima por volta de'}</span>
            <span className="hp-hora">{hora}</span>
          </>
        ) : (
          <span className="hp-dica">
            {p.desdeMs > 12 * 3_600_000 ? 'Faz tempo desde a última: registre a próxima para o app voltar a prever.' : 'Com mais alguns registros, o app prevê a próxima.'}
          </span>
        )}
      </span>
      <span className="hp-rodape">
        <span className="hp-rodape-texto">{p.intervaloMs ? `Intervalo médio ${duracaoCurta(p.intervaloMs)} · últimas ${JANELA_PREVISAO_H} h` : 'Registrar mamada'}</span>
        <span className="hp-rodape-acao">
          {p.intervaloMs ? 'Registrar' : ''}
          <Icone nome="seta" />
        </span>
      </span>
    </button>
  );
}

// ---------- Últimas 24 h ----------

export function Faixa24h({ registros, agora }: { registros: Registro[]; agora: Date }) {
  // Recalcula a cada minuto (o "agora" da tela muda a cada 30 s)
  const minuto = Math.floor(agora.getTime() / 60_000);
  const lt = useMemo(() => {
    const ate = new Date(minuto * 60_000);
    const de = new Date(ate.getTime() - 24 * HORA);
    const total = ate.getTime() - de.getTime();
    const marcas: { em: number; texto: string }[] = [];
    const primeira = new Date(de);
    primeira.setMinutes(0, 0, 0);
    for (let t = primeira.getTime() + HORA; t < ate.getTime(); t += HORA) {
      const h = new Date(t).getHours();
      if (h % 6 === 0) marcas.push({ em: (t - de.getTime()) / total, texto: `${h}h` });
    }
    return { ...linhaDoTempo(registros, de, ate, ate), marcas, agoraFracao: 1 };
  }, [registros, minuto]);
  // "Padrões": o cartão das últimas 24 h cresce e vira os Gráficos
  const zoom = useZoom('/mais/resumo', { cartao: '.cartao' });

  return (
    <section className="cartao hp-entra hp-faixa" style={{ '--hp-i': 1 } as CSSProperties} aria-label="Últimas 24 horas">
      <div className="cartao-cab">
        <h2>Últimas 24 h</h2>
        <Link to="/mais/resumo" className="botao pequeno texto" {...zoom}>
          Padrões <Icone nome="seta" />
        </Link>
      </div>
      <LinhaTempo {...lt} />
    </section>
  );
}

// ---------- Números do dia ----------

const contagem = (n: number) => String(Math.round(n));
const duracaoOuNada = (ms: number) => (ms ? duracaoCurta(ms) : '—');

/** "▲ 12% vs. média": discreto; dentro de 5% da média vira "na média" */
function comparacao(valor: number, media: number | null | undefined, andamentoDoDia = 1): { texto: string; sufixo: string; sentido: 'sobe' | 'desce' | 'igual' } | null {
  if (media === null || media === undefined || !Number.isFinite(media) || media <= 0 || valor <= 0) return null;
  // O dia ainda não acabou: compara com o que a média costuma ter até esta hora (senão de manhã tudo parece "▼")
  if (andamentoDoDia < 0.5) return null;
  const esperado = media * Math.min(1, andamentoDoDia);
  const pct = Math.round(((valor - esperado) / esperado) * 100);
  if (Math.abs(pct) < 8) return { texto: 'na média', sufixo: '', sentido: 'igual' };
  return { texto: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%`, sufixo: andamentoDoDia < 1 ? ' vs. ritmo médio' : ' vs. média', sentido: pct > 0 ? 'sobe' : 'desce' };
}

export function NumerosDoDia({ resumo, medias, nascido }: { resumo: ResumoDia; medias: MediasDia | null; nascido: boolean }) {
  const anima = (chave: string, valor: number, formatar: (n: number) => string, minimo?: number) => (
    <NumeroAnimado valor={valor} formatar={formatar} chave={`hoje:${chave}`} minimo={minimo} />
  );
  const agoraDia = new Date();
  const andamento = (agoraDia.getHours() * 60 + agoraDia.getMinutes()) / 1440;
  const colunas = [
    { chave: 'alimentacoes', rotulo: 'Alimentações', valor: resumo.alimentacoes, texto: String(resumo.alimentacoes), exibir: anima('alimentacoes', resumo.alimentacoes, contagem), cmp: comparacao(resumo.alimentacoes, medias?.alimentacoes, andamento) },
    { chave: 'fraldas', rotulo: 'Fraldas', valor: resumo.fraldas, texto: String(resumo.fraldas), exibir: anima('fraldas', resumo.fraldas, contagem), cmp: comparacao(resumo.fraldas, medias?.fraldas, andamento) },
    { chave: 'sono', rotulo: 'Sono', valor: resumo.sonoMs, texto: duracaoOuNada(resumo.sonoMs), exibir: anima('sono', resumo.sonoMs, duracaoOuNada, 60_000), cmp: comparacao(resumo.sonoMs, medias?.sonoMs, andamento) },
  ];
  // Detalhes que saíram dos números grandes: uma linha de texto cinza pequena
  const detalhes = [
    resumo.peitoMs ? `No peito ${duracaoCurta(resumo.peitoMs)}` : null,
    resumo.ml ? `Mamadeira ${Math.round(resumo.ml)} ml` : null,
    resumo.fraldas ? `Xixi ${resumo.xixi} · cocô ${resumo.coco}` : null,
  ].filter(Boolean);

  return (
    <>
      <div className="hp-numeros">
        {colunas.map((c, i) => (
          <div key={c.chave} className="hp-numero hp-entra" style={{ '--hp-i': i + 2 } as CSSProperties} role="group" aria-label={`${c.rotulo}: ${c.texto === '—' ? 'nada' : c.texto} hoje${c.cmp ? `, ${c.cmp.texto.replace('▲', 'acima:').replace('▼', 'abaixo:')}${c.cmp.sufixo}` : ''}`}>
            <div className="hp-numero-valor">{c.exibir}</div>
            <div className="hp-numero-rotulo">{c.rotulo}</div>
            <div className={`hp-numero-ref ${c.cmp?.sentido ?? ''}`}>{c.cmp?.texto ?? ' '}
              {c.cmp?.sufixo && <span className="hp-ref-suf">{c.cmp.sufixo}</span>}
            </div>
          </div>
        ))}
      </div>
      {detalhes.length > 0 && <p className="hp-numeros-nota">{detalhes.join(' · ')}</p>}
      {medias && <p className="hp-numeros-nota">▲▼ comparação com a média {medias.dias === 1 ? 'de 1 dia' : `dos últimos ${medias.dias} dias`}.</p>}
      {nascido && !medias && <p className="hp-numeros-nota">A comparação com a média dos últimos 7 dias aparece a partir de amanhã.</p>}
    </>
  );
}
