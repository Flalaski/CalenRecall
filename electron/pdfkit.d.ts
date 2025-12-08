/**
 * Type definitions for PDFKit library.
 * Extended to include all methods used in the application.
 */
declare module 'pdfkit' {
  interface PDFDocumentOptions {
    size?: [number, number] | string;
    margins?: { top?: number; bottom?: number; left?: number; right?: number };
    [key: string]: unknown;
  }

  interface TextOptions {
    align?: 'left' | 'center' | 'right' | 'justify';
    width?: number;
    height?: number;
    [key: string]: unknown;
  }

  class PDFDocument {
    constructor(options?: PDFDocumentOptions);
    pipe(destination: NodeJS.WritableStream): void;
    end(): void;

    // Text methods
    fontSize(size: number): this;
    font(name: string): this;
    text(text: string, x?: number, y?: number, options?: TextOptions): this;
    moveDown(lines?: number): this;
    widthOfString(text: string, options?: TextOptions): number;
    heightOfString(text: string, options?: TextOptions): number;

    // Drawing methods
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    rect(x: number, y: number, width: number, height: number): this;
    roundedRect(x: number, y: number, width: number, height: number, radius?: number): this;
    circle(x: number, y: number, radius: number): this;
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): this;
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): this;
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): this;
    closePath(): this;
    
    // Color methods
    fillColor(color: string): this;
    strokeColor(color: string): this;
    fill(): this;
    stroke(): this;
    lineWidth(width: number): this;

    // Page methods
    addPage(): this;

    // Properties
    y: number;

    readonly page: {
      width: number;
      height: number;
      margins: { top: number; bottom: number; left: number; right: number };
    };
  }

  export default PDFDocument;
}


