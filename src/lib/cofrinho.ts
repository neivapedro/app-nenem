// Cofrinho do Heitor: saldo, rendimento, quem contribuiu, projeção e o Pix da
// conta. Tudo em centavos (inteiros) e sem dependências: testado no vitest.
import { somarMeses } from '../../supabase/functions/_shared/tempo.ts';
import type { ContaCofrinho, MovimentoCofrinho, OcasiaoCofrinho, TipoContaCofrinho } from './tipos';

export const TIPOS_CONTA: { id: TipoContaCofrinho; nome: string }[] = [
  { id: 'caixinha', nome: 'Caixinha' },
  { id: 'poupanca', nome: 'Poupança' },
  { id: 'conta', nome: 'Conta' },
  { id: 'cdb', nome: 'CDB / RDB' },
  { id: 'tesouro', nome: 'Tesouro Direto' },
  { id: 'fundo', nome: 'Fundo' },
  { id: 'previdencia', nome: 'Previdência' },
  { id: 'acoes', nome: 'Ações / ETF' },
  { id: 'cofre', nome: 'Cofrinho em casa' },
  { id: 'outro', nome: 'Outro' },
];
export const NOME_TIPO_CONTA = Object.fromEntries(TIPOS_CONTA.map((t) => [t.id, t.nome])) as Record<TipoContaCofrinho, string>;

export const OCASIOES: { id: OcasiaoCofrinho; nome: string; emoji: string }[] = [
  { id: 'mensal', nome: 'Mensal', emoji: '📅' },
  { id: 'presente', nome: 'Presente', emoji: '🎁' },
  { id: 'aniversario', nome: 'Aniversário', emoji: '🎂' },
  { id: 'mesversario', nome: 'Mesversário', emoji: '🧁' },
  { id: 'natal', nome: 'Natal', emoji: '🎄' },
  { id: 'batizado', nome: 'Batizado', emoji: '🕊️' },
  { id: 'outro', nome: 'Outro', emoji: '💛' },
];
export const OCASIAO = Object.fromEntries(OCASIOES.map((o) => [o.id, o])) as Record<OcasiaoCofrinho, (typeof OCASIOES)[number]>;

/** Cenários de rendimento ACIMA da inflação (% ao ano): a projeção fica em dinheiro de hoje */
export const CENARIOS = [
  { id: 'conservador', nome: 'Conservador', taxa: 1, detalhe: 'parecido com a poupança' },
  { id: 'moderado', nome: 'Moderado', taxa: 4, detalhe: 'renda fixa (Tesouro, CDB)' },
  { id: 'otimista', nome: 'Otimista', taxa: 6, detalhe: 'longo prazo, com parte em ações' },
] as const;

// ---------- Dinheiro ----------

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 123456 → "R$ 1.234,56" (compacto: "R$ 12,3 mil", "R$ 1,2 mi") */
export function reais(centavos: number, opcoes: { compacto?: boolean; sinal?: boolean } = {}): string {
  const v = centavos / 100;
  let txt: string;
  if (opcoes.compacto && Math.abs(v) >= 1000) {
    const [n, suf] = Math.abs(v) >= 1_000_000 ? [v / 1_000_000, 'mi'] : [v / 1000, 'mil'];
    txt = `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: Math.abs(n) >= 100 ? 0 : 1 })} ${suf}`;
  } else txt = BRL.format(v).replace(/ /g, ' ');
  return opcoes.sinal && centavos > 0 ? `+${txt}` : txt;
}

