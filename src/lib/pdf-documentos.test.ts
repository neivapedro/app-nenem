import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { combinaBusca, guardado, nomeArquivo, situacaoValidade } from './documentos';
import { montarPdfDocumentos } from './pdf-documentos';
import type { Documento } from './tipos';

// JPEG 1x1 (branco)
const JPEG = Uint8Array.from(
  atob(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
  ),
  (c) => c.charCodeAt(0),
).buffer;

async function pdfDe(paginas: number): Promise<ArrayBuffer> {
  const d = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) d.addPage();
  const b = await d.save();
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

const doc = (p: Partial<Documento>): Documento => ({
  id: 'd',
  familia_id: 'f',
  bebe_id: 'b',
  criado_por: null,
  categoria: 'identificacao',
  modelo_id: null,
  titulo: 'Certidão de nascimento',
  numero: null,
  data: null,
  validade: null,
  observacao: null,
  arquivos: [],
  ...p,
});

describe('documentos', () => {
  it('validade, guardado, nome e busca', () => {
    expect(situacaoValidade(null, '2026-11-20')).toBeNull();
    expect(situacaoValidade('2026-11-19', '2026-11-20')).toBe('vencido');
    expect(situacaoValidade('2026-12-31', '2026-11-20')).toBe('vence-logo');
    expect(situacaoValidade('2027-06-01', '2026-11-20')).toBe('ok');
    expect(guardado(undefined)).toBe(false);
    expect(guardado(doc({ numero: ' ' }))).toBe(false);
    expect(guardado(doc({ numero: '123' }))).toBe(true);
    expect(nomeArquivo('Receita 12/11', 'Heitor')).toBe('Receita 12-11 - Heitor.pdf');
    expect(combinaBusca(doc({ numero: '700 1234' }), 'certidao')).toBe(true);
    expect(combinaBusca(doc({ numero: '700 1234' }), '1234')).toBe(true);
    expect(combinaBusca(doc({}), 'passaporte')).toBe(false);
    // CPF digitado só com números acha o número com pontos e traço
    expect(combinaBusca(doc({ numero: '123.456.789-00' }), '12345678900')).toBe(true);
    expect(combinaBusca(doc({ numero: '123.456.789-00' }), '456789')).toBe(true);
    expect(combinaBusca(doc({ numero: '123.456.789-00' }), '999')).toBe(false);
  });

  it('junta fotos e PDFs com capa e índice', async () => {
    const { bytes, avisos } = await montarPdfDocumentos(
      [
        { titulo: 'Certidão de nascimento', categoria: 'Identificação', numero: '123 → 456 😀', data: '20/11/2026', validade: null, observacao: null, arquivos: [{ nome: 'frente.jpg', tipo: 'image/jpeg', bytes: JPEG }, { nome: 'verso.jpg', tipo: 'image/jpeg', bytes: JPEG }] },
        { titulo: 'Resultado do pezinho', categoria: 'Exames', numero: null, data: null, validade: null, observacao: null, arquivos: [{ nome: 'laudo.pdf', tipo: 'application/pdf', bytes: await pdfDe(3) }] },
        { titulo: 'CPF', categoria: 'Identificação', numero: '000.000.000-00', data: null, validade: null, observacao: 'Só o número', arquivos: [] },
        { titulo: 'Quebrado', categoria: 'Outros', numero: null, data: null, validade: null, observacao: null, arquivos: [{ nome: 'x.pdf', tipo: 'application/pdf', bytes: new Uint8Array([1, 2, 3]).buffer }] },
      ],
      { titulo: 'Documentos – Heitor', subtitulo: 'Nasceu em 15/11/2026', geradoEm: '20/11/2026' },
    );
    const lido = await PDFDocument.load(bytes);
    // capa + 2 fotos + 3 páginas do laudo + 1 do CPF + 1 aviso do arquivo quebrado
    expect(lido.getPageCount()).toBe(1 + 2 + 3 + 1 + 1);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('x.pdf');
  });

  it('PDF protegido que não dá para desenhar e arquivo que não baixou viram página de aviso (não saem em branco)', async () => {
    // PDF marcado como criptografado (o pdf-lib copiaria as páginas em branco)
    const d = await PDFDocument.create();
    d.addPage();
    d.addPage();
    d.context.trailerInfo.Encrypt = d.context.obj({ Filter: 'Standard', V: 2, R: 3, Length: 128 });
    const b = await d.save({ useObjectStreams: false });
    const cifrado = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    expect((await PDFDocument.load(cifrado, { ignoreEncryption: true })).isEncrypted).toBe(true);
    const { bytes, avisos } = await montarPdfDocumentos(
      [
        { titulo: 'Conta de luz', categoria: 'Família', numero: null, data: null, validade: null, observacao: null, arquivos: [{ nome: 'conta.pdf', tipo: 'application/pdf', bytes: cifrado }] },
        {
          titulo: 'Receita',
          categoria: 'Saúde',
          numero: null,
          data: null,
          validade: null,
          observacao: null,
          arquivos: [
            { nome: 'foto.jpg', tipo: 'image/jpeg', bytes: JPEG },
            { nome: 'verso.jpg', tipo: 'image/jpeg', bytes: new ArrayBuffer(0), erro: 'não deu para baixar: sem internet' },
          ],
        },
      ],
      null,
    );
    // aviso da conta + foto + aviso do verso
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(3);
    expect(avisos).toHaveLength(2);
    expect(avisos[0]).toContain('conta.pdf');
    expect(avisos[1]).toContain('sem internet');
  });

  it('índice com muitos documentos ocupa mais de uma página', async () => {
    const muitos = Array.from({ length: 30 }, (_, i) => ({ titulo: `Doc ${i}`, categoria: 'Outros', numero: null, data: null, validade: null, observacao: null, arquivos: [] }));
    const { bytes } = await montarPdfDocumentos(muitos, { titulo: 'Documentos', subtitulo: '', geradoEm: 'hoje' });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2 + 30);
  });
});
