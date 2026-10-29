import { describe, expect, it } from 'vitest';
import { coresDaFamilia, contarDivisao, ehMadrugada, fraseDivisao, iniciaisDaFamilia, ordenarMembros, type PessoaFrase } from './divisao';
import type { Registro } from './tipos';

const P = 'u-pedro';
const K = 'u-karol';

let seq = 0;
function reg(tipo: Registro['tipo'], inicio: string, por: string | null, dados: Record<string, unknown> = {}): Registro {
  const iso = new Date(inicio).toISOString();
  return { id: `r${seq++}`, familia_id: 'f', bebe_id: 'b', tipo, inicio: iso, fim: iso, observacao: null, criado_por: por, dados } as Registro;
}

const pessoas: PessoaFrase[] = [
  { id: P, nome: 'Pedro', voce: false },
  { id: K, nome: 'Karoline', voce: false },
];

describe('cores e iniciais', () => {
  it('ordena por entrada e desempata pelo id', () => {
    const m = [
      { user_id: 'b', criado_em: '2026-02-01T00:00:00Z' },
      { user_id: 'a', criado_em: '2026-03-01T00:00:00Z' },
      { user_id: 'c' },
      { user_id: 'aa' },
    ];
    expect(ordenarMembros(m).map((x) => x.user_id)).toEqual(['b', 'a', 'aa', 'c']);
  });

  it('cada pessoa tem uma cor diferente e quem entra depois não muda as outras', () => {
    const dois = [
      { user_id: K, criado_em: '2026-05-02T10:00:00Z' },
      { user_id: P, criado_em: '2026-05-01T10:00:00Z' },
    ];
    const c2 = coresDaFamilia(dois);
    expect(c2.get(P)).toBe(0);
    expect(c2.get(K)).toBe(1);
    const c3 = coresDaFamilia([...dois, { user_id: 'avo', criado_em: '2026-06-01T00:00:00Z' }]);
    expect(c3.get(P)).toBe(0);
    expect(c3.get(K)).toBe(1);
    expect(c3.get('avo')).toBe(2);
    // a partir da 5ª pessoa: neutra (nunca repete uma cor)
    const c5 = coresDaFamilia(['a', 'b', 'c', 'd', 'e'].map((user_id, i) => ({ user_id, criado_em: `2026-01-0${i + 1}T00:00:00Z` })));
    expect([...c5.values()]).toEqual([0, 1, 2, 3, -1]);
  });

  it('inicial maiúscula; com a mesma letra, duas letras', () => {
    expect(Object.fromEntries(iniciaisDaFamilia([{ user_id: P, nome: 'pedro neiva' }, { user_id: K, nome: 'Karoline' }]))).toEqual({ [P]: 'P', [K]: 'K' });
    expect(Object.fromEntries(iniciaisDaFamilia([{ user_id: P, nome: 'Pedro' }, { user_id: 'x', nome: 'paula' }]))).toEqual({ [P]: 'Pe', x: 'Pa' });
    expect(iniciaisDaFamilia([{ user_id: 'z', nome: '  ' }]).get('z')).toBe('?');
  });
});

describe('madrugada', () => {
  it('0h até 5h59 (hora local)', () => {
    expect(ehMadrugada('2026-10-20T00:00:00-03:00')).toBe(true);
    expect(ehMadrugada('2026-10-20T05:59:00-03:00')).toBe(true);
    expect(ehMadrugada('2026-10-20T06:00:00-03:00')).toBe(false);
    expect(ehMadrugada('2026-10-19T23:50:00-03:00')).toBe(false);
  });
});

