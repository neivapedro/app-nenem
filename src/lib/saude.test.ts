import { describe, expect, it } from 'vitest';
import { avaliarTemperatura } from './conteudo';
import { idFixo } from './ids';
import { intervaloMedioAlimentacao, ultimosDias } from './padroes';
import { alimentosProvados, emEstoque, proximaDose, situacaoPote, validadeLeite } from './saude';
import type { PoteLeite, Registro, Remedio } from './tipos';

const base = { familia_id: 'f', bebe_id: 'b', criado_por: 'u', observacao: null };
const t = (s: string) => new Date(`${s}:00-03:00`).toISOString();

describe('saúde', () => {
  it('próxima dose pelo intervalo a partir da última dose', () => {
    const r: Remedio = { id: 'r', familia_id: 'f', bebe_id: 'b', criado_por: 'u', nome: 'Antitérmico', dose: '5 gotas', intervalo_h: 6, ativo: true, observacao: null };
    const doses: Registro[] = [
      { ...base, id: '1', tipo: 'remedio', inicio: t('2026-12-01T08:00'), fim: null, dados: { remedio_id: 'r', nome: 'Antitérmico', dose: null } },
      { ...base, id: '2', tipo: 'remedio', inicio: t('2026-12-01T14:10'), fim: null, dados: { remedio_id: 'r', nome: 'Antitérmico', dose: null } },
    ];
    expect(proximaDose(r, doses)).toBe(t('2026-12-01T20:10'));
    expect(proximaDose({ ...r, intervalo_h: null }, doses)).toBeNull();
  });

  it('leite: 12 h na geladeira, 15 dias no freezer, o que vence antes primeiro', () => {
    const pote = (id: string, local: PoteLeite['local'], extraido: string): PoteLeite => ({ id, familia_id: 'f', criado_por: 'u', extraido_em: t(extraido), ml: 80, local, usado_em: null, descartado_em: null, observacao: null });
    const g = pote('g', 'geladeira', '2026-12-01T08:00');
    const f = pote('f', 'freezer', '2026-11-20T08:00');
    expect(validadeLeite(g)).toBe(t('2026-12-01T20:00'));
    expect(validadeLeite(f)).toBe(t('2026-12-05T08:00'));
    expect(emEstoque([f, g, { ...g, id: 'usado', usado_em: 'x' }]).map((p) => p.id)).toEqual(['g', 'f']);
    expect(situacaoPote(g, new Date(t('2026-12-01T18:00')))).toBe('vence-logo');
    expect(situacaoPote(g, new Date(t('2026-12-01T21:00')))).toBe('vencido');
  });

  it('febre: 37,5 °C pela SBP; bebê com menos de 3 meses é urgente', () => {
    expect(avaliarTemperatura(37.4, 30).nivel).toBe('normal');
    expect(avaliarTemperatura(37.5, 120).nivel).toBe('febre');
    expect(avaliarTemperatura(37.6, 40).nivel).toBe('urgente');
    expect(avaliarTemperatura(35.2, 200).nivel).toBe('urgente');
  });

  it('alimentos já oferecidos, sem repetir por maiúsculas, com reação marcada', () => {
    const refeicoes: Registro[] = [
      { ...base, id: 'a', tipo: 'refeicao', inicio: t('2027-05-20T12:00'), fim: null, dados: { alimentos: ['Abóbora', 'Ovo'], aceitacao: 'bem', reacao: null } },
      { ...base, id: 'b', tipo: 'refeicao', inicio: t('2027-05-21T12:00'), fim: null, dados: { alimentos: ['abóbora'], aceitacao: 'recusou', reacao: 'manchas' } },
    ];
    expect(alimentosProvados(refeicoes)).toEqual([
      { nome: 'Abóbora', primeira: t('2027-05-20T12:00'), vezes: 2, reacao: true, recusas: 1 },
      { nome: 'Ovo', primeira: t('2027-05-20T12:00'), vezes: 1, reacao: false, recusas: 0 },
    ]);
  });

  it('id fixo: mesmo texto, mesmo uuid válido', () => {
    const a = idFixo('bebe:vacina:bcg');
    expect(a).toBe(idFixo('bebe:vacina:bcg'));
    expect(a).not.toBe(idFixo('bebe:vacina:hepb'));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('padrões: dias seguidos e intervalo médio ignorando lacunas grandes', () => {
    const mam = (id: string, s: string): Registro => ({ ...base, id, tipo: 'mamadeira', inicio: t(s), fim: t(s), dados: { ml: 60, conteudo: 'formula' } });
    const lista = [mam('1', '2026-12-01T08:00'), mam('2', '2026-12-01T11:00'), mam('3', '2026-12-01T14:00'), mam('4', '2026-12-02T08:00')];
    expect(intervaloMedioAlimentacao(lista, new Date(t('2026-12-01T00:00')), new Date(t('2026-12-03T00:00')))).toBe(3 * 3_600_000);
    const dias = ultimosDias(lista, '2026-12-02', 3, new Date(t('2026-12-02T20:00')));
    expect(dias.map((d) => [d.dia, d.alimentacoes, d.ml])).toEqual([
      ['2026-11-30', 0, 0],
      ['2026-12-01', 3, 180],
      ['2026-12-02', 1, 60],
    ]);
  });
});
