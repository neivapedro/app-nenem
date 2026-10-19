// Conteúdo de referência (Ministério da Saúde e SBP), conferido em out/2026.
// Sempre mostrado no app como apoio: a palavra final é do pediatra.

export interface MarcoCaderneta {
  id: string;
  /** Fim da faixa etária em meses (a Caderneta agrupa por faixas) */
  idade_meses: number;
  faixa: string;
  descricao: string;
}

/**
 * Instrumento de vigilância do desenvolvimento da Caderneta da Criança (MS, 7ª ed., 2024).
 * Cada faixa tem 4 marcos esperados até o fim dela.
 */
export const MARCOS_CADERNETA: MarcoCaderneta[] = [
  { id: 'c01-postura', idade_meses: 1, faixa: 'Até 1 mês', descricao: 'Barriga para cima, pernas e braços dobrados, cabeça de lado' },
  { id: 'c01-rosto', idade_meses: 1, faixa: 'Até 1 mês', descricao: 'Observa um rosto' },
  { id: 'c01-som', idade_meses: 1, faixa: 'Até 1 mês', descricao: 'Reage ao som' },
  { id: 'c01-cabeca', idade_meses: 1, faixa: 'Até 1 mês', descricao: 'Eleva a cabeça' },
  { id: 'c02-sorriso', idade_meses: 2, faixa: '1 a 2 meses', descricao: 'Sorriso social quando estimulado' },
  { id: 'c02-maos', idade_meses: 2, faixa: '1 a 2 meses', descricao: 'Abre as mãos' },
  { id: 'c02-sons', idade_meses: 2, faixa: '1 a 2 meses', descricao: 'Emite sons' },
  { id: 'c02-membros', idade_meses: 2, faixa: '1 a 2 meses', descricao: 'Movimenta ativamente braços e pernas' },
  { id: 'c04-contato', idade_meses: 4, faixa: '2 a 4 meses', descricao: 'Responde ativamente ao contato social' },
  { id: 'c04-segura', idade_meses: 4, faixa: '2 a 4 meses', descricao: 'Segura objetos' },
  { id: 'c04-sons', idade_meses: 4, faixa: '2 a 4 meses', descricao: 'Emite sons' },
  { id: 'c04-brucos', idade_meses: 4, faixa: '2 a 4 meses', descricao: 'De bruços, levanta a cabeça apoiando-se nos antebraços' },
  { id: 'c06-busca', idade_meses: 6, faixa: '4 a 6 meses', descricao: 'Busca ativamente objetos' },
  { id: 'c06-boca', idade_meses: 6, faixa: '4 a 6 meses', descricao: 'Leva objetos à boca' },
  { id: 'c06-localiza', idade_meses: 6, faixa: '4 a 6 meses', descricao: 'Localiza o som' },
  { id: 'c06-rola', idade_meses: 6, faixa: '4 a 6 meses', descricao: 'Muda de posição ativamente (rola)' },
  { id: 'c09-esconde', idade_meses: 9, faixa: '6 a 9 meses', descricao: 'Brinca de esconde-achou' },
  { id: 'c09-transfere', idade_meses: 9, faixa: '6 a 9 meses', descricao: 'Passa objetos de uma mão para a outra' },
  { id: 'c09-silabas', idade_meses: 9, faixa: '6 a 9 meses', descricao: 'Duplica sílabas ("papa", "dada")' },
  { id: 'c09-senta', idade_meses: 9, faixa: '6 a 9 meses', descricao: 'Senta sem apoio' },
  { id: 'c12-imita', idade_meses: 12, faixa: '9 a 12 meses', descricao: 'Imita gestos' },
  { id: 'c12-pinca', idade_meses: 12, faixa: '9 a 12 meses', descricao: 'Faz pinça (pega com o polegar e o indicador)' },
  { id: 'c12-jargao', idade_meses: 12, faixa: '9 a 12 meses', descricao: 'Produz "jargão" (fala sem palavras, como se conversasse)' },
  { id: 'c12-anda-apoio', idade_meses: 12, faixa: '9 a 12 meses', descricao: 'Anda com apoio' },
  { id: 'c15-mostra', idade_meses: 15, faixa: '12 a 15 meses', descricao: 'Mostra o que quer' },
  { id: 'c15-blocos', idade_meses: 15, faixa: '12 a 15 meses', descricao: 'Coloca blocos na caneca' },
  { id: 'c15-palavra', idade_meses: 15, faixa: '12 a 15 meses', descricao: 'Fala uma palavra' },
  { id: 'c15-anda', idade_meses: 15, faixa: '12 a 15 meses', descricao: 'Anda sem apoio' },
  { id: 'c18-colher', idade_meses: 18, faixa: '15 a 18 meses', descricao: 'Usa colher ou garfo' },
  { id: 'c18-torre2', idade_meses: 18, faixa: '15 a 18 meses', descricao: 'Constrói torre de 2 cubos' },
  { id: 'c18-palavras', idade_meses: 18, faixa: '15 a 18 meses', descricao: 'Fala 3 palavras' },
  { id: 'c18-tras', idade_meses: 18, faixa: '15 a 18 meses', descricao: 'Anda para trás' },
  { id: 'c24-roupa', idade_meses: 24, faixa: '18 a 24 meses', descricao: 'Tira a roupa' },
  { id: 'c24-torre3', idade_meses: 24, faixa: '18 a 24 meses', descricao: 'Constrói torre de 3 cubos' },
  { id: 'c24-figuras', idade_meses: 24, faixa: '18 a 24 meses', descricao: 'Aponta 2 figuras' },
  { id: 'c24-chuta', idade_meses: 24, faixa: '18 a 24 meses', descricao: 'Chuta a bola' },
  { id: 'c30-veste', idade_meses: 30, faixa: '2 anos a 2 anos e meio', descricao: 'Veste-se com supervisão' },
  { id: 'c30-torre6', idade_meses: 30, faixa: '2 anos a 2 anos e meio', descricao: 'Constrói torre de 6 cubos' },
  { id: 'c30-frases', idade_meses: 30, faixa: '2 anos a 2 anos e meio', descricao: 'Forma frases com 2 palavras' },
  { id: 'c30-pula', idade_meses: 30, faixa: '2 anos a 2 anos e meio', descricao: 'Pula com os dois pés' },
  { id: 'c36-brinca', idade_meses: 36, faixa: '2 anos e meio a 3 anos', descricao: 'Brinca com outras crianças' },
  { id: 'c36-linha', idade_meses: 36, faixa: '2 anos e meio a 3 anos', descricao: 'Imita o desenho de uma linha' },
  { id: 'c36-acoes', idade_meses: 36, faixa: '2 anos e meio a 3 anos', descricao: 'Reconhece 2 ações' },
  { id: 'c36-arremessa', idade_meses: 36, faixa: '2 anos e meio a 3 anos', descricao: 'Arremessa a bola' },
];

