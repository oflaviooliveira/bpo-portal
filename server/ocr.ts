import { createWorker } from 'tesseract.js';
import pdf2pic from 'pdf2pic';
import fs from 'fs/promises';
import path from 'path';
import { advancedOCR } from './advanced-ocr';

interface OCRResult {
  text: string;
  confidence: number;
}

export async function processDocumentWithOCR(filePath: string): Promise<OCRResult> {
  try {
    // Usar o sistema avançado de OCR como principal
    console.log(`🚀 Iniciando OCR avançado com fallback em cascata`);
    
    const advancedResult = await advancedOCR.processDocument(filePath);
    
    // Converter formato do resultado avançado para o formato esperado
    return {
      text: advancedResult.text,
      confidence: advancedResult.confidence
    };
    
  } catch (error) {
    console.error(`❌ OCR avançado falhou, usando fallback básico:`, error);
    
    // Fallback para o sistema original como última tentativa
    return await processDocumentWithOCRBasic(filePath);
  }
}

// Manter o sistema original como fallback
async function processDocumentWithOCRBasic(filePath: string): Promise<OCRResult> {
  try {
    // Check if file exists
    await fs.access(filePath);
    
    // Read first few bytes to detect actual file type
    const fileBuffer = await fs.readFile(filePath);
    const fileHeader = fileBuffer.subarray(0, 10);
    
    let fileExtension = path.extname(filePath).toLowerCase();
    
    // Detect PDF by magic number
    if (fileHeader[0] === 0x25 && fileHeader[1] === 0x50 && fileHeader[2] === 0x44 && fileHeader[3] === 0x46) {
      fileExtension = '.pdf';
    }
    // Detect PNG by magic number
    else if (fileHeader[0] === 0x89 && fileHeader[1] === 0x50 && fileHeader[2] === 0x4E && fileHeader[3] === 0x47) {
      fileExtension = '.png';
    }
    // Detect JPEG by magic number
    else if (fileHeader[0] === 0xFF && fileHeader[1] === 0xD8 && fileHeader[2] === 0xFF) {
      fileExtension = '.jpg';
    }
    
    console.log(`🔍 OCR básico - Detectado formato: ${fileExtension} para arquivo: ${filePath}`);
    
    if (fileExtension === '.pdf') {
      return await processPDFWithOCR(filePath);
    } else if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
      return await processImageWithOCR(filePath);
    } else {
      console.warn(`⚠️ Formato não reconhecido: ${fileExtension}, tentando como imagem...`);
      return await processImageWithOCR(filePath);
    }
  } catch (error) {
    console.error('❌ OCR processing error:', error);
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

  const results = await convert(1, { responseType: "image" }); // Convert only first page
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
