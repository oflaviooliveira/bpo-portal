/**
 * Sistema Inteligente de Gestão de Inconsistências
 * Melhoria de Alta Prioridade #1: Recomendações contextuais baseadas em confiança
 */

export interface DataSource {
  value: any;
  confidence: number;
  source: 'OCR' | 'AI' | 'FILENAME' | 'MANUAL';
  quality: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SmartRecommendation {
  recommendedValue: any;
  recommendedSource: DataSource;
  reasoning: string;
  confidence: number;
  action: 'AUTO_ACCEPT' | 'SUGGEST_REVIEW' | 'MANUAL_REQUIRED';
}

export class SmartInconsistencyManager {
  
  /**
   * Analisa múltiplas fontes de dados e fornece recomendação inteligente
   */
  analyzeField(fieldName: string, sources: DataSource[]): SmartRecommendation {
    const validSources = sources.filter(s => s.value !== null && s.value !== undefined && s.value !== '');
    
    if (validSources.length === 0) {
      return {
        recommendedValue: '',
        recommendedSource: { value: '', confidence: 0, source: 'MANUAL', quality: 'LOW' },
        reasoning: 'Nenhuma fonte válida encontrada',
        confidence: 0,
        action: 'MANUAL_REQUIRED'
      };
    }

    // Lógica específica por tipo de campo
    switch (fieldName.toLowerCase()) {
      case 'amount':
      case 'valor':
        return this.analyzeAmountField(validSources);
      
      case 'supplier':
      case 'fornecedor':
      case 'contraparte':
        return this.analyzeSupplierField(validSources);
      
      case 'description':
      case 'descricao':
        return this.analyzeDescriptionField(validSources);
      
      case 'duedate':
      case 'data_vencimento':
        return this.analyzeDateField(validSources);
      
      default:
        return this.analyzeGenericField(validSources);
    }
  }

  private analyzeAmountField(sources: DataSource[]): SmartRecommendation {
    // Priorizar IA para valores monetários se confiança > 80%
    const aiSource = sources.find(s => s.source === 'AI');
    if (aiSource && aiSource.confidence > 80) {
      return {
        recommendedValue: aiSource.value,
        recommendedSource: aiSource,
        reasoning: 'IA tem alta confiança na extração de valores monetários',
        confidence: aiSource.confidence,
        action: aiSource.confidence > 90 ? 'AUTO_ACCEPT' : 'SUGGEST_REVIEW'
      };
    }

    // Fallback para OCR se qualidade boa
    const ocrSource = sources.find(s => s.source === 'OCR');
    if (ocrSource && ocrSource.confidence > 70) {
      return {
        recommendedValue: ocrSource.value,
        recommendedSource: ocrSource,
        reasoning: 'OCR com boa qualidade para valores numéricos',
        confidence: ocrSource.confidence,
        action: 'SUGGEST_REVIEW'
      };
    }

    // Valores muito discrepantes exigem revisão manual
    const values = sources.map(s => this.parseAmount(s.value)).filter(v => v > 0);
    if (values.length > 1) {
      const max = Math.max(...values);
      const min = Math.min(...values);
      const variance = (max - min) / min;
      
      if (variance > 0.1) { // Diferença > 10%
        const bestSource = sources.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        
        return {
          recommendedValue: bestSource.value,
          recommendedSource: bestSource,
          reasoning: `Valores discrepantes detectados (variação: ${Math.round(variance * 100)}%). Recomendo revisar manualmente.`,
          confidence: bestSource.confidence * 0.7, // Reduzir confiança
          action: 'MANUAL_REQUIRED'
        };
      }
    }

    // Padrão: maior confiança
    const bestSource = sources.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    return {
      recommendedValue: bestSource.value,
      recommendedSource: bestSource,
      reasoning: 'Fonte com maior confiança selecionada',
      confidence: bestSource.confidence,
      action: bestSource.confidence > 75 ? 'SUGGEST_REVIEW' : 'MANUAL_REQUIRED'
    };
  }

