import { OcrStrategy, OcrResult } from '../interfaces';

export class FallbackOrchestrator {
  private strategies: OcrStrategy[] = [];
  
  constructor(strategies: OcrStrategy[]) {
    // Ordenar estratégias por prioridade (menor número = maior prioridade)
    this.strategies = strategies.sort((a, b) => a.priority - b.priority);
  }

  async executeWithFallbacks(filePath: string): Promise<{
    result: OcrResult;
    strategiesAttempted: number;
    successfulStrategy: string;
    allResults: OcrResult[];
  }> {
    const allResults: OcrResult[] = [];
    let successfulStrategy = '';
    let strategiesAttempted = 0;

    console.log(`🚀 Iniciando OCR avançado com fallback em cascata`);
    console.log(`📋 Estratégias disponíveis: ${this.strategies.map(s => s.name).join(' → ')}`);

    for (const strategy of this.strategies) {
      strategiesAttempted++;
      
      console.log(`📄 Tentando estratégia: ${strategy.name}`);
      
      const result = await strategy.execute(filePath);
      allResults.push(result);

      // Verificar se a estratégia foi bem-sucedida
      if (strategy.validate(result)) {
        console.log(`✅ ${strategy.name} SUCCESS: ${result.characterCount} caracteres (confiança: ${result.confidence}%)`);
        successfulStrategy = strategy.name;
        
        return {
          result,
          strategiesAttempted,
          successfulStrategy,
          allResults
        };
      } else {
        console.log(`❌ ${strategy.name} FAILED: ${result.metadata?.error || 'Critérios não atendidos'}`);
        
        // Para estratégias de conversão PNG, continuar para próximas estratégias Tesseract
        if (this.isPngConversionStrategy(strategy.name) && result.confidence > 0) {
          // PNG foi criado com sucesso, agora tentar OCR
          const pngPath = result.metadata?.pngPath;
          if (pngPath) {
            const ocrResult = await this.tryTesseractOnPng(pngPath, strategiesAttempted);
            if (ocrResult) {
              console.log(`✅ OCR no PNG bem-sucedido após ${strategy.name}`);
              return {
                result: ocrResult,
                strategiesAttempted: strategiesAttempted + 1,
                successfulStrategy: `${strategy.name} + ${ocrResult.strategy}`,
                allResults: [...allResults, ocrResult]
              };
            }
          }
        }
      }
    }

    // Se chegou aqui, todas as estratégias falharam
    // Retornar o melhor resultado disponível
    const bestResult = this.selectBestResult(allResults);
    
    console.log(`⚠️ Todas as estratégias falharam, retornando melhor resultado: ${bestResult.strategy}`);
    
    return {
      result: bestResult,
      strategiesAttempted,
      successfulStrategy: 'FALLBACK_BEST_EFFORT',
      allResults
    };
  }

  private isPngConversionStrategy(strategyName: string): boolean {
    return strategyName.includes('PDF_TO_PNG') || strategyName === 'GHOSTSCRIPT_CONVERSION';
  }

  private async tryTesseractOnPng(pngPath: string, currentLevel: number): Promise<OcrResult | null> {
    try {
      // Importar estratégias Tesseract dinamicamente
      const { createAllTesseractStrategies } = await import('../strategies/tesseract-ocr');
      const tesseractStrategies = createAllTesseractStrategies();
      
      // Tentar cada configuração Tesseract no PNG
      for (const tesseractStrategy of tesseractStrategies) {
        console.log(`🔍 Tentando ${tesseractStrategy.name} no PNG`);
        
        const ocrResult = await tesseractStrategy.execute(pngPath);
        
        if (tesseractStrategy.validate(ocrResult)) {
          return ocrResult;
        }
      }
    } catch (error) {
      console.error('Erro ao executar Tesseract no PNG:', error);
    }
    
    return null;
  }

  private selectBestResult(results: OcrResult[]): OcrResult {
    if (results.length === 0) {
      return {
        text: '',
        confidence: 0,
        strategy: 'NO_STRATEGY',
        processingTime: 0,
        characterCount: 0,
        metadata: { error: 'Nenhuma estratégia foi executada' }
      };
    }

    // Ordenar por: 1) Confiança, 2) Número de caracteres, 3) Menor tempo
    return results.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      if (a.characterCount !== b.characterCount) {
        return b.characterCount - a.characterCount;
      }
      return a.processingTime - b.processingTime;
    })[0];
  }

  getStrategiesCount(): number {
    return this.strategies.length;
  }

  getStrategiesList(): string[] {
    return this.strategies.map(s => s.name);
  }
}