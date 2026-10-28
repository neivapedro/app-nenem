import { describe, expect, it } from 'vitest';
import {
  contarRegistros,
  crescimentoNoPeriodo,
  lembrancaDoDia,
  mesesCompletos,
  mesversarioHoje,
  resumoDoMes,
  textoGanhoPeso,
  textoHaQuanto,
  textoMeses,
  textoPeso,
  tituloComemoracao,
} from './momentos';
import type { Bebe, Marco, Medida, Registro } from './tipos';

// Meio-dia no fuso do aparelho (os testes rodam em qualquer fuso)
const nasc = (dia: string) => new Date(`${dia}T12:00:00`).toISOString();

const bebe = (nascimento: string | null, extra: Partial<Bebe> = {}): Bebe => ({
  id: 'b1',
  familia_id: 'f1',
  nome: 'Heitor',
  sexo: 'M',
  data_prevista: null,
  nascimento: nascimento ? nasc(nascimento) : null,
  peso_nascer_g: 3350,
  altura_nascer_cm: 49.5,
  pc_nascer_cm: 34,
  calendario_vacinal: 'pni',
  ...extra,
});

const marco = (o: Partial<Marco>): Marco => ({
  id: crypto.randomUUID(),
  familia_id: 'f1',
  bebe_id: 'b1',
  criado_por: null,
  tipo: 'primeira-vez',
  marco_id: null,
  titulo: null,
  data: null,
  observacao: null,
  foto: null,
  ...o,
});

const medida = (data: string, peso_g: number | null, comprimento_cm: number | null = null): Medida => ({ id: data, familia_id: 'f1', bebe_id: 'b1', criado_por: null, data, peso_g, comprimento_cm, pc_cm: null, observacao: null });

const reg = (tipo: Registro['tipo'], inicio: string, fim: string | null = inicio, observacao: string | null = null): Registro =>
  ({ id: `${tipo}-${inicio}`, familia_id: 'f1', bebe_id: 'b1', criado_por: null, tipo, inicio: new Date(inicio).toISOString(), fim: fim ? new Date(fim).toISOString() : null, observacao, dados: tipo === 'fralda' ? { xixi: true, coco: false } : tipo === 'mamadeira' ? { ml: 90, conteudo: 'formula' } : tipo === 'mamada' ? { segmentos: [] } : {} }) as Registro;

describe('mesversário', () => {
  it('é no mesmo dia do mês do nascimento', () => {
    expect(mesversarioHoje(nasc('2026-08-28'), '2026-10-28')).toEqual({ meses: 2, aniversario: false, idade: '2 meses' });
    expect(mesversarioHoje(nasc('2026-08-28'), '2026-10-27')).toBeNull();
    expect(mesversarioHoje(nasc('2026-08-28'), '2026-09-28')?.idade).toBe('1 mês');
  });

  it('nascido em 31/jan: o mesversário de fevereiro é dia 28, e em março volta para 31', () => {
    expect(mesversarioHoje(nasc('2026-01-31'), '2026-02-28')?.meses).toBe(1);
    expect(mesversarioHoje(nasc('2026-01-31'), '2026-02-27')).toBeNull();
    expect(mesversarioHoje(nasc('2026-01-31'), '2026-03-28')).toBeNull();
    expect(mesversarioHoje(nasc('2026-01-31'), '2026-03-31')?.meses).toBe(2);
    expect(mesversarioHoje(nasc('2026-01-31'), '2026-04-30')?.meses).toBe(3);
    expect(mesesCompletos(nasc('2026-01-31'), '2026-03-30')).toBe(1);
  });

  it('ano bissexto: 31/jan faz 1 mês em 29/fev; 29/fev faz 1 ano em 28/fev', () => {
    expect(mesversarioHoje(nasc('2028-01-31'), '2028-02-29')?.meses).toBe(1);
    expect(mesversarioHoje(nasc('2028-01-31'), '2028-02-28')).toBeNull();
    const ano = mesversarioHoje(nasc('2028-02-29'), '2029-02-28');
    expect(ano).toEqual({ meses: 12, aniversario: true, idade: '1 ano' });
    expect(mesversarioHoje(nasc('2028-02-29'), '2032-02-29')?.idade).toBe('4 anos');
  });

  it('aniversário de 1 ano e textos', () => {
    const m = mesversarioHoje(nasc('2025-10-28'), '2026-10-28')!;
    expect(m.aniversario).toBe(true);
    expect(tituloComemoracao('Heitor', m)).toBe('Heitor faz 1 ano! 🎂');
    expect(tituloComemoracao('', { meses: 2, aniversario: false, idade: '2 meses' })).toBe('O bebê faz 2 meses! 🎉');
    expect(textoMeses(15)).toBe('1 ano e 3 meses');
    expect(textoMeses(25)).toBe('2 anos e 1 mês');
  });

  it('antes do nascimento e no dia do nascimento: nada', () => {
    expect(mesversarioHoje(null, '2026-10-28')).toBeNull();
    expect(mesversarioHoje(nasc('2026-11-10'), '2026-10-28')).toBeNull();
    expect(mesversarioHoje(nasc('2026-10-28'), '2026-10-28')).toBeNull();
  });
});

