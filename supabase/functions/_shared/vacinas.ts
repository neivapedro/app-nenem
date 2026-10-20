// Calendários de vacinação da criança (0 a 10 anos), usados pelo app, pelo
// calendário assinado e pelos avisos. Sem dependências externas.
//
// Fontes (out/2026):
// - PNI/Ministério da Saúde: Calendário Técnico Nacional de Vacinação da Criança 2026
//   gov.br/saude/pt-br/composicao/svsa/pni/calendario-tecnico/calendario-tecnico-nacional-de-vacinacao-crianca
//   (+ NT 64/2026: 2º reforço de VIP aos 4 anos; NT 77/2025: MenACWY aos 12 meses;
//    VPC20 no SUS desde jun/2026, em transição com a VPC10; nirsevimabe no SUS desde fev/2026, Portaria SCTIE/MS 14/2026)
// - SBP: Calendário de Vacinação, atualização 2026-2027 (Documento Científico nº 56, 28/07/2026)
//   sbp.com.br/calendario-de-vacinacao-da-sbp-atualizacao-2026-2027/
// Itens com `confirmar: true` não puderam ser conferidos no documento original: o app pede para confirmar com o pediatra.

import { somarDias, somarMeses } from './tempo.ts';

export type Calendario = 'pni' | 'sbp';
export type Rede = 'sus' | 'particular' | 'ambas';

export interface Dose {
  id: string;
  vacina: string;
  dose: string;
  idade_meses: number;
  idade_texto: string;
  rede: Rede;
  calendarios: Calendario[];
  observacao?: string;
  confirmar?: boolean;
  /** Dose que depende da anterior: no mínimo `dias` depois dela */
  apos?: { id: string; dias: number };
  /** No calendário da SBP, depende desta dose em vez de `apos` (ex.: reforço da pneumo depois da 3ª dose) */
  apos_sbp?: { id: string; dias: number };
}

export const FONTES_VACINAS = [
  { nome: 'Calendário Nacional de Vacinação da Criança 2026 (Ministério da Saúde)', url: 'https://www.gov.br/saude/pt-br/composicao/svsa/pni/calendario-tecnico/calendario-tecnico-nacional-de-vacinacao-crianca' },
  { nome: 'Calendário de Vacinação da SBP, atualização 2026-2027', url: 'https://www.sbp.com.br/calendario-de-vacinacao-da-sbp-atualizacao-2026-2027/' },
];

const PNI_SBP: Calendario[] = ['pni', 'sbp'];

