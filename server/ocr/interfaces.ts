// OCR Strategy Interfaces and Types

export interface OcrResult {
  text: string;
  confidence: number;
  strategy: string;
  processingTime: number;
  characterCount: number;
  metadata: {
    resolution?: number;
    tesseractConfig?: string;
    conversionMethod?: string;
    fileSize?: number;
    [key: string]: any;
  };
}

export interface OcrStrategy {
  name: string;
  priority: number;
  description: string;
  execute(filePath: string): Promise<OcrResult>;
  validate(result: OcrResult): boolean;
  getSuccessCriteria(): {
    minCharacters: number;
    minConfidence: number;
  };
}

export interface OcrMetrics {
  strategyUsed: string;
  success: boolean;
  processingTime: number;
  characterCount: number;
  confidence: number;
  fallbackLevel: number;
  createdAt: Date;
  documentId: string;
  tenantId: string;
}

export interface TesseractConfig {
  name: string;
  language: string;
  options: {
    tessedit_pageseg_mode: string;
    tessedit_ocr_engine_mode: string;
    [key: string]: string;
  };
  description: string;
}

export interface ConversionStrategy {
  name: string;
  command: string;
  resolution: number;
  description: string;
  outputPattern: string;
}

export type OcrStrategyName = 
  | 'PDF_DIRECT_TEXT'
  | 'PDFTOTEXT_COMMAND'
  | 'PDF_TO_PNG_HIGH_RES'
  | 'PDF_TO_PNG_MEDIUM_RES'
  | 'PDF_TO_PNG_LOW_RES'
  | 'GHOSTSCRIPT_CONVERSION'
  | 'FILENAME_ANALYSIS';

export type TesseractConfigName =
  | 'PORTUGUES_PADRAO'
  | 'AUTO_DETECT'
  | 'BLOCO_UNICO'
  | 'MULTI_IDIOMA'
  | 'TEXTO_DENSO'
  | 'LINHA_UNICA';