import type { TipoCompromisso } from '../../supabase/functions/_shared/ics.ts';

export type { TipoCompromisso };

export type TipoRegistro = 'mamada' | 'mamadeira' | 'fralda' | 'sono' | 'remedio' | 'temperatura' | 'extracao' | 'refeicao';
export type Lado = 'E' | 'D';

/** Trecho da mamada num peito. fim vazio = mamando agora neste lado. */
export interface Segmento {
  lado: Lado;
  inicio: string;
  fim: string | null;
}

export interface DadosMamada {
  segmentos: Segmento[];
}

export type ConteudoMamadeira = 'materno' | 'formula';

export interface DadosMamadeira {
  ml: number;
  conteudo: ConteudoMamadeira;
}

/** Cor do cocô, como na escala de cores da Caderneta da Criança (as claras são sinal de alerta) */
export type CorFezes = 'branca' | 'cinza' | 'amarelo-claro' | 'amarela' | 'mostarda' | 'verde' | 'marrom' | 'meconio';

export interface DadosFralda {
  xixi: boolean;
  coco: boolean;
  cor?: CorFezes | null;
}

export type DadosSono = Record<string, never>;

/** Dose de remédio dada (liga ao remédio em uso, quando houver) */
export interface DadosRemedio {
  remedio_id: string | null;
  nome: string;
  dose: string | null;
}

export interface DadosTemperatura {
  graus: number;
}

/** Extração com bomba ou manual (ml de cada peito) */
export interface DadosExtracao {
  ml_e: number;
  ml_d: number;
}

export type Aceitacao = 'bem' | 'pouco' | 'recusou';

/** Refeição da introdução alimentar */
export interface DadosRefeicao {
  alimentos: string[];
  aceitacao: Aceitacao;
  reacao: string | null;
}

interface RegistroBase {
  id: string;
  familia_id: string;
  bebe_id: string;
  /** ISO */
  inicio: string;
  /** ISO; vazio = em andamento */
  fim: string | null;
  observacao: string | null;
  criado_por: string | null;
}

export type Registro =
  | (RegistroBase & { tipo: 'mamada'; dados: DadosMamada })
  | (RegistroBase & { tipo: 'mamadeira'; dados: DadosMamadeira })
  | (RegistroBase & { tipo: 'fralda'; dados: DadosFralda })
  | (RegistroBase & { tipo: 'sono'; dados: DadosSono })
  | (RegistroBase & { tipo: 'remedio'; dados: DadosRemedio })
  | (RegistroBase & { tipo: 'temperatura'; dados: DadosTemperatura })
  | (RegistroBase & { tipo: 'extracao'; dados: DadosExtracao })
  | (RegistroBase & { tipo: 'refeicao'; dados: DadosRefeicao });

export type RegistroDe<T extends TipoRegistro> = Extract<Registro, { tipo: T }>;

export interface Bebe {
  id: string;
  familia_id: string;
  nome: string;
  sexo: 'M' | 'F' | null;
  data_prevista: string | null;
  /** ISO; vazio = ainda não nasceu */
  nascimento: string | null;
  peso_nascer_g: number | null;
  altura_nascer_cm: number | null;
  pc_nascer_cm: number | null;
  /** Calendário de vacinas: só SUS (pni) ou SUS + particular (sbp) */
  calendario_vacinal: 'pni' | 'sbp';
}

export interface Membro {
  familia_id: string;
  user_id: string;
  nome: string;
  fuso_horario: string;
  lembrete_mamada: boolean;
  lembrete_mamada_min: number;
  lembrete_agenda: boolean;
  lembrete_remedio: boolean;
  lembrete_vacina: boolean;
  lembrete_documento: boolean;
  lembrete_cofrinho: boolean;
  token_calendario: string | null;
  /** Quando entrou na família (quem entrou antes pode remover quem entrou depois) */
  criado_em?: string;
}

/** O que cada membro pode mudar em si mesmo */
export type PreferenciasMembro = Pick<Membro, 'nome' | 'lembrete_mamada' | 'lembrete_mamada_min' | 'lembrete_agenda' | 'lembrete_remedio' | 'lembrete_vacina' | 'lembrete_documento' | 'lembrete_cofrinho'>;

export interface Compromisso {
  id: string;
  familia_id: string;
  tipo: TipoCompromisso;
  titulo: string;
  /** AAAA-MM-DD */
  data: string;
  /** HH:MM; vazio = dia inteiro */
  hora: string | null;
  duracao_min: number;
  local: string | null;
  observacao: string | null;
  avisar_min: number | null;
  criado_por: string | null;
}

export interface Convite {
  codigo: string;
  expira_em: string;
}

export interface NovaFamilia {
  nome: string;
  bebe_nome: string;
  sexo: 'M' | 'F' | null;
  data_prevista: string | null;
  nascimento: string | null;
}

interface Item {
  id: string;
  familia_id: string;
  criado_por: string | null;
}

export interface Medida extends Item {
  bebe_id: string;
  data: string;
  peso_g: number | null;
  comprimento_cm: number | null;
  pc_cm: number | null;
  observacao: string | null;
}

