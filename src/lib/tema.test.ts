import indexHtml from '../../index.html?raw';
import { describe, expect, it } from 'vitest';
import {
  ambarLigado,
  calcularTema,
  CORES,
  corDaBarra,
  COR_NOITE,
  FUNDOS,
  normalizarAparencia,
  proximaVirada,
  trocarEsquema,
  type Aparencia,
  type CorDestaque,
  type ModoTema,
} from './tema';

// O Vitest entrega .css vazio (mesmo com ?raw): o texto vem direto do disco. Tipado aqui mesmo,
// porque o tsconfig do app não inclui os tipos do Node.
type Fs = { readFileSync(caminho: URL, cod: 'utf8'): string };
const fs = (globalThis as unknown as { process: { getBuiltinModule(m: 'node:fs'): Fs } }).process.getBuiltinModule('node:fs');
const estilosCss = fs.readFileSync(new URL('../estilos.css', import.meta.url), 'utf8');
const temaCss = fs.readFileSync(new URL('../estilos/tema.css', import.meta.url), 'utf8');
// Arquivos da tela de abertura que existem em public/abertura (só os nomes; nada é carregado)
const ABERTURAS = Object.keys(import.meta.glob('../../public/abertura/*.png')).map((k) => k.replace('../../public/', ''));
const MODOS: ModoTema[] = ['auto', 'sistema', 'claro', 'escuro'];
const CORES_V = CORES.map((c) => c.valor);
const em = (h: number, min = 0) => new Date(2026, 9, 28, h, min);

describe('tema pela hora', () => {
  const auto: Aparencia = { modo: 'auto', cor: 'padrao', ambar: null };
  it('manhã fria, tarde quente, noitinha escura e madrugada âmbar', () => {
    expect(calcularTema(auto, em(6), false)).toMatchObject({ tema: 'claro', tom: 'frio' });
    expect(calcularTema(auto, em(11, 59), true)).toMatchObject({ tema: 'claro', tom: 'frio' });
    expect(calcularTema(auto, em(12), false)).toMatchObject({ tema: 'claro', tom: 'quente' });
    expect(calcularTema(auto, em(17, 59), false)).toMatchObject({ tema: 'claro', tom: 'quente' });
    expect(calcularTema(auto, em(18), false)).toMatchObject({ tema: 'escuro', tom: null });
    expect(calcularTema(auto, em(21, 59), false)).toMatchObject({ tema: 'escuro' });
    expect(calcularTema(auto, em(22), false)).toMatchObject({ tema: 'noite' });
    expect(calcularTema(auto, em(3), false)).toMatchObject({ tema: 'noite' });
    expect(calcularTema(auto, em(5, 59), false)).toMatchObject({ tema: 'noite' });
  });
  it('sem a noite âmbar, a madrugada do automático fica no escuro', () => {
    expect(calcularTema({ ...auto, ambar: false }, em(2), false)).toMatchObject({ tema: 'escuro' });
  });
  it('outros modos: âmbar só se ligado', () => {
    const claro: Aparencia = { modo: 'claro', cor: 'azul', ambar: null };
    expect(ambarLigado(claro)).toBe(false);
    expect(calcularTema(claro, em(23), false).tema).toBe('claro');
    expect(calcularTema({ ...claro, ambar: true }, em(23), false).tema).toBe('noite');
    expect(calcularTema({ ...claro, ambar: true }, em(15), false)).toMatchObject({ tema: 'claro', tom: null });
    expect(calcularTema({ modo: 'sistema', cor: 'padrao', ambar: null }, em(15), true).tema).toBe('escuro');
    expect(calcularTema({ modo: 'sistema', cor: 'padrao', ambar: null }, em(15), false).tema).toBe('claro');
    expect(calcularTema({ modo: 'escuro', cor: 'padrao', ambar: null }, em(9), false).tema).toBe('escuro');
  });
  it('próxima virada', () => {
    expect(proximaVirada(em(5, 30)).getHours()).toBe(6);
    expect(proximaVirada(em(6)).getHours()).toBe(12);
    expect(proximaVirada(em(13)).getHours()).toBe(18);
    expect(proximaVirada(em(19)).getHours()).toBe(22);
    const d = proximaVirada(em(23));
    expect([d.getDate(), d.getHours()]).toEqual([29, 6]);
  });
  it('preferência guardada estragada volta ao padrão', () => {
    expect(normalizarAparencia({ modo: 'rosa', cor: 3, ambar: 'sim' })).toEqual({ modo: 'auto', cor: 'padrao', ambar: null });
    expect(normalizarAparencia(null)).toEqual({ modo: 'auto', cor: 'padrao', ambar: null });
  });
});

