import { describe, expect, it } from 'vitest';
import {
  anguloDoInstante,
  anguloDoPonto,
  caminhoArco,
  detalheItem,
  diaTipico,
  diasDoPadrao,
  horasDeSonoTipicas,
  instanteDoAngulo,
  itemMaisPerto,
  itensEmOrdem,
  montarRelogio,
  pontoNoCirculo,
  resumoRelogio,
} from './relogio-dia';
import type { Registro } from './tipos';

const base = { familia_id: 'f', bebe_id: 'b', criado_por: null, observacao: null };
const em = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString();
const sono = (id: string, ini: string, fim: string | null): Registro => ({ ...base, id, tipo: 'sono', inicio: ini, fim, dados: {} });
const mamadeira = (id: string, ini: string, ml: number): Registro => ({ ...base, id, tipo: 'mamadeira', inicio: ini, fim: ini, dados: { ml, conteudo: 'formula' } });
const fralda = (id: string, ini: string, coco: boolean): Registro => ({ ...base, id, tipo: 'fralda', inicio: ini, fim: ini, dados: { xixi: true, coco } });
const mamada = (id: string, ini: string, minE: number, minD: number): Registro => {
  const t = new Date(ini).getTime();
  const meio = new Date(t + minE * 60_000).toISOString();
  const fim = new Date(t + (minE + minD) * 60_000).toISOString();
  return { ...base, id, tipo: 'mamada', inicio: ini, fim, dados: { segmentos: [{ lado: 'E', inicio: ini, fim: meio }, { lado: 'D', inicio: meio, fim }] } };
};

describe('geometria', () => {
  it('meia-noite no topo, sentido horário', () => {
    expect(anguloDoInstante(new Date(2026, 9, 28, 0, 0))).toBe(0);
    expect(anguloDoInstante(new Date(2026, 9, 28, 6, 0))).toBe(90);
    expect(anguloDoInstante(new Date(2026, 9, 28, 12, 0))).toBe(180);
    expect(anguloDoInstante(new Date(2026, 9, 28, 18, 30))).toBeCloseTo(277.5);
    const topo = pontoNoCirculo(100, 100, 50, 0);
    expect(topo.x).toBeCloseTo(100);
    expect(topo.y).toBeCloseTo(50);
    const direita = pontoNoCirculo(100, 100, 50, 90);
    expect(direita.x).toBeCloseTo(150);
    expect(direita.y).toBeCloseTo(100);
  });

  it('ângulo de um ponto é o inverso do ponto no círculo', () => {
    for (const g of [0, 45, 135, 200, 359]) {
      const p = pontoNoCirculo(120, 120, 80, g);
      const v = anguloDoPonto(120, 120, p.x, p.y);
      expect(v.graus).toBeCloseTo(g);
      expect(v.raio).toBeCloseTo(80);
    }
  });

  it('arco curto, longo e de volta inteira', () => {
    expect(caminhoArco(100, 100, 50, 0, 90)).toBe('M100 50A50 50 0 0 1 150 100');
    expect(caminhoArco(100, 100, 50, 0, 270)).toContain(' 0 1 1 ');
    // Volta inteira: dois meios arcos
    expect(caminhoArco(100, 100, 50, 30, 390).match(/A/g)).toHaveLength(2);
  });

  it('instante do ângulo fica na janela das últimas 24 h', () => {
    const agora = new Date(2026, 9, 28, 14, 0);
    // 12h fica 2 h atrás; 15h (logo "depois" do ponteiro) é de ontem
    expect(instanteDoAngulo(180, agora)).toBe(new Date(2026, 9, 28, 12, 0).getTime());
    expect(instanteDoAngulo(225, agora)).toBe(new Date(2026, 9, 27, 15, 0).getTime());
    expect(instanteDoAngulo(anguloDoInstante(agora), agora)).toBe(agora.getTime());
  });
});

