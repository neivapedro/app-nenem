import { describe, expect, it } from 'vitest';
import { aplicarAtalho, atalhosMamadeira, atalhosPara, mamadeirasMaisUsadas } from './atalhos-rapidos';
import type { ConteudoMamadeira, Registro, Remedio } from './tipos';

const agora = new Date('2026-10-28T15:00:00-03:00');
const base = { familia_id: 'f', bebe_id: 'b', criado_por: null, observacao: null };
let n = 0;
const haH = (h: number) => new Date(agora.getTime() - h * 3_600_000).toISOString();
const mamadeira = (h: number, ml: number, conteudo: ConteudoMamadeira = 'formula'): Registro => ({ ...base, id: `m${n++}`, tipo: 'mamadeira', inicio: haH(h), fim: haH(h), dados: { ml, conteudo } });
const sono = (h: number, fimH: number | null): Registro => ({ ...base, id: `s${n++}`, tipo: 'sono', inicio: haH(h), fim: fimH === null ? null : haH(fimH), dados: {} });
const mamada = (h: number, ultimoLado: 'E' | 'D', aberta = false): Registro => ({
  ...base,
  id: `p${n++}`,
  tipo: 'mamada',
  inicio: haH(h),
  fim: aberta ? null : haH(h - 0.3),
  dados: { segmentos: [{ lado: ultimoLado, inicio: haH(h), fim: aberta ? null : haH(h - 0.3) }] },
});
const novaBase = () => ({ id: `novo${n++}`, familia_id: 'f', bebe_id: 'b', criado_por: 'u1' });

describe('mamadeiras mais usadas', () => {
  it('ordena por frequência e, no empate, pela mais recente', () => {
    const regs = [mamadeira(1, 120), mamadeira(5, 120), mamadeira(9, 90, 'materno'), mamadeira(30, 90, 'materno'), mamadeira(50, 60), mamadeira(3, 150)];
    const l = mamadeirasMaisUsadas(regs, agora);
    expect(l.map((x) => `${x.ml}${x.conteudo}`)).toEqual(['120formula', '90materno', '150formula']);
  });

  it('ignora o que é antigo (mais de 3 semanas) e ml zerado', () => {
    const regs = [mamadeira(24 * 25, 200), mamadeira(1, 0), mamadeira(2, 90)];
    expect(mamadeirasMaisUsadas(regs, agora).map((x) => x.ml)).toEqual([90]);
  });

  it('a última mamadeira sempre aparece', () => {
    const regs = [mamadeira(0.5, 30), ...[2, 3].map((h) => mamadeira(h, 120)), ...[4, 5].map((h) => mamadeira(h, 90)), ...[6, 7].map((h) => mamadeira(h, 60))];
    const l = mamadeirasMaisUsadas(regs, agora);
    expect(l.map((x) => x.ml)).toEqual([120, 90, 30]);
  });

  it('sem histórico: padrões sensatos, no leite materno', () => {
    const a = atalhosMamadeira([], agora);
    expect(a.map((x) => x.rotulo)).toEqual(['90 ml de leite materno', '120 ml de leite materno', '60 ml de leite materno']);
  });

  it('completa com quantidades comuns no leite da última, sem repetir', () => {
    const a = atalhosMamadeira([mamadeira(1, 90)], agora);
    expect(a.map((x) => x.rotulo)).toEqual(['90 ml de fórmula', '120 ml de fórmula', '60 ml de fórmula']);
    expect(a[0].detalhe).toBe('igual à última');
  });
});

describe('atalhos por tipo', () => {
  it('fralda: xixi, cocô e os dois', () => {
    expect(atalhosPara('fralda', { registros: [], agora }).map((a) => a.rotulo)).toEqual(['Xixi', 'Cocô', 'Xixi e cocô']);
  });

  it('sono: dormiu (sem sono aberto) ou acordou (com sono aberto)', () => {
    expect(atalhosPara('sono', { registros: [], agora }).map((a) => a.acao.tipo)).toEqual(['dormiu', 'dormiu']);
    expect(atalhosPara('sono', { registros: [sono(2, null)], agora }).map((a) => a.rotulo)).toEqual(['Acordou agora', 'Acordou há 15 min']);
    // Dormiu há 10 min: não oferece "acordou há 15 min"
    expect(atalhosPara('sono', { registros: [sono(10 / 60, null)], agora }).map((a) => a.rotulo)).toEqual(['Acordou agora']);
  });

  it('mamada: o lado sugerido (o outro da última) vem primeiro; com mamada aberta, nada', () => {
    const a = atalhosPara('mamada', { registros: [mamada(2, 'E')], agora });
    expect(a.map((x) => x.rotulo)).toEqual(['Peito direito', 'Peito esquerdo']);
    expect(a[0].detalhe).toContain('sugerido');
    expect(atalhosPara('mamada', { registros: [mamada(0.1, 'E', true)], agora })).toEqual([]);
  });

  it('remédio: só os em uso', () => {
    const r = (id: string, ativo: boolean, termina_em: string | null = null): Remedio => ({ id, familia_id: 'f', criado_por: null, bebe_id: 'b', nome: id, dose: '2 gotas', intervalo_h: 24, ativo, observacao: null, termina_em }) as Remedio;
    const a = atalhosPara('remedio', { registros: [], agora, hoje: '2026-10-28', remedios: [r('Vitamina D', true), r('Velho', false), r('Acabou', true, '2026-10-01')] });
    expect(a.map((x) => x.rotulo)).toEqual(['Vitamina D']);
  });

  it('extração: as combinações mais repetidas', () => {
    const ex = (h: number, e: number, d: number): Registro => ({ ...base, id: `e${n++}`, tipo: 'extracao', inicio: haH(h), fim: haH(h), dados: { ml_e: e, ml_d: d } });
    const a = atalhosPara('extracao', { registros: [ex(1, 60, 50), ex(30, 60, 50), ex(50, 40, 0), ex(24 * 40, 10, 10)], agora });
    expect(a.map((x) => x.rotulo)).toEqual(['60 ml E + 50 ml D', '40 ml E']);
  });
});

