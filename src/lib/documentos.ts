// Documentos do bebê: categorias, lista dos principais e regras simples (validade, nomes).
import { somarDiasLocal } from './datas';
import type { CategoriaDocumento, Documento } from './tipos';

export const CATEGORIAS: { id: CategoriaDocumento; nome: string }[] = [
  { id: 'identificacao', nome: 'Identificação' },
  { id: 'saude', nome: 'Saúde' },
  { id: 'exames', nome: 'Exames' },
  { id: 'plano', nome: 'Plano de saúde' },
  { id: 'escola', nome: 'Escola e creche' },
  { id: 'viagem', nome: 'Viagem' },
  { id: 'outros', nome: 'Outros' },
];

export const NOME_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.nome])) as Record<CategoriaDocumento, string>;

export interface ModeloDocumento {
  id: string;
  categoria: CategoriaDocumento;
  titulo: string;
  /** O que é e onde conseguir */
  dica: string;
  /** Rótulo do campo de número (vazio = o documento não tem número) */
  numero?: string;
  /** Tem data de validade */
  validade?: boolean;
  /** Entra na contagem dos principais */
  principal: boolean;
}

/** Os documentos que quase toda família precisa ter à mão (Brasil, 2026) */
export const MODELOS: ModeloDocumento[] = [
  { id: 'dnv', categoria: 'identificacao', titulo: 'DNV (Declaração de Nascido Vivo)', dica: 'Entregue na maternidade. É com ela que se tira a certidão.', numero: 'Número da DNV', principal: true },
  { id: 'certidao', categoria: 'identificacao', titulo: 'Certidão de nascimento', dica: 'Tirada no cartório (ou no posto do cartório na maternidade). Já sai com o CPF.', numero: 'Matrícula', principal: true },
  { id: 'cpf', categoria: 'identificacao', titulo: 'CPF', dica: 'O número vem impresso na certidão de nascimento.', numero: 'CPF', principal: true },
  { id: 'cin', categoria: 'identificacao', titulo: 'Carteira de Identidade (CIN)', dica: 'Não é obrigatória para bebês. A 1ª via é gratuita e o número é o CPF.', numero: 'Número', validade: true, principal: false },
  { id: 'passaporte', categoria: 'viagem', titulo: 'Passaporte', dica: 'Pedido na Polícia Federal. Para crianças pequenas a validade é mais curta: confira a data.', numero: 'Número', validade: true, principal: false },
  { id: 'cns', categoria: 'saude', titulo: 'Cartão do SUS (CNS)', dica: 'Feito na UBS com a certidão. Também aparece no app Meu SUS Digital.', numero: 'Número do cartão (15 dígitos)', principal: true },
  { id: 'caderneta', categoria: 'saude', titulo: 'Caderneta da Criança', dica: 'Foto das páginas de identificação, vacinas e crescimento: se a caderneta se perder, vocês têm a cópia.', principal: true },
  { id: 'alta', categoria: 'saude', titulo: 'Resumo de alta da maternidade', dica: 'Peso, Apgar, tipo sanguíneo, vacinas e testes feitos no nascimento.', principal: true },
  { id: 'pezinho', categoria: 'exames', titulo: 'Resultado do teste do pezinho', dica: 'Sai alguns dias depois da coleta, na UBS, no laboratório ou pelo site do serviço.', principal: true },
  { id: 'orelhinha', categoria: 'exames', titulo: 'Resultado do teste da orelhinha', dica: 'Entregue na maternidade ou no serviço que fez o exame.', principal: false },
  { id: 'carteirinha', categoria: 'plano', titulo: 'Carteirinha do plano de saúde', dica: 'Também costuma ficar no app do plano. Inclua o bebê em até 30 dias para não ter carência.', numero: 'Número da carteirinha', validade: true, principal: false },
];

export const MODELO_POR_ID = new Map(MODELOS.map((m) => [m.id, m]));

/** Sugestões de nome para documentos livres de cada categoria */
export const SUGESTOES: Record<CategoriaDocumento, string[]> = {
  identificacao: ['Certidão (2ª via)', 'Documento dos pais'],
  saude: ['Receita', 'Relatório médico', 'Atestado', 'Laudo'],
  exames: ['Exame de sangue', 'Ultrassom', 'Teste do olhinho', 'Teste do coraçãozinho'],
  plano: ['Guia de autorização', 'Pedido de reembolso', 'Nota fiscal de consulta'],
  escola: ['Matrícula', 'Declaração de vacinação', 'Contrato'],
  viagem: ['Autorização de viagem', 'Seguro viagem'],
  outros: [],
};

export type SituacaoValidade = 'vencido' | 'vence-logo' | 'ok' | null;

/** Vencido, vence nos próximos 60 dias ou em dia (null = sem validade) */
export function situacaoValidade(validade: string | null, hoje: string): SituacaoValidade {
  if (!validade) return null;
  if (validade < hoje) return 'vencido';
  if (validade <= somarDiasLocal(hoje, 60)) return 'vence-logo';
  return 'ok';
}

/** O documento já foi guardado (tem arquivo ou, ao menos, o número) */
export function guardado(d: Documento | undefined): boolean {
  return !!d && (d.arquivos.length > 0 || !!d.numero?.trim());
}

/** Nome de arquivo seguro: "Certidão de nascimento - Heitor.pdf" */
export function nomeArquivo(titulo: string, bebe: string | null | undefined, ext = 'pdf'): string {
  const base = [titulo, bebe].filter((x) => x && x.trim()).join(' - ');
  const limpo = base.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 100) || 'documento';
  return `${limpo}.${ext}`;
}

/** Busca simples, sem acento e sem diferenciar maiúsculas */
export function semAcento(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function combinaBusca(d: Documento, busca: string): boolean {
  const q = semAcento(busca.trim());
  if (!q) return true;
  return semAcento([d.titulo, d.numero, d.observacao, NOME_CATEGORIA[d.categoria], ...d.arquivos.map((a) => a.nome)].filter(Boolean).join(' ')).includes(q);
}

export function tamanhoTexto(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

/** Limite de cada arquivo (igual ao do armazenamento) */
export const LIMITE_ARQUIVO = 20 * 1024 * 1024;
