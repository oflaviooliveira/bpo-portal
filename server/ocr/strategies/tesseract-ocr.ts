import { OcrStrategy, OcrResult, TesseractConfig } from '../interfaces';
import { getTesseractConfig, getAllTesseractConfigs } from './tesseract-configs';
import * as fs from 'fs';

export class TesseractOcrStrategy implements OcrStrategy {
  name: string;
  priority: number;
  description: string;
  private tesseractConfig: TesseractConfig;

  constructor(configName: string, priority: number = 7) {
    this.tesseractConfig = getTesseractConfig(configName);
    this.name = `TESSERACT_${configName}`;
    this.priority = priority;
    this.description = `OCR Tesseract: ${this.tesseractConfig.description}`;
  }

  async execute(imagePath: string): Promise<OcrResult> {
    const startTime = Date.now();

    try {
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Image file not found: ${imagePath}`);
      }

      // Importação dinâmica do Tesseract
      const Tesseract = await import('tesseract.js');
      
      console.log(`🔍 Executando OCR Tesseract ${this.tesseractConfig.name} em: ${imagePath}`);
      
      const { data } = await Tesseract.recognize(imagePath, this.tesseractConfig.language, {
        logger: m => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      const processingTime = Date.now() - startTime;
      const text = data.text?.trim() || '';
      const confidence = Math.round(data.confidence || 0);
      
      console.log(`✅ ${this.name} SUCCESS: ${text.length} caracteres (confiança: ${confidence}%)`);

      return {
        text,
        confidence,
        strategy: this.name,
        processingTime,
        characterCount: text.length,
        metadata: {
          tesseractConfig: this.tesseractConfig.name,
          language: this.tesseractConfig.language,
          rawConfidence: data.confidence,
          wordsCount: (data as any).words?.length || 0,
          linesCount: (data as any).lines?.length || 0,
          paragraphsCount: (data as any).paragraphs?.length || 0
        }
      };
    } catch (error) {
      console.error(`❌ ${this.name} FAILED:`, error);
      return {
        text: '',
        confidence: 0,
        strategy: this.name,
        processingTime: Date.now() - startTime,
        characterCount: 0,
        metadata: {
          error: error instanceof Error ? error.message : 'OCR failed',
          tesseractConfig: this.tesseractConfig.name
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
      minCharacters: 20,
      minConfidence: 60
    };
  }
}

// Factory para criar todas as estratégias Tesseract
export function createAllTesseractStrategies(): TesseractOcrStrategy[] {
  const configs = getAllTesseractConfigs();
  return configs.map((config, index) => 
    new TesseractOcrStrategy(config.name, 7 + index)
  );
}