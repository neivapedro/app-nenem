import { describe, expect, it } from 'vitest';
import { eventosTarefas, eventosVacinas, montarIcs } from './ics.ts';
import { avisosRemedio, avisosTarefas, avisosVacina, type MembroAviso } from './lembretes.ts';
import { calendarioDoBebe, DOSES, limiteDaDose } from './vacinas.ts';

const SITE = 'https://neivapedro.github.io/app-nenem/';
const m: MembroAviso = { user_id: 'u1', fuso_horario: 'America/Sao_Paulo', lembrete_mamada: false, lembrete_mamada_min: 180, lembrete_agenda: true, lembrete_remedio: true, lembrete_vacina: true };
const t = (s: string) => new Date(`${s}:00-03:00`);

describe('calendário: vacinas e primeiros dias', () => {
  it('pendentes do mesmo dia num evento só, com aviso na véspera; aplicadas com ✓', () => {
    const ev = eventosVacinas('b1', '2026-11-15', 'pni', [{ dose_id: 'bcg', status: 'aplicada', data: '2026-11-15' }], '2026-11-16');
    const doisMeses = ev.find((e) => e.inicio === '2027-01-15')!;
    expect(doisMeses.titulo).toMatch(/^💉 Vacinas: /);
    expect(doisMeses.aviso).toBe(-1440);
    expect(ev.find((e) => e.uid === 'vacina-b1-bcg')?.titulo).toMatch(/^✓ 💉 BCG/);
    // Hepatite B ao nascer ainda não marcada e já passou: aparece hoje como atrasada? (tolerância de 15 dias: ainda "agora")
    expect(ev.find((e) => e.inicio === '2026-11-16')?.titulo).toMatch(/Hepatite B/);
    const ics = montarIcs({ compromissos: [], bebes: [], eventos: ev, fuso: 'America/Sao_Paulo', agora: new Date('2026-11-16T12:00:00Z'), site: SITE }).replace(/\r\n /g, '');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270115');
    expect(ics).toContain('TRIGGER:-PT16H');
  });

  it('prazos dos primeiros dias: pezinho do 3º ao 5º dia; feitos saem do calendário', () => {
    const ev = eventosTarefas('f1', '2026-11-15', [{ id: 'x', item_id: 'olhinho', titulo: null, data: null, feito_em: '2026-11-15T10:00:00Z' }]);
    const pezinho = ev.find((e) => e.uid === 'tarefa-f1-pezinho')!;
    expect([pezinho.inicio, pezinho.fim]).toEqual(['2026-11-18', '2026-11-20']);
    expect(ev.some((e) => e.uid === 'tarefa-f1-olhinho')).toBe(false);
    const ics = montarIcs({ compromissos: [], bebes: [], eventos: [pezinho], fuso: 'America/Sao_Paulo', agora: new Date(), site: SITE });
    expect(ics).toContain('DTEND;VALUE=DATE:20261121');
  });
});

describe('avisos da fase 2', () => {
  const bebe = { id: 'b1', nome: 'Heitor', nascimento: '2026-11-15', calendario: 'pni' as const };

  it('vacina: véspera às 8h e atrasada uma vez', () => {
    expect(avisosVacina(m, bebe, [], t('2027-01-14T07:50'), SITE).filter((a) => a.chave.startsWith('vacina-vespera'))).toEqual([]);
    const v = avisosVacina(m, bebe, [], t('2027-01-14T08:05'), SITE);
    const vespera = v.find((a) => a.chave.startsWith('vacina-vespera'))!;
    expect(vespera.titulo).toMatch(/Amanhã: \d vacinas/);
    // Atrasada: avisa enquanto o atraso tem até 45 dias (depois disso, só no app)
    expect(v.some((a) => a.chave === 'vacina-atrasada:b1:bcg:u1')).toBe(false);
    expect(avisosVacina(m, bebe, [], t('2026-12-05T08:05'), SITE).some((a) => a.chave === 'vacina-atrasada:b1:bcg:u1')).toBe(true);
    expect(avisosVacina({ ...m, lembrete_vacina: false }, bebe, [], t('2027-01-14T08:05'), SITE)).toEqual([]);
  });

  it('remédio: na hora da próxima dose, por até 2 horas', () => {
    const r = [{ id: 'r1', nome: 'Vitamina D', dose: '2 gotas', intervalo_h: 24, ultima: { id: 'd1', inicio: t('2026-12-01T09:00').toISOString() } }];
    expect(avisosRemedio(m, r, t('2026-12-02T08:59'), SITE)).toEqual([]);
    const [a] = avisosRemedio(m, r, t('2026-12-02T09:03'), SITE);
    expect(a.chave).toBe('remedio:d1:u1');
    expect(a.corpo).toContain('09:00');
    expect(avisosRemedio(m, r, t('2026-12-02T11:30'), SITE)).toEqual([]);
  });

  it('primeiros dias: avisa às 8h do dia em que a janela abre', () => {
    const a = avisosTarefas(m, 'f1', '2026-11-15', [], t('2026-11-18T08:10'), SITE);
    expect(a.find((x) => x.tag === 'tarefa-pezinho')?.corpo).toBe('Até 20/11.');
    expect(avisosTarefas(m, 'f1', '2026-11-15', [{ id: 'x', item_id: 'pezinho', titulo: null, data: null, feito_em: 'x' }], t('2026-11-18T08:10'), SITE).some((x) => x.tag === 'tarefa-pezinho')).toBe(false);
  });
});

