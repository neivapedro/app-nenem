// Dados do comprovante de vacinação, a partir das doses marcadas em Saúde → Vacinas.
import { calendarioDoBebe, DOSES } from '../../supabase/functions/_shared/vacinas.ts';
import { chaveDia, dataBr } from './datas';
import type { CarteiraVacinacaoPdf } from './pdf-documentos';
import type { Bebe, Documento, VacinaRegistro } from './tipos';

const SITUACAO: Record<string, string> = { atrasada: 'Atrasada', agora: 'Já pode tomar', proxima: 'Próxima' };

export function modeloCarteiraVacinacao(bebe: Bebe, vacinas: VacinaRegistro[], documentos: Documento[], hoje: string, geradoEm: string): CarteiraVacinacaoPdf {
  const nasc = bebe.nascimento ? chaveDia(bebe.nascimento) : null;
  const porDose = new Map(DOSES.map((d) => [d.id, d]));
  const numero = (modelo: string) => documentos.find((d) => d.modelo_id === modelo && d.bebe_id === bebe.id)?.numero?.trim() || null;
  const identificacao: [string, string][] = [];
  const cpf = numero('cpf');
  const cns = numero('cns');
  if (cpf) identificacao.push(['CPF', cpf]);
  if (cns) identificacao.push(['Cartão do SUS', cns]);
  const aplicadas = vacinas
    .filter((v) => v.bebe_id === bebe.id && v.status === 'aplicada' && v.data)
    .sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''))
    .map((v): [string, string, string, string] => {
      const d = porDose.get(v.dose_id);
      return [dataBr(v.data!), d?.vacina ?? v.nome ?? v.dose_id.replace(/^extra:/, ''), d?.dose ?? '', [v.lote && `lote ${v.lote}`, v.rede === 'particular' ? 'Particular' : v.rede === 'sus' ? 'SUS' : '', v.local].filter(Boolean).join(' · ')];
    });
  const pendentes = nasc
    ? calendarioDoBebe(nasc, bebe.calendario_vacinal, vacinas.filter((v) => v.bebe_id === bebe.id), hoje)
        .filter((c) => c.situacao === 'atrasada' || c.situacao === 'agora' || c.situacao === 'proxima')
        .map((c): [string, string, string, string] => [dataBr(c.prevista), c.dose.vacina, c.dose.dose, SITUACAO[c.situacao]])
    : [];
  return {
    nome: bebe.nome?.trim() || 'Bebê',
    nascimento: nasc ? dataBr(nasc) : null,
    calendario: bebe.calendario_vacinal === 'sbp' ? 'SUS + particular (SBP)' : 'SUS (Programa Nacional de Imunizações)',
    identificacao,
    aplicadas,
    pendentes,
    geradoEm,
  };
}
