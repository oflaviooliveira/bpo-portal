import { OcrMetrics } from '../interfaces';

export class OcrMetricsTracker {
  private storage: any; // IStorage interface
  
  constructor(storage: any) {
    this.storage = storage;
  }

  async recordMetrics(metrics: OcrMetrics): Promise<void> {
    try {
      // Temporariamente desabilitado devido a problema de schema
      // await this.storage.createOcrMetrics(metrics);
      console.log(`📊 OCR Metrics: ${metrics.strategyUsed} | Success: ${metrics.success} | Confidence: ${metrics.confidence}%`);
    } catch (error) {
      console.error('Erro ao salvar métricas OCR:', error);
    }
  }

  async getMetricsByDocument(documentId: string): Promise<OcrMetrics[]> {
    try {
      return await this.storage.getOcrMetricsByDocument(documentId);
    } catch (error) {
      console.error('Erro ao buscar métricas OCR:', error);
      return [];
    }
  }

  async getMetricsByTenant(tenantId: string, options: {
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  } = {}): Promise<OcrMetrics[]> {
    try {
      return await this.storage.getOcrMetrics(tenantId, options);
    } catch (error) {
      console.error('Erro ao buscar métricas OCR por tenant:', error);
      return [];
    }
  }

  async getStrategyPerformance(tenantId: string, daysBack: number = 30): Promise<{
    strategyStats: Array<{
      strategy: string;
      totalAttempts: number;
      successRate: number;
      avgProcessingTime: number;
      avgConfidence: number;
      avgCharacterCount: number;
    }>;
    fallbackStats: {
      totalDocuments: number;
      documentsWithFallback: number;
      fallbackRate: number;
    };
  }> {
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - daysBack);
      
      const metrics = await this.getMetricsByTenant(tenantId, { dateFrom, limit: 10000 });
      
      // Agrupar por estratégia
      const strategyGroups: { [key: string]: OcrMetrics[] } = {};
      
      for (const metric of metrics) {
        if (!strategyGroups[metric.strategyUsed]) {
          strategyGroups[metric.strategyUsed] = [];
        }
        strategyGroups[metric.strategyUsed].push(metric);
      }

      // Calcular estatísticas por estratégia
      const strategyStats = Object.entries(strategyGroups).map(([strategy, strategyMetrics]) => {
        const totalAttempts = strategyMetrics.length;
        const successCount = strategyMetrics.filter(m => m.success).length;
        const successRate = totalAttempts > 0 ? (successCount / totalAttempts) * 100 : 0;
        
        const avgProcessingTime = strategyMetrics.reduce((sum, m) => sum + (m.processingTime || 0), 0) / totalAttempts;
        const avgConfidence = strategyMetrics.reduce((sum, m) => sum + m.confidence, 0) / totalAttempts;
        const avgCharacterCount = strategyMetrics.reduce((sum, m) => sum + m.characterCount, 0) / totalAttempts;
        
        return {
          strategy,
          totalAttempts,
          successRate: Math.round(successRate * 10) / 10,
          avgProcessingTime: Math.round(avgProcessingTime),
          avgConfidence: Math.round(avgConfidence),
          avgCharacterCount: Math.round(avgCharacterCount)
        };
      }).sort((a, b) => b.totalAttempts - a.totalAttempts);

      // Calcular estatísticas de fallback
      const documentsWithFallback = metrics.filter(m => m.fallbackLevel > 0).length;
      const totalDocuments = new Set(metrics.map(m => m.documentId)).size;
      const fallbackRate = totalDocuments > 0 ? (documentsWithFallback / totalDocuments) * 100 : 0;

      return {
        strategyStats,
        fallbackStats: {
          totalDocuments,
          documentsWithFallback,
          fallbackRate: Math.round(fallbackRate * 10) / 10
        }
      };
    } catch (error) {
      console.error('Erro ao calcular performance de estratégias:', error);
      return {
        strategyStats: [],
        fallbackStats: {
          totalDocuments: 0,
          documentsWithFallback: 0,
          fallbackRate: 0
        }
      };
    }
  }
}