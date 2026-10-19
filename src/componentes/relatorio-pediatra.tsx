// Relatório em PDF para o pediatra, com o período escolhido: 7, 15 ou 30 dias,
// tudo desde o nascimento ou datas à escolha.
import { useState } from 'react';
import { calendarioDoBebe } from '../../supabase/functions/_shared/vacinas.ts';
import { useAgora, useDados } from '../dados/contexto';
import { useRegistrosDesde } from '../dados/historico';
import { escoreZ, textoPercentil, type Indicador } from '../lib/crescimento';
import { chaveDia, dataBr, diasEntre, horaCurta, idadeBebe, inicioDoDia, nomeDia, somarDiasLocal, textoDuracao } from '../lib/datas';
import { traduzirErro } from '../lib/erros';
import { diasDoPeriodo, duracaoMediaMamada, intervaloMedioAlimentacao, media, mediasPorMes } from '../lib/padroes';
import { descrever, NOMES_TIPO } from '../lib/registros';
import type { ModeloRelatorio } from '../lib/relatorio';
import { Campo, Escolhas, Icone } from './ui';

type Periodo = '7' | '15' | '30' | 'tudo' | 'datas';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const horas = (ms: number) => `${(ms / 3_600_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`;
const um = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
/** Até 2 meses, uma linha por dia; mais que isso, uma linha por mês */
const LIMITE_DIARIO = 62;

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

