import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SecaoDesenvolvimento } from '../componentes/desenvolvimento';
import { SecaoAlimentacao, SecaoLeite } from '../componentes/leite-alimentacao';
import { SecaoPrimeirosDias } from '../componentes/primeiros-dias';
import { Icone, Selo } from '../componentes/ui';
import { useAgora, useDados } from '../dados/contexto';
import { chaveDia, horaCurta } from '../lib/datas';
import { descrever, NOMES_TIPO } from '../lib/registros';
import { Ajustes } from './Ajustes';
import { Resumo } from './Resumo';

export const SECOES_MAIS: { id: string; titulo: string; detalhe: string; icone: string; tipo: Parameters<typeof Selo>[0]['tipo'] }[] = [
  { id: 'primeiros-dias', titulo: 'Primeiros dias', detalhe: 'Testes do bebê, consultas e documentos', icone: 'lista', tipo: 'agenda' },
  { id: 'resumo', titulo: 'Gráficos e relatório', detalhe: 'Padrões da semana e PDF para o pediatra', icone: 'grafico', tipo: 'fralda' },
  { id: 'desenvolvimento', titulo: 'Desenvolvimento', detalhe: 'Marcos, primeiras vezes e foto do mês', icone: 'estrela', tipo: 'mamadeira' },
  { id: 'leite', titulo: 'Leite materno', detalhe: 'Extrações e estoque com validade', icone: 'extracao', tipo: 'mamada' },
  { id: 'alimentacao', titulo: 'Introdução alimentar', detalhe: 'Refeições e alimentos já oferecidos', icone: 'refeicao', tipo: 'mamadeira' },
  { id: 'noite', titulo: 'Modo noite', detalhe: 'Tela escura com botões grandes para a madrugada', icone: 'lua', tipo: 'sono' },
  { id: 'exportar', titulo: 'Exportar dados', detalhe: 'Planilha e cópia de segurança', icone: 'baixar', tipo: 'saude' },
  { id: 'ajustes', titulo: 'Ajustes', detalhe: 'Bebê, família, avisos, calendário e conta', icone: 'ajustes', tipo: 'saude' },
];

function Menu() {
  return (
    <section className="cartao">
      <nav className="menu-lista" aria-label="Mais">
        {SECOES_MAIS.map((s) => (
          <Link key={s.id} to={s.id === 'noite' ? '/noite' : `/mais/${s.id}`}>
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

function baixar(nome: string, conteudo: string, tipo: string) {
  const arquivo = new File([conteudo], nome, { type: tipo });
  if (navigator.canShare?.({ files: [arquivo] })) {
    navigator.share({ files: [arquivo], title: nome }).catch(() => undefined);
    return;
  }
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const csv = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function Exportar() {
  const dados = useDados();
  const { registros, nomeDe, hoje, carregadoDesde, carregarMais } = dados;
  const agora = useAgora(60_000);
  const [carregando, setCarregando] = useState(false);

  function planilha() {
    const linhas = [['data', 'hora', 'tipo', 'resumo', 'detalhe', 'fim', 'observacao', 'registrado_por'].join(';')];
    for (const r of [...registros].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
      const d = descrever(r, agora);
      linhas.push(
        [chaveDia(r.inicio), horaCurta(r.inicio), NOMES_TIPO[r.tipo], d.titulo, d.detalhe, r.fim ? `${chaveDia(r.fim)} ${horaCurta(r.fim)}` : '', r.observacao ?? '', nomeDe(r.criado_por)]
          .map(csv)
          .join(';'),
      );
    }
    // BOM para o Excel abrir com acentos
    baixar(`registros-${hoje}.csv`, '﻿' + linhas.join('\n'), 'text/csv');
  }

  function copia() {
    const { bebe, membros, compromissos, medidas, vacinas, remedios, leite, marcos, tarefas } = dados;
    const json = {
      app: 'Heitor',
      exportado_em: new Date().toISOString(),
      bebe,
      membros: membros.map((m) => ({ user_id: m.user_id, nome: m.nome })),
      registros,
      compromissos,
      medidas,
      vacinas,
      remedios,
      leite,
      marcos,
      tarefas,
    };
    baixar(`heitor-copia-${hoje}.json`, JSON.stringify(json, null, 2), 'application/json');
  }

  return (
    <div className="pilha">
      <section className="cartao pilha">
        <h2>Planilha dos registros</h2>
        <p className="texto-2">Mamadas, fraldas, sono, remédios e o resto, um por linha (abre no Excel, Numbers ou Google Planilhas).</p>
        <p className="mudo">Inclui os registros carregados a partir de {carregadoDesde.split('-').reverse().join('/')}.</p>
        <div className="linha">
          <button className="botao primario" onClick={planilha}>
            <Icone nome="baixar" /> Baixar planilha
          </button>
          <button
            className="botao"
            disabled={carregando}
            onClick={async () => {
              setCarregando(true);
              await carregarMais();
              setCarregando(false);
            }}
          >
            {carregando ? 'Carregando…' : 'Incluir mais 60 dias'}
          </button>
        </div>
      </section>
      <section className="cartao pilha">
        <h2>Cópia de segurança</h2>
        <p className="texto-2">Tudo o que está no app num arquivo só (JSON). Os dados já ficam guardados na nuvem; a cópia é para ter também com vocês.</p>
        <button className="botao" onClick={copia}>
          <Icone nome="baixar" /> Baixar cópia completa
        </button>
        <p className="mudo">As fotos ficam no servidor e não entram no arquivo.</p>
      </section>
    </div>
  );
}

export function TelaMais() {
  const { secao } = useParams();
  if (!secao) return <Menu />;
  if (secao === 'primeiros-dias') return <SecaoPrimeirosDias />;
  if (secao === 'resumo') return <Resumo />;
  if (secao === 'desenvolvimento') return <SecaoDesenvolvimento />;
  if (secao === 'leite') return <SecaoLeite />;
  if (secao === 'alimentacao') return <SecaoAlimentacao />;
  if (secao === 'exportar') return <Exportar />;
  if (secao === 'ajustes') return <Ajustes />;
  return <Menu />;
}
