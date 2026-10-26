import { describe, expect, it } from 'vitest';
import {
  alturaSono,
  detalheSemHora,
  diasDaJanela,
  fitaDoDia,
  itensDoDia,
  janelaDaData,
  janelaInicial,
  semanaAnterior,
  textoFimSono,
  textoSemana,
} from './historico-dias';
import type { Registro, TipoRegistro } from './tipos';

const base = { familia_id: 'f', bebe_id: 'b', criado_por: null, observacao: null };
const em = (dia: string, hhmm: string) => new Date(`${dia}T${hhmm}:00-03:00`).toISOString();
let n = 0;
const sono = (a: string, b: string | null): Registro => ({ ...base, id: `s${n++}`, tipo: 'sono', inicio: a, fim: b, dados: {} }) as Registro;
const fralda = (t: string): Registro => ({ ...base, id: `f${n++}`, tipo: 'fralda', inicio: t, fim: t, dados: { xixi: true, coco: false } }) as Registro;
const mamadeira = (t: string): Registro => ({ ...base, id: `m${n++}`, tipo: 'mamadeira', inicio: t, fim: t, dados: { ml: 90, conteudo: 'formula' } }) as Registro;
const TUDO: TipoRegistro[] = ['mamada', 'mamadeira', 'fralda', 'sono', 'remedio', 'temperatura', 'extracao', 'refeicao'];

describe('janelas de uma semana', () => {
  it('começa nos 7 dias mais recentes', () => {
    expect(janelaInicial('2026-10-26')).toEqual({ de: '2026-10-20', ate: '2026-10-26' });
    expect(diasDaJanela(janelaInicial('2026-10-26'))).toEqual(['2026-10-26', '2026-10-25', '2026-10-24', '2026-10-23', '2026-10-22', '2026-10-21', '2026-10-20']);
  });

  it('"Ver semana anterior" soma 7 dias para trás, sem passar do nascimento', () => {
    expect(semanaAnterior({ de: '2026-10-20', ate: '2026-10-26' })).toEqual({ de: '2026-10-13', ate: '2026-10-26' });
    expect(semanaAnterior({ de: '2026-10-20', ate: '2026-10-26' }, '2026-10-16')).toEqual({ de: '2026-10-16', ate: '2026-10-26' });
    // virada de mês
    expect(semanaAnterior({ de: '2026-10-03', ate: '2026-10-09' }).de).toBe('2026-09-26');
  });

  it('"Ir para a data" mostra a semana em volta do dia', () => {
    expect(janelaDaData('2026-10-01', '2026-10-26')).toEqual({ de: '2026-09-28', ate: '2026-10-04' });
    // perto de hoje: termina hoje
    expect(janelaDaData('2026-10-25', '2026-10-26')).toEqual({ de: '2026-10-20', ate: '2026-10-26' });
    // data no futuro vira hoje
    expect(janelaDaData('2026-12-01', '2026-10-26')).toEqual({ de: '2026-10-20', ate: '2026-10-26' });
    // perto do nascimento: começa nele
    expect(janelaDaData('2026-09-11', '2026-10-26', '2026-09-10')).toEqual({ de: '2026-09-10', ate: '2026-09-16' });
    expect(janelaDaData('2026-08-01', '2026-10-26', '2026-09-10')).toEqual({ de: '2026-09-10', ate: '2026-09-16' });
  });

  it('texto da semana', () => {
    expect(textoSemana('2026-10-13', '2026-10-19')).toBe('13 a 19 out');
    expect(textoSemana('2026-09-28', '2026-10-04')).toBe('28 set a 4 out');
  });
});

describe('itens do dia', () => {
  const agora = new Date(em('2026-10-26', '10:00'));
  const noite = sono(em('2026-10-24', '22:00'), em('2026-10-25', '04:30'));
  const regs = [noite, fralda(em('2026-10-25', '05:00')), mamadeira(em('2026-10-25', '07:10')), fralda(em('2026-10-24', '21:00'))];

  it('sono que cruza a meia-noite: completo no dia em que começou e como continuação no seguinte', () => {
    const d24 = itensDoDia(regs, '2026-10-24', TUDO, agora);
    expect(d24.map((x) => x.r.id)).toEqual([noite.id, regs[3].id]);
    expect(d24[0]).toMatchObject({ continuacao: false, passaDoDia: true, sonoMs: 2 * 3_600_000 });
    expect(textoFimSono(d24[0], '2026-10-24')).toBe('até 04:30 do dia seguinte');

    const d25 = itensDoDia(regs, '2026-10-25', TUDO, agora);
    // mais recente primeiro; a continuação vai no fim (começo do dia)
    expect(d25.map((x) => x.r.tipo)).toEqual(['mamadeira', 'fralda', 'sono']);
    expect(d25[2]).toMatchObject({ continuacao: true, sonoMs: 4.5 * 3_600_000 });
    expect(textoFimSono(d25[2], '2026-10-25')).toBe('acordou às 04:30 · começou ontem às 22:00');
  });

  it('respeita o filtro e o dia vazio', () => {
    expect(itensDoDia(regs, '2026-10-25', ['fralda'], agora).map((x) => x.r.tipo)).toEqual(['fralda']);
    expect(itensDoDia(regs, '2026-10-25', ['sono'], agora)).toHaveLength(1);
    expect(itensDoDia(regs, '2026-10-20', TUDO, agora)).toEqual([]);
  });

  it('sono em andamento vai até agora', () => {
    const dormindo = sono(em('2026-10-26', '08:00'), null);
    const [x] = itensDoDia([dormindo], '2026-10-26', TUDO, agora);
    expect(x).toMatchObject({ emAndamento: true, sonoMs: 2 * 3_600_000 });
    expect(textoFimSono(x, '2026-10-26')).toBe('dormindo agora');
  });
});

describe('desenho', () => {
  it('a barra do sono cresce com a duração, com limites', () => {
    expect(alturaSono(10 * 60_000)).toBe(60);
    expect(alturaSono(3 * 3_600_000)).toBeGreaterThan(alturaSono(2 * 3_600_000));
    expect(alturaSono(20 * 3_600_000)).toBe(210);
  });

  it('tira a hora do começo do detalhe', () => {
    expect(detalheSemHora('14:05 · E 10 min · D 8 min')).toBe('E 10 min · D 8 min');
    expect(detalheSemHora('25/10 14:05 · em andamento (pausada)')).toBe('em andamento (pausada)');
    expect(detalheSemHora('14:05')).toBe('');
    expect(detalheSemHora('leite materno')).toBe('leite materno');
  });

  it('fita do dia: sono da noite anterior começa na meia-noite; "agora" só hoje', () => {
    const agora = new Date(em('2026-10-26', '06:00'));
    const f25 = fitaDoDia([sono(em('2026-10-24', '22:00'), em('2026-10-25', '06:00'))], '2026-10-25', agora);
    expect(f25.sono).toEqual([{ de: 0, ate: 0.25 }]);
    expect(f25.agoraFracao).toBeUndefined();
    expect(f25.marcas.map((m) => m.texto)).toEqual(['6h', '12h', '18h']);
    const f26 = fitaDoDia([], '2026-10-26', agora);
    expect(f26.agoraFracao).toBeCloseTo(0.25);
  });
});
