import { describe, expect, it } from 'vitest';
import {
  cofrinhoDoPeriodo,
  destaqueMarcos,
  crescimentoDoPeriodo,
  emojiDoMarco,
  flexao,
  fotosDoPeriodo,
  idadeNaData,
  intervaloFraldas,
  marcosDoPeriodo,
  montarRetrospectiva,
  ordinalAno,
  periodoRetrospectiva,
  quemE,
  recordesDisponiveis,
  selecionarTelas,
  textoLeite,
  textoSonoSeguido,
  tituloRetrospectiva,
  totaisDoPeriodo,
  vacinasDoPeriodo,
  vezesPeso,
} from './retrospectiva';
import type { Bebe, ContaCofrinho, Marco, Medida, MovimentoCofrinho, Registro, VacinaRegistro } from './tipos';

// Horários no fuso do aparelho (os testes rodam com TZ=America/Sao_Paulo, mas valem em qualquer fuso)
const local = (dia: string, hora = '12:00') => new Date(`${dia}T${hora}:00`).toISOString();

const bebe = (nascimento: string | null, extra: Partial<Bebe> = {}): Bebe => ({
  id: 'b1',
  familia_id: 'f1',
  nome: 'Heitor',
  sexo: 'M',
  data_prevista: null,
  nascimento: nascimento ? local(nascimento, '04:12') : null,
  peso_nascer_g: 3350,
  altura_nascer_cm: 49.5,
  pc_nascer_cm: 34,
  calendario_vacinal: 'pni',
  ...extra,
});

let seq = 0;
const base = () => ({ id: `r${++seq}`, familia_id: 'f1', bebe_id: 'b1', criado_por: null, observacao: null });
const mamada = (dia: string, hora: string, min = 15): Registro => {
  const ini = local(dia, hora);
  const fim = new Date(new Date(ini).getTime() + min * 60_000).toISOString();
  return { ...base(), tipo: 'mamada', inicio: ini, fim, dados: { segmentos: [{ lado: 'E', inicio: ini, fim }] } };
};
const mamadeira = (dia: string, hora: string, ml: number): Registro => ({ ...base(), tipo: 'mamadeira', inicio: local(dia, hora), fim: local(dia, hora), dados: { ml, conteudo: 'formula' } });
const fralda = (dia: string, hora: string, coco = false): Registro => ({ ...base(), tipo: 'fralda', inicio: local(dia, hora), fim: local(dia, hora), dados: { xixi: true, coco } });
const sono = (iniDia: string, iniHora: string, fimDia: string, fimHora: string): Registro => ({ ...base(), tipo: 'sono', inicio: local(iniDia, iniHora), fim: local(fimDia, fimHora), dados: {} });

const marco = (o: Partial<Marco>): Marco => ({ id: `m${++seq}`, familia_id: 'f1', bebe_id: 'b1', criado_por: null, tipo: 'primeira-vez', marco_id: null, titulo: null, data: null, observacao: null, foto: null, ...o });
const medida = (data: string, peso_g: number | null, comprimento_cm: number | null = null): Medida => ({ id: data, familia_id: 'f1', bebe_id: 'b1', criado_por: null, data, peso_g, comprimento_cm, pc_cm: null, observacao: null });
const vacina = (dose_id: string, data: string | null, status: 'aplicada' | 'pulada' = 'aplicada', nome: string | null = null): VacinaRegistro => ({ id: `v${++seq}`, familia_id: 'f1', bebe_id: 'b1', criado_por: null, dose_id, nome, status, data, rede: 'sus', local: null, lote: null, observacao: null });

