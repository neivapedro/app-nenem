import { describe, expect, it } from 'vitest';
import { alimentacoesDoDia, haDaAlimentacao, aproximar, contagemDoDia, duracaoCurta, horaPrevista, ladosDoRegistro, mediasUltimosDias, painelAlimentacao, progresso, proximoLado, ritmoEsperado, textoAlimentacao, textoSemAlimentar } from './hoje';
import type { Registro } from './tipos';
import { DURACAO_MAMADA_PADRAO_MS, fimEstimadoDaMamada, novaMamadaSimples } from './registros';

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
    expect(p.detalhe).toBe('peito esquerdo e direito');
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
    // 30/11 (nascimento, dia incompleto) fica de fora
    expect(m.dias).toBe(2);
    expect(m.alimentacoes).toBe(5);
    expect(m.ml).toBe(100);
    expect(m.fraldas).toBe(2);
    expect(m.coco).toBe(1);
    expect(m.peitoMs).toBe(60 * 60_000);
    expect(m.sonoMs).toBe(3 * 3_600_000);
  });

  it('nascido hoje ou ontem: sem média (o dia do nascimento é incompleto)', () => {
    expect(mediasUltimosDias(regs, '2026-12-03', new Date(em('2026-12-03', '10:00')), em('2026-12-03', '01:00'))).toBeNull();
    expect(mediasUltimosDias(regs, '2026-12-03', new Date(em('2026-12-03', '10:00')), em('2026-12-02', '01:00'))).toBeNull();
    expect(mediasUltimosDias(regs, '2026-12-03', new Date(em('2026-12-03', '10:00')), em('2026-12-01', '01:00'))!.dias).toBe(1);
  });
});

describe('progresso e aproximar', () => {
  it('limita entre 0 e 1', () => {
    expect(progresso(7, 9)).toBeCloseTo(7 / 9);
    expect(progresso(12, 9)).toBe(1);
    expect(progresso(0, null)).toBe(0);
    expect(progresso(5, undefined)).toBe(0);
    expect(progresso(3, 0)).toBe(1);
  });
  it('arredonda para leitura', () => {
    expect(aproximar(8.6, 'contagem')).toBe('9');
    expect(aproximar(284, 'ml')).toBe('280 ml');
    expect(aproximar(13 * 3_600_000 - 2 * 60_000, 'duracao')).toBe('13h');
    expect(aproximar(104 * 60_000, 'duracao')).toBe('1h40');
  });
});

// ---------- Mamadas de hoje ----------
const nova = (t: string, lado: 'E' | 'D'): Registro => ({ ...base, id: String(n++), tipo: 'mamada', inicio: t, fim: t, dados: { segmentos: [{ lado, inicio: t, fim: t }] } }) as Registro;
const noDia = (dia: string, qtd: number, lado: 'E' | 'D' = 'E') => Array.from({ length: qtd }, (_, i) => nova(em(dia, `${String(6 + i).padStart(2, '0')}:00`), lado));

describe('mamadas do dia', () => {
  it('lê os lados de registro novo, antigo e sem segmentos', () => {
    expect(ladosDoRegistro(nova(em('2026-12-02', '10:00'), 'D') as never)).toEqual(['D']);
    expect(ladosDoRegistro(mamada(em('2026-12-02', '10:00'), 5, 5) as never)).toEqual(['D', 'E']);
    expect(ladosDoRegistro({ ...(nova(em('2026-12-02', '10:00'), 'D') as object), dados: { segmentos: [] } } as never)).toEqual([]);
  });

  it('conta lados e mamadeiras; antiga com dois lados é uma mamada só', () => {
    const regs = [nova(em('2026-12-02', '08:00'), 'E'), nova(em('2026-12-02', '11:00'), 'D'), mamada(em('2026-12-02', '14:00'), 5, 5), mamadeira(em('2026-12-02', '16:00'), 90), nova(em('2026-12-01', '23:00'), 'E')];
    const it = alimentacoesDoDia(regs, '2026-12-02');
    expect(it.map((x) => x.tipo)).toEqual(['mamada', 'mamada', 'mamada', 'mamadeira']);
    expect(contagemDoDia(it)).toEqual({ total: 4, peito: 3, esquerdo: 2, direito: 2, mamadeiras: 1, ml: 90 });
    expect(textoAlimentacao(it[1])).toBe('11:00 · peito direito');
    expect(textoAlimentacao(it[3])).toBe('16:00 · mamadeira 90 ml');
  });

  it('próximo lado é o oposto do último peito (ignora mamadeira)', () => {
    expect(proximoLado([])).toBeNull();
    expect(proximoLado([mamadeira(em('2026-12-02', '10:00'))])).toBeNull();
    expect(proximoLado([nova(em('2026-12-02', '08:00'), 'E'), nova(em('2026-12-02', '11:00'), 'D'), mamadeira(em('2026-12-02', '12:00'))])).toBe('E');
    // antiga terminou no E: próxima no D
    expect(proximoLado([mamada(em('2026-12-02', '08:00'), 5, 5)])).toBe('D');
  });
});

