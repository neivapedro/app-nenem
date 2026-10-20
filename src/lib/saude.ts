// Regras de remédios, estoque de leite e introdução alimentar.
import { VALIDADE_LEITE_HORAS } from './conteudo';
import { chaveDia, somarDiasLocal } from './datas';
import type { PoteLeite, Registro, RegistroDe, Remedio } from './tipos';

const ms = (iso: string) => new Date(iso).getTime();

/** Última dose dada de um remédio */
export function ultimaDose(registros: Registro[], remedioId: string): RegistroDe<'remedio'> | null {
  let ultima: RegistroDe<'remedio'> | null = null;
  for (const r of registros) {
    if (r.tipo !== 'remedio' || r.dados.remedio_id !== remedioId) continue;
    if (!ultima || ms(r.inicio) > ms(ultima.inicio)) ultima = r;
  }
  return ultima;
}

/**
 * Próxima dose (ISO) pelo intervalo; null se for "quando precisar", nunca foi dado
 * ou se ela cairia depois do último dia do tratamento.
 */
export function proximaDose(remedio: Remedio, registros: Registro[]): string | null {
  if (!remedio.intervalo_h) return null;
  const u = ultimaDose(registros, remedio.id);
  if (!u) return null;
  const proxima = new Date(ms(u.inicio) + remedio.intervalo_h * 3_600_000).toISOString();
  return remedio.termina_em && chaveDia(proxima) > remedio.termina_em ? null : proxima;
}

/** Tratamento com prazo que já acabou (o último dia foi antes de hoje) */
export function prazoAcabou(remedio: Remedio, hoje: string): boolean {
  return !!remedio.termina_em && remedio.termina_em < hoje;
}

/** Remédio em uso: ativo e dentro do prazo (se tiver) */
export function remedioEmUso(remedio: Remedio, hoje: string): boolean {
  return remedio.ativo && !prazoAcabou(remedio, hoje);
}

/** Último dia (AAAA-MM-DD) de um tratamento de `dias` dias que começa em `inicio` (o 1º dia conta) */
export function ultimoDiaTratamento(inicio: string, dias: number): string {
  return somarDiasLocal(inicio, Math.max(1, Math.round(dias)) - 1);
}

/**
 * Dose em dobro? A última dose deste remédio, se foi há menos da metade do intervalo
 * (sem intervalo: há menos de 30 min). null = pode registrar sem perguntar.
 */
export function doseRecente(remedio: Remedio, registros: Registro[], agora: Date): RegistroDe<'remedio'> | null {
  const u = ultimaDose(registros, remedio.id);
  if (!u) return null;
  const limite = remedio.intervalo_h ? (remedio.intervalo_h * 3_600_000) / 2 : 30 * 60_000;
  const passou = agora.getTime() - ms(u.inicio);
  return passou >= 0 && passou < limite ? u : null;
}

/**
 * Validade do pote: 12 h na geladeira, 15 dias no freezer (Ministério da Saúde).
 * Descongelado (saiu do freezer para a geladeira): 12 h a partir do descongelamento.
 */
export function validadeLeite(p: PoteLeite): string {
  if (p.local === 'geladeira' && p.descongelado_em) return new Date(ms(p.descongelado_em) + VALIDADE_LEITE_HORAS.geladeira * 3_600_000).toISOString();
  return new Date(ms(p.extraido_em) + VALIDADE_LEITE_HORAS[p.local] * 3_600_000).toISOString();
}

export function emEstoque(potes: PoteLeite[]): PoteLeite[] {
  return potes.filter((p) => !p.usado_em && !p.descartado_em).sort((a, b) => ms(validadeLeite(a)) - ms(validadeLeite(b)));
}

export function situacaoPote(p: PoteLeite, agora: Date): 'vencido' | 'vence-logo' | 'ok' {
  const resta = ms(validadeLeite(p)) - agora.getTime();
  if (resta <= 0) return 'vencido';
  if (resta <= (p.local === 'geladeira' ? 3 : 48) * 3_600_000) return 'vence-logo';
  return 'ok';
}

export interface AlimentoProvado {
  nome: string;
  primeira: string;
  vezes: number;
  reacao: boolean;
  recusas: number;
}

/** Alimentos já oferecidos na introdução alimentar (o nome sem diferença de maiúsculas) */
export function alimentosProvados(registros: Registro[]): AlimentoProvado[] {
  const mapa = new Map<string, AlimentoProvado>();
  const refeicoes = registros.filter((r): r is RegistroDe<'refeicao'> => r.tipo === 'refeicao').sort((a, b) => ms(a.inicio) - ms(b.inicio));
  for (const r of refeicoes) {
    for (const bruto of r.dados.alimentos) {
      const nome = bruto.trim();
      if (!nome) continue;
      const chave = nome.toLocaleLowerCase('pt-BR');
      const a = mapa.get(chave) ?? { nome, primeira: r.inicio, vezes: 0, reacao: false, recusas: 0 };
      a.vezes++;
      if (r.dados.reacao) a.reacao = true;
      if (r.dados.aceitacao === 'recusou') a.recusas++;
      mapa.set(chave, a);
    }
  }
  return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
