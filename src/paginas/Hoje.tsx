import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { calendarioDoBebe } from '../../supabase/functions/_shared/vacinas.ts';
import { prazoTarefa, TAREFAS_PADRAO } from '../../supabase/functions/_shared/primeiros-dias.ts';
import { FolhaBebe } from '../componentes/bebe';
import { CartaoProximaMamada, Faixa24h, NumerosDoDia } from '../componentes/hoje-painel';
import { MomentosDoDia } from '../componentes/momentos';
import { RelogioDia } from '../componentes/relogio-dia';
import { DivisaoDaSemana } from '../componentes/divisao';
import { FolhaRegistroMais } from '../componentes/registrar-mais';
import { CartaoMamadaAtiva, CartaoSonoAtivo, FolhaEditar, FolhaFralda, FolhaMamada, FolhaMamadeira, FolhaQueHorasTerminou, FolhaSono } from '../componentes/registrar';
import { Icone, Selo } from '../componentes/ui';
import { FolhaEditarHoje } from '../componentes/editar-hoje';
import { MenuRapido, useSegurar, type Ponto } from '../componentes/menu-rapido';
import { useAgora, useDados } from '../dados/contexto';
import { proximosCompromissos, textoQuando } from '../lib/agenda';
import { useZoom } from '../lib/zoom';
import { duracaoCurta, mediasUltimosDias } from '../lib/hoje';
import { chaveDia, dataBr, diasEntre, haQuanto, horaCurta, semanasGestacao, somarDiasLocal, textoDuracao } from '../lib/datas';
import { DicaInstalar } from '../componentes/dica-instalar';
import { emEstoque, proximaDose, remedioEmUso, situacaoPote } from '../lib/saude';
import { cronometroEsquecido, descrever, emAndamento, ladoFinal, ordenarRecentes, resumoDia, textoFralda, ultimaAlimentacao, ultimoDoTipo } from '../lib/registros';
import type { Registro, TipoRegistro } from '../lib/tipos';
import { aplicarAtalho, atalhosPara, type Atalho, type TipoAtalho } from '../lib/atalhos-rapidos';
import { CHAVE_LAYOUT_HOJE, ehPadrao, layoutPadrao, lerLayout, ordemNaTela, serializarLayout, type IdCartaoHoje, type LayoutHoje } from '../lib/hoje-layout';

type Folhas = TipoRegistro | null;

const TITULO_ATALHO: Record<TipoAtalho, string> = { mamada: 'Mamada', mamadeira: 'Mamadeira', fralda: 'Fralda', sono: 'Sono', remedio: 'Remédio', extracao: 'Extração' };

function lerLayoutSalvo(): LayoutHoje {
  try {
    return lerLayout(localStorage.getItem(CHAVE_LAYOUT_HOJE));
  } catch {
    return layoutPadrao();
  }
}

