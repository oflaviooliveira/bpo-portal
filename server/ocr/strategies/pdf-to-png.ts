import { OcrStrategy, OcrResult, ConversionStrategy } from '../interfaces';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export const CONVERSION_STRATEGIES: ConversionStrategy[] = [
  {
    name: 'PDF_TO_PNG_HIGH_RES',
    command: 'pdftoppm -f 1 -l 1 -png -r 300',
    resolution: 300,
    description: 'Conversão em alta resolução (300 DPI)',
    outputPattern: '-1.png'
  },
  {
    name: 'PDF_TO_PNG_MEDIUM_RES', 
    command: 'pdftoppm -f 1 -l 1 -png -r 150',
    resolution: 150,
    description: 'Conversão em resolução média (150 DPI)',
    outputPattern: '-1.png'
  },
  {
    name: 'PDF_TO_PNG_LOW_RES',
    command: 'pdftoppm -f 1 -l 1 -png -r 72',
    resolution: 72,
    description: 'Conversão em baixa resolução (72 DPI) - forçada',
    outputPattern: '-1.png'
  },
  {
    name: 'GHOSTSCRIPT_CONVERSION',
    command: 'gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r150 -dFirstPage=1 -dLastPage=1',
    resolution: 150,
    description: 'Conversão via Ghostscript (150 DPI)',
    outputPattern: '_gs.png'
  }
];

export class PdfToPngStrategy implements OcrStrategy {
  name: string;
  priority: number;
  description: string;
  private conversionStrategy: ConversionStrategy;

  constructor(conversionStrategy: ConversionStrategy) {
    this.conversionStrategy = conversionStrategy;
    this.name = conversionStrategy.name;
    this.priority = this.getPriorityByStrategy(conversionStrategy.name);
    this.description = conversionStrategy.description;
  }

  private getPriorityByStrategy(strategyName: string): number {
    const priorities: { [key: string]: number } = {
      'PDF_TO_PNG_HIGH_RES': 3,
      'PDF_TO_PNG_MEDIUM_RES': 4,
      'PDF_TO_PNG_LOW_RES': 5,
      'GHOSTSCRIPT_CONVERSION': 6
    };
    return priorities[strategyName] || 10;
  }

  async execute(filePath: string): Promise<OcrResult> {
    const startTime = Date.now();
    const baseName = path.basename(filePath, path.extname(filePath));
    const outputDir = path.dirname(filePath);
    
    try {
      // Gerar PNG usando a estratégia específica
      const pngPath = await this.convertPdfToPng(filePath, baseName, outputDir);
      
      if (!fs.existsSync(pngPath)) {
        throw new Error(`PNG file not created: ${pngPath}`);
      }

      console.log(`✅ ${this.name} SUCCESS: PNG criado em ${pngPath}`);
      
      const processingTime = Date.now() - startTime;
      
      return {
        text: pngPath, // Retorna o caminho do PNG para ser processado pelo Tesseract
        confidence: 85, // PNG criado com sucesso
        strategy: this.name,
        processingTime,
        characterCount: 0, // Será preenchido pelo Tesseract
        metadata: {
          resolution: this.conversionStrategy.resolution,
          conversionMethod: this.conversionStrategy.name,
          pngPath,
          commandUsed: this.conversionStrategy.command
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
          error: error instanceof Error ? error.message : 'Conversion failed',
          conversionMethod: this.conversionStrategy.name
        }
      };
    }
  }

  private async convertPdfToPng(filePath: string, baseName: string, outputDir: string): Promise<string> {
    let command: string;
    let outputPath: string;

    if (this.conversionStrategy.name === 'GHOSTSCRIPT_CONVERSION') {
      outputPath = path.join(outputDir, `${baseName}_gs.png`);
      command = `${this.conversionStrategy.command} -sOutputFile="${outputPath}" "${filePath}"`;
    } else {
      const tempBaseName = path.join(outputDir, `${baseName}_temp`);
      outputPath = `${tempBaseName}-1.png`;
      command = `${this.conversionStrategy.command} "${filePath}" "${tempBaseName}"`;
    }

    console.log(`🔄 Executando: ${command}`);
    
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !fs.existsSync(outputPath)) {
      throw new Error(`Conversion failed: ${stderr}`);
    }

    return outputPath;
  }

  validate(result: OcrResult): boolean {
    // Para estratégias de conversão, validamos se o PNG foi criado
    return result.confidence > 0 && result.metadata?.pngPath && 
           fs.existsSync(result.metadata.pngPath);
  }

  getSuccessCriteria() {
    return {
      minCharacters: 0, // PNG conversion doesn't produce text directly
      minConfidence: 80
    };
  }
}