import { describe, expect, it } from 'vitest';
import { diasPainel, inicioDosDados, ladosDoPeito, linhaDoTempo, mapaHorarios, mediasPeriodo, perfilPorHora, periodoCoberto, variacao } from './painel';
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
