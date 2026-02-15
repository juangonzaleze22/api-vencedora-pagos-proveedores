import { env } from '../config/env';

/** Lista de nombres de archivo de comprobantes (receiptFiles o legacy receiptFile) */
export function getReceiptFileNames(payment: { receiptFile?: string | null; receiptFiles?: unknown }): string[] {
  if (payment.receiptFiles != null && Array.isArray(payment.receiptFiles)) {
    return payment.receiptFiles as string[];
  }
  if (payment.receiptFile) {
    return [payment.receiptFile];
  }
  return [];
}

/** URL de una imagen: /api/payments/:id/receipt/:filename */
export function buildReceiptUrl(paymentId: number, receiptFileName: string): string {
  const basePath = `/api/payments/${paymentId}/receipt/${encodeURIComponent(receiptFileName)}`;
  const timestampMatch = receiptFileName.match(/receipt-(\d+)-/);
  const urlWithCache = timestampMatch ? `${basePath}?v=${timestampMatch[1]}` : basePath;
  if (env.API_BASE_URL) {
    const baseUrl = env.API_BASE_URL.replace(/\/$/, '');
    return `${baseUrl}${urlWithCache}`;
  }
  return urlWithCache;
}

export function buildReceiptUrls(paymentId: number, fileNames: string[]): string[] {
  return fileNames.map((name) => buildReceiptUrl(paymentId, name));
}

/** URL de la página de preview (HTML con Open Graph) para compartir en WhatsApp */
export function buildPreviewUrl(paymentId: number): string {
  const path = `/api/payments/${paymentId}/preview`;
  if (env.API_BASE_URL) {
    const baseUrl = env.API_BASE_URL.replace(/\/$/, '');
    return `${baseUrl}${path}`;
  }
  return path;
}

/**
 * Extrae el nombre del archivo de una URL de comprobante.
 * Ej: "http://localhost:3000/api/payments/20/receipt/receipt-1770860298749-548140308.JPG?v=1770860298749"
 *     -> "receipt-1770860298749-548140308.JPG"
 */
export function parseReceiptFilenameFromUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const pathPart = url.split('?')[0];
    const match = pathPart.match(/\/receipt\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}
