import { describe, expect, it } from 'vitest';
import { somarDiasLocal } from './datas';
import { diasPainel, foraDoPadrao, inicioDosDados, ladosDoPeito, linhaDoTempo, mapaHorarios, mediasPeriodo, narrativa, perfilPorHora, periodoCoberto, variacao, type DiaPainel } from './painel';
import type { Registro } from './tipos';

const base = { familia_id: 'f', bebe_id: 'b', criado_por: null, observacao: null };
const em = (dia: string, hhmm: string) => new Date(`${dia}T${hhmm}:00-03:00`).toISOString();
let n = 0;
const sono = (a: string, b: string | null): Registro => ({ ...base, id: String(n++), tipo: 'sono', inicio: a, fim: b, dados: {} }) as Registro;
const mamadeira = (t: string): Registro =>
  ({ ...base, id: String(n++), tipo: 'mamadeira', inicio: t, fim: t, dados: { ml: 100, conteudo: 'formula' } }) as Registro;
const fralda = (t: string, coco: boolean): Registro =>
  ({ ...base, id: String(n++), tipo: 'fralda', inicio: t, fim: t, dados: { xixi: true, coco } }) as Registro;
const mamada = (t: string, minE: number, minD: number): Registro => {
  const a = new Date(t).getTime();
  const m = (x: number) => new Date(a + x * 60_000).toISOString();
  return {
    ...base,
    id: String(n++),
    tipo: 'mamada',
    inicio: t,
    fim: m(minE + minD),
    dados: {
      segmentos: [
        { lado: 'E', inicio: m(0), fim: m(minE) },
        { lado: 'D', inicio: m(minE), fim: m(minE + minD) },
      ],
    },
  } as Registro;
};
const HORA = 3_600_000;

describe('painel', () => {
  const regs = [
    // noite de 22h a 4h (atravessa a meia-noite)
    sono(em('2026-12-01', '22:00'), em('2026-12-02', '04:00')),
    // soneca de dia, 13h às 15h
    sono(em('2026-12-02', '13:00'), em('2026-12-02', '15:00')),
    // sono que começa de dia e entra na noite: 18h às 20h (1h dia + 1h noite)
    sono(em('2026-12-02', '18:00'), em('2026-12-02', '20:00')),
    mamadeira(em('2026-12-02', '08:15')),
    mamadeira(em('2026-12-02', '08:45')),
    mamada(em('2026-12-02', '11:00'), 10, 5),
    fralda(em('2026-12-02', '09:00'), true),
    fralda(em('2026-12-02', '12:00'), false),
  ];
  const agora = new Date(em('2026-12-03', '12:00'));

  it('separa sono da noite e de dia, e o maior sono seguido', () => {
    const [d1, d2] = diasPainel(regs, '2026-12-01', '2026-12-02', agora);
    expect(d1.sonoNoiteMs).toBe(2 * HORA); // 22h–24h
    expect(d1.maiorSonoMs).toBe(6 * HORA); // começou no dia 1
    expect(d2.sonoNoiteMs).toBe(4 * HORA + 1 * HORA); // 0h–4h + 19h–20h
    expect(d2.sonoDiaMs).toBe(2 * HORA + 1 * HORA); // 13h–15h + 18h–19h
    expect(d2.maiorSonoMs).toBe(2 * HORA);
    expect(d2.alimentacoes).toBe(3);
    expect([d2.coco, d2.semCoco]).toEqual([1, 1]);
  });

  it('médias sem hoje e variação', () => {
    const dias = diasPainel(regs, '2026-12-01', '2026-12-03', agora);
    const m = mediasPeriodo(dias, '2026-12-03');
    expect(m.dias).toBe(2);
    expect(m.alimentacoes).toBe(1.5);
    expect(variacao(12, 10)).toBeCloseTo(0.2);
    expect(variacao(5, 0)).toBeNull();
  });

  it('mapa de horários e dia típico', () => {
    const dias = ['2026-12-01', '2026-12-02'];
    const alim = mapaHorarios(regs, dias, 'alimentacoes', agora);
    expect(alim[1][8]).toBe(2);
    expect(alim[1][11]).toBe(1);
    const s = mapaHorarios(regs, dias, 'sono', agora);
    expect(s[0][22]).toBe(60);
    expect(s[1][3]).toBe(60);
    expect(s[1][4]).toBe(0);
    expect(perfilPorHora(alim)[8]).toBe(1);
  });

  it('linha do tempo e lados do peito', () => {
    const t = linhaDoTempo(regs, new Date(em('2026-12-02', '00:00')), new Date(em('2026-12-03', '00:00')), agora);
    expect(t.sono[0]).toEqual({ de: 0, ate: 4 / 24 });
    expect(t.alimentacoes).toHaveLength(3);
    expect(t.fraldas.filter((f) => f.coco)).toHaveLength(1);
    const l = ladosDoPeito(regs, new Date(em('2026-12-02', '00:00')), new Date(em('2026-12-03', '00:00')), agora);
    expect(l).toEqual({ E: 10 * 60_000, D: 5 * 60_000 });
  });

  it('recém-nascido: os dias antes do nascimento não puxam a média para baixo', () => {
    // Nasceu dia 05; 4 mamadeiras por dia a partir daí; hoje é dia 07 (incompleto)
    const r: Registro[] = [];
    for (const d of ['2026-12-05', '2026-12-06', '2026-12-07']) for (const h of ['02:00', '08:00', '14:00', '20:00']) r.push(mamadeira(em(d, h)));
    const agora = new Date(em('2026-12-07', '21:00'));
    const dias = diasPainel(r, '2026-12-01', '2026-12-07', agora);
    expect(mediasPeriodo(dias, '2026-12-07').alimentacoes).toBeCloseTo(8 / 6);
    const desde = inicioDosDados(null, r);
    expect(desde).toBe('2026-12-05');
    const m = mediasPeriodo(dias, '2026-12-07', desde);
    expect(m.alimentacoes).toBe(4);
    expect(m.dias).toBe(2);
    // Nasceu hoje: usa o próprio dia de hoje
    expect(mediasPeriodo(dias, '2026-12-07', '2026-12-07').alimentacoes).toBe(4);
    // O período anterior (24 a 30/11) não tinha dados: não compara
    expect(periodoCoberto('2026-11-24', desde)).toBe(false);
    expect(periodoCoberto('2026-12-05', desde)).toBe(true);
    expect(inicioDosDados('2026-11-01', r)).toBe('2026-11-01');
  });
});

