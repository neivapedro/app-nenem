import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { somarMeses } from '../../supabase/functions/_shared/tempo.ts';
import { TAREFAS_PADRAO } from '../../supabase/functions/_shared/primeiros-dias.ts';
import { SecaoChegada, useProgressoFamilia } from '../componentes/chegada';
import { compartilhar, obterArquivo } from '../componentes/doc-arquivos';
import { Foto, progressoMarcos, SecaoDesenvolvimento } from '../componentes/desenvolvimento';
import { SecaoAlimentacao, SecaoLeite } from '../componentes/leite-alimentacao';
import { SecaoPrimeirosDias } from '../componentes/primeiros-dias';
import { Icone, Selo } from '../componentes/ui';
import { useAgora, useDados } from '../dados/contexto';
import { IDADE_INTRODUCAO_MESES } from '../lib/conteudo';
import { chaveDia, dataBr, somarDiasLocal } from '../lib/datas';
import { traduzirErro } from '../lib/erros';
import { useZoom, voltandoComZoom } from '../lib/zoom';
import { csvCofrinho, csvRegistros, juntarRegistros, listaDocumentos, MontadorZip, planejarArquivos } from '../lib/exportar';
import { diasDoPeriodo, media } from '../lib/padroes';
import { inicioDosDados } from '../lib/painel';
import { alimentosProvados, emEstoque, situacaoPote } from '../lib/saude';
import { Ajustes } from './Ajustes';
import '../estilos/mais.css';
import { Resumo } from './Resumo';

export const SECOES_MAIS: { id: string; titulo: string; detalhe: string; icone: string; tipo: Parameters<typeof Selo>[0]['tipo'] }[] = [
  { id: 'chegada', titulo: 'Chegada do bebê', detalhe: 'Vacinas de quem convive e cuidados essenciais', icone: 'vacina', tipo: 'saude' },
  { id: 'primeiros-dias', titulo: 'Primeiros dias', detalhe: 'Testes do bebê, consultas e documentos', icone: 'lista', tipo: 'agenda' },
  { id: 'resumo', titulo: 'Gráficos e relatório', detalhe: 'Padrões da semana e PDF para o pediatra', icone: 'grafico', tipo: 'fralda' },
  { id: 'desenvolvimento', titulo: 'Desenvolvimento', detalhe: 'Marcos, primeiras vezes e foto do mês', icone: 'estrela', tipo: 'mamadeira' },
  { id: 'leite', titulo: 'Leite materno', detalhe: 'Extrações e estoque com validade', icone: 'extracao', tipo: 'mamada' },
  { id: 'alimentacao', titulo: 'Introdução alimentar', detalhe: 'Refeições e alimentos já oferecidos', icone: 'refeicao', tipo: 'mamadeira' },
  { id: 'exportar', titulo: 'Exportar dados', detalhe: 'Planilha e cópia de segurança', icone: 'baixar', tipo: 'saude' },
  { id: 'ajustes', titulo: 'Ajustes', detalhe: 'Bebê, família, avisos, calendário e conta', icone: 'ajustes', tipo: 'saude' },
];

type Previa = {
  /** Linha curta com o dado vivo (ou um convite quando ainda não há dado) */
  texto: ReactNode;
  /** 0 a 1: barrinha de progresso */
  progresso?: number;
  /** Série curta para a minibarra (gráficos) */
  serie?: number[];
  /** Foto no lugar do ícone */
  foto?: string | null;
  alerta?: boolean;
  convite?: boolean;
};

