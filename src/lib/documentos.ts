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
  { id: 'familia', nome: 'Família' },
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
  /** Vai para a carteira (cartões no topo) quando guardado */
  carteira?: boolean;
  /** Tamanho do documento físico, para a cópia em tamanho real */
  formato?: FormatoCopia;
}

/** Cartão = 8,6 × 5,4 cm (cartão do SUS, carteirinha, CIN); meia = meia folha A4; folha = A4 inteira */
export type FormatoCopia = 'cartao' | 'meia' | 'folha';

/** Os documentos que quase toda família precisa ter à mão (Brasil, 2026) */
export const MODELOS: ModeloDocumento[] = [
  { id: 'dnv', categoria: 'identificacao', titulo: 'DNV (Declaração de Nascido Vivo)', dica: 'Entregue na maternidade. É com ela que se tira a certidão.', numero: 'Número da DNV', principal: true },
  { id: 'certidao', categoria: 'identificacao', titulo: 'Certidão de nascimento', dica: 'Tirada no cartório (ou no posto do cartório na maternidade). Já sai com o CPF.', numero: 'Matrícula', principal: true, carteira: true, formato: 'folha' },
  { id: 'cpf', categoria: 'identificacao', titulo: 'CPF', dica: 'O número vem impresso na certidão de nascimento.', numero: 'CPF', principal: true },
  { id: 'cin', categoria: 'identificacao', titulo: 'Carteira de Identidade (CIN)', dica: 'Não é obrigatória para bebês. A 1ª via é gratuita e o número é o CPF.', numero: 'Número', validade: true, principal: false, carteira: true, formato: 'cartao' },
  { id: 'passaporte', categoria: 'viagem', titulo: 'Passaporte', dica: 'Pedido na Polícia Federal. Para crianças pequenas a validade é mais curta: confira a data.', numero: 'Número', validade: true, principal: false, carteira: true, formato: 'meia' },
  { id: 'autorizacao-viagem', categoria: 'viagem', titulo: 'Autorização de viagem', dica: 'Para viajar sem um dos pais (ou com outra pessoa). Modelo e regras no site do CNJ; firma reconhecida em cartório.', validade: true, principal: false, formato: 'folha' },
  { id: 'cns', categoria: 'saude', titulo: 'Cartão do SUS (CNS)', dica: 'Feito na UBS com a certidão. Também aparece no app Meu SUS Digital.', numero: 'Número do cartão (15 dígitos)', principal: true, carteira: true, formato: 'cartao' },
  { id: 'caderneta', categoria: 'saude', titulo: 'Caderneta da Criança', dica: 'Foto das páginas de identificação, vacinas e crescimento: se a caderneta se perder, vocês têm a cópia.', principal: true, formato: 'meia' },
  { id: 'alta', categoria: 'saude', titulo: 'Resumo de alta da maternidade', dica: 'Peso, Apgar, tipo sanguíneo, vacinas e testes feitos no nascimento.', principal: true },
  { id: 'pezinho', categoria: 'exames', titulo: 'Resultado do teste do pezinho', dica: 'Sai alguns dias depois da coleta, na UBS, no laboratório ou pelo site do serviço.', principal: true },
  { id: 'orelhinha', categoria: 'exames', titulo: 'Resultado do teste da orelhinha', dica: 'Entregue na maternidade ou no serviço que fez o exame.', principal: false },
  { id: 'carteirinha', categoria: 'plano', titulo: 'Carteirinha do plano de saúde', dica: 'Também costuma ficar no app do plano. Inclua o bebê em até 30 dias para não ter carência.', numero: 'Número da carteirinha', validade: true, principal: false, carteira: true, formato: 'cartao' },
  // Da família: quase sempre pedidos junto com os do bebê (matrícula, plano, benefícios)
  { id: 'doc-mae', categoria: 'familia', titulo: 'RG ou CNH da mãe', dica: 'Frente e verso. Pedido na matrícula da creche, no plano e em benefícios.', numero: 'Número', validade: true, principal: false, formato: 'cartao' },
  { id: 'doc-pai', categoria: 'familia', titulo: 'RG ou CNH do pai', dica: 'Frente e verso. Pedido na matrícula da creche, no plano e em benefícios.', numero: 'Número', validade: true, principal: false, formato: 'cartao' },
  { id: 'residencia', categoria: 'familia', titulo: 'Comprovante de residência', dica: 'Conta de luz, água ou internet. Muitos lugares pedem de até 3 meses: troque quando chegar uma conta nova.', principal: false, formato: 'folha' },
  { id: 'casamento', categoria: 'familia', titulo: 'Certidão de casamento ou união estável', dica: 'Pedida para incluir no plano, em benefícios e às vezes no cartório.', numero: 'Matrícula', principal: false, formato: 'folha' },
];

export const MODELO_POR_ID = new Map(MODELOS.map((m) => [m.id, m]));

/** Sugestões de nome para documentos livres de cada categoria */
export const SUGESTOES: Record<CategoriaDocumento, string[]> = {
  identificacao: ['Certidão (2ª via)', 'Documento dos pais'],
  saude: ['Receita', 'Relatório médico', 'Atestado', 'Laudo'],
  exames: ['Exame de sangue', 'Ultrassom', 'Teste do olhinho', 'Teste do coraçãozinho'],
  plano: ['Guia de autorização', 'Pedido de reembolso', 'Nota fiscal de consulta'],
  escola: ['Matrícula', 'Declaração de vacinação', 'Contrato'],
  viagem: ['Seguro viagem', 'Reserva', 'Certificado de vacinação internacional'],
  familia: ['Cartão do SUS da mãe', 'Carteirinha do plano da mãe', 'Holerite'],
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
  if (semAcento([d.titulo, d.numero, d.observacao, NOME_CATEGORIA[d.categoria], ...d.arquivos.map((a) => a.nome)].filter(Boolean).join(' ')).includes(q)) return true;
  // Número digitado só com os dígitos (ex.: "12345678900" acha "123.456.789-00")
  const digitos = q.replace(/\D/g, '');
  return digitos.length >= 3 && /^[\d\s.\-/]+$/.test(q) && !!d.numero && d.numero.replace(/\D/g, '').includes(digitos);
}