/** "1.234,56", "1234,5", "R$ 50" ou "1234.56" → centavos (null = não é valor) */
export function lerReais(texto: string): number | null {
  let t = texto.replace(/[R$\s]/g, '');
  if (!t) return null;
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  else t = t.replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

// ---------- Saldo ----------

const ordemTipo = { deposito: 0, retirada: 0, saldo: 1 } as const;

/**
 * Saldo de uma conta até a data: depósitos somam, retiradas tiram e o saldo do
 * extrato substitui o que foi somado (já com os depósitos do mesmo dia).
 * `aportado` = depósitos − retiradas (o que a família colocou).
 */
export function saldoConta(movs: MovimentoCofrinho[], ate?: string): { saldo: number; aportado: number; ultimoExtrato: string | null } {
  let saldo = 0;
  let aportado = 0;
  let ultimoExtrato: string | null = null;
  const lista = movs.filter((m) => !ate || m.data <= ate).sort((a, b) => a.data.localeCompare(b.data) || ordemTipo[a.tipo] - ordemTipo[b.tipo]);
  for (const m of lista) {
    if (m.tipo === 'deposito') {
      saldo += m.valor_centavos;
      aportado += m.valor_centavos;
    } else if (m.tipo === 'retirada') {
      saldo -= m.valor_centavos;
      aportado -= m.valor_centavos;
    } else {
      saldo = m.valor_centavos;
      ultimoExtrato = m.data;
    }
  }
  return { saldo, aportado, ultimoExtrato };
}

export interface ResumoCofrinho {
  saldo: number;
  aportado: number;
  rendimento: number;
  /** Rendimento sobre o que foi colocado (0,05 = 5%) */
  rendimentoPct: number | null;
  depositos: number;
  porConta: Map<string, { saldo: number; aportado: number; ultimoExtrato: string | null }>;
  primeiro: string | null;
}

export function resumo(contas: ContaCofrinho[], movs: MovimentoCofrinho[], ate?: string): ResumoCofrinho {
  const porConta = new Map<string, { saldo: number; aportado: number; ultimoExtrato: string | null }>();
  let saldo = 0;
  let aportado = 0;
  for (const c of contas) {
    const r = saldoConta(
      movs.filter((m) => m.conta_id === c.id),
      ate,
    );
    porConta.set(c.id, r);
    saldo += r.saldo;
    aportado += r.aportado;
  }
  const rendimento = saldo - aportado;
  const depositos = movs.filter((m) => m.tipo === 'deposito' && (!ate || m.data <= ate)).length;
  const primeiro = movs.reduce<string | null>((p, m) => (!p || m.data < p ? m.data : p), null);
  return { saldo, aportado, rendimento, rendimentoPct: aportado > 0 ? rendimento / aportado : null, depositos, porConta, primeiro };
}

const ultimoDiaDoMes = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  return `${mes}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0')}`;
};

/** Evolução mês a mês: o que foi colocado e o saldo no fim de cada mês (o mês atual vai até hoje) */
export function evolucaoMensal(contas: ContaCofrinho[], movs: MovimentoCofrinho[], hoje: string): { mes: string; aportado: number; saldo: number }[] {
  const ids = new Set(contas.map((c) => c.id));
  const doCofre = movs.filter((m) => ids.has(m.conta_id));
  if (!doCofre.length) return [];
  const inicio = doCofre.reduce((p, m) => (m.data < p ? m.data : p), doCofre[0].data).slice(0, 7);
  const fim = hoje.slice(0, 7);
  const serie: { mes: string; aportado: number; saldo: number }[] = [];
  for (let mes = inicio; mes <= fim; mes = somarMeses(`${mes}-01`, 1).slice(0, 7)) {
    const ate = mes === fim ? hoje : ultimoDiaDoMes(mes);
    const r = resumo(contas, doCofre, ate);
    serie.push({ mes, aportado: r.aportado, saldo: r.saldo });
    if (serie.length > 600) break;
  }
  return serie;
}

/** Depósitos de cada um dos últimos `n` meses (do mais antigo para o atual) */
export function depositosPorMes(movs: MovimentoCofrinho[], hoje: string, n = 12): { mes: string; centavos: number }[] {
  const meses = Array.from({ length: n }, (_, i) => somarMeses(`${hoje.slice(0, 7)}-01`, i - n + 1).slice(0, 7));
  return meses.map((mes) => ({ mes, centavos: movs.filter((m) => m.tipo === 'deposito' && m.data.startsWith(mes)).reduce((s, m) => s + m.valor_centavos, 0) }));
}

/** Quem colocou quanto (depósitos), do maior para o menor */
export function porQuem(movs: MovimentoCofrinho[]): { de: string; centavos: number; vezes: number }[] {
  const mapa = new Map<string, { de: string; centavos: number; vezes: number }>();
  for (const m of movs) {
    if (m.tipo !== 'deposito') continue;
    const nome = m.de?.trim() || 'Sem nome';
    const chave = nome.toLocaleLowerCase('pt-BR');
    const atual = mapa.get(chave) ?? { de: nome, centavos: 0, vezes: 0 };
    atual.centavos += m.valor_centavos;
    atual.vezes++;
    mapa.set(chave, atual);
  }
  return [...mapa.values()].sort((a, b) => b.centavos - a.centavos);
}

