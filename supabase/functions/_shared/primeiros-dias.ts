// Lista dos primeiros dias (triagens, consultas e documentos). Usada pelo app,
// pelo calendário assinado e pelos avisos. Sem dependências externas.

import { somarDias } from './tempo.ts';

export type GrupoTarefa = 'maternidade' | 'saude' | 'documentos';

export interface TarefaPadrao {
  id: string;
  grupo: GrupoTarefa;
  titulo: string;
  detalhe: string;
  /** Dias depois do nascimento em que vence (vazio = sem data) */
  prazo_dias?: number;
  /** Prazo é o começo da janela (ex.: pezinho do 3º ao 5º dia) */
  inicio_dias?: number;
}

export const NOMES_GRUPO: Record<GrupoTarefa, string> = {
  maternidade: 'Na maternidade',
  saude: 'Saúde nos primeiros dias',
  documentos: 'Documentos e direitos',
};

export const TAREFAS_PADRAO: TarefaPadrao[] = [
  { id: 'vacinas-nascer', grupo: 'maternidade', titulo: 'Vacinas BCG e hepatite B', detalhe: 'Dadas na maternidade. Marque também na aba Saúde → Vacinas.', prazo_dias: 1 },
  { id: 'orelhinha', grupo: 'maternidade', titulo: 'Teste da orelhinha', detalhe: 'De preferência nas primeiras 24 a 48 horas, na maternidade; no máximo até 1 mês. Se der "falha", refazer em até 30 dias.', prazo_dias: 30 },
  { id: 'olhinho', grupo: 'maternidade', titulo: 'Teste do olhinho (reflexo vermelho)', detalhe: 'Antes da alta da maternidade; se não foi feito, ainda no 1º mês.', prazo_dias: 30 },
  { id: 'coracaozinho', grupo: 'maternidade', titulo: 'Teste do coraçãozinho (oximetria)', detalhe: 'Entre 24 e 48 horas de vida, antes da alta.', prazo_dias: 2 },
  { id: 'linguinha', grupo: 'maternidade', titulo: 'Teste da linguinha', detalhe: 'Na maternidade, de preferência nas primeiras 48 horas.', prazo_dias: 2 },
  { id: 'pezinho', grupo: 'saude', titulo: 'Teste do pezinho', detalhe: 'Entre o 3º e o 5º dia de vida (antes de 48 horas o resultado é menos confiável). Feito na UBS ou na maternidade. O SUS está ampliando o teste em etapas e o número de doenças varia por estado; o teste ampliado também existe na rede particular: pergunte ao pediatra.', inicio_dias: 3, prazo_dias: 5 },
  { id: 'consulta-1-semana', grupo: 'saude', titulo: 'Consulta da 1ª semana', detalhe: 'Com o pediatra ou na UBS, de preferência até o 5º dia (Primeira Semana Saúde Integral). Leve a Caderneta da Criança.', prazo_dias: 7 },
  { id: 'umbigo', grupo: 'saude', titulo: 'Queda do coto umbilical', detalhe: 'Costuma cair em 1 a 2 semanas. Vermelhidão em volta, secreção ou mau cheiro: procure o pediatra.', prazo_dias: 15 },
  { id: 'consulta-1-mes', grupo: 'saude', titulo: 'Consulta de 1 mês', detalhe: 'Peso, comprimento e perímetro cefálico entram na aba Saúde → Crescimento.', prazo_dias: 30 },
  { id: 'registro-civil', grupo: 'documentos', titulo: 'Certidão de nascimento', detalhe: 'No cartório (ou no posto do cartório na maternidade) com a DNV (Declaração de Nascido Vivo) e os documentos dos pais. Já sai com o CPF. Depois, guarde a foto na aba Documentos.', prazo_dias: 15 },
  { id: 'cartao-sus', grupo: 'documentos', titulo: 'Cartão do SUS e Caderneta digital', detalhe: 'Na UBS com a certidão. Depois, a Caderneta da Criança aparece no Meu SUS Digital. Guarde o número na aba Documentos.', prazo_dias: 30 },
  { id: 'plano-saude', grupo: 'documentos', titulo: 'Incluir no plano de saúde', detalhe: 'Pelas regras da ANS, a inclusão do recém-nascido até 30 dias do nascimento é feita sem carência. Confirme o prazo com o seu plano.', prazo_dias: 30 },
  { id: 'licenca-paternidade', grupo: 'documentos', titulo: 'Licença-paternidade', detalhe: 'Avise o RH com a certidão de nascimento. Nascimentos em 2026: 5 dias corridos (20 se a empresa participar do Programa Empresa Cidadã). A Lei 15.371/2026 aumenta para 10 dias a partir de 2027.', prazo_dias: 5 },
  { id: 'licenca-maternidade', grupo: 'documentos', titulo: 'Licença-maternidade', detalhe: 'Entregue a certidão ao RH ou ao INSS, conforme o vínculo.', prazo_dias: 15 },
];

export function prazoTarefa(t: TarefaPadrao, nascimento: string): string | null {
  return t.prazo_dias === undefined ? null : somarDias(nascimento, t.prazo_dias);
}

export function inicioTarefa(t: TarefaPadrao, nascimento: string): string | null {
  return t.inicio_dias === undefined ? null : somarDias(nascimento, t.inicio_dias);
}
