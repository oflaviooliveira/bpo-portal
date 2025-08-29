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
    qualityFlags?: {
      isIncomplete: boolean;
      isSystemPage: boolean;
      hasMonetaryValues: boolean;
      characterCount: number;
      estimatedQuality: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL';
    };
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
      
      // NOVA FUNCIONALIDADE: Análise de qualidade do OCR
      const qualityFlags = this.analyzeOcrQuality(result.text);
      
      console.log(`✅ OCR avançado concluído em ${totalTime}ms`);
      console.log(`   📝 Estratégia: ${result.strategy}`);
      console.log(`   🎯 Confiança: ${result.confidence}%`);
      console.log(`   📏 Caracteres: ${result.text.length}`);
      console.log(`   🔄 Tentativas: ${result.strategiesAttempted}`);
      console.log(`   🔍 Qualidade: ${qualityFlags.estimatedQuality}`);
      
      if (qualityFlags.isIncomplete) {
        console.log(`   ⚠️ ALERTA: Documento parece incompleto`);
      }
      if (qualityFlags.isSystemPage) {
        console.log(`   🖥️ AVISO: Detectada página de sistema, não documento fiscal`);
      }

      return {
        text: result.text,
        confidence: result.confidence,
        strategy: result.strategy,
        processingTime: totalTime,
        strategiesAttempted: result.strategiesAttempted,
        success: result.confidence > 0,
        qualityFlags,
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

  /**
   * Analisa qualidade do texto extraído por OCR
   */
  private analyzeOcrQuality(text: string): {
    isIncomplete: boolean;
    isSystemPage: boolean;
    hasMonetaryValues: boolean;
    characterCount: number;
    estimatedQuality: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL';
  } {
    const characterCount = text.length;
    
    // Detectar valores monetários
    const hasMonetaryValues = /R\$\s*\d+[.,]\d{2}|valor|total|preço|custo/i.test(text);
    
    // Detectar páginas de sistema
    const systemIndicators = [
      'Sistema de Administração',
      'https://',
      'Login',
      'Acesso',
      'Portal',
      'Dashboard',
      'Menu',
      '.gov.br',
      'Área Restrita'
    ];
    const isSystemPage = systemIndicators.some(indicator => 
      text.toLowerCase().includes(indicator.toLowerCase())
    );
    
    // Detectar documentos incompletos
    let isIncomplete = false;
    let estimatedQuality: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL' = 'HIGH';
    
    if (characterCount < 100) {
      isIncomplete = true;
      estimatedQuality = 'CRITICAL';
    } else if (characterCount < 300 && !hasMonetaryValues) {
      isIncomplete = true;
      estimatedQuality = 'LOW';
    } else if (isSystemPage && characterCount < 500) {
      isIncomplete = true;
      estimatedQuality = 'LOW';
    } else if (characterCount < 500) {
      estimatedQuality = 'MEDIUM';
    }
    
    // Se tem valores monetários mas pouco texto, pode ser um recibo simples válido
    if (hasMonetaryValues && characterCount >= 100) {
      estimatedQuality = characterCount > 300 ? 'HIGH' : 'MEDIUM';
      isIncomplete = false;
    }
    
    return {
      isIncomplete,
      isSystemPage,
      hasMonetaryValues,
      characterCount,
      estimatedQuality
    };
  }
}