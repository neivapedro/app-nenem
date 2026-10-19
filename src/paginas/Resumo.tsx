import { useMemo, useState } from 'react';
import { calendarioDoBebe } from '../../supabase/functions/_shared/vacinas.ts';
import { BarrasDiarias } from '../componentes/barras';
import { Icone } from '../componentes/ui';
import { useAgora, useDados } from '../dados/contexto';
import { escoreZ, textoPercentil, type Indicador } from '../lib/crescimento';
import { chaveDia, dataBr, diasEntre, horaCurta, idadeBebe, inicioDoDia, nomeDia, somarDiasLocal, textoDuracao } from '../lib/datas';
import { traduzirErro } from '../lib/erros';
import { duracaoMediaMamada, intervaloMedioAlimentacao, media, ultimosDias } from '../lib/padroes';
import { descrever, NOMES_TIPO } from '../lib/registros';
import type { ModeloRelatorio } from '../lib/relatorio';

const PERIODOS = [7, 14, 30] as const;

const horas = (ms: number) => `${(ms / 3_600_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;

export function Resumo() {
  const dados = useDados();
  const { registros, hoje, bebe, medidas, vacinas, carregadoDesde } = dados;
  const agora = useAgora(60_000);
  const [n, setN] = useState<(typeof PERIODOS)[number]>(7);
  const [gerando, setGerando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);

  const dias = useMemo(() => ultimosDias(registros, hoje, n, agora), [registros, hoje, n, agora]);
  const desde = inicioDoDia(dias[0].dia);
  // Médias sem contar hoje (dia incompleto), quando há mais de um dia
  const completos = dias.length > 1 ? dias.slice(0, -1) : dias;
  const intervalo = intervaloMedioAlimentacao(registros, desde, agora);
  const duracaoMamada = duracaoMediaMamada(registros, desde, agora, agora);
  const temMamadeira = dias.some((d) => d.ml > 0);
  const incompleto = carregadoDesde > dias[0].dia;

  async function gerarPdf() {
    setGerando(true);
    setMsg(null);
    try {
      const mod = await import('../lib/relatorio');
      const nascDia = bebe?.nascimento ? chaveDia(bebe.nascimento) : null;
      const noPeriodo = registros.filter((r) => new Date(r.inicio) >= desde).sort((a, b) => a.inicio.localeCompare(b.inicio));
      const percentil = (ind: Indicador, data: string, valor: number | null) => {
        if (valor === null || !nascDia || !bebe?.sexo) return '';
        const z = escoreZ(ind, bebe.sexo, diasEntre(nascDia, data), ind === 'peso' ? valor / 1000 : valor);
        return z === null ? '' : ` (${textoPercentil(z)})`;
      };
      const linhasMedidas = [
        ...(nascDia && bebe && (bebe.peso_nascer_g || bebe.altura_nascer_cm || bebe.pc_nascer_cm) && !medidas.some((m) => m.data === nascDia)
          ? [{ data: nascDia, peso_g: bebe.peso_nascer_g, comprimento_cm: bebe.altura_nascer_cm, pc_cm: bebe.pc_nascer_cm }]
          : []),
        ...medidas,
      ].sort((a, b) => a.data.localeCompare(b.data));
      const cal = bebe && (nascDia ?? bebe.data_prevista) ? calendarioDoBebe(nascDia ?? bebe.data_prevista!, bebe.calendario_vacinal, vacinas, hoje) : [];
      const modelo: ModeloRelatorio = {
        titulo: `Relatório – ${bebe?.nome || 'bebê'}`,
        subtitulo: bebe?.nascimento ? `${idadeBebe(bebe.nascimento, agora)} · nasceu em ${dataBr(chaveDia(bebe.nascimento))} às ${horaCurta(bebe.nascimento)}` : 'Ainda não nasceu',
        periodo: `Período: ${dataBr(dias[0].dia)} a ${dataBr(hoje)} (${n} dias)`,
        destaques: [
          ['Alimentações por dia (média)', media(completos.map((d) => d.alimentacoes)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })],
          ['Intervalo médio entre alimentações', intervalo ? textoDuracao(intervalo) : '—'],
          ['Duração média da mamada no peito', duracaoMamada ? textoDuracao(duracaoMamada) : '—'],
          ['Mamadeira por dia (média)', temMamadeira ? `${Math.round(media(completos.map((d) => d.ml)))} ml` : '—'],
          ['Fraldas por dia (média)', media(completos.map((d) => d.fraldas)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })],
          ['Sono por dia (média)', horas(media(completos.map((d) => d.sonoMs)))],
        ],
        dias: [...dias].reverse().map((d) => [
          nomeDia(d.dia, hoje),
          d.alimentacoes,
          d.peitoMs ? textoDuracao(d.peitoMs) : '',
          d.ml ? `${d.ml} ml` : '',
          d.fraldas,
          d.xixi,
          d.coco,
          d.sonoMs ? horas(d.sonoMs) : '',
        ]),
        medidas: linhasMedidas.map((m) => [
          dataBr(m.data),
          nascDia ? `${diasEntre(nascDia, m.data)} dias` : '',
          m.peso_g ? `${(m.peso_g / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg${percentil('peso', m.data, m.peso_g)}` : '',
          m.comprimento_cm ? `${String(m.comprimento_cm).replace('.', ',')} cm${percentil('comprimento', m.data, m.comprimento_cm)}` : '',
          m.pc_cm ? `${String(m.pc_cm).replace('.', ',')} cm${percentil('pc', m.data, m.pc_cm)}` : '',
        ]),
        vacinasAplicadas: vacinas
          .filter((v) => v.status === 'aplicada' && v.data)
          .sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''))
          .map((v) => {
            const d = cal.find((c) => c.dose.id === v.dose_id)?.dose;
            return [dataBr(v.data!), d?.vacina ?? v.nome ?? '', d?.dose ?? '', [v.rede === 'particular' ? 'Particular' : 'SUS', v.local, v.lote ? `lote ${v.lote}` : ''].filter(Boolean).join(' · ')];
          }),
        vacinasPendentes: cal
          .filter((c) => c.situacao === 'atrasada' || c.situacao === 'agora' || c.situacao === 'proxima')
          .map((c) => [dataBr(c.prevista), c.dose.vacina, c.dose.dose, c.situacao === 'atrasada' ? 'Atrasada' : c.situacao === 'agora' ? 'Já pode tomar' : 'Próxima']),
        remedios: noPeriodo.filter((r) => r.tipo === 'remedio').map((r) => [`${dataBr(chaveDia(r.inicio))} ${horaCurta(r.inicio)}`, r.tipo === 'remedio' ? r.dados.nome : '', r.tipo === 'remedio' ? r.dados.dose ?? '' : '']),
        temperaturas: noPeriodo
          .filter((r) => r.tipo === 'temperatura')
          .map((r) => [`${dataBr(chaveDia(r.inicio))} ${horaCurta(r.inicio)}`, r.tipo === 'temperatura' ? `${r.dados.graus.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} °C` : '', r.observacao ?? '']),
        observacoes: noPeriodo
          .filter((r) => r.observacao && r.tipo !== 'temperatura')
          .map((r) => [`${dataBr(chaveDia(r.inicio))} ${horaCurta(r.inicio)}`, `${NOMES_TIPO[r.tipo]} · ${descrever(r, agora).titulo.split(' · ').slice(1).join(' · ')}`, r.observacao ?? '']),
        geradoEm: new Date().toLocaleString('pt-BR'),
      };
      const blob = mod.gerarRelatorioPdf(modelo);
      const arquivo = new File([blob], `relatorio-${(bebe?.nome || 'bebe').toLowerCase().replace(/\s+/g, '-')}-${hoje}.pdf`, { type: 'application/pdf' });
      setPdf(arquivo);
      await compartilhar(arquivo);
    } catch (e) {
      setMsg(`Não foi possível gerar o PDF: ${traduzirErro(e)}`);
    } finally {
      setGerando(false);
    }
  }

  async function compartilhar(arquivo: File) {
    if (navigator.canShare?.({ files: [arquivo] })) {
      try {
        await navigator.share({ files: [arquivo], title: 'Relatório para o pediatra' });
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
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }

  return (
    <div className="pilha">
      <div className="abas" role="tablist" aria-label="Período">
        {PERIODOS.map((p) => (
          <button key={p} role="tab" aria-selected={n === p} className={n === p ? 'ativo' : ''} onClick={() => setN(p)}>
            {p} dias
          </button>
        ))}
      </div>
      {incompleto && <p className="mudo">O app carregou registros a partir de {dataBr(carregadoDesde)}; dias anteriores aparecem vazios.</p>}

      <section className="cartao" aria-label="Médias">
        <h2>Médias por dia</h2>
        <div className="grade">
          <div className="bloco">
            <div className="rotulo">Alimentações</div>
            <div className="valor">{media(completos.map((d) => d.alimentacoes)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</div>
          </div>
          <div className="bloco">
            <div className="rotulo">Intervalo entre elas</div>
            <div className="valor">{intervalo ? textoDuracao(intervalo) : '—'}</div>
          </div>
          <div className="bloco">
            <div className="rotulo">Fraldas</div>
            <div className="valor">{media(completos.map((d) => d.fraldas)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</div>
          </div>
          <div className="bloco">
            <div className="rotulo">Sono</div>
            <div className="valor">{horas(media(completos.map((d) => d.sonoMs)))}</div>
          </div>
        </div>
        <p className="mudo" style={{ marginTop: 8 }}>
          Sem contar hoje (o dia ainda não acabou). Servem para acompanhar o ritmo do bebê, não para comparar com outros.
        </p>
      </section>

      <section className="cartao" aria-label="Alimentações por dia">
        <h2>Alimentações por dia</h2>
        <BarrasDiarias tipo="mamada" rotulo="Alimentações por dia" dados={dias.map((d) => ({ dia: d.dia, valor: d.alimentacoes }))} formatar={(v) => String(v)} />
      </section>
      {temMamadeira && (
        <section className="cartao" aria-label="Mamadeira por dia">
          <h2>Mamadeira por dia (ml)</h2>
          <BarrasDiarias tipo="mamadeira" rotulo="Mamadeira por dia em ml" dados={dias.map((d) => ({ dia: d.dia, valor: d.ml }))} formatar={(v) => `${v}`} />
        </section>
      )}
      <section className="cartao" aria-label="Fraldas por dia">
        <h2>Fraldas por dia</h2>
        <BarrasDiarias tipo="fralda" rotulo="Fraldas por dia" dados={dias.map((d) => ({ dia: d.dia, valor: d.fraldas }))} formatar={(v) => String(v)} />
      </section>
      <section className="cartao" aria-label="Sono por dia">
        <h2>Sono por dia (horas)</h2>
        <BarrasDiarias
          tipo="sono"
          rotulo="Sono por dia em horas"
          dados={dias.map((d) => ({ dia: d.dia, valor: Math.round((d.sonoMs / 3_600_000) * 10) / 10 }))}
          formatar={(v) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
        />
      </section>

      <details className="ajuda cartao">
        <summary>Ver em tabela</summary>
        <table className="tabela-simples">
          <thead>
            <tr>
              <th>Dia</th>
              <th>Alim.</th>
              <th>ml</th>
              <th>Fraldas</th>
              <th>Sono</th>
            </tr>
          </thead>
          <tbody>
            {[...dias].reverse().map((d) => (
              <tr key={d.dia}>
                <td>{nomeDia(d.dia, hoje)}</td>
                <td>{d.alimentacoes}</td>
                <td>{d.ml || '—'}</td>
                <td>
                  {d.fraldas} <span className="mudo">({d.xixi}/{d.coco})</span>
                </td>
                <td>{d.sonoMs ? horas(d.sonoMs) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <section className="cartao pilha" aria-label="Relatório para o pediatra">
        <h2>Relatório para o pediatra</h2>
        <p className="texto-2">PDF com o resumo dos últimos {n} dias, crescimento com percentis, vacinas, remédios, temperaturas e observações. Dá para enviar pelo WhatsApp ou mostrar na consulta.</p>
        <button className="botao primario" disabled={gerando} onClick={() => void gerarPdf()}>
          <Icone nome="baixar" /> {gerando ? 'Gerando…' : `Gerar PDF (${n} dias)`}
        </button>
        {pdf && !gerando && (
          <button className="botao" onClick={() => void compartilhar(pdf)}>
            <Icone nome="compartilhar" /> Compartilhar de novo
          </button>
        )}
        {msg && <div className="alerta erro">{msg}</div>}
      </section>
      <p className="mudo" style={{ textAlign: 'center' }}>
        Período: {dataBr(dias[0].dia)} a {dataBr(somarDiasLocal(hoje, 0))}
      </p>
    </div>
  );
}
