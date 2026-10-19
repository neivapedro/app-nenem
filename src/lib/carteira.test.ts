import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { eventosDocumentos } from '../../supabase/functions/_shared/ics.ts';
import { avisosDocumentos, type MembroAviso } from '../../supabase/functions/_shared/lembretes.ts';
import { modeloCarteiraVacinacao } from './carteira-vacinacao';
import { KITS, montarKit, naCarteira } from './documentos';
import { montarCarteiraVacinacao, montarCopiaTamanhoReal } from './pdf-documentos';
import type { Bebe, Documento, VacinaRegistro } from './tipos';

const JPEG = Uint8Array.from(
  atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='),
  (c) => c.charCodeAt(0),
).buffer;

const doc = (p: Partial<Documento>): Documento => ({
  id: p.modelo_id ?? 'x',
  familia_id: 'f',
  bebe_id: 'b',
  criado_por: null,
  categoria: 'identificacao',
  modelo_id: null,
  titulo: 'Doc',
  numero: null,
  data: null,
  validade: null,
  observacao: null,
  arquivos: [],
  ...p,
});
const arq = [{ caminho: 'f/a.jpg', nome: 'a.jpg', tipo: 'image/jpeg', tamanho: 10 }];

describe('carteira de documentos', () => {
  it('entra na carteira pelo tipo (com foto) ou pela escolha da família', () => {
    expect(naCarteira(doc({ modelo_id: 'cns', arquivos: arq }))).toBe(true);
    expect(naCarteira(doc({ modelo_id: 'cns' }))).toBe(false); // sem foto ainda
    expect(naCarteira(doc({ modelo_id: 'cns', arquivos: arq, fixado: false }))).toBe(false);
    expect(naCarteira(doc({ modelo_id: null, arquivos: arq }))).toBe(false);
    expect(naCarteira(doc({ modelo_id: null, fixado: true }))).toBe(true);
  });

  it('kit junta o que existe, aponta o que falta e pega os exames mais recentes', () => {
    const consulta = KITS.find((k) => k.id === 'consulta')!;
    const docs = [
      doc({ modelo_id: 'cns', numero: '700' }),
      doc({ id: 'e1', categoria: 'exames', titulo: 'Exame antigo', data: '2026-01-01', arquivos: arq }),
      doc({ id: 'e2', categoria: 'exames', titulo: 'Exame novo', data: '2026-12-01', arquivos: arq }),
      doc({ id: 'e3', categoria: 'exames', titulo: 'Exame meio', data: '2026-06-01', arquivos: arq }),
      doc({ id: 'e4', categoria: 'exames', titulo: 'Exame velho', data: '2025-01-01', arquivos: arq }),
    ];
    const k = montarKit(consulta, docs);
    expect(k.incluiVacinacao).toBe(true);
    expect(k.documentos.map((d) => d.id)).toEqual(['cns', 'e2', 'e3', 'e1']);
    expect(k.faltam.map((m) => m.id)).toEqual(['carteirinha', 'caderneta', 'alta']);
  });

  it('aviso de vencimento: 30 e 7 dias antes e no dia, às 8h; desliga pela preferência', () => {
    const m: MembroAviso = { user_id: 'u', fuso_horario: 'America/Sao_Paulo', lembrete_mamada: false, lembrete_mamada_min: 180, lembrete_agenda: true };
    const docs = [
      { id: 'p', titulo: 'Passaporte', validade: '2027-03-31' },
      { id: 'c', titulo: 'Carteirinha', validade: '2027-03-08' },
      { id: 'r', titulo: 'Receita', validade: '2027-03-01' },
      { id: 's', titulo: 'Sem validade', validade: null },
    ];
    const as9h = new Date('2027-03-01T09:00:00-03:00');
    const avisos = avisosDocumentos(m, docs, as9h, 'https://x/');
    expect(avisos.map((a) => a.titulo)).toEqual(['📄 Passaporte vence em 30 dias', '📄 Carteirinha vence em 7 dias', '📄 Receita vence hoje']);
    expect(avisos[0].url).toBe('https://x/documentos');
    expect(avisosDocumentos(m, docs, new Date('2027-03-01T06:00:00-03:00'), 'https://x/')).toEqual([]);
    expect(avisosDocumentos({ ...m, lembrete_documento: false }, docs, as9h, 'https://x/')).toEqual([]);
    const ev = eventosDocumentos(docs);
    expect(ev.map((e) => [e.inicio, e.titulo])).toContainEqual(['2027-03-01', '📄 Renovar: Passaporte']);
    expect(ev.map((e) => [e.inicio, e.titulo])).toContainEqual(['2027-03-31', '📄 Vence: Passaporte']);
    expect(ev).toHaveLength(6);
  });

  it('comprovante de vacinação e cópia em tamanho real viram PDFs válidos', async () => {
    const bebe: Bebe = { id: 'b', familia_id: 'f', nome: 'Heitor', sexo: 'M', data_prevista: null, nascimento: '2026-11-15T13:00:00.000Z', peso_nascer_g: null, altura_nascer_cm: null, pc_nascer_cm: null, calendario_vacinal: 'pni' };
    const vac: VacinaRegistro[] = [
      { id: '1', familia_id: 'f', bebe_id: 'b', criado_por: null, dose_id: 'bcg', nome: null, status: 'aplicada', data: '2026-11-15', rede: 'sus', local: 'Maternidade', lote: 'A1', observacao: null },
      { id: '2', familia_id: 'f', bebe_id: 'b', criado_por: null, dose_id: 'hepb-nascer', nome: null, status: 'aplicada', data: '2026-11-15', rede: 'sus', local: null, lote: null, observacao: null },
    ];
    const m = modeloCarteiraVacinacao(bebe, vac, [doc({ modelo_id: 'cpf', numero: '123.456.789-00' })], '2027-01-20', 'agora');
    expect(m.aplicadas).toHaveLength(2);
    expect(m.aplicadas[0]).toEqual(['15/11/2026', 'BCG', 'Dose única', 'SUS · Maternidade · lote A1']);
    expect(m.identificacao).toEqual([['CPF', '123.456.789-00']]);
    expect(m.pendentes.some((p) => p[1].startsWith('Pentavalente'))).toBe(true);
    const pdf = await PDFDocument.load(await montarCarteiraVacinacao(m));
    expect(pdf.getPageCount()).toBeGreaterThanOrEqual(1);

    const fotos = [
      { nome: 'frente.jpg', tipo: 'image/jpeg', bytes: JPEG },
      { nome: 'verso.jpg', tipo: 'image/jpeg', bytes: JPEG },
    ];
    expect((await PDFDocument.load(await montarCopiaTamanhoReal(fotos, 'cartao', 'Cartão do SUS'))).getPageCount()).toBe(1);
    expect((await PDFDocument.load(await montarCopiaTamanhoReal(fotos, 'meia', 'Caderneta'))).getPageCount()).toBe(1);
    expect((await PDFDocument.load(await montarCopiaTamanhoReal(fotos, 'folha', 'Certidão'))).getPageCount()).toBe(2);
    await expect(montarCopiaTamanhoReal([], 'cartao', 'x')).rejects.toThrow();
  });
});
