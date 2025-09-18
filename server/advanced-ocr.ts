import { createWorker } from 'tesseract.js';
import fs from 'fs/promises';
import path from 'path';
import pdf2pic from 'pdf2pic';

interface OCRResult {
  text: string;
  confidence: number;
  strategy: string;
  processingTime: number;
  charCount: number;
}

interface OCRStrategy {
  name: string;
  execute: (filePath: string) => Promise<OCRResult>;
  minCharThreshold: number;
  idealCharThreshold: number;
}

export class AdvancedOCRProcessor {
  private strategies: OCRStrategy[] = [];

  constructor() {
    this.initializeStrategies();
  }

  private initializeStrategies() {
    // 1. OCR direto em imagens (mais confiável para imagens)
    this.strategies.push({
      name: 'DIRECT_IMAGE_OCR',
      execute: this.extractDirectImage.bind(this),
      minCharThreshold: 20,
      idealCharThreshold: 100
    });

    // 2. Conversão PDF→PNG via pdf2pic (múltiplas resoluções)
    this.strategies.push({
      name: 'PDF_TO_PNG_HIGH_RES',
      execute: this.extractViaHighResPng.bind(this),
      minCharThreshold: 20,
      idealCharThreshold: 100
    });

    this.strategies.push({
      name: 'PDF_TO_PNG_MEDIUM_RES',
      execute: this.extractViaMediumResPng.bind(this),
      minCharThreshold: 20,
      idealCharThreshold: 100
    });

    this.strategies.push({
      name: 'PDF_TO_PNG_LOW_RES',
      execute: this.extractViaLowResPng.bind(this),
      minCharThreshold: 20,
      idealCharThreshold: 100
    });

    // 4. OCR direto em imagens (JPG/PNG)
    this.strategies.push({
      name: 'DIRECT_IMAGE_OCR',
      execute: this.extractDirectImage.bind(this),
      minCharThreshold: 20,
      idealCharThreshold: 100
    });

    // 5. Análise do nome do arquivo (fallback final)
    this.strategies.push({
      name: 'FILENAME_ANALYSIS',
      execute: this.extractFromFilename.bind(this),
      minCharThreshold: 10,
      idealCharThreshold: 50
    });
  }

  async processDocument(filePath: string): Promise<OCRResult> {
    console.log(`🔍 Iniciando OCR avançado para: ${path.basename(filePath)}`);
    
    const startTime = Date.now();
    let bestResult: OCRResult | null = null;
    
    for (const strategy of this.strategies) {
      try {
        console.log(`📄 Tentando estratégia: ${strategy.name}`);
        
        const result = await strategy.execute(filePath);
        
        if (result.charCount >= strategy.minCharThreshold) {
          console.log(`✅ ${strategy.name} SUCCESS: ${result.charCount} caracteres (confiança: ${Math.round(result.confidence * 100)}%)`);
          
          // Se atingiu o ideal, retorna imediatamente
          if (result.charCount >= strategy.idealCharThreshold && result.confidence > 0.7) {
            result.processingTime = Date.now() - startTime;
            return result;
          }
          
          // Senão, guarda como melhor resultado até agora
          if (!bestResult || result.charCount > bestResult.charCount) {
            bestResult = result;
          }
        } else {
          console.log(`⚠️ ${strategy.name} INSUFFICIENT: ${result.charCount} caracteres (< ${strategy.minCharThreshold} mínimo)`);
        }
        
      } catch (error) {
        console.warn(`❌ ${strategy.name} FAILED:`, error instanceof Error ? error.message : error);
        continue;
      }
    }

    if (bestResult) {
      bestResult.processingTime = Date.now() - startTime;
      console.log(`🎯 Melhor resultado: ${bestResult.strategy} com ${bestResult.charCount} caracteres`);
      return bestResult;
    }

    // Fallback absoluto - nunca falha
    const fallbackResult = await this.extractFromFilename(filePath);
    fallbackResult.processingTime = Date.now() - startTime;
    console.log(`🆘 Usando fallback de filename: ${fallbackResult.charCount} caracteres`);
    return fallbackResult;
  }

  // 1. OCR direto em imagens (primeiro para imagens)
  private async extractDirectImage(filePath: string): Promise<OCRResult> {
    const ext = path.extname(filePath).toLowerCase();
    if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
      throw new Error('Not an image file');
    }