describe('período da retrospectiva', () => {
  it('no 1º aniversário: o ano inteiro, do nascimento à véspera', () => {
    expect(periodoRetrospectiva(local('2025-10-28'), '2026-10-28')).toEqual({ ano: 1, inicio: '2025-10-28', fim: '2026-10-28', ultimoDia: '2026-10-27', completo: true, meses: 12 });
  });
  it('depois de 1 ano e pouco: continua o último ano fechado', () => {
    expect(periodoRetrospectiva(local('2025-06-10'), '2026-10-28')).toMatchObject({ ano: 1, inicio: '2025-06-10', fim: '2026-06-10', completo: true });
    expect(periodoRetrospectiva(local('2024-06-10'), '2026-10-28')).toMatchObject({ ano: 2, inicio: '2025-06-10', fim: '2026-06-10' });
  });
  it('entre 3 e 11 meses: a parcial "até agora"', () => {
    expect(periodoRetrospectiva(local('2026-05-20'), '2026-10-28')).toEqual({ ano: 1, inicio: '2026-05-20', fim: '2026-10-28', ultimoDia: '2026-10-28', completo: false, meses: 5 });
  });
  it('antes de 3 meses, antes de nascer ou ano pedido que ainda não fechou: nada', () => {
    expect(periodoRetrospectiva(local('2026-08-29'), '2026-10-28')).toBeNull();
    expect(periodoRetrospectiva(null, '2026-10-28')).toBeNull();
    expect(periodoRetrospectiva(local('2026-01-10'), '2026-10-28', 1)).toBeNull();
    expect(periodoRetrospectiva(local('2024-10-28'), '2026-10-28', 2)).toMatchObject({ ano: 2, inicio: '2025-10-28', fim: '2026-10-28' });
  });
  it('31/jan faz 1 ano em 31/jan (e 29/fev, em 28/fev)', () => {
    expect(periodoRetrospectiva(local('2024-02-29'), '2025-02-28')).toMatchObject({ completo: true, fim: '2025-02-28' });
  });
});

describe('textos com nome e gênero', () => {
  it('título', () => {
    const p = { ano: 1, completo: true, meses: 12 };
    expect(tituloRetrospectiva(p, { nome: 'Heitor', sexo: 'M' })).toBe('O primeiro ano do Heitor');
    expect(tituloRetrospectiva(p, { nome: 'Alice', sexo: 'F' })).toBe('O primeiro ano da Alice');
    expect(tituloRetrospectiva(p, { nome: '', sexo: 'F' })).toBe('O primeiro ano da bebê');
    expect(tituloRetrospectiva(p, { nome: null, sexo: null })).toBe('O primeiro ano do bebê');
    expect(tituloRetrospectiva({ ano: 2, completo: true, meses: 12 }, { nome: 'Heitor', sexo: 'M' })).toBe('O segundo ano do Heitor');
    expect(tituloRetrospectiva({ ano: 1, completo: false, meses: 5 }, { nome: 'Heitor', sexo: 'M' })).toBe('Os primeiros 5 meses do Heitor');
  });
  it('quem é, flexão e ordinal', () => {
    expect(quemE({ nome: 'Heitor', sexo: 'M' })).toMatchObject({ do: 'do Heitor', ele: 'ele', o: 'o' });
    expect(quemE({ nome: ' ', sexo: 'F' })).toMatchObject({ nome: 'a bebê', Nome: 'A bebê', do: 'da bebê', ele: 'ela', temNome: false });
    expect(flexao('M', 'corajoso', 'corajosa')).toBe('corajoso');
    expect(flexao('F', 'corajoso', 'corajosa')).toBe('corajosa');
    expect(flexao(null, 'corajoso', 'corajosa')).toBe('corajoso(a)');
    expect(ordinalAno(3)).toBe('terceiro');
    expect(ordinalAno(9)).toBe('9º');
  });
  it('números', () => {
    expect(textoLeite(850)).toBe('850 ml');
    expect(textoLeite(1000)).toBe('1 litro');
    expect(textoLeite(38_450)).toBe('38,5 litros');
    expect(textoLeite(245_000)).toBe('245 litros');
    expect(textoSonoSeguido(8 * 3_600_000 + 40 * 60_000)).toBe('8h40');
    expect(textoSonoSeguido(7 * 3_600_000)).toBe('7h');
    expect(vezesPeso(3350, 9700)).toBe('2,9×');
    expect(vezesPeso(3350, 4000)).toBeNull();
    expect(idadeNaData(local('2025-10-28'), '2025-10-28')).toBe('no dia do nascimento');
    expect(idadeNaData(local('2025-10-28'), '2025-12-09')).toBe('com 1 mês e 11 dias');
    expect(idadeNaData(local('2025-10-28'), '2026-10-28')).toBe('com 1 ano');
    expect(emojiDoMarco('Primeiro sorriso', 'primeira-vez')).toBe('😊');
    expect(emojiDoMarco('Algo diferente', 'caderneta')).toBe('⭐');
  });
});

