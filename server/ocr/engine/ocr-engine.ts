import { OcrStrategy, OcrResult } from '../interfaces';
import { FallbackOrchestrator } from './fallback-orchestrator';
import { OcrCacheManager } from './cache-manager';
import { PdfDirectTextStrategy } from '../strategies/pdf-direct';
import { PdfToTextStrategy } from '../strategies/pdftotext';
import { PdfToPngStrategy, CONVERSION_STRATEGIES } from '../strategies/pdf-to-png';
import { FilenameAnalysisStrategy } from '../strategies/filename-analysis';

export class AdvancedOcrEngine {
  private fallbackOrchestrator: FallbackOrchestrator;
  private cacheManager: OcrCacheManager;
  private metricsCallback?: (metrics: any) => Promise<void>;

  constructor(options: {
    cacheDir?: string;
    cacheTtlMs?: number;
    metricsCallback?: (metrics: any) => Promise<void>;
  } = {}) {
    this.cacheManager = new OcrCacheManager(
      options.cacheDir || './ocr-cache',
      options.cacheTtlMs || 24 * 60 * 60 * 1000
    );
    
    this.metricsCallback = options.metricsCallback;
    
    // Inicializar estratégias
    const strategies = this.initializeStrategies();
    this.fallbackOrchestrator = new FallbackOrchestrator(strategies);
    
    console.log(`🔧 OCR Engine inicializado com ${strategies.length} estratégias`);
  }

  private initializeStrategies(): OcrStrategy[] {
    const strategies: OcrStrategy[] = [];

    // 1. PDF Direct Text (prioridade mais alta)
    strategies.push(new PdfDirectTextStrategy());

    // 2. PDFtoText command
    strategies.push(new PdfToTextStrategy());

    // 3. PDF to PNG conversions (4 estratégias)
    for (const conversionStrategy of CONVERSION_STRATEGIES) {
      strategies.push(new PdfToPngStrategy(conversionStrategy));
    }

    // 4. Filename Analysis (última estratégia)
    strategies.push(new FilenameAnalysisStrategy());

    return strategies;
  }

  async processDocument(filePath: string, documentId: string, tenantId: string): Promise<{
    text: string;
    confidence: number;
    strategy: string;
    processingTime: number;
    strategiesAttempted: number;
    allResults: OcrResult[];
  }> {
    const startTime = Date.now();
    
    console.log(`🔍 Iniciando OCR avançado para: ${filePath.split('/').pop()}`);

    try {
      // Limpar cache expirado periodicamente
      if (Math.random() < 0.1) { // 10% de chance
        this.cacheManager.clearExpired();
      }

      // Executar estratégias com fallbacks
      const { result, strategiesAttempted, successfulStrategy, allResults } = 
        await this.fallbackOrchestrator.executeWithFallbacks(filePath);

      const totalTime = Date.now() - startTime;

      // Salvar métricas de OCR se callback fornecido
      if (this.metricsCallback) {
        await this.metricsCallback({
          documentId,
          tenantId,
          strategyUsed: successfulStrategy,
          success: result.confidence > 0,
          processingTime: totalTime,
          characterCount: result.characterCount,
          confidence: result.confidence,
          fallbackLevel: strategiesAttempted - 1,
          metadata: {
            strategiesAttempted,
            allResults: allResults.map(r => ({
              strategy: r.strategy,
              confidence: r.confidence,
              characterCount: r.characterCount,
              processingTime: r.processingTime
            }))
          }
        });
      }

      console.log(`✅ OCR concluído. Estratégia: ${successfulStrategy}, Confiança: ${result.confidence}%`);

      return {
        text: result.text,
        confidence: result.confidence,
        strategy: successfulStrategy,
        processingTime: totalTime,
        strategiesAttempted,
        allResults
      };
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error('❌ Erro crítico no OCR Engine:', error);

      // Salvar métrica de erro
      if (this.metricsCallback) {
        await this.metricsCallback({
          documentId,
          tenantId,
          strategyUsed: 'ERROR',
          success: false,
          processingTime: errorTime,
          characterCount: 0,
          confidence: 0,
          fallbackLevel: 99,
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }

      return {
        text: '',
        confidence: 0,
        strategy: 'CRITICAL_ERROR',
        processingTime: errorTime,
        strategiesAttempted: 0,
        allResults: []
      };
    }
  }

  getCacheStats() {
    return this.cacheManager.getCacheStats();
  }

  getEngineInfo() {
    return {
      strategiesCount: this.fallbackOrchestrator.getStrategiesCount(),
      strategiesList: this.fallbackOrchestrator.getStrategiesList(),
      cacheStats: this.getCacheStats()
    };
  }
}