    return await this.performTesseractOCR(filePath, 'DIRECT_IMAGE_OCR');
  }

  // 2. Alta resolução PNG + OCR (via pdf2pic)
  private async extractViaHighResPng(filePath: string): Promise<OCRResult> {
    try {
      const convert = pdf2pic.fromPath(filePath, {
        density: 300,
        saveFilename: "page",
        savePath: path.dirname(filePath),
        format: "png",
        width: 2480,
        height: 3508
      });

      const result = await convert(1, { responseType: "image" });
      const pngPath = result.path;
      
      if (!pngPath) {
        throw new Error('Failed to generate PNG from PDF');
      }

      const ocrResult = await this.performTesseractOCR(pngPath, 'PDF_TO_PNG_HIGH_RES');
      
      // Cleanup
      try { await fs.unlink(pngPath); } catch {}
      
      return ocrResult;
    } catch (error) {
      throw new Error(`High-res PDF conversion failed: ${error}`);
    }
  }

  // 3. Resolução média PNG + OCR
  private async extractViaMediumResPng(filePath: string): Promise<OCRResult> {
    try {
      const convert = pdf2pic.fromPath(filePath, {
        density: 150,
        saveFilename: "page_med",
        savePath: path.dirname(filePath),
        format: "png",
        width: 1240,
        height: 1754
      });

      const result = await convert(1, { responseType: "image" });
      const pngPath = result.path;
      
      if (!pngPath) {
        throw new Error('Failed to generate PNG from PDF');
      }

      const ocrResult = await this.performTesseractOCR(pngPath, 'PDF_TO_PNG_MEDIUM_RES');
      
      try { await fs.unlink(pngPath); } catch {}
      return ocrResult;
    } catch (error) {
      throw new Error(`Medium-res PDF conversion failed: ${error}`);
    }
  }

  // 4. Baixa resolução PNG + OCR (para casos difíceis)
  private async extractViaLowResPng(filePath: string): Promise<OCRResult> {
    try {
      const convert = pdf2pic.fromPath(filePath, {
        density: 72,
        saveFilename: "page_low",
        savePath: path.dirname(filePath),
        format: "png",
        width: 595,
        height: 842
      });

      const result = await convert(1, { responseType: "image" });
      const pngPath = result.path;
      
      if (!pngPath) {
        throw new Error('Failed to generate PNG from PDF');
      }

      const ocrResult = await this.performTesseractOCR(pngPath, 'PDF_TO_PNG_LOW_RES');
      
      try { await fs.unlink(pngPath); } catch {}
      return ocrResult;
    } catch (error) {
      throw new Error(`Low-res PDF conversion failed: ${error}`);
    }
  }



  // Tesseract com múltiplas configurações
  private async performTesseractOCR(imagePath: string, strategy: string): Promise<OCRResult> {
    const configurations = [
      // Configuração portuguesa padrão
      {
        name: 'PORTUGUES_PADRAO',
        options: {
          lang: 'por',
          tessedit_pageseg_mode: 1,
          tessedit_ocr_engine_mode: 3
        }
      },
      // Auto-detect melhorado
      {
        name: 'AUTO_DETECT',
        options: {
          lang: 'por',
          tessedit_pageseg_mode: 3,
          tessedit_ocr_engine_mode: 1
        }
      },
      // Bloco único de texto
      {
        name: 'BLOCO_UNICO',
        options: {
          lang: 'por',
          tessedit_pageseg_mode: 6,
          tessedit_ocr_engine_mode: 3
        }
      },
      // Multi-idioma (português + inglês)
      {
        name: 'MULTI_IDIOMA',
        options: {
          lang: 'por+eng',
          tessedit_pageseg_mode: 1,
          tessedit_ocr_engine_mode: 2
        }
      },
      // Texto denso
      {
        name: 'TEXTO_DENSO',
        options: {
          lang: 'por',
          tessedit_pageseg_mode: 2,
          tessedit_ocr_engine_mode: 3
        }
      },
      // Linha única
      {
        name: 'LINHA_UNICA',
        options: {
          lang: 'por',
          tessedit_pageseg_mode: 7,
          tessedit_ocr_engine_mode: 2
        }
      }
    ];

    let bestResult: OCRResult | null = null;

    for (const config of configurations) {
      try {
        const worker = await createWorker('por');
        
        await worker.setParameters(config.options as any);
        const { data } = await worker.recognize(imagePath);
        await worker.terminate();

        const result: OCRResult = {
          text: data.text.trim(),
          confidence: data.confidence / 100,
          strategy: `${strategy}_${config.name}`,
          processingTime: 0,
          charCount: data.text.trim().length
        };

        if (!bestResult || result.charCount > bestResult.charCount) {
          bestResult = result;
        }

        // Se conseguir resultado muito bom, para por aqui
        if (result.charCount > 200 && result.confidence > 0.8) {
          break;
        }

      } catch (error) {
        console.warn(`Tesseract config ${config.name} failed:`, error);
        continue;
      }
    }

    if (!bestResult) {
      throw new Error('All Tesseract configurations failed');
    }

    return bestResult;
  }

  // 6. Análise inteligente do nome do arquivo (fallback final)
  private async extractFromFilename(filePath: string): Promise<OCRResult> {
    const filename = path.basename(filePath, path.extname(filePath));
    
    let extractedInfo: string[] = [];
    let structuredData: any = {};

    console.log(`🔍 Analisando nome do arquivo: ${filename}`);

    // Extrair datas (DD.MM.AAAA, DD/MM/AAAA, DD-MM-AAAA)
    const dateRegex = /(\d{2})[.\/\-](\d{2})[.\/\-](\d{4})/g;
    const dates = Array.from(filename.matchAll(dateRegex));
    
    if (dates.length > 0) {
      // Primeira data geralmente é data de processamento/vencimento
      const firstDate = dates[0];
      const formattedDate = `${firstDate[1]}/${firstDate[2]}/${firstDate[3]}`;
      extractedInfo.push(`Data de Vencimento: ${formattedDate}`);
      structuredData.data_vencimento = formattedDate;
      
      // Se houver múltiplas datas, listar todas
      if (dates.length > 1) {
        dates.forEach((match, index) => {
          const date = `${match[1]}/${match[2]}/${match[3]}`;
          extractedInfo.push(`Data ${index + 1}: ${date}`);
        });
      }
    }

    // Extrair valores monetários (R$ X.XXX,XX) - mais preciso
    const moneyRegex = /R\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/g;
    const amounts = Array.from(filename.matchAll(moneyRegex));
    
    if (amounts.length > 0) {
      const amount = amounts[0][1];
      extractedInfo.push(`Valor: R$ ${amount}`);
      structuredData.valor = `R$ ${amount}`;
    }

    // Extrair descrições específicas
    const parts = filename.split('_');
    let descricaoParts: string[] = [];
    let centroCusto = '';
    
    parts.forEach(part => {
      // Pular datas e valores
      if (part.match(/^\d{2}\.\d{2}\.\d{4}$/) || part.match(/^R\$/)) {
        return;
      }
      
      // Detectar centro de custo (formato SRJ1, etc)
      if (part.match(/^[A-Z]{2,4}\d*$/i)) {
        centroCusto = part.toUpperCase();
        extractedInfo.push(`Centro de Custo: ${centroCusto}`);
        structuredData.centro_custo = centroCusto;
        return;
      }
      
      // Detectar tipo de documento/categoria
      const tipoMapping: { [key: string]: string } = {
        'PG': 'PAGO',
        'AG': 'AGENDADO', 
        'Locação': 'Transporte',
        'Aluguel': 'Transporte',
        'Combustivel': 'Combustível',
        'Alimentação': 'Alimentação',
        'Tecnologia': 'Tecnologia',
        'Manutenção': 'Manutenção',
        'Veiculos': 'Veículos'
      };
      
      if (tipoMapping[part]) {
        if (part === 'PG') {
          structuredData.status = 'PAGO';
        } else {
          extractedInfo.push(`Categoria: ${tipoMapping[part]}`);
          structuredData.categoria = tipoMapping[part];
        }
      } else if (part.length > 2) {
        descricaoParts.push(part.replace(/[_\-]/g, ' '));
      }
    });

    if (descricaoParts.length > 0) {
      const descricao = descricaoParts.join(' ');
      extractedInfo.push(`Descrição: ${descricao}`);
      structuredData.descricao = descricao;
    }

    // Criar texto estruturado para a IA
    const extractedText = [
      `DOCUMENTO: ${filename}`,
      '',
      'DADOS EXTRAÍDOS DO NOME DO ARQUIVO:',
      ...extractedInfo,
      '',
      'DADOS ESTRUTURADOS PARA IA:',
      JSON.stringify(structuredData, null, 2)
    ].join('\n');

    console.log(`✅ Filename analysis extracted: ${extractedInfo.length} campos`);
    console.log(`📊 Structured data:`, structuredData);

    return {
      text: extractedText,
      confidence: extractedInfo.length >= 3 ? 0.8 : 0.5, // Maior confiança se extraiu dados principais
      strategy: 'FILENAME_ANALYSIS',
      processingTime: 0,
      charCount: extractedText.length
    };
  }
}

export const advancedOCR = new AdvancedOCRProcessor();