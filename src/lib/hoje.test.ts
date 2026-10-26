import { describe, expect, it } from 'vitest';
import { aproximar, duracaoCurta, horaPrevista, mediasUltimosDias, painelAlimentacao, progresso } from './hoje';
import type { Registro } from './tipos';

const base = { familia_id: 'f', bebe_id: 'b', criado_por: null, observacao: null };
const em = (dia: string, hhmm: string) => new Date(`${dia}T${hhmm}:00-03:00`).toISOString();
let n = 0;
const mamadeira = (t: string, ml = 90): Registro => ({ ...base, id: String(n++), tipo: 'mamadeira', inicio: t, fim: t, dados: { ml, conteudo: 'formula' } }) as Registro;
const fralda = (t: string, coco: boolean): Registro => ({ ...base, id: String(n++), tipo: 'fralda', inicio: t, fim: t, dados: { xixi: true, coco } }) as Registro;
const sono = (a: string, b: string): Registro => ({ ...base, id: String(n++), tipo: 'sono', inicio: a, fim: b, dados: {} }) as Registro;
const mamada = (t: string, minE: number, minD: number): Registro => {
  const a = new Date(t).getTime();
  const m = (x: number) => new Date(a + x * 60_000).toISOString();
  return {
    ...base,
    id: String(n++),
    tipo: 'mamada',
    inicio: t,
    fim: m(minE + minD),
    dados: { segmentos: [{ lado: 'D', inicio: m(0), fim: m(minD) }, { lado: 'E', inicio: m(minD), fim: m(minE + minD) }] },
  } as Registro;
};

describe('duracaoCurta', () => {
  it('não quebra em duas palavras acima de 1 hora', () => {
    expect(duracaoCurta(44 * 60_000)).toBe('44 min');
    expect(duracaoCurta(106 * 60_000)).toBe('1h46');
    expect(duracaoCurta(2 * 3_600_000)).toBe('2h');
    expect(duracaoCurta(13 * 3_600_000 + 5 * 60_000)).toBe('13h05');
    expect(duracaoCurta(-5)).toBe('0 min');
  });
});

describe('painelAlimentacao', () => {
  it('sem alimentações: nada', () => {
    expect(painelAlimentacao([], new Date())).toBeNull();
  });

  it('prevê a próxima pelo intervalo médio e diz o lado em que terminou', () => {
    const regs = [mamada(em('2026-12-02', '12:00'), 10, 10), mamada(em('2026-12-02', '15:00'), 10, 10), mamada(em('2026-12-02', '18:00'), 10, 10)];
    const p = painelAlimentacao(regs, new Date(em('2026-12-02', '19:00')))!;
    expect(p.detalhe).toBe('terminou no E');
    expect(p.intervaloMs).toBe(3 * 3_600_000);
    expect(horaPrevista(p)).toBe('21:00');
    expect(p.fracao).toBeCloseTo(1 / 3);
    expect(p.estado).toBe('cedo');
  });

  it('fica âmbar perto do horário e marca quando passou', () => {
    const regs = [mamadeira(em('2026-12-02', '12:00')), mamadeira(em('2026-12-02', '14:00')), mamadeira(em('2026-12-02', '16:00'), 120)];
    const perto = painelAlimentacao(regs, new Date(em('2026-12-02', '17:50')))!;
    expect(perto.detalhe).toBe('120 ml');
    expect(perto.estado).toBe('perto');
    const passou = painelAlimentacao(regs, new Date(em('2026-12-02', '18:20')))!;
    expect(passou.estado).toBe('passou');
    expect(passou.faltaMs).toBe(-20 * 60_000);
    expect(passou.fracao).toBe(1);
  });

  it('com poucos dados (ou app parado há muito tempo) não prevê', () => {
    const duas = [mamadeira(em('2026-12-02', '12:00')), mamadeira(em('2026-12-02', '14:00'))];
    const p = painelAlimentacao(duas, new Date(em('2026-12-02', '15:00')))!;
    expect(p.proxima).toBeNull();
    expect(p.desdeMs).toBe(3_600_000);
    const tres = [...duas, mamadeira(em('2026-12-02', '16:00'))];
    expect(painelAlimentacao(tres, new Date(em('2026-12-03', '08:00')))!.proxima).toBeNull();
  });
});

describe('mediasUltimosDias', () => {
  const regs: Registro[] = [];
  for (const dia of ['2026-12-01', '2026-12-02']) {
    for (const h of ['02:00', '05:00', '08:00', '11:00']) regs.push(mamada(em(dia, h), 10, 5));
    regs.push(mamadeira(em(dia, '14:00'), 100));
    regs.push(fralda(em(dia, '09:00'), true), fralda(em(dia, '12:00'), false));
    regs.push(sono(em(dia, '13:00'), em(dia, '16:00')));
  }
  regs.push(mamada(em('2026-12-03', '02:00'), 10, 5));

  it('média dos dias completos, sem hoje e sem dias antes do nascimento', () => {
    const m = mediasUltimosDias(regs, '2026-12-03', new Date(em('2026-12-03', '10:00')), em('2026-11-30', '10:00'))!;
    // 30/11 (nascimento) não tem registro: fica de fora
    expect(m.dias).toBe(2);
    expect(m.alimentacoes).toBe(5);
    expect(m.ml).toBe(100);
    expect(m.fraldas).toBe(2);
    expect(m.coco).toBe(1);
    expect(m.peitoMs).toBe(60 * 60_000);
    expect(m.sonoMs).toBe(3 * 3_600_000);
  });

  it('nascido hoje: sem média', () => {
    expect(mediasUltimosDias(regs, '2026-12-03', new Date(em('2026-12-03', '10:00')), em('2026-12-03', '01:00'))).toBeNull();
  });
});

describe('progresso e aproximar', () => {
  it('limita entre 0 e 1', () => {
    expect(progresso(7, 9)).toBeCloseTo(7 / 9);
    expect(progresso(12, 9)).toBe(1);
    expect(progresso(0, null)).toBe(0);
    expect(progresso(3, 0)).toBe(1);
  });
  it('arredonda para leitura', () => {
    expect(aproximar(8.6, 'contagem')).toBe('9');
    expect(aproximar(284, 'ml')).toBe('280 ml');
    expect(aproximar(13 * 3_600_000 - 2 * 60_000, 'duracao')).toBe('13h');
    expect(aproximar(104 * 60_000, 'duracao')).toBe('1h40');
  });
});