export function RelatorioPediatra() {
  const { hoje, bebe, medidas, vacinas, registros: carregados } = useDados();
  const agora = useAgora(60_000);
  const [periodo, setPeriodo] = useState<Periodo>('30');
  const [deEscolhido, setDe] = useState(() => somarDiasLocal(hoje, -29));
  const [ateEscolhido, setAte] = useState(hoje);
  const [gerando, setGerando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pdf, setPdf] = useState<File | null>(null);

  const nascDia = bebe?.nascimento ? chaveDia(bebe.nascimento) : null;
  // Sem nascimento: "tudo" começa no primeiro registro
  const primeiro = carregados.reduce<string | null>((p, r) => {
    const d = chaveDia(r.inicio);
    return !p || d < p ? d : p;
  }, null);
  const inicioDeTudo = nascDia ?? primeiro ?? somarDiasLocal(hoje, -29);
  const [de, ate] =
    periodo === 'tudo' ? [inicioDeTudo, hoje] : periodo === 'datas' ? [deEscolhido <= ateEscolhido ? deEscolhido : ateEscolhido, ateEscolhido >= deEscolhido ? ateEscolhido : deEscolhido] : [somarDiasLocal(hoje, -(Number(periodo) - 1)), hoje];
  const totalDias = diasEntre(de, ate) + 1;
  const { registros, erro } = useRegistrosDesde(de);

  async function gerarPdf() {
    if (!registros) return;
    setGerando(true);
    setMsg(null);
    try {
      const mod = await import('../lib/relatorio');
      const inicio = inicioDoDia(de);
      const fimDoPeriodo = new Date(Math.min(agora.getTime(), inicioDoDia(somarDiasLocal(ate, 1)).getTime()));
      const dias = diasDoPeriodo(registros, de, ate, agora);
      // Médias sem o dia de hoje (incompleto), quando há mais de um dia
      const completos = dias.length > 1 && ate === hoje ? dias.slice(0, -1) : dias;
      const noPeriodo = registros
        .filter((r) => {
          const d = chaveDia(r.inicio);
          return d >= de && d <= ate;
        })
        .sort((a, b) => a.inicio.localeCompare(b.inicio));
      const intervalo = intervaloMedioAlimentacao(registros, inicio, fimDoPeriodo);
      const duracaoMamada = duracaoMediaMamada(registros, inicio, fimDoPeriodo, agora);
      const temMamadeira = dias.some((d) => d.ml > 0);
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

      const resumo: ModeloRelatorio['resumo'] =
        dias.length <= LIMITE_DIARIO
          ? {
              titulo: 'Resumo por dia',
              cabecalho: ['Dia', 'Alimentações', 'No peito', 'Mamadeira', 'Fraldas', 'Xixi', 'Cocô', 'Sono'],
              linhas: [...dias]
                .reverse()
                .map((d) => [dias.length <= 14 ? nomeDia(d.dia, hoje) : dataBr(d.dia), d.alimentacoes, d.peitoMs ? textoDuracao(d.peitoMs) : '', d.ml ? `${d.ml} ml` : '', d.fraldas, d.xixi, d.coco, d.sonoMs ? horas(d.sonoMs) : '']),
            }
          : {
              titulo: 'Resumo por mês (média por dia)',
              cabecalho: ['Mês', 'Dias', 'Alimentações', 'No peito', 'Mamadeira', 'Fraldas', 'Xixi', 'Cocô', 'Sono'],
              linhas: mediasPorMes(completos)
                .reverse()
                .map((m) => [`${MESES[Number(m.mes.slice(5)) - 1]}/${m.mes.slice(0, 4)}`, m.dias, um(m.alimentacoes), m.peitoMs ? textoDuracao(m.peitoMs) : '', m.ml ? `${Math.round(m.ml)} ml` : '', um(m.fraldas), um(m.xixi), um(m.coco), m.sonoMs ? horas(m.sonoMs) : '']),
            };

      const modelo: ModeloRelatorio = {
        titulo: `Relatório – ${bebe?.nome || 'bebê'}`,
        subtitulo: bebe?.nascimento ? `${idadeBebe(bebe.nascimento, agora)} · nasceu em ${dataBr(chaveDia(bebe.nascimento))} às ${horaCurta(bebe.nascimento)}` : 'Ainda não nasceu',
        periodo: `Período: ${dataBr(de)} a ${dataBr(ate)} (${totalDias} ${totalDias === 1 ? 'dia' : 'dias'}${periodo === 'tudo' && nascDia ? ', desde o nascimento' : ''})`,
        destaques: [
          ['Alimentações por dia (média)', um(media(completos.map((d) => d.alimentacoes)))],
          ['Intervalo médio entre alimentações', intervalo ? textoDuracao(intervalo) : '—'],
          ['Duração média da mamada no peito', duracaoMamada ? textoDuracao(duracaoMamada) : '—'],
          ['Mamadeira por dia (média)', temMamadeira ? `${Math.round(media(completos.map((d) => d.ml)))} ml` : '—'],
          ['Fraldas por dia (média)', um(media(completos.map((d) => d.fraldas)))],
          ['Sono por dia (média)', horas(media(completos.map((d) => d.sonoMs)))],
        ],
        resumo,
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
        remedios: noPeriodo.filter((r) => r.tipo === 'remedio').map((r) => [`${dataBr(chaveDia(r.inicio))} ${horaCurta(r.inicio)}`, r.tipo === 'remedio' ? r.dados.nome : '', r.tipo === 'remedio' ? (r.dados.dose ?? '') : '']),
        temperaturas: noPeriodo
          .filter((r) => r.tipo === 'temperatura')
          .map((r) => [`${dataBr(chaveDia(r.inicio))} ${horaCurta(r.inicio)}`, r.tipo === 'temperatura' ? `${r.dados.graus.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} °C` : '', r.observacao ?? '']),
        observacoes: noPeriodo
          .filter((r) => r.observacao && r.tipo !== 'temperatura')
          .map((r) => [`${dataBr(chaveDia(r.inicio))} ${horaCurta(r.inicio)}`, `${NOMES_TIPO[r.tipo]} · ${descrever(r, agora).titulo.split(' · ').slice(1).join(' · ')}`, r.observacao ?? '']),
        geradoEm: new Date().toLocaleString('pt-BR'),
      };
      const blob = mod.gerarRelatorioPdf(modelo);
      const nome = (bebe?.nome || 'bebe').toLowerCase().replace(/\s+/g, '-');
      const arquivo = new File([blob], `relatorio-${nome}-${de}-a-${ate}.pdf`, { type: 'application/pdf' });
      setPdf(arquivo);
      await compartilhar(arquivo);
    } catch (e) {
      setMsg(`Não foi possível gerar o PDF: ${traduzirErro(e)}`);
    } finally {
      setGerando(false);
    }
  }

  const carregando = !registros && !erro;
  return (
    <section className="cartao pilha" aria-label="Relatório para o pediatra">
      <h2>Relatório para o pediatra</h2>
      <p className="texto-2">PDF com o resumo do período, crescimento com percentis, vacinas, remédios, temperaturas e observações. Dá para enviar pelo WhatsApp ou mostrar na consulta.</p>
      <Campo rotulo="Período" grupo>
        <Escolhas
          rotulo="Período do relatório"
          opcoes={[
            { valor: '7' as Periodo, rotulo: '7 dias' },
            { valor: '15' as Periodo, rotulo: '15 dias' },
            { valor: '30' as Periodo, rotulo: '30 dias' },
            { valor: 'tudo' as Periodo, rotulo: 'Tudo' },
            { valor: 'datas' as Periodo, rotulo: 'Datas' },
          ]}
          valor={periodo}
          aoMudar={(p) => {
            setPeriodo(p);
            setPdf(null);
          }}
        />
      </Campo>
      {periodo === 'datas' && (
        <div className="grade">
          <Campo rotulo="De">
            <input type="date" value={deEscolhido} min={nascDia ?? undefined} max={hoje} onChange={(e) => e.target.value && (setDe(e.target.value), setPdf(null))} />
          </Campo>
          <Campo rotulo="Até">
            <input type="date" value={ateEscolhido} min={nascDia ?? undefined} max={hoje} onChange={(e) => e.target.value && (setAte(e.target.value), setPdf(null))} />
          </Campo>
        </div>
      )}
      <p className="mudo" style={{ margin: 0 }}>
        {dataBr(de)} a {dataBr(ate)} · {totalDias} {totalDias === 1 ? 'dia' : 'dias'}
        {periodo === 'tudo' && nascDia ? ' (desde o nascimento)' : ''}
        {totalDias > LIMITE_DIARIO ? ' · resumo por mês' : ''}
      </p>
      <button className="botao primario" disabled={gerando || carregando} onClick={() => void gerarPdf()}>
        <Icone nome="baixar" /> {gerando ? 'Gerando…' : carregando ? 'Buscando os registros antigos…' : 'Gerar PDF'}
      </button>
      {pdf && !gerando && (
        <button className="botao" onClick={() => void compartilhar(pdf)}>
          <Icone nome="compartilhar" /> Compartilhar de novo
        </button>
      )}
      {erro && <div className="alerta erro">Não deu para buscar os registros mais antigos: {erro}</div>}
      {msg && <div className="alerta erro">{msg}</div>}
    </section>
  );
}
