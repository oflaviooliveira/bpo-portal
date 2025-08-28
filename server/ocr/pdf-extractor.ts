import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
// pdf-parse will be imported dynamically when needed

const execAsync = promisify(exec);

export interface PdfExtractionResult {
  success: boolean;
  text?: string;
  method: string;
  confidence: number;
  error?: string;
}

export class PdfTextExtractor {
  private uploadDir: string;

  constructor(uploadDir: string = 'uploads') {
    this.uploadDir = uploadDir;
  }

  /**
   * Extrai texto de PDF usando múltiplas estratégias em ordem de prioridade
   */
  async extractText(filePath: string): Promise<PdfExtractionResult> {
    console.log(`📄 Iniciando extração de texto PDF: ${filePath}`);

    // Estratégia 1: Extração direta de texto nativo do PDF
    try {
      const result = await this.extractNativeText(filePath);
      if (result.success && result.text && result.text.trim().length > 50) {
        console.log(`✅ Extração nativa bem-sucedida: ${result.text.length} caracteres`);
        return result;
      }
    } catch (error) {
      console.log(`⚠️ Extração nativa falhou: ${error}`);
    }

    // Estratégia 2: Conversão para imagem de alta qualidade
    try {
      const result = await this.extractViaHighResImage(filePath);
      if (result.success && result.text && result.text.trim().length > 20) {
        console.log(`✅ Extração via imagem HD bem-sucedida: ${result.text.length} caracteres`);
        return result;
      }
    } catch (error) {
      console.log(`⚠️ Extração via imagem HD falhou: ${error}`);
    }

    // Estratégia 3: Conversão para imagem de média qualidade
    try {
      const result = await this.extractViaMediumResImage(filePath);
      if (result.success && result.text && result.text.trim().length > 10) {
        console.log(`✅ Extração via imagem média bem-sucedida: ${result.text.length} caracteres`);
        return result;
      }
    } catch (error) {
      console.log(`⚠️ Extração via imagem média falhou: ${error}`);
    }

    // Estratégia 4: Conversão com Ghostscript
    try {
      const result = await this.extractViaGhostscript(filePath);
      if (result.success && result.text && result.text.trim().length > 10) {
        console.log(`✅ Extração via Ghostscript bem-sucedida: ${result.text.length} caracteres`);
        return result;
      }
    } catch (error) {
      console.log(`⚠️ Extração via Ghostscript falhou: ${error}`);
    }

    // Fallback: análise do nome do arquivo
    return {
      success: false,
      method: 'FAILED_ALL_STRATEGIES',
      confidence: 0,
      error: 'Todas as estratégias de extração falharam'
    };
  }

  /**
   * Estratégia 1: Extração direta de texto nativo do PDF
   */
  private async extractNativeText(filePath: string): Promise<PdfExtractionResult> {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const pdf = (await import('pdf-parse')).default;
      const data = await pdf(dataBuffer);
      
      if (data.text && data.text.trim().length > 0) {
        return {
          success: true,
          text: data.text.trim(),
          method: 'NATIVE_PDF_TEXT',
          confidence: 95
        };
      }
      
      throw new Error('Nenhum texto encontrado no PDF');
    } catch (error) {
      return {
        success: false,
        method: 'NATIVE_PDF_TEXT',
        confidence: 0,
        error: `Erro na extração nativa: ${error}`
      };
    }
  }

  /**
   * Estratégia 2: Conversão para imagem de alta resolução + OCR
   */
  private async extractViaHighResImage(filePath: string): Promise<PdfExtractionResult> {
    const tempImagePath = `${filePath}_hd.png`;
    
    try {
      // Converter PDF para PNG com alta resolução
      await execAsync(`pdftoppm -f 1 -l 1 -png -r 300 "${filePath}" "${filePath}_temp"`);
      await execAsync(`mv "${filePath}_temp-1.png" "${tempImagePath}"`);
      
      // Aplicar OCR na imagem
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('por');
      
      const { data: { text, confidence } } = await worker.recognize(tempImagePath);
      await worker.terminate();
      
      // Limpar arquivo temporário
      await fs.unlink(tempImagePath).catch(() => {});
      
      return {
        success: true,
        text: text.trim(),
        method: 'HIGH_RES_IMAGE_OCR',
        confidence: Math.round(confidence)
      };
    } catch (error) {
      // Limpar arquivo temporário em caso de erro
      await fs.unlink(tempImagePath).catch(() => {});
      throw error;
    }
  }

  /**
   * Estratégia 3: Conversão para imagem de média resolução + OCR
   */
  private async extractViaMediumResImage(filePath: string): Promise<PdfExtractionResult> {
    const tempImagePath = `${filePath}_md.png`;
    
    try {
      // Converter PDF para PNG com média resolução
      await execAsync(`pdftoppm -f 1 -l 1 -png -r 150 "${filePath}" "${filePath}_temp"`);
      await execAsync(`mv "${filePath}_temp-1.png" "${tempImagePath}"`);
      
      // Aplicar OCR na imagem
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('por');
      
      const { data: { text, confidence } } = await worker.recognize(tempImagePath);
      await worker.terminate();
      
      // Limpar arquivo temporário
      await fs.unlink(tempImagePath).catch(() => {});
      
      return {
        success: true,
        text: text.trim(),
        method: 'MEDIUM_RES_IMAGE_OCR',
        confidence: Math.round(confidence)
      };
    } catch (error) {
      // Limpar arquivo temporário em caso de erro
      await fs.unlink(tempImagePath).catch(() => {});
      throw error;
    }
  }

  /**
   * Estratégia 4: Conversão com Ghostscript + OCR
   */
  private async extractViaGhostscript(filePath: string): Promise<PdfExtractionResult> {
    const tempImagePath = `${filePath}_gs.png`;
    
    try {
      // Converter PDF para PNG usando Ghostscript
      await execAsync(`gs -dNOPAUSE -dBATCH -sDEVICE=png16m -r200 -dFirstPage=1 -dLastPage=1 -sOutputFile="${tempImagePath}" "${filePath}"`);
      
      // Aplicar OCR na imagem
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('por');
      
      const { data: { text, confidence } } = await worker.recognize(tempImagePath);
      await worker.terminate();
      
      // Limpar arquivo temporário
      await fs.unlink(tempImagePath).catch(() => {});
      
      return {
        success: true,
        text: text.trim(),
        method: 'GHOSTSCRIPT_OCR',
        confidence: Math.round(confidence)
      };
    } catch (error) {
      // Limpar arquivo temporário em caso de erro
      await fs.unlink(tempImagePath).catch(() => {});
      throw error;
    }
  }
}