const um = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** O dado vivo de cada seção, tirado do que já está carregado no app (leve: nada de buscar no servidor) */
function usePrevias(): Record<string, Previa> {
  const { bebe, marcos, tarefas, leite, registros, membros, hoje } = useDados();
  const agora = useAgora(60_000);
  const chegada = useProgressoFamilia();
  const minuto = Math.floor(agora.getTime() / 60_000);

  const semana = useMemo(() => {
    const nasc = bebe?.nascimento ? chaveDia(bebe.nascimento) : null;
    const dias = diasDoPeriodo(registros, somarDiasLocal(hoje, -6), hoje, new Date(minuto * 60_000));
    // Igual aos Gráficos: dias antes do nascimento não contam e hoje (ainda pela metade) fica fora da média
    const desde = inicioDosDados(nasc, registros, hoje);
    const validos = desde ? dias.filter((d) => d.dia >= desde) : dias;
    const completos = validos.length > 1 ? validos.filter((d) => d.dia !== hoje) : validos;
    return { media: media(completos.map((d) => d.alimentacoes)), serie: dias.map((d) => d.alimentacoes), tem: completos.some((d) => d.alimentacoes > 0) };
  }, [registros, hoje, minuto, bebe?.nascimento]);

  const r: Record<string, Previa> = {};
  const nasceu = !!bebe?.nascimento;

  // Chegada do bebê: vacinas da família conferidas
  r.chegada = chegada.feitas
    ? { texto: <><strong>{chegada.feitas} de {chegada.total}</strong> vacinas conferidas</>, progresso: chegada.feitas / chegada.total }
    : { texto: 'Monte o casulo de vacinas da família', convite: true };

  // Primeiros dias: tarefas feitas (lista padrão + as criadas por vocês)
  const porItem = new Map(tarefas.filter((t) => t.item_id).map((t) => [t.item_id!, t]));
  const livres = tarefas.filter((t) => !t.item_id);
  const totalTarefas = TAREFAS_PADRAO.length + livres.length;
  const feitas = TAREFAS_PADRAO.filter((p) => porItem.get(p.id)?.feito_em).length + livres.filter((t) => t.feito_em).length;
  r['primeiros-dias'] =
    feitas || nasceu
      ? { texto: <><strong>{feitas} de {totalTarefas}</strong> feitos</>, progresso: feitas / totalTarefas }
      : { texto: 'Testes, consultas e documentos', convite: true };

  // Gráficos: alimentações por dia na semana
  r.resumo = semana.tem
    ? { texto: <><strong>{um(semana.media)}</strong> alimentações/dia na semana</>, serie: semana.serie }
    : { texto: 'Padrões da semana e PDF para o pediatra', convite: true };

  // Desenvolvimento: marcos da faixa de idade atual (e a foto mais recente)
  const comFoto = marcos.filter((m) => m.foto).sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));
  if (nasceu) {
    const p = progressoMarcos(bebe!.nascimento, marcos, hoje);
    r.desenvolvimento = { texto: <><strong>{p.feitos} de {p.total}</strong> marcos da idade</>, progresso: p.feitos / p.total, foto: comFoto[0]?.foto };
  } else r.desenvolvimento = { texto: 'Marcos, 1ª vez e foto do mês', convite: true, foto: comFoto[0]?.foto };

  // Leite materno: o que está no estoque e ainda vale
  const estoque = emEstoque(leite);
  const validos = estoque.filter((p) => situacaoPote(p, agora) !== 'vencido');
  const ml = validos.reduce((s, p) => s + p.ml, 0);
  const venceLogo = validos.filter((p) => situacaoPote(p, agora) === 'vence-logo').length;
  const vencidos = estoque.length - validos.length;
  if (ml || vencidos) {
    const nota = vencidos ? ` · ${vencidos} ${vencidos === 1 ? 'venceu' : 'venceram'}` : venceLogo ? ` · ${venceLogo} vence${venceLogo === 1 ? '' : 'm'} logo` : '';
    r.leite = { texto: <><strong>{ml} ml</strong> no estoque{nota}</>, alerta: !!(vencidos || venceLogo) };
  } else r.leite = { texto: 'Registre extrações e o estoque', convite: true };

  // Introdução alimentar: quantos alimentos ou quando começa
  const provados = alimentosProvados(registros).length;
  const inicio = bebe?.nascimento ? somarMeses(chaveDia(bebe.nascimento), IDADE_INTRODUCAO_MESES) : null;
  if (provados) r.alimentacao = { texto: <><strong>{provados}</strong> {provados === 1 ? 'alimento oferecido' : 'alimentos oferecidos'}</> };
  else if (inicio && inicio > hoje) r.alimentacao = { texto: <>A partir de <strong>{dataBr(inicio).slice(0, inicio.slice(0, 4) === hoje.slice(0, 4) ? 5 : 10)}</strong></> };
  else if (inicio) r.alimentacao = { texto: 'Registre a primeira refeição', convite: true };
  else r.alimentacao = { texto: 'A partir dos 6 meses', convite: true };

  r.exportar = { texto: 'Planilha e cópia em .zip', convite: true };

  const nome = bebe?.nome?.trim().split(' ')[0];
  const familia = membros.length > 1 ? `${membros.length} na família` : 'convide a família';
  r.ajustes = { texto: nome ? <><strong>{nome}</strong> · {familia}</> : familia, convite: !nome };
  return r;
}

