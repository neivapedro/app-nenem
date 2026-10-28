import { describe, expect, it } from 'vitest';
import {
  alternarFixo,
  alternarOculto,
  CARTOES_HOJE,
  ehPadrao,
  gruposLayout,
  layoutPadrao,
  lerLayout,
  mesclarLayout,
  mover,
  moverPara,
  ordemNaTela,
  serializarLayout,
  type CartaoHoje,
} from './hoje-layout';

const cat = (...ids: string[]): CartaoHoje[] => ids.map((id) => ({ id, nome: id, descricao: '' }) as unknown as CartaoHoje);

describe('mesclarLayout', () => {
  it('sem nada salvo (ou lixo) = ordem padrão', () => {
    expect(mesclarLayout(null).ordem).toEqual(CARTOES_HOJE.map((c) => c.id));
    expect(mesclarLayout('x').ordem).toEqual(CARTOES_HOJE.map((c) => c.id));
    expect(lerLayout('{quebrado')).toEqual(layoutPadrao());
    expect(lerLayout(null)).toEqual(layoutPadrao());
  });

  it('mantém a ordem salva e tira ids que não existem mais e repetidos', () => {
    const l = mesclarLayout({ ordem: ['c', 'velho', 'a', 'b', 'a'], ocultos: ['velho', 'b'], fixos: ['velho', 'c'] }, cat('a', 'b', 'c'));
    expect(l).toEqual({ ordem: ['c', 'a', 'b'], ocultos: ['b'], fixos: ['c'] });
  });

  it('cartão novo entra logo depois do vizinho anterior na ordem padrão', () => {
    // Usuário trocou: c, a, b. Versão nova tem "n" entre a e b
    const l = mesclarLayout({ ordem: ['c', 'a', 'b'] }, cat('a', 'n', 'b', 'c'));
    expect(l.ordem).toEqual(['c', 'a', 'n', 'b']);
  });

  it('cartão novo no começo do catálogo vai para o começo', () => {
    expect(mesclarLayout({ ordem: ['b', 'a'] }, cat('n', 'a', 'b')).ordem).toEqual(['n', 'b', 'a']);
  });

  it('vários novos seguidos ficam na ordem padrão', () => {
    expect(mesclarLayout({ ordem: ['b', 'a'] }, cat('a', 'n1', 'n2', 'b')).ordem).toEqual(['b', 'a', 'n1', 'n2']);
  });

  it('não deixa esconder o que não é ocultável', () => {
    const l = mesclarLayout({ ordem: [], ocultos: ['registrar', 'recentes'] });
    expect(l.ocultos).toEqual(['recentes']);
  });

  it('escondido não fica fixado', () => {
    expect(mesclarLayout({ ocultos: ['b'], fixos: ['b'] }, cat('a', 'b')).fixos).toEqual([]);
  });

  it('ida e volta pelo texto', () => {
    const l = { ordem: ['b', 'a', 'c'], ocultos: ['c'], fixos: ['a'] };
    expect(lerLayout(serializarLayout(l), cat('a', 'b', 'c'))).toEqual(l);
  });
});

describe('grupos e ordem na tela', () => {
  it('fixados primeiro (na ordem em que foram fixados), escondidos fora', () => {
    const l = { ordem: ['a', 'b', 'c', 'd'], ocultos: ['b'], fixos: ['d', 'c'] };
    expect(gruposLayout(l)).toEqual({ fixos: ['d', 'c'], soltos: ['a'], ocultos: ['b'] });
    expect(ordemNaTela(l)).toEqual(['d', 'c', 'a']);
  });
});

describe('mover', () => {
  const c = cat('a', 'b', 'c', 'd');
  it('▲▼ troca com o vizinho visível, pulando escondidos', () => {
    const l = { ordem: ['a', 'b', 'c', 'd'], ocultos: ['b'], fixos: [] };
    const m = mover(l, 'c', -1);
    expect(ordemNaTela(m)).toEqual(['c', 'a', 'd']);
    // O escondido continua na vaga dele
    expect(m.ordem).toEqual(['c', 'b', 'a', 'd']);
  });

  it('não passa da borda do grupo', () => {
    const l = { ...layoutPadrao(c), fixos: ['c'] };
    expect(mover(l, 'c', -1)).toBe(l);
    expect(mover(l, 'a', -1)).toBe(l);
    expect(mover(l, 'd', 1)).toBe(l);
  });

  it('dentro dos fixados', () => {
    const l = { ...layoutPadrao(c), fixos: ['c', 'a'] };
    expect(mover(l, 'a', -1).fixos).toEqual(['a', 'c']);
  });

  it('moverPara (arrastar) leva para a posição do grupo', () => {
    const l = layoutPadrao(c);
    expect(moverPara(l, 'a', 3).ordem).toEqual(['b', 'c', 'd', 'a']);
    expect(moverPara(l, 'd', 0).ordem).toEqual(['d', 'a', 'b', 'c']);
    expect(moverPara(l, 'b', 99).ordem).toEqual(['a', 'c', 'd', 'b']);
  });
});

describe('fixar e esconder', () => {
  const c = cat('a', 'b', 'c');
  it('fixar entra no fim dos fixados; soltar volta para o lugar de antes', () => {
    let l = layoutPadrao(c);
    l = alternarFixo(l, 'c');
    l = alternarFixo(l, 'b');
    expect(ordemNaTela(l)).toEqual(['c', 'b', 'a']);
    l = alternarFixo(l, 'c');
    expect(ordemNaTela(l)).toEqual(['b', 'a', 'c']);
  });

  it('esconder solta o fixado; mostrar volta para o lugar', () => {
    let l = alternarFixo(layoutPadrao(c), 'b');
    l = alternarOculto(l, 'b', c);
    expect(l.fixos).toEqual([]);
    expect(ordemNaTela(l)).toEqual(['a', 'c']);
    l = alternarOculto(l, 'b', c);
    expect(ordemNaTela(l)).toEqual(['a', 'b', 'c']);
  });

  it('botões de registro não se escondem', () => {
    const l = layoutPadrao();
    expect(alternarOculto(l, 'registrar')).toBe(l);
  });

  it('ehPadrao', () => {
    expect(ehPadrao(layoutPadrao())).toBe(true);
    expect(ehPadrao(alternarFixo(layoutPadrao(), 'resumo'))).toBe(false);
    expect(ehPadrao(mover(layoutPadrao(), 'resumo', -1))).toBe(false);
  });
});