describe('totais e recordes', () => {
  const nasc = local('2026-01-01', '04:00');
  const regs: Registro[] = [
    // Dia 1: 3 mamadas, 1 mamadeira, 2 fraldas
    mamada('2026-01-02', '08:00', 20),
    mamada('2026-01-02', '11:00', 10),
    mamada('2026-01-02', '15:00', 30),
    mamadeira('2026-01-02', '19:00', 120),
    fralda('2026-01-02', '08:30'),
    fralda('2026-01-02', '12:00', true),
    // Dia 2: 5 alimentações (recorde) e 3 fraldas
    mamada('2026-01-03', '02:00'),
    mamada('2026-01-03', '06:00'),
    mamada('2026-01-03', '10:00'),
    mamadeira('2026-01-03', '14:00', 90),
    mamadeira('2026-01-03', '18:00', 90),
    fralda('2026-01-03', '06:30', true),
    fralda('2026-01-03', '10:30'),
    fralda('2026-01-03', '18:30'),
    // Noite inteira: 21h → 4h10 (7h10), e os dois celulares marcaram parte dela
    sono('2026-01-02', '21:00', '2026-01-03', '04:10'),
    sono('2026-01-02', '22:00', '2026-01-03', '01:00'),
    // Sono que encosta no outro (soneca 13h–14h e 14h–15h30): conta seguido
    sono('2026-01-03', '13:00', '2026-01-03', '14:00'),
    sono('2026-01-03', '14:00', '2026-01-03', '15:30'),
    // Fora do período (antes)
    mamada('2025-12-31', '10:00'),
  ];
  const t = totaisDoPeriodo(regs, nasc, '2026-01-02', '2026-01-03', new Date(local('2026-01-10')));

  it('soma alimentações, leite, fraldas e sono (sem contar duas vezes o sono repetido)', () => {
    expect(t).toMatchObject({ dias: 2, mamadas: 6, mamadeiras: 3, ml: 300, fraldas: 5, xixi: 5, coco: 2, diasComRegistro: 2 });
    expect(t.peitoMs).toBe((20 + 10 + 30 + 15 * 3) * 60_000);
    // 3h no dia 2 (21h–24h) + 4h10 no dia 3 + 2h30 da soneca
    expect(t.sonoMs).toBe((3 * 60 + 4 * 60 + 10 + 150) * 60_000);
  });
  it('recordes: dia com mais mamadas e fraldas, maior sono e noite inteira', () => {
    expect(t.diaMaisMamadas).toEqual({ valor: 5, dia: '2026-01-03' });
    expect(t.diaMaisFraldas).toEqual({ valor: 3, dia: '2026-01-03' });
    expect(t.maiorSono).toEqual({ ms: (7 * 60 + 10) * 60_000, dia: '2026-01-02' });
    expect(t.noitesInteiras).toBe(1);
    expect(t.primeiraNoiteInteira).toBe('2026-01-02');
    // Poucos despertares: não dá para dizer a hora mais comum
    expect(t.horaAcordar).toBeNull();
    // Um mês só: não compara meses
    expect(t.mesMaisSono).toBeNull();
  });
  it('noite que começa depois da meia-noite é da noite anterior; sono de 5 h não é noite inteira', () => {
    const t2 = totaisDoPeriodo([sono('2026-01-05', '01:00', '2026-01-05', '07:30'), sono('2026-01-06', '22:00', '2026-01-07', '03:00')], nasc, '2026-01-02', '2026-01-08', new Date(local('2026-01-10')));
    expect(t2.noitesInteiras).toBe(1);
    expect(t2.primeiraNoiteInteira).toBe('2026-01-04');
  });
  it('hora mais comum de acordar (fim de sono de 2 h+ de manhã) e mês que mais dormiu', () => {
    const lista: Registro[] = [];
    for (let d = 1; d <= 70; d++) {
      const dia = new Date(2026, 0, 1 + d);
      const k = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
      const antes = new Date(2026, 0, d);
      const kv = `${antes.getFullYear()}-${String(antes.getMonth() + 1).padStart(2, '0')}-${String(antes.getDate()).padStart(2, '0')}`;
      // 2º mês dorme mais (acorda 7h); no resto, acorda 6h
      const acorda = k >= '2026-02-01' && k < '2026-03-01' ? '07:10' : '06:20';
      lista.push(sono(kv, '22:00', k, acorda));
    }
    const t3 = totaisDoPeriodo(lista, nasc, '2026-01-01', '2026-03-12', new Date(local('2026-03-20')));
    expect(t3.horaAcordar).toEqual({ hora: 6, vezes: 42 });
    expect(t3.mesMaisSono?.mes).toBe(2);
  });
  it('sono ainda em andamento não entra', () => {
    const t4 = totaisDoPeriodo([{ ...sono('2026-01-02', '21:00', '2026-01-03', '04:00'), fim: null } as Registro], nasc, '2026-01-02', '2026-01-03', new Date(local('2026-01-03', '02:00')));
    expect(t4.maiorSono).toBeNull();
    expect(t4.registros).toBe(0);
  });
  it('intervalo médio das fraldas', () => {
    expect(intervaloFraldas({ fraldas: 8 * 10, diasComRegistro: 10 })).toBe(3 * 3_600_000);
    expect(intervaloFraldas({ fraldas: 3, diasComRegistro: 1 })).toBeNull();
  });
});