describe('script do index.html (antes do primeiro desenho)', () => {
  const html = indexHtml;
  const codigo = html.match(/<script>\s*([\s\S]*?)<\/script>/)![1];

  function rodar(guardado: string | null, hora: number, sistemaEscuro: boolean) {
    const attrs: Record<string, string> = {};
    let barra = '';
    const RealDate = Date;
    class DataFalsa extends RealDate {
      constructor() {
        super(2026, 9, 28, hora, 30);
      }
    }
    const fn = new Function('localStorage', 'document', 'window', 'matchMedia', 'Date', codigo);
    const mm = (q: string) => ({ matches: q.includes('dark') && sistemaEscuro });
    fn(
      { getItem: () => guardado },
      { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) }, querySelector: () => ({ setAttribute: (_: string, v: string) => (barra = v) }) },
      { matchMedia: mm },
      mm,
      DataFalsa,
    );
    return { attrs, barra };
  }

  it('dá o mesmo tema que src/lib/tema.ts em toda combinação', () => {
    for (const modo of MODOS)
      for (const ambar of [null, true, false])
        for (const cor of CORES_V)
          for (const sis of [false, true])
            for (let h = 0; h < 24; h++) {
              const a: Aparencia = { modo, cor, ambar };
              const e = calcularTema(a, em(h, 30), sis);
              const { attrs, barra } = rodar(JSON.stringify(a), h, sis);
              expect(attrs['data-tema'], `${modo} ${ambar} ${h}h`).toBe(e.tema);
              expect(attrs['data-tom'] ?? null).toBe(e.tom);
              expect(attrs['data-cor']).toBe(cor);
              expect(attrs['data-theme']).toBe(e.tema === 'claro' ? 'light' : 'dark');
              expect(barra).toBe(corDaBarra(e));
            }
  });
  it('sem nada guardado ou com lixo: automático', () => {
    expect(rodar(null, 9, true).attrs).toMatchObject({ 'data-tema': 'claro', 'data-tom': 'frio', 'data-cor': 'padrao' });
    expect(rodar('{quebrado', 23, false).attrs['data-tema']).toBe('noite');
  });
  it('tem a tela de abertura de cada iPhone (sempre a escura) e os arquivos existem', () => {
    const links = [...html.matchAll(/<link rel="apple-touch-startup-image" media="([^"]+)" href="\/([^"]+)"/g)];
    expect(links.length).toBeGreaterThanOrEqual(12);
    for (const [, media, arq] of links) {
      expect(media).toMatch(/device-width: \d+px\) and \(device-height: \d+px\) and \(-webkit-device-pixel-ratio: [23]\) and \(orientation: portrait\)$/);
      // O tema padrão é pela hora: a abertura não pode seguir o modo do iPhone (clarão de madrugada)
      expect(media).not.toMatch(/prefers-color-scheme/);
      expect(arq).toMatch(/-escuro\.png$/);
      expect(ABERTURAS, arq).toContain(arq);
    }
    expect(new Set(links.map((l) => l[1])).size).toBe(links.length);
    expect(ABERTURAS).toHaveLength(links.length);
  });
});