describe('contarDivisao', () => {
  const hoje = '2026-10-28';
  const registros = [
    reg('mamada', '2026-10-28T02:00:00-03:00', K),
    reg('mamadeira', '2026-10-27T03:30:00-03:00', K),
    reg('mamada', '2026-10-26T04:00:00-03:00', P),
    reg('mamada', '2026-10-26T10:00:00-03:00', P), // de dia: não é madrugada
    reg('fralda', '2026-10-25T09:00:00-03:00', P, { xixi: true, coco: true }),
    reg('fralda', '2026-10-25T12:00:00-03:00', P, { xixi: true, coco: false }),
    reg('fralda', '2026-10-24T12:00:00-03:00', K, { xixi: true, coco: false }),
    reg('sono', '2026-10-23T20:00:00-03:00', K),
    reg('remedio', '2026-10-22T09:00:00-03:00', P), // 1º dia da janela: só no total
    reg('mamada', '2026-10-21T02:00:00-03:00', K), // 8 dias atrás: fora
    reg('fralda', '2026-10-28T08:00:00-03:00', null), // sem autor
    reg('fralda', '2026-10-28T08:30:00-03:00', 'ex-membro'), // quem saiu
  ];
  const d = contarDivisao(registros, [P, K], hoje);
  const linha = (c: string) => d.linhas.find((l) => l.chave === c)!;

  it('janela de 7 dias com hoje', () => {
    expect(d.de).toBe('2026-10-22');
    expect(d.ate).toBe(hoje);
  });

  it('conta por pessoa e categoria', () => {
    expect(linha('madrugada').total).toBe(3);
    expect(linha('madrugada').por[K]).toMatchObject({ n: 2, mamadas: 1, mamadeiras: 1, coco: 0 });
    expect(linha('total').por[P].porTipo).toEqual({ mamada: 2, fralda: 2, remedio: 1 });
    expect(linha('madrugada').por[P].n).toBe(1);
    expect(linha('fralda').por[P]).toMatchObject({ n: 2, coco: 1 });
    expect(linha('fralda').por[K].n).toBe(1);
    expect(linha('sono').por[K].n).toBe(1);
    expect(linha('sono').por[P].n).toBe(0);
    expect(linha('total').por[P].n).toBe(5);
    expect(linha('total').por[K].n).toBe(4);
    expect(linha('total').total).toBe(9);
  });

  it('sem autor fica de fora (e é contado à parte)', () => {
    expect(d.semAutor).toBe(2);
  });
});

describe('fraseDivisao', () => {
  const hoje = '2026-10-28';
  const madrugadas = (k: number, p: number) => [
    ...Array.from({ length: k }, (_, i) => reg('mamada', `2026-10-2${2 + (i % 7)}T0${i % 6}:10:00-03:00`, K)),
    ...Array.from({ length: p }, (_, i) => reg('mamadeira', `2026-10-2${2 + (i % 7)}T0${i % 6}:40:00-03:00`, P)),
  ];

  it('sugere revezar a madrugada com carinho', () => {
    const d = contarDivisao(madrugadas(6, 3), [P, K], hoje);
    expect(fraseDivisao(d, pessoas)).toBe('Karoline cuidou de 6 das 9 alimentações da madrugada — que tal Pedro assumir a próxima madrugada?');
  });

  it('fala com você quando é você quem pode assumir', () => {
    const d = contarDivisao(madrugadas(6, 3), [P, K], hoje);
    const eu = pessoas.map((p) => ({ ...p, voce: p.id === P }));
    expect(fraseDivisao(d, eu)).toBe('Karoline cuidou de 6 das 9 alimentações da madrugada — que tal você assumir a próxima madrugada?');
    const ela = pessoas.map((p) => ({ ...p, voce: p.id === K }));
    expect(fraseDivisao(d, ela)).toBe('Você cuidou de 6 das 9 alimentações da madrugada — que tal combinar a próxima madrugada com Pedro e descansar um pouco?');
  });

  it('equilibrado: elogia a equipe; poucos registros não viram sugestão', () => {
    expect(fraseDivisao(contarDivisao(madrugadas(4, 3), [P, K], hoje), pessoas)).toBe('A semana está bem dividida entre vocês. Bonito trabalho em equipe!');
    expect(fraseDivisao(contarDivisao(madrugadas(2, 0), [P, K], hoje), pessoas)).toBe('A semana está bem dividida entre vocês. Bonito trabalho em equipe!');
  });

  it('sem madrugada puxada, olha as fraldas e os sonos', () => {
    const fr = Array.from({ length: 5 }, (_, i) => reg('fralda', `2026-10-2${3 + i}T10:00:00-03:00`, P, { xixi: true, coco: false }));
    expect(fraseDivisao(contarDivisao([...fr, reg('fralda', '2026-10-27T15:00:00-03:00', K, { xixi: true, coco: false })], [P, K], hoje), pessoas)).toBe(
      'Pedro trocou 5 das 6 fraldas — que tal Karoline assumir as próximas trocas?',
    );
    const so = Array.from({ length: 3 }, (_, i) => reg('sono', `2026-10-2${3 + i}T13:00:00-03:00`, K));
    expect(fraseDivisao(contarDivisao(so, [P, K], hoje), pessoas, 'Heitor')).toBe('Karoline colocou Heitor para dormir em todos os 3 sonos — que tal Pedro assumir o próximo soninho?');
  });

  it('sem registros com autor', () => {
    expect(fraseDivisao(contarDivisao([], [P, K], hoje), pessoas)).toMatch(/^Quando vocês registrarem/);
  });
});