/** Meses seguidos com depósito (o mês atual conta se já teve; se ainda não, começa no anterior) */
export function mesesSeguidos(movs: MovimentoCofrinho[], hoje: string): number {
  const comDeposito = new Set(movs.filter((m) => m.tipo === 'deposito').map((m) => m.data.slice(0, 7)));
  let mes = hoje.slice(0, 7);
  if (!comDeposito.has(mes)) mes = somarMeses(`${mes}-01`, -1).slice(0, 7);
  let n = 0;
  while (comDeposito.has(mes) && n < 600) {
    n++;
    mes = somarMeses(`${mes}-01`, -1).slice(0, 7);
  }
  return n;
}

// ---------- Projeção (em dinheiro de hoje) ----------

/** Taxa mensal equivalente a uma taxa anual (% ao ano) */
export const taxaMensal = (anualPct: number) => Math.pow(1 + anualPct / 100, 1 / 12) - 1;

/** Valor mês a mês (posição 0 = hoje), aplicando o rendimento e depois o aporte de cada mês */
export function projetar(saldo: number, aporteMensal: number, taxaRealAnual: number, meses: number): number[] {
  const r = taxaMensal(taxaRealAnual);
  const serie = [saldo];
  let v = saldo;
  for (let i = 0; i < meses; i++) {
    v = v * (1 + r) + aporteMensal;
    serie.push(v);
  }
  return serie;
}