describe('crescimento', () => {
  const b = bebe('2025-10-28');
  const p = periodoRetrospectiva(b.nascimento, '2026-10-30')!;
  it('do nascimento até a medida do aniversário (até 7 dias depois), com percentil', () => {
    const c = crescimentoDoPeriodo(b, [medida('2025-11-05', 3300, 50), medida('2026-04-28', 7600, 66), medida('2026-11-02', 9600, 75.5)], p, '2026-11-03');
    expect(c.peso).toMatchObject({ de: 3350, deNascer: true, ate: 9600, ateData: '2026-11-02' });
    expect(c.altura).toMatchObject({ de: 49.5, ate: 75.5 });
    expect(c.peso?.percentil).toBeGreaterThan(30);
    expect(c.peso?.percentil).toBeLessThan(80);
  });
  it('medida de muito depois do aniversário não entra; sem sexo, sem percentil', () => {
    const c = crescimentoDoPeriodo({ ...b, sexo: null }, [medida('2026-06-28', 8100, 69), medida('2026-12-20', 10_200, 78)], p, '2026-12-25');
    expect(c.peso).toMatchObject({ ate: 8100, ateData: '2026-06-28', percentil: null });
  });
  it('fora das curvas: mostra o peso, mas sem número de percentil', () => {
    const c = crescimentoDoPeriodo(b, [medida('2026-10-28', 15_000)], p, '2026-10-30');
    expect(c.peso).toMatchObject({ ate: 15_000, percentil: null });
  });
  it('sem medida depois do nascimento: nada', () => {
    expect(crescimentoDoPeriodo(b, [], p, '2026-10-30')).toEqual({ peso: null, altura: null });
  });
  it('2º ano: começa na medida perto do 1º aniversário', () => {
    const b2 = bebe('2024-10-28');
    const p2 = periodoRetrospectiva(b2.nascimento, '2026-10-28')!;
    const c = crescimentoDoPeriodo(b2, [medida('2025-10-20', 9500), medida('2026-10-28', 12_000)], p2, '2026-10-28');
    expect(c.peso).toMatchObject({ de: 9500, deNascer: false, ate: 12_000 });
  });
});