export const DOSES: Dose[] = [
  // Ao nascer
  { id: 'bcg', vacina: 'BCG', dose: 'Dose única', idade_meses: 0, idade_texto: 'Ao nascer', rede: 'ambas', calendarios: PNI_SBP, observacao: 'Na maternidade ou o quanto antes.' },
  { id: 'hepb-nascer', vacina: 'Hepatite B', dose: 'Dose ao nascer', idade_meses: 0, idade_texto: 'Primeiras 12 a 24 horas', rede: 'ambas', calendarios: PNI_SBP, observacao: 'Na maternidade. As doses seguintes vêm na penta (SUS) ou na hexa (particular) aos 2, 4 e 6 meses.' },
  { id: 'vsr-nirsevimabe', vacina: 'Nirsevimabe (anticorpo contra o VSR)', dose: 'Dose única', idade_meses: 0, idade_texto: 'Ao nascer ou antes da temporada do VSR', rede: 'particular', calendarios: ['sbp'], confirmar: true, observacao: 'Não é vacina: é anticorpo contra o vírus da bronquiolite (VSR), de preferência ainda na maternidade. No SUS (desde fevereiro de 2026), para prematuros (menos de 37 semanas) e crianças até 2 anos com algumas doenças. Se a mãe tomou a vacina do VSR na gestação pelo menos 14 dias antes do parto, em geral o bebê não precisa: confirme com o pediatra.' },
  // 2 meses
  { id: 'penta-1', vacina: 'Pentavalente (SUS) / Hexavalente (particular)', dose: '1ª dose', idade_meses: 2, idade_texto: '2 meses', rede: 'ambas', calendarios: PNI_SBP, observacao: 'Difteria, tétano, coqueluche, Hib e hepatite B. A hexa acelular inclui também a pólio inativada.' },
  { id: 'vip-1', vacina: 'Poliomielite inativada (VIP)', dose: '1ª dose', idade_meses: 2, idade_texto: '2 meses', rede: 'ambas', calendarios: PNI_SBP, observacao: 'Injetável. No particular pode vir dentro da hexa.' },
  { id: 'rota-1', vacina: 'Rotavírus', dose: '1ª dose', idade_meses: 2, idade_texto: '2 meses', rede: 'ambas', calendarios: PNI_SBP, observacao: 'Gotinha. No SUS, a 1ª dose só pode ser dada de 1 mês e 15 dias até 11 meses e 29 dias.' },
  { id: 'pneumo-1', vacina: 'Pneumocócica conjugada', dose: '1ª dose', idade_meses: 2, idade_texto: '2 meses', rede: 'ambas', calendarios: PNI_SBP, observacao: 'SUS: VPC20 (desde junho de 2026). Particular: VPC20 ou VPC15.' },
  // 3 meses
  { id: 'meningo-1', vacina: 'Meningocócica conjugada (C no SUS / ACWY no particular)', dose: '1ª dose', idade_meses: 3, idade_texto: '3 meses', rede: 'ambas', calendarios: PNI_SBP },
  { id: 'menb-1', vacina: 'Meningocócica B', dose: '1ª dose', idade_meses: 3, idade_texto: '3 meses', rede: 'particular', calendarios: ['sbp'] },
  // 4 meses
  { id: 'penta-2', vacina: 'Pentavalente (SUS) / Hexavalente (particular)', dose: '2ª dose', idade_meses: 4, idade_texto: '4 meses', rede: 'ambas', calendarios: PNI_SBP },
  { id: 'vip-2', vacina: 'Poliomielite inativada (VIP)', dose: '2ª dose', idade_meses: 4, idade_texto: '4 meses', rede: 'ambas', calendarios: PNI_SBP },
  { id: 'rota-2', vacina: 'Rotavírus', dose: '2ª dose', idade_meses: 4, idade_texto: '4 meses', rede: 'ambas', calendarios: PNI_SBP, apos: { id: 'rota-1', dias: 30 }, observacao: 'No SUS, até 23 meses e 29 dias. Com a vacina monovalente (SUS), o esquema termina aqui.' },
  { id: 'pneumo-2', vacina: 'Pneumocócica conjugada', dose: '2ª dose', idade_meses: 4, idade_texto: '4 meses', rede: 'ambas', calendarios: PNI_SBP, observacao: 'No SUS, enquanto durar o estoque antigo, esta dose ainda pode ser a VPC10. Depois, tudo com a VPC20.' },
  // 5 meses
  { id: 'meningo-2', vacina: 'Meningocócica conjugada (C no SUS / ACWY no particular)', dose: '2ª dose', idade_meses: 5, idade_texto: '5 meses', rede: 'ambas', calendarios: PNI_SBP },
  { id: 'menb-2', vacina: 'Meningocócica B', dose: '2ª dose', idade_meses: 5, idade_texto: '5 meses', rede: 'particular', calendarios: ['sbp'], apos: { id: 'menb-1', dias: 60 } },
  // 6 meses
  { id: 'penta-3', vacina: 'Pentavalente (SUS) / Hexavalente (particular)', dose: '3ª dose', idade_meses: 6, idade_texto: '6 meses', rede: 'ambas', calendarios: PNI_SBP },
  { id: 'vip-3', vacina: 'Poliomielite inativada (VIP)', dose: '3ª dose', idade_meses: 6, idade_texto: '6 meses', rede: 'ambas', calendarios: PNI_SBP },
  { id: 'rota-3', vacina: 'Rotavírus pentavalente', dose: '3ª dose', idade_meses: 6, idade_texto: '6 meses', rede: 'particular', calendarios: ['sbp'], observacao: 'Só para quem usa a vacina pentavalente (particular).' },
  { id: 'pneumo-3', vacina: 'Pneumocócica conjugada', dose: '3ª dose', idade_meses: 6, idade_texto: '6 meses', rede: 'particular', calendarios: ['sbp'], observacao: 'Dose a mais do esquema da SBP; não existe no SUS.' },
  { id: 'gripe-1', vacina: 'Influenza (gripe)', dose: '1ª dose', idade_meses: 6, idade_texto: '6 meses', rede: 'ambas', calendarios: PNI_SBP, observacao: 'Repete todo ano, na campanha. No SUS, de 6 meses a menores de 6 anos.' },
  { id: 'covid-1', vacina: 'COVID-19', dose: '1ª dose', idade_meses: 6, idade_texto: '6 meses', rede: 'ambas', calendarios: PNI_SBP, observacao: 'No SUS, de 6 meses a menores de 5 anos. O número de doses depende da vacina (3 da Pfizer ou 2 da Moderna).' },
  // 7 meses
  { id: 'gripe-2', vacina: 'Influenza (gripe)', dose: '2ª dose (só no 1º ano)', idade_meses: 7, idade_texto: '30 dias após a 1ª', rede: 'ambas', calendarios: PNI_SBP, apos: { id: 'gripe-1', dias: 30 }, observacao: 'Só na primeira vez que toma a vacina. Nos anos seguintes, 1 dose por ano.' },
  { id: 'covid-2', vacina: 'COVID-19', dose: '2ª dose', idade_meses: 7, idade_texto: '7 meses', rede: 'ambas', calendarios: PNI_SBP, apos: { id: 'covid-1', dias: 28 } },
  // 9 meses
  { id: 'covid-3', vacina: 'COVID-19', dose: '3ª dose', idade_meses: 9, idade_texto: '9 meses', rede: 'ambas', calendarios: PNI_SBP, apos: { id: 'covid-2', dias: 56 }, observacao: 'Só com a vacina da Pfizer. Com a da Moderna, o esquema termina na 2ª dose.' },
  { id: 'fa-1', vacina: 'Febre amarela', dose: '1ª dose', idade_meses: 9, idade_texto: '9 meses', rede: 'ambas', calendarios: PNI_SBP },
  // 12 meses
  { id: 'pneumo-reforco', vacina: 'Pneumocócica conjugada', dose: 'Reforço', idade_meses: 12, idade_texto: '12 meses', rede: 'ambas', calendarios: PNI_SBP, apos: { id: 'pneumo-2', dias: 60 }, apos_sbp: { id: 'pneumo-3', dias: 60 }, observacao: 'No SUS, com a VPC20. Intervalo mínimo de 60 dias depois da última dose (a 2ª no SUS, a 3ª no esquema da SBP).' },
  { id: 'meningo-reforco', vacina: 'Meningocócica ACWY', dose: 'Reforço', idade_meses: 12, idade_texto: '12 meses', rede: 'ambas', calendarios: PNI_SBP, observacao: 'No SUS, substitui o reforço da meningo C desde julho de 2025.' },
  { id: 'menb-reforco', vacina: 'Meningocócica B', dose: 'Reforço', idade_meses: 12, idade_texto: '12 a 15 meses', rede: 'particular', calendarios: ['sbp'], confirmar: true, observacao: 'A SBP indica "no 2º ano de vida".' },
  { id: 'scr-1', vacina: 'Tríplice viral (sarampo, caxumba, rubéola)', dose: '1ª dose', idade_meses: 12, idade_texto: '12 meses', rede: 'ambas', calendarios: PNI_SBP },
  { id: 'varicela-12m', vacina: 'Varicela (catapora)', dose: '1ª dose', idade_meses: 12, idade_texto: '12 meses', rede: 'particular', calendarios: ['sbp'], observacao: 'A SBP antecipa para 12 meses (separada ou junto da tríplice, como tetraviral). No SUS, a 1ª dose é aos 15 meses.' },
  { id: 'hepa-sbp-1', vacina: 'Hepatite A', dose: '1ª dose', idade_meses: 12, idade_texto: '12 meses', rede: 'particular', calendarios: ['sbp'], confirmar: true, observacao: 'A SBP recomenda 2 doses. Quem toma a dose do SUS aos 15 meses pode completar com a 2ª no particular.' },
  // 15 meses
  { id: 'vip-reforco-1', vacina: 'Poliomielite inativada (VIP)', dose: '1º reforço', idade_meses: 15, idade_texto: '15 meses', rede: 'ambas', calendarios: PNI_SBP },
  { id: 'dtp-reforco-1', vacina: 'Tríplice bacteriana (DTP no SUS / DTPa no particular)', dose: '1º reforço', idade_meses: 15, idade_texto: '15 meses', rede: 'ambas', calendarios: PNI_SBP },
  { id: 'tetraviral', vacina: 'Tetraviral (tríplice viral + varicela)', dose: '2ª dose da tríplice viral + varicela', idade_meses: 15, idade_texto: '15 meses', rede: 'ambas', calendarios: PNI_SBP, observacao: '2ª dose da tríplice viral. Da varicela, no SUS é a 1ª dose; para quem seguiu a SBP (varicela aos 12 meses), é a 2ª.' },
  { id: 'hepa-sus', vacina: 'Hepatite A', dose: 'Dose única', idade_meses: 15, idade_texto: '15 meses', rede: 'sus', calendarios: ['pni'], observacao: 'No SUS, aceita até 4 anos, 11 meses e 29 dias.' },
  // 18 meses
  { id: 'hepa-sbp-2', vacina: 'Hepatite A', dose: '2ª dose', idade_meses: 18, idade_texto: '18 meses', rede: 'particular', calendarios: ['sbp'], confirmar: true, apos: { id: 'hepa-sbp-1', dias: 180 } },
  // 4 anos
  { id: 'vip-reforco-2', vacina: 'Poliomielite inativada (VIP)', dose: '2º reforço', idade_meses: 48, idade_texto: '4 anos', rede: 'ambas', calendarios: PNI_SBP, observacao: 'Voltou ao calendário do SUS em agosto de 2026.' },
  { id: 'dtp-reforco-2', vacina: 'Tríplice bacteriana (DTP no SUS / DTPa no particular)', dose: '2º reforço', idade_meses: 48, idade_texto: '4 anos', rede: 'ambas', calendarios: PNI_SBP, observacao: 'A SBP indica entre 4 e 6 anos.' },
  { id: 'fa-reforco', vacina: 'Febre amarela', dose: 'Reforço', idade_meses: 48, idade_texto: '4 anos', rede: 'ambas', calendarios: PNI_SBP },
  { id: 'varicela-4a', vacina: 'Varicela (catapora)', dose: '2ª dose', idade_meses: 48, idade_texto: '4 anos', rede: 'sus', calendarios: ['pni'] },
  { id: 'dengue-sbp-1', vacina: 'Dengue (Qdenga)', dose: '1ª dose', idade_meses: 48, idade_texto: 'A partir de 4 anos', rede: 'particular', calendarios: ['sbp'], confirmar: true, observacao: '2 doses com 3 meses de intervalo.' },
  { id: 'dengue-sbp-2', vacina: 'Dengue (Qdenga)', dose: '2ª dose', idade_meses: 51, idade_texto: '3 meses após a 1ª', rede: 'particular', calendarios: ['sbp'], apos: { id: 'dengue-sbp-1', dias: 90 } },
  // 5 anos
  { id: 'meningo-reforco-2', vacina: 'Meningocócica ACWY', dose: '2º reforço', idade_meses: 60, idade_texto: '5 a 6 anos', rede: 'particular', calendarios: ['sbp'], confirmar: true },
  // 9 anos
  { id: 'hpv-1', vacina: 'HPV', dose: '1ª dose (dose única no SUS)', idade_meses: 108, idade_texto: '9 anos', rede: 'ambas', calendarios: PNI_SBP, observacao: 'SUS: dose única de 9 a 14 anos. SBP: 2 doses, de preferência a HPV9 (particular).' },
  { id: 'hpv-2', vacina: 'HPV', dose: '2ª dose', idade_meses: 114, idade_texto: '6 meses após a 1ª', rede: 'particular', calendarios: ['sbp'], apos: { id: 'hpv-1', dias: 180 } },
  // 10 anos
  { id: 'dengue-sus-1', vacina: 'Dengue (Qdenga)', dose: '1ª dose', idade_meses: 120, idade_texto: '10 anos', rede: 'sus', calendarios: ['pni'], observacao: 'No SUS, de 10 a 14 anos, conforme a oferta local.' },
  { id: 'dengue-sus-2', vacina: 'Dengue (Qdenga)', dose: '2ª dose', idade_meses: 123, idade_texto: '3 meses após a 1ª', rede: 'sus', calendarios: ['pni'], apos: { id: 'dengue-sus-1', dias: 90 } },
];