describe('vacina que passou da idade máxima', () => {
  const nasc = '2026-11-15';
  const sit = (aplicacoes: Parameters<typeof calendarioDoBebe>[2], hoje: string, id: string) => calendarioDoBebe(nasc, 'pni', aplicacoes, hoje).find((d) => d.dose.id === id)!;

  it('rotavírus: 1ª até 11 meses e 29 dias, 2ª até 23 meses e 29 dias (NT 193/2024)', () => {
    const rota1 = DOSES.find((d) => d.id === 'rota-1')!;
    const rota2 = DOSES.find((d) => d.id === 'rota-2')!;
    expect(limiteDaDose(nasc, rota1)).toBe('2027-11-13');
    expect(limiteDaDose(nasc, rota2)).toBe('2028-11-13');
    // Fim de mês: 31/01 + 11 meses = 31/12 (ou o último dia), + 29 dias
    expect(limiteDaDose('2027-01-31', rota1)).toBe('2028-01-29');
    expect(sit([], '2027-11-13', 'rota-1').situacao).toBe('atrasada');
    const passou = sit([], '2027-11-14', 'rota-1');
    expect(passou.situacao).toBe('passou');
    expect(passou.limite).toBe('2027-11-13');
    // Sem a 1ª dose, a 2ª também não dá mais
    expect(sit([], '2027-11-14', 'rota-2').situacao).toBe('passou');
    // 1ª dada no limite: a 2ª fica 30 dias depois e ainda vale
    const comPrimeira = [{ dose_id: 'rota-1', status: 'aplicada' as const, data: '2027-11-10' }];
    expect(sit(comPrimeira, '2027-12-01', 'rota-2')).toMatchObject({ prevista: '2027-12-10', situacao: 'proxima' });
    expect(sit(comPrimeira, '2028-11-14', 'rota-2').situacao).toBe('passou');
    // Aplicada ou "não vai tomar" continuam como estão
    expect(sit(comPrimeira, '2028-11-14', 'rota-1').situacao).toBe('aplicada');
    expect(sit([{ dose_id: 'rota-1', status: 'pulada', data: null }], '2028-01-01', 'rota-1').situacao).toBe('pulada');
  });

  it('BCG e hepatite A (SUS): até 4 anos, 11 meses e 29 dias; dose sem idade máxima segue atrasada', () => {
    expect(sit([], '2031-11-13', 'bcg').situacao).toBe('atrasada');
    expect(sit([], '2031-11-14', 'bcg').situacao).toBe('passou');
    expect(sit([], '2031-11-14', 'hepa-sus').situacao).toBe('passou');
    expect(sit([], '2031-11-14', 'penta-1')).toMatchObject({ situacao: 'atrasada', limite: null });
  });

  it('não conta como atrasada no calendário assinado nem no aviso', () => {
    // Antes do limite: rotavírus atrasado aparece hoje no calendário
    const antes = eventosVacinas('b1', nasc, 'pni', [], '2027-11-10');
    expect(antes.find((e) => e.inicio === '2027-11-10')?.titulo).toMatch(/Rotavírus/);
    const depois = eventosVacinas('b1', nasc, 'pni', [], '2027-11-20');
    expect(depois.some((e) => /Rotavírus/.test(e.titulo))).toBe(false);
    // Aviso de atraso: uma dose que passou não avisa (BCG no dia seguinte ao limite seria "atrasada" sem a regra)
    const bebe = { id: 'b1', nome: 'Heitor', nascimento: nasc, calendario: 'pni' as const };
    expect(avisosVacina(m, bebe, [], t('2031-11-14T08:05'), SITE).some((a) => a.chave.includes(':bcg:'))).toBe(false);
  });
});

describe('remédio com prazo', () => {
  const r = { id: 'r1', nome: 'Amoxicilina', dose: '5 ml', intervalo_h: 8, ultima: { id: 'd9', inicio: t('2026-12-07T22:00').toISOString() } };

  it('avisa só até o último dia do tratamento', () => {
    // Próxima dose às 06:00 do dia 8: cai depois do último dia (7) e não avisa
    expect(avisosRemedio(m, [{ ...r, termina_em: '2026-12-07' }], t('2026-12-08T06:05'), SITE)).toEqual([]);
    expect(avisosRemedio(m, [{ ...r, termina_em: '2026-12-08' }], t('2026-12-08T06:05'), SITE)).toHaveLength(1);
    expect(avisosRemedio(m, [{ ...r, termina_em: null }], t('2026-12-08T06:05'), SITE)).toHaveLength(1);
  });
});
