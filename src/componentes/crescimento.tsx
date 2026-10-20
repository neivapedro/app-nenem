import { useMemo, useState } from 'react';
import { useDados } from '../dados/contexto';
import { diasPrematuridade, escoreZ, faixaPercentil, ganhoPorDia, idadeParaOms, NOMES_INDICADOR, textoPercentil, UNIDADE_INDICADOR, valorMedida, type Indicador } from '../lib/crescimento';
import { chaveDia, dataBr, diasEntre, hojeLocal } from '../lib/datas';
import type { Medida } from '../lib/tipos';
import { GraficoCrescimento, type PontoCrescimento } from './grafico-crescimento';
import { Campo, Folha, Icone } from './ui';

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

interface Linha {
  id: string;
  data: string;
  peso_g: number | null;
  comprimento_cm: number | null;
  pc_cm: number | null;
  medida: Medida | null;
}

export function SecaoCrescimento() {
  const { bebe, medidas } = useDados();
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
    return l.sort((a, b) => a.data.localeCompare(b.data));
  }, [medidas, nasc, bebe]);

  if (!bebe) return null;
  const sexo = bebe.sexo;
  // Prematuros (3 semanas ou mais antes da data prevista): compara com a OMS pela idade corrigida até 2 anos
  const prematuridade = nasc ? diasPrematuridade(nasc, bebe.data_prevista) : 0;
  const pontos: PontoCrescimento[] =
    nasc && sexo
      ? linhas
          .map((l): PontoCrescimento | null => {
            const valor = valorMedida(l, ind);
            const idade = idadeParaOms(diasEntre(nasc, l.data), prematuridade);
            if (valor === null || !idade) return null;
            const z = escoreZ(ind, sexo, idade.dia, valor);
            return z !== null ? { id: l.id, dia: idade.dia, data: dataBr(l.data), valor, percentil: textoPercentil(z), corrigida: idade.corrigida } : null;
          })
          .filter((p): p is PontoCrescimento => !!p)
      : [];
  const ultimo = pontos[pontos.length - 1] ?? null;
  const zUltimo = ultimo && sexo ? escoreZ(ind, sexo, ultimo.dia, ultimo.valor) : null;
  const comPeso = linhas.filter((l) => l.peso_g);
  const ganho = comPeso.length >= 2 ? ganhoPorDia(comPeso[comPeso.length - 2], comPeso[comPeso.length - 1]) : null;
  const casas = ind === 'peso' ? 2 : 1;

  return (
    <div className="pilha">
      <button className="botao primario" onClick={() => setAberta('nova')}>
        <Icone nome="mais" /> Nova medida
      </button>
      {!nasc && <div className="cartao mudo">As curvas aparecem depois que vocês registrarem o nascimento.</div>}
      {nasc && !sexo && <div className="alerta">As curvas da OMS são diferentes para meninos e meninas. Informe o sexo em Ajustes → bebê → Editar.</div>}
      {nasc && sexo && (
        <section className="cartao pilha" aria-label="Curva de crescimento">
          <div className="abas" role="tablist">
            {(['peso', 'comprimento', 'pc'] as Indicador[]).map((i) => (
              <button key={i} role="tab" aria-selected={ind === i} className={ind === i ? 'ativo' : ''} onClick={() => setInd(i)}>
                {i === 'pc' ? 'Cabeça' : i === 'comprimento' ? 'Compr.' : NOMES_INDICADOR[i]}
              </button>
            ))}
          </div>
          {ultimo && zUltimo !== null ? (
            <div className="grade">
              <div className="bloco">
                <div className="rotulo">Última ({ultimo.data.slice(0, 5)})</div>
                <div className="valor">
                  {fmt(ultimo.valor, casas)} <small>{UNIDADE_INDICADOR[ind]}</small>
                </div>
              </div>
              <div className="bloco">
                <div className="rotulo">Percentil OMS{ultimo.corrigida ? ' (idade corrigida)' : ''}</div>
                <div className="valor">{ultimo.percentil}</div>
              </div>
              {ind === 'peso' && ganho !== null && (
                <div className="bloco" style={{ gridColumn: '1 / -1' }}>
                  <div className="rotulo">Ganho desde a medida anterior</div>
                  <div className="valor">
                    {ganho >= 0 ? '+' : ''}
                    {Math.round(ganho)} <small>g por dia</small>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="mudo">Sem medidas de {NOMES_INDICADOR[ind].toLowerCase()} ainda.</p>
          )}
          {zUltimo !== null && faixaPercentil(zUltimo) !== 'normal' && (
            <div className="alerta">
              <Icone nome="alerta" />
              <span>A última medida ficou fora da faixa do P3 ao P97. Vale mostrar ao pediatra (conferir também se a medida foi digitada certo).</span>
            </div>
          )}
          {prematuridade > 0 && (
            <p className="mudo">
              Nasceu {Math.floor(prematuridade / 7)} semanas{prematuridade % 7 ? ` e ${prematuridade % 7} ${prematuridade % 7 === 1 ? 'dia' : 'dias'}` : ''} antes da data prevista: até os 2 anos, a comparação com a OMS usa a idade corrigida (descontando essas semanas). Medidas de antes da data prevista ficam fora das curvas.
            </p>
          )}
          <GraficoCrescimento indicador={ind} sexo={sexo} pontos={pontos} idadeCorrigida={prematuridade > 0} />
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