describe('marcos, vacinas, fotos e cofrinho', () => {
  const b = bebe('2025-10-28');
  const p = periodoRetrospectiva(b.nascimento, '2026-10-28')!;
  it('marcos do ano em ordem, com idade e emoji (a foto do mês não é marco)', () => {
    const lista = marcosDoPeriodo(
      [
        marco({ titulo: 'Primeira palavra', data: '2026-09-10' }),
        marco({ titulo: 'Primeiro sorriso', data: '2025-12-02' }),
        marco({ tipo: 'mes', marco_id: 'mes-3', data: '2026-01-28', foto: 'x' }),
        marco({ titulo: 'Depois do aniversário', data: '2026-11-02' }),
        marco({ titulo: 'Sem data', data: null }),
      ],
      b.nascimento!,
      p,
    );
    expect(lista.map((m) => [m.titulo, m.idade, m.emoji])).toEqual([
      ['Primeiro sorriso', 'com 1 mês e 4 dias', '😊'],
      ['Primeira palavra', 'com 10 meses e 13 dias', '💬'],
    ]);
  });
  it('destaque dos marcos: 1ª vez antes da Caderneta, espalhados pelo ano e em ordem', () => {
    const m = (id: string, data: string, tipo: 'caderneta' | 'primeira-vez' = 'primeira-vez') => ({ id, data, tipo });
    const lista = [m('a', '2026-01-01'), m('c1', '2026-01-15', 'caderneta'), m('b', '2026-02-01'), m('c', '2026-03-01'), m('d', '2026-04-01'), m('e', '2026-05-01'), m('f', '2026-06-01'), m('g', '2026-07-01')];
    expect(destaqueMarcos(lista, 4).map((x) => x.id)).toEqual(['a', 'c', 'e', 'g']);
    expect(destaqueMarcos(lista, 8)).toBe(lista);
    expect(destaqueMarcos([m('a', '2026-01-01'), m('c1', '2026-01-15', 'caderneta'), m('c2', '2026-03-15', 'caderneta'), m('c3', '2026-04-15', 'caderneta')], 2).map((x) => x.id)).toEqual(['a', 'c3']);
  });
  it('vacinas aplicadas no ano (o dia do aniversário entra), sem repetir o nome', () => {
    const v = vacinasDoPeriodo([vacina('bcg', '2025-10-28'), vacina('penta-1', '2025-12-28'), vacina('penta-2', '2026-02-28'), vacina('scr-1', '2026-10-28'), vacina('rota-1', null), vacina('gripe-1', '2026-05-01', 'pulada'), vacina('gripe-2', '2026-06-01'), vacina('extra:abc', '2026-03-03', 'aplicada', 'Dengue')], p);
    expect(v.doses).toBe(6);
    expect(v.nomes).toEqual(['BCG', 'Pentavalente', 'Dengue', 'Gripe', 'Tríplice viral']);
  });
  it('fotos do mês do nascimento ao 1 ano', () => {
    const marcos = [0, 1, 2, 5, 12, 13].map((n) => marco({ tipo: 'mes', marco_id: `mes-${n}`, foto: `f${n}`, data: '2026-01-01' }));
    marcos.push(marco({ tipo: 'mes', marco_id: 'mes-3', foto: null }));
    expect(fotosDoPeriodo(marcos, p).map((f) => f.rotulo)).toEqual(['Nascimento', '1 mês', '2 meses', '5 meses', '1 ano']);
    expect(fotosDoPeriodo(marcos, { ano: 1, completo: false, meses: 4 }).map((f) => f.meses)).toEqual([0, 1, 2]);
  });
  it('cofrinho: saldo no aniversário, depósitos e pessoas do ano (sem transferências)', () => {
    const conta = { id: 'c1', bebe_id: 'b1', familia_id: 'f1', criado_por: null } as ContaCofrinho;
    const mov = (o: Partial<MovimentoCofrinho>): MovimentoCofrinho => ({ id: `mv${++seq}`, familia_id: 'f1', criado_por: null, conta_id: 'c1', tipo: 'deposito', data: '2026-01-01', valor_centavos: 10_000, de: null, ocasiao: null, recado: null, observacao: null, comprovante: null, ...o });
    const movs = [mov({ de: 'Vovó' }), mov({ de: 'vovó ', data: '2026-03-01' }), mov({ de: 'Pedro', data: '2026-05-01' }), mov({ tipo: 'retirada', valor_centavos: 5000, data: '2026-06-01' }), mov({ data: '2026-12-01', de: 'Tio' })];
    expect(cofrinhoDoPeriodo([conta], movs, p, 'b1')).toEqual({ saldo: 25_000, depositos: 3, depositado: 30_000, pessoas: 2 });
    expect(cofrinhoDoPeriodo([conta], [], p, 'b1')).toBeNull();
  });
});