export interface AplicacaoVacina {
  dose_id: string;
  status: 'aplicada' | 'pulada';
  data: string | null;
}

export type SituacaoDose = 'aplicada' | 'pulada' | 'atrasada' | 'agora' | 'proxima' | 'futura';

export interface DoseNoCalendario {
  dose: Dose;
  /** Data a partir da qual a dose é indicada */
  prevista: string;
  situacao: SituacaoDose;
  aplicacao: AplicacaoVacina | null;
}

/** Dias depois da data prevista em que a dose passa a contar como atrasada */
export const TOLERANCIA_DIAS = 15;
/** Janela da situação "próxima" (dias antes da data prevista) */
export const JANELA_PROXIMA_DIAS = 30;

export function dosesDoCalendario(cal: Calendario): Dose[] {
  return DOSES.filter((d) => d.calendarios.includes(cal));
}

/** Data prevista de cada dose (respeitando o intervalo mínimo da dose anterior, quando houver). */
export function calendarioDoBebe(nascimento: string, cal: Calendario, aplicacoes: AplicacaoVacina[], hoje: string): DoseNoCalendario[] {
  const porId = new Map(aplicacoes.map((a) => [a.dose_id, a]));
  const lista = dosesDoCalendario(cal);
  const previstas = new Map<string, string>();
  return lista.map((dose) => {
    let prevista = somarMeses(nascimento, dose.idade_meses);
    const apos = (cal === 'sbp' && dose.apos_sbp) || dose.apos;
    if (apos) {
      const anterior = porId.get(apos.id);
      const base = anterior?.status === 'aplicada' && anterior.data ? anterior.data : previstas.get(apos.id);
      if (base) {
        const minimo = somarDias(base, apos.dias);
        if (minimo > prevista) prevista = minimo;
      }
    }
    previstas.set(dose.id, prevista);
    const aplicacao = porId.get(dose.id) ?? null;
    let situacao: SituacaoDose;
    if (aplicacao?.status === 'aplicada') situacao = 'aplicada';
    else if (aplicacao?.status === 'pulada') situacao = 'pulada';
    else if (somarDias(prevista, TOLERANCIA_DIAS) < hoje) situacao = 'atrasada';
    else if (prevista <= hoje) situacao = 'agora';
    else if (somarDias(hoje, JANELA_PROXIMA_DIAS) >= prevista) situacao = 'proxima';
    else situacao = 'futura';
    return { dose, prevista, situacao, aplicacao };
  });
}

/** Agrupa as doses pela idade (para a lista do app) */
export function porIdade(lista: DoseNoCalendario[]): { idade_meses: number; idade_texto: string; itens: DoseNoCalendario[] }[] {
  const grupos = new Map<number, DoseNoCalendario[]>();
  for (const d of lista) grupos.set(d.dose.idade_meses, [...(grupos.get(d.dose.idade_meses) ?? []), d]);
  return [...grupos.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([m, itens]) => ({ idade_meses: m, idade_texto: textoIdade(m), itens }));
}

export function textoIdade(meses: number): string {
  if (meses === 0) return 'Ao nascer';
  if (meses < 24) return meses === 1 ? '1 mês' : `${meses} meses`;
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  return `${anos} anos${resto ? ` e ${resto} meses` : ''}`;
}