/** Meses até o Heitor fazer `idade` anos (a partir do nascimento ou, se não nasceu, da data prevista) */
export function mesesAteIdade(nascimento: string, hoje: string, idade: number): number {
  const alvo = somarMeses(nascimento, idade * 12);
  const [a1, m1, d1] = hoje.split('-').map(Number);
  const [a2, m2, d2] = alvo.split('-').map(Number);
  return Math.max(0, (a2 - a1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
}

/** Quantos meses até chegar ao valor (null = não chega em 50 anos) */
export function mesesParaChegar(saldo: number, aporteMensal: number, taxaRealAnual: number, alvo: number): number | null {
  if (saldo >= alvo) return 0;
  const r = taxaMensal(taxaRealAnual);
  let v = saldo;
  for (let i = 1; i <= 600; i++) {
    v = v * (1 + r) + aporteMensal;
    if (v >= alvo) return i;
  }
  return null;
}

/** Aporte mensal para chegar ao valor em `meses` (centavos, arredondado para cima) */
export function aporteNecessario(saldo: number, alvo: number, taxaRealAnual: number, meses: number): number {
  if (meses <= 0) return Math.max(0, alvo - saldo);
  const r = taxaMensal(taxaRealAnual);
  const futuroDoSaldo = saldo * Math.pow(1 + r, meses);
  const falta = alvo - futuroDoSaldo;
  if (falta <= 0) return 0;
  const fator = r === 0 ? meses : (Math.pow(1 + r, meses) - 1) / r;
  return Math.ceil(falta / fator);
}

// ---------- Pix (QR Code estático do Banco Central) ----------

export type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

export const NOME_CHAVE: Record<TipoChavePix, string> = { cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', telefone: 'Celular', aleatoria: 'Chave aleatória' };

/** Dígitos verificadores do CPF (pega erro de digitação antes de virar QR Code) */
export function cpfValido(d: string): boolean {
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

export function cnpjValido(d: string): boolean {
  if (!/^\d{14}$/.test(d) || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (n: number) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

/**
 * Confere e padroniza a chave Pix: CPF e CNPJ só números (com dígito conferido),
 * celular +55DDNÚMERO, e-mail minúsculo. Sem `tipo`, descobre pela forma já
 * padronizada (é assim que fica guardada).
 */
export function lerChavePix(chave: string, tipo?: TipoChavePix): { tipo: TipoChavePix; chave: string } | null {
  const t = chave.trim();
  if (!t) return null;
  const digitos = t.replace(/\D/g, '');
  const aleatoria = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) && t.length <= 77;
  const qual = tipo ?? (aleatoria ? 'aleatoria' : email ? 'email' : t.startsWith('+') ? 'telefone' : digitos.length === 14 ? 'cnpj' : 'cpf');
  switch (qual) {
    case 'aleatoria':
      return aleatoria ? { tipo: qual, chave: t.toLowerCase() } : null;
    case 'email':
      return email ? { tipo: qual, chave: t.toLowerCase() } : null;
    case 'cpf':
      return /^[\d.\-\s]+$/.test(t) && cpfValido(digitos) ? { tipo: qual, chave: digitos } : null;
    case 'cnpj':
      return /^[\d./\-\s]+$/.test(t) && cnpjValido(digitos) ? { tipo: qual, chave: digitos } : null;
    case 'telefone': {
      if (!/^[+\d()\s-]+$/.test(t)) return null;
      const d = t.startsWith('+') ? digitos : digitos.length >= 12 && digitos.startsWith('55') ? digitos : `55${digitos}`;
      return /^55\d{10,11}$/.test(d) ? { tipo: qual, chave: `+${d}` } : null;
    }
  }
}

/** CRC16-CCITT (0x1021, início 0xFFFF), como pede o BR Code */
export function crc16(s: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(s)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const campo = (id: string, valor: string) => `${id}${String(valor.length).padStart(2, '0')}${valor}`;
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '');

/** "Pix copia e cola" (e conteúdo do QR Code) de uma chave, com valor opcional */
export function payloadPix({ chave, nome, cidade, valorCentavos, mensagem }: { chave: string; nome: string; cidade: string; valorCentavos?: number | null; mensagem?: string | null }): string {
  const lida = lerChavePix(chave);
  if (!lida) throw new Error('Chave Pix inválida.');
  const msg = mensagem ? semAcento(mensagem).trim().slice(0, 40) : '';
  const conta = campo('00', 'br.gov.bcb.pix') + campo('01', lida.chave) + (msg ? campo('02', msg) : '');
  const corpo =
    campo('00', '01') +
    campo('26', conta) +
    campo('52', '0000') +
    campo('53', '986') +
    (valorCentavos && valorCentavos > 0 ? campo('54', (valorCentavos / 100).toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', semAcento(nome).trim().slice(0, 25) || 'Heitor') +
    campo('60', semAcento(cidade).trim().slice(0, 15) || 'Brasil') +
    campo('62', campo('05', '***')) +
    '6304';
  return corpo + crc16(corpo);
}

/** Chave para mostrar: CPF 000.000.000-00, CNPJ 00.000.000/0000-00, celular (11) 90000-0000 */
export function chaveFormatada(chave: string | null): string {
  if (!chave) return '';
  const l = lerChavePix(chave);
  if (!l) return chave;
  const d = l.chave.replace(/\D/g, '');
  if (l.tipo === 'cpf') return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (l.tipo === 'cnpj') return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (l.tipo === 'telefone') return d.slice(2).replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3');
  return l.chave;
}

// ---------- Atualizações do saldo (abrir o app do banco e anotar) ----------

export interface AtualizacaoSaldo {
  mov: MovimentoCofrinho;
  /** Quanto rendeu desde a atualização anterior (já descontados depósitos e retiradas do período) */
  rendeu: number;
  /** Depósitos − retiradas entre a atualização anterior e esta */
  colocado: number;
  /** Primeira atualização da conta (o "rendeu" conta desde o início) */
  primeira: boolean;
}

/** Cada saldo anotado de uma conta, do mais recente para o mais antigo, com quanto rendeu no período */
export function atualizacoesSaldo(movs: MovimentoCofrinho[]): AtualizacaoSaldo[] {
  const lista = [...movs].sort((a, b) => a.data.localeCompare(b.data) || ordemTipo[a.tipo] - ordemTipo[b.tipo]);
  const saida: AtualizacaoSaldo[] = [];
  let saldo = 0;
  let colocado = 0;
  let primeira = true;
  for (const m of lista) {
    if (m.tipo === 'deposito') {
      saldo += m.valor_centavos;
      colocado += m.valor_centavos;
    } else if (m.tipo === 'retirada') {
      saldo -= m.valor_centavos;
      colocado -= m.valor_centavos;
    } else {
      saida.push({ mov: m, rendeu: m.valor_centavos - saldo, colocado, primeira });
      saldo = m.valor_centavos;
      colocado = 0;
      primeira = false;
    }
  }
  return saida.reverse();
}

/** A atualização de saldo mais recente entre as contas (null = nunca anotaram) */
export function ultimaAtualizacao(movs: MovimentoCofrinho[]): MovimentoCofrinho | null {
  return movs.filter((m) => m.tipo === 'saldo').sort((a, b) => b.data.localeCompare(a.data))[0] ?? null;
}
