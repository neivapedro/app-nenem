import { describe, expect, it } from 'vitest';
import type { Compromisso, Registro } from '../lib/tipos';
import { aplicarFila, enfileirar, LISTAS_VAZIAS, type ItemFila } from './fila';

const reg = (id: string, inicio: string, ml = 60): Registro => ({
  id,
  familia_id: 'f',
  bebe_id: 'b',
  criado_por: 'u',
  tipo: 'mamadeira',
  inicio,
  fim: inicio,
  observacao: null,
  dados: { ml, conteudo: 'materno' },
});

describe('fila offline', () => {
  it('a edição mais nova do mesmo registro substitui a anterior', () => {
    let fila: ItemFila[] = [];
    fila = enfileirar(fila, { tipo: 'registro', dado: reg('a', '2026-11-15T10:00:00.000Z', 60) }, 1);
    fila = enfileirar(fila, { tipo: 'registro', dado: reg('b', '2026-11-15T11:00:00.000Z') }, 2);
    fila = enfileirar(fila, { tipo: 'registro', dado: reg('a', '2026-11-15T10:00:00.000Z', 90) }, 3);
    // A edição fica no lugar da anterior (a ordem entre itens diferentes se mantém)
    expect(fila.map((i) => [i.chave, i.versao])).toEqual([
      ['registro:a', 3],
      ['registro:b', 2],
    ]);
    // Excluir substitui a edição pendente
    fila = enfileirar(fila, { tipo: 'excluir', dado: { alvo: 'registro', id: 'b' } }, 4);
    expect(fila.map((i) => i.tipo)).toEqual(['registro', 'excluir']);
  });

  it('editar a conta depois de lançar um depósito nela não inverte a ordem (chave estrangeira)', () => {
    let fila: ItemFila[] = [];
    const conta = (pix: string) => ({ tipo: 'colecao', colecao: 'cofrinho_contas', dado: { id: 'C', chave_pix: pix } }) as never;
    fila = enfileirar(fila, conta('a'), 1);
    fila = enfileirar(fila, { tipo: 'colecao', colecao: 'cofrinho_movimentos', dado: { id: 'M', conta_id: 'C' } } as never, 2);
    fila = enfileirar(fila, conta('b'), 3);
    expect(fila.map((i) => i.chave)).toEqual(['cofrinho_contas:C', 'cofrinho_movimentos:M']);
    expect((fila[0].dado as { chave_pix: string }).chave_pix).toBe('b');
  });

  it('aplica sobre os dados do servidor, em ordem (mais recente primeiro)', () => {
    const servidor = { ...LISTAS_VAZIAS, bebe: null, registros: [reg('a', '2026-11-15T10:00:00.000Z'), reg('c', '2026-11-15T08:00:00.000Z')], compromissos: [] as Compromisso[] };
    const r = aplicarFila(servidor, [
      { tipo: 'registro', dado: reg('b', '2026-11-15T09:00:00.000Z') },
      { tipo: 'excluir', dado: { alvo: 'registro', id: 'c' } },
      { tipo: 'registro', dado: reg('a', '2026-11-15T10:00:00.000Z', 120) },
    ]);
    expect(r.registros.map((x) => x.id)).toEqual(['a', 'b']);
    expect(r.registros[0].tipo === 'mamadeira' && r.registros[0].dados.ml).toBe(120);
  });
});
