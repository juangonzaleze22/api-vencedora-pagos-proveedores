import path from 'path';
import fs from 'fs';
import PDFDocument from 'pdfkit';
import { Writable } from 'stream';
import type { SupplierDetailedReport, PaymentMethod, DebtStatus } from '../types';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  ZELLE: 'Zelle',
  TRANSFER: 'Transferencia',
  CASH: 'Efectivo'
};

const DEBT_STATUS_LABELS: Record<DebtStatus, string> = {
  PENDING: 'Pendiente',
  PARTIALLY_PAID: 'Parcialmente pagado',
  PAID: 'Pagado',
  OVERDUE: 'Vencido'
};

// Colores del reporte
const COLORS = {
  primary: '#1e3a5f',
  primaryLight: '#2c5282',
  accent: '#2b6cb0',
  text: '#2d3748',
  textMuted: '#718096',
  border: '#e2e8f0',
  headerBg: '#f7fafc',
  boxBg: '#edf2f7',
  success: '#276749',
  warning: '#b7791f'
};

function getLogoPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'src', 'assets', 'logo.png'),
    path.join(process.cwd(), 'assets', 'image', 'logo.png'),
    path.join(process.cwd(), 'assets', 'logo.png'),
    path.join(__dirname, '..', 'assets', 'logo.png')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function formatDate(d: Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Genera un PDF con el reporte de pagos a un proveedor y lo escribe en el stream.
 */
export function generateSupplierPaymentsPdf(
  data: SupplierDetailedReport,
  writeStream: Writable
): void {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  doc.pipe(writeStream);

  const { supplier, totalPaid, paymentCount, averagePayment, debts, payments } = data;
  const pageWidth = 595;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;
  const maxY = 750;

  // ========== ENCABEZADO CON LOGO ==========
  const headerHeight = 52;
  doc.fillColor(COLORS.headerBg).rect(0, 0, pageWidth, headerHeight).fill();
  doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(0, headerHeight).lineTo(pageWidth, headerHeight).stroke();

  const logoPath = getLogoPath();
  if (logoPath) {
    try {
      doc.image(logoPath, margin, 10, { width: 90, height: 32 });
    } catch {
      // Si falla la imagen, seguir sin logo
    }
  }

  doc.fontSize(16).fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text('Reporte de Pagos a Proveedor', logoPath ? margin + 100 : margin, 14, {
    width: contentWidth - 100
  });
  doc.fontSize(9).fillColor(COLORS.textMuted).font('Helvetica');
  doc.text(`Generado el ${formatDate(new Date())}`, logoPath ? margin + 100 : margin, 32, {
    width: contentWidth - 100
  });

  doc.y = headerHeight + 22;

  // ========== INFORMACIÓN DEL PROVEEDOR (caja con fondo) ==========
  doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text('Datos del proveedor', margin, doc.y);
  doc.moveDown(0.4);
  const boxStartY = doc.y;
  const boxHeight = 68;
  doc.fillColor(COLORS.boxBg).rect(margin, boxStartY, contentWidth, boxHeight).fill();
  doc.strokeColor(COLORS.border).rect(margin, boxStartY, contentWidth, boxHeight).stroke();
  doc.fillColor(COLORS.text).font('Helvetica').fontSize(10);
  const boxInnerY = boxStartY + 8;
  doc.text(`Empresa: ${supplier.companyName}`, margin + 12, boxInnerY, { width: contentWidth - 24 });
  doc.text(`RIF: ${supplier.taxId ?? 'N/A'}`, margin + 12, boxInnerY + 14, { width: contentWidth - 24 });
  doc.text(`Teléfono: ${supplier.phone ?? 'N/A'}  |  Email: ${supplier.email ?? 'N/A'}`, margin + 12, boxInnerY + 28, {
    width: contentWidth - 24
  });
  doc.font('Helvetica-Bold').fillColor(COLORS.primary);
  doc.text(`Deuda total actual: USD ${formatCurrency(supplier.totalDebt)}`, margin + 12, boxInnerY + 44, {
    width: contentWidth - 24
  });
  doc.y = boxStartY + boxHeight + 18;

  // ========== RESUMEN DEL PERIODO (3 bloques visuales) ==========
  doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text('Resumen del periodo', margin, doc.y);
  doc.moveDown(0.5);

  const cardGap = 10;
  const cardWidth = (contentWidth - cardGap * 2) / 3;
  const cardHeight = 42;
  const cardY = doc.y;

  doc.fillColor(COLORS.primaryLight).rect(margin, cardY, cardWidth, cardHeight).fill();
  doc.fillColor('#fff').font('Helvetica').fontSize(8).text('Total pagado (USD)', margin + 8, cardY + 7, {
    width: cardWidth - 16
  });
  doc.font('Helvetica-Bold').fontSize(13).text(formatCurrency(totalPaid), margin + 8, cardY + 22, {
    width: cardWidth - 16
  });

  const card2X = margin + cardWidth + cardGap;
  doc.fillColor(COLORS.accent).rect(card2X, cardY, cardWidth, cardHeight).fill();
  doc.fillColor('#fff').font('Helvetica').fontSize(8).text('Cantidad de pagos', card2X + 8, cardY + 7, {
    width: cardWidth - 16
  });
  doc.font('Helvetica-Bold').fontSize(13).text(String(paymentCount), card2X + 8, cardY + 22, {
    width: cardWidth - 16
  });

  const card3X = margin + (cardWidth + cardGap) * 2;
  doc.fillColor(COLORS.primary).rect(card3X, cardY, cardWidth, cardHeight).fill();
  doc.fillColor('#fff').font('Helvetica').fontSize(8).text('Pago promedio (USD)', card3X + 8, cardY + 7, {
    width: cardWidth - 16
  });
  doc.font('Helvetica-Bold').fontSize(13).text(formatCurrency(averagePayment), card3X + 8, cardY + 22, {
    width: cardWidth - 16
  });

  doc.y = cardY + cardHeight + 20;

  // ========== TABLA DE PAGOS ==========
  doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text('Detalle de pagos', margin, doc.y);
  doc.moveDown(0.4);

  const colWidths = {
    fecha: 55,
    monto: 50,
    metodo: 55,
    remitente: 75,
    confirmacion: 62,
    bs: 48,
    estado: 45
  };
  const tableLeft = margin;
  const rowH = 18;
  const headerY = doc.y;
  doc.fillColor(COLORS.headerBg).rect(tableLeft, headerY, contentWidth, rowH).fill();
  doc.strokeColor(COLORS.border).rect(tableLeft, headerY, contentWidth, rowH).stroke();
  doc.fontSize(8).fillColor(COLORS.primary).font('Helvetica-Bold');
  let x = tableLeft + 6;
  doc.text('Fecha', x, headerY + 5, { width: colWidths.fecha }); x += colWidths.fecha;
  doc.text('Monto USD', x, headerY + 5, { width: colWidths.monto }); x += colWidths.monto;
  doc.text('Método', x, headerY + 5, { width: colWidths.metodo }); x += colWidths.metodo;
  doc.text('Remitente', x, headerY + 5, { width: colWidths.remitente }); x += colWidths.remitente;
  doc.text('Confirm.', x, headerY + 5, { width: colWidths.confirmacion }); x += colWidths.confirmacion;
  doc.text('Bs', x, headerY + 5, { width: colWidths.bs }); x += colWidths.bs;
  doc.text('Estado', x, headerY + 5, { width: colWidths.estado });

  doc.font('Helvetica').fillColor(COLORS.text).fontSize(8);
  let y = headerY + rowH;
  for (let i = 0; i < payments.length; i++) {
    if (y + rowH > maxY) {
      doc.addPage();
      doc.y = 50;
      y = 50;
    }
    const p = payments[i];
    const estado = [p.verified && 'Verif.', p.shared && 'Compart.'].filter(Boolean).join(', ') || '-';
    const bs = p.amountInBolivares != null ? formatCurrency(p.amountInBolivares) : '-';
    const remitente = (p.senderName || '-').substring(0, 14);
    const confirm = (p.confirmationNumber || '-').substring(0, 10);
    if (i % 2 === 1) {
      doc.save();
      doc.fillColor('#f0f4f8').rect(tableLeft, y, contentWidth, rowH).fill();
      doc.restore();
    }
    // Siempre restaurar el color de texto antes de escribir
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(8);
    x = tableLeft + 6;
    doc.text(formatDate(p.paymentDate), x, y + 5, { width: colWidths.fecha }); x += colWidths.fecha;
    doc.text(formatCurrency(p.amount), x, y + 5, { width: colWidths.monto }); x += colWidths.monto;
    doc.text(PAYMENT_METHOD_LABELS[p.paymentMethod], x, y + 5, { width: colWidths.metodo }); x += colWidths.metodo;
    doc.text(remitente, x, y + 5, { width: colWidths.remitente }); x += colWidths.remitente;
    doc.text(confirm, x, y + 5, { width: colWidths.confirmacion }); x += colWidths.confirmacion;
    doc.text(bs, x, y + 5, { width: colWidths.bs }); x += colWidths.bs;
    doc.text(estado, x, y + 5, { width: colWidths.estado });
    doc.strokeColor(COLORS.border).moveTo(tableLeft, y + rowH).lineTo(tableLeft + contentWidth, y + rowH).stroke();
    y += rowH;
  }
  if (payments.length === 0) {
    doc.text('No hay pagos en el periodo seleccionado.', tableLeft + 12, y + 6);
    y += rowH;
  }
  doc.y = y + 16;

  // ========== DESGLOSE POR DEUDAS (tabla clara: inicial / restante) ==========
  if (doc.y + 90 > maxY) doc.addPage();
  doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text('Desglose por deudas', margin, doc.y);
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor(COLORS.textMuted).font('Helvetica');
  doc.text('Monto inicial: valor original de la deuda. Monto restante: lo que falta por pagar.', margin, doc.y);
  doc.moveDown(0.5);

  const debtColW = {
    num: 50,
    inicial: 95,
    restante: 95,
    estado: 100,
    vence: 75
  };
  const debtTableW = debtColW.num + debtColW.inicial + debtColW.restante + debtColW.estado + debtColW.vence + 24;
  const debtHeaderY = doc.y;
  doc.fillColor(COLORS.primary).rect(margin, debtHeaderY, debtTableW, rowH).fill();
  doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
  x = margin + 6;
  doc.text('Deuda', x, debtHeaderY + 5, { width: debtColW.num }); x += debtColW.num;
  doc.text('Monto inicial (USD)', x, debtHeaderY + 5, { width: debtColW.inicial }); x += debtColW.inicial;
  doc.text('Monto restante (USD)', x, debtHeaderY + 5, { width: debtColW.restante }); x += debtColW.restante;
  doc.text('Estado', x, debtHeaderY + 5, { width: debtColW.estado }); x += debtColW.estado;
  doc.text('Vence', x, debtHeaderY + 5, { width: debtColW.vence });

  doc.font('Helvetica').fillColor(COLORS.text).fontSize(9);
  let debtY = debtHeaderY + rowH;
  for (const d of debts) {
    if (debtY + rowH > maxY) {
      doc.addPage();
      debtY = 50;
      doc.y = debtY - rowH;
    }
    doc.strokeColor(COLORS.border).moveTo(margin, debtY).lineTo(margin + debtTableW, debtY).stroke();
    doc.fillColor(COLORS.text).font('Helvetica').fontSize(9);
    x = margin + 6;
    doc.text(`#${d.debtNumber ?? d.id}`, x, debtY + 5, { width: debtColW.num }); x += debtColW.num;
    doc.text(formatCurrency(d.initialAmount), x, debtY + 5, { width: debtColW.inicial }); x += debtColW.inicial;
    doc.text(formatCurrency(d.remainingAmount), x, debtY + 5, { width: debtColW.restante }); x += debtColW.restante;
    doc.text(DEBT_STATUS_LABELS[d.status], x, debtY + 5, { width: debtColW.estado }); x += debtColW.estado;
    doc.text(formatDate(d.dueDate), x, debtY + 5, { width: debtColW.vence });
    debtY += rowH;
  }
  doc.strokeColor(COLORS.border).rect(margin, debtHeaderY, debtTableW, debtY - debtHeaderY).stroke();
  if (debts.length === 0) {
    doc.fillColor(COLORS.textMuted).text('No hay deudas registradas.', margin + 12, debtY + 6);
  }
  doc.y = debtY + 14;

  doc.end();
}