export const ORIENTACAO_MARCOS =
  'Cada criança tem seu ritmo. Pela Caderneta da Criança, se algum marco da faixa de idade atual ainda não apareceu, a orientação é estimular e conversar com o pediatra na próxima consulta. Perda de algo que o bebê já fazia (como balbuciar) é motivo para procurar o pediatra.';

export const FONTE_MARCOS = {
  nome: 'Caderneta da Criança, 7ª edição (Ministério da Saúde, 2024)',
  url: 'https://bvsms.saude.gov.br/bvs/publicacoes/caderneta_crianca_menino_passaporte_cidadania_7ed.pdf',
};

// ---------- Febre (SBP, Documento Científico nº 206, 2025) ----------

/** A SBP passou a considerar febre a temperatura axilar a partir de 37,5 °C (termômetro digital). */
export const FEBRE_A_PARTIR = 37.5;
export const HIPOTERMIA_ABAIXO = 35.5;

export function avaliarTemperatura(graus: number, idadeDias: number | null): { nivel: 'normal' | 'febre' | 'urgente'; texto: string } {
  const pequeno = idadeDias !== null && idadeDias < 90;
  if (graus < HIPOTERMIA_ABAIXO) {
    return { nivel: 'urgente', texto: 'Temperatura baixa (abaixo de 35,5 °C). Agasalhe, meça de novo e, se continuar baixa, procure atendimento médico.' };
  }
  if (graus >= FEBRE_A_PARTIR) {
    if (pequeno) return { nivel: 'urgente', texto: 'Febre em bebê com menos de 3 meses: procure atendimento médico hoje (pediatra ou pronto-atendimento).' };
    return { nivel: 'febre', texto: 'Febre (a partir de 37,5 °C, pela SBP). Siga a orientação do pediatra e observe se o bebê mama, brinca e está ativo.' };
  }
  return { nivel: 'normal', texto: 'Temperatura sem febre.' };
}