/** Minibarras dos últimos 7 dias (hoje mais clarinho: ainda não acabou) */
function MiniBarras({ serie }: { serie: number[] }) {
  const max = Math.max(1, ...serie);
  const larg = 100 / serie.length;
  return (
    <svg className="mais-barras" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      {serie.map((v, i) => {
        const h = Math.max(2, (v / max) * 24);
        return <rect key={i} x={i * larg + larg * 0.18} y={24 - h} width={larg * 0.64} height={h} rx={1.5} opacity={i === serie.length - 1 ? 0.4 : 1} />;
      })}
    </svg>
  );
}

type SecaoMais = (typeof SECOES_MAIS)[number];

/** Cartão da grade: ao tocar, cresce e vira a tela da seção (zoom); na volta, a tela encolhe nele */
function CartaoMais({ s, p, i }: { s: SecaoMais; p?: Previa; i: number }) {
  const zoom = useZoom(`/mais/${s.id}`, { titulo: '.mais-titulo' });
  return (
    <Link to={`/mais/${s.id}`} {...zoom} className={`mais-cartao t-${s.tipo} ${p?.convite ? 'convite' : ''}`} style={{ '--i': i } as CSSProperties}>
      <span className="mais-cartao-topo">
        {p?.foto ? (
          <span className={`selo t-${s.tipo} mais-foto`}>
            <Foto caminho={p.foto} classe="foto-mini" reserva={<Icone nome={s.icone ?? s.tipo} />} />
          </span>
        ) : (
          <Selo tipo={s.tipo} icone={s.icone} />
        )}
        <span className="mais-seta" aria-hidden="true">
          <Icone nome="seta" />
        </span>
      </span>
      <span className="mais-corpo">
        <span className="mais-titulo">{s.titulo}</span>
        {p && <span className={`mais-previa ${p.alerta ? 'alerta' : ''}`}>{p.texto}</span>}
        {p?.progresso !== undefined && (
          <span className="mais-progresso" aria-hidden="true">
            <span style={{ width: `${Math.round(Math.min(1, p.progresso) * 100)}%` }} />
          </span>
        )}
        {p?.serie && <MiniBarras serie={p.serie} />}
      </span>
    </Link>
  );
}

function Menu() {
  const previas = usePrevias();
  // Voltando de uma seção com o zoom: a grade já aparece pronta (sem repetir a entrada dos cartões)
  const [semEntrada] = useState(voltandoComZoom);
  return (
    <nav className={`mais-grade${semEntrada ? ' zoom-sem-entrada' : ''}`} aria-label="Mais">
      {SECOES_MAIS.map((s, i) => (
        <CartaoMais key={s.id} s={s} p={previas[s.id]} i={i} />
      ))}
    </nav>
  );
}

const qtd = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const tamanhoMb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
const esperarTela = () => new Promise((ok) => setTimeout(ok, 30));

type Aviso = { tipo: 'ok' | 'erro'; texto: string };

