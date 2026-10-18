import type { TipoCompromisso } from '../../supabase/functions/_shared/ics.ts';

export type { TipoCompromisso };

export type TipoRegistro = 'mamada' | 'mamadeira' | 'fralda' | 'sono';
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
  | (RegistroBase & { tipo: 'sono'; dados: DadosSono });

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
}

export interface Membro {
  familia_id: string;
  user_id: string;
  nome: string;
  fuso_horario: string;
  lembrete_mamada: boolean;
  lembrete_mamada_min: number;
  lembrete_agenda: boolean;
  token_calendario: string | null;
}

/** O que cada membro pode mudar em si mesmo */
export type PreferenciasMembro = Pick<Membro, 'nome' | 'lembrete_mamada' | 'lembrete_mamada_min' | 'lembrete_agenda'>;

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
