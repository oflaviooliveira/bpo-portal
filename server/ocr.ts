import { createWorker } from 'tesseract.js';
import pdf2pic from 'pdf2pic';
import fs from 'fs/promises';
import path from 'path';

interface OCRResult {
  text: string;
  confidence: number;
}

export async function processDocumentWithOCR(filePath: string): Promise<OCRResult> {
  const fileExtension = path.extname(filePath).toLowerCase();
  
  try {
    if (fileExtension === '.pdf') {
      return await processPDFWithOCR(filePath);
    } else if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
      return await processImageWithOCR(filePath);
    } else {
      throw new Error(`Formato de arquivo não suportado: ${fileExtension}`);
    }
  } catch (error) {
    console.error('OCR processing error:', error);
    return {
      text: '',
      confidence: 0,
    };
  }
}

async function processPDFWithOCR(pdfPath: string): Promise<OCRResult> {
  // Convert PDF to image first
  const convert = pdf2pic.fromPath(pdfPath, {
    density: 300,
    saveFilename: "page",
    savePath: path.dirname(pdfPath),
    format: "png",
    width: 2000,
    height: 2000,
  });

  const results = await convert(1, { responseType: "buffer" }); // Convert only first page
  if (!results || !results.path) {
    throw new Error('Falha na conversão do PDF para imagem');
  }

  const ocrResult = await processImageWithOCR(results.path);
  
  // Clean up temporary image
  try {
    await fs.unlink(results.path);
  } catch (error) {
    console.warn('Failed to clean up temporary image:', error);
  }

  return ocrResult;
}

async function processImageWithOCR(imagePath: string): Promise<OCRResult> {
  const worker = await createWorker('por', 1, {
    logger: m => console.log('OCR:', m),
  });

  try {
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÇÈÉÊÍÓÔÕÚàáâãçèéêíóôõú.,/()-: ',
      tessedit_pageseg_mode: 1, // Automatic page segmentation with OSD
    });

    const { data } = await worker.recognize(imagePath);
    
    // Clean and normalize the text
    const cleanText = data.text
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      text: cleanText,
      confidence: data.confidence,
    };
  } finally {
    await worker.terminate();
  }
}

// Helper function to extract specific patterns from OCR text
export function extractFinancialData(ocrText: string): {
  amounts: string[];
  dates: string[];
  documents: string[];
} {
  // Brazilian currency pattern: R$ 1.234,56
  const amountRegex = /R\$?\s*(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/g;
  const amounts = Array.from(ocrText.matchAll(amountRegex), m => m[1]);

  // Date patterns: DD/MM/YYYY, DD/MM/YY, DD-MM-YYYY
  const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/g;
  const dates = Array.from(ocrText.matchAll(dateRegex), m => m[1]);

  // Document numbers (CNPJ, CPF, bank account numbers)
  const documentRegex = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{4,})/g;
  const documents = Array.from(ocrText.matchAll(documentRegex), m => m[1]);

  return {
    amounts,
    dates,
    documents,
  };
}
