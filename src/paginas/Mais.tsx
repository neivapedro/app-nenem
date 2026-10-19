import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SecaoChegada } from '../componentes/chegada';
import { SecaoDesenvolvimento } from '../componentes/desenvolvimento';
import { SecaoAlimentacao, SecaoLeite } from '../componentes/leite-alimentacao';
import { SecaoPrimeirosDias } from '../componentes/primeiros-dias';
import { Icone, Selo } from '../componentes/ui';
import { useAgora, useDados } from '../dados/contexto';
import { traduzirErro } from '../lib/erros';
import { csvCofrinho, csvRegistros, juntarRegistros, montarZip, planejarArquivos } from '../lib/exportar';
import { lerLocal } from '../lib/offline-docs';
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

async function entregar(arquivo: File) {
  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: arquivo.name });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = arquivo.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const qtd = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const tamanhoMb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;

function Exportar() {
  const dados = useDados();
  const { registros, nomeDe, hoje, repo } = dados;
  const agora = useAgora(60_000);
  const [etapa, setEtapa] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);
  const [pronto, setPronto] = useState<File | null>(null);

  /** Todos os registros desde o início (o app abre só com os últimos dias) */
  async function todosRegistros() {
    const doBanco = await repo.listarRegistros(new Date(Date.UTC(2000, 0, 1)).toISOString());
    return juntarRegistros(doBanco, registros);
  }

  async function planilha() {
    setMsg(null);
    setEtapa('Buscando todos os registros…');
    try {
      const todos = await todosRegistros();
      await entregar(new File([csvRegistros(todos, agora, nomeDe)], `registros-heitor-${hoje}.csv`, { type: 'text/csv' }));
    } catch (e) {
      setMsg({ tipo: 'erro', texto: `Não deu para buscar os registros: ${traduzirErro(e)}` });
    } finally {
      setEtapa(null);
    }
  }

  async function tudo() {
    setMsg(null);
    setPronto(null);
    try {
      setEtapa('Buscando todos os registros…');
      const todos = await todosRegistros();
      const { bebe, membros, compromissos, medidas, vacinas, remedios, leite, marcos, tarefas, documentos, cofrinho_contas, cofrinho_movimentos, cofrinho_metas, cofrinho_planos } = dados;
      const lista = planejarArquivos(bebe, documentos, cofrinho_movimentos, cofrinho_contas, marcos);
      const arquivos: { destino: string; bytes: Uint8Array }[] = [];
      const faltaram: string[] = [];
      for (let i = 0; i < lista.length; i++) {
        const a = lista[i];
        setEtapa(`Baixando arquivos: ${i + 1} de ${lista.length}…`);
        try {
          let blob = a.balde === 'documentos' ? await lerLocal(a.caminho) : null;
          if (!blob && a.balde === 'documentos') blob = await repo.baixarArquivo(a.caminho);
          if (!blob) {
            const url = await repo.urlFoto(a.caminho);
            if (!url) throw new Error('sem endereço');
            const r = await fetch(url);
            if (!r.ok) throw new Error(String(r.status));
            blob = await r.blob();
          }
          arquivos.push({ destino: a.destino, bytes: new Uint8Array(await blob.arrayBuffer()) });
        } catch {
          faltaram.push(a.destino);
        }
      }
      setEtapa('Montando o arquivo…');
      // Dá tempo de a tela mostrar a etapa antes de compactar
      await new Promise((ok) => setTimeout(ok, 30));
      const noZip = Object.fromEntries(lista.filter((a) => !faltaram.includes(a.destino)).map((a) => [a.caminho, a.destino]));
      const leiame = [
        `Cópia completa do app Heitor, feita em ${new Date().toLocaleString('pt-BR')}.`,
        '',
        'dados.json: tudo o que está no app (registros desde o início, saúde, agenda, desenvolvimento, documentos e cofrinho).',
        '  Em "arquivos_no_zip" está onde ficou cada arquivo dentro desta pasta.',
        'registros.csv: mamadas, fraldas, sono e os outros registros, um por linha (abre no Excel, Numbers ou Google Planilhas).',
        'cofrinho.csv: depósitos, retiradas e saldos do cofrinho.',
        'documentos/: os arquivos dos documentos, separados por categoria.',
        'cofrinho/comprovantes/: os comprovantes anexados no cofrinho.',
        'fotos/: as fotos do desenvolvimento.',
        '',
        `${qtd(todos.length, 'registro', 'registros')} · ${qtd(arquivos.length, 'arquivo', 'arquivos')}.`,
        ...(faltaram.length ? ['', 'Não deu para baixar (tente de novo com internet):', ...faltaram.map((f) => `- ${f}`)] : []),
      ].join('\n');
      const pasta = `Heitor - cópia completa ${hoje}`;
      const zip = montarZip(pasta, {
        dados: {
          app: 'Heitor',
          exportado_em: new Date().toISOString(),
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
          arquivos_no_zip: noZip,
        },
        textos: { 'LEIA-ME.txt': leiame, 'registros.csv': csvRegistros(todos, agora, nomeDe), 'cofrinho.csv': csvCofrinho(cofrinho_contas, cofrinho_movimentos) },
        arquivos,
      });
      const arquivo = new File([zip as Uint8Array<ArrayBuffer>], `heitor-copia-completa-${hoje}.zip`, { type: 'application/zip' });
      setPronto(arquivo);
      setMsg(
        faltaram.length
          ? { tipo: 'erro', texto: `Pronto, mas ${faltaram.length} ${faltaram.length === 1 ? 'arquivo não foi baixado' : 'arquivos não foram baixados'} (veja o LEIA-ME). Tente de novo com internet.` }
          : { tipo: 'ok', texto: `Pronto: ${qtd(todos.length, 'registro', 'registros')} e ${qtd(arquivos.length, 'arquivo', 'arquivos')} (${tamanhoMb(arquivo.size)}).` },
      );
      setEtapa(null);
      await entregar(arquivo);
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
          <Icone nome="baixar" /> {etapa ?? 'Exportar tudo (.zip)'}
        </button>
        {pronto && !ocupado && (
          <button className="botao" onClick={() => void entregar(pronto)}>
            <Icone nome="compartilhar" /> Compartilhar de novo
          </button>
        )}
        {msg && <div className={`alerta ${msg.tipo === 'erro' ? 'erro' : 'info'}`}>{msg.texto}</div>}
      </section>
      <section className="cartao pilha">
        <h2>Planilha dos registros</h2>
        <p className="texto-2">Mamadas, fraldas, sono, remédios e o resto, desde o início, um por linha (abre no Excel, Numbers ou Google Planilhas).</p>
        <button className="botao" disabled={ocupado} onClick={() => void planilha()}>
          <Icone nome="baixar" /> Baixar planilha
        </button>
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