describe('resumo do mês', () => {
  it('ganho de peso desde a medida de antes do período', () => {
    const pts = [
      { data: '2026-08-28', valor: 3350 },
      { data: '2026-09-20', valor: 4100 },
      { data: '2026-10-25', valor: 4800 },
    ];
    expect(crescimentoNoPeriodo(pts, '2026-09-28', '2026-10-28')).toEqual({ atual: 4800, data: '2026-10-25', ganho: 700, desde: '2026-09-20' });
    // Sem medida no período: mostra a última, sem ganho
    expect(crescimentoNoPeriodo(pts.slice(0, 2), '2026-09-28', '2026-10-28')).toEqual({ atual: 4100, data: '2026-09-20', ganho: null, desde: null });
    expect(crescimentoNoPeriodo([], '2026-09-28', '2026-10-28')).toBeNull();
  });

  it('junta medidas, marcos, contas e a foto do mês', () => {
    const b = bebe('2026-08-28');
    const marcos = [
      marco({ tipo: 'caderneta', marco_id: 'c02-sorriso', data: '2026-10-02' }),
      marco({ tipo: 'primeira-vez', titulo: 'Primeiro banho de banheira', data: '2026-10-28' }),
      marco({ tipo: 'primeira-vez', titulo: 'Fora do mês', data: '2026-09-28' }),
      marco({ tipo: 'mes', marco_id: 'mes-2', data: '2026-10-28', foto: 'f/2.jpg' }),
    ];
    const registros = [
      reg('mamada', '2026-10-01T08:00', '2026-10-01T08:20'),
      reg('mamadeira', '2026-10-05T10:00'),
      reg('fralda', '2026-10-05T11:00'),
      reg('fralda', '2026-09-27T11:00'),
      reg('sono', '2026-10-10T13:00', '2026-10-10T15:30'),
      // Sono que começou antes do período: conta só a parte de dentro
      reg('sono', '2026-09-27T23:00', '2026-09-28T02:00'),
    ];
    const r = resumoDoMes(b, { registros, marcos, medidas: [medida('2026-09-20', 4100, 53), medida('2026-10-20', 4900, 56)] }, 2, '2026-10-28')!;
    expect(r.inicio).toBe('2026-09-28');
    expect(r.fim).toBe('2026-10-28');
    expect(r.peso).toMatchObject({ atual: 4900, ganho: 800 });
    expect(r.altura).toMatchObject({ atual: 56, ganho: 3 });
    expect(r.marcos.map((m) => m.titulo)).toEqual(['Sorriso social quando estimulado', 'Primeiro banho de banheira']);
    expect(r.mamadas).toBe(2);
    expect(r.fraldas).toBe(1);
    expect(r.sonoMs).toBe(4.5 * 3_600_000);
    expect(r.foto).toBe('f/2.jpg');
  });

  it('1º mês compara com o nascimento e inclui o dia do nascimento', () => {
    const b = bebe('2026-08-28');
    const r = resumoDoMes(b, { registros: [], marcos: [marco({ titulo: 'Primeiro colo', data: '2026-08-28' })], medidas: [medida('2026-09-26', 4200)] }, 1, '2026-09-28')!;
    expect(r.peso).toMatchObject({ atual: 4200, ganho: 850, desde: '2026-08-28' });
    expect(r.marcos).toHaveLength(1);
  });

  it('no aniversário de 1 ano: marcos e crescimento do ano todo', () => {
    const b = bebe('2025-10-28');
    const r = resumoDoMes(b, { registros: [], marcos: [marco({ titulo: 'Primeiros passos', data: '2026-03-01' })], medidas: [medida('2026-10-20', 9800, 75)] }, 12, '2026-10-28')!;
    expect(r.inicio).toBe('2025-10-28');
    expect(r.marcos.map((m) => m.titulo)).toEqual(['Primeiros passos']);
    expect(r.peso?.ganho).toBe(9800 - 3350);
  });

  it('conta só o período (fim exclusivo)', () => {
    const c = contarRegistros([reg('fralda', '2026-10-28T09:00'), reg('fralda', '2026-10-27T23:59')], '2026-09-28', '2026-10-28');
    expect(c.fraldas).toBe(1);
  });

  it('formata peso e ganho', () => {
    expect(textoPeso(4350)).toBe('4,35 kg');
    expect(textoGanhoPeso(650)).toBe('+650 g');
    expect(textoGanhoPeso(1250)).toBe('+1,25 kg');
  });
});

