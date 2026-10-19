// Chegada do bebê: vacinas de quem convive com o recém-nascido (estratégia
// "casulo") e cuidados essenciais dos primeiros meses.
// Fontes (out/2026): Calendário Nacional de Vacinação 2026 (Ministério da Saúde),
// Calendários SBIm 2026-2027, SBP (sono seguro; febre, Doc. Científico 206/2025),
// OMS/Ministério da Saúde (amamentação) e Resolução Contran 819/2021 (transporte).

export type Pessoa = 'mae' | 'pai' | 'irmaos' | 'avos' | 'cuidadores';
export type VacinaFamilia = 'dtpa' | 'gripe' | 'covid' | 'vsr' | 'triplice' | 'varicela' | 'caderneta';

export const PESSOAS: { id: Pessoa; nome: string; detalhe: string }[] = [
  { id: 'mae', nome: 'Mãe', detalhe: 'Parte da proteção passa para o bebê pela placenta e pelo leite' },
  { id: 'pai', nome: 'Pai', detalhe: 'Quem mais convive, junto com a mãe' },
  { id: 'irmaos', nome: 'Irmãos', detalhe: 'Crianças da casa com a caderneta em dia' },
  { id: 'avos', nome: 'Avós', detalhe: 'Visitam e pegam no colo: entram no casulo' },
  { id: 'cuidadores', nome: 'Babá, tios e quem vai ajudar', detalhe: 'Quem vai ter contato frequente' },
];

export interface InfoVacina {
  id: VacinaFamilia;
  nome: string;
  protege: string;
  /** Por que importa para o recém-nascido */
  porque: string;
}

export const VACINAS: Record<VacinaFamilia, InfoVacina> = {
  dtpa: {
    id: 'dtpa',
    nome: 'dTpa (coqueluche, difteria e tétano)',
    protege: 'Coqueluche',
    porque: 'A coqueluche é grave nos primeiros meses e o bebê só começa a ser vacinado aos 2 meses. Quase sempre ele pega de alguém da família.',
  },
  gripe: {
    id: 'gripe',
    nome: 'Gripe (influenza)',
    protege: 'Gripe',
    porque: 'O bebê só pode tomar a vacina da gripe a partir dos 6 meses. Até lá, quem protege é quem está em volta. Dose todo ano.',
  },
  covid: { id: 'covid', nome: 'Covid-19', protege: 'Covid-19', porque: 'O bebê só pode ser vacinado a partir dos 6 meses.' },
  vsr: {
    id: 'vsr',
    nome: 'VSR (vírus da bronquiolite)',
    protege: 'Bronquiolite',
    porque: 'Tomada na gestação, passa anticorpos para o bebê nos primeiros meses, quando a bronquiolite é mais perigosa.',
  },
  triplice: { id: 'triplice', nome: 'Tríplice viral (sarampo, caxumba e rubéola)', protege: 'Sarampo', porque: 'O bebê só toma a primeira dose aos 12 meses.' },
  varicela: { id: 'varicela', nome: 'Varicela (catapora)', protege: 'Catapora', porque: 'Catapora no recém-nascido pode ser grave.' },
  caderneta: { id: 'caderneta', nome: 'Caderneta de vacinação em dia', protege: 'Coqueluche, sarampo, gripe…', porque: 'Criança com as doses em dia não leva a doença para o bebê.' },
};

export interface Recomendacao {
  vacina: VacinaFamilia;
  /** Quando e onde (SUS ou particular), em linguagem simples */
  texto: string;
}

