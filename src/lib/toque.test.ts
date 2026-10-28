import { describe, expect, it } from 'vitest';
import { decidirEixo, deveFecharFolha, elastico, limiarApagar, opacidadeFundo, posicaoDeslize, posicaoFolha, soltarDeslize, velocidade } from './toque';

describe('decidirEixo', () => {
  it('espera o dedo sair do lugar', () => {
    expect(decidirEixo(0, 0)).toBe('espera');
    expect(decidirEixo(5, -6)).toBe('espera');
  });
  it('horizontal só quando claramente de lado', () => {
    expect(decidirEixo(-20, 3)).toBe('horizontal');
    expect(decidirEixo(14, 12)).toBe('vertical');
    expect(decidirEixo(3, 30)).toBe('vertical');
  });
});

describe('elastico', () => {
  it('cresce sempre e nunca passa do máximo', () => {
    expect(elastico(0)).toBe(0);
    expect(elastico(-10)).toBe(0);
    expect(elastico(20, 24)).toBeLessThan(20);
    expect(elastico(200, 24)).toBeGreaterThan(elastico(50, 24));
    expect(elastico(100000, 24)).toBeLessThan(24);
  });
});

describe('folha', () => {
  it('acompanha o dedo para baixo e resiste para cima', () => {
    expect(posicaoFolha(120)).toBe(120);
    expect(posicaoFolha(-100)).toBeLessThan(0);
    expect(posicaoFolha(-100)).toBeGreaterThan(-24);
  });
  it('fecha quando desce bastante', () => {
    expect(deveFecharFolha(170, 0, 700)).toBe(true);
    expect(deveFecharFolha(100, 0, 700)).toBe(false);
    // Folha baixa: 30% da altura, com mínimo de 80 px
    expect(deveFecharFolha(90, 0, 300)).toBe(true);
    expect(deveFecharFolha(70, 0, 200)).toBe(false);
  });
  it('fecha com um gesto rápido, mas não com um tremido', () => {
    expect(deveFecharFolha(40, 0.8, 700)).toBe(true);
    expect(deveFecharFolha(12, 2, 700)).toBe(false);
    expect(deveFecharFolha(60, 0.2, 700)).toBe(false);
    expect(deveFecharFolha(-30, 1, 700)).toBe(false);
  });
  it('o fundo clareia conforme desce', () => {
    expect(opacidadeFundo(0, 600)).toBe(1);
    expect(opacidadeFundo(300, 600)).toBeCloseTo(0.5);
    expect(opacidadeFundo(900, 600)).toBe(0);
  });
});

describe('deslizar item', () => {
  const m = { acoes: 152, largura: 340 };
  it('limiar de apagar fica além das ações e antes da borda', () => {
    expect(limiarApagar(m)).toBe(204);
    expect(limiarApagar({ acoes: 152, largura: 280 })).toBe(200);
    expect(limiarApagar({ acoes: 152, largura: 180 })).toBe(164);
  });
  it('posição: livre para a esquerda, elástico para a direita', () => {
    expect(posicaoDeslize(0, -80, m)).toBe(-80);
    expect(posicaoDeslize(-152, -400, m)).toBe(-340);
    expect(posicaoDeslize(0, 60, m)).toBeGreaterThan(0);
    expect(posicaoDeslize(0, 60, m)).toBeLessThan(16);
    expect(posicaoDeslize(-152, 100, m)).toBe(-52);
  });
  it('soltar: abre, fecha ou apaga', () => {
    expect(soltarDeslize(-100, 0, m)).toBe('aberto');
    expect(soltarDeslize(-50, 0, m)).toBe('fechado');
    expect(soltarDeslize(-40, -0.6, m)).toBe('aberto');
    expect(soltarDeslize(-120, 0.6, m)).toBe('fechado');
    expect(soltarDeslize(-260, 0, m)).toBe('apagar');
    // Rápido mas curto: nunca apaga só pela velocidade
    expect(soltarDeslize(-150, -3, m)).toBe('aberto');
  });
  it('velocidade pelas últimas amostras', () => {
    expect(velocidade([])).toBe(0);
    expect(velocidade([{ v: 0, t: 0 }, { v: 50, t: 100 }])).toBeCloseTo(0.5);
    expect(velocidade([{ v: 0, t: 0 }, { v: 0, t: 400 }, { v: -30, t: 450 }, { v: -60, t: 500 }])).toBeCloseTo(-0.6);
  });
});
