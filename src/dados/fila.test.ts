import { describe, expect, it } from 'vitest';
import type { Compromisso, Registro } from '../lib/tipos';
import { aplicarFila, enfileirar, type ItemFila } from './fila';

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
    expect(fila.map((i) => [i.chave, i.versao])).toEqual([
      ['registro:b', 2],
      ['registro:a', 3],
    ]);
    // Excluir substitui a edição pendente
    fila = enfileirar(fila, { tipo: 'excluir', dado: { alvo: 'registro', id: 'b' } }, 4);
    expect(fila.map((i) => i.tipo)).toEqual(['registro', 'excluir']);
  });

  it('aplica sobre os dados do servidor, em ordem (mais recente primeiro)', () => {
    const servidor = { bebe: null, registros: [reg('a', '2026-11-15T10:00:00.000Z'), reg('c', '2026-11-15T08:00:00.000Z')], compromissos: [] as Compromisso[] };
    const r = aplicarFila(servidor, [
      { tipo: 'registro', dado: reg('b', '2026-11-15T09:00:00.000Z') },
      { tipo: 'excluir', dado: { alvo: 'registro', id: 'c' } },
      { tipo: 'registro', dado: reg('a', '2026-11-15T10:00:00.000Z', 120) },
    ]);
    expect(r.registros.map((x) => x.id)).toEqual(['a', 'b']);
    expect(r.registros[0].tipo === 'mamadeira' && r.registros[0].dados.ml).toBe(120);
  });
});