describe('montarRelogio', () => {
  const agora = new Date(2026, 9, 28, 14, 0);

  it('corta o sono que começou antes da janela', () => {
    const r = montarRelogio([sono('s1', em(27, 12), em(27, 15))], agora);
    expect(r.sono).toHaveLength(1);
    const s = r.sono[0];
    expect(s.cortado).toBe(true);
    expect(s.de).toBe(agora.getTime() - 24 * 3_600_000);
    expect(s.ate).toBe(new Date(em(27, 15)).getTime());
    expect(r.sonoMs).toBe(3_600_000);
    // Começa no ponteiro (14h = 210°) e vai até 15h (225°)
    expect(s.a0).toBeCloseTo(210);
    expect(s.a1).toBeCloseTo(225);
  });

  it('sono que atravessa a meia-noite tem ângulo final acima de 360', () => {
    const r = montarRelogio([sono('s1', em(27, 22), em(28, 3))], agora);
    expect(r.sono[0].a0).toBeCloseTo(330);
    expect(r.sono[0].a1).toBeCloseTo(405);
    expect(r.sonoMs).toBe(5 * 3_600_000);
  });

  it('sono em andamento cresce até o ponteiro', () => {
    const r = montarRelogio([sono('s1', em(28, 12, 40), null)], agora);
    expect(r.sonoAtual?.id).toBe('s1');
    expect(r.sonoAtual?.ate).toBe(agora.getTime());
    expect(r.sonoAtual?.a1).toBeCloseTo(210);
    expect(r.sonoMs).toBe(80 * 60_000);
    expect(detalheItem(r.sonoAtual!, agora).quando).toBe('desde 12:40');
    expect(resumoRelogio(r, agora)).toContain('Dormindo há 1h20');
  });

  it('sonos sobrepostos (os dois celulares) viram um só', () => {
    const r = montarRelogio([sono('a', em(28, 1), em(28, 3)), sono('b', em(28, 2), em(28, 4)), sono('c', em(28, 8), em(28, 9))], agora);
    expect(r.sono).toHaveLength(2);
    expect(r.sono[0].fim).toBe(new Date(em(28, 4)).getTime());
    expect(r.sonoMs).toBe(4 * 3_600_000);
  });

  it('cronômetro de sono esquecido não passa de 3 dias', () => {
    const r = montarRelogio([sono('velho', em(20, 10), null)], agora);
    expect(r.sono).toHaveLength(0);
    expect(r.sonoAtual).toBeNull();
  });

  it('alimentações e fraldas fora da janela ficam de fora', () => {
    const r = montarRelogio(
      [mamadeira('m0', em(27, 13), 90), mamadeira('m1', em(28, 9), 120), mamada('p1', em(28, 11), 8, 10), fralda('f0', em(27, 10), true), fralda('f1', em(28, 10), true)],
      agora,
    );
    expect(r.alimentacoes.map((a) => a.id)).toEqual(['m1', 'p1']);
    expect(r.fraldas.map((f) => f.id)).toEqual(['f1']);
    expect(r.alimentacoes[1].lados).toEqual({ E: 8 * 60_000, D: 10 * 60_000 });
    expect(detalheItem(r.alimentacoes[1], agora).frase).toBe('Mamada no peito às 11:00, 18 min (E 8 min e D 10 min), terminou no direito');
    expect(detalheItem(r.alimentacoes[0], agora).valor).toBe('120 ml');
    expect(detalheItem(r.fraldas[0], agora).frase).toBe('Fralda às 10:00: xixi e cocô');
  });

  it('sem registros: vazio, com frase para o leitor de tela', () => {
    const r = montarRelogio([], agora);
    expect(r.vazio).toBe(true);
    expect(resumoRelogio(r, agora)).toMatch(/nenhum/);
  });

  it('acordado desde o fim do último sono', () => {
    const r = montarRelogio([sono('s1', em(28, 10), em(28, 12, 30))], agora);
    expect(r.acordouEm).toBe(new Date(em(28, 12, 30)).getTime());
    expect(detalheItem(r.sono[0], agora).quando).toBe('10:00–12:30');
  });
});

describe('itemMaisPerto', () => {
  const agora = new Date(2026, 9, 28, 14, 0);
  const r = montarRelogio([sono('s1', em(28, 1), em(28, 5)), fralda('f1', em(28, 3), false), mamadeira('m1', em(28, 9), 90)], agora);
  const itens = itensEmOrdem(r);

  it('dentro de um trecho ganha o mais curto (a fralda no meio do sono)', () => {
    expect(itemMaisPerto(itens, new Date(em(28, 3)).getTime(), 0)?.id).toBe('f1');
    expect(itemMaisPerto(itens, new Date(em(28, 2)).getTime(), 0)?.id).toBe('s1');
  });

  it('respeita a distância máxima', () => {
    const t = new Date(em(28, 9, 20)).getTime();
    expect(itemMaisPerto(itens, t, 30 * 60_000)?.id).toBe('m1');
    expect(itemMaisPerto(itens, t, 10 * 60_000)).toBeNull();
  });
});

describe('dia típico', () => {
  const agora = new Date(2026, 9, 28, 14, 0);
  const regs: Registro[] = [];
  for (let d = 21; d <= 27; d++) {
    regs.push(sono(`n${d}`, em(d - 1, 22), em(d, 4)));
    regs.push(sono(`s${d}`, em(d, 13), em(d, 13, 30)));
    regs.push(mamadeira(`m${d}`, em(d, 9), 90));
  }

  it('usa só dias inteiros com dados, a partir do início', () => {
    expect(diasDoPadrao(regs, '2026-10-28', 7, null)).toEqual(['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
    expect(diasDoPadrao(regs, '2026-10-28', 7, '2026-10-25')).toEqual(['2026-10-25', '2026-10-26', '2026-10-27']);
    expect(diasDoPadrao([], '2026-10-28', 7, null)).toEqual([]);
  });

  it('fração de sono e alimentações por hora', () => {
    const dias = diasDoPadrao(regs, '2026-10-28', 7, null);
    const t = diaTipico(regs, dias, agora)!;
    expect(t.sono[2]).toBeCloseTo(1);
    expect(t.sono[13]).toBeCloseTo(0.5);
    expect(t.sono[10]).toBe(0);
    // 22h–23h: todos os dias menos o primeiro (a noite de 20→21 começou fora dos dias)
    expect(t.sono[22]).toBeCloseTo(6 / 7);
    expect(t.alimentacoes[9]).toBe(1);
    expect(diaTipico(regs, [], agora)).toBeNull();
  });

  it('trechos típicos juntam as horas e atravessam a meia-noite', () => {
    const s = Array(24).fill(0);
    for (const h of [0, 1, 2, 3, 13, 22, 23]) s[h] = 1;
    expect(horasDeSonoTipicas(s)).toEqual([
      { de: 22, ate: 28 },
      { de: 13, ate: 14 },
    ]);
  });
});