/** Lembretes do dia: vacina, remédio, leite e primeiros dias (só o que pede ação) */
function Pendencias() {
  const { bebe, vacinas, remedios, registros, leite, tarefas, hoje } = useDados();
  const agora = useAgora(60_000);
  const itens: { chave: string; para: string; titulo: string; detalhe: string; urgente?: boolean }[] = [];

  const nasc = bebe?.nascimento ? chaveDia(bebe.nascimento) : null;
  if (bebe && nasc) {
    const todas = calendarioDoBebe(nasc, bebe.calendario_vacinal, vacinas, hoje);
    const soAtrasadas = todas.filter((d) => d.situacao === 'atrasada');
    const pend = soAtrasadas.length ? soAtrasadas : todas.filter((d) => d.situacao === 'agora' || (d.situacao === 'proxima' && diasEntre(hoje, d.prevista) <= 7));
    if (pend.length) {
      const atrasadas = pend.filter((d) => d.situacao === 'atrasada').length;
      itens.push({
        chave: 'vacinas',
        para: '/saude?aba=vacinas',
        titulo: atrasadas ? `${atrasadas} ${atrasadas === 1 ? 'vacina atrasada' : 'vacinas atrasadas'}` : pend[0].situacao === 'agora' ? 'Vacina para tomar' : 'Vacina chegando',
        detalhe: pend.map((d) => d.dose.vacina.split(' (')[0]).slice(0, 3).join(', ') + (pend[0].situacao === 'proxima' ? ` · a partir de ${dataBr(pend[0].prevista).slice(0, 5)}` : ''),
        urgente: atrasadas > 0,
      });
    }
  }
  for (const m of remedios.filter((x) => remedioEmUso(x, hoje) && x.intervalo_h)) {
    const p = proximaDose(m, registros);
    if (!p) continue;
    const falta = new Date(p).getTime() - agora.getTime();
    if (falta <= 60 * 60_000) {
      itens.push({ chave: `rem-${m.id}`, para: '/saude?aba=remedios', titulo: `${m.nome}${m.dose ? ` (${m.dose})` : ''}`, detalhe: falta < 0 ? `dose passou há ${textoDuracao(-falta)}` : `próxima dose às ${horaCurta(p)}`, urgente: falta < 0 });
    }
  }
  const vencendo = emEstoque(leite).filter((x) => situacaoPote(x, agora) !== 'ok');
  if (vencendo.length) {
    const vencidos = vencendo.filter((x) => situacaoPote(x, agora) === 'vencido').length;
    itens.push({ chave: 'leite', para: '/mais/leite', titulo: vencidos ? `${vencidos} ${vencidos === 1 ? 'pote de leite venceu' : 'potes de leite venceram'}` : 'Leite vencendo logo', detalhe: `${vencendo.reduce((s, x) => s + x.ml, 0)} ml no estoque para usar ou descartar` });
  }
  if (nasc && diasEntre(nasc, hoje) <= 45) {
    const feitas = new Set(tarefas.filter((t) => t.item_id && t.feito_em).map((t) => t.item_id));
    const proximas = TAREFAS_PADRAO.filter((t) => !feitas.has(t.id) && t.prazo_dias !== undefined)
      .map((t) => ({ t, prazo: prazoTarefa(t, nasc)! }))
      .filter((x) => diasEntre(hoje, x.prazo) <= 3)
      .sort((a, b) => a.prazo.localeCompare(b.prazo));
    if (proximas.length) {
      itens.push({
        chave: 'primeiros',
        para: '/mais/primeiros-dias',
        titulo: `Primeiros dias: ${proximas.length} ${proximas.length === 1 ? 'pendência' : 'pendências'}`,
        detalhe: proximas.slice(0, 3).map((x) => x.t.titulo).join(', '),
        urgente: proximas.some((x) => x.prazo < hoje),
      });
    }
  }
  if (!itens.length) return null;
  return (
    <section className="cartao" aria-label="Pendências">
      <div className="lista">
        {itens.map((i) => (
          <ItemPendencia key={i.chave} {...i} />
        ))}
      </div>
    </section>
  );
}

/** Um item das pendências (componente próprio por causa do zoom, que é um hook) */
function ItemPendencia(i: { chave: string; para: string; titulo: string; detalhe: string; urgente?: boolean }) {
  const zoom = useZoom(i.para);
  return (
    <Link to={i.para} className="item" style={{ textDecoration: 'none', color: 'inherit' }} {...zoom}>
      <span className={`selo ${i.urgente ? '' : 't-agenda'}`} style={i.urgente ? { color: 'var(--ruim)', background: 'color-mix(in srgb, var(--ruim) 14%, transparent)' } : undefined}>
        <Icone nome={i.chave === 'vacinas' ? 'vacina' : i.chave === 'leite' ? 'extracao' : i.chave === 'primeiros' ? 'lista' : 'remedio'} />
      </span>
      <div className="cresce">
        <div className="titulo">{i.titulo}</div>
        <div className="detalhe">{i.detalhe}</div>
      </div>
      <Icone nome="seta" />
    </Link>
  );
}

function AntesDoParto() {
  const { bebe, hoje } = useDados();
  const [nasceu, setNasceu] = useState(false);
  if (!bebe) return null;
  const g = bebe.data_prevista ? semanasGestacao(bebe.data_prevista, hoje) : null;
  return (
    <section className="cartao contagem pilha" aria-label="Chegada do bebê">
      {g ? (
        <>
          <span className="rotulo">{g.faltam > 0 ? 'Faltam' : g.faltam === 0 ? 'Data prevista' : 'Data prevista passou há'}</span>
          <div className="grande">{g.faltam === 0 ? 'Hoje!' : `${Math.abs(g.faltam)} ${Math.abs(g.faltam) === 1 ? 'dia' : 'dias'}`}</div>
          <span className="texto-2">
            Hoje: {g.semanas} semanas{g.dias ? ` e ${g.dias} ${g.dias === 1 ? 'dia' : 'dias'}` : ''} de gestação
            <br />
            Previsão: {dataBr(bebe.data_prevista!)} · com 40 semanas
            {/* 37 semanas = a termo: a partir daí o bebê não é mais prematuro */}
            {g.semanas < 37 && (
              <>
                <br />
                37 semanas (deixa de ser prematuro) em {dataBr(somarDiasLocal(bebe.data_prevista!, -21))}
              </>
            )}
          </span>
        </>
      ) : (
        <span className="texto-2">Informe a data prevista do parto em Ajustes para ver a contagem.</span>
      )}
      <button className="botao primario" onClick={() => setNasceu(true)}>
        O bebê nasceu!
      </button>
      {nasceu && <FolhaBebe nascimento aoFechar={() => setNasceu(false)} />}
    </section>
  );
}

