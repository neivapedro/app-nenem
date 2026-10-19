import { describe, expect, it } from 'vitest';
import {
  aporteNecessario,
  chaveFormatada,
  cpfValido,
  crc16,
  depositosPorMes,
  evolucaoMensal,
  lerChavePix,
  lerReais,
  mesesAteIdade,
  mesesParaChegar,
  mesesSeguidos,
  payloadPix,
  porQuem,
  projetar,
  reais,
  resumo,
  saldoConta,
} from './cofrinho';
import type { ContaCofrinho, MovimentoCofrinho } from './tipos';

const conta = (id: string): ContaCofrinho => ({ id, familia_id: 'f', bebe_id: 'b', criado_por: null, nome: id, tipo: 'poupanca', instituicao: null, agencia: null, numero: null, titular: null, chave_pix: null, cidade: null, rendimento: null, ativa: true, observacao: null });
let n = 0;
const mov = (conta_id: string, tipo: MovimentoCofrinho['tipo'], data: string, reaisV: number, de: string | null = null): MovimentoCofrinho => ({
  id: String(n++),
  familia_id: 'f',
  criado_por: null,
  conta_id,
  tipo,
  data,
  valor_centavos: Math.round(reaisV * 100),
  de,
  ocasiao: null,
  recado: null,
  observacao: null,
  comprovante: null,
});

describe('dinheiro', () => {
  it('formata e lê valores em reais', () => {
    expect(reais(123456)).toBe('R$ 1.234,56');
    expect(reais(5000, { sinal: true })).toBe('+R$ 50,00');
    expect(reais(1234500, { compacto: true })).toBe('R$ 12,3 mil');
    expect(reais(250000000, { compacto: true })).toBe('R$ 2,5 mi');
    expect(lerReais('1.234,56')).toBe(123456);
    expect(lerReais('R$ 50')).toBe(5000);
    expect(lerReais('50,5')).toBe(5050);
    expect(lerReais('1.000')).toBe(100000);
    expect(lerReais('1234.56')).toBe(123456);
    expect(lerReais('abc')).toBeNull();
    expect(lerReais('')).toBeNull();
  });
});

