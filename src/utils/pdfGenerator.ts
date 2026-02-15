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

const TIMEZONE_VENEZUELA = 'America/Caracas';

function formatDate(d: Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('es-VE', {
    timeZone: TIMEZONE_VENEZUELA,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/** Solo hora (HH:mm) en zona Venezuela, para columna separada. */
function formatTime(d: Date): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('es-VE', {
    timeZone: TIMEZONE_VENEZUELA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
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

  const { supplier, totalPaid, paymentCount, debts, payments } = data;
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

  // ========== RESUMEN DEL PERIODO (2 bloques visuales) ==========
  doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
  doc.text('Resumen del periodo', margin, doc.y);
  doc.moveDown(0.5);

  const cardGap = 10;
  const cardWidth = (contentWidth - cardGap) / 2;
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

  doc.y = cardY + cardHeight + 20;

  // Agrupar pagos por deuda para mostrar cada deuda con sus pagos y su desglose
  const paymentsByDebtId: Record<number, typeof payments> = {};
  for (const p of payments) {
    if (!paymentsByDebtId[p.debtId]) paymentsByDebtId[p.debtId] = [];
    paymentsByDebtId[p.debtId].push(p);
  }

  const colWidths = {
    fecha: 50,
    hora: 32,
    monto: 48,
    metodo: 50,
    remitente: 62,
    confirmacion: 52,
    bs: 42,
    tasa: 38,
    cajero: 58
  };
  const tableLeft = margin;
  const rowH = 18;

  for (const d of debts) {
    const debtLabel = d.title ? `#${d.debtNumber ?? d.id} - ${d.title}` : `#${d.debtNumber ?? d.id}`;
    const debtPayments = paymentsByDebtId[d.id] ?? [];

    // ---------- Título: Detalle de pagos de {{deuda}} ----------
    if (doc.y + 100 > maxY) doc.addPage();
    doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
    doc.text(`Detalle de pagos de ${debtLabel}`, margin, doc.y);
    doc.moveDown(0.4);

    // Tabla de pagos de esta deuda
    const headerY = doc.y;
    doc.fillColor(COLORS.headerBg).rect(tableLeft, headerY, contentWidth, rowH).fill();
    doc.strokeColor(COLORS.border).rect(tableLeft, headerY, contentWidth, rowH).stroke();
    doc.fontSize(8).fillColor(COLORS.primary).font('Helvetica-Bold');
    let x = tableLeft + 6;
    doc.text('Fecha', x, headerY + 5, { width: colWidths.fecha }); x += colWidths.fecha;
    doc.text('Hora', x, headerY + 5, { width: colWidths.hora }); x += colWidths.hora;
    doc.text('Monto USD', x, headerY + 5, { width: colWidths.monto }); x += colWidths.monto;
    doc.text('Método', x, headerY + 5, { width: colWidths.metodo }); x += colWidths.metodo;
    doc.text('Remitente', x, headerY + 5, { width: colWidths.remitente }); x += colWidths.remitente;
    doc.text('Confirm.', x, headerY + 5, { width: colWidths.confirmacion }); x += colWidths.confirmacion;
    doc.text('Bs', x, headerY + 5, { width: colWidths.bs }); x += colWidths.bs;
    doc.text('Tasa', x, headerY + 5, { width: colWidths.tasa }); x += colWidths.tasa;
    doc.text('Registrado por', x, headerY + 5, { width: colWidths.cajero });

    doc.font('Helvetica').fillColor(COLORS.text).fontSize(8);
    let y = headerY + rowH;
    for (let i = 0; i < debtPayments.length; i++) {
      if (y + rowH > maxY) {
        doc.addPage();
        y = 50;
      }
      const p = debtPayments[i];
      const bs = p.amountInBolivares != null ? formatCurrency(p.amountInBolivares) : '-';
      const tasa = p.exchangeRate != null ? formatCurrency(p.exchangeRate) : '-';
      const cajero = (p.createdByUser?.nombre ?? '-').substring(0, 12);
      const remitente = (p.senderName || '-').substring(0, 12);
      const confirm = (p.confirmationNumber || '-').substring(0, 8);
      if (i % 2 === 1) {
        doc.save();
        doc.fillColor('#f0f4f8').rect(tableLeft, y, contentWidth, rowH).fill();
        doc.restore();
      }
      doc.fillColor(COLORS.text).font('Helvetica').fontSize(8);
      x = tableLeft + 6;
      doc.text(formatDate(p.paymentDate), x, y + 5, { width: colWidths.fecha }); x += colWidths.fecha;
      doc.text(formatTime(p.paymentDate), x, y + 5, { width: colWidths.hora }); x += colWidths.hora;
      doc.text(formatCurrency(p.amount), x, y + 5, { width: colWidths.monto }); x += colWidths.monto;
      doc.text(PAYMENT_METHOD_LABELS[p.paymentMethod], x, y + 5, { width: colWidths.metodo }); x += colWidths.metodo;
      doc.text(remitente, x, y + 5, { width: colWidths.remitente }); x += colWidths.remitente;
      doc.text(confirm, x, y + 5, { width: colWidths.confirmacion }); x += colWidths.confirmacion;
      doc.text(bs, x, y + 5, { width: colWidths.bs }); x += colWidths.bs;
      doc.text(tasa, x, y + 5, { width: colWidths.tasa }); x += colWidths.tasa;
      doc.text(cajero, x, y + 5, { width: colWidths.cajero });
      doc.strokeColor(COLORS.border).moveTo(tableLeft, y + rowH).lineTo(tableLeft + contentWidth, y + rowH).stroke();
      y += rowH;
    }
    if (debtPayments.length === 0) {
      doc.text('No hay pagos en el periodo para esta deuda.', tableLeft + 12, y + 6);
      y += rowH;
    }
    doc.y = y + 10;

    // Footer: resumen de la deuda (padding generoso para que no choque con la card)
    const totalPagadoDeuda = d.initialAmount - d.remainingAmount;
    const footerTitleH = 14;
    const bodyPadH = 18;
    const bodyPadV = 14;
    const row1Y = bodyPadV;
    const row2Y = bodyPadV + 22;
    const footerBodyH = bodyPadV + 22 + 12 + bodyPadV + 6;
    const footerH = footerTitleH + footerBodyH;
    if (doc.y + footerH > maxY) doc.addPage();
    const footerY = doc.y;
    doc.fillColor(COLORS.primaryLight).rect(margin, footerY, contentWidth, footerTitleH).fill();
    doc.fillColor('#fff').font('Helvetica-Bold').fontSize(8);
    doc.text('Resumen de la deuda', margin + bodyPadH, footerY + 4, { width: contentWidth - bodyPadH * 2 });
    doc.fillColor(COLORS.boxBg).rect(margin, footerY + footerTitleH, contentWidth, footerBodyH).fill();
    doc.strokeColor(COLORS.border).lineWidth(0.5).rect(margin, footerY, contentWidth, footerH).stroke();
    const bodyY = footerY + footerTitleH;
    const innerW = contentWidth - bodyPadH * 2;
    const colW = innerW / 3;
    const x1 = margin + bodyPadH;
    const x2 = margin + bodyPadH + colW;
    const x3 = margin + bodyPadH + colW * 2;
    doc.font('Helvetica');
    doc.fillColor(COLORS.textMuted).fontSize(7);
    doc.text('Monto inicial', x1, bodyY + row1Y, { width: colW });
    doc.text('Total pagado', x2, bodyY + row1Y, { width: colW });
    doc.text('Monto restante', x3, bodyY + row1Y, { width: colW });
    doc.fillColor(COLORS.text).fontSize(9);
    doc.text(`${formatCurrency(d.initialAmount)} USD`, x1, bodyY + row1Y + 10, { width: colW });
    doc.text(`${formatCurrency(totalPagadoDeuda)} USD`, x2, bodyY + row1Y + 10, { width: colW });
    doc.text(`${formatCurrency(d.remainingAmount)} USD`, x3, bodyY + row1Y + 10, { width: colW });
    doc.fillColor(COLORS.textMuted).fontSize(7);
    doc.text('Estado', x1, bodyY + row2Y, { width: colW });
    doc.text('Vence', x2, bodyY + row2Y, { width: colW });
    doc.fillColor(COLORS.text).fontSize(9);
    doc.text(DEBT_STATUS_LABELS[d.status], x1, bodyY + row2Y + 10, { width: colW });
    doc.text(formatDate(d.dueDate), x2, bodyY + row2Y + 10, { width: colW });
    doc.y = footerY + footerH + 18;
  }

  if (debts.length === 0) {
    doc.fontSize(11).fillColor(COLORS.primary).font('Helvetica-Bold');
    doc.text('Detalle de pagos', margin, doc.y);
    doc.moveDown(0.4);
    doc.font('Helvetica').fillColor(COLORS.textMuted).fontSize(9);
    doc.text('No hay deudas registradas para este proveedor.', margin, doc.y);
    doc.moveDown(0.5);
  }

  doc.end();
}
