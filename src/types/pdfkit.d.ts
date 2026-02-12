declare module 'pdfkit' {
  import { Readable } from 'stream';

  interface PDFDocumentOptions {
    margin?: number;
    size?: string;
    [key: string]: unknown;
  }

  class PDFDocument extends Readable {
    constructor(options?: PDFDocumentOptions);
    pipe<T extends NodeJS.WritableStream>(destination: T): T;
    end(): void;
    addPage(): PDFDocument;
    font(sizeOrFamily: string | number, size?: number): PDFDocument;
    fontSize(size: number): PDFDocument;
    text(text: string, options?: { width?: number; align?: string }): PDFDocument;
    text(text: string, x: number, y?: number, options?: { width?: number; align?: string }): PDFDocument;
    moveDown(n?: number): PDFDocument;
    moveTo(x: number, y: number): PDFDocument;
    lineTo(x: number, y: number): PDFDocument;
    stroke(): PDFDocument;
    fill(fill?: boolean): PDFDocument;
    fillColor(color: string): PDFDocument;
    strokeColor(color: string): PDFDocument;
    rect(x: number, y: number, w: number, h: number): PDFDocument;
    image(src: string | Buffer, x?: number, y?: number, options?: { width?: number; height?: number }): PDFDocument;
    get y(): number;
    set y(value: number);
  }

  export = PDFDocument;
}
