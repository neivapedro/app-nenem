import { describe, expect, it } from 'vitest';
import { arquivoDaPrevia, chavePrevia, lerPreferenciaPrevia } from './doc-previa';

const arq = (nome: string, tipo: string, caminho = `c/${nome}`) => ({ caminho, nome, tipo, tamanho: 1 });

describe('prévia do documento', () => {
  it('sem arquivos não tem prévia', () => {
    expect(arquivoDaPrevia([])).toBeNull();
  });
  it('usa o primeiro arquivo, foto ou PDF', () => {
    expect(arquivoDaPrevia([arq('a.jpg', 'image/jpeg'), arq('b.pdf', 'application/pdf')])).toEqual({ caminho: 'c/a.jpg', tipo: 'foto' });
    expect(arquivoDaPrevia([arq('b.pdf', 'application/pdf'), arq('a.png', 'image/png')])).toEqual({ caminho: 'c/b.pdf', tipo: 'pdf' });
  });
  it('pula o que não dá para mostrar', () => {
    expect(arquivoDaPrevia([arq('x.heic', 'image/heic'), arq('a.png', 'image/png')])?.caminho).toBe('c/a.png');
    expect(arquivoDaPrevia([arq('x.doc', 'application/msword')])).toBeNull();
  });
  it('chave do cache junta id e arquivo', () => {
    expect(chavePrevia('d1', 'p/a.jpg')).not.toBe(chavePrevia('d1', 'p/b.jpg'));
    expect(chavePrevia('d1', 'p/a.jpg')).not.toBe(chavePrevia('d2', 'p/a.jpg'));
  });
  it('preferência: padrão ligada', () => {
    expect(lerPreferenciaPrevia(null)).toBe(true);
    expect(lerPreferenciaPrevia('1')).toBe(true);
    expect(lerPreferenciaPrevia('0')).toBe(false);
  });
});
