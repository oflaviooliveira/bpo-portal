import { OcrStrategy, OcrResult } from '../interfaces';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class PdfToTextStrategy implements OcrStrategy {
  name = 'PDFTOTEXT_COMMAND';
  priority = 2;
  description = 'Extração via pdftotext command com layout preservado';

  async execute(filePath: string): Promise<OcrResult> {
    const startTime = Date.now();
    
    try {
      // Comando pdftotext com layout preservado
      const command = `pdftotext -layout "${filePath}" -`;
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stdout) {
        throw new Error(`pdftotext error: ${stderr}`);
      }
      
      const processingTime = Date.now() - startTime;
      const text = stdout.trim();
      
      return {
        text,
        confidence: text.length > 50 ? 90 : 65,
        strategy: this.name,
        processingTime,
        characterCount: text.length,
        metadata: {
          conversionMethod: 'pdftotext-layout',
          commandUsed: 'pdftotext -layout'
        }
      };
    } catch (error) {
      console.error(`PDFTOTEXT_COMMAND failed:`, error);
      return {
        text: '',
        confidence: 0,
        strategy: this.name,
        processingTime: Date.now() - startTime,
        characterCount: 0,
        metadata: {
          error: error instanceof Error ? error.message : 'pdftotext command failed',
          fallbackReason: 'Command execution failed'
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
      minConfidence: 75
    };
  }
}