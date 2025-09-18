import { OcrStrategy, OcrResult } from '../interfaces';
import * as fs from 'fs';

export class PdfDirectTextStrategy implements OcrStrategy {
  name = 'PDF_DIRECT_TEXT';
  priority = 1;
  description = 'Extração direta de texto PDF usando pdf-parse';

  async execute(filePath: string): Promise<OcrResult> {
    const startTime = Date.now();
    
    try {
      // Importação dinâmica para evitar problemas de inicialização
      const pdfParse = await import('pdf-parse') as any;
      
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse.default(dataBuffer);
      
      const processingTime = Date.now() - startTime;
      
      return {
        text: data.text || '',
        confidence: data.text.length > 50 ? 95 : 70,
        strategy: this.name,
        processingTime,
        characterCount: data.text.length,
        metadata: {
          pages: data.numpages || 0,
          fileSize: dataBuffer.length,
          conversionMethod: 'pdf-parse'
        }
      };
    } catch (error) {
      console.error(`PDF_DIRECT_TEXT failed:`, error);
      return {
        text: '',
        confidence: 0,
        strategy: this.name,
        processingTime: Date.now() - startTime,
        characterCount: 0,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  validate(result: OcrResult): boolean {
    const criteria = this.getSuccessCriteria();
    return result.characterCount >= criteria.minCharacters && 
           result.confidence >= criteria.minConfidence;
  }

  getSuccessCriteria() {
    return {
      minCharacters: 50,
      minConfidence: 80
    };
  }
}