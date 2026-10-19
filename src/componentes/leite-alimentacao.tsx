import { useState } from 'react';
import { useAgora, useDados } from '../dados/contexto';
import { ALIMENTOS_ATENCAO, FONTE_ALIMENTACAO, IDADE_INTRODUCAO_MESES, ORIENTACAO_INTRODUCAO, ORIENTACAO_LEITE } from '../lib/conteudo';
import { chaveDia, dataBr, horaCurta, nomeDia, textoDuracao } from '../lib/datas';
import { descrever, ordenarRecentes } from '../lib/registros';
import { alimentosProvados, emEstoque, situacaoPote, validadeLeite } from '../lib/saude';
import type { PoteLeite, Registro, RegistroDe } from '../lib/tipos';
import { FolhaEditar } from './registrar';
import { FolhaRegistroMais } from './registrar-mais';
import { Campo, Escolhas, Folha, Icone, Selo } from './ui';

// ---------- Leite materno: extrações e estoque ----------

function FolhaPote({ p, aoFechar }: { p: PoteLeite; aoFechar: () => void }) {
  const { gravar, mostrarAviso } = useDados();
  const [ml, setMl] = useState(String(p.ml));
  const [local, setLocal] = useState(p.local);
  const salvar = (novo: PoteLeite, texto: string) => {
    gravar({ tipo: 'colecao', colecao: 'leite', dado: novo });
    mostrarAviso({ texto, desfazer: () => gravar({ tipo: 'colecao', colecao: 'leite', dado: p }) });
    aoFechar();
  };
  return (
    <Folha titulo={`Pote de ${p.ml} ml`} aoFechar={aoFechar}>
      <div className="pilha">
        <p className="texto-2">
          Tirado {nomeDia(chaveDia(p.extraido_em), chaveDia(new Date())).toLowerCase()} às {horaCurta(p.extraido_em)} · vale até {dataBr(chaveDia(validadeLeite(p)))} {horaCurta(validadeLeite(p))}
        </p>
        <button className="botao primario" onClick={() => salvar({ ...p, usado_em: new Date().toISOString() }, 'Pote marcado como usado')}>
          <Icone nome="check" /> Usei este pote
        </button>
        <button className="botao" onClick={() => salvar({ ...p, descartado_em: new Date().toISOString() }, 'Pote descartado')}>
          Descartei
        </button>
        <Campo rotulo="Quantidade (ml)">
          <input inputMode="numeric" pattern="[0-9]*" value={ml} onChange={(e) => setMl(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </Campo>
        <Campo rotulo="Onde está" grupo dica="Passar da geladeira para o freezer muda a validade (vale a data em que o leite foi tirado).">
          <Escolhas
            opcoes={[
              { valor: 'geladeira' as const, rotulo: 'Geladeira' },
              { valor: 'freezer' as const, rotulo: 'Freezer' },
            ]}
            valor={local}
            aoMudar={setLocal}
          />
        </Campo>
        <button className="botao" disabled={!(Number(ml) > 0)} onClick={() => salvar({ ...p, ml: Number(ml), local }, 'Pote atualizado')}>
          Salvar alterações
        </button>
      </div>
    </Folha>
  );
}

export function SecaoLeite() {
  const { leite, registros, nomeDe } = useDados();
  const agora = useAgora(60_000);
  const [nova, setNova] = useState(false);
  const [pote, setPote] = useState<PoteLeite | null>(null);
  const [editando, setEditando] = useState<Registro | null>(null);
  const estoque = emEstoque(leite);
  const extracoes = ordenarRecentes(registros.filter((r): r is RegistroDe<'extracao'> => r.tipo === 'extracao')).slice(0, 20);
  const total = (l: PoteLeite['local']) => estoque.filter((p) => p.local === l && situacaoPote(p, agora) !== 'vencido').reduce((s, p) => s + p.ml, 0);

  return (
    <div className="pilha">
      <button className="botao primario" onClick={() => setNova(true)}>
        <Icone nome="extracao" /> Registrar extração
      </button>
      <section className="cartao pilha" aria-label="Estoque">
        <h2>Estoque</h2>
        <div className="grade">
          <div className="bloco">
            <div className="rotulo">Geladeira</div>
            <div className="valor">
              {total('geladeira')} <small>ml</small>
            </div>
          </div>
          <div className="bloco">
            <div className="rotulo">Freezer</div>
            <div className="valor">
              {total('freezer')} <small>ml</small>
            </div>
          </div>
        </div>
        {estoque.length ? (
          <div className="lista">
            {estoque.map((p) => {
              const s = situacaoPote(p, agora);
              const resta = new Date(validadeLeite(p)).getTime() - agora.getTime();
              return (
                <button key={p.id} className="item" onClick={() => setPote(p)}>
                  <div className="cresce">
                    <div className="titulo">
                      {p.ml} ml · {p.local === 'freezer' ? 'freezer' : 'geladeira'}
                    </div>
                    <div className="detalhe">
                      tirado {nomeDia(chaveDia(p.extraido_em), chaveDia(agora)).toLowerCase()} às {horaCurta(p.extraido_em)}
                    </div>
                  </div>
                  {s === 'vencido' ? (
                    <span className="etiqueta ruim">venceu</span>
                  ) : s === 'vence-logo' ? (
                    <span className="etiqueta aviso">vence em {textoDuracao(resta)}</span>
                  ) : (
                    <span className="etiqueta">até {dataBr(chaveDia(validadeLeite(p))).slice(0, 5)}</span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="mudo">Sem leite guardado. Ao registrar uma extração, escolha "Geladeira" ou "Freezer" para entrar no estoque.</p>
        )}
        <p className="mudo">Use primeiro o que vence antes (a lista já está nessa ordem).</p>
      </section>
      {extracoes.length > 0 && (
        <section className="cartao" aria-label="Extrações">
          <h2>Extrações</h2>
          <div className="lista">
            {extracoes.map((r) => {
              const d = descrever(r, agora);
              return (
                <button key={r.id} className="item" onClick={() => setEditando(r)}>
                  <div className="cresce">
                    <div className="titulo">{d.titulo}</div>
                    <div className="detalhe">
                      {nomeDia(chaveDia(r.inicio), chaveDia(agora))} · {d.detalhe}
                    </div>
                  </div>
                  {r.criado_por && <span className="quem">{nomeDe(r.criado_por)}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}
      <details className="ajuda cartao">
        <summary>Como guardar o leite (Ministério da Saúde)</summary>
        <ul className="pilha-p" style={{ margin: 0, paddingLeft: 18 }}>
          {ORIENTACAO_LEITE.map((t) => (
            <li key={t} className="texto-2">
              {t}
            </li>
          ))}
        </ul>
      </details>
      {nova && <FolhaRegistroMais tipo="extracao" aoFechar={() => setNova(false)} />}
      {pote && <FolhaPote p={pote} aoFechar={() => setPote(null)} />}
      {editando && <FolhaEditar r={editando} aoFechar={() => setEditando(null)} />}
    </div>
  );
}

// ---------- Introdução alimentar ----------

export function SecaoAlimentacao() {
  const { registros, bebe, nomeDe } = useDados();
  const agora = useAgora(60_000);
  const [nova, setNova] = useState(false);
  const [editando, setEditando] = useState<Registro | null>(null);
  const refeicoes = ordenarRecentes(registros.filter((r): r is RegistroDe<'refeicao'> => r.tipo === 'refeicao')).slice(0, 30);
  const provados = alimentosProvados(registros);
  const provadosNomes = new Set(provados.map((a) => a.nome.toLocaleLowerCase('pt-BR')));
  const nasc = bebe?.nascimento ? new Date(bebe.nascimento) : null;
  const inicio = nasc ? new Date(nasc.getFullYear(), nasc.getMonth() + IDADE_INTRODUCAO_MESES, nasc.getDate()) : null;
  const antes = inicio && inicio.getTime() > agora.getTime();

  return (
    <div className="pilha">
      {antes && inicio && <div className="alerta info">A introdução alimentar começa a partir dos 6 meses ({inicio.toLocaleDateString('pt-BR')}). Até lá, só leite.</div>}
      <button className="botao primario" onClick={() => setNova(true)}>
        <Icone nome="refeicao" /> Registrar refeição
      </button>
      <section className="cartao pilha" aria-label="Alimentos já oferecidos">
        <h2>Alimentos já oferecidos ({provados.length})</h2>
        {provados.length ? (
          <div className="chips">
            {provados.map((a) => (
              <span key={a.nome} className={`etiqueta ${a.reacao ? 'ruim' : ''}`} title={`1ª vez em ${dataBr(chaveDia(a.primeira))}`}>
                {a.reacao && <Icone nome="alerta" />}
                {a.nome}
                {a.vezes > 1 ? ` ×${a.vezes}` : ''}
              </span>
            ))}
          </div>
        ) : (
          <p className="mudo">Cada alimento registrado entra aqui, com a data da 1ª vez. Os que tiveram reação aparecem em vermelho.</p>
        )}
        <div className="pilha-p">
          <span className="rotulo">Para observar com atenção na 1ª vez</span>
          <div className="chips">
            {ALIMENTOS_ATENCAO.map((a) => (
              <span key={a} className={`etiqueta ${provadosNomes.has(a.toLocaleLowerCase('pt-BR')) ? 'bom' : ''}`}>
                {provadosNomes.has(a.toLocaleLowerCase('pt-BR')) && <Icone nome="check" />}
                {a}
              </span>
            ))}
          </div>
        </div>
      </section>
      {refeicoes.length > 0 && (
        <section className="cartao" aria-label="Refeições">
          <h2>Refeições</h2>
          <div className="lista">
            {refeicoes.map((r) => {
              const d = descrever(r, agora);
              return (
                <button key={r.id} className="item t-refeicao" onClick={() => setEditando(r)}>
                  <Selo tipo="refeicao" />
                  <div className="cresce">
                    <div className="titulo">{r.dados.alimentos.join(', ')}</div>
                    <div className="detalhe">
                      {nomeDia(chaveDia(r.inicio), chaveDia(agora))} · {d.detalhe}
                    </div>
                  </div>
                  {r.criado_por && <span className="quem">{nomeDe(r.criado_por)}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}
      <details className="ajuda cartao">
        <summary>Orientações do Guia Alimentar (Ministério da Saúde)</summary>
        <ul className="pilha-p" style={{ margin: 0, paddingLeft: 18 }}>
          {ORIENTACAO_INTRODUCAO.map((t) => (
            <li key={t} className="texto-2">
              {t}
            </li>
          ))}
        </ul>
        <p className="fonte" style={{ marginTop: 8 }}>
          <a href={FONTE_ALIMENTACAO.url} target="_blank" rel="noreferrer">
            {FONTE_ALIMENTACAO.nome}
          </a>
        </p>
      </details>
      {nova && <FolhaRegistroMais tipo="refeicao" aoFechar={() => setNova(false)} />}
      {editando && <FolhaEditar r={editando} aoFechar={() => setEditando(null)} />}
    </div>
  );
}