export const FONTE_FEBRE = {
  nome: 'SBP, Documento Científico nº 206 – Abordagem da febre aguda em pediatria (2025)',
  url: 'https://www.sbp.com.br/fileadmin/user_upload/sbp/2025/maio/16/24896f-DC_-Abordag_Febre_Aguda_em_Pediatria_e_Reflexoes_VIRTUAL.pdf',
};

// ---------- Leite materno ordenhado (Ministério da Saúde / Rede de Bancos de Leite) ----------

export const VALIDADE_LEITE_HORAS = { geladeira: 12, freezer: 15 * 24 } as const;

export const ORIENTACAO_LEITE = [
  'Geladeira: até 12 horas, na prateleira de cima (perto do congelador).',
  'Freezer ou congelador: até 15 dias.',
  'Descongelar em banho-maria com o fogo desligado, até ficar morno. Não ferver nem usar micro-ondas.',
  'Depois de descongelado, use em até 12 horas (na geladeira) e não congele de novo. A sobra do que o bebê não tomou vai fora.',
];

// ---------- Introdução alimentar (Guia Alimentar para Crianças Brasileiras Menores de 2 Anos) ----------

export const IDADE_INTRODUCAO_MESES = 6;

export const ORIENTACAO_INTRODUCAO = [
  'A partir dos 6 meses, mantendo o leite materno até 2 anos ou mais.',
  'Ovo inteiro (bem cozido), peixe e carne de porco podem ser oferecidos desde o início: adiar não previne alergia.',
  'Sem açúcar, mel e ultraprocessados antes dos 2 anos.',
  'Ofereça um alimento novo de cada vez e observe por alguns dias.',
];

/** Alimentos que valem anotar a primeira vez (os que mais causam reação) */
export const ALIMENTOS_ATENCAO = ['Ovo', 'Peixe', 'Leite de vaca e derivados', 'Trigo', 'Amendoim', 'Castanhas', 'Soja', 'Frutos do mar'];

export const FONTE_ALIMENTACAO = {
  nome: 'Guia Alimentar para Crianças Brasileiras Menores de 2 Anos (Ministério da Saúde, 2019)',
  url: 'https://bvsms.saude.gov.br/bvs/publicacoes/guia_alimentar_criancas_menores_2_anos.pdf',
};

// ---------- Consultas de rotina (puericultura) ----------

/** Consultas mínimas do Ministério da Saúde no 1º e 2º ano (idade em dias, aproximada) */
export const CONSULTAS_ROTINA: { titulo: string; dias: number }[] = [
  { titulo: 'Consulta da 1ª semana', dias: 5 },
  { titulo: 'Consulta de 1 mês', dias: 30 },
  { titulo: 'Consulta de 2 meses', dias: 61 },
  { titulo: 'Consulta de 4 meses', dias: 122 },
  { titulo: 'Consulta de 6 meses', dias: 183 },
  { titulo: 'Consulta de 9 meses', dias: 274 },
  { titulo: 'Consulta de 12 meses', dias: 365 },
  { titulo: 'Consulta de 18 meses', dias: 548 },
  { titulo: 'Consulta de 24 meses', dias: 730 },
];

export const ORIENTACAO_CONSULTAS =
  'Calendário mínimo do Ministério da Saúde. A SBP recomenda consultas mais frequentes (mensais até 6 meses). Combine o ritmo com o pediatra.';