describe('saldo e rendimento', () => {
  const c1 = conta('poup');
  const c2 = conta('cdb');
  const movs = [
    mov('poup', 'deposito', '2026-11-20', 200, 'Pedro'),
    mov('poup', 'deposito', '2026-12-20', 200, 'Karoline'),
    mov('poup', 'deposito', '2026-12-25', 500, 'Vovó'),
    // extrato de 31/12 já com rendimento
    mov('poup', 'saldo', '2026-12-31', 905),
    mov('poup', 'deposito', '2027-01-20', 200, 'pedro'),
    mov('cdb', 'deposito', '2027-01-10', 1000, 'Padrinho'),
    mov('cdb', 'retirada', '2027-01-15', 100),
  ];
  it('extrato substitui o saldo somado; depósitos depois somam', () => {
    expect(saldoConta(movs.filter((m) => m.conta_id === 'poup'))).toEqual({ saldo: 110500, aportado: 110000, ultimoExtrato: '2026-12-31' });
    // extrato e depósito no mesmo dia: o extrato já inclui o depósito
    const mesmoDia = [mov('x', 'saldo', '2027-02-01', 100), mov('x', 'deposito', '2027-02-01', 50)];
    expect(saldoConta(mesmoDia).saldo).toBe(10000);
    const r = resumo([c1, c2], movs);
    expect(r.saldo).toBe(110500 + 90000);
    expect(r.aportado).toBe(110000 + 90000);
    expect(r.rendimento).toBe(500);
    expect(r.depositos).toBe(5);
    expect(r.primeiro).toBe('2026-11-20');
  });

  it('evolução mês a mês, depósitos por mês, quem contribuiu e sequência', () => {
    const ev = evolucaoMensal([c1, c2], movs, '2027-01-25');
    expect(ev.map((e) => e.mes)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(ev[1]).toEqual({ mes: '2026-12', aportado: 90000, saldo: 90500 });
    expect(depositosPorMes(movs, '2027-01-25', 3)).toEqual([
      { mes: '2026-11', centavos: 20000 },
      { mes: '2026-12', centavos: 70000 },
      { mes: '2027-01', centavos: 120000 },
    ]);
    const quem = porQuem(movs);
    expect(quem[0]).toEqual({ de: 'Padrinho', centavos: 100000, vezes: 1 });
    // "Pedro" e "pedro" são a mesma pessoa
    expect(quem.find((q) => q.de === 'Pedro')).toEqual({ de: 'Pedro', centavos: 40000, vezes: 2 });
    expect(mesesSeguidos(movs, '2027-01-25')).toBe(3);
    // mês novo ainda sem depósito não quebra a sequência
    expect(mesesSeguidos(movs, '2027-02-03')).toBe(3);
    expect(mesesSeguidos(movs, '2027-03-03')).toBe(0);
  });
});

describe('projeção', () => {
  it('juros compostos mensais em dinheiro de hoje', () => {
    expect(projetar(10000, 0, 0, 12).at(-1)).toBe(10000);
    expect(projetar(0, 100, 0, 12).at(-1)).toBe(1200);
    // 12% ao ano = 1 ano depois, 1,12 × o saldo
    expect(projetar(100000, 0, 12, 12).at(-1)).toBeCloseTo(112000, 0);
    // R$ 200/mês por 18 anos a 4% real ≈ R$ 63 mil
    const v = projetar(0, 20000, 4, 216).at(-1)!;
    expect(v / 100).toBeGreaterThan(62000);
    expect(v / 100).toBeLessThan(64500);
    expect(mesesAteIdade('2026-11-15', '2026-11-15', 18)).toBe(216);
    expect(mesesAteIdade('2026-11-15', '2027-01-20', 18)).toBe(213);
    expect(mesesParaChegar(0, 10000, 0, 50000)).toBe(5);
    expect(mesesParaChegar(0, 0, 0, 50000)).toBeNull();
    const ap = aporteNecessario(0, 100_000_00, 4, 216);
    expect(projetar(0, ap, 4, 216).at(-1)!).toBeGreaterThanOrEqual(100_000_00);
    expect(projetar(0, ap - 1, 4, 216).at(-1)!).toBeLessThan(100_000_00);
  });
});

describe('Pix', () => {
  it('reproduz o exemplo do manual do BR Code (Banco Central)', () => {
    const p = payloadPix({ chave: '123e4567-e12b-12d1-a456-426655440000', nome: 'Fulano de Tal', cidade: 'BRASILIA' });
    expect(p).toBe('00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D');
    expect(crc16('123456789')).toBe('29B1');
  });

  it('valor, acentos e chaves', () => {
    const p = payloadPix({ chave: '+5511999998888', nome: 'Heitor Ribeiro Neiva da Silva Junior', cidade: 'São José dos Campos', valorCentavos: 5000 });
    expect(p).toContain('5405' + '50.00');
    expect(p).toContain('5925Heitor Ribeiro Neiva da S');
    expect(p).toContain('6015Sao Jose dos Ca');
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
    expect(cpfValido('52998224725')).toBe(true);
    expect(cpfValido('52998224724')).toBe(false);
    expect(lerChavePix('529.982.247-25', 'cpf')).toEqual({ tipo: 'cpf', chave: '52998224725' });
    expect(lerChavePix('529.982.247-24', 'cpf')).toBeNull();
    expect(lerChavePix('(11) 99999-8888', 'telefone')).toEqual({ tipo: 'telefone', chave: '+5511999998888' });
    expect(lerChavePix('Pedro@Exemplo.com', 'email')).toEqual({ tipo: 'email', chave: 'pedro@exemplo.com' });
    expect(lerChavePix('11.222.333/0001-81', 'cnpj')).toEqual({ tipo: 'cnpj', chave: '11222333000181' });
    // guardada já padronizada: descobre o tipo sozinha
    expect(lerChavePix('+5511999998888')?.tipo).toBe('telefone');
    expect(lerChavePix('52998224725')?.tipo).toBe('cpf');
    expect(() => payloadPix({ chave: 'xyz', nome: 'a', cidade: 'b' })).toThrow();
    expect(chaveFormatada('52998224725')).toBe('529.982.247-25');
    expect(chaveFormatada('+5511999998888')).toBe('(11) 99999-8888');
  });
});

import { eventosCofrinho } from '../../supabase/functions/_shared/ics.ts';
import { avisoCofrinho, avisoSaldoCofrinho, type MembroAviso } from '../../supabase/functions/_shared/lembretes.ts';
import { PDFDocument } from 'pdf-lib';
import { montarExtratoCofrinho } from './pdf-documentos';

describe('lembrete, calendário e extrato do cofrinho', () => {
  const m: MembroAviso = { user_id: 'u', fuso_horario: 'America/Sao_Paulo', lembrete_mamada: false, lembrete_mamada_min: 180, lembrete_agenda: true };
  const c = { familiaId: 'f', nomeBebe: 'Heitor', diaAporte: 10, aporteCentavos: 20000, depositouNoMes: false };
  it('avisa às 9h do dia, só se ainda não depositaram', () => {
    const a = avisoCofrinho(m, c, new Date('2027-02-10T09:30:00-03:00'), 'https://x/');
    expect(a?.titulo).toBe('🐷 Dia do cofrinho do Heitor');
    expect(a?.corpo).toBe('Depósito do mês: R$ 200,00. Toque para registrar.');
    expect(a?.chave).toBe('cofrinho:f:2027-02:u');
    expect(avisoCofrinho(m, c, new Date('2027-02-10T08:30:00-03:00'), 'https://x/')).toBeNull();
    expect(avisoCofrinho(m, c, new Date('2027-02-11T09:30:00-03:00'), 'https://x/')).toBeNull();
    expect(avisoCofrinho(m, { ...c, depositouNoMes: true }, new Date('2027-02-10T09:30:00-03:00'), 'https://x/')).toBeNull();
    expect(avisoCofrinho({ ...m, lembrete_cofrinho: false }, c, new Date('2027-02-10T09:30:00-03:00'), 'https://x/')).toBeNull();
  });
  it('dia 1: lembra de anotar o saldo se faz mais de 20 dias', () => {
    const dia1 = new Date('2027-03-01T09:10:00-03:00');
    const a = avisoSaldoCofrinho(m, { ...c, temConta: true, ultimoSaldo: '2027-02-01' }, dia1, 'https://x/');
    expect(a?.url).toBe('https://x/cofrinho?atualizar=1');
    expect(avisoSaldoCofrinho(m, { ...c, temConta: true, ultimoSaldo: '2027-02-20' }, dia1, 'https://x/')).toBeNull();
    expect(avisoSaldoCofrinho(m, { ...c, temConta: false }, dia1, 'https://x/')).toBeNull();
    expect(avisoSaldoCofrinho(m, { ...c, temConta: true, ultimoSaldo: null }, new Date('2027-03-02T09:10:00-03:00'), 'https://x/')).toBeNull();
  });
  it('eventos dos próximos 12 meses', () => {
    const ev = eventosCofrinho('f', 'Heitor', 10, 20000, false, '2027-02-15');
    expect(ev[0].inicio).toBe('2027-03-10'); // dia 10 de fevereiro já passou
    expect(ev).toHaveLength(11);
    expect(eventosCofrinho('f', 'Heitor', 10, 0, false, '2027-02-05')[0].inicio).toBe('2027-02-10');
    expect(eventosCofrinho('f', 'Heitor', null, 0, false, '2027-02-05')).toEqual([]);
  });
  it('extrato em PDF', async () => {
    const bytes = await montarExtratoCofrinho({
      titulo: 'Cofrinho do Heitor',
      geradoEm: 'agora',
      resumo: [['Saldo total', 'R$ 1.105,00']],
      contas: [['Poupança', 'Poupança · Caixa', 'R$ 1.105,00']],
      quem: [['Vovó', '1×', 'R$ 500,00']],
      movimentos: Array.from({ length: 80 }, (_, i) => ['01/01/2027', 'Depósito', 'Poupança', `Pessoa ${i}`, 'R$ 10,00'] as [string, string, string, string, string]),
      recados: [['25/12/2026', 'Vovó', 'Para o seu futuro, com amor 💛']],
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(2);
  });
});

import { atualizacoesSaldo, ultimaAtualizacao } from './cofrinho';

describe('atualizar o saldo pela caixinha', () => {
  it('cada saldo anotado mostra quanto rendeu no período, sem contar os depósitos', () => {
    const ms = [
      mov('c', 'deposito', '2027-01-10', 200),
      mov('c', 'saldo', '2027-01-31', 201.5),
      mov('c', 'deposito', '2027-02-10', 200),
      mov('c', 'retirada', '2027-02-15', 50),
      mov('c', 'saldo', '2027-02-28', 355),
    ];
    const a = atualizacoesSaldo(ms);
    expect(a.map((x) => [x.mov.data, x.rendeu, x.colocado, x.primeira])).toEqual([
      ['2027-02-28', 355_00 - (201_50 + 150_00), 150_00, false],
      ['2027-01-31', 150, 200_00, true],
    ]);
    expect(ultimaAtualizacao(ms)?.data).toBe('2027-02-28');
    expect(ultimaAtualizacao([mov('c', 'deposito', '2027-01-10', 1)])).toBeNull();
  });
});
