import { describe, expect, it } from 'vitest';
import type { CompromissoIcs } from './ics.ts';
import { avisoMamada, avisosAgenda, type Alimentacao, type MembroAviso } from './lembretes.ts';

const SITE = 'https://neivapedro.github.io/app-nenem/';
const membro: MembroAviso = { user_id: 'u1', fuso_horario: 'America/Sao_Paulo', lembrete_mamada: true, lembrete_mamada_min: 180, lembrete_agenda: true };
const t = (s: string) => new Date(`${s}:00-03:00`);
const ultima: Alimentacao = {
  id: 'm1',
  tipo: 'mamada',
  inicio: t('2026-11-20T10:00').toISOString(),
  fim: t('2026-11-20T10:20').toISOString(),
  dados: { segmentos: [{ lado: 'E' }, { lado: 'D' }] },
};

describe('aviso da mamada', () => {
  it('avisa depois do intervalo, uma chave por mamada e por pessoa', () => {
    expect(avisoMamada(membro, ultima, false, t('2026-11-20T12:59'), SITE)).toBeNull();
    const a = avisoMamada(membro, ultima, false, t('2026-11-20T13:05'), SITE)!;
    expect(a.chave).toBe('mamada:m1:u1');
    expect(a.titulo).toBe('🍼 Já faz 3h05 desde a última mamada');
    expect(a.corpo).toBe('Última: 10:00 (peito E e D).');
  });

  it('não avisa com mamada em andamento, desligado ou muito tempo depois', () => {
    expect(avisoMamada(membro, ultima, true, t('2026-11-20T13:05'), SITE)).toBeNull();
    expect(avisoMamada({ ...membro, lembrete_mamada: false }, ultima, false, t('2026-11-20T13:05'), SITE)).toBeNull();
    expect(avisoMamada(membro, ultima, false, t('2026-11-20T16:30'), SITE)).toBeNull();
    expect(avisoMamada(membro, null, false, t('2026-11-20T13:05'), SITE)).toBeNull();
  });

  it('mamadeira mostra os ml', () => {
    const b: Alimentacao = { id: 'b1', tipo: 'mamadeira', inicio: t('2026-11-20T10:00').toISOString(), fim: null, dados: { ml: 90 } };
    expect(avisoMamada(membro, b, false, t('2026-11-20T13:00'), SITE)?.corpo).toBe('Última: 10:00 (mamadeira · 90 ml).');
  });
});

describe('avisos da agenda', () => {
  const c: CompromissoIcs = {
    id: 'c1',
    tipo: 'vacina',
    titulo: 'Vacinas do 2º mês',
    data: '2026-11-21',
    hora: '09:00',
    duracao_min: 30,
    local: 'UBS Centro',
    observacao: null,
    avisar_min: 1440,
  };

  it('avisa na antecedência escolhida e só dentro da janela', () => {
    expect(avisosAgenda(membro, [c], t('2026-11-20T08:59'), SITE)).toEqual([]);
    const [a] = avisosAgenda(membro, [c], t('2026-11-20T09:03'), SITE);
    expect(a.titulo).toBe('💉 Vacinas do 2º mês');
    expect(a.corpo).toBe('Amanhã às 09:00 · UBS Centro');
    expect(a.chave).toBe('agenda:c1:2026-11-21T09:00:1440:u1');
    expect(avisosAgenda(membro, [c], t('2026-11-20T16:00'), SITE)).toEqual([]);
  });

  it('dia inteiro conta das 8h; compromisso já começado não avisa', () => {
    const dia = { ...c, hora: null, avisar_min: 0 };
    expect(avisosAgenda(membro, [dia], t('2026-11-21T07:55'), SITE)).toEqual([]);
    expect(avisosAgenda(membro, [dia], t('2026-11-21T08:02'), SITE)[0].corpo).toBe('Hoje (dia inteiro) · UBS Centro');
    const meiaHora = { ...c, avisar_min: 30 };
    expect(avisosAgenda(membro, [meiaHora], t('2026-11-21T09:01'), SITE)).toEqual([]);
  });

  it('aviso "na hora" chega logo depois do início, mas não muito depois', () => {
    const naHora = { ...c, avisar_min: 0 };
    expect(avisosAgenda(membro, [naHora], t('2026-11-21T08:58'), SITE)).toEqual([]);
    const avisos = avisosAgenda(membro, [naHora], t('2026-11-21T09:02'), SITE);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].corpo).toBe('Hoje às 09:00 · UBS Centro');
    expect(avisosAgenda(membro, [naHora], t('2026-11-21T09:20'), SITE)).toEqual([]);
  });

  it('sem aviso ou desligado não avisa', () => {
    expect(avisosAgenda(membro, [{ ...c, avisar_min: null }], t('2026-11-20T09:03'), SITE)).toEqual([]);
    expect(avisosAgenda({ ...membro, lembrete_agenda: false }, [c], t('2026-11-20T09:03'), SITE)).toEqual([]);
  });
});
