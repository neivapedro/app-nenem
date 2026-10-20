import { describe, expect, it } from 'vitest';
import {
  agruparPorDia,
  descrever,
  duracaoPorLado,
  cronometroEsquecido,
  emAndamento,
  finalizarMamada,
  finalizarMamadaEm,
  finalizarSono,
  iniciarMamada,
  iniciarSono,
  ladoAtivo,
  mamadaManual,
  pausarMamada,
  resumoDia,
  trocarLado,
  ultimaAlimentacao,
  ultimoLado,
  validarRegistro,
} from './registros';
import type { Registro, RegistroDe } from './tipos';

const base = { id: 'x', familia_id: 'f', bebe_id: 'b', criado_por: 'u1' };
const t = (hhmm: string, dia = '2026-11-15') => new Date(`${dia}T${hhmm}:00-03:00`);

function mamadeira(id: string, hora: string, ml: number, dia = '2026-11-15'): RegistroDe<'mamadeira'> {
  const iso = t(hora, dia).toISOString();
  return { ...base, id, tipo: 'mamadeira', inicio: iso, fim: iso, observacao: null, dados: { ml, conteudo: 'materno' } };
}
function fralda(id: string, hora: string, xixi: boolean, coco: boolean): RegistroDe<'fralda'> {
  const iso = t(hora).toISOString();
  return { ...base, id, tipo: 'fralda', inicio: iso, fim: iso, observacao: null, dados: { xixi, coco } };
}

describe('mamada com cronômetro', () => {
  it('conta o tempo de cada lado, troca, pausa e finaliza', () => {
    let m = iniciarMamada(base, 'E', t('10:00'));
    expect(ladoAtivo(m)).toBe('E');
    expect(duracaoPorLado(m, t('10:05')).E).toBe(5 * 60_000);

    m = trocarLado(m, t('10:08'));
    expect(ladoAtivo(m)).toBe('D');
    m = pausarMamada(m, t('10:12'));
    expect(ladoAtivo(m)).toBeNull();
    expect(m.fim).toBeNull();
    // Pausada: o tempo não corre
    expect(duracaoPorLado(m, t('10:30'))).toEqual({ E: 8 * 60_000, D: 4 * 60_000, total: 12 * 60_000 });

    m = trocarLado(m, t('10:15'), 'D');
    m = finalizarMamada(m, t('10:20'));
    expect(m.fim).toBe(t('10:20').toISOString());
    expect(duracaoPorLado(m, t('11:00'))).toEqual({ E: 8 * 60_000, D: 9 * 60_000, total: 17 * 60_000 });
    expect(ultimoLado([m])).toBe('D');
  });

  it('finalizar uma mamada pausada termina no fim do último trecho', () => {
    let m = iniciarMamada(base, 'D', t('08:00'));
    m = pausarMamada(m, t('08:10'));
    m = finalizarMamada(m, t('08:40'));
    expect(m.fim).toBe(t('08:10').toISOString());
  });

  it('trocar lado em mamada pausada sem lado escolhido volta para o outro lado do último', () => {
    let m = iniciarMamada(base, 'E', t('08:00'));
    m = pausarMamada(m, t('08:05'));
    expect(ladoAtivo(trocarLado(m, t('08:06')))).toBe('D');
  });
});

describe('mamada registrada depois', () => {
  it('monta os trechos em sequência a partir do início', () => {
    const m = mamadaManual(base, t('14:00').toISOString(), { E: 10, D: 7 }, 'D');
    expect(m.dados.segmentos.map((s) => s.lado)).toEqual(['D', 'E']);
    expect(m.dados.segmentos[0].fim).toBe(t('14:07').toISOString());
    expect(m.fim).toBe(t('14:17').toISOString());
    expect(validarRegistro(m, t('15:00'))).toBeNull();
  });

  it('sem minutos não é válida', () => {
    const m = mamadaManual(base, t('14:00').toISOString(), { E: 0, D: 0 }, 'E');
    expect(validarRegistro(m, t('15:00'))).toMatch(/minutos/);
  });
});

describe('resumo do dia', () => {
  it('soma alimentações, ml, fraldas e só a parte do sono dentro do dia', () => {
    const sonoNoite = { ...iniciarSono({ ...base, id: 's1' }, t('22:00', '2026-11-14')), fim: t('02:00').toISOString() };
    const sonoAgora = iniciarSono({ ...base, id: 's2' }, t('13:00'));
    const mam = finalizarMamada(iniciarMamada({ ...base, id: 'm1' }, 'E', t('09:00')), t('09:15'));
    const lista: Registro[] = [sonoNoite, sonoAgora, mam, mamadeira('b1', '11:00', 90), mamadeira('b2', '23:30', 60, '2026-11-14'), fralda('f1', '09:20', true, false), fralda('f2', '12:00', true, true)];
    const r = resumoDia(lista, '2026-11-15', t('14:30'));
    expect(r).toEqual({
      mamadas: 1,
      peitoMs: 15 * 60_000,
      mamadeiras: 1,
      ml: 90,
      fraldas: 2,
      xixi: 2,
      coco: 1,
      // 00:00–02:00 da noite anterior + 13:00–14:30 em andamento
      sonoMs: (2 * 60 + 90) * 60_000,
      alimentacoes: 2,
    });
  });
});

