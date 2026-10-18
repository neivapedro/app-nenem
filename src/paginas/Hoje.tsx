import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FolhaBebe } from '../componentes/bebe';
import { CartaoMamadaAtiva, CartaoSonoAtivo, FolhaEditar, FolhaFralda, FolhaMamada, FolhaMamadeira, FolhaSono } from '../componentes/registrar';
import { Icone, Selo } from '../componentes/ui';
import { useAgora, useDados } from '../dados/contexto';
import { proximosCompromissos, textoQuando } from '../lib/agenda';
import { dataBr, haQuanto, semanasGestacao, textoDuracao } from '../lib/datas';
import { descrever, emAndamento, ladoFinal, ordenarRecentes, resumoDia, ultimaAlimentacao, ultimoDoTipo } from '../lib/registros';
import type { Registro, TipoRegistro } from '../lib/tipos';

type Folhas = TipoRegistro | null;

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
            Previsão: {dataBr(bebe.data_prevista!)} · {g.semanas} semanas{g.dias ? ` e ${g.dias} ${g.dias === 1 ? 'dia' : 'dias'}` : ''} de gestação
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
  const { bebe, registros, compromissos, hoje, gravar, mostrarAviso, nomeDe } = useDados();
  const agora = useAgora(30_000);
  const [folha, setFolha] = useState<Folhas>(null);
  const [editando, setEditando] = useState<Registro | null>(null);
  const andamento = emAndamento(registros);
  const resumo = resumoDia(registros, hoje, agora);
  const alimentacao = ultimaAlimentacao(registros);
  const fralda = ultimoDoTipo(registros, 'fralda');
  const sono = ultimoDoTipo(registros, 'sono');
  const recentes = ordenarRecentes(registros).slice(0, 5);
  const proximo = proximosCompromissos(compromissos, agora)[0];

  const desdeAlimentacao = alimentacao
    ? `${haQuanto(alimentacao.inicio, agora)}${alimentacao.tipo === 'mamada' && ladoFinal(alimentacao) ? ` · terminou no ${ladoFinal(alimentacao)}` : alimentacao.tipo === 'mamadeira' ? ` · ${alimentacao.dados.ml} ml` : ''}`
    : 'nenhuma ainda';

  function acordou() {
    if (!andamento.sono) return;
    const r = andamento.sono;
    const fim = { ...r, fim: new Date(Math.max(Date.now(), new Date(r.inicio).getTime())).toISOString() };
    gravar({ tipo: 'registro', dado: fim });
    mostrarAviso({ texto: `Sono salvo (${textoDuracao(new Date(fim.fim).getTime() - new Date(r.inicio).getTime())})`, desfazer: () => gravar({ tipo: 'registro', dado: r }) });
  }

  return (
    <div className="pilha">
      {!bebe?.nascimento && <AntesDoParto />}

      {andamento.mamada && <CartaoMamadaAtiva r={andamento.mamada} />}
      {andamento.sono && <CartaoSonoAtivo r={andamento.sono} />}

      <section className="acoes" aria-label="Registrar">
        <button className={`acao t-mamada ${andamento.mamada ? 'ativa' : ''}`} onClick={() => !andamento.mamada && setFolha('mamada')} disabled={!!andamento.mamada}>
          <Selo tipo="mamada" />
          <span className="nome">Mamada</span>
          <span className="desde">{andamento.mamada ? 'em andamento' : `Última ${desdeAlimentacao}`}</span>
        </button>
        <button className="acao t-mamadeira" onClick={() => setFolha('mamadeira')}>
          <Selo tipo="mamadeira" />
          <span className="nome">Mamadeira</span>
          <span className="desde">{resumo.mamadeiras ? `${resumo.ml} ml hoje` : 'leite materno ou fórmula'}</span>
        </button>
        <button className="acao t-fralda" onClick={() => setFolha('fralda')}>
          <Selo tipo="fralda" />
          <span className="nome">Fralda</span>
          <span className="desde">{fralda ? `Última ${haQuanto(fralda.inicio, agora)}` : 'nenhuma ainda'}</span>
        </button>
        <button className={`acao t-sono ${andamento.sono ? 'ativa' : ''}`} onClick={() => (andamento.sono ? acordou() : setFolha('sono'))}>
          <Selo tipo="sono" />
          <span className="nome">{andamento.sono ? 'Acordou' : 'Sono'}</span>
          <span className="desde">
            {andamento.sono ? 'tocar para encerrar o sono' : sono?.fim ? `Acordado ${haQuanto(sono.fim, agora)}` : 'nenhum ainda'}
          </span>
        </button>
      </section>

      <section className="cartao" aria-label="Resumo de hoje">
        <div className="cartao-cab">
          <h2>Hoje</h2>
          <Link to="/historico" className="botao pequeno texto">
            Histórico <Icone nome="seta" />
          </Link>
        </div>
        <div className="grade grade-3">
          <div className="bloco">
            <div className="rotulo">Alimentações</div>
            <div className="valor">{resumo.alimentacoes}</div>
          </div>
          <div className="bloco">
            <div className="rotulo">No peito</div>
            <div className="valor">{resumo.peitoMs ? textoDuracao(resumo.peitoMs) : '—'}</div>
          </div>
          <div className="bloco">
            <div className="rotulo">Mamadeira</div>
            <div className="valor">{resumo.ml ? `${resumo.ml} ml` : '—'}</div>
          </div>
          <div className="bloco">
            <div className="rotulo">Fraldas</div>
            <div className="valor">{resumo.fraldas}</div>
          </div>
          <div className="bloco">
            <div className="rotulo">Xixi · cocô</div>
            <div className="valor">
              {resumo.xixi} · {resumo.coco}
            </div>
          </div>
          <div className="bloco">
            <div className="rotulo">Sono</div>
            <div className="valor">{resumo.sonoMs ? textoDuracao(resumo.sonoMs) : '—'}</div>
          </div>
        </div>
      </section>

      {proximo && (
        <Link to="/agenda" className="cartao linha" style={{ textDecoration: 'none', color: 'inherit', flexWrap: 'nowrap' }}>
          <Selo tipo="agenda" />
          <div className="cresce">
            <div className="rotulo">Próximo compromisso</div>
            <div style={{ fontWeight: 600 }}>{proximo.titulo}</div>
            <div className="texto-2">{textoQuando(proximo, hoje)}</div>
          </div>
          <Icone nome="seta" />
        </Link>
      )}

      {recentes.length > 0 && (
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
      )}

      {folha === 'mamada' && <FolhaMamada aoFechar={() => setFolha(null)} />}
      {folha === 'mamadeira' && <FolhaMamadeira aoFechar={() => setFolha(null)} />}
      {folha === 'fralda' && <FolhaFralda aoFechar={() => setFolha(null)} />}
      {folha === 'sono' && <FolhaSono aoFechar={() => setFolha(null)} />}
      {editando && <FolhaEditar r={editando} aoFechar={() => setEditando(null)} />}
    </div>
  );
}
