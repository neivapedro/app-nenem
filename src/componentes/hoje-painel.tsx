// Painel ao vivo da tela Hoje: anel até a próxima alimentação, faixa das
// últimas 24 h e os números do dia em mini-anéis (comparados com a média).
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import '../estilos/hoje.css';
import { linhaDoTempo } from '../lib/painel';
import { useZoom } from '../lib/zoom';
import { aproximar, duracaoCurta, horaPrevista, painelAlimentacao, progresso, JANELA_PREVISAO_H, type MediasDia } from '../lib/hoje';
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

interface Numero {
  chave: string;
  rotulo: ReactNode;
  nomeLido: string;
  valor: string;
  /** O valor na tela (conta até o número na 1ª vez que a tela aparece) */
  exibir: ReactNode;
  /** "de ~9" */
  referencia: string | null;
  arcos: Arco[];
}

const contagem = (n: number) => String(Math.round(n));
const duracaoOuNada = (ms: number) => (ms ? duracaoCurta(ms) : '—');
const mlOuNada = (ml: number) => (ml ? `${Math.round(ml)} ml` : '—');

export function NumerosDoDia({ resumo, medias, nascido }: { resumo: ResumoDia; medias: MediasDia | null; nascido: boolean }) {
  const anima = (chave: string, valor: number, formatar: (n: number) => string, minimo?: number) => (
    <NumeroAnimado valor={valor} formatar={formatar} chave={`hoje:${chave}`} minimo={minimo} />
  );
  const ref = (v: number, tipo: 'contagem' | 'ml' | 'duracao') => (medias && v > 0 ? `de ~${aproximar(v, tipo)}` : null);
  const itens: Numero[] = [
    {
      chave: 'alimentacoes',
      rotulo: 'Alimentações',
      nomeLido: 'Alimentações',
      valor: String(resumo.alimentacoes),
      exibir: anima('alimentacoes', resumo.alimentacoes, contagem),
      referencia: ref(medias?.alimentacoes ?? 0, 'contagem'),
      arcos: [{ fracao: progresso(resumo.alimentacoes, medias?.alimentacoes), cor: 'var(--c-mamada)' }],
    },
    {
      chave: 'peito',
      rotulo: 'No peito',
      nomeLido: 'No peito',
      valor: duracaoOuNada(resumo.peitoMs),
      exibir: anima('peito', resumo.peitoMs, duracaoOuNada, 60_000),
      referencia: ref(medias?.peitoMs ?? 0, 'duracao'),
      arcos: [{ fracao: progresso(resumo.peitoMs, medias?.peitoMs), cor: 'var(--c-mamada)' }],
    },
    {
      chave: 'mamadeira',
      rotulo: 'Mamadeira',
      nomeLido: 'Mamadeira',
      valor: mlOuNada(resumo.ml),
      exibir: anima('ml', resumo.ml, mlOuNada),
      referencia: ref(medias?.ml ?? 0, 'ml'),
      arcos: [{ fracao: progresso(resumo.ml, medias?.ml), cor: 'var(--c-mamadeira)' }],
    },
    {
      chave: 'fraldas',
      rotulo: 'Fraldas',
      nomeLido: 'Fraldas',
      valor: String(resumo.fraldas),
      exibir: anima('fraldas', resumo.fraldas, contagem),
      referencia: ref(medias?.fraldas ?? 0, 'contagem'),
      arcos: [{ fracao: progresso(resumo.fraldas, medias?.fraldas), cor: 'var(--c-fralda)' }],
    },
    {
      chave: 'xixi-coco',
      // As bolinhas são a legenda dos dois anéis (xixi por fora, cocô por dentro)
      rotulo: (
        <>
          <i className="hp-ponto" style={{ background: 'var(--c-fralda)' }} />
          Xixi · <i className="hp-ponto" style={{ background: 'var(--c-mamadeira)' }} />
          cocô
        </>
      ),
      nomeLido: 'Xixi e cocô',
      valor: `${resumo.xixi} · ${resumo.coco}`,
      exibir: (
        <>
          {anima('xixi', resumo.xixi, contagem)} · {anima('coco', resumo.coco, contagem)}
        </>
      ),
      referencia: medias && medias.xixi + medias.coco > 0 ? `de ~${aproximar(medias.xixi, 'contagem')} · ~${aproximar(medias.coco, 'contagem')}` : null,
      arcos: [
        { fracao: progresso(resumo.xixi, medias?.xixi), cor: 'var(--c-fralda)' },
        { fracao: progresso(resumo.coco, medias?.coco), cor: 'var(--c-mamadeira)' },
      ],
    },
    {
      chave: 'sono',
      rotulo: 'Sono',
      nomeLido: 'Sono',
      valor: duracaoOuNada(resumo.sonoMs),
      exibir: anima('sono', resumo.sonoMs, duracaoOuNada, 60_000),
      referencia: ref(medias?.sonoMs ?? 0, 'duracao'),
      arcos: [{ fracao: progresso(resumo.sonoMs, medias?.sonoMs), cor: 'var(--c-sono)' }],
    },
  ];

  return (
    <>
      <div className="hp-numeros">
        {itens.map((it, i) => (
          <div key={it.chave} className="hp-numero hp-entra" style={{ '--hp-i': i + 2 } as CSSProperties}>
            <Anel
              arcos={it.arcos}
              espessura={it.arcos.length > 1 ? 10 : 12}
              classe="hp-anel-mini"
              rotulo={`${it.nomeLido}: ${it.valor === '—' ? 'nada' : it.valor} hoje${it.referencia ? `, ${it.referencia.replace('de ', 'média de ').replace(/~/g, '')} por dia` : ''}`}
            />
            <div className="hp-numero-rotulo">{it.rotulo}</div>
            <div className="hp-numero-valor">{it.exibir}</div>
            {medias && <div className="hp-numero-ref">{it.referencia ?? ' '}</div>}
          </div>
        ))}
      </div>
      {nascido && (
        <p className="hp-numeros-nota">
          {medias ? `Anéis: hoje comparado com a média ${medias.dias === 1 ? 'de 1 dia' : `dos últimos ${medias.dias} dias`}.` : 'A comparação com a média aparece a partir de amanhã.'}
        </p>
      )}
    </>
  );
}
