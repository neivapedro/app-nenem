import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SecaoChegada } from '../componentes/chegada';
import { compartilhar, obterArquivo } from '../componentes/doc-arquivos';
import { SecaoDesenvolvimento } from '../componentes/desenvolvimento';
import { SecaoAlimentacao, SecaoLeite } from '../componentes/leite-alimentacao';
import { SecaoPrimeirosDias } from '../componentes/primeiros-dias';
import { Icone, Selo } from '../componentes/ui';
import { useAgora, useDados } from '../dados/contexto';
import { traduzirErro } from '../lib/erros';
import { csvCofrinho, csvRegistros, juntarRegistros, listaDocumentos, MontadorZip, planejarArquivos } from '../lib/exportar';
import { Ajustes } from './Ajustes';
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

function Menu() {
  return (
    <section className="cartao">
      <nav className="menu-lista" aria-label="Mais">
        {SECOES_MAIS.map((s) => (
          <Link key={s.id} to={`/mais/${s.id}`}>
            <Selo tipo={s.tipo} icone={s.icone} />
            <span className="cresce">
              <span style={{ display: 'block', fontWeight: 600 }}>{s.titulo}</span>
              <span className="texto-2">{s.detalhe}</span>
            </span>
            <span className="seta">
              <Icone nome="seta" />
            </span>
          </Link>
        ))}
      </nav>
    </section>
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
      const lista = planejarArquivos(documentos, cofrinho_movimentos, cofrinho_contas, marcos);
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
