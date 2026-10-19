// Relatório em PDF para levar ao pediatra (carregado só quando pedido).
import { jsPDF } from 'jspdf';
import { autoTable, type RowInput } from 'jspdf-autotable';

export interface ModeloRelatorio {
  titulo: string;
  subtitulo: string;
  periodo: string;
  destaques: [string, string][];
  /** Tabela do resumo: por dia (períodos curtos) ou por mês (longos) */
  resumo: { titulo: string; cabecalho: string[]; linhas: RowInput[] };
  medidas: RowInput[];
  vacinasAplicadas: RowInput[];
  vacinasPendentes: RowInput[];
  remedios: RowInput[];
  temperaturas: RowInput[];
  observacoes: RowInput[];
  geradoEm: string;
}

const CINZA: [number, number, number] = [110, 110, 115];

export function gerarRelatorioPdf(m: ModeloRelatorio): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margem = 14;
  let y = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(m.titulo, margem, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...CINZA);
  doc.text(m.subtitulo, margem, y);
  y += 5;
  doc.text(m.periodo, margem, y);
  doc.setTextColor(0, 0, 0);
  y += 6;

  autoTable(doc, {
    startY: y,
    body: m.destaques.map(([a, b]) => [a, b]),
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.5 },
    columnStyles: { 0: { textColor: CINZA, cellWidth: 70 }, 1: { fontStyle: 'bold' } },
    margin: { left: margem, right: margem },
  });

  const secao = (titulo: string, cabecalho: string[], linhas: RowInput[], vazio: string) => {
    const docComTabela = doc as unknown as { lastAutoTable?: { finalY: number } };
    let inicio = (docComTabela.lastAutoTable?.finalY ?? y) + 8;
    if (inicio > 265) {
      doc.addPage();
      inicio = 18;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(titulo, margem, inicio);
    doc.setFont('helvetica', 'normal');
    if (!linhas.length) {
      doc.setFontSize(9);
      doc.setTextColor(...CINZA);
      doc.text(vazio, margem, inicio + 5);
      doc.setTextColor(0, 0, 0);
      autoTable(doc, { startY: inicio + 6, body: [], margin: { left: margem, right: margem } });
      return;
    }
    autoTable(doc, {
      startY: inicio + 2,
      head: [cabecalho],
      body: linhas,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 1.6, lineColor: [220, 220, 224], lineWidth: 0.2 },
      headStyles: { fillColor: [244, 243, 241], textColor: [40, 40, 45], fontStyle: 'bold' },
      margin: { left: margem, right: margem },
    });
  };

  secao(m.resumo.titulo, m.resumo.cabecalho, m.resumo.linhas, 'Sem registros no período.');
  secao('Crescimento (percentis da OMS)', ['Data', 'Idade', 'Peso', 'Comprimento', 'Perímetro cefálico'], m.medidas, 'Sem medidas registradas.');
  secao('Vacinas aplicadas', ['Data', 'Vacina', 'Dose', 'Onde'], m.vacinasAplicadas, 'Nenhuma vacina marcada no app.');
  secao('Próximas vacinas e atrasadas', ['A partir de', 'Vacina', 'Dose', 'Situação'], m.vacinasPendentes, 'Nenhuma pendência.');
  secao('Remédios (doses no período)', ['Quando', 'Remédio', 'Dose'], m.remedios, 'Nenhum remédio registrado no período.');
  secao('Temperaturas', ['Quando', 'Temperatura', 'Observação'], m.temperaturas, 'Nenhuma medição no período.');
  secao('Observações anotadas', ['Quando', 'Registro', 'Observação'], m.observacoes, 'Nenhuma observação no período.');

  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text(`Gerado pelo app Heitor em ${m.geradoEm} · página ${p} de ${paginas}`, margem, 290);
  }
  return doc.output('blob');
}