export interface VacinaRegistro extends Item {
  bebe_id: string;
  /** id da dose no calendário (vacinas.ts) ou 'extra:...' */
  dose_id: string;
  nome: string | null;
  status: 'aplicada' | 'pulada';
  data: string | null;
  rede: 'sus' | 'particular' | null;
  local: string | null;
  lote: string | null;
  observacao: string | null;
}

export interface Remedio extends Item {
  bebe_id: string;
  nome: string;
  dose: string | null;
  /** Horas entre doses; vazio = só quando precisar */
  intervalo_h: number | null;
  ativo: boolean;
  observacao: string | null;
  /** Último dia do tratamento (AAAA-MM-DD); depois dele o remédio encerra sozinho. Vazio = sem prazo */
  termina_em?: string | null;
}

export interface PoteLeite extends Item {
  extraido_em: string;
  ml: number;
  local: 'geladeira' | 'freezer';
  usado_em: string | null;
  descartado_em: string | null;
  observacao: string | null;
  /** Quando saiu do freezer para a geladeira (vale 12 h a partir daqui) */
  descongelado_em?: string | null;
}

export interface Marco extends Item {
  bebe_id: string;
  tipo: 'caderneta' | 'primeira-vez' | 'mes';
  marco_id: string | null;
  titulo: string | null;
  data: string | null;
  observacao: string | null;
  /** Caminho da foto no armazenamento */
  foto: string | null;
}

export interface Tarefa extends Item {
  /** Item da lista padrão (primeiros-dias.ts); vazio = criado por vocês */
  item_id: string | null;
  titulo: string | null;
  data: string | null;
  feito_em: string | null;
  observacao: string | null;
}

export type CategoriaDocumento = 'identificacao' | 'saude' | 'exames' | 'plano' | 'escola' | 'viagem' | 'familia' | 'outros';

export interface ArquivoDocumento {
  /** Caminho no armazenamento (bucket nenem-documentos): <familia>/<arquivo> */
  caminho: string;
  nome: string;
  /** image/jpeg ou application/pdf */
  tipo: string;
  /** Bytes */
  tamanho: number;
}

export interface Documento extends Item {
  bebe_id: string;
  categoria: CategoriaDocumento;
  /** Documento da lista principal (documentos.ts); vazio = documento livre */
  modelo_id: string | null;
  titulo: string;
  numero: string | null;
  data: string | null;
  validade: string | null;
  observacao: string | null;
  arquivos: ArquivoDocumento[];
  /** Fixado na carteira (null = o app decide pelo tipo do documento) */
  fixado?: boolean | null;
}

// ---------- Cofrinho ----------

export type TipoContaCofrinho = 'caixinha' | 'poupanca' | 'conta' | 'cdb' | 'tesouro' | 'fundo' | 'previdencia' | 'acoes' | 'cofre' | 'outro';

export interface ContaCofrinho extends Item {
  bebe_id: string;
  nome: string;
  tipo: TipoContaCofrinho;
  instituicao: string | null;
  agencia: string | null;
  numero: string | null;
  titular: string | null;
  chave_pix: string | null;
  cidade: string | null;
  rendimento: string | null;
  ativa: boolean;
  observacao: string | null;
}

export type OcasiaoCofrinho = 'mensal' | 'aniversario' | 'mesversario' | 'natal' | 'presente' | 'batizado' | 'outro';

export interface MovimentoCofrinho extends Item {
  conta_id: string;
  /** deposito e retirada mudam o saldo; saldo = valor do extrato naquela data */
  tipo: 'deposito' | 'retirada' | 'saldo';
  /** AAAA-MM-DD */
  data: string;
  valor_centavos: number;
  de: string | null;
  ocasiao: OcasiaoCofrinho | null;
  recado: string | null;
  observacao: string | null;
  comprovante: ArquivoDocumento | null;
  /** Transferência entre contas: a retirada de uma e o depósito na outra têm o mesmo id aqui */
  transferencia_id?: string | null;
}

export interface MetaCofrinho extends Item {
  bebe_id: string;
  nome: string;
  emoji: string | null;
  valor_centavos: number;
  idade_anos: number | null;
}

export interface PlanoCofrinho extends Item {
  bebe_id: string;
  aporte_mensal_centavos: number;
  dia_aporte: number | null;
  /** Rendimento acima da inflação esperado (% ao ano) */
  taxa_real: number;
  idade_alvo: number;
}

/** Listas guardadas em tabelas próprias (mesma fila e mesmo tempo real dos registros) */
export interface Colecoes {
  medidas: Medida;
  vacinas: VacinaRegistro;
  remedios: Remedio;
  leite: PoteLeite;
  marcos: Marco;
  tarefas: Tarefa;
  documentos: Documento;
  cofrinho_contas: ContaCofrinho;
  cofrinho_movimentos: MovimentoCofrinho;
  cofrinho_metas: MetaCofrinho;
  cofrinho_planos: PlanoCofrinho;
}

export type NomeColecao = keyof Colecoes;

export const COLECOES: NomeColecao[] = ['medidas', 'vacinas', 'remedios', 'leite', 'marcos', 'tarefas', 'documentos', 'cofrinho_contas', 'cofrinho_movimentos', 'cofrinho_metas', 'cofrinho_planos'];
