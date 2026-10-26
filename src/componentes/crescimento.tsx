import { useMemo, useState } from 'react';
import { useDados } from '../dados/contexto';
import { diasPrematuridade, escoreZ, faixaDetalhada, ganhoPorDia, idadeParaOms, NOMES_INDICADOR, percentilInteiro, posicaoNaRegua, REGUA_FAIXAS, textoPercentil, UNIDADE_INDICADOR, valorMedida, type FaixaDetalhada, type Indicador } from '../lib/crescimento';
import { chaveDia, dataBr, diasEntre, hojeLocal } from '../lib/datas';
import type { Medida } from '../lib/tipos';
import { GraficoCrescimento, type PontoCrescimento } from './grafico-crescimento';
import { Campo, Folha, Icone } from './ui';
import '../estilos/saude.css';

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));
const fmt = (v: number, casas: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

function FolhaMedida({ inicial, aoFechar }: { inicial: Medida | null; aoFechar: () => void }) {
  const { bebe, membro, usuario, gravar, mostrarAviso, nomeDe } = useDados();
  const [data, setData] = useState(inicial?.data ?? hojeLocal());
  const [peso, setPeso] = useState(inicial?.peso_g ? fmt(inicial.peso_g / 1000, 3) : '');
  const [comp, setComp] = useState(inicial?.comprimento_cm ? String(inicial.comprimento_cm).replace('.', ',') : '');
  const [pc, setPc] = useState(inicial?.pc_cm ? String(inicial.pc_cm).replace('.', ',') : '');
  const [obs, setObs] = useState(inicial?.observacao ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  if (!bebe || !membro) return null;
  const nasc = bebe.nascimento ? chaveDia(bebe.nascimento) : null;

  function salvar() {
    if (!bebe || !membro) return;
    const kg = num(peso);
    // Aceita peso digitado em gramas (ex.: 3450) ou em kg (3,45)
    const g = kg === null ? null : kg > 100 ? Math.round(kg) : Math.round(kg * 1000);
    const c = num(comp);
    const p = num(pc);
    if (g === null && c === null && p === null) return setMsg('Informe pelo menos uma medida.');
    if (g !== null && !(g >= 300 && g <= 40000)) return setMsg('Peso em kg (ex.: 4,250).');
    if (c !== null && !(c >= 20 && c <= 130)) return setMsg('Comprimento em cm (ex.: 54,5).');
    if (p !== null && !(p >= 18 && p <= 60)) return setMsg('Perímetro cefálico em cm (ex.: 37).');
    if (!data || data > hojeLocal() || (nasc && data < nasc)) return setMsg('Informe a data (não pode ser no futuro nem antes do nascimento).');
    const m: Medida = {
      id: inicial?.id ?? crypto.randomUUID(),
      familia_id: membro.familia_id,
      bebe_id: bebe.id,
      criado_por: inicial?.criado_por ?? usuario?.id ?? null,
      data,
      peso_g: g,
      comprimento_cm: c,
      pc_cm: p,
      observacao: obs.trim() || null,
    };
    gravar({ tipo: 'colecao', colecao: 'medidas', dado: m });
    mostrarAviso({
      texto: inicial ? 'Medida atualizada' : 'Medida salva',
      desfazer: () => gravar(inicial ? { tipo: 'colecao', colecao: 'medidas', dado: inicial } : { tipo: 'excluir', dado: { alvo: 'medidas', id: m.id } }),
    });
    aoFechar();
  }

  return (
    <Folha titulo={inicial ? 'Medida' : 'Nova medida'} aoFechar={aoFechar}>
      <form
        className="pilha"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <Campo rotulo="Data">
          <input type="date" value={data} min={nasc ?? undefined} max={hojeLocal()} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <div className="grade grade-3">
          <Campo rotulo="Peso (kg)">
            <input inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value.replace(/[^\d,.]/g, '').slice(0, 6))} placeholder="4,250" />
          </Campo>
          <Campo rotulo="Compr. (cm)">
            <input inputMode="decimal" value={comp} onChange={(e) => setComp(e.target.value.replace(/[^\d,.]/g, '').slice(0, 5))} placeholder="54,5" />
          </Campo>
          <Campo rotulo="Cabeça (cm)">
            <input inputMode="decimal" value={pc} onChange={(e) => setPc(e.target.value.replace(/[^\d,.]/g, '').slice(0, 4))} placeholder="37" />
          </Campo>
        </div>
        <p className="mudo">Pode deixar em branco o que não foi medido. "Cabeça" é o perímetro cefálico.</p>
        <Campo rotulo="Observação (opcional)">
          <textarea value={obs} maxLength={2000} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: consulta de 1 mês, balança da clínica" />
        </Campo>
        {msg && (
          <div className="alerta erro" role="alert">
            {msg}
          </div>
        )}
        <button className="botao primario">Salvar</button>
        {inicial && (
          <>
            {inicial.criado_por && <p className="mudo">Registrado por {nomeDe(inicial.criado_por)}</p>}
            <button
              type="button"
              className="botao perigo"
              onClick={() => {
                gravar({ tipo: 'excluir', dado: { alvo: 'medidas', id: inicial.id } });
                mostrarAviso({ texto: 'Medida excluída', desfazer: () => gravar({ tipo: 'colecao', colecao: 'medidas', dado: inicial }) });
                aoFechar();
              }}
            >
              <Icone nome="lixeira" /> Excluir
            </button>
          </>
        )}
      </form>
    </Folha>
  );
}

