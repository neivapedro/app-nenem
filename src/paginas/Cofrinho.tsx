import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarrasDiarias } from '../componentes/barras';
import { BarrasHorizontais, GraficoLinhas, type SerieLinha } from '../componentes/cofrinho-graficos';
import { arquivoPdf, compartilhar, prepararEEnviar } from '../componentes/doc-arquivos';
import { Visualizador } from '../componentes/doc-visualizador';
import { Campo, Escolhas, Folha, Icone } from '../componentes/ui';
import { useDados } from '../dados/contexto';
import {
  aporteNecessario,
  atualizacoesSaldo,
  CENARIOS,
  chaveFormatada,
  depositosPorMes,
  evolucaoMensal,
  lerChavePix,
  lerReais,
  mesesAteIdade,
  mesesParaChegar,
  mesesSeguidos,
  NOME_CHAVE,
  NOME_TIPO_CONTA,
  OCASIAO,
  OCASIOES,
  payloadPix,
  porQuem,
  projetar,
  reais,
  resumo,
  TIPOS_CONTA,
  ultimaAtualizacao,
  type TipoChavePix,
} from '../lib/cofrinho';
import { chaveDia, dataBr, diasEntre, hojeLocal } from '../lib/datas';
import { nomeArquivo } from '../lib/documentos';
import { traduzirErro } from '../lib/erros';
import { idFixo } from '../lib/ids';
import type { ArquivoDocumento, ContaCofrinho, Documento, MetaCofrinho, MovimentoCofrinho, PlanoCofrinho } from '../lib/tipos';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nomeMes = (mes: string, ano = true) => `${MESES[Number(mes.slice(5, 7)) - 1]}${ano ? `/${mes.slice(0, 4)}` : ''}`;
const CHAVE_OCULTO = 'app-nenem:cofrinho-oculto';
const NOMES_FAMILIA = ['Vovó', 'Vovô', 'Dinda', 'Dindo', 'Tia', 'Tio'];
const EMOJIS_META = ['🎓', '🚗', '✈️', '🏠', '💻', '🎸', '⚽', '🎁'];

function idadeTexto(meses: number): string {
  const a = Math.floor(meses / 12);
  const m = meses % 12;
  if (!a) return `${m} ${m === 1 ? 'mês' : 'meses'}`;
  return `${a} ${a === 1 ? 'ano' : 'anos'}${m ? ` e ${m} ${m === 1 ? 'mês' : 'meses'}` : ''}`;
}

/** Valores escondidos (como nos apps de banco), lembrado neste aparelho */
function useOculto(): [boolean, () => void] {
  const [oculto, setOculto] = useState(() => {
    try {
      return localStorage.getItem(CHAVE_OCULTO) === '1';
    } catch {
      return false;
    }
  });
  const alternar = () =>
    setOculto((o) => {
      try {
        localStorage.setItem(CHAVE_OCULTO, o ? '0' : '1');
      } catch {
        /* nada */
      }
      return !o;
    });
  return [oculto, alternar];
}

/** Campo de valor em reais: aceita "50", "1.234,56"; mostra o valor lido embaixo */
function CampoReais({ rotulo, valor, aoMudar, dica }: { rotulo: string; valor: string; aoMudar: (v: string) => void; dica?: ReactNode }) {
  const lido = lerReais(valor);
  return (
    <Campo rotulo={rotulo} dica={valor && lido === null ? 'Valor inválido (ex.: 150 ou 1.234,56)' : (dica ?? (lido !== null ? reais(lido) : undefined))}>
      <input value={valor} onChange={(e) => aoMudar(e.target.value)} inputMode="decimal" placeholder="0,00" autoComplete="off" className="campo-reais" />
    </Campo>
  );
}

const paraTexto = (centavos: number | null | undefined) => (centavos ? (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

// ---------- Folhas ----------

function FolhaConta({ inicial, novo, aoFechar }: { inicial: ContaCofrinho; novo: boolean; aoFechar: () => void }) {
  const { gravar, mostrarAviso } = useDados();
  const [c, setC] = useState(inicial);
  const lida = c.chave_pix ? lerChavePix(c.chave_pix) : null;
  const [tipoChave, setTipoChave] = useState<TipoChavePix>(lida?.tipo ?? 'cpf');
  const [chave, setChave] = useState(chaveFormatada(c.chave_pix));
  const [msg, setMsg] = useState<string | null>(null);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!c.nome.trim()) return setMsg('Dê um nome para a conta (ex.: Poupança Caixa).');
    let chavePix: string | null = null;
    if (chave.trim()) {
      const l = lerChavePix(chave, tipoChave);
      if (!l) return setMsg(tipoChave === 'cpf' || tipoChave === 'cnpj' ? `${NOME_CHAVE[tipoChave]} inválido: confira os números.` : `${NOME_CHAVE[tipoChave]} inválido.`);
      chavePix = l.chave;
    }
    const limpo = (v: string | null) => v?.trim() || null;
    const final: ContaCofrinho = {
      ...c,
      nome: c.nome.trim(),
      instituicao: limpo(c.instituicao),
      agencia: limpo(c.agencia),
      numero: limpo(c.numero),
      titular: limpo(c.titular),
      cidade: limpo(c.cidade),
      rendimento: limpo(c.rendimento),
      observacao: limpo(c.observacao),
      chave_pix: chavePix,
    };
    gravar({ tipo: 'colecao', colecao: 'cofrinho_contas', dado: final });
    mostrarAviso({ texto: novo ? 'Conta criada 🐷' : 'Conta atualizada' });
    aoFechar();
  }

  return (
    <Folha titulo={novo ? 'Nova conta do Heitor' : 'Editar conta'} aoFechar={aoFechar}>
      <form className="pilha" onSubmit={salvar}>
        <Campo rotulo="Nome">
          <input value={c.nome} maxLength={80} onChange={(e) => setC({ ...c, nome: e.target.value })} placeholder="Ex.: Poupança Caixa" autoCapitalize="sentences" />
        </Campo>
        <Campo rotulo="Tipo" grupo>
          <div className="chips">
            {TIPOS_CONTA.map((t) => (
              <button key={t.id} type="button" className={`chip ${c.tipo === t.id ? 'ativo' : ''}`} onClick={() => setC({ ...c, tipo: t.id })}>
                {t.nome}
              </button>
            ))}
          </div>
        </Campo>
        {c.tipo !== 'cofre' && (
          <>
            <Campo rotulo="Banco ou corretora">
              <input value={c.instituicao ?? ''} maxLength={80} onChange={(e) => setC({ ...c, instituicao: e.target.value })} placeholder={c.tipo === 'caixinha' ? 'Ex.: Nubank' : 'Ex.: Caixa, Nubank, Tesouro Direto'} />
            </Campo>
            <div className="grade">
              <Campo rotulo="Agência">
                <input value={c.agencia ?? ''} maxLength={20} inputMode="numeric" onChange={(e) => setC({ ...c, agencia: e.target.value })} />
              </Campo>
              <Campo rotulo="Conta">
                <input value={c.numero ?? ''} maxLength={40} onChange={(e) => setC({ ...c, numero: e.target.value })} />
              </Campo>
            </div>
            <Campo rotulo="Titular">
              <input value={c.titular ?? ''} maxLength={120} onChange={(e) => setC({ ...c, titular: e.target.value })} placeholder="Ex.: Heitor (pais como responsáveis)" autoCapitalize="words" />
            </Campo>
            {c.tipo === 'caixinha' && (
              <p className="dica-cofrinho">💡 A caixinha fica dentro de uma conta (a sua, no Nubank). Use a chave Pix dessa conta: o presente da família cai nela e você guarda na caixinha. Para o saldo, é só abrir o app, ver o valor da caixinha e tocar em “Atualizar saldo” aqui.</p>
            )}
            <Campo rotulo="Chave Pix (para a família depositar)" grupo dica="Com ela o app monta um QR Code para avós, tios e padrinhos.">
              <Escolhas
                opcoes={(['cpf', 'telefone', 'email', 'aleatoria'] as TipoChavePix[]).map((t) => ({ valor: t, rotulo: t === 'aleatoria' ? 'Aleatória' : NOME_CHAVE[t] }))}
                valor={tipoChave}
                aoMudar={setTipoChave}
                rotulo="Tipo de chave"
              />
              <input
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                style={{ marginTop: 8 }}
                aria-label="Chave Pix"
                inputMode={tipoChave === 'cpf' || tipoChave === 'telefone' ? 'numeric' : tipoChave === 'email' ? 'email' : 'text'}
                autoCapitalize="off"
                autoComplete="off"
                placeholder={tipoChave === 'cpf' ? '000.000.000-00' : tipoChave === 'telefone' ? '(11) 90000-0000' : tipoChave === 'email' ? 'nome@email.com' : 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}
              />
            </Campo>
            <div className="grade">
              <Campo rotulo="Cidade (para o QR)">
                <input value={c.cidade ?? ''} maxLength={60} onChange={(e) => setC({ ...c, cidade: e.target.value })} placeholder="Ex.: Jundiaí" autoCapitalize="words" />
              </Campo>
              <Campo rotulo="Rende quanto">
                <input value={c.rendimento ?? ''} maxLength={120} onChange={(e) => setC({ ...c, rendimento: e.target.value })} placeholder={c.tipo === 'caixinha' ? 'Ex.: 100% do CDI' : 'Ex.: 6,17% a.a. + TR'} />
              </Campo>
            </div>
          </>
        )}
        <Campo rotulo="Anotação (opcional)">
          <textarea value={c.observacao ?? ''} maxLength={2000} onChange={(e) => setC({ ...c, observacao: e.target.value })} placeholder="Ex.: resgate só depois dos 18" />
        </Campo>
        {!novo && (
          <label className="marcar">
            <input type="checkbox" checked={!c.ativa} onChange={(e) => setC({ ...c, ativa: !e.target.checked })} />
            <span>Conta encerrada (some das escolhas, mas o histórico fica)</span>
          </label>
        )}
        {msg && (
          <div className="alerta erro" role="alert">
            {msg}
          </div>
        )}
        <button className="botao primario">Salvar</button>
      </form>
    </Folha>
  );
}

