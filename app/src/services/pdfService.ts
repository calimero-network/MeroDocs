import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

// Configure PDF.js worker for version 5.x
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.3.93/pdf.worker.min.mjs`;

console.log('PDF.js version:', pdfjsLib.version);
console.log('PDF.js worker configured');

export interface PDFPage {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  viewport: pdfjsLib.PageViewport;
  width: number;
  height: number;
}

export interface SignaturePosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
  signatureData: string;
  timestamp: number;
}

class PDFService {
  async loadPDF(file: File): Promise<pdfjsLib.PDFDocumentProxy> {
    try {
      console.log(
        'Loading PDF file:',
        file.name,
        'Size:',
        file.size,
        'Type:',
        file.type,
      );

      const arrayBuffer = await file.arrayBuffer();
      console.log(
        'File converted to ArrayBuffer, size:',
        arrayBuffer.byteLength,
      );

      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        // Remove cMap settings that might cause issues
      });

      console.log('Loading task created, waiting for promise...');
      const doc = await loadingTask.promise;

      console.log('PDF loaded successfully! Pages:', doc.numPages);
      return doc;
    } catch (error) {
      console.error('Detailed error loading PDF:', error);

      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Invalid PDF')) {
          throw new Error('The uploaded file is not a valid PDF document.');
        } else if (error.message.includes('worker')) {
          throw new Error(
            'PDF processing failed. Please try refreshing the page.',
          );
        } else {
          throw new Error(`PDF loading failed: ${error.message}`);
        }
      } else {
        throw new Error(
          'Failed to load PDF document. Please ensure it is a valid PDF file.',
        );
      }
    }
  }

  async renderPage(
    pdf: pdfjsLib.PDFDocumentProxy,
    pageNumber: number,
    scale: number = 1.5,
  ): Promise<PDFPage> {
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Unable to get 2D context');
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        enableWebGL: false,
      };

      await page.render(renderContext).promise;

      return {
        pageNumber,
        canvas,
        viewport,
        width: viewport.width,
        height: viewport.height,
      };
    } catch (error) {
      console.error('Error rendering PDF page:', error);
      throw new Error(`Failed to render page ${pageNumber}`);
    }
  }

  async renderAllPages(
    pdf: pdfjsLib.PDFDocumentProxy,
    scale: number = 1.5,
  ): Promise<PDFPage[]> {
    const numPages = pdf.numPages;
    const pages: PDFPage[] = [];

    for (let i = 1; i <= numPages; i++) {
      const page = await this.renderPage(pdf, i, scale);
      pages.push(page);
    }

    return pages;
  }

  async addSignatureToCanvas(
    canvas: HTMLCanvasElement,
    signature: SignaturePosition,
    scale: number = 1.5,
  ): Promise<void> {
    const context = canvas.getContext('2d');
    if (!context) return;

    console.log('Adding signature to canvas:', {
      signatureCoords: {
        x: signature.x,
        y: signature.y,
        width: signature.width,
        height: signature.height,
      },
      scale,
      canvasSize: { width: canvas.width, height: canvas.height },
      note: 'Signature coordinates are in canvas coordinate system (not scaled)',
    });

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          // The signature positions are in canvas coordinates, use them directly
          // (scale parameter is only used for rendering resolution, not coordinate conversion)
          context.drawImage(
            img,
            signature.x,
            signature.y,
            signature.width,
            signature.height,
          );
          console.log('Signature successfully drawn on canvas at:', {
            x: signature.x,
            y: signature.y,
            width: signature.width,
            height: signature.height,
          });
          resolve();
        } catch (error) {
          console.error('Error drawing signature on canvas:', error);
          reject(error);
        }
      };
      img.onerror = () => {
        console.error('Failed to load signature image');
        reject(new Error('Failed to load signature image'));
      };
      img.src = signature.signatureData;
    });
  }

  async generateSignedPDF(
    originalFile: File,
    signatures: SignaturePosition[],
    renderScale: number = 1.5,
  ): Promise<Blob> {
    console.log('Generating signed PDF with', signatures.length, 'signatures');
    console.log('Render scale:', renderScale);

    const pdf = await this.loadPDF(originalFile);

    // Render pages at higher resolution for better quality
    const pages = await this.renderAllPages(pdf, renderScale);
    console.log(
      'Rendered pages:',
      pages.map((p) => ({
        page: p.pageNumber,
        width: p.width,
        height: p.height,
      })),
    );

    // Add signatures to pages - wait for all signatures to be added
    const signaturePromises = signatures.map(async (signature) => {
      const page = pages.find((p) => p.pageNumber === signature.pageNumber);
      if (page) {
        console.log(
          'Adding signature to page',
          signature.pageNumber,
          'at PDF coordinates:',
          {
            x: signature.x,
            y: signature.y,
            width: signature.width,
            height: signature.height,
          },
        );
        console.log('Page dimensions:', {
          width: page.width,
          height: page.height,
        });

        // The signature positions are in PDF coordinates, scale them for the rendered canvas
        await this.addSignatureToCanvas(page.canvas, signature, renderScale);
      }
    });

    // Wait for all signatures to be added
    await Promise.all(signaturePromises);
    console.log('All signatures added to canvases');

    // Create new PDF with signed pages
    const signedPdf = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: [pages[0].width, pages[0].height],
    });

    for (let i = 0; i < pages.length; i++) {
      if (i > 0) {
        signedPdf.addPage([pages[i].width, pages[i].height]);
      }

      const imgData = pages[i].canvas.toDataURL('image/png');
      signedPdf.addImage(imgData, 'PNG', 0, 0, pages[i].width, pages[i].height);
    }

    console.log('Signed PDF generated successfully');
    return signedPdf.output('blob');
  }

  downloadPDF(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Test function to verify PDF.js is working
  async testPDFJS(): Promise<boolean> {
    try {
      console.log('Testing PDF.js configuration...');

      // Create a simple test PDF
      const testPDF = new jsPDF();
      testPDF.text('Test PDF for verification', 10, 10);
      const pdfBlob = testPDF.output('blob');

      // Convert to ArrayBuffer and try to load
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const doc = await loadingTask.promise;

      console.log(
        'PDF.js test successful! Document has',
        doc.numPages,
        'pages',
      );
      return true;
    } catch (error) {
      console.error('PDF.js test failed:', error);
      return false;
    }
  }
}

export const pdfService = new PDFService();