describe('seleção das telas', () => {
  const b = bebe('2025-10-28');
  const p = periodoRetrospectiva(b.nascimento, '2026-10-28')!;
  const vazio = { registros: [], medidas: [], marcos: [], vacinas: [], contas: [], movimentos: [] };

  it('com poucos dados: só abertura e encerramento', () => {
    const d = montarRetrospectiva(b, vazio, p, '2026-10-28', new Date(local('2026-10-28')))!;
    expect(selecionarTelas(d)).toEqual(['abertura', 'encerramento']);
  });
  it('com o ano cheio: todas, na ordem; fotos que não abriram (sem internet) tiram a tela das fotos', () => {
    const registros: Registro[] = [];
    for (let i = 0; i < 40; i++) {
      const dia = new Date(2026, 0, 1 + i);
      const k = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
      const antes = new Date(2026, 0, i);
      const kv = `${antes.getFullYear()}-${String(antes.getMonth() + 1).padStart(2, '0')}-${String(antes.getDate()).padStart(2, '0')}`;
      registros.push(mamada(k, '09:00'), mamadeira(k, '15:00', 120), fralda(k, '10:00'), sono(kv, '21:00', k, '06:15'));
    }
    const d = montarRetrospectiva(
      b,
      {
        ...vazio,
        registros,
        medidas: [medida('2026-10-28', 9600, 75)],
        marcos: [marco({ titulo: 'Primeiro sorriso', data: '2025-12-02' }), marco({ tipo: 'mes', marco_id: 'mes-0', foto: 'a' }), marco({ tipo: 'mes', marco_id: 'mes-1', foto: 'b' })],
        vacinas: [vacina('bcg', '2025-10-28')],
        contas: [{ id: 'c1', bebe_id: 'b1' } as ContaCofrinho],
        movimentos: [{ id: 'x', conta_id: 'c1', tipo: 'deposito', data: '2026-01-01', valor_centavos: 5000, de: 'Vovó' } as MovimentoCofrinho],
      },
      p,
      '2026-10-28',
      new Date(local('2026-10-28')),
    )!;
    expect(recordesDisponiveis(d.totais)).toContain('acordar');
    expect(selecionarTelas(d)).toEqual(['abertura', 'alimentacao', 'fraldas', 'sono', 'recordes', 'crescimento', 'marcos', 'vacinas', 'fotos', 'cofrinho', 'encerramento']);
    expect(selecionarTelas(d, 1)).not.toContain('fotos');
  });
});
