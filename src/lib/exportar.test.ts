import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { csvCofrinho, csvRegistros, juntarRegistros, limpar, listaDocumentos, MontadorZip, planejarArquivos, planejarDocumentos } from './exportar';
import type { Documento, Marco, MovimentoCofrinho, Registro } from './tipos';

const arq = (caminho: string, tipo = 'application/pdf') => ({ caminho, nome: caminho, tipo, tamanho: 10 });

describe('exportar tudo', () => {
  const docs = [
    { id: '1', categoria: 'identificacao', titulo: 'RG', arquivos: [arq('a.pdf'), arq('b.jpg', 'image/jpeg')] },
    { id: '2', categoria: 'identificacao', titulo: 'rg', arquivos: [arq('c.pdf', '')] },
    { id: '3', categoria: 'familia', titulo: 'CNH/Pedro', arquivos: [arq('d.pdf')] },
    // Mesmo arquivo em dois documentos
    { id: '4', categoria: 'saude', titulo: 'Cartão do SUS', arquivos: [arq('a.pdf')], numero: '700 0000 0000 0000' },
  ] as unknown as Documento[];

  it('dá a cada arquivo o nome do documento no app, sem repetir', () => {
    const movs = [{ id: 'm', conta_id: 'c1', data: '2026-11-20', de: 'Vovó', comprovante: arq('e.jpg', 'image/jpeg') }] as unknown as MovimentoCofrinho[];
    const marcos = [{ id: 'k', tipo: 'mes', data: '2026-12-10', titulo: '1 mês', marco_id: 'mes-1', foto: 'f.jpg' }] as unknown as Marco[];
    const l = planejarArquivos(docs, movs, [{ id: 'c1', nome: 'Caixinha' }] as never, marcos);
    expect(l.map((a) => a.destino).sort()).toEqual(
      [
        'documentos/Identificação/RG - 1.pdf',
        'documentos/Identificação/RG - 2.jpg',
        'documentos/Identificação/rg.pdf',
        'documentos/Família/CNH-Pedro.pdf',
        'documentos/Saúde/Cartão do SUS.pdf',
        'cofrinho/comprovantes/2026-11-20 Caixinha Vovó.jpg',
        'fotos/2026-12-10 Foto do mês 01 - 1 mês.jpg',
      ].sort(),
    );
    expect(l.find((a) => a.caminho === 'f.jpg')?.balde).toBe('fotos');
    const iguais = [
      { id: 'x', categoria: 'exames', titulo: 'Exame', arquivos: [arq('x.pdf')] },
      { id: 'y', categoria: 'exames', titulo: 'exame', arquivos: [arq('y.jpg', 'image/jpeg'), arq('z.pdf')].slice(0, 1) },
      { id: 'w', categoria: 'exames', titulo: 'Exame', arquivos: [arq('w.pdf')] },
    ] as unknown as Documento[];
    expect(planejarDocumentos(iguais).map((a) => a.destino)).toEqual(['Exames/exame.jpg', 'Exames/Exame.pdf', 'Exames/Exame (2).pdf']);
  });

  it('limpa nomes perigosos', () => {
    expect(limpar('..')).toBe('arquivo');
    expect(limpar('.oculto')).toBe('oculto');
    expect(limpar('a\tb\u0001c')).toBe('a b c');
    expect(limpar('Certidão')).toBe('Certidão'.normalize('NFC'));
  });

  it('a lista casa cada documento com o seu arquivo (mesmo arquivo em dois documentos)', () => {
    const so = planejarDocumentos(docs, 'Documentos do Heitor');
    const lista = listaDocumentos(docs, so, 'Documentos do Heitor');
    expect(lista).toContain('Número: 700 0000 0000 0000');
    expect(lista).toMatch(/Cartão do SUS\n {2}Número: [^\n]+\n {2}Arquivos: Saúde\/Cartão do SUS\.pdf/);
    expect(lista).toContain('Arquivos: Identificação/RG - 1.pdf, Identificação/RG - 2.jpg');
    // Um que não baixou
    expect(listaDocumentos(docs, so.slice(1), 'X')).toContain('1 arquivo(s) não baixado(s)');
  });

  it('junta registros sem repetir e monta o .zip aos poucos', () => {
    const r = (id: string, inicio: string, obs: string | null = null) => ({ id, inicio, observacao: obs }) as unknown as Registro;
    const todos = juntarRegistros([r('a', '2026-11-12T10:00:00Z'), r('b', '2026-11-11T10:00:00Z')], [r('a', '2026-11-12T10:00:00Z', 'nova')]);
    expect(todos.map((x) => x.id)).toEqual(['b', 'a']);
    expect(todos[1].observacao).toBe('nova');
    const z = new MontadorZip();
    z.adicionar('Heitor/fotos/x.jpg', new Uint8Array([1, 2, 3]));
    z.adicionarTexto('Heitor/a.csv', csvCofrinho([], []));
    z.adicionarTexto('Heitor/dados.json', JSON.stringify({ ok: 1 }));
    return z
      .terminar()
      .arrayBuffer()
      .then((buf) => {
        const u = unzipSync(new Uint8Array(buf));
        expect(Object.keys(u).sort()).toEqual(['Heitor/a.csv', 'Heitor/dados.json', 'Heitor/fotos/x.jpg']);
        expect(JSON.parse(strFromU8(u['Heitor/dados.json']))).toEqual({ ok: 1 });
        expect([...u['Heitor/fotos/x.jpg']]).toEqual([1, 2, 3]);
      });
  });
});

describe('planilha dos registros', () => {
  it('tem colunas só com números para somar no Excel', () => {
    const base = { familia_id: 'f', bebe_id: 'b', criado_por: null, observacao: null };
    const regs = [
      { ...base, id: '1', tipo: 'mamadeira', inicio: '2026-11-15T13:00:00.000Z', fim: '2026-11-15T13:00:00.000Z', dados: { ml: 90, conteudo: 'formula' } },
      { ...base, id: '2', tipo: 'temperatura', inicio: '2026-11-15T14:00:00.000Z', fim: '2026-11-15T14:00:00.000Z', dados: { graus: 37.8 } },
      { ...base, id: '3', tipo: 'fralda', inicio: '2026-11-15T15:00:00.000Z', fim: '2026-11-15T15:00:00.000Z', dados: { xixi: true, coco: true, cor: 'amarela' } },
      { ...base, id: '4', tipo: 'sono', inicio: '2026-11-15T16:00:00.000Z', fim: '2026-11-15T17:30:00.000Z', dados: {} },
    ] as unknown as Registro[];
    const linhas = csvRegistros(regs, new Date('2026-11-16T00:00:00Z'), () => 'Pedro').replace('﻿', '').split('\n').map((l) => l.split(';'));
    const col = (nome: string) => linhas[0].indexOf(nome);
    expect(linhas[1][col('ml')]).toBe('90');
    expect(linhas[2][col('temperatura_c')]).toBe('37,8');
    expect([linhas[3][col('xixi')], linhas[3][col('coco')], linhas[3][col('cor_coco')]]).toEqual(['1', '1', 'amarela']);
    expect(linhas[4][col('duracao_min')]).toBe('90,0');
  });
});