describe('@media (prefers-color-scheme) segue o tema do app', () => {
  it('troca a condição por sempre/nunca', () => {
    expect(trocarEsquema('(prefers-color-scheme: dark)', true)).toBe('(min-width: 0px)');
    expect(trocarEsquema('(prefers-color-scheme: dark)', false)).toBe('(max-width: 0.01px)');
    expect(trocarEsquema('(prefers-color-scheme: light)', false)).toBe('(min-width: 0px)');
    expect(trocarEsquema('screen and (prefers-color-scheme: light) and (max-width: 400px)', true)).toBe('screen and (max-width: 0.01px) and (max-width: 400px)');
  });
});

// ---------- Contraste: resolve os tokens do CSS como o navegador faria ----------

type Attrs = { tema: string; tom?: string; cor: string; theme: string };

function regrasDeRaiz(css: string) {
  let s = css.replace(/\/\*[\s\S]*?\*\//g, '');
  // Tira os blocos @media/@supports/@keyframes (com chaves aninhadas)
  for (;;) {
    const i = s.search(/@[a-z-]+[^{;]*\{/);
    if (i < 0) break;
    let j = s.indexOf('{', i) + 1;
    for (let prof = 1; prof > 0; j++) prof += s[j] === '{' ? 1 : s[j] === '}' ? -1 : 0;
    s = s.slice(0, i) + s.slice(j);
  }
  return [...s.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    seletores: m[1].split(',').map((x) => x.trim()),
    decl: [...m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);?/g)].map((d) => [d[1], d[2].trim()] as const),
  }));
}