describe('situação atual', () => {
  it('acha o que está em andamento e a última alimentação', () => {
    const sono = iniciarSono({ ...base, id: 's' }, t('10:00'));
    const fim = finalizarSono(sono, t('11:00'));
    const b = mamadeira('b', '12:00', 60);
    const m = iniciarMamada({ ...base, id: 'm' }, 'E', t('13:00'));
    expect(emAndamento([fim, b, m])).toEqual({ mamada: m, sono: null });
    expect(emAndamento([sono]).sono?.id).toBe('s');
    expect(ultimaAlimentacao([fim, b, m])?.id).toBe('m');
  });

  it('agrupa por dia, mais recente primeiro', () => {
    const g = agruparPorDia([mamadeira('a', '08:00', 30, '2026-11-14'), mamadeira('b', '09:00', 30), mamadeira('c', '07:00', 30)]);
    expect(g.map((x) => x.dia)).toEqual(['2026-11-15', '2026-11-14']);
    expect(g[0].itens.map((x) => x.id)).toEqual(['b', 'c']);
  });
});

describe('textos e validação', () => {
  it('descreve cada tipo', () => {
    const m = mamadaManual(base, t('14:00').toISOString(), { E: 10, D: 5 }, 'E');
    expect(descrever(m, t('15:00'))).toEqual({ titulo: 'Mamada · 15 min', detalhe: '14:00 · E 10 min · D 5 min' });
    expect(descrever(mamadeira('b', '16:30', 120), t('17:00')).titulo).toBe('Mamadeira · 120 ml');
    expect(descrever(fralda('f', '08:00', true, true), t('09:00')).titulo).toBe('Fralda · xixi e cocô');
    const s = finalizarSono(iniciarSono(base, t('13:00')), t('14:25'));
    expect(descrever(s, t('15:00'))).toEqual({ titulo: 'Sono · 1h 25min', detalhe: '13:00 – 14:25' });
  });

  it('recusa hora no futuro, ml fora da faixa e fralda vazia', () => {
    expect(validarRegistro(mamadeira('b', '16:00', 90), t('15:00'))).toMatch(/futuro/);
    expect(validarRegistro(mamadeira('b', '14:00', 0), t('15:00'))).toMatch(/quantidade/);
    expect(validarRegistro(fralda('f', '14:00', false, false), t('15:00'))).toMatch(/xixi/);
  });
});

describe('correções da verificação geral', () => {
  const sono = (id: string, de: string, ate: string | null): RegistroDe<'sono'> => ({ ...base, id, tipo: 'sono', inicio: t(de).toISOString(), fim: ate ? t(ate).toISOString() : null, observacao: null, dados: {} });

  it('sonos sobrepostos (os dois celulares marcaram) contam uma vez só', () => {
    const r = resumoDia([sono('a', '10:00', '12:00'), sono('b', '11:00', '13:00'), sono('c', '15:00', '15:30')], '2026-11-15', t('20:00'));
    expect(r.sonoMs).toBe(3.5 * 3_600_000);
  });

  it('não aceita fim no futuro, nem mais de 24 h, nem sono de 0 min', () => {
    expect(validarRegistro(sono('a', '10:00', '23:00'), t('12:00'))).toMatch(/futuro/);
    const longo = { ...sono('a', '10:00', '11:00'), fim: t('11:00', '2026-11-16').toISOString() };
    expect(validarRegistro(longo, t('12:00', '2026-11-16'))).toMatch(/24 h/);
    expect(validarRegistro(sono('a', '10:00', '10:00'), t('12:00'))).toMatch(/1 minuto/);
    expect(validarRegistro(sono('a', '10:00', '11:00'), t('12:00'))).toBeNull();
  });

  it('mamada curta aparece em segundos e cronômetro antigo mostra o dia', () => {
    const m = finalizarMamada(iniciarMamada(base, 'E', t('10:00')), new Date(t('10:00').getTime() + 40_000));
    expect(descrever(m, t('11:00')).titulo).toBe('Mamada · 40 s');
    expect(descrever(sono('s', '22:00', null), t('08:00', '2026-11-17')).detalhe).toBe('15/11 22:00 · dormindo');
  });
});

describe('cronômetro esquecido', () => {
  it('finaliza numa hora do passado cortando o que veio depois', () => {
    let m = iniciarMamada(base, 'E', t('10:00'));
    m = trocarLado(m, t('10:15'));
    m = trocarLado(m, t('11:00'));
    const fim = finalizarMamadaEm(m, t('10:30'));
    expect(fim.fim).toBe(t('10:30').toISOString());
    expect(fim.dados.segmentos.map((s) => s.lado)).toEqual(['E', 'D']);
    expect(duracaoPorLado(fim, t('15:00'))).toEqual({ E: 15 * 60_000, D: 15 * 60_000, total: 30 * 60_000 });
  });

  it('avisa quando o cronômetro passou do normal', () => {
    const m = iniciarMamada(base, 'E', t('10:00'));
    expect(cronometroEsquecido(m, t('12:00'))).toBe(false);
    expect(cronometroEsquecido(m, t('13:30'))).toBe(true);
    expect(cronometroEsquecido(iniciarSono(base, t('10:00')), t('23:00'))).toBe(false);
    expect(cronometroEsquecido(iniciarSono(base, t('10:00')), t('08:00', '2026-11-16'))).toBe(true);
  });
});
