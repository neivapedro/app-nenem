import { describe, expect, it } from 'vitest';
import { eventosTarefas, eventosVacinas, montarIcs } from './ics.ts';
import { avisosRemedio, avisosTarefas, avisosVacina, type MembroAviso } from './lembretes.ts';

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