// ---------- Narrativa e dia fora do padrão ----------

const MIN = 60_000;
/** Um dia "comum": 8 alimentações, 6 fraldas, 14 h de sono, maior sono de 3 h */
const diaP = (dia: string, x: Partial<DiaPainel> = {}): DiaPainel => ({
  dia,
  mamadas: 8,
  peitoMs: 8 * 15 * MIN,
  mamadeiras: 0,
  ml: 0,
  fraldas: 6,
  xixi: 6,
  coco: 2,
  semCoco: 4,
  sonoMs: 14 * HORA,
  sonoNoiteMs: 9 * HORA,
  sonoDiaMs: 5 * HORA,
  maiorSonoMs: 3 * HORA,
  alimentacoes: 8,
  ...x,
});
/** n dias terminando em `ate`, com `f(i)` para mudar cada um */
const periodo = (ate: string, n: number, f: (i: number, dia: string) => Partial<DiaPainel> = () => ({})) =>
  Array.from({ length: n }, (_, i) => {
    const dia = somarDiasLocal(ate, i - n + 1);
    return diaP(dia, f(i, dia));
  });

describe('narrativa', () => {
  // Segunda, 26/10/2026; semana atual 20 a 26/10, anterior 13 a 19/10
  const hoje = '2026-10-26';
  const ateAntes = '2026-10-19';

  it('compara o sono com a semana anterior e cita o maior sono seguido', () => {
    const dias = periodo(hoje, 7, (i) => ({ sonoMs: 14 * HORA + 40 * MIN, maiorSonoMs: i === 1 ? 3 * HORA + 7 * MIN : 2.5 * HORA }));
    const anteriores = periodo(ateAntes, 7, () => ({ maiorSonoMs: 2.5 * HORA }));
    const f = narrativa({ dias, anteriores, hoje, inicio: '2026-08-01', sexo: 'M' });
    const textos = f.map((x) => x.texto);
    expect(textos).toContain('Esta semana ele dormiu 40 min a mais por dia do que na anterior');
    expect(textos).toContain('Maior sono seguido: 3h07 na quarta (21/10)');
    expect(f.length).toBeGreaterThanOrEqual(2);
    expect(f.length).toBeLessThanOrEqual(4);
    // O número vem em destaque
    expect(f.find((x) => x.id === 'sono')!.partes).toContainEqual({ destaque: '40 min a mais' });
  });

  it('noites mais longas e maior sono seguido mais longo', () => {
    const dias = periodo(hoje, 7, () => ({ sonoNoiteMs: 9 * HORA + 45 * MIN, maiorSonoMs: 3 * HORA + 25 * MIN }));
    const anteriores = periodo(ateAntes, 7);
    const textos = narrativa({ dias, anteriores, hoje, inicio: null, sexo: 'F' }).map((x) => x.texto);
    expect(textos).toContain('Esta semana as noites tiveram 45 min a mais de sono do que na anterior');
    expect(textos).toContain('O maior sono seguido está 25 min mais longo: 3h25 em média');
  });

  it('sem sexo informado, a frase fica neutra', () => {
    const dias = periodo(hoje, 7, () => ({ sonoMs: 13 * HORA }));
    const anteriores = periodo(ateAntes, 7);
    const f = narrativa({ dias, anteriores, hoje, inicio: null });
    expect(f.map((x) => x.texto)).toContain('Esta semana foram 1h00 a menos de sono por dia do que na anterior');
  });

  it('intervalo entre mamadas, mamadeira estável e dia com mais fraldas', () => {
    const dias = periodo(hoje, 7, (i) => ({ ml: 240, mamadeiras: 2, fraldas: i === 5 ? 10 : 6 }));
    const anteriores = periodo(ateAntes, 7, () => ({ ml: 238, mamadeiras: 2 }));
    const f = narrativa({ dias, anteriores, hoje, inicio: null, intervaloMs: (2 * 60 + 34) * MIN, intervaloAntesMs: (2 * 60 + 25) * MIN });
    const textos = f.map((x) => x.texto);
    expect(textos).toContain('As mamadas estão mais espaçadas: 2h34 em média (+9 min)');
    // Dia 25/10 é ontem
    expect(textos).toContain('Dia com mais fraldas: ontem (10)');
    expect(textos).toContain('Mamadeira: 240 ml/dia, estável');
  });

  it('variações pequenas não viram frase', () => {
    const dias = periodo(hoje, 7, () => ({ sonoMs: 14 * HORA + 5 * MIN, alimentacoes: 8.2, fraldas: 6 }));
    const anteriores = periodo(ateAntes, 7);
    const f = narrativa({ dias, anteriores, hoje, inicio: null, intervaloMs: 150 * MIN, intervaloAntesMs: 147 * MIN });
    expect(f.find((x) => x.id === 'intervalo')).toBeUndefined();
    expect(f.find((x) => x.id === 'alimentacoes')).toBeUndefined();
    // Sono +5 min não é "a mais": no máximo aparece como estável
    expect(f.every((x) => !x.texto.includes('a mais'))).toBe(true);
    expect(f.length).toBeLessThanOrEqual(3);
  });

  it('recém-nascido: sem comparação com período anterior e nada com menos de 3 dias inteiros', () => {
    // Nasceu dia 23: só 24 e 25 inteiros (o dia 23 é pedaço e hoje não acabou)
    const dias = periodo(hoje, 7, (_, d) => (d < '2026-10-23' ? { alimentacoes: 0, mamadas: 0, fraldas: 0, sonoMs: 0, maiorSonoMs: 0 } : {}));
    expect(narrativa({ dias, anteriores: periodo(ateAntes, 7), hoje, inicio: '2026-10-24' })).toEqual([]);
    // Com 4 dias inteiros já fala do período, mas não compara (o período anterior não tinha dados)
    const dias2 = periodo(hoje, 7, (i, d) => (d < '2026-10-22' ? { alimentacoes: 0, mamadas: 0, fraldas: 0, sonoMs: 0, maiorSonoMs: 0 } : { maiorSonoMs: i === 4 ? 4 * HORA : 2 * HORA }));
    const anteriores = periodo(ateAntes, 7, () => ({ sonoMs: 10 * HORA }));
    const f = narrativa({ dias: dias2, anteriores, hoje, inicio: '2026-10-22' });
    expect(f.map((x) => x.id)).toEqual(['maior-sono']);
    expect(f[0].texto).toBe('Maior sono seguido: 4h00 no sábado (24/10)');
  });

  it('período anterior com poucos registros não serve de comparação', () => {
    const dias = periodo(hoje, 7, () => ({ sonoMs: 16 * HORA }));
    const anteriores = periodo(ateAntes, 7, (i) => (i < 4 ? { alimentacoes: 0, mamadas: 0, fraldas: 0, sonoMs: 0, maiorSonoMs: 0 } : {}));
    const f = narrativa({ dias, anteriores, hoje, inicio: null });
    expect(f.find((x) => x.id === 'sono')).toBeUndefined();
  });

  it('30 dias: palavras do período e data no dia das fraldas', () => {
    const dias = periodo(hoje, 30, (i) => ({ fraldas: i === 10 ? 12 : 6, alimentacoes: 7, mamadas: 7 }));
    const anteriores = periodo(somarDiasLocal(hoje, -30), 30);
    const textos = narrativa({ dias, anteriores, hoje, inicio: null }).map((x) => x.texto);
    expect(textos).toContain('Foram 7 alimentações por dia, 1 a menos que nos 30 dias anteriores');
    // 11º dia de 30 terminando em 26/10 = quarta, 07/10
    expect(textos).toContain('Dia com mais fraldas: quarta, 07/10 (12)');
  });
});

describe('foraDoPadrao', () => {
  const todos = (n: number) => Array(n).fill(true);
  it('acha o dia que destoa e ignora variação normal', () => {
    expect(foraDoPadrao([8, 9, 8, 10, 9, 15, 9], todos(7), 2)).toMatchObject({ indice: 5, valor: 15, acima: true });
    expect(foraDoPadrao([8, 9, 8, 10, 9, 11, 9], todos(7), 2)).toBeNull();
    expect(foraDoPadrao([14, 13.5, 14.2, 6, 13.8, 14.1, 14], todos(7), 1.5)).toMatchObject({ indice: 3, acima: false });
  });
  it('não conta hoje (incompleto) nem dias sem dados, e precisa de 5 dias', () => {
    // Hoje (último) tem 2 só porque o dia não acabou
    expect(foraDoPadrao([8, 9, 8, 10, 9, 9, 2], [true, true, true, true, true, true, false], 2)).toBeNull();
    expect(foraDoPadrao([8, 9, 20, 9], todos(4), 2)).toBeNull();
  });
});
