import { AdvancedOcrEngine } from './ocr/engine/ocr-engine';
import { OcrMetricsTracker } from './ocr/monitoring/metrics-tracker';
import * as fs from 'fs';
import * as path from 'path';

export class AdvancedOcrProcessor {
  private ocrEngine: AdvancedOcrEngine;
  private metricsTracker: OcrMetricsTracker;

  constructor(storage: any) {
    this.metricsTracker = new OcrMetricsTracker(storage);
    
    this.ocrEngine = new AdvancedOcrEngine({
      cacheDir: './ocr-cache',
      cacheTtlMs: 24 * 60 * 60 * 1000, // 24 horas
      metricsCallback: async (metrics) => {
        await this.metricsTracker.recordMetrics(metrics);
      }
    });

    console.log('🚀 AdvancedOcrProcessor inicializado com sistema completo de fallbacks');
  }

  async processDocument(filePath: string, documentId: string, tenantId: string): Promise<{
    text: string;
    confidence: number;
    strategy: string;
    processingTime: number;
    strategiesAttempted: number;
    success: boolean;
    metadata?: any;
  }> {
    const startTime = Date.now();
    
    console.log(`🔍 Iniciando processamento OCR avançado para documento ${documentId}`);
    console.log(`📁 Arquivo: ${path.basename(filePath)}`);
    
    try {
      // Verificar se arquivo existe
      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${filePath}`);
      }

      const fileStats = fs.statSync(filePath);
      console.log(`📊 Tamanho do arquivo: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);

      // Processar com OCR Engine avançado
      const result = await this.ocrEngine.processDocument(filePath, documentId, tenantId);
      
      const totalTime = Date.now() - startTime;
      
      console.log(`✅ OCR avançado concluído em ${totalTime}ms`);
      console.log(`   📝 Estratégia: ${result.strategy}`);
      console.log(`   🎯 Confiança: ${result.confidence}%`);
      console.log(`   📏 Caracteres: ${result.text.length}`);
      console.log(`   🔄 Tentativas: ${result.strategiesAttempted}`);

      return {
        text: result.text,
        confidence: result.confidence,
        strategy: result.strategy,
        processingTime: totalTime,
        strategiesAttempted: result.strategiesAttempted,
        success: result.confidence > 0,
        metadata: {
          allResults: result.allResults.map(r => ({
            strategy: r.strategy,
            confidence: r.confidence,
            characterCount: r.characterCount,
            processingTime: r.processingTime
          })),
          fileSize: fileStats.size,
          filename: path.basename(filePath)
        }
      };
    } catch (error) {
      const errorTime = Date.now() - startTime;
      console.error('❌ Erro crítico no processamento OCR avançado:', error);

      return {
        text: '',
        confidence: 0,
        strategy: 'CRITICAL_ERROR',
        processingTime: errorTime,
        strategiesAttempted: 0,
        success: false,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  async getProcessingStats(tenantId: string, daysBack: number = 30): Promise<any> {
    return await this.metricsTracker.getStrategyPerformance(tenantId, daysBack);
  }

  getEngineInfo() {
    return this.ocrEngine.getEngineInfo();
  }
}