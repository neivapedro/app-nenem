import { describe, expect, it } from 'vitest';
import {
  aporteNecessario,
  chaveFormatada,
  cpfValido,
  crc16,
  depositosPorMes,
  evolucaoMensal,
  exclusaoDeConta,
  lerChavePix,
  lerReais,
  mesesAteIdade,
  mesesParaChegar,
  mesesSeguidos,
  montarTransferencia,
  outraPonta,
  payloadPix,
  pontasTransferencia,
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

describe('transferência entre contas', () => {
  const c1 = conta('poup');
  const c2 = conta('cdb');
  const t = montarTransferencia({ transferenciaId: 'T1', idOrigem: 'tA', idDestino: 'tB', familiaId: 'f', criadoPor: null, contaOrigem: 'poup', contaDestino: 'cdb', data: '2027-01-12', valor: 30000 });
  const base = [
    mov('poup', 'deposito', '2026-12-20', 1000, 'Pedro'),
    mov('poup', 'deposito', '2027-01-05', 200, 'Vovó'),
    mov('cdb', 'deposito', '2027-01-10', 100, 'Padrinho'),
  ];
  const movs = [...base, t.origem, t.destino];

  it('monta as duas pontas: retirada na origem, depósito no destino, mesmo id', () => {
    expect(t.origem).toMatchObject({ id: 'tA', conta_id: 'poup', tipo: 'retirada', valor_centavos: 30000, transferencia_id: 'T1', de: null });
    expect(t.destino).toMatchObject({ id: 'tB', conta_id: 'cdb', tipo: 'deposito', valor_centavos: 30000, transferencia_id: 'T1', de: null });
    expect(pontasTransferencia(movs, 'T1')).toEqual({ origem: t.origem, destino: t.destino });
    expect(outraPonta(movs, t.destino)?.id).toBe('tA');
    expect(outraPonta(movs, base[0])).toBeUndefined();
  });

  it('muda o saldo de cada conta, mas o total colocado e o saldo total ficam iguais', () => {
    const sem = resumo([c1, c2], base);
    const com = resumo([c1, c2], movs);
    expect(com.porConta.get('poup')).toEqual({ saldo: 90000, aportado: 90000, ultimoExtrato: null });
    expect(com.porConta.get('cdb')).toEqual({ saldo: 40000, aportado: 40000, ultimoExtrato: null });
    expect(com.saldo).toBe(sem.saldo);
    expect(com.aportado).toBe(sem.aportado);
    expect(com.aportado).toBe(130000);
    expect(com.rendimento).toBe(0);
    // não conta como depósito
    expect(com.depositos).toBe(3);
    // evolução: o colocado do mês não muda com a transferência
    expect(evolucaoMensal([c1, c2], movs, '2027-01-31')).toEqual(evolucaoMensal([c1, c2], base, '2027-01-31'));
  });

  it('rendimento por conta continua certo com saldo do extrato depois da transferência', () => {
    const extratos = [...movs, mov('poup', 'saldo', '2027-01-31', 905), mov('cdb', 'saldo', '2027-01-31', 402)];
    const r = resumo([c1, c2], extratos);
    // poupança: 1.200 − 300 = 900 colocados, 905 no banco → rendeu 5; CDB: 100 + 300 = 400, 402 no banco → rendeu 2
    expect(r.porConta.get('poup')!.saldo - r.porConta.get('poup')!.aportado).toBe(500);
    expect(r.porConta.get('cdb')!.saldo - r.porConta.get('cdb')!.aportado).toBe(200);
    expect(r.rendimento).toBe(700);
    expect(r.aportado).toBe(130000);
    const cdb = atualizacoesSaldo(extratos.filter((m) => m.conta_id === 'cdb'));
    expect(cdb[0]).toMatchObject({ rendeu: 200, colocado: 40000 });
  });

  it('não entra em quem contribuiu, depósitos por mês nem meses seguidos', () => {
    const quem = porQuem(movs);
    expect(quem.map((q) => q.de)).toEqual(['Pedro', 'Vovó', 'Padrinho']);
    expect(quem.some((q) => q.de === 'Sem nome')).toBe(false);
    expect(depositosPorMes(movs, '2027-01-31', 1)).toEqual([{ mes: '2027-01', centavos: 30000 }]);
    // só transferência no mês não conta como mês com depósito
    const soTransf = [mov('poup', 'deposito', '2026-12-01', 10), { ...t.destino, data: '2027-01-02' }];
    expect(mesesSeguidos(soTransf, '2027-01-20')).toBe(1);
    expect(mesesSeguidos(soTransf, '2027-02-20')).toBe(0);
  });

  it('excluir a conta: lançamentos dela saem e a outra ponta vira lançamento comum', () => {
    const comComprovante = { ...base[0], comprovante: { caminho: 'f/a.jpg', nome: 'Comprovante.jpg', tipo: 'image/jpeg', tamanho: 1 } } as MovimentoCofrinho;
    const lista = [comComprovante, ...base.slice(1), t.origem, t.destino];
    const x = exclusaoDeConta(lista, { id: 'poup', nome: 'Poupança' });
    expect(x.excluir.map((m) => m.id).sort()).toEqual([base[0].id, base[1].id, 'tA'].sort());
    expect(x.caminhos).toEqual(['f/a.jpg']);
    expect(x.soltar).toEqual([{ ...t.destino, transferencia_id: null, observacao: 'Transferência de Poupança (conta excluída)' }]);
    // o saldo do CDB não muda, e o dinheiro que veio da conta excluída passa a contar como colocado
    const depois = [...lista.filter((m) => !x.excluir.includes(m) && m.id !== 'tB'), ...x.soltar];
    expect(resumo([c2], depois).porConta.get('cdb')!.saldo).toBe(40000);
    expect(resumo([c2], depois).depositos).toBe(2);
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

import { idDoSaldo, saldosDoDiaAjustados, SEM_NOME } from './cofrinho';
import { idFixo } from './ids';

describe('correções do cofrinho', () => {
  it('compacto não mostra "1.000 mil" e vírgula com 3 casas não é valor', () => {
    expect(reais(99995000, { compacto: true })).toBe('R$ 1 mi');
    expect(reais(99940000, { compacto: true })).toBe('R$ 999 mil');
    expect(reais(-99995000, { compacto: true })).toBe('R$ -1 mi');
    expect(lerReais('12,345')).toBeNull();
    expect(lerReais('1,234')).toBeNull();
    expect(lerReais('1,234.56')).toBe(123456);
    expect(lerReais('12,34')).toBe(1234);
    expect(lerReais('0,00')).toBe(0);
    expect(lerReais('-50,00')).toBeNull();
  });

  it('dois saldos no mesmo dia: o resultado não depende da ordem da lista', () => {
    const a = { ...mov('k', 'saldo', '2027-03-01', 100), id: 'a' };
    const b = { ...mov('k', 'saldo', '2027-03-01', 200), id: 'b' };
    expect(saldoConta([a, b]).saldo).toBe(saldoConta([b, a]).saldo);
    expect(atualizacoesSaldo([a, b])[0].mov.id).toBe(atualizacoesSaldo([b, a])[0].mov.id);
  });

  it('id do saldo: um por conta e dia', () => {
    const fixo = idFixo('k:saldo:2027-03-01');
    expect(idDoSaldo([], 'k', '2027-03-01')).toBe(fixo);
    const ja = { ...mov('k', 'saldo', '2027-03-01', 100), id: 'existente' };
    expect(idDoSaldo([ja], 'k', '2027-03-01')).toBe('existente');
    // outra conta ou outro dia não conta
    expect(idDoSaldo([ja], 'outra', '2027-03-01')).toBe(idFixo('outra:saldo:2027-03-01'));
    // o id fixo já está num saldo que mudou de data: usa um id novo
    const movido = { ...mov('k', 'saldo', '2027-03-05', 100), id: fixo };
    expect(idDoSaldo([movido], 'k', '2027-03-01', () => 'novo')).toBe('novo');
  });

  it('depósito depois do saldo anotado no mesmo dia: ajustar o saldo faz o depósito entrar', () => {
    const ms = [mov('j', 'deposito', '2027-04-01', 1234.56), mov('j', 'saldo', '2027-04-01', 1240)];
    const dep = mov('j', 'deposito', '2027-04-01', 100);
    // sem ajuste (o caso do bug): o saldo anotado engole o depósito
    expect(saldoConta([...ms, dep]).saldo).toBe(124000);
    const ajustados = saldosDoDiaAjustados(ms, 'j', '2027-04-01', 10000);
    expect(ajustados).toHaveLength(1);
    expect(ajustados[0].id).toBe(ms[1].id);
    const depois = [ms[0], ajustados[0], dep];
    expect(saldoConta(depois).saldo).toBe(134000);
    const at = atualizacoesSaldo(depois);
    // rendeu = 1.340 − (1.234,56 + 100) = 5,44 (e não −94,56)
    expect(at[0].rendeu).toBe(544);
    // retirada maior que o saldo não deixa o saldo anotado negativo
    expect(saldosDoDiaAjustados(ms, 'j', '2027-04-01', -999_999_00)[0].valor_centavos).toBe(0);
    expect(saldosDoDiaAjustados(ms, 'j', '2027-04-02', 100)).toEqual([]);
  });

  it('depósito sem nome não vira pessoa', () => {
    const q = porQuem([mov('x', 'deposito', '2027-01-01', 10, null), mov('x', 'deposito', '2027-01-02', 10, 'Vovó')]);
    expect(q.filter((p) => p.de !== SEM_NOME)).toHaveLength(1);
  });

  it('Pix com e-mail longo continua válido (campo 26 até 99) e e-mail com acento é recusado', () => {
    const email = `${'a'.repeat(60)}@exemplo.com.br`;
    expect(lerChavePix(email, 'email')?.chave).toBe(email);
    const p = payloadPix({ chave: email, nome: 'Heitor', cidade: 'Jundiai', mensagem: 'Cofrinho do Heitor' });
    const tam = Number(p.slice(p.indexOf('26') + 2, p.indexOf('26') + 4));
    expect(p.startsWith('000201' + '26')).toBe(true);
    expect(tam).toBeLessThanOrEqual(99);
    expect(p.slice(10, 10 + tam)).toBe(`0014br.gov.bcb.pix01${String(email.length).padStart(2, '0')}${email}`);
    expect(p.slice(10 + tam, 14 + tam)).toBe('5204');
    expect(p).not.toContain('Cofrinho do Heitor');
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
    // e-mail no limite (77): ainda cabe
    const max = `${'b'.repeat(65)}@exemplo.com`;
    expect(max.length).toBe(77);
    expect(payloadPix({ chave: max, nome: 'Heitor', cidade: 'Jundiai' })).toContain('2699');
    // chave curta mantém a mensagem
    expect(payloadPix({ chave: 'a@b.co', nome: 'Heitor', cidade: 'Jundiai', mensagem: 'Cofrinho do Heitor' })).toContain('0218Cofrinho do Heitor');
    expect(lerChavePix('joão@exemplo.com', 'email')).toBeNull();
    expect(lerChavePix('joao@exémplo.com')).toBeNull();
  });
});

// Abre os fluxos (deflate) do PDF e devolve cada texto desenhado
async function textosDoPdf(bytes: Uint8Array): Promise<string[]> {
  const latin1 = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join('');
  const bin = latin1(bytes);
  const textos: string[] = [];
  for (const m of bin.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let t = '';
    try {
      const fluxo = new Blob([Uint8Array.from(m[1], (c) => c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('deflate'));
      t = latin1(new Uint8Array(await new Response(fluxo).arrayBuffer()));
    } catch {
      continue;
    }
    for (const h of t.matchAll(/<([0-9A-F]+)> Tj/g)) textos.push(latin1(Uint8Array.from(h[1].match(/../g)!, (x) => parseInt(x, 16))));
  }
  return textos;
}

describe('extrato em PDF: textos', () => {
  it('tira emoji (não vira "??") e mantém as quebras de linha do recado', async () => {
    const bytes = await montarExtratoCofrinho({ titulo: 'T', geradoEm: 'g', resumo: [], contas: [], quem: [], movimentos: [], recados: [['01/01/2027', 'Vovó 🕊️', 'Linha um\nLinha dois 💛']] });
    const textos = await textosDoPdf(bytes);
    expect(textos).toContain('"Linha um');
    expect(textos).toContain('Linha dois"');
    expect(textos.some((t) => t.startsWith('Vov') && t.endsWith('01/01/2027'))).toBe(true);
    expect(textos.join('')).not.toContain('?');
  });
});