  private analyzeSupplierField(sources: DataSource[]): SmartRecommendation {
    // IA é melhor para identificar nomes de empresas
    const aiSource = sources.find(s => s.source === 'AI');
    if (aiSource && aiSource.confidence > 70 && aiSource.value.length > 5) {
      return {
        recommendedValue: aiSource.value,
        recommendedSource: aiSource,
        reasoning: 'IA especializada em extrair nomes de empresas',
        confidence: aiSource.confidence,
        action: aiSource.confidence > 85 ? 'AUTO_ACCEPT' : 'SUGGEST_REVIEW'
      };
    }

    // Filename pode ter info valiosa para fornecedores conhecidos
    const filenameSource = sources.find(s => s.source === 'FILENAME');
    if (filenameSource && this.isKnownSupplier(filenameSource.value)) {
      return {
        recommendedValue: filenameSource.value,
        recommendedSource: filenameSource,
        reasoning: 'Fornecedor identificado no nome do arquivo',
        confidence: 85,
        action: 'SUGGEST_REVIEW'
      };
    }

    return this.analyzeGenericField(sources);
  }

  private analyzeDescriptionField(sources: DataSource[]): SmartRecommendation {
    // IA é melhor para descrições contextuais
    const aiSource = sources.find(s => s.source === 'AI');
    if (aiSource && aiSource.confidence > 75) {
      return {
        recommendedValue: aiSource.value,
        recommendedSource: aiSource,
        reasoning: 'IA gera descrições mais contextuais e úteis',
        confidence: aiSource.confidence,
        action: 'AUTO_ACCEPT'
      };
    }

    return this.analyzeGenericField(sources);
  }

  private analyzeDateField(sources: DataSource[]): SmartRecommendation {
    // Para datas, priorizar fonte com formato válido
    const validDateSources = sources.filter(s => this.isValidDate(s.value));
    
    if (validDateSources.length === 0) {
      return {
        recommendedValue: '',
        recommendedSource: { value: '', confidence: 0, source: 'MANUAL', quality: 'LOW' },
        reasoning: 'Nenhuma data válida encontrada',
        confidence: 0,
        action: 'MANUAL_REQUIRED'
      };
    }

    // IA geralmente extrai datas melhor
    const aiSource = validDateSources.find(s => s.source === 'AI');
    if (aiSource && aiSource.confidence > 70) {
      return {
        recommendedValue: aiSource.value,
        recommendedSource: aiSource,
        reasoning: 'IA especializada em extrair e formatar datas',
        confidence: aiSource.confidence,
        action: 'AUTO_ACCEPT'
      };
    }

    const bestSource = validDateSources.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    return {
      recommendedValue: bestSource.value,
      recommendedSource: bestSource,
      reasoning: 'Data válida com maior confiança',
      confidence: bestSource.confidence,
      action: 'SUGGEST_REVIEW'
    };
  }

  private analyzeGenericField(sources: DataSource[]): SmartRecommendation {
    const bestSource = sources.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );

    return {
      recommendedValue: bestSource.value,
      recommendedSource: bestSource,
      reasoning: 'Fonte com maior confiança geral',
      confidence: bestSource.confidence,
      action: bestSource.confidence > 80 ? 'SUGGEST_REVIEW' : 'MANUAL_REQUIRED'
    };
  }

  // Utilitários
  private parseAmount(value: string): number {
    if (!value) return 0;
    // Ordem correta: Remove R$/espaços → Remove pontos de milhares → Converte vírgula decimal
    const cleaned = value.toString().replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

  private isKnownSupplier(value: string): boolean {
    const knownSuppliers = ['uber', 'ifood', 'amazon', 'magazine luiza', 'correios'];
    return knownSuppliers.some(supplier => 
      value.toLowerCase().includes(supplier)
    );
  }

  private isValidDate(value: string): boolean {
    if (!value) return false;
    
    // Formatos aceitos: DD/MM/YYYY, YYYY-MM-DD
    const datePatterns = [
      /^\d{2}\/\d{2}\/\d{4}$/,
      /^\d{4}-\d{2}-\d{2}$/
    ];
    
    return datePatterns.some(pattern => pattern.test(value.toString()));
  }

  /**
   * Calcula qualidade da fonte baseado na confiança e tipo
   */
  static calculateQuality(confidence: number, source: string): 'HIGH' | 'MEDIUM' | 'LOW' {
    if (confidence >= 85) return 'HIGH';
    if (confidence >= 60) return 'MEDIUM';
    return 'LOW';
  }
}