export function tamanhoTexto(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
}

/** Limite de cada arquivo (igual ao do armazenamento) */
export const LIMITE_ARQUIVO = 20 * 1024 * 1024;

/** Está na carteira: escolha da família ou, se nunca escolheram, o padrão do tipo (com arquivo) */
export function naCarteira(d: Documento): boolean {
  if (d.fixado === true || d.fixado === false) return d.fixado;
  return !!(d.modelo_id && MODELO_POR_ID.get(d.modelo_id)?.carteira && d.arquivos.length > 0);
}

/** Formato padrão da cópia em tamanho real */
export function formatoPadrao(d: Documento): FormatoCopia {
  const m = d.modelo_id ? MODELO_POR_ID.get(d.modelo_id) : undefined;
  return m?.formato ?? 'folha';
}

// ---------- Kits: os documentos de cada situação, num PDF só ----------

/** 'vacinacao' = carteira de vacinação gerada pelo app; 'exames' = os exames mais recentes */
export type ItemKit = { modelo: string } | { gerado: 'vacinacao' } | { categoria: CategoriaDocumento; ultimos: number };

export interface Kit {
  id: string;
  titulo: string;
  detalhe: string;
  icone: string;
  itens: ItemKit[];
}

export const KITS: Kit[] = [
  {
    id: 'consulta',
    titulo: 'Consulta e pronto-socorro',
    detalhe: 'Cartão do SUS, carteirinha, caderneta, vacinas e exames recentes',
    icone: 'saude',
    itens: [{ modelo: 'cns' }, { modelo: 'carteirinha' }, { modelo: 'caderneta' }, { gerado: 'vacinacao' }, { categoria: 'exames', ultimos: 3 }, { modelo: 'alta' }],
  },
  {
    id: 'creche',
    titulo: 'Creche e escola',
    detalhe: 'Certidão, CPF, vacinas, cartão do SUS, documentos dos pais e residência',
    icone: 'estrela',
    itens: [{ modelo: 'certidao' }, { modelo: 'cpf' }, { gerado: 'vacinacao' }, { modelo: 'caderneta' }, { modelo: 'cns' }, { modelo: 'carteirinha' }, { modelo: 'doc-mae' }, { modelo: 'doc-pai' }, { modelo: 'residencia' }],
  },
  {
    id: 'viagem',
    titulo: 'Viagem',
    detalhe: 'Certidão, identidade ou passaporte, autorização, plano e vacinas',
    icone: 'agenda',
    itens: [{ modelo: 'certidao' }, { modelo: 'cin' }, { modelo: 'passaporte' }, { modelo: 'autorizacao-viagem' }, { modelo: 'carteirinha' }, { modelo: 'cns' }, { gerado: 'vacinacao' }, { modelo: 'doc-mae' }, { modelo: 'doc-pai' }],
  },
  {
    id: 'cadastros',
    titulo: 'Plano, INSS e cadastros',
    detalhe: 'DNV, certidão, CPF, documentos dos pais, casamento e residência',
    icone: 'pessoas',
    itens: [{ modelo: 'dnv' }, { modelo: 'certidao' }, { modelo: 'cpf' }, { modelo: 'doc-mae' }, { modelo: 'doc-pai' }, { modelo: 'casamento' }, { modelo: 'residencia' }],
  },
];

export interface KitMontado {
  /** Documentos guardados que entram, na ordem do kit */
  documentos: Documento[];
  incluiVacinacao: boolean;
  /** Itens do kit que ainda não foram guardados */
  faltam: ModeloDocumento[];
}

export function montarKit(kit: Kit, docs: Documento[]): KitMontado {
  const porModelo = new Map(docs.filter((d) => d.modelo_id).map((d) => [d.modelo_id!, d]));
  const usados = new Set<string>();
  const documentos: Documento[] = [];
  const faltam: ModeloDocumento[] = [];
  let incluiVacinacao = false;
  // Tipos citados no kit: esses entram pelo próprio item, não como "recentes"
  const doKit = new Set(kit.itens.flatMap((i) => ('modelo' in i ? [i.modelo] : [])));
  for (const item of kit.itens) {
    if ('gerado' in item) incluiVacinacao = true;
    else if ('modelo' in item) {
      const d = porModelo.get(item.modelo);
      if (d && guardado(d)) {
        if (!usados.has(d.id)) documentos.push(d);
        usados.add(d.id);
      } else {
        const m = MODELO_POR_ID.get(item.modelo);
        if (m) faltam.push(m);
      }
    } else {
      const recentes = docs
        .filter((d) => d.categoria === item.categoria && !(d.modelo_id && doKit.has(d.modelo_id)) && guardado(d))
        .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))
        .slice(0, item.ultimos);
      for (const d of recentes) if (!usados.has(d.id)) (usados.add(d.id), documentos.push(d));
    }
  }
  return { documentos, incluiVacinacao, faltam };
}