function FolhaMovimento({ inicial, novo, contas, aoFechar }: { inicial: MovimentoCofrinho; novo: boolean; contas: ContaCofrinho[]; aoFechar: () => void }) {
  const { gravar, mostrarAviso, repo, membros, cofrinho_movimentos } = useDados();
  const [m, setM] = useState(inicial);
  const [valor, setValor] = useState(paraTexto(inicial.valor_centavos));
  const [enviando, setEnviando] = useState(false);
  const [vendo, setVendo] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const deposito = m.tipo === 'deposito';
  // Quem já mandou antes vem primeiro; depois os responsáveis e a família
  const nomes = useMemo(() => {
    const vistos = new Map<string, string>();
    for (const x of [...cofrinho_movimentos].sort((a, b) => b.data.localeCompare(a.data))) if (x.de?.trim()) vistos.set(x.de.trim().toLocaleLowerCase('pt-BR'), x.de.trim());
    for (const n of [...membros.map((x) => x.nome.split(' ')[0]), ...NOMES_FAMILIA]) if (n && !vistos.has(n.toLocaleLowerCase('pt-BR'))) vistos.set(n.toLocaleLowerCase('pt-BR'), n);
    return [...vistos.values()].slice(0, 12);
  }, [cofrinho_movimentos, membros]);

  async function anexar(f: File | undefined) {
    if (!f) return;
    setEnviando(true);
    setMsg(null);
    try {
      const a: ArquivoDocumento = await prepararEEnviar(repo, f, 1);
      setM((x) => ({ ...x, comprovante: { ...a, nome: `Comprovante${a.tipo === 'application/pdf' ? '.pdf' : '.jpg'}` } }));
    } catch (e) {
      setMsg(`O comprovante não foi enviado: ${traduzirErro(e)}`);
    } finally {
      setEnviando(false);
    }
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    const centavos = lerReais(valor);
    if (centavos === null || (centavos <= 0 && m.tipo !== 'saldo')) return setMsg('Informe o valor (ex.: 150 ou 1.234,56).');
    if (!m.conta_id) return setMsg('Escolha a conta.');
    if (enviando) return setMsg('Espere o comprovante terminar de enviar.');
    const final: MovimentoCofrinho = {
      ...m,
      valor_centavos: centavos,
      de: deposito ? m.de?.trim() || null : null,
      ocasiao: deposito ? m.ocasiao : null,
      recado: deposito ? m.recado?.trim() || null : null,
      observacao: m.observacao?.trim() || null,
    };
    gravar({ tipo: 'colecao', colecao: 'cofrinho_movimentos', dado: final });
    if (inicial.comprovante && inicial.comprovante.caminho !== final.comprovante?.caminho) void repo.excluirArquivos([inicial.comprovante.caminho]).catch(() => undefined);
    mostrarAviso({
      texto: m.tipo === 'deposito' ? `${reais(centavos)} no cofrinho 🐷` : m.tipo === 'saldo' ? 'Saldo atualizado' : 'Retirada registrada',
      desfazer: novo ? () => gravar({ tipo: 'excluir', dado: { alvo: 'cofrinho_movimentos', id: final.id } }) : undefined,
    });
    aoFechar();
  }

  function excluir() {
    if (!window.confirm('Excluir este lançamento?')) return;
    gravar({ tipo: 'excluir', dado: { alvo: 'cofrinho_movimentos', id: inicial.id } });
    if (inicial.comprovante) void repo.excluirArquivos([inicial.comprovante.caminho]).catch(() => undefined);
    mostrarAviso({ texto: 'Lançamento excluído' });
    aoFechar();
  }

  const titulo = novo ? (m.tipo === 'saldo' ? 'Atualizar saldo' : m.tipo === 'retirada' ? 'Nova retirada' : 'Novo depósito') : 'Editar lançamento';
  return (
    <Folha titulo={titulo} aoFechar={aoFechar}>
      <form className="pilha" onSubmit={salvar}>
        <Escolhas
          opcoes={[
            { valor: 'deposito' as const, rotulo: 'Depósito' },
            { valor: 'saldo' as const, rotulo: 'Saldo do extrato' },
            { valor: 'retirada' as const, rotulo: 'Retirada' },
          ]}
          valor={m.tipo}
          aoMudar={(tipo) => setM({ ...m, tipo })}
          rotulo="Tipo"
        />
        {m.tipo === 'saldo' && <p className="texto-2">Olhe o saldo no app do banco e anote aqui: a diferença entre o saldo e o que vocês colocaram é o rendimento.</p>}
        {contas.length > 1 && (
          <Campo rotulo="Conta">
            <select value={m.conta_id} onChange={(e) => setM({ ...m, conta_id: e.target.value })}>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <div className="grade">
          <CampoReais rotulo={m.tipo === 'saldo' ? 'Saldo na data' : 'Valor'} valor={valor} aoMudar={setValor} />
          <Campo rotulo="Data">
            <input type="date" value={m.data} max={hojeLocal()} onChange={(e) => setM({ ...m, data: e.target.value || m.data })} />
          </Campo>
        </div>
        {deposito && (
          <>
            <Campo rotulo="Quem mandou" grupo>
              <input value={m.de ?? ''} maxLength={80} onChange={(e) => setM({ ...m, de: e.target.value })} placeholder="Ex.: Vovó Maria" autoCapitalize="words" aria-label="Quem mandou" />
              <div className="chips" style={{ marginTop: 8 }}>
                {nomes.map((n) => (
                  <button key={n} type="button" className={`chip ${m.de === n ? 'ativo' : ''}`} onClick={() => setM({ ...m, de: n })}>
                    {n}
                  </button>
                ))}
              </div>
            </Campo>
            <Campo rotulo="Ocasião" grupo>
              <div className="chips">
                {OCASIOES.map((o) => (
                  <button key={o.id} type="button" className={`chip ${m.ocasiao === o.id ? 'ativo' : ''}`} onClick={() => setM({ ...m, ocasiao: m.ocasiao === o.id ? null : o.id })}>
                    {o.emoji} {o.nome}
                  </button>
                ))}
              </div>
            </Campo>
            <Campo rotulo="Recado para o Heitor (opcional)" dica="Vai para o mural: para ele ler quando crescer.">
              <textarea value={m.recado ?? ''} maxLength={1000} onChange={(e) => setM({ ...m, recado: e.target.value })} placeholder="Ex.: Para o seu primeiro carro, com amor. Vovó" />
            </Campo>
          </>
        )}
        <Campo rotulo="Comprovante (opcional)" grupo>
          {m.comprovante ? (
            <div className="linha">
              <span className="etiqueta bom">{m.comprovante.tipo === 'application/pdf' ? 'PDF anexado' : 'Foto anexada'}</span>
              <button type="button" className="botao pequeno" onClick={() => setVendo(true)}>
                <Icone nome="olho" /> Ver
              </button>
              <button type="button" className="botao pequeno texto" onClick={() => setM({ ...m, comprovante: null })}>
                Tirar
              </button>
            </div>
          ) : (
            <label className="botao pequeno" style={{ alignSelf: 'flex-start' }}>
              <Icone nome="camera" /> {enviando ? 'Enviando…' : 'Foto ou PDF do comprovante'}
              <input type="file" accept="image/*,application/pdf" hidden disabled={enviando} onChange={(e) => void anexar(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
            </label>
          )}
        </Campo>
        {msg && (
          <div className="alerta erro" role="alert">
            {msg}
          </div>
        )}
        <button className="botao primario" disabled={enviando}>
          Salvar
        </button>
        {!novo && (
          <button type="button" className="botao perigo" onClick={excluir}>
            <Icone nome="lixeira" /> Excluir
          </button>
        )}
      </form>
      {vendo && m.comprovante && (
        <Visualizador
          doc={{ id: 'comprovante', familia_id: '', bebe_id: '', criado_por: null, categoria: 'outros', modelo_id: null, titulo: 'Comprovante', numero: null, data: null, validade: null, observacao: null, arquivos: [m.comprovante] } satisfies Documento}
          aoFechar={() => setVendo(false)}
        />
      )}
    </Folha>
  );
}

function FolhaPlano({ inicial, aoFechar }: { inicial: PlanoCofrinho; aoFechar: () => void }) {
  const { gravar, mostrarAviso } = useDados();
  const [p, setP] = useState(inicial);
  const [valor, setValor] = useState(paraTexto(inicial.aporte_mensal_centavos));
  const cenario = CENARIOS.find((c) => c.taxa === p.taxa_real);
  return (
    <Folha titulo="Plano do cofrinho" aoFechar={aoFechar}>
      <form
        className="pilha"
        onSubmit={(e) => {
          e.preventDefault();
          gravar({ tipo: 'colecao', colecao: 'cofrinho_planos', dado: { ...p, aporte_mensal_centavos: lerReais(valor) ?? 0 } });
          mostrarAviso({ texto: 'Plano salvo' });
          aoFechar();
        }}
      >
        <div className="grade">
          <CampoReais rotulo="Depósito por mês" valor={valor} aoMudar={setValor} />
          <Campo rotulo="Todo dia" dica="Lembrete nesse dia">
            <select value={p.dia_aporte ?? ''} onChange={(e) => setP({ ...p, dia_aporte: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Sem lembrete</option>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        <Campo rotulo="Rendimento esperado (acima da inflação)" grupo dica={cenario ? `${cenario.taxa}% ao ano: ${cenario.detalhe}.` : `${p.taxa_real}% ao ano.`}>
          <Escolhas opcoes={CENARIOS.map((c) => ({ valor: c.taxa as number, rotulo: c.nome }))} valor={p.taxa_real} aoMudar={(taxa_real) => setP({ ...p, taxa_real })} rotulo="Cenário" />
        </Campo>
        <Campo rotulo="Projetar até a idade de">
          <select value={p.idade_alvo} onChange={(e) => setP({ ...p, idade_alvo: Number(e.target.value) })}>
            {[10, 12, 15, 18, 21, 25, 30].map((a) => (
              <option key={a} value={a}>
                {a} anos
              </option>
            ))}
          </select>
        </Campo>
        <p className="mudo">A projeção usa juros compostos mês a mês e mostra tudo em dinheiro de hoje (já descontada a inflação). É uma estimativa, não uma garantia.</p>
        <button className="botao primario">Salvar</button>
      </form>
    </Folha>
  );
}

function FolhaMeta({ inicial, novo, aoFechar }: { inicial: MetaCofrinho; novo: boolean; aoFechar: () => void }) {
  const { gravar, mostrarAviso } = useDados();
  const [m, setM] = useState(inicial);
  const [valor, setValor] = useState(paraTexto(inicial.valor_centavos));
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Folha titulo={novo ? 'Nova meta' : 'Editar meta'} aoFechar={aoFechar}>
      <form
        className="pilha"
        onSubmit={(e) => {
          e.preventDefault();
          const v = lerReais(valor);
          if (!m.nome.trim()) return setMsg('Dê um nome à meta (ex.: Faculdade).');
          if (!v) return setMsg('Informe o valor da meta.');
          gravar({ tipo: 'colecao', colecao: 'cofrinho_metas', dado: { ...m, nome: m.nome.trim(), valor_centavos: v } });
          mostrarAviso({ texto: 'Meta salva 🎯' });
          aoFechar();
        }}
      >
        <div className="chips">
          {EMOJIS_META.map((e) => (
            <button key={e} type="button" className={`chip ${m.emoji === e ? 'ativo' : ''}`} onClick={() => setM({ ...m, emoji: e })} aria-label={`Ícone ${e}`}>
              {e}
            </button>
          ))}
        </div>
        <Campo rotulo="Meta">
          <input value={m.nome} maxLength={80} onChange={(e) => setM({ ...m, nome: e.target.value })} placeholder="Ex.: Faculdade, primeiro carro, intercâmbio" autoCapitalize="sentences" />
        </Campo>
        <div className="grade">
          <CampoReais rotulo="Valor (em dinheiro de hoje)" valor={valor} aoMudar={setValor} />
          <Campo rotulo="Até a idade de">
            <select value={m.idade_anos ?? ''} onChange={(e) => setM({ ...m, idade_anos: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Sem prazo</option>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((a) => (
                <option key={a} value={a}>
                  {a} {a === 1 ? 'ano' : 'anos'}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {msg && <div className="alerta erro">{msg}</div>}
        <button className="botao primario">Salvar</button>
        {!novo && (
          <button
            type="button"
            className="botao perigo"
            onClick={() => {
              gravar({ tipo: 'excluir', dado: { alvo: 'cofrinho_metas', id: inicial.id } });
              mostrarAviso({ texto: 'Meta excluída', desfazer: () => gravar({ tipo: 'colecao', colecao: 'cofrinho_metas', dado: inicial }) });
              aoFechar();
            }}
          >
            <Icone nome="lixeira" /> Excluir
          </button>
        )}
      </form>
    </Folha>
  );
}

/** QR Code em SVG (módulos escuros num caminho só) */
function QrCode({ texto, tamanho = 220 }: { texto: string; tamanho?: number }) {
  const { d, n } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(texto);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4},${r + 4}h1v1h-1z`;
    return { d, n };
  }, [texto]);
  return (
    <svg viewBox={`0 0 ${n + 8} ${n + 8}`} width={tamanho} height={tamanho} role="img" aria-label="QR Code do Pix" shapeRendering="crispEdges" className="qr">
      <rect width={n + 8} height={n + 8} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

/** Imagem do convite (para o WhatsApp da família): nome, QR Code e a chave */
async function imagemConvite(nomeBebe: string, conta: ContaCofrinho, payload: string, valor: number | null): Promise<File> {
  const W = 1080;
  const H = 1500;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const fundo = g.createLinearGradient(0, 0, 0, H);
  fundo.addColorStop(0, '#fdf2e9');
  fundo.addColorStop(1, '#f3e7f7');
  g.fillStyle = fundo;
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#1b1a1f';
  g.textAlign = 'center';
  const fonte = (peso: number, px: number) => `${peso} ${px}px -apple-system, "SF Pro Display", system-ui, sans-serif`;
  g.font = fonte(800, 76);
  g.fillText(`Cofrinho do ${nomeBebe}`, W / 2, 190);
  g.font = fonte(500, 40);
  g.fillStyle = '#57555e';
  g.fillText('Um presente que cresce junto com ele 🐷', W / 2, 260);
  // QR
  const qr = qrcode(0, 'M');
  qr.addData(payload);
  qr.make();
  const n = qr.getModuleCount();
  const lado = 640;
  const x0 = (W - lado) / 2;
  const y0 = 340;
  g.fillStyle = '#fff';
  g.beginPath();
  g.roundRect(x0 - 40, y0 - 40, lado + 80, lado + 80, 48);
  g.fill();
  const m = lado / n;
  g.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (qr.isDark(r, col)) g.fillRect(x0 + col * m, y0 + r * m, Math.ceil(m), Math.ceil(m));
  g.fillStyle = '#1b1a1f';
  g.font = fonte(700, 46);
  g.fillText(valor ? `Pix de ${reais(valor)}` : 'Pix no valor que quiser', W / 2, y0 + lado + 130);
  g.font = fonte(500, 34);
  g.fillStyle = '#57555e';
  const chave = conta.chave_pix ?? '';
  const lida = lerChavePix(chave);
  g.fillText(`${lida ? NOME_CHAVE[lida.tipo] : 'Chave'}: ${chaveFormatada(chave)}`, W / 2, y0 + lado + 190);
  if (conta.instituicao || conta.titular) g.fillText([conta.titular, conta.instituicao].filter(Boolean).join(' · '), W / 2, y0 + lado + 240);
  g.font = fonte(500, 30);
  g.fillText('Abra o app do banco → Pix → Ler QR Code (ou "Pix copia e cola")', W / 2, H - 110);
  const blob = await new Promise<Blob>((ok, falha) => c.toBlob((b) => (b ? ok(b) : falha(new Error('Não foi possível montar a imagem.'))), 'image/png'));
  return new File([blob], `Cofrinho do ${nomeBebe}.png`, { type: 'image/png' });
}

function FolhaPix({ contas, aoFechar }: { contas: ContaCofrinho[]; aoFechar: () => void }) {
  const { bebe, mostrarAviso } = useDados();
  const comChave = contas.filter((c) => c.chave_pix && lerChavePix(c.chave_pix));
  const [contaId, setContaId] = useState(comChave[0]?.id ?? '');
  const [valor, setValor] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const conta = comChave.find((c) => c.id === contaId);
  const nomeBebe = bebe?.nome?.trim().split(' ')[0] || 'bebê';
  const centavos = lerReais(valor);
  const payload = useMemo(() => {
    if (!conta?.chave_pix) return null;
    try {
      return payloadPix({ chave: conta.chave_pix, nome: conta.titular || bebe?.nome || 'Heitor', cidade: conta.cidade || 'Brasil', valorCentavos: centavos, mensagem: `Cofrinho do ${nomeBebe}` });
    } catch {
      return null;
    }
  }, [conta, centavos, bebe, nomeBebe]);

  if (!comChave.length)
    return (
      <Folha titulo="Convidar a família" aoFechar={aoFechar}>
        <div className="pilha">
          <p className="texto-2">Para avós, tios e padrinhos depositarem direto na conta do {nomeBebe}, cadastre a chave Pix da conta: toque na conta → Editar → Chave Pix.</p>
          <button className="botao" onClick={aoFechar}>
            Entendi
          </button>
        </div>
      </Folha>
    );

  return (
    <Folha titulo="Convidar a família" aoFechar={aoFechar}>
      <div className="pilha" style={{ alignItems: 'stretch' }}>
        <p className="texto-2">Mande o QR Code no grupo da família: quem quiser presentear o {nomeBebe} faz um Pix direto para a conta dele.</p>
        {comChave.length > 1 && (
          <Campo rotulo="Conta">
            <select value={contaId} onChange={(e) => setContaId(e.target.value)}>
              {comChave.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <CampoReais rotulo="Valor (opcional)" valor={valor} aoMudar={setValor} dica="Em branco, cada um escolhe quanto quer mandar." />
        {payload && (
          <div className="pix-cartao">
            <QrCode texto={payload} />
            <strong>{conta?.titular || conta?.nome}</strong>
            <span className="texto-2">
              {conta?.chave_pix && NOME_CHAVE[lerChavePix(conta.chave_pix)!.tipo]}: {chaveFormatada(conta?.chave_pix ?? null)}
            </span>
          </div>
        )}
        {payload && (
          <>
            <button
              className="botao primario"
              onClick={async () => {
                setMsg(null);
                try {
                  const img = await imagemConvite(nomeBebe, conta!, payload, centavos);
                  await compartilhar([img], `Cofrinho do ${nomeBebe}`);
                } catch (e) {
                  setMsg(traduzirErro(e));
                }
              }}
            >
              <Icone nome="compartilhar" /> Enviar convite (imagem com QR)
            </button>
            <button
              className="botao"
              onClick={() =>
                navigator.clipboard
                  .writeText(payload)
                  .then(() => mostrarAviso({ texto: 'Pix copia e cola copiado' }))
                  .catch(() => setMsg(payload))
              }
            >
              <Icone nome="copiar" /> Copiar “Pix copia e cola”
            </button>
          </>
        )}
        <p className="mudo">Antes de mandar, teste: leia o QR Code com o app do seu banco e confira o nome que aparece (sem concluir o Pix).</p>
        {msg && <div className="alerta erro">{msg}</div>}
      </div>
    </Folha>
  );
}

function FolhaContaVer({ conta, aoFechar, aoEditar, aoLancamento }: { conta: ContaCofrinho; aoFechar: () => void; aoEditar: () => void; aoLancamento: (m: MovimentoCofrinho) => void }) {
  const { cofrinho_movimentos, mostrarAviso } = useDados();
  const movs = cofrinho_movimentos.filter((m) => m.conta_id === conta.id).sort((a, b) => b.data.localeCompare(a.data));
  const r = resumo([conta], movs);
  const copiar = (t: string) =>
    navigator.clipboard
      .writeText(t)
      .then(() => mostrarAviso({ texto: 'Copiado' }))
      .catch(() => undefined);
  const linhas: [string, string | null][] = [
    ['Banco', conta.instituicao],
    ['Agência', conta.agencia],
    ['Conta', conta.numero],
    ['Titular', conta.titular],
    ['Chave Pix', chaveFormatada(conta.chave_pix) || null],
    ['Rende', conta.rendimento],
  ];
  return (
    <Folha titulo={conta.nome} aoFechar={aoFechar}>
      <div className="pilha">
        <div className="linha" style={{ gap: 6 }}>
          <span className="etiqueta">{NOME_TIPO_CONTA[conta.tipo]}</span>
          {!conta.ativa && <span className="etiqueta">Encerrada</span>}
        </div>
        <div className="grade">
          <div className="bloco">
            <div className="rotulo">Saldo</div>
            <div className="valor">{reais(r.saldo)}</div>
          </div>
          <div className="bloco">
            <div className="rotulo">Rendeu</div>
            <div className="valor">{reais(r.rendimento, { sinal: true })}</div>
          </div>
        </div>
        {r.porConta.get(conta.id)?.ultimoExtrato ? <p className="mudo">Saldo conferido no extrato em {dataBr(r.porConta.get(conta.id)!.ultimoExtrato!)}.</p> : <p className="mudo">Sem saldo do extrato ainda: o saldo é a soma dos depósitos.</p>}
        <div>
          {linhas
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="doc-numero">
                <span className="cresce">
                  <span className="texto-2" style={{ display: 'block' }}>
                    {k}
                  </span>
                  <span className="valor">{v}</span>
                </span>
                {k !== 'Rende' && k !== 'Banco' && (
                  <button type="button" className="icone-botao" aria-label={`Copiar ${k}`} onClick={() => copiar(v!)}>
                    <Icone nome="copiar" />
                  </button>
                )}
              </div>
            ))}
        </div>
        {conta.observacao && <p style={{ whiteSpace: 'pre-wrap' }}>{conta.observacao}</p>}
        <h3 style={{ margin: 0 }}>Extrato</h3>
        <ListaMovimentos movs={movs} contas={[conta]} aoAbrir={aoLancamento} limite={30} />
        <button className="botao" onClick={aoEditar}>
          Editar conta
        </button>
      </div>
    </Folha>
  );
}

function ListaMovimentos({ movs, contas, aoAbrir, limite }: { movs: MovimentoCofrinho[]; contas: ContaCofrinho[]; aoAbrir: (m: MovimentoCofrinho) => void; limite?: number }) {
  const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));
  const lista = limite ? movs.slice(0, limite) : movs;
  if (!lista.length) return <p className="texto-2">Nenhum lançamento ainda.</p>;
  return (
    <div className="doc-lista">
      {lista.map((m) => (
        <button key={m.id} type="button" className="doc-linha" onClick={() => aoAbrir(m)}>
          <span className={`mov-icone ${m.tipo}`} aria-hidden="true">
            {m.tipo === 'deposito' ? (m.ocasiao ? OCASIAO[m.ocasiao].emoji : '🐷') : m.tipo === 'saldo' ? '🧾' : '↩︎'}
          </span>
          <span className="cresce">
            <span className="doc-titulo">{m.tipo === 'deposito' ? m.de || 'Depósito' : m.tipo === 'saldo' ? 'Saldo do extrato' : 'Retirada'}</span>
            <span className="texto-2">
              {dataBr(m.data)}
              {contas.length > 1 && ` · ${nomeConta.get(m.conta_id) ?? ''}`}
              {m.ocasiao && ` · ${OCASIAO[m.ocasiao].nome}`}
              {m.comprovante && ' · 📎'}
            </span>
          </span>
          <strong className={`mov-valor ${m.tipo}`}>{m.tipo === 'retirada' ? `−${reais(m.valor_centavos)}` : m.tipo === 'saldo' ? reais(m.valor_centavos) : `+${reais(m.valor_centavos)}`}</strong>
        </button>
      ))}
    </div>
  );
}

/** Atualizar o saldo: um campo por conta, já com o saldo atual; salva só o que mudou (ou foi confirmado) */
function FolhaAtualizarSaldo({ contas, movs, aoFechar }: { contas: ContaCofrinho[]; movs: MovimentoCofrinho[]; aoFechar: () => void }) {
  const { gravar, mostrarAviso, membro, usuario, hoje, nomeDe } = useDados();
  const atuais = useMemo(() => new Map(contas.map((c) => [c.id, resumo([c], movs, hoje).saldo])), [contas, movs, hoje]);
  const [valores, setValores] = useState<Record<string, string>>(() => Object.fromEntries(contas.map((c) => [c.id, paraTexto(atuais.get(c.id))])));
  const [tocados, setTocados] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!membro) return;
    const novos: MovimentoCofrinho[] = [];
    let rendeu = 0;
    for (const c of contas) {
      if (!tocados.has(c.id)) continue;
      const v = lerReais(valores[c.id] ?? '');
      if (v === null) return setMsg(`Valor inválido em ${c.nome}.`);
      rendeu += v - (atuais.get(c.id) ?? 0);
      // Já anotaram hoje nesta conta: troca a anotação de hoje em vez de criar outra
      const hojeJa = movs.find((m) => m.conta_id === c.id && m.tipo === 'saldo' && m.data === hoje);
      novos.push({
        id: hojeJa?.id ?? crypto.randomUUID(),
        familia_id: membro.familia_id,
        criado_por: usuario?.id ?? null,
        conta_id: c.id,
        tipo: 'saldo',
        data: hoje,
        valor_centavos: v,
        de: null,
        ocasiao: null,
        recado: null,
        observacao: null,
        comprovante: null,
      });
    }
    if (!novos.length) return setMsg('Digite o saldo que aparece no app do banco (ou toque em "Está igual").');
    gravar(...novos.map((dado) => ({ tipo: 'colecao' as const, colecao: 'cofrinho_movimentos' as const, dado })));
    mostrarAviso({ texto: rendeu > 0 ? `Saldo atualizado · rendeu ${reais(rendeu, { sinal: true })} 📈` : 'Saldo atualizado' });
    aoFechar();
  }

  return (
    <Folha titulo="Atualizar saldo" aoFechar={aoFechar}>
      <form className="pilha" onSubmit={salvar}>
        <p className="texto-2">Abra o app do banco, veja quanto tem {contas.length > 1 ? 'em cada conta' : 'na conta'} e anote aqui. O app calcula quanto rendeu.</p>
        {contas.map((c) => {
          const ultima = movs.filter((m) => m.conta_id === c.id && m.tipo === 'saldo').sort((a, b) => b.data.localeCompare(a.data))[0];
          const lido = lerReais(valores[c.id] ?? '');
          const dif = lido !== null && tocados.has(c.id) ? lido - (atuais.get(c.id) ?? 0) : 0;
          return (
            <div key={c.id} className="pilha-p">
              <Campo
                rotulo={`${c.nome}${c.instituicao ? ` · ${c.instituicao}` : ''}`}
                dica={
                  <>
                    {ultima ? `Última anotação: ${reais(ultima.valor_centavos)} em ${dataBr(ultima.data)}${ultima.criado_por ? ` · ${nomeDe(ultima.criado_por)}` : ''}` : 'Primeira anotação desta conta'}
                    {dif !== 0 && <strong className={dif > 0 ? 'positivo' : 'negativo'}> · {reais(dif, { sinal: true })} desde o que o app tinha</strong>}
                  </>
                }
              >
                <input
                  value={valores[c.id] ?? ''}
                  inputMode="decimal"
                  className="campo-reais"
                  autoComplete="off"
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => {
                    setValores({ ...valores, [c.id]: e.target.value });
                    setTocados(new Set(tocados).add(c.id));
                  }}
                />
              </Campo>
              {!tocados.has(c.id) && (
                <button type="button" className="botao pequeno texto" style={{ alignSelf: 'flex-start' }} onClick={() => setTocados(new Set(tocados).add(c.id))}>
                  Está igual: confirmar {reais(atuais.get(c.id) ?? 0)}
                </button>
              )}
            </div>
          );
        })}
        {msg && (
          <div className="alerta erro" role="alert">
            {msg}
          </div>
        )}
        <button className="botao primario">Salvar</button>
        <p className="mudo">Depósitos novos continuam no botão “Depósito” (quem mandou, recado). Aqui é só o valor que o banco mostra.</p>
      </form>
    </Folha>
  );
}

function ListaAtualizacoes({ contas, movs, oculto, limite }: { contas: ContaCofrinho[]; movs: MovimentoCofrinho[]; oculto: boolean; limite?: number }) {
  const { nomeDe } = useDados();
  const lista = contas
    .flatMap((c) => atualizacoesSaldo(movs.filter((m) => m.conta_id === c.id)).map((a) => ({ ...a, conta: c })))
    .sort((a, b) => b.mov.data.localeCompare(a.mov.data));
  return (
    <div className="doc-lista">
      {(limite ? lista.slice(0, limite) : lista).map(({ mov, rendeu, colocado, primeira, conta }) => (
        <div key={mov.id} className="doc-linha" style={{ cursor: 'default' }}>
          <span className="mov-icone" aria-hidden="true">
            {rendeu > 0 ? '📈' : rendeu < 0 ? '📉' : '🧾'}
          </span>
          <span className="cresce">
            <span className="doc-titulo">{oculto ? 'R$ •••' : reais(mov.valor_centavos)}</span>
            <span className="texto-2">
              {dataBr(mov.data)}
              {contas.length > 1 && ` · ${conta.nome}`}
              {mov.criado_por && ` · ${nomeDe(mov.criado_por)}`}
              {!oculto && colocado !== 0 && ` · ${colocado > 0 ? '+' : '−'}${reais(Math.abs(colocado))} depositado`}
            </span>
          </span>
          <span style={{ textAlign: 'right' }}>
            <strong className={`mov-valor ${rendeu > 0 ? 'deposito' : rendeu < 0 ? 'retirada' : ''}`}>{oculto ? '•••' : reais(rendeu, { sinal: true })}</strong>
            <span className="mudo" style={{ display: 'block', fontSize: '0.72rem' }}>
              {primeira ? 'rendeu até aqui' : 'rendeu no período'}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------- Tela ----------

type Aberta =
  | { modo: 'conta'; conta: ContaCofrinho; novo: boolean }
  | { modo: 'ver-conta'; id: string }
  | { modo: 'movimento'; mov: MovimentoCofrinho; novo: boolean }
  | { modo: 'plano' }
  | { modo: 'meta'; meta: MetaCofrinho; novo: boolean }
  | { modo: 'pix' }
  | { modo: 'atualizar' }
  | null;

export function Cofrinho() {
  const dados = useDados();
  const { bebe, membro, usuario, hoje, cofrinho_contas, cofrinho_movimentos, cofrinho_metas, cofrinho_planos } = dados;
  const [aberta, setAberta] = useState<Aberta>(null);
  const [oculto, alternarOculto] = useOculto();
  const [verTodos, setVerTodos] = useState(false);
  const [preparando, setPreparando] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();

  // Aviso "atualize o saldo" abre direto a folha
  useEffect(() => {
    if (params.get('atualizar') && cofrinho_contas.length) {
      setAberta({ modo: 'atualizar' });
      setParams({}, { replace: true });
    }
  }, [params, setParams, cofrinho_contas.length]);

  const contas = useMemo(() => cofrinho_contas.filter((c) => !bebe || c.bebe_id === bebe.id), [cofrinho_contas, bebe]);
  const idsContas = useMemo(() => new Set(contas.map((c) => c.id)), [contas]);
  const movs = useMemo(() => cofrinho_movimentos.filter((m) => idsContas.has(m.conta_id)).sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id)), [cofrinho_movimentos, idsContas]);
  const metas = cofrinho_metas.filter((m) => !bebe || m.bebe_id === bebe.id).sort((a, b) => a.valor_centavos - b.valor_centavos);
  const plano: PlanoCofrinho | null = useMemo(() => {
    if (!bebe || !membro) return null;
    return (
      cofrinho_planos.find((p) => p.bebe_id === bebe.id) ?? {
        id: idFixo(`${bebe.id}:cofrinho:plano`),
        familia_id: membro.familia_id,
        bebe_id: bebe.id,
        criado_por: usuario?.id ?? null,
        aporte_mensal_centavos: 0,
        dia_aporte: null,
        taxa_real: 4,
        idade_alvo: 18,
      }
    );
  }, [cofrinho_planos, bebe, membro, usuario]);

  // Até hoje (um lançamento com data futura não entra no saldo)
  const r = useMemo(() => resumo(contas, movs, hoje), [contas, movs, hoje]);
  const evolucao = useMemo(() => evolucaoMensal(contas, movs, hoje), [contas, movs, hoje]);
  const porMes = useMemo(() => depositosPorMes(movs, hoje, 12), [movs, hoje]);
  const quem = useMemo(() => porQuem(movs), [movs]);
  const seguidos = mesesSeguidos(movs, hoje);
  const recados = movs.filter((m) => m.tipo === 'deposito' && m.recado);
  const $ = (c: number, o?: Parameters<typeof reais>[1]) => (oculto ? 'R$ •••' : reais(c, o));
  const $eixo = (c: number) => (oculto ? '•••' : reais(c, { compacto: true }).replace('R$ ', ''));

  // Simulador: começa no plano, muda ao vivo (salva só se quiser)
  const [simAporte, setSimAporte] = useState<number | null>(null);
  const aporte = simAporte ?? plano?.aporte_mensal_centavos ?? 0;
  useEffect(() => setSimAporte(null), [plano?.aporte_mensal_centavos]);

  const nascimento = bebe?.nascimento ? chaveDia(bebe.nascimento) : (bebe?.data_prevista ?? hoje);
  const idadeAlvo = plano?.idade_alvo ?? 18;
  const mesesProj = Math.max(12, mesesAteIdade(nascimento, hoje, idadeAlvo));
  const idadeHojeMeses = Math.max(0, idadeAlvo * 12 - mesesAteIdade(nascimento, hoje, idadeAlvo));
  const projecoes = useMemo(() => CENARIOS.map((c) => ({ ...c, serie: projetar(r.saldo, aporte, c.taxa, mesesProj) })), [r.saldo, aporte, mesesProj]);
  const soDepositos = useMemo(() => projetar(r.saldo, aporte, 0, mesesProj), [r.saldo, aporte, mesesProj]);
  const escolhido = projecoes.find((p) => p.taxa === plano?.taxa_real) ?? projecoes[1];
  const final = escolhido.serie[escolhido.serie.length - 1];
  const com50 = projetar(r.saldo, aporte + 5000, escolhido.taxa, mesesProj).at(-1)! - final;
  const mesAtual = hoje.slice(0, 7);
  const depositouMes = movs.some((m) => m.tipo === 'deposito' && m.data.startsWith(mesAtual));
  const contasAtivas = contas.filter((c) => c.ativa);

  function novoMovimento(tipo: MovimentoCofrinho['tipo'] = 'deposito') {
    if (!membro || !contasAtivas.length) return;
    setAberta({
      modo: 'movimento',
      novo: true,
      mov: {
        id: crypto.randomUUID(),
        familia_id: membro.familia_id,
        criado_por: usuario?.id ?? null,
        conta_id: contasAtivas[0].id,
        tipo,
        data: hoje,
        valor_centavos: tipo === 'deposito' && plano?.aporte_mensal_centavos && !depositouMes ? plano.aporte_mensal_centavos : 0,
        de: tipo === 'deposito' ? (membro.nome.split(' ')[0] ?? null) : null,
        ocasiao: tipo === 'deposito' && plano?.aporte_mensal_centavos && !depositouMes ? 'mensal' : null,
        recado: null,
        observacao: null,
        comprovante: null,
      },
    });
  }

  function novaConta() {
    if (!bebe || !membro) return;
    setAberta({
      modo: 'conta',
      novo: true,
      conta: {
        id: crypto.randomUUID(),
        familia_id: membro.familia_id,
        bebe_id: bebe.id,
        criado_por: usuario?.id ?? null,
        nome: contas.length ? '' : `Caixinha do ${bebe.nome?.split(' ')[0] || 'bebê'}`,
        tipo: 'caixinha',
        instituicao: contas.length ? null : 'Nubank',
        agencia: null,
        numero: null,
        titular: membro.nome || null,
        chave_pix: null,
        cidade: null,
        rendimento: null,
        ativa: true,
        observacao: null,
      },
    });
  }

  function novaMeta() {
    if (!bebe || !membro) return;
    setAberta({ modo: 'meta', novo: true, meta: { id: crypto.randomUUID(), familia_id: membro.familia_id, bebe_id: bebe.id, criado_por: usuario?.id ?? null, nome: '', emoji: '🎓', valor_centavos: 0, idade_anos: 18 } });
  }

  async function extratoPdf() {
    try {
      setPreparando('Montando o extrato…');
      const { montarExtratoCofrinho } = await import('../lib/pdf-documentos');
      const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));
      const bytes = await montarExtratoCofrinho({
        titulo: `Cofrinho do ${bebe?.nome?.split(' ')[0] || 'bebê'}`,
        geradoEm: new Date().toLocaleString('pt-BR'),
        resumo: [
          ['Saldo total', reais(r.saldo)],
          ['Colocado pela família', reais(r.aportado)],
          ['Rendimento', `${reais(r.rendimento, { sinal: true })}${r.rendimentoPct !== null ? ` (${(r.rendimentoPct * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)` : ''}`],
          ['Depósitos', String(r.depositos)],
        ],
        contas: contas.map((c) => [c.nome, [NOME_TIPO_CONTA[c.tipo], c.instituicao].filter(Boolean).join(' · '), reais(r.porConta.get(c.id)?.saldo ?? 0)]),
        quem: quem.map((q) => [q.de, `${q.vezes}×`, reais(q.centavos)]),
        movimentos: [...movs]
          .reverse()
          .map((m) => [dataBr(m.data), m.tipo === 'deposito' ? 'Depósito' : m.tipo === 'saldo' ? 'Saldo (extrato)' : 'Retirada', nomeConta.get(m.conta_id) ?? '', m.de ?? '', m.tipo === 'retirada' ? `-${reais(m.valor_centavos)}` : reais(m.valor_centavos)]),
        recados: recados.map((m) => [dataBr(m.data), m.de ?? '', m.recado ?? '']),
      });
      setPreparando(null);
      await compartilhar([arquivoPdf(bytes, nomeArquivo('Extrato do cofrinho', bebe?.nome))], 'Extrato do cofrinho');
    } catch (e) {
      setPreparando(null);
      dados.setErro(traduzirErro(e));
    }
  }

  function planilha() {
    const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));
    const csv = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = [['data', 'tipo', 'conta', 'valor', 'quem', 'ocasiao', 'recado', 'observacao'].join(';')];
    for (const m of [...movs].reverse())
      linhas.push([m.data, m.tipo, nomeConta.get(m.conta_id), (m.valor_centavos / 100).toFixed(2).replace('.', ','), m.de, m.ocasiao ? OCASIAO[m.ocasiao].nome : '', m.recado, m.observacao].map(csv).join(';'));
    void compartilhar([new File(['﻿' + linhas.join('\n')], `cofrinho-${hoje}.csv`, { type: 'text/csv' })], 'Cofrinho');
  }

  if (!bebe || !plano) return <div className="alerta">Cadastre o bebê em Ajustes para usar o cofrinho.</div>;
  const nomeBebe = bebe.nome?.split(' ')[0] || 'bebê';
  const contaAberta = aberta?.modo === 'ver-conta' ? contas.find((c) => c.id === aberta.id) : undefined;
  const ticksIdade = (() => {
    const passo = mesesProj > 12 * 12 ? 36 : mesesProj > 6 * 12 ? 24 : 12;
    const t: { i: number; texto: string }[] = [{ i: 0, texto: 'hoje' }];
    // Idades no meio só com número; longe o bastante do fim para não encostar em "18 anos"
    for (let i = passo - (idadeHojeMeses % passo); i < mesesProj - passo; i += passo) if (i > passo * 0.4) t.push({ i, texto: String(Math.round((idadeHojeMeses + i) / 12)) });
    t.push({ i: mesesProj, texto: `${idadeAlvo} anos` });
    return t;
  })();

  // Sem conta ainda: boas-vindas
  if (!contas.length)
    return (
      <div className="pilha">
        <section className="cartao cofrinho-heroi pilha" style={{ textAlign: 'center', alignItems: 'center' }}>
          <span className="cofrinho-emoji" aria-hidden="true">
            🐷
          </span>
          <h2>O cofrinho do {nomeBebe}</h2>
          <p className="texto-2">Registre a conta dele, os depósitos de todo mês e os presentes da família. O app mostra o saldo, quanto já rendeu, quem mais contribuiu e quanto ele vai ter aos 18 anos.</p>
          <button className="botao primario" onClick={novaConta}>
            <Icone nome="mais" /> Cadastrar a conta do {nomeBebe}
          </button>
          <p className="mudo">Pode ser poupança, CDB, Tesouro, previdência ou até o cofrinho de casa. Dá para ter mais de uma.</p>
        </section>
        <Dicas />
        {aberta?.modo === 'conta' && <FolhaConta inicial={aberta.conta} novo={aberta.novo} aoFechar={() => setAberta(null)} />}
      </div>
    );

  return (
    <div className="pilha">
      {/* Resumo */}
      <section className="cartao cofrinho-heroi pilha-p" aria-label="Saldo">
        <div className="linha" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
          <span className="texto-2">Saldo do {nomeBebe}</span>
          <button className="icone-botao" onClick={alternarOculto} aria-label={oculto ? 'Mostrar valores' : 'Esconder valores'} aria-pressed={oculto}>
            <Icone nome={oculto ? 'olho_fechado' : 'olho'} />
          </button>
        </div>
        <div className="cofrinho-saldo">{$(r.saldo)}</div>
        <div className="cofrinho-sub">
          <span>
            Colocado <strong>{$(r.aportado)}</strong>
          </span>
          <span>
            Rendeu <strong className={r.rendimento >= 0 ? 'positivo' : 'negativo'}>{oculto ? '•••' : reais(r.rendimento, { sinal: true })}</strong>
            {r.rendimentoPct !== null && !oculto && r.rendimento !== 0 && <> ({(r.rendimentoPct * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)</>}
          </span>
        </div>
        <div className="linha" style={{ gap: 6 }}>
          {seguidos >= 2 && <span className="etiqueta bom">🔥 {seguidos} meses seguidos</span>}
          {r.depositos > 0 && <span className="etiqueta">{r.depositos} {r.depositos === 1 ? 'depósito' : 'depósitos'}</span>}
          {quem.length > 1 && <span className="etiqueta">{quem.length} pessoas contribuíram</span>}
        </div>
        {!r.depositos && <p className="mudo">Registre o primeiro depósito para o cofrinho ganhar vida.</p>}
        {(() => {
          const u = ultimaAtualizacao(movs);
          if (!u) return r.depositos ? (
            <button type="button" className="aviso-saldo" onClick={() => setAberta({ modo: 'atualizar' })}>
              Ainda sem saldo do banco: abra o app, veja o valor e toque aqui para anotar. Assim aparece quanto rendeu.
            </button>
          ) : null;
          const dias = diasEntre(u.data, hoje);
          const quando = dias <= 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
          const por = u.criado_por ? dados.nomeDe(u.criado_por) : null;
          return dias >= 30 ? (
            <button type="button" className="aviso-saldo" onClick={() => setAberta({ modo: 'atualizar' })}>
              Saldo do banco anotado {quando}{por ? ` por ${por}` : ''}. Toque para atualizar.
            </button>
          ) : (
            <span className="mudo">
              Saldo do banco anotado {quando}
              {por ? ` · ${por}` : ''}
            </span>
          );
        })()}
      </section>

      <div className="doc-botoes">
        <button className="botao primario" onClick={() => novoMovimento('deposito')} disabled={!contasAtivas.length}>
          <Icone nome="mais" /> Depósito
        </button>
        <button className="botao" onClick={() => setAberta({ modo: 'atualizar' })} disabled={!contasAtivas.length}>
          <Icone nome="girar" /> Atualizar saldo
        </button>
        <button className="botao" onClick={() => setAberta({ modo: 'pix' })}>
          <Icone nome="qr" /> Convidar
        </button>
      </div>

      {/* Plano do mês */}
      <section className="cartao">
        <button type="button" className="doc-linha" style={{ padding: 0 }} onClick={() => setAberta({ modo: 'plano' })}>
          <span className="mov-icone deposito" aria-hidden="true">
            📅
          </span>
          <span className="cresce">
            <span className="doc-titulo">{plano.aporte_mensal_centavos ? `Plano: ${$(plano.aporte_mensal_centavos)} por mês` : 'Definir o depósito mensal'}</span>
            <span className="texto-2">
              {plano.aporte_mensal_centavos
                ? depositouMes
                  ? `Depósito de ${nomeMes(mesAtual, false)} feito ✓`
                  : plano.dia_aporte
                    ? `Depósito de ${nomeMes(mesAtual, false)}: todo dia ${plano.dia_aporte}${Number(hoje.slice(8)) > plano.dia_aporte ? ' (ainda não registrado)' : ''}`
                    : `Depósito de ${nomeMes(mesAtual, false)} ainda não registrado`
                : 'Com o plano, o app projeta o futuro e lembra no dia'}
            </span>
          </span>
          <span className="seta" style={{ color: 'var(--texto-3)' }}>
            <Icone nome="seta" />
          </span>
        </button>
      </section>

      {/* Projeção */}
      <section className="cartao pilha-p" aria-label="Projeção">
        <h2>Aos {idadeAlvo} anos</h2>
        <div className="cofrinho-projecao">{$(final)}</div>
        <p className="texto-2">
          No cenário {escolhido.nome.toLowerCase()} ({escolhido.taxa}% ao ano acima da inflação), com {$(aporte)} por mês. Em dinheiro de hoje.
        </p>
        <GraficoLinhas
          rotulo={`Projeção do cofrinho até os ${idadeAlvo} anos`}
          series={[
            ...[...projecoes].reverse().map(
              (p): SerieLinha => ({ id: p.id, nome: p.nome, cor: `var(--c-cenario-${p.id})`, valores: p.serie.map((v) => Math.round(v)) }),
            ),
            { id: 'depositos', nome: 'Só os depósitos', cor: 'var(--texto-3)', valores: soDepositos, area: true },
          ]}
          rotulosX={Array.from({ length: mesesProj + 1 }, (_, i) => (i === 0 ? 'Hoje' : `${idadeTexto(idadeHojeMeses + i)}`))}
          ticksX={ticksIdade}
          formatar={(v) => $(v)}
          formatarEixo={$eixo}
          referencias={metas.slice(0, 3).map((m) => ({ valor: m.valor_centavos, texto: `${m.emoji ?? '🎯'} ${m.nome}` }))}
          legendaValor
        />
        <Campo rotulo={`Simular depósito mensal: ${$(aporte)}`}>
          <input type="range" min={0} max={300000} step={1000} value={aporte} onChange={(e) => setSimAporte(Number(e.target.value))} aria-valuetext={reais(aporte)} />
        </Campo>
        {!oculto && com50 > 0 && (
          <p className="dica-cofrinho">
            💡 Cada <strong>R$ 50 a mais</strong> por mês viram cerca de <strong>{reais(com50, { compacto: true })}</strong> a mais aos {idadeAlvo} anos.
          </p>
        )}
        {simAporte !== null && simAporte !== plano.aporte_mensal_centavos && (
          <button className="botao pequeno" onClick={() => dados.gravar({ tipo: 'colecao', colecao: 'cofrinho_planos', dado: { ...plano, aporte_mensal_centavos: simAporte } })}>
            Usar {reais(simAporte)} como plano
          </button>
        )}
        <details className="ajuda">
          <summary>Ver em tabela</summary>
          <table className="tabela-simples">
            <thead>
              <tr>
                <th>Idade</th>
                {projecoes.map((p) => (
                  <th key={p.id}>{p.nome}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.floor(mesesProj / 12) }, (_, k) => (k + 1) * 12)
                .filter((i) => i <= mesesProj)
                .filter((_, k, arr) => arr.length <= 10 || k % 2 === 1 || k === arr.length - 1)
                .map((i) => (
                  <tr key={i}>
                    <td>{Math.floor((idadeHojeMeses + i) / 12)} anos</td>
                    {projecoes.map((p) => (
                      <td key={p.id}>{$(p.serie[i], { compacto: true })}</td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      </section>

      {/* Metas */}
      <section className="cartao pilha-p">
        <div className="cartao-cab">
          <h2>Metas</h2>
          <button type="button" className="icone-botao" aria-label="Nova meta" onClick={novaMeta}>
            <Icone nome="mais" />
          </button>
        </div>
        {!metas.length && <p className="texto-2">Faculdade, primeiro carro, intercâmbio… Crie uma meta e o app diz quando ela chega e quanto falta por mês.</p>}
        {metas.map((m) => {
          const pct = Math.min(1, r.saldo / m.valor_centavos);
          const meses = mesesParaChegar(r.saldo, aporte, escolhido.taxa, m.valor_centavos);
          const prazo = m.idade_anos ? mesesAteIdade(nascimento, hoje, m.idade_anos) : null;
          const precisa = prazo !== null ? aporteNecessario(r.saldo, m.valor_centavos, escolhido.taxa, prazo) : null;
          return (
            <button key={m.id} type="button" className="meta" onClick={() => setAberta({ modo: 'meta', meta: m, novo: false })}>
              <div className="linha" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                <span className="doc-titulo">
                  {m.emoji ?? '🎯'} {m.nome}
                </span>
                <strong>{$(m.valor_centavos, { compacto: true })}</strong>
              </div>
              <div className="progresso" aria-hidden="true">
                <span style={{ width: `${pct * 100}%` }} />
              </div>
              <span className="texto-2">
                {pct >= 1
                  ? 'Meta alcançada! 🎉'
                  : `${Math.round(pct * 100)}% · ${meses === null ? 'no ritmo atual não chega' : `no ritmo atual, chega aos ${idadeTexto(idadeHojeMeses + meses)}`}`}
                {pct < 1 && precisa !== null && m.idade_anos && ` · para os ${m.idade_anos} anos: ${oculto ? '•••' : reais(precisa)}/mês`}
              </span>
            </button>
          );
        })}
      </section>

      {/* Evolução */}
      {evolucao.length >= 2 && (
        <section className="cartao pilha-p" aria-label="Evolução">
          <h2>Evolução</h2>
          <GraficoLinhas
            rotulo="Evolução do saldo e do que foi colocado"
            series={[
              { id: 'colocado', nome: 'Colocado', cor: 'var(--c-aportado)', valores: evolucao.map((e) => e.aportado), area: true },
              { id: 'saldo', nome: 'Saldo', cor: 'var(--c-rendimento)', valores: evolucao.map((e) => e.saldo) },
            ]}
            rotulosX={evolucao.map((e) => nomeMes(e.mes))}
            ticksX={[{ i: 0, texto: nomeMes(evolucao[0].mes) }, { i: evolucao.length - 1, texto: nomeMes(evolucao[evolucao.length - 1].mes) }]}
            formatar={(v) => $(v)}
            formatarEixo={$eixo}
            legendaValor
          />
          <p className="mudo">A distância entre as linhas é o rendimento. Atualize o saldo pelo extrato de vez em quando para ela aparecer.</p>
        </section>
      )}

      {/* Rendimento: cada vez que anotaram o saldo */}
      {movs.some((m) => m.tipo === 'saldo') && (
        <section className="cartao pilha-p" aria-label="Rendimento">
          <div className="cartao-cab">
            <h2>Quanto rendeu</h2>
            <button type="button" className="icone-botao" aria-label="Atualizar saldo" onClick={() => setAberta({ modo: 'atualizar' })}>
              <Icone nome="girar" />
            </button>
          </div>
          <p className="mudo">Cada vez que vocês anotam o saldo do banco, o app separa o que foi depositado do que rendeu.</p>
          <ListaAtualizacoes contas={contas} movs={movs} oculto={oculto} limite={verTodos ? undefined : 6} />
        </section>
      )}

      {/* Depósitos por mês */}
      {r.depositos > 0 && (
        <section className="cartao pilha-p" aria-label="Depósitos por mês">
          <h2>Depósitos por mês</h2>
          <BarrasDiarias
            tipo="agenda"
            rotulo="Depósitos de cada um dos últimos 12 meses"
            dados={porMes.map((m) => ({ dia: `${m.mes}-01`, valor: m.centavos }))}
            formatarEixo={$eixo}
            rotulos={porMes.map((m, i) => (i % 2 === (porMes.length - 1) % 2 ? MESES[Number(m.mes.slice(5)) - 1] : ''))}
            nomes={porMes.map((m) => nomeMes(m.mes))}
            formatar={(v) => (oculto ? '•••' : reais(v, { compacto: true }))}
          />
        </section>
      )}

      {/* Quem contribuiu */}
      {quem.length > 0 && (
        <section className="cartao pilha-p" aria-label="Quem contribuiu">
          <h2>Quem contribuiu</h2>
          <BarrasHorizontais rotulo="Total depositado por pessoa" itens={quem.slice(0, 8).map((q) => ({ nome: q.de, valor: q.centavos, detalhe: `${q.vezes} ${q.vezes === 1 ? 'depósito' : 'depósitos'}` }))} formatar={(v) => $(v)} />
        </section>
      )}

      {/* Mural */}
      {recados.length > 0 && (
        <section className="cartao pilha-p" aria-label="Mural de recados">
          <h2>Mural de recados</h2>
          <p className="mudo">Para o {nomeBebe} ler quando crescer.</p>
          <div className="mural">
            {recados.slice(0, verTodos ? undefined : 6).map((m) => (
              <figure key={m.id} className="recado">
                <blockquote>“{m.recado}”</blockquote>
                <figcaption>
                  {m.ocasiao ? `${OCASIAO[m.ocasiao].emoji} ` : ''}
                  {m.de || 'Família'} · {dataBr(m.data)}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Contas */}
      <section className="cartao pilha-p">
        <div className="cartao-cab">
          <h2>Contas</h2>
          <button type="button" className="icone-botao" aria-label="Nova conta" onClick={novaConta}>
            <Icone nome="mais" />
          </button>
        </div>
        <div className="doc-lista">
          {contas.map((c) => {
            const s = r.porConta.get(c.id);
            return (
              <button key={c.id} type="button" className="doc-linha" onClick={() => setAberta({ modo: 'ver-conta', id: c.id })}>
                <span className="mov-icone conta" aria-hidden="true">
                  🏦
                </span>
                <span className="cresce">
                  <span className="doc-titulo">{c.nome}</span>
                  <span className="texto-2">{[NOME_TIPO_CONTA[c.tipo], c.instituicao, !c.ativa && 'encerrada'].filter(Boolean).join(' · ')}</span>
                </span>
                <strong>{$(s?.saldo ?? 0)}</strong>
              </button>
            );
          })}
        </div>
      </section>

      {/* Extrato */}
      <section className="cartao pilha-p">
        <h2>Lançamentos</h2>
        <ListaMovimentos movs={movs} contas={contas} aoAbrir={(m) => setAberta({ modo: 'movimento', mov: m, novo: false })} limite={verTodos ? undefined : 8} />
        {movs.length > 8 && (
          <button className="botao pequeno texto" onClick={() => setVerTodos(!verTodos)}>
            {verTodos ? 'Mostrar menos' : `Ver todos (${movs.length})`}
          </button>
        )}
        <div className="grade">
          <button className="botao" disabled={!!preparando || !movs.length} onClick={() => void extratoPdf()}>
            <Icone nome="documento" /> {preparando ?? 'Extrato PDF'}
          </button>
          <button className="botao" disabled={!movs.length} onClick={planilha}>
            <Icone nome="baixar" /> Planilha
          </button>
        </div>
      </section>

      <Dicas />

      {aberta?.modo === 'conta' && <FolhaConta inicial={aberta.conta} novo={aberta.novo} aoFechar={() => setAberta(null)} />}
      {aberta?.modo === 'ver-conta' && contaAberta && (
        <FolhaContaVer conta={contaAberta} aoFechar={() => setAberta(null)} aoEditar={() => setAberta({ modo: 'conta', conta: contaAberta, novo: false })} aoLancamento={(m) => setAberta({ modo: 'movimento', mov: m, novo: false })} />
      )}
      {aberta?.modo === 'movimento' && (
        <FolhaMovimento inicial={aberta.mov} novo={aberta.novo} contas={aberta.novo ? contasAtivas : contas} aoFechar={() => setAberta(null)} />
      )}
      {aberta?.modo === 'plano' && <FolhaPlano inicial={plano} aoFechar={() => setAberta(null)} />}
      {aberta?.modo === 'meta' && <FolhaMeta inicial={aberta.meta} novo={aberta.novo} aoFechar={() => setAberta(null)} />}
      {aberta?.modo === 'pix' && <FolhaPix contas={contasAtivas} aoFechar={() => setAberta(null)} />}
      {aberta?.modo === 'atualizar' && <FolhaAtualizarSaldo contas={contasAtivas} movs={movs} aoFechar={() => setAberta(null)} />}
    </div>
  );
}

function Dicas() {
  return (
    <details className="cartao ajuda">
      <summary>Onde guardar o dinheiro do Heitor?</summary>
      <div className="pilha-p" style={{ marginTop: 10 }}>
        <p className="texto-2">
          <strong>Conta em nome dele:</strong> com o CPF do bebê dá para abrir poupança e investir no nome dele; os pais cuidam até os 18 anos.
        </p>
        <p className="texto-2">
          <strong>Poupança:</strong> simples e sem imposto de renda, mas costuma render pouco acima da inflação no longo prazo.
        </p>
        <p className="texto-2">
          <strong>Tesouro Educa+:</strong> título do Tesouro Direto pensado para a educação. Rende inflação (IPCA) + uma taxa e devolve o dinheiro em 60 parcelas mensais a partir do ano escolhido.
        </p>
        <p className="texto-2">
          <strong>Tesouro Selic ou CDB com liquidez diária:</strong> bons para a parte que pode precisar ser usada antes.
        </p>
        <p className="texto-2">
          <strong>Previdência em nome da criança:</strong> pensada para prazos longos; compare as taxas antes.
        </p>
        <p className="mudo">Não é recomendação de investimento: converse com o gerente do banco ou um planejador financeiro.</p>
      </div>
    </details>
  );
}