/** O que cada pessoa precisa conferir (SUS = gratuita no posto; particular = clínicas de vacinação) */
export const RECOMENDACOES: Record<Pessoa, Recomendacao[]> = {
  mae: [
    { vacina: 'dtpa', texto: 'Na gestação, a partir de 20 semanas (SUS). Se não tomou, no pós-parto até 45 dias (SUS).' },
    { vacina: 'vsr', texto: 'Na gestação, a partir de 28 semanas (SUS). Se não tomou, o pediatra avalia o anticorpo para o bebê.' },
    { vacina: 'gripe', texto: 'Na gestação ou no pós-parto até 45 dias (SUS).' },
    { vacina: 'covid', texto: 'Na gestação (SUS). Se não tomou, pergunte na UBS sobre o pós-parto.' },
    { vacina: 'triplice', texto: 'Se não tiver as doses, toma no pós-parto (SUS). Pode amamentar.' },
  ],
  pai: [
    { vacina: 'dtpa', texto: 'Uma dose, de preferência 2 semanas antes do parto (particular). A SBIm indica reforço se a última foi há mais de 5 anos.' },
    { vacina: 'gripe', texto: 'Dose do ano (SUS na campanha, quando aberta a todos, ou particular).' },
    { vacina: 'triplice', texto: 'Até 29 anos: 2 doses; de 30 a 59 anos: 1 dose (SUS), se não tiver comprovação.' },
    { vacina: 'varicela', texto: 'Só para quem nunca teve catapora nem tomou a vacina: 2 doses (particular).' },
  ],
  irmaos: [
    { vacina: 'caderneta', texto: 'Leve a caderneta à UBS para conferir: coqueluche, sarampo, catapora e as outras doses da idade (SUS).' },
    { vacina: 'gripe', texto: 'Dose do ano: no SUS, crianças de 6 meses a menores de 6 anos; maiores, particular ou na campanha.' },
  ],
  avos: [
    { vacina: 'dtpa', texto: 'Uma dose antes de conviver com o bebê (particular). A SBIm indica reforço se a última foi há mais de 5 anos.' },
    { vacina: 'gripe', texto: 'Dose do ano: 60 anos ou mais, de graça na campanha (SUS).' },
    { vacina: 'covid', texto: '60 anos ou mais: uma dose a cada 6 meses (SUS).' },
    { vacina: 'triplice', texto: 'Até 59 anos, sem comprovação de vacina: 1 dose (SUS).' },
  ],
  cuidadores: [
    { vacina: 'dtpa', texto: 'Uma dose antes de começar a cuidar do bebê (particular).' },
    { vacina: 'gripe', texto: 'Dose do ano (SUS na campanha ou particular).' },
    { vacina: 'triplice', texto: 'Até 29 anos: 2 doses; de 30 a 59 anos: 1 dose (SUS), se não tiver comprovação.' },
    { vacina: 'varicela', texto: 'Só para quem nunca teve catapora nem tomou a vacina (particular).' },
  ],
};

/** Id do item na lista de tarefas da família (marcar "já tomou", compartilhado entre os celulares) */
export const itemFamilia = (p: Pessoa, v: VacinaFamilia) => `casulo:${p}:${v}`;

export const TOTAL_ITENS = Object.values(RECOMENDACOES).reduce((s, l) => s + l.length, 0);

export interface Cuidado {
  id: string;
  titulo: string;
  emoji: string;
  itens: string[];
  fonte: string;
}

