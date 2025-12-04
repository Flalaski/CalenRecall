declare module 'pdfkit' {
  // Minimal typings to satisfy TypeScript for our usage.
  // We keep this loose on purpose to avoid coupling to pdfkit's internals.
  class PDFDocument {
    constructor(options?: any);
    pipe(destination: NodeJS.WritableStream): void;
    end(): void;

    fontSize(size: number): this;
    font(name: string): this;
    text(text: string, options?: any): this;
    moveDown(lines?: number): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    strokeColor(color: string): this;
    stroke(): this;

    addPage(): this;

    y: number;

    readonly page: {
      width: number;
      height: number;
      margins: { top: number; bottom: number; left: number; right: number };
    };
  }

  export default PDFDocument;
}