describe('lembranças', () => {
  it('datas redondas: 1 semana, meses e anos (31 → fim do mês)', () => {
    expect(textoHaQuanto('2026-10-21', '2026-10-28')).toBe('Há 1 semana');
    expect(textoHaQuanto('2026-09-28', '2026-10-28')).toBe('Há 1 mês');
    expect(textoHaQuanto('2026-08-28', '2026-10-28')).toBe('Há 2 meses');
    expect(textoHaQuanto('2025-10-28', '2026-10-28')).toBe('Há 1 ano');
    expect(textoHaQuanto('2026-01-31', '2026-02-28')).toBe('Há 1 mês');
    expect(textoHaQuanto('2026-10-20', '2026-10-28')).toBeNull();
  });

  it('escolhe uma só: foto/marco antes de anotação, e o mais antigo primeiro', () => {
    const b = bebe('2026-07-10');
    const marcos = [
      marco({ id: 'a', titulo: 'Primeiro sorriso', data: '2026-09-28' }),
      marco({ id: 'b', titulo: 'Primeiro banho', data: '2026-08-28', foto: 'f/b.jpg' }),
      marco({ id: 'c', titulo: 'Rolou', data: '2026-10-21' }),
    ];
    const registros = [reg('temperatura', '2026-10-21T15:00', '2026-10-21T15:00', 'Depois da vacina')];
    const l = lembrancaDoDia(b, marcos, registros, '2026-10-28')!;
    expect(l.id).toBe('marco:b');
    expect(l.quando).toBe('Há 2 meses');
    expect(l.foto).toBe('f/b.jpg');
    // Sem foto: o marco mais antigo
    expect(lembrancaDoDia(b, marcos.filter((m) => m.id !== 'b'), registros, '2026-10-28')?.id).toBe('marco:a');
    // Só a anotação
    const so = lembrancaDoDia(b, [], registros, '2026-10-28')!;
    expect(so).toMatchObject({ quando: 'Há 1 semana', titulo: 'Depois da vacina', detalhe: 'Temperatura' });
  });

  it('foto do mês tem prioridade; nada no mesversário nem antes do nascimento', () => {
    const b = bebe('2026-07-10');
    const marcos = [marco({ id: 'f', tipo: 'mes', marco_id: 'mes-2', data: '2026-09-28', foto: 'f/2.jpg' }), marco({ id: 'g', titulo: 'Primeiro passeio', data: '2026-08-28', foto: 'f/g.jpg' })];
    expect(lembrancaDoDia(b, marcos, [], '2026-10-28')).toMatchObject({ id: 'marco:f', titulo: 'Foto dos 2 meses' });
    expect(lembrancaDoDia(bebe('2026-08-28'), marcos, [], '2026-10-28')).toBeNull();
    expect(lembrancaDoDia(bebe(null), marcos, [], '2026-10-28')).toBeNull();
    expect(lembrancaDoDia(b, [marco({ titulo: 'Sem data redonda', data: '2026-10-20' })], [], '2026-10-28')).toBeNull();
  });
});