describe('aplicarAtalho', () => {
  it('mamadeira: cria o registro agora e o desfazer exclui', () => {
    const res = aplicarAtalho({ tipo: 'mamadeira', ml: 120, conteudo: 'formula' }, { registros: [], base: novaBase(), agora });
    if (!res.ok) throw new Error(res.texto);
    expect(res.registro).toMatchObject({ tipo: 'mamadeira', inicio: agora.toISOString(), fim: agora.toISOString(), dados: { ml: 120, conteudo: 'formula' }, criado_por: 'u1' });
    expect(res.texto).toBe('Mamadeira registrada (120 ml de fórmula)');
    expect(res.desfazer).toEqual([{ tipo: 'excluir', dado: { alvo: 'registro', id: res.registro.id } }]);
  });

  it('fralda', () => {
    const res = aplicarAtalho({ tipo: 'fralda', xixi: true, coco: true }, { registros: [], base: novaBase(), agora });
    expect(res.ok && res.registro.dados).toEqual({ xixi: true, coco: true, cor: null });
    expect(res.texto).toBe('Fralda registrada (xixi e cocô)');
  });

  it('mamada: inicia o cronômetro; recusa se já tem uma aberta', () => {
    const res = aplicarAtalho({ tipo: 'mamada', lado: 'D' }, { registros: [], base: novaBase(), agora });
    expect(res.ok && res.registro).toMatchObject({ tipo: 'mamada', fim: null, dados: { segmentos: [{ lado: 'D', fim: null }] } });
    expect(aplicarAtalho({ tipo: 'mamada', lado: 'D' }, { registros: [mamada(0.1, 'E', true)], base: novaBase(), agora }).ok).toBe(false);
  });

  it('dormiu há 15 min e acordou agora (desfazer devolve o sono aberto)', () => {
    const d = aplicarAtalho({ tipo: 'dormiu', haMin: 15 }, { registros: [], base: novaBase(), agora });
    if (!d.ok) throw new Error();
    expect(d.registro.inicio).toBe(new Date(agora.getTime() - 15 * 60_000).toISOString());
    expect(d.registro.fim).toBeNull();
    expect(aplicarAtalho({ tipo: 'dormiu', haMin: 0 }, { registros: [d.registro], base: novaBase(), agora }).ok).toBe(false);

    const aberto = sono(1.5, null);
    const a = aplicarAtalho({ tipo: 'acordou', haMin: 0 }, { registros: [aberto], base: novaBase(), agora });
    if (!a.ok) throw new Error();
    expect(a.registro).toMatchObject({ id: aberto.id, fim: agora.toISOString() });
    expect(a.texto).toBe('Sono salvo (1h 30min)');
    expect(a.desfazer).toEqual([{ tipo: 'registro', dado: aberto }]);
    expect(aplicarAtalho({ tipo: 'acordou', haMin: 0 }, { registros: [], base: novaBase(), agora }).ok).toBe(false);
  });

  it('remédio e extração', () => {
    const r = aplicarAtalho({ tipo: 'remedio', remedio_id: 'vitd', nome: 'Vitamina D', dose: '2 gotas' }, { registros: [], base: novaBase(), agora });
    expect(r.ok && r.registro.dados).toEqual({ remedio_id: 'vitd', nome: 'Vitamina D', dose: '2 gotas' });
    const e = aplicarAtalho({ tipo: 'extracao', ml_e: 60, ml_d: 50 }, { registros: [], base: novaBase(), agora });
    expect(e.texto).toBe('Extração registrada (110 ml)');
  });
});