export const CUIDADOS: Cuidado[] = [
  {
    id: 'visitas',
    titulo: 'Visitas e mãos limpas',
    emoji: '🧼',
    itens: [
      'Lavar as mãos (ou usar álcool em gel) antes de pegar o bebê: vale para todo mundo, sempre.',
      'Quem estiver com febre, gripe, tosse ou ferida de herpes na boca não visita e não pega no colo.',
      'Nada de beijo no rosto e nas mãos do bebê.',
      'Nos primeiros meses, evite lugares fechados e cheios.',
    ],
    fonte: 'SBP · Ministério da Saúde',
  },
  {
    id: 'sono',
    titulo: 'Sono seguro',
    emoji: '😴',
    itens: [
      'Sempre de barriga para cima, em todos os sonos (nunca de lado ou de bruços).',
      'Berço firme e reto, sem travesseiro, protetor, pelúcia ou cobertor solto.',
      'Berço no quarto dos pais, ao alcance das mãos, até pelo menos 6 meses (de preferência até 1 ano).',
      'Não dormir com o bebê na mesma cama nem no sofá.',
    ],
    fonte: 'Sociedade Brasileira de Pediatria',
  },
  {
    id: 'amamentacao',
    titulo: 'Amamentação',
    emoji: '🤱',
    itens: [
      'Só leite materno até os 6 meses: sem água, chá ou suco.',
      'Livre demanda: sempre que o bebê quiser.',
      'Depois dos 6 meses, continuar até os 2 anos ou mais, junto com a comida.',
      'Dificuldade ou dor para amamentar: procure a UBS ou um banco de leite humano.',
    ],
    fonte: 'Organização Mundial da Saúde · Ministério da Saúde',
  },
  {
    id: 'fumaca',
    titulo: 'Sem fumaça',
    emoji: '🚭',
    itens: ['Ninguém fuma (cigarro comum ou eletrônico) perto do bebê, dentro de casa ou no carro.', 'A fumaça aumenta o risco de morte súbita, bronquiolite e otite.'],
    fonte: 'SBP · Ministério da Saúde',
  },
  {
    id: 'carro',
    titulo: 'No carro',
    emoji: '🚗',
    itens: ['Desde a saída da maternidade: bebê conforto no banco de trás, virado para trás.', 'Assim até 1 ano ou 13 kg (é lei). Nunca no colo.'],
    fonte: 'Resolução Contran 819/2021',
  },
  {
    id: 'alerta-bebe',
    titulo: 'Sinais de alerta no bebê: procure atendimento',
    emoji: '🚨',
    itens: [
      'Febre (37,5 °C ou mais na axila) antes dos 3 meses: pronto-socorro.',
      'Respiração rápida, com esforço, gemido ou pele arroxeada.',
      'Não consegue mamar, vomita tudo ou está muito mole e sonolento.',
      'Convulsão.',
      'Pele amarela nas primeiras 24 horas, ou que se espalha para a barriga e as pernas.',
      'Umbigo com pus, mau cheiro ou vermelhidão que se espalha.',
    ],
    fonte: 'Caderneta da Criança (Ministério da Saúde) · SBP',
  },
  {
    id: 'mae',
    titulo: 'Cuidar de quem cuida',
    emoji: '💛',
    itens: [
      'Choro fácil e cansaço nas duas primeiras semanas são comuns (baby blues).',
      'Tristeza que passa de 2 semanas, falta de vontade de tudo ou pensamentos ruins: procure ajuda (obstetra ou UBS). Apoio emocional 24 h: CVV, ligue 188.',
      'Na mãe, procure atendimento se tiver febre, sangramento muito forte, dor de cabeça forte com visão embaçada, falta de ar, dor ou inchaço em uma perna, ou mama vermelha e quente com febre.',
      'Consulta de pós-parto até 6 semanas depois do parto.',
    ],
    fonte: 'Ministério da Saúde · OMS',
  },
];

export const FONTES_CHEGADA = [
  { nome: 'Calendário Nacional de Vacinação 2026 – Ministério da Saúde', url: 'https://www.gov.br/saude/pt-br/vacinacao/calendario' },
  { nome: 'Calendários de vacinação SBIm 2026-2027', url: 'https://sbim.org.br/calendarios-de-vacinacao' },
  { nome: 'SBP – Sono seguro', url: 'https://www.sbp.com.br/imprensa/detalhe/nid/bebe-deve-dormir-de-barriga-para-cima-ou-de-lado-pediatras-reforcam-recomendacoes-para-o-sono-seguro/' },
  { nome: 'OMS – Amamentação', url: 'https://www.who.int/health-topics/breastfeeding' },
];

/** Texto para mandar no grupo da família (o que cada um precisa tomar) */
export function textoParaFamilia(nomeBebe: string): string {
  const linhas = [
    `💛 A chegada do ${nomeBebe}: vamos proteger ele com as vacinas em dia!`,
    '',
    'O recém-nascido só começa a ser vacinado aos poucos (coqueluche aos 2 meses, gripe aos 6, sarampo aos 12). Até lá, a proteção vem de quem está em volta. Por favor, confiram com a caderneta, de preferência até 2 semanas antes do nascimento:',
    '',
  ];
  for (const p of PESSOAS.filter((x) => x.id !== 'mae' && x.id !== 'irmaos')) {
    linhas.push(`*${p.nome}*`);
    for (const r of RECOMENDACOES[p.id]) linhas.push(`• ${VACINAS[r.vacina].nome}: ${r.texto}`);
    linhas.push('');
  }
  linhas.push('🧼 E na visita: mãos lavadas antes de pegar no colo, nada de beijo no rosto, e quem estiver gripado ou com herpes na boca espera melhorar. 🙏');
  linhas.push('');
  linhas.push('Fontes: Ministério da Saúde (Calendário 2026) e SBIm (2026-2027). SUS = de graça no posto; particular = clínicas de vacinação.');
  return linhas.join('\n');
}