export function Hoje() {
  const { bebe, registros, compromissos, remedios, hoje, gravar, mostrarAviso, nomeDe, baseRegistro } = useDados();
  const agora = useAgora(30_000);
  const [folha, setFolha] = useState<Folhas>(null);
  const [mais, setMais] = useState<'remedio' | 'temperatura' | 'extracao' | 'refeicao' | null>(null);
  const comeIntroducao = bebe?.nascimento ? diasEntre(chaveDia(bebe.nascimento), hoje) >= 165 : false;
  const [editando, setEditando] = useState<Registro | null>(null);
  const andamento = emAndamento(registros);
  const resumo = resumoDia(registros, hoje, agora);
  const alimentacao = ultimaAlimentacao(registros);
  const fralda = ultimoDoTipo(registros, 'fralda');
  const sono = ultimoDoTipo(registros, 'sono');
  const mamadeira = ultimoDoTipo(registros, 'mamadeira');
  const recentes = ordenarRecentes(registros).slice(0, 5);
  const proximo = proximosCompromissos(compromissos, agora)[0];
  const nascido = !!bebe?.nascimento;
  // Média dos últimos 7 dias completos (muda só quando chega registro ou vira o dia)
  const medias = useMemo(() => (nascido ? mediasUltimosDias(registros, hoje, new Date(), bebe?.nascimento ?? null) : null), [registros, hoje, nascido, bebe?.nascimento]);

  // Subtítulo dos cartões: 2 linhas fixas (quando · detalhe). Linha vazia fica reservada com espaço.
  const desdeAlimentacao: [string, string] = andamento.mamada
    ? ['em andamento', 'cronômetro ligado']
    : alimentacao
      ? [haQuanto(alimentacao.inicio, agora), alimentacao.tipo === 'mamada' ? (ladoFinal(alimentacao) ? `terminou no ${ladoFinal(alimentacao)}` : 'no peito') : `${alimentacao.dados.ml} ml`]
      : ['nenhuma ainda', 'toque para começar'];
  const desdeMamadeira: [string, string] = mamadeira ? [haQuanto(mamadeira.inicio, agora), resumo.ml ? `${Math.round(resumo.ml)} ml hoje` : 'leite ou fórmula'] : ['nenhuma ainda', 'leite ou fórmula'];
  const desdeFralda: [string, string] = fralda ? [haQuanto(fralda.inicio, agora), textoFralda(fralda.dados)] : ['nenhuma ainda', 'xixi ou cocô'];
  const desdeSono: [string, string] = andamento.sono
    ? [`dormindo há ${duracaoCurta(Math.max(0, agora.getTime() - new Date(andamento.sono.inicio).getTime()))}`, 'toque p/ encerrar']
    : sono?.fim
      ? [haQuanto(sono.fim, agora), 'acordado']
      : ['nenhum ainda', 'toque para começar'];
  const Desde = ({ v }: { v: [string, string] }) => (
    <span className="desde">
      <span>{v[0]}</span>
      <span className="desde-2">{v[1]}</span>
    </span>
  );

  const [perguntarSono, setPerguntarSono] = useState(false);
  function acordou(quando?: Date) {
    if (!andamento.sono) return;
    const r = andamento.sono;
    // Contando há mais de 14 h: pergunta que horas acordou
    if (!quando && cronometroEsquecido(r, new Date())) return setPerguntarSono(true);
    setPerguntarSono(false);
    const fim = { ...r, fim: new Date(Math.max((quando ?? new Date()).getTime(), new Date(r.inicio).getTime())).toISOString() };
    gravar({ tipo: 'registro', dado: fim });
    mostrarAviso({ texto: `Sono salvo (${textoDuracao(new Date(fim.fim).getTime() - new Date(r.inicio).getTime(), true)})`, desfazer: () => gravar({ tipo: 'registro', dado: r }) });
  }

  // ---------- Hoje do jeito de vocês (ordem, escondidos e fixados; por aparelho) ----------
  const [layout, setLayout] = useState<LayoutHoje>(lerLayoutSalvo);
  const [editarHoje, setEditarHoje] = useState(false);
  function mudarLayout(l: LayoutHoje) {
    setLayout(l);
    try {
      if (ehPadrao(l)) localStorage.removeItem(CHAVE_LAYOUT_HOJE);
      else localStorage.setItem(CHAVE_LAYOUT_HOJE, serializarLayout(l));
    } catch {
      /* sem armazenamento: vale só até fechar */
    }
  }

  // ---------- Registro rápido: segurar o botão abre os atalhos de um toque ----------
  const [menu, setMenu] = useState<{ tipo: TipoAtalho; el: HTMLElement; dedo: Ponto | null; atalhos: Atalho[] } | null>(null);
  const segurar = useSegurar((chave, el, dedo) => {
    const tipo = chave as TipoAtalho;
    const atalhos = atalhosPara(tipo, { registros, agora: new Date(), remedios, hoje });
    if (!atalhos.length) return false;
    setMenu({ tipo, el, dedo, atalhos });
    return true;
  });
  function usarAtalho(a: Atalho) {
    const res = aplicarAtalho(a.acao, { registros, base: baseRegistro(), agora: new Date() });
    if (!res.ok) return mostrarAviso({ texto: res.texto });
    gravar(...res.ops);
    mostrarAviso({ texto: res.texto, desfazer: () => gravar(...res.desfazer) });
  }
  function abrirFormulario(tipo: TipoAtalho) {
    if (tipo === 'remedio' || tipo === 'extracao') setMais(tipo);
    else setFolha(tipo);
  }
  const dicaSegurar = { 'aria-describedby': 'hoje-dica-segurar' };
  // Zoom do cartão até a tela que ele abre (src/lib/zoom.ts); continua valendo com os cartões em outra ordem
  const zoomHistorico = useZoom('/historico', { cartao: '.cartao' });
  const zoomAgenda = useZoom('/agenda');
  const zoomChecklist = useZoom('/mais/primeiros-dias');

  const cartoes: Record<IdCartaoHoje, ReactNode> = {
    momentos: <MomentosDoDia />,
    // Painel ao vivo (depois do nascimento): a mamada em andamento já tem o cronômetro dela
    proxima: nascido && !andamento.mamada ? <CartaoProximaMamada registros={registros} agora={agora} aoTocar={() => setFolha('mamada')} /> : null,
    faixa24h: nascido ? <Faixa24h registros={registros} agora={agora} /> : null,
    relogio: nascido ? <RelogioDia registros={registros} agora={agora} /> : null,
    registrar: (
      <section className="acoes" aria-label="Registrar">
        <button className={`acao t-mamada ${andamento.mamada ? 'ativa' : ''}`} onClick={() => !andamento.mamada && setFolha('mamada')} disabled={!!andamento.mamada} {...segurar('mamada', !andamento.mamada)} {...dicaSegurar}>
          <Selo tipo="mamada" />
          <span className="nome">Mamada</span>
          <Desde v={desdeAlimentacao} />
        </button>
        <button className="acao t-mamadeira" onClick={() => setFolha('mamadeira')} {...segurar('mamadeira')} {...dicaSegurar}>
          <Selo tipo="mamadeira" />
          <span className="nome">Mamadeira</span>
          <Desde v={desdeMamadeira} />
        </button>
        <button className="acao t-fralda" onClick={() => setFolha('fralda')} {...segurar('fralda')} {...dicaSegurar}>
          <Selo tipo="fralda" />
          <span className="nome">Fralda</span>
          <Desde v={desdeFralda} />
        </button>
        <button className={`acao t-sono ${andamento.sono ? 'ativa' : ''}`} onClick={() => (andamento.sono ? acordou() : setFolha('sono'))} {...segurar('sono')} {...dicaSegurar}>
          <Selo tipo="sono" />
          <span className="nome">{andamento.sono ? 'Acordou' : 'Sono'}</span>
          <Desde v={desdeSono} />
        </button>
        <span id="hoje-dica-segurar" className="oculto-visual">
          Segure para ver atalhos de um toque.
        </span>
      </section>
    ),
    outros: (
      <section className="mais-registros" aria-label="Outros registros">
        {(['remedio', 'temperatura', 'extracao', ...(comeIntroducao ? (['refeicao'] as const) : [])] as const).map((t) => (
          <button key={t} className={`t-${t}`} onClick={() => setMais(t)} {...(t === 'remedio' || t === 'extracao' ? { ...segurar(t), ...dicaSegurar } : {})}>
            <Selo tipo={t} />
            {t === 'remedio' ? 'Remédio' : t === 'temperatura' ? 'Febre' : t === 'extracao' ? 'Extração' : 'Refeição'}
          </button>
        ))}
        {!comeIntroducao && (
          <Link to="/mais/primeiros-dias" {...zoomChecklist} className="t-agenda" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 4px', borderRadius: 14, border: '1px solid var(--borda)', background: 'var(--superficie)', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none', color: 'inherit' }}>
            <Selo tipo="agenda" icone="lista" />
            Checklist
          </Link>
        )}
      </section>
    ),
    avisos: <Pendencias />,
    resumo: (
      <section className="cartao" aria-label="Resumo de hoje">
        <div className="cartao-cab">
          <h2>Hoje</h2>
          <Link to="/historico" className="botao pequeno texto" {...zoomHistorico}>
            Histórico <Icone nome="seta" />
          </Link>
        </div>
        <NumerosDoDia resumo={resumo} medias={medias} nascido={nascido} />
      </section>
    ),
    divisao: nascido ? <DivisaoDaSemana /> : null,
    compromisso: proximo ? (
      <Link to="/agenda" className="cartao linha" style={{ textDecoration: 'none', color: 'inherit', flexWrap: 'nowrap' }} {...zoomAgenda}>
        <Selo tipo="agenda" />
        <div className="cresce">
          <div className="rotulo">Próximo compromisso</div>
          <div style={{ fontWeight: 600 }}>{proximo.titulo}</div>
          <div className="texto-2">{textoQuando(proximo, hoje)}</div>
        </div>
        <Icone nome="seta" />
      </Link>
    ) : null,
    recentes:
      recentes.length > 0 ? (
        <section className="cartao" aria-label="Últimos registros">
          <h2>Últimos registros</h2>
          <div className="lista">
            {recentes.map((r) => {
              const d = descrever(r, agora);
              return (
                <button key={r.id} className={`item t-${r.tipo}`} onClick={() => setEditando(r)}>
                  <Selo tipo={r.tipo} />
                  <div className="cresce">
                    <div className="titulo">{d.titulo}</div>
                    <div className="detalhe">{d.detalhe}</div>
                  </div>
                  {r.criado_por && <span className="quem">{nomeDe(r.criado_por)}</span>}
                </button>
              );
            })}
          </div>
        </section>
      ) : null,
  };

  return (
    <div className="pilha">
      {/* O que depende do momento fica sempre por cima e não se esconde: dica de instalar, antes do parto e cronômetros */}
      <DicaInstalar />
      {!bebe?.nascimento && <AntesDoParto />}

      {andamento.mamada && <CartaoMamadaAtiva r={andamento.mamada} />}
      {andamento.sono && <CartaoSonoAtivo r={andamento.sono} />}
      {perguntarSono && andamento.sono && <FolhaQueHorasTerminou r={andamento.sono} aoFechar={() => setPerguntarSono(false)} aoSalvar={(q) => acordou(q)} />}

      {/* Cartões na ordem escolhida (fixados primeiro); display: contents, então os vazios não ocupam espaço */}
      {ordemNaTela(layout).map((id) => (
        <div key={id} className="he-bloco" data-cartao={id}>
          {cartoes[id as IdCartaoHoje]}
        </div>
      ))}

      <button type="button" className="he-editar" onClick={() => setEditarHoje(true)}>
        <Icone nome="editar" /> Editar o Hoje
      </button>

      {folha === 'mamada' && <FolhaMamada aoFechar={() => setFolha(null)} />}
      {folha === 'mamadeira' && <FolhaMamadeira aoFechar={() => setFolha(null)} />}
      {folha === 'fralda' && <FolhaFralda aoFechar={() => setFolha(null)} />}
      {folha === 'sono' && <FolhaSono aoFechar={() => setFolha(null)} />}
      {editando && <FolhaEditar r={editando} aoFechar={() => setEditando(null)} />}
      {mais && <FolhaRegistroMais tipo={mais} aoFechar={() => setMais(null)} />}
      {editarHoje && <FolhaEditarHoje layout={layout} aoMudar={mudarLayout} nascido={nascido} aoFechar={() => setEditarHoje(false)} />}
      {menu && (
        <MenuRapido
          ancora={menu.el}
          titulo={TITULO_ATALHO[menu.tipo]}
          classe={`t-${menu.tipo}`}
          atalhos={menu.atalhos}
          dedo={menu.dedo}
          aoEscolher={usarAtalho}
          aoMais={() => abrirFormulario(menu.tipo)}
          aoFechar={() => setMenu(null)}
        />
      )}
    </div>
  );
}