function Exportar() {
  const dados = useDados();
  const { registros, nomeDe, hoje, repo } = dados;
  const agora = useAgora(60_000);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [msg, setMsg] = useState<Aviso | null>(null);
  const [pronto, setPronto] = useState<File | null>(null);
  const [planilhaPronta, setPlanilhaPronta] = useState<File | null>(null);
  const [msgPlanilha, setMsgPlanilha] = useState<Aviso | null>(null);

  /** Todos os registros desde o início (o app abre só com os últimos dias). Sem internet, fica com os do app. */
  async function todosRegistros(): Promise<{ lista: typeof registros; completo: boolean }> {
    try {
      const doBanco = await repo.listarRegistros(new Date(Date.UTC(2000, 0, 1)).toISOString());
      return { lista: juntarRegistros(doBanco, registros), completo: true };
    } catch {
      return { lista: juntarRegistros([], registros), completo: false };
    }
  }

  async function planilha() {
    setMsgPlanilha(null);
    setPlanilhaPronta(null);
    setEtapa('planilha');
    try {
      const { lista, completo } = await todosRegistros();
      const arquivo = new File([csvRegistros(lista, agora, nomeDe)], `registros-heitor-${hoje}.csv`, { type: 'text/csv' });
      setPlanilhaPronta(arquivo);
      setEtapa(null);
      const r = await compartilhar([arquivo], arquivo.name);
      if (!completo) setMsgPlanilha({ tipo: 'erro', texto: 'Sem internet: a planilha saiu só com os registros que já estavam no celular.' });
      else if (r === 'bloqueado') setMsgPlanilha({ tipo: 'ok', texto: 'Planilha pronta! Toque em Compartilhar planilha para salvar ou enviar.' });
    } catch (e) {
      setMsgPlanilha({ tipo: 'erro', texto: `Não deu para montar a planilha: ${traduzirErro(e)}` });
    } finally {
      setEtapa(null);
    }
  }

  async function tudo() {
    setMsg(null);
    setPronto(null);
    try {
      setEtapa('Buscando todos os registros…');
      const { lista: todos, completo } = await todosRegistros();
      const { bebe, membros, compromissos, medidas, vacinas, remedios, leite, marcos, tarefas, documentos, cofrinho_contas, cofrinho_movimentos, cofrinho_metas, cofrinho_planos } = dados;
      const pasta = `Heitor - cópia completa ${hoje}`;
      const lista = planejarArquivos(documentos, cofrinho_movimentos, cofrinho_contas, marcos, bebe?.foto);
      const zip = new MontadorZip();
      const baixados: typeof lista = [];
      const faltaram: string[] = [];
      // Um arquivo por vez: entra no .zip e sai da memória
      for (let i = 0; i < lista.length; i++) {
        const a = lista[i];
        setEtapa(`Baixando arquivos: ${i + 1} de ${lista.length}…`);
        try {
          let blob: Blob;
          if (a.balde === 'documentos') blob = await obterArquivo(repo, a.caminho);
          else {
            const url = await repo.urlFoto(a.caminho);
            if (!url) throw new Error('sem endereço');
            const r = await fetch(url);
            if (!r.ok) throw new Error(String(r.status));
            blob = await r.blob();
          }
          zip.adicionar(`${pasta}/${a.destino}`, new Uint8Array(await blob.arrayBuffer()));
          baixados.push(a);
        } catch {
          faltaram.push(a.destino);
        }
      }
      setEtapa('Montando o arquivo…');
      await esperarTela();
      const leiame = [
        `Cópia completa do app Heitor, feita em ${new Date().toLocaleString('pt-BR')}.`,
        '',
        'dados.json: tudo o que está no app (registros desde o início, saúde, agenda, desenvolvimento, documentos e cofrinho).',
        '  Em "arquivos_no_zip" está onde ficou cada arquivo dentro desta pasta.',
        'registros.csv: mamadas, fraldas, sono e os outros registros, um por linha (abre no Excel, Numbers ou Google Planilhas).',
        'cofrinho.csv: depósitos, retiradas e saldos do cofrinho.',
        'documentos/: os arquivos dos documentos, com o nome que têm no app, separados por categoria (e a lista com números e validades).',
        'cofrinho/comprovantes/: os comprovantes anexados no cofrinho.',
        'fotos/: as fotos do desenvolvimento.',
        '',
        `${qtd(todos.length, 'registro', 'registros')} · ${qtd(baixados.length, 'arquivo', 'arquivos')}.`,
        ...(completo ? [] : ['', 'ATENÇÃO: sem internet na hora da cópia. Entraram só os registros que já estavam no celular (os mais recentes).']),
        ...(faltaram.length ? ['', 'Não deu para baixar (tente de novo com internet):', ...faltaram.map((f) => `- ${f}`)] : []),
      ].join('\n');
      zip.adicionarTexto(`${pasta}/LEIA-ME.txt`, leiame);
      zip.adicionarTexto(`${pasta}/registros.csv`, csvRegistros(todos, agora, nomeDe));
      zip.adicionarTexto(`${pasta}/cofrinho.csv`, csvCofrinho(cofrinho_contas, cofrinho_movimentos));
      zip.adicionarTexto(`${pasta}/documentos/Lista dos documentos.txt`, listaDocumentos(documentos, baixados, `Documentos${bebe?.nome ? ` do ${bebe.nome}` : ''}`));
      zip.adicionarTexto(
        `${pasta}/dados.json`,
        JSON.stringify(
          {
            app: 'Heitor',
            exportado_em: new Date().toISOString(),
            registros_completos: completo,
            bebe,
            membros: membros.map((m) => ({ user_id: m.user_id, nome: m.nome })),
            registros: todos,
            compromissos,
            medidas,
            vacinas,
            remedios,
            leite,
            marcos,
            tarefas,
            documentos,
            cofrinho: { contas: cofrinho_contas, movimentos: cofrinho_movimentos, metas: cofrinho_metas, plano: cofrinho_planos },
            arquivos_no_zip: baixados.map((a) => ({ caminho: a.caminho, arquivo: a.destino, documento_id: a.docId ?? null })),
          },
          null,
          2,
        ),
      );
      const arquivo = new File([zip.terminar()], `heitor-copia-completa-${hoje}.zip`, { type: 'application/zip' });
      setPronto(arquivo);
      setEtapa(null);
      const r = await compartilhar([arquivo], arquivo.name);
      const resumo = `${qtd(todos.length, 'registro', 'registros')} e ${qtd(baixados.length, 'arquivo', 'arquivos')} (${tamanhoMb(arquivo.size)})`;
      const avisos = [
        !completo && 'sem internet, entraram só os registros que já estavam no celular',
        faltaram.length > 0 && `${qtd(faltaram.length, 'arquivo não foi baixado', 'arquivos não foram baixados')} (veja o LEIA-ME)`,
      ].filter(Boolean);
      setMsg(
        avisos.length
          ? { tipo: 'erro', texto: `Pronto, mas ${avisos.join(' e ')}. Tente de novo com internet. ${resumo}.` }
          : { tipo: 'ok', texto: r === 'bloqueado' ? `Pronto: ${resumo}. Toque em Compartilhar para salvar ou enviar.` : `Pronto: ${resumo}.` },
      );
    } catch (e) {
      setMsg({ tipo: 'erro', texto: `Não deu para exportar: ${traduzirErro(e)}` });
    } finally {
      setEtapa(null);
    }
  }

  const ocupado = etapa !== null;
  return (
    <div className="pilha">
      <section className="cartao pilha">
        <h2>Exportar tudo</h2>
        <p className="texto-2">
          Um arquivo .zip com tudo desde o início: todos os registros, saúde, agenda, desenvolvimento, cofrinho e os arquivos dos documentos, comprovantes e fotos.
        </p>
        <p className="mudo" style={{ margin: 0 }}>
          No iPhone, escolha <strong>Salvar em Arquivos</strong> (iCloud Drive) ou mande para alguém. Tocando no .zip no app Arquivos, ele abre as pastas.
        </p>
        <button className="botao primario" disabled={ocupado} onClick={() => void tudo()}>
          <Icone nome="baixar" /> {etapa && etapa !== 'planilha' ? etapa : 'Exportar tudo (.zip)'}
        </button>
        {pronto && !ocupado && (
          <button className="botao" onClick={() => void compartilhar([pronto], pronto.name)}>
            <Icone nome="compartilhar" /> Compartilhar
          </button>
        )}
        {msg && (
          <div className={`alerta ${msg.tipo === 'erro' ? 'erro' : 'info'}`} role="status">
            {msg.texto}
          </div>
        )}
      </section>
      <section className="cartao pilha">
        <h2>Planilha dos registros</h2>
        <p className="texto-2">Mamadas, fraldas, sono, remédios e o resto, desde o início, um por linha (abre no Excel, Numbers ou Google Planilhas).</p>
        <button className="botao" disabled={ocupado} onClick={() => void planilha()}>
          <Icone nome="baixar" /> {etapa === 'planilha' ? 'Buscando todos os registros…' : 'Baixar planilha'}
        </button>
        {planilhaPronta && !ocupado && (
          <button className="botao" onClick={() => void compartilhar([planilhaPronta], planilhaPronta.name)}>
            <Icone nome="compartilhar" /> Compartilhar planilha
          </button>
        )}
        {msgPlanilha && (
          <div className={`alerta ${msgPlanilha.tipo === 'erro' ? 'erro' : 'info'}`} role="status">
            {msgPlanilha.texto}
          </div>
        )}
      </section>
    </div>
  );
}

export function TelaMais() {
  const { secao } = useParams();
  if (!secao) return <Menu />;
  if (secao === 'chegada') return <SecaoChegada />;
  if (secao === 'primeiros-dias') return <SecaoPrimeirosDias />;
  if (secao === 'resumo') return <Resumo />;
  if (secao === 'desenvolvimento') return <SecaoDesenvolvimento />;
  if (secao === 'leite') return <SecaoLeite />;
  if (secao === 'alimentacao') return <SecaoAlimentacao />;
  if (secao === 'exportar') return <Exportar />;
  if (secao === 'ajustes') return <Ajustes />;
  return <Menu />;
}
