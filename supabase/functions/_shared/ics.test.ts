import { describe, expect, it } from 'vitest';
import { dobrarIcs, montarIcs, textoMeses, type CompromissoIcs } from './ics.ts';

const agora = new Date('2026-11-20T12:00:00Z');
const SITE = 'https://neivapedro.github.io/app-nenem/';
const comp = (p: Partial<CompromissoIcs>): CompromissoIcs => ({
  id: 'c1',
  tipo: 'consulta',
  titulo: 'Pediatra',
  data: '2026-11-25',
  hora: '09:30',
  duracao_min: 60,
  local: 'Clínica Sol, sala 2',
  observacao: null,
  avisar_min: 60,
  ...p,
});
const desdobrar = (ics: string) => ics.replace(/\r\n /g, '');

describe('calendário assinado', () => {
  it('compromisso com hora vira evento em UTC, com local e alerta antes', () => {
    const ics = desdobrar(montarIcs({ compromissos: [comp({})], bebes: [], fuso: 'America/Sao_Paulo', agora, site: SITE }));
    expect(ics).toContain('UID:compromisso-c1@app-nenem');
    expect(ics).toContain('DTSTART:20261125T123000Z');
    expect(ics).toContain('DTEND:20261125T133000Z');
    expect(ics).toContain('SUMMARY:🩺 Pediatra');
    expect(ics).toContain('LOCATION:Clínica Sol\\, sala 2');
    expect(ics).toContain('TRIGGER:-PT1H');
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('dia inteiro: datas sem hora e alerta contado das 8h do dia', () => {
    const ics = desdobrar(
      montarIcs({ compromissos: [comp({ tipo: 'exame', titulo: 'Teste do pezinho', hora: null, avisar_min: 1440 })], bebes: [], fuso: 'America/Sao_Paulo', agora, site: SITE }),
    );
    expect(ics).toContain('DTSTART;VALUE=DATE:20261125');
    expect(ics).toContain('DTEND;VALUE=DATE:20261126');
    // 8h − 1 dia = 16h antes da meia-noite
    expect(ics).toContain('TRIGGER:-PT16H');
    expect(ics).toContain('SUMMARY:🧪 Teste do pezinho');
  });

  it('sem aviso: sem VALARM', () => {
    const ics = montarIcs({ compromissos: [comp({ avisar_min: null })], bebes: [], fuso: 'America/Sao_Paulo', agora, site: SITE });
    expect(ics).not.toContain('VALARM');
  });

  it('mesversários até 2 anos, pelo dia do nascimento no fuso', () => {
    // 01:30 de 31/01 em São Paulo = 04:30 UTC (mesmo dia)
    const ics = desdobrar(
      montarIcs({ compromissos: [], bebes: [{ id: 'b', nome: 'Maria', nascimento: '2027-01-31T04:30:00Z' }], fuso: 'America/Sao_Paulo', agora, site: SITE }),
    );
    expect((ics.match(/UID:mesversario-/g) ?? []).length).toBe(24);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270228');
    expect(ics).toContain('SUMMARY:🎂 Maria faz 1 mês');
    expect(ics).toContain('SUMMARY:🎂 Maria faz 1 ano');
    expect(ics).toContain('SUMMARY:🎂 Maria faz 1 ano e 1 mês');
    expect(ics).toContain('SUMMARY:🎂 Maria faz 2 anos');
  });

  it('bebê que não nasceu não tem mesversário', () => {
    const ics = montarIcs({ compromissos: [], bebes: [{ id: 'b', nome: '', nascimento: null }], fuso: 'America/Sao_Paulo', agora, site: SITE });
    expect(ics).not.toContain('mesversario');
  });

  it('textos e dobra de linhas', () => {
    expect(textoMeses(5)).toBe('5 meses');
    expect(textoMeses(14)).toBe('1 ano e 2 meses');
    const longa = 'SUMMARY:' + 'á'.repeat(100);
    const dobrada = dobrarIcs(longa);
    for (const parte of dobrada.split('\r\n')) expect(new TextEncoder().encode(parte).length).toBeLessThanOrEqual(75);
    expect(dobrada.replace(/\r\n /g, '')).toBe(longa);
  });
});
