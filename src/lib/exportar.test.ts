import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { csvCofrinho, juntarRegistros, listaDocumentos, montarZip, planejarArquivos, planejarDocumentos } from './exportar';
import type { Documento, Marco, MovimentoCofrinho, Registro } from './tipos';

const arq = (caminho: string, tipo = 'application/pdf') => ({ caminho, nome: caminho, tipo, tamanho: 10 });

describe('exportar tudo', () => {
  it('dá um lugar único no .zip para cada arquivo', () => {
    const docs = [
      { id: '1', categoria: 'identificacao', titulo: 'RG', arquivos: [arq('a.pdf'), arq('b.jpg', 'image/jpeg')] },
      { id: '2', categoria: 'identificacao', titulo: 'RG', arquivos: [arq('c.pdf')] },
      { id: '3', categoria: 'familia', titulo: 'CNH/Pedro', arquivos: [arq('d.pdf')] },
    ] as unknown as Documento[];
    const movs = [{ id: 'm', conta_id: 'c1', data: '2026-11-20', de: 'Vovó', comprovante: arq('e.jpg', 'image/jpeg') }] as unknown as MovimentoCofrinho[];
    const marcos = [{ id: 'k', tipo: 'mes', data: '2026-12-10', titulo: null, marco_id: null, foto: 'f.jpg' }] as unknown as Marco[];
    const l = planejarArquivos(docs, movs, [{ id: 'c1', nome: 'Caixinha' }] as never, marcos);
    expect(l.map((a) => a.destino).sort()).toEqual(
      [
        'documentos/Identificação/RG - 1.pdf',
        'documentos/Identificação/RG - 2.jpg',
        'documentos/Identificação/RG.pdf',
        'documentos/Família/CNH-Pedro.pdf',
        'cofrinho/comprovantes/2026-11-20 Caixinha Vovó.jpg',
        'fotos/2026-12-10 foto do mês.jpg',
      ].sort(),
    );
    expect(new Set(l.map((a) => a.destino)).size).toBe(l.length);
    expect(l.find((a) => a.caminho === 'f.jpg')?.balde).toBe('fotos');

    // Só os documentos (aba Documentos): mesma regra de nomes, sem a pasta "documentos/"
    const so = planejarDocumentos(docs, 'Documentos do Heitor');
    expect(so.map((a) => a.destino)).toContain('Documentos do Heitor/Identificação/RG.pdf');
    expect(so.every((a) => a.documento)).toBe(true);
    const lista = listaDocumentos(
      [{ ...docs[0], numero: '12.345.678-9', validade: '2030-01-02' } as Documento],
      new Map(so.map((a) => [a.caminho, a.destino])),
      'Heitor',
    );
    expect(lista).toContain('Número: 12.345.678-9');
    expect(lista).toContain('Validade: 02/01/2030');
    expect(lista).toContain('Identificação/RG - 1.pdf');
  });

  it('junta registros sem repetir e monta o .zip', () => {
    const r = (id: string, inicio: string, obs: string | null = null) => ({ id, inicio, observacao: obs }) as unknown as Registro;
    const todos = juntarRegistros([r('a', '2026-11-12T10:00:00Z'), r('b', '2026-11-11T10:00:00Z')], [r('a', '2026-11-12T10:00:00Z', 'nova')]);
    expect(todos.map((x) => x.id)).toEqual(['b', 'a']);
    expect(todos[1].observacao).toBe('nova');
    const zip = montarZip('Heitor', {
      dados: { ok: 1 },
      textos: { 'a.csv': csvCofrinho([], []) },
      arquivos: [{ destino: 'fotos/x.jpg', bytes: new Uint8Array([1, 2, 3]) }],
    });
    const z = unzipSync(zip);
    expect(Object.keys(z).sort()).toEqual(['Heitor/a.csv', 'Heitor/dados.json', 'Heitor/fotos/x.jpg']);
    expect(JSON.parse(strFromU8(z['Heitor/dados.json']))).toEqual({ ok: 1 });
    expect([...z['Heitor/fotos/x.jpg']]).toEqual([1, 2, 3]);
  });
});
