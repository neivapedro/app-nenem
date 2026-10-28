import { describe, expect, it } from 'vitest';
import { animarPopstate, escolherCartao, fracaoVisivel, geometria, Nomes, rotaDoEndereco, variaveisCss, voltaComZoom, type Registro } from './zoom';

describe('rotaDoEndereco', () => {
  it('tira o caminho base e a barra do fim', () => {
    expect(rotaDoEndereco('/mais/resumo/')).toBe('/mais/resumo');
    expect(rotaDoEndereco('/', '/')).toBe('/');
    expect(rotaDoEndereco('/app-nenem/mais', '/app-nenem/')).toBe('/mais');
    expect(rotaDoEndereco('/app-nenem/', '/app-nenem/')).toBe('/');
    expect(rotaDoEndereco('/app-nenem', '/app-nenem/')).toBe('/');
    // Só tira o base inteiro, não um pedaço do nome
    expect(rotaDoEndereco('/app-nenemx/mais', '/app-nenem/')).toBe('/app-nenemx/mais');
  });
});

describe('fracaoVisivel / escolherCartao', () => {
  it('mede quanto do cartão está na tela', () => {
    expect(fracaoVisivel({ x: 10, y: 10, w: 100, h: 100 }, 390, 800)).toBe(1);
    expect(fracaoVisivel({ x: 10, y: 750, w: 100, h: 100 }, 390, 800)).toBeCloseTo(0.5);
    expect(fracaoVisivel({ x: 10, y: 900, w: 100, h: 100 }, 390, 800)).toBe(0);
    expect(fracaoVisivel({ x: 10, y: 10, w: 0, h: 0 }, 390, 800)).toBe(0);
  });
  it('escolhe o mais visível e ignora o desconectado ou escondido', () => {
    const lista = [
      { item: 'saindo', conectado: false, ret: { x: 0, y: 0, w: 100, h: 100 } },
      { item: 'meio', conectado: true, ret: { x: 0, y: 760, w: 100, h: 100 } },
      { item: 'inteiro', conectado: true, ret: { x: 0, y: 100, w: 100, h: 100 } },
    ];
    expect(escolherCartao(lista, 390, 800)).toBe('inteiro');
    expect(escolherCartao(lista.slice(0, 2), 390, 800)).toBe('meio');
    expect(escolherCartao([{ item: 'fora', conectado: true, ret: { x: 0, y: 790, w: 100, h: 100 } }], 390, 800)).toBeNull();
    expect(escolherCartao([], 390, 800)).toBeNull();
  });
});

describe('geometria', () => {
  it('encaixa a tela inteira no cartão sem achatar', () => {
    const g = geometria({ x: 16, y: 200, w: 175, h: 148 }, 390, 844, 18);
    expect(g.s).toBeCloseTo(175 / 390);
    // A parte visível (antes da escala) tem a altura do cartão depois da escala
    expect((844 - g.corte) * g.s).toBeCloseTo(148);
    expect(g.r * g.s).toBeCloseTo(18);
    expect(g.x).toBe(16);
    expect(g.y).toBe(200);
  });
  it('cartão alto ou maior que a tela não gera recorte negativo nem escala maior que 1', () => {
    const alto = geometria({ x: 0, y: 0, w: 100, h: 2000 }, 390, 844, 10);
    expect(alto.corte).toBe(0);
    const largo = geometria({ x: 0, y: 0, w: 800, h: 100 }, 390, 844, 10);
    expect(largo.s).toBe(1);
    expect(geometria({ x: 0, y: 0, w: 0, h: 0 }, 0, 0, -3).r).toBe(0);
  });
  it('as variáveis vão em px', () => {
    const ret = { x: 16.123, y: 200, w: 175, h: 148 };
    const v = variaveisCss(geometria(ret, 390, 844, 18), 390, 844, ret, 18);
    expect(v['--zoom-x']).toBe('16.12px');
    expect(v['--zoom-vw']).toBe('390px');
    expect(Number(v['--zoom-s'])).toBeCloseTo(0.4487, 3);
  });
});

describe('voltaComZoom', () => {
  const reg: Registro = { de: '/mais', para: '/mais/resumo', chave: '/mais/resumo', rolagem: 0 };
  it('encolhe só saindo da tela que o cartão abriu, para a tela do cartão', () => {
    expect(voltaComZoom(reg, '/mais/resumo', '/mais')).toBe(true);
    expect(voltaComZoom(reg, '/mais/resumo/', '/mais/')).toBe(true);
    // Destino ainda desconhecido (botão Voltar): decide depois de desenhar
    expect(voltaComZoom(reg, '/mais/resumo', null)).toBe(true);
    expect(voltaComZoom(reg, '/mais/resumo', '/')).toBe(false);
    expect(voltaComZoom(reg, '/historico', '/mais')).toBe(false);
    expect(voltaComZoom(null, '/mais/resumo', '/mais')).toBe(false);
  });
});

describe('animarPopstate', () => {
  it('não anima por cima do deslizar do Safari', () => {
    expect(animarPopstate(true, true)).toBe(false);
    expect(animarPopstate(false, false)).toBe(true);
    expect(animarPopstate(undefined, true)).toBe(true);
    expect(animarPopstate(undefined, false)).toBe(false);
  });
});

describe('Nomes', () => {
  const el = () => ({ style: { viewTransitionName: '' } });
  it('nunca deixa dois elementos com o mesmo nome', () => {
    const n = new Nomes();
    const a = el();
    const b = el();
    n.nomear(a, 'zoom-cartao');
    n.nomear(b, 'zoom-cartao');
    expect(a.style.viewTransitionName).toBe('');
    expect(b.style.viewTransitionName).toBe('zoom-cartao');
    expect(n.quem('zoom-cartao')).toBe(b);
    expect(n.tamanho).toBe(1);
  });
  it('um elemento fica com um nome só', () => {
    const n = new Nomes();
    const a = el();
    n.nomear(a, 'zoom-cartao');
    n.nomear(a, 'zoom-titulo');
    expect(a.style.viewTransitionName).toBe('zoom-titulo');
    expect(n.quem('zoom-cartao')).toBeUndefined();
    expect(n.tamanho).toBe(1);
  });
  it('limpar tira todos os nomes', () => {
    const n = new Nomes();
    const a = el();
    const b = el();
    n.nomear(a, 'zoom-cartao');
    n.nomear(b, 'zoom-titulo');
    n.limpar();
    expect(a.style.viewTransitionName).toBe('');
    expect(b.style.viewTransitionName).toBe('');
    expect(n.tamanho).toBe(0);
    n.limpar();
    expect(n.tamanho).toBe(0);
  });
});
