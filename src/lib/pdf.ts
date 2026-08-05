import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

type Col = { header: string; dataKey: string };

function money(n: number): string {
  return `$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type PdfTableSection = {
  title?: string;
  columns: Col[];
  rows: Array<Record<string, string | number>>;
};

export function downloadPdfReport(opts: {
  title: string;
  subtitle?: string;
  summary?: Array<{ label: string; value: string }>;
  columns?: Col[];
  rows?: Array<Record<string, string | number>>;
  /** Tablas adicionales (o únicas si no pasás columns/rows) */
  sections?: PdfTableSection[];
  filename: string;
}): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 14;

  doc.setFontSize(16);
  doc.text('Salta Delivery', margin, 16);
  doc.setFontSize(12);
  doc.text(opts.title, margin, 24);
  if (opts.subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(90);
    doc.text(opts.subtitle, margin, 30);
    doc.setTextColor(0);
  }

  let y = opts.subtitle ? 36 : 30;
  if (opts.summary?.length) {
    doc.setFontSize(10);
    for (const s of opts.summary) {
      doc.text(`${s.label}: ${s.value}`, margin, y);
      y += 5;
    }
    y += 2;
  }

  const sections: PdfTableSection[] = [];
  if (opts.columns?.length && opts.rows) {
    sections.push({ columns: opts.columns, rows: opts.rows });
  }
  if (opts.sections?.length) sections.push(...opts.sections);

  for (const section of sections) {
    if (section.title) {
      const pageH = doc.internal.pageSize.getHeight();
      if (y > pageH - 40) {
        doc.addPage();
        y = 16;
      }
      doc.setFontSize(11);
      doc.setTextColor(12, 107, 107);
      doc.text(section.title, margin, y);
      doc.setTextColor(0);
      y += 6;
    }

    autoTable(doc, {
      startY: y,
      head: [section.columns.map((c) => c.header)],
      body: section.rows.map((r) => section.columns.map((c) => String(r[c.dataKey] ?? ''))),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [12, 107, 107] },
      margin: { left: margin, right: margin },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = ((doc as any).lastAutoTable?.finalY ?? y) + 10;
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Generado ${new Date().toLocaleString('es-AR')} · pág. ${i}/${pageCount}`,
      margin,
      doc.internal.pageSize.getHeight() - 8,
    );
  }

  doc.save(opts.filename);
}

export { money as formatMoneyPdf };