const DE_INDICADOR: Record<Indicador, string> = { peso: 'de peso', comprimento: 'de comprimento', pc: 'de perímetro da cabeça' };
const MENOR: Record<Indicador, string> = { peso: 'pesam menos', comprimento: 'são mais curtos', pc: 'têm a cabeça menor' };

function explicacao(f: FaixaDetalhada, p: number, ind: Indicador, nome: string): string {
  const curva = 'Bebês saudáveis ficam em qualquer ponto da faixa do P3 ao P97: o que mais importa é seguir crescendo na própria curva, consulta após consulta.';
  if (f === 'p15-p85') return `Está na faixa onde fica a maioria dos bebês. De cada 100 bebês da mesma idade, uns ${p} ${MENOR[ind]} que ${nome}.`;
  if (f === 'p3-p15') return `Um pouco abaixo da média, dentro da faixa esperada. ${curva}`;
  if (f === 'p85-p97') return `Um pouco acima da média, dentro da faixa esperada. ${curva}`;
  return `Ficou ${f === 'abaixo-p3' ? 'abaixo' : 'acima'} da faixa do P3 ao P97. Uma medida sozinha diz pouco (pode ser a balança ou um erro de digitação): vale conferir e mostrar ao pediatra na próxima consulta.`;
}

/** Destaque: "Heitor está no percentil 38 de peso", com a régua das faixas e um texto simples */
function DestaquePercentil({ z, zAnterior, dataAnterior, ind, nome, corrigida }: { z: number; zAnterior: number | null; dataAnterior: string | null; ind: Indicador; nome: string; corrigida: boolean }) {
  const f = faixaDetalhada(z);
  const p = percentilInteiro(z);
  const pos = posicaoNaRegua(z);
  const fora = f === 'abaixo-p3' || f === 'acima-p97';
  return (
    <div className={`sc-destaque sc-${f}`}>
      <div className="sc-topo">
        <span className="sv-num sc-numero" aria-hidden="true">
          {fora ? (f === 'abaixo-p3' ? '<3' : '>97') : p}
        </span>
        <p className="sc-frase">
          {nome} está {fora ? (f === 'abaixo-p3' ? 'abaixo do' : 'acima do') : 'no'} <strong>percentil {fora ? (f === 'abaixo-p3' ? 3 : 97) : p}</strong> {DE_INDICADOR[ind]}
          {corrigida && <span className="sc-sub">pela idade corrigida</span>}
        </p>
      </div>
      <div className="sc-regua" role="img" aria-label={`Faixas de percentil: abaixo do P3, P3 a P15, P15 a P85, P85 a P97 e acima do P97. ${nome} está em ${f === 'abaixo-p3' ? 'abaixo do P3' : f === 'acima-p97' ? 'acima do P97' : `P${p}`}.`}>
        <div className="sc-regua-faixas" aria-hidden="true">
          {REGUA_FAIXAS.map((r) => (
            <span key={r.id} className={`sc-faixa sc-f-${r.id} ${r.id === f ? 'atual' : ''}`} style={{ width: `${(r.ate - r.de) * 100}%` }} />
          ))}
        </div>
        <span className="sc-marcador" style={{ left: `${pos * 100}%` }} aria-hidden="true" />
        <div className="sc-regua-marcas" aria-hidden="true">
          {REGUA_FAIXAS.slice(1).map((r) => (
            <span key={r.id} style={{ left: `${r.de * 100}%` }}>
              P{r.pDe}
            </span>
          ))}
        </div>
      </div>
      <p className="texto-2">{explicacao(f, p, ind, nome)}</p>
      {(zAnterior !== null || fora) && (
        <div className="sc-notas">
          {fora && <span className="etiqueta aviso">Mostrar ao pediatra</span>}
          {zAnterior !== null && dataAnterior && (
            <span className="mudo">
              Na medida de {dataAnterior.slice(0, 5)}: {textoPercentil(zAnterior)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface Linha {
  id: string;
  data: string;
  peso_g: number | null;
  comprimento_cm: number | null;
  pc_cm: number | null;
  medida: Medida | null;
}

export function SecaoCrescimento() {
  const { bebe, medidas, hoje } = useDados();
  const [ind, setInd] = useState<Indicador>('peso');
  const [aberta, setAberta] = useState<Medida | null | 'nova'>(null);

  const nasc = bebe?.nascimento ? chaveDia(bebe.nascimento) : null;
  const linhas: Linha[] = useMemo(() => {
    // Medida no dia do nascimento: completa o que ficou em branco com os dados do nascimento do bebê
    const doNascer = (m: Medida) => nasc && bebe && m.data === nasc;
    const l: Linha[] = medidas.map((m) => ({
      id: m.id,
      data: m.data,
      peso_g: m.peso_g ?? (doNascer(m) ? bebe!.peso_nascer_g : null),
      comprimento_cm: m.comprimento_cm ?? (doNascer(m) ? bebe!.altura_nascer_cm : null),
      pc_cm: m.pc_cm ?? (doNascer(m) ? bebe!.pc_nascer_cm : null),
      medida: m,
    }));
    if (nasc && bebe && (bebe.peso_nascer_g || bebe.altura_nascer_cm || bebe.pc_nascer_cm) && !medidas.some((m) => m.data === nasc)) {
      l.push({ id: 'nascimento', data: nasc, peso_g: bebe.peso_nascer_g, comprimento_cm: bebe.altura_nascer_cm, pc_cm: bebe.pc_nascer_cm, medida: null });
    }
    // Mesmo dia: o nascimento vem antes das medidas; depois, a ordem em que foram anotadas
    return l.sort((a, b) => a.data.localeCompare(b.data) || (a.id === 'nascimento' ? -1 : b.id === 'nascimento' ? 1 : 0));
  }, [medidas, nasc, bebe]);
  // Medidas de antes do nascimento (ex.: a data de nascimento foi corrigida) ficam fora das contas
  const validas = nasc ? linhas.filter((l) => l.data >= nasc) : linhas;

  if (!bebe) return null;
  const sexo = bebe.sexo;
  // Prematuros (3 semanas ou mais antes da data prevista): compara com a OMS pela idade corrigida até 2 anos
  const prematuridade = nasc ? diasPrematuridade(nasc, bebe.data_prevista) : 0;
  const casas = ind === 'peso' ? 2 : 1;
  const pontos: PontoCrescimento[] = [];
  if (nasc && sexo) {
    let anterior: { data: string; valor: number } | null = null;
    for (const l of validas) {
      const valor = valorMedida(l, ind);
      if (valor === null) continue;
      // Ganho desde a medida anterior deste indicador (mesmo as de antes da data prevista contam)
      let ganho: string | null = null;
      if (anterior) {
        const dias = diasEntre(anterior.data, l.data);
        const dif = valor - anterior.valor;
        const sinal = dif >= 0 ? '+' : '−';
        if (ind === 'peso') {
          const g = Math.round(Math.abs(dif) * 1000);
          ganho = `${sinal}${g.toLocaleString('pt-BR')} g em ${dias} ${dias === 1 ? 'dia' : 'dias'}${dias > 0 ? ` (${sinal}${Math.round((Math.abs(dif) * 1000) / dias)} g/dia)` : ''}`;
        } else ganho = `${sinal}${fmt(Math.abs(dif), 1)} cm em ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
      }
      anterior = { data: l.data, valor };
      const idade = idadeParaOms(diasEntre(nasc, l.data), prematuridade);
      if (!idade) continue;
      const z = escoreZ(ind, sexo, idade.dia, valor);
      if (z !== null) pontos.push({ id: l.id, dia: idade.dia, data: dataBr(l.data), valor, percentil: textoPercentil(z), corrigida: idade.corrigida, ganho });
    }
  }
  const ultimo = pontos[pontos.length - 1] ?? null;
  // Para comparar, a última medida de OUTRO dia (duas no mesmo dia não dizem nada)
  const penultimo = (ultimo && pontos.slice(0, -1).reverse().find((p) => p.data !== ultimo.data)) ?? null;
  const zUltimo = ultimo && sexo ? escoreZ(ind, sexo, ultimo.dia, ultimo.valor) : null;
  const zPenultimo = penultimo && sexo ? escoreZ(ind, sexo, penultimo.dia, penultimo.valor) : null;
  const comPeso = validas.filter((l) => l.peso_g);
  const ultPeso = comPeso[comPeso.length - 1];
  const antPeso = ultPeso ? comPeso.slice(0, -1).reverse().find((l) => l.data !== ultPeso.data) : undefined;
  const ganho = ultPeso && antPeso ? ganhoPorDia(antPeso, ultPeso) : null;
  const idadeHoje = nasc ? idadeParaOms(diasEntre(nasc, hoje), prematuridade) : null;
  const nome = bebe.nome?.trim().split(/\s+/)[0] || 'O bebê';

  return (
    <div className="pilha">
      <button className="botao primario" onClick={() => setAberta('nova')}>
        <Icone nome="mais" /> Nova medida
      </button>
      {!nasc && <div className="cartao mudo">As curvas aparecem depois que vocês registrarem o nascimento.</div>}
      {nasc && !sexo && <div className="alerta">As curvas da OMS são diferentes para meninos e meninas. Informe o sexo em Ajustes → bebê → Editar.</div>}
      {nasc && sexo && (
        <section className="cartao pilha sc-cartao" aria-label="Curva de crescimento">
          <div className="abas" role="tablist">
            {(['peso', 'comprimento', 'pc'] as Indicador[]).map((i) => (
              <button key={i} role="tab" aria-selected={ind === i} className={ind === i ? 'ativo' : ''} onClick={() => setInd(i)}>
                {i === 'pc' ? 'Cabeça' : i === 'comprimento' ? 'Compr.' : NOMES_INDICADOR[i]}
              </button>
            ))}
          </div>
          {ultimo && zUltimo !== null ? (
            <>
              <DestaquePercentil z={zUltimo} zAnterior={zPenultimo} dataAnterior={penultimo?.data ?? null} ind={ind} nome={nome} corrigida={!!ultimo.corrigida} />
              <div className="grade">
                <div className="bloco">
                  <div className="rotulo">Última · {ultimo.data.slice(0, 5)}</div>
                  <div className="valor sv-num">
                    {fmt(ultimo.valor, casas)} <small>{UNIDADE_INDICADOR[ind]}</small>
                  </div>
                </div>
                {ind === 'peso' && ganho !== null ? (
                  <div className="bloco">
                    <div className="rotulo">Ganho desde a anterior</div>
                    <div className="valor sv-num">
                      {ganho >= 0 ? '+' : '−'}
                      {Math.abs(Math.round(ganho))} <small>g por dia</small>
                    </div>
                  </div>
                ) : (
                  <div className="bloco">
                    <div className="rotulo">Medidas</div>
                    <div className="valor sv-num">{pontos.length}</div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="mudo">Sem medidas de {NOMES_INDICADOR[ind].toLowerCase()} ainda.</p>
          )}
          {prematuridade > 0 && (
            <p className="mudo">
              Nasceu {Math.floor(prematuridade / 7)} semanas{prematuridade % 7 ? ` e ${prematuridade % 7} ${prematuridade % 7 === 1 ? 'dia' : 'dias'}` : ''} antes da data prevista: até os 2 anos, a comparação com a OMS usa a idade corrigida (descontando essas semanas). Medidas de antes da data prevista ficam fora das curvas.
            </p>
          )}
          <GraficoCrescimento indicador={ind} sexo={sexo} pontos={pontos} idadeCorrigida={prematuridade > 0} idadeAtualDias={idadeHoje?.dia ?? 0} nome={nome === 'O bebê' ? 'Bebê' : nome} />
        </section>
      )}
      {linhas.length > 0 && (
        <section className="cartao" aria-label="Medidas">
          <h2>Medidas</h2>
          <table className="tabela-simples">
            <thead>
              <tr>
                <th>Data</th>
                <th>Peso (kg)</th>
                <th>Compr.</th>
                <th>Cabeça</th>
              </tr>
            </thead>
            <tbody>
              {[...linhas].reverse().map((l) => (
                <tr key={l.id} className={l.medida ? 'clicavel' : ''} onClick={() => l.medida && setAberta(l.medida)}>
                  <td>
                    {dataBr(l.data)}
                    {!l.medida && <div className="mudo">nascimento</div>}
                  </td>
                  <td>{l.peso_g ? fmt(l.peso_g / 1000, 3) : '—'}</td>
                  <td>{l.comprimento_cm ? fmt(l.comprimento_cm, 1) : '—'}</td>
                  <td>{l.pc_cm ? fmt(l.pc_cm, 1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mudo" style={{ marginTop: 8 }}>
            Toque numa medida para editar. As do nascimento ficam em Ajustes → bebê.
          </p>
        </section>
      )}
      <p className="fonte">
        Curvas: Padrões de Crescimento Infantil da OMS (2006), os mesmos da Caderneta da Criança.{' '}
        <a href="https://www.who.int/tools/child-growth-standards" target="_blank" rel="noreferrer">
          Fonte
        </a>
      </p>
      {aberta && <FolhaMedida inicial={aberta === 'nova' ? null : aberta} aoFechar={() => setAberta(null)} />}
    </div>
  );
}