/** Especificidade (ou null se o seletor não vale para o <html> com estes atributos) */
function casa(sel: string, a: Attrs): number | null {
  if (!sel.startsWith(':root')) return null;
  let resto = sel.slice(5);
  let esp = 1;
  const valor = (nome: string) => ({ 'data-tema': a.tema, 'data-tom': a.tom, 'data-cor': a.cor, 'data-theme': a.theme })[nome];
  const testa = (nome: string, v?: string) => (v === undefined ? valor(nome) !== undefined : valor(nome) === v);
  while (resto) {
    let m = resto.match(/^\[([\w-]+)(?:="([^"]*)")?\]/);
    if (m) {
      if (!testa(m[1], m[2])) return null;
    } else if ((m = resto.match(/^:not\(\[([\w-]+)(?:="([^"]*)")?\]\)/))) {
      if (testa(m[1], m[2])) return null;
    } else return null;
    esp++;
    resto = resto.slice(m[0].length);
  }
  return esp;
}

const regras = [...regrasDeRaiz(estilosCss), ...regrasDeRaiz(temaCss)];
function tokens(a: Attrs) {
  const valores: { esp: number; ordem: number; nome: string; v: string }[] = [];
  regras.forEach((r, ordem) => {
    const esp = Math.max(-1, ...r.seletores.map((s) => casa(s, a) ?? -1));
    if (esp >= 0) r.decl.forEach(([nome, v]) => valores.push({ esp, ordem, nome, v }));
  });
  valores.sort((x, y) => x.esp - y.esp || x.ordem - y.ordem);
  const t: Record<string, string> = {};
  for (const x of valores) t[x.nome] = x.v;
  const res = (n: string, prof = 0): string => {
    const v = t[n];
    const m = v?.match(/^var\((--[\w-]+)\)$/);
    return m && prof < 5 ? res(m[1], prof + 1) : v;
  };
  return res;
}

const rgb = (h: string) => {
  expect(h, 'cor em hex').toMatch(/^#[0-9a-f]{6}$/i);
  const n = parseInt(h.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
const lin = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
function oklab(h: string) {
  const [r, g, b] = rgb(h).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

const VARIANTES: Omit<Attrs, 'cor'>[] = [
  { tema: 'claro', theme: 'light' },
  { tema: 'claro', tom: 'frio', theme: 'light' },
  { tema: 'claro', tom: 'quente', theme: 'light' },
  { tema: 'escuro', theme: 'dark' },
  { tema: 'noite', theme: 'dark' },
];
const TIPOS = ['--c-mamada', '--c-mamadeira', '--c-fralda', '--c-sono', '--c-agenda'];

describe('contraste AA em todos os temas e cores', () => {
  for (const v of VARIANTES)
    for (const cor of CORES_V as CorDestaque[]) {
      const nome = `${v.tema}${v.tom ? '-' + v.tom : ''} · ${cor}`;
      it(nome, () => {
        const t = tokens({ ...v, cor });
        const fundos = ['--fundo', '--superficie', '--superficie-2'].map(t);
        for (const f of fundos) {
          for (const texto of ['--texto', '--texto-2', '--texto-3', '--destaque'])
            expect(contraste(t(texto), f), `${texto} sobre ${f}`).toBeGreaterThanOrEqual(4.5);
        }
        // Texto do botão principal / aba / chip marcado
        expect(contraste(t('--destaque-texto'), t('--destaque'))).toBeGreaterThanOrEqual(4.5);
        // Cores dos tipos como texto, sobre o cartão e o fundo
        for (const c of TIPOS) for (const f of [t('--superficie'), t('--fundo')]) expect(contraste(t(c), f), `${c} sobre ${f}`).toBeGreaterThanOrEqual(4.5);
        // A barra do sistema tem a cor do fundo
        expect(t('--fundo').toLowerCase()).toBe(corDaBarra({ tema: v.tema as 'claro', tom: (v.tom as 'frio') ?? null }));
      });
    }

  it('as amostras de Ajustes são as cores do CSS', () => {
    for (const c of CORES) {
      expect(tokens({ tema: 'claro', theme: 'light', cor: c.valor })('--destaque')).toBe(c.claro);
      expect(tokens({ tema: 'escuro', theme: 'dark', cor: c.valor })('--destaque')).toBe(c.escuro);
      expect(tokens({ tema: 'noite', theme: 'dark', cor: c.valor })('--destaque')).toBe(COR_NOITE);
    }
    expect(Object.values(FUNDOS)).toHaveLength(5);
  });

  it('noite âmbar: sem azul nem branco forte, tipos ainda distinguíveis', () => {
    const t = tokens({ tema: 'noite', theme: 'dark', cor: 'azul' });
    for (const n of ['--texto', '--texto-2', '--texto-3', '--destaque', '--fundo', '--superficie', '--superficie-2']) {
      const [r, g, b] = rgb(t(n));
      expect(r >= g && g >= b, `${n} quente`).toBe(true);
    }
    // Texto bem mais baixo que o branco do escuro
    expect(lum(t('--texto'))).toBeLessThan(0.5);
    expect(lum(t('--texto'))).toBeLessThan(lum(tokens({ tema: 'escuro', theme: 'dark', cor: 'padrao' })('--texto')) * 0.6);
    // Cada tipo mais apagado que no escuro, mas diferente dos outros (distância OKLab)
    const esc = tokens({ tema: 'escuro', theme: 'dark', cor: 'padrao' });
    for (const c of TIPOS) {
      const [, a1, b1] = oklab(t(c));
      const [, a2, b2] = oklab(esc(c));
      expect(Math.hypot(a1, b1), `${c} menos saturada`).toBeLessThan(Math.hypot(a2, b2));
    }
    for (let i = 0; i < TIPOS.length; i++)
      for (let j = i + 1; j < TIPOS.length; j++) {
        const [l1, a1, b1] = oklab(t(TIPOS[i]));
        const [l2, a2, b2] = oklab(t(TIPOS[j]));
        expect(Math.hypot(l1 - l2, a1 - a2, b1 - b2), `${TIPOS[i]} x ${TIPOS[j]}`).toBeGreaterThanOrEqual(0.06);
      }
  });
});