describe('ritmoEsperado', () => {
  const agora = new Date(em('2026-12-10', '12:00'));
  it('sem 2 dias inteiros com dados usa a referência da OMS (8)', () => {
    const r = ritmoEsperado([], '2026-12-10', agora, null);
    expect(r).toMatchObject({ fonte: 'oms', esperado: 8, faltam: 8, dias: 0 });
    const um = ritmoEsperado(noDia('2026-12-09', 10), '2026-12-10', agora, null);
    expect(um.fonte).toBe('oms');
  });
  it('dia do nascimento não conta como inteiro', () => {
    const regs = [...noDia('2026-12-08', 9), ...noDia('2026-12-09', 9)];
    expect(ritmoEsperado(regs, '2026-12-10', agora, em('2026-12-08', '05:00')).fonte).toBe('oms');
    expect(ritmoEsperado(regs, '2026-12-10', agora, em('2026-12-07', '05:00')).fonte).toBe('proprio');
  });
  it('média dos últimos 3 dias; faltam considera feitas e a hora; nunca negativo', () => {
    const regs = [...noDia('2026-12-09', 10), ...noDia('2026-12-08', 10), ...noDia('2026-12-07', 9), ...noDia('2026-12-06', 1), ...noDia('2026-12-10', 3)];
    const r = ritmoEsperado(regs, '2026-12-10', agora, null);
    expect(r).toMatchObject({ fonte: 'proprio', dias: 3, esperado: 10 });
    expect(r.media).toBeCloseTo(29 / 3);
    expect(r.faltam).toBe(5); // 10-3=7, mas só cabe ceil(9,67*0,5)=5 no resto do dia
    expect(ritmoEsperado([...regs, ...noDia('2026-12-10', 9)], '2026-12-10', new Date(em('2026-12-10', '23:00')), null).faltam).toBeGreaterThanOrEqual(0);
    const cheio = [...regs, ...noDia('2026-12-10', 12)];
    expect(ritmoEsperado(cheio, '2026-12-10', agora, null).faltam).toBe(0);
  });
  it('pula dias sem uso do app', () => {
    const regs = [...noDia('2026-12-09', 8), ...noDia('2026-12-07', 12)];
    const r = ritmoEsperado(regs, '2026-12-10', agora, null);
    expect(r).toMatchObject({ fonte: 'proprio', dias: 2, esperado: 10 });
  });
});

describe('textoSemAlimentar', () => {
  const agora = new Date(em('2026-12-10', '18:00'));
  it('só passa de 3h30', () => {
    expect(textoSemAlimentar(em('2026-12-10', '14:40'), agora)).toBeNull();
    expect(textoSemAlimentar(em('2026-12-10', '14:20'), agora)).toBe('Faz 3h40 desde a última mamada.');
    expect(textoSemAlimentar(null, agora)).toBeNull();
    expect(textoSemAlimentar(em('2026-12-08', '14:20'), agora)).toBeNull();
  });
});

describe('há quanto tempo mamou (mamada padrão de 45 min)', () => {
  const dia = '2026-11-15';
  it('mamada de um toque: conta desde o início + 45 min', () => {
    const m = novaMamadaSimples({ id: 'm', familia_id: 'f', bebe_id: 'b', criado_por: null }, 'E', new Date(em(dia, '12:15')));
    expect(haDaAlimentacao(m, new Date(em(dia, '14:23')))).toBe('há 1h23');
    expect(haDaAlimentacao(m, new Date(em(dia, '13:00')))).toBe('agora');
    // ainda dentro dos 45 min: não fica "no futuro"
    expect(haDaAlimentacao(m, new Date(em(dia, '12:30')))).toBe('agora');
    expect(fimEstimadoDaMamada(m)).toBe(em(dia, '13:00'));
  });
  it('registro antigo com duração real usa o fim de verdade; mamadeira usa a própria hora', () => {
    const antiga = mamada(em(dia, '10:00'), 10, 5);
    expect(fimEstimadoDaMamada(antiga)).toBe(em(dia, '10:15'));
    expect(haDaAlimentacao(antiga, new Date(em(dia, '11:15')))).toBe('há 1h');
    const mm = mamadeira(em(dia, '10:00'));
    expect(fimEstimadoDaMamada(mm)).toBe(em(dia, '10:00'));
    expect(DURACAO_MAMADA_PADRAO_MS).toBe(45 * 60_000);
  });
});
