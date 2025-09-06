/**
 * DocumentSegmentAnalyzer - Sistema Inteligente de Detecção Multi-Documento
 * Detecta e analisa documentos compostos (ex: apólice + boleto)
 */

export interface DocumentSegment {
  type: 'BOLETO' | 'DANFE' | 'RECIBO' | 'PIX' | 'FATURA' | 'CONTRATO' | 'APOLICE' | 'OUTROS';
  confidence: number;
  startPosition: number;
  endPosition: number;
  text: string;
  indicators: string[];
  primaryData?: any;
}

export interface MultiDocumentAnalysis {
  segments: DocumentSegment[];
  primaryType: string;
  secondaryType?: string;
  priority: 'PRIMARY' | 'SECONDARY' | 'BOLETO_PRIORITY';
  recommendation: string;
  conflicts?: string[];
}

export class DocumentSegmentAnalyzer {
  
  /**
   * Detectores específicos por tipo de documento
   */
  private static BOLETO_INDICATORS = [
    'FICHA DE COMPENSAÇÃO',
    'CÓDIGO DE BARRAS',
    'LINHA DIGITÁVEL', 
    'CEDENTE',
    'SACADO',
    'PAGADOR',
    'VENCIMENTO',
    'NOSSO NÚMERO',
    'BANCO',
    'AGÊNCIA',
    'CONTA',
    'CARTEIRA',
    'CIP',
    'AUTENTICAÇÃO MECÂNICA',
    'CORTE AQUI'
  ];

  private static APOLICE_INDICATORS = [
    'APÓLICE',
    'SEGURADO',
    'SEGURADORA',
    'PRÊMIO',
    'VIGÊNCIA',
    'COBERTURA',
    'SINISTRO',
    'FRANQUIA',
    'SUSEP',
    'DEMONSTRATIVO DO PRÊMIO',
    'IMPORTÂNCIA SEGURADA'
  ];

  private static DANFE_INDICATORS = [
    'DANFE',
    'NOTA FISCAL ELETRÔNICA',
    'CHAVE DE ACESSO',
    'EMITENTE',
    'DESTINATÁRIO',
    'CFOP',
    'NCM',
    'ICMS'
  ];

  /**
   * Analisa texto OCR para detectar múltiplos tipos de documento
   */
  static analyzeDocumentSegments(ocrText: string): MultiDocumentAnalysis {
    const segments = this.detectSegments(ocrText);
    const analysis = this.prioritizeSegments(segments);
    
    return {
      segments,
      primaryType: analysis.primary.type,
      secondaryType: analysis.secondary?.type,
      priority: analysis.priority,
      recommendation: analysis.recommendation,
      conflicts: analysis.conflicts
    };
  }

  /**
   * Detecta segmentos distintos no documento
   */
  private static detectSegments(text: string): DocumentSegment[] {
    const segments: DocumentSegment[] = [];
    const lines = text.split('\n');
    const textLength = text.length;

    // Detectar BOLETO (geralmente no final do documento)
    const boletoSegment = this.detectBoletoSegment(text, lines);
    if (boletoSegment) segments.push(boletoSegment);

    // Detectar APÓLICE/SEGURO
    const apoliceSegment = this.detectApoliceSegment(text, lines);
    if (apoliceSegment) segments.push(apoliceSegment);

    // Detectar DANFE
    const danfeSegment = this.detectDANFESegment(text, lines);
    if (danfeSegment) segments.push(danfeSegment);

    // Se não encontrou segmentos específicos, criar um genérico
    if (segments.length === 0) {
      segments.push({
        type: 'OUTROS',
        confidence: 30,
        startPosition: 0,
        endPosition: textLength,
        text: text,
        indicators: ['Documento genérico']
      });
    }

    return segments;
  }

  /**
   * Detector especializado para BOLETO
   */
  private static detectBoletoSegment(text: string, lines: string[]): DocumentSegment | null {
    const indicators: string[] = [];
    let startPos = -1;
    let endPos = text.length;
    let confidence = 0;

    // Procurar indicadores de boleto
    this.BOLETO_INDICATORS.forEach(indicator => {
      const regex = new RegExp(indicator, 'gi');
      const matches = text.match(regex);
      if (matches && matches.length > 0) {
        indicators.push(indicator);
        confidence += 15;
        
        // Encontrar posição do primeiro indicador
        const pos = text.toLowerCase().indexOf(indicator.toLowerCase());
        if (startPos === -1 || pos < startPos) {
          startPos = Math.max(0, pos - 500); // Incluir contexto anterior
        }
      }
    });

    // Procurar padrões de linha digitável
    const linhaDigitavelPattern = /\d{5}\.\d{5}\s\d{5}\.\d{6}\s\d{5}\.\d{6}/g;
    const codigoBarrasPattern = /\d{47,48}/g;
    
    if (linhaDigitavelPattern.test(text)) {
      indicators.push('Linha digitável detectada');
      confidence += 25;
    }
    
    if (codigoBarrasPattern.test(text)) {
      indicators.push('Código de barras detectado');
      confidence += 25;
    }

    // Procurar por "FICHA DE COMPENSAÇÃO" (indicador forte)
    if (text.toLowerCase().includes('ficha de compensação')) {
      indicators.push('FICHA DE COMPENSAÇÃO');
      confidence += 30;
    }

    // Se detectou boleto, extrair a seção relevante
    if (confidence >= 40) {
      let boletoText = text;
      
      if (startPos > 0) {
        boletoText = text.substring(startPos);
      }

      return {
        type: 'BOLETO',
        confidence: Math.min(confidence, 95),
        startPosition: startPos,
        endPosition: endPos,
        text: boletoText,
        indicators
      };
    }

    return null;
  }

  /**
   * Detector especializado para APÓLICE
   */
  private static detectApoliceSegment(text: string, lines: string[]): DocumentSegment | null {
    const indicators: string[] = [];
    let confidence = 0;

    this.APOLICE_INDICATORS.forEach(indicator => {
      const regex = new RegExp(indicator, 'gi');
      if (regex.test(text)) {
        indicators.push(indicator);
        confidence += 12;
      }
    });

    if (confidence >= 30) {
      return {
        type: 'APOLICE',
        confidence: Math.min(confidence, 90),
        startPosition: 0,
        endPosition: Math.floor(text.length * 0.7), // Geralmente na primeira parte
        text: text.substring(0, Math.floor(text.length * 0.7)),
        indicators
      };
    }

    return null;
  }

  /**
   * Detector especializado para DANFE
   */
  private static detectDANFESegment(text: string, lines: string[]): DocumentSegment | null {
    const indicators: string[] = [];
    let confidence = 0;

    this.DANFE_INDICATORS.forEach(indicator => {
      const regex = new RegExp(indicator, 'gi');
      if (regex.test(text)) {
        indicators.push(indicator);
        confidence += 15;
      }
    });

    // Padrão de chave de acesso NF-e
    const chaveNFePattern = /\d{4}\s\d{4}\s\d{4}\s\d{4}\s\d{4}\s\d{4}\s\d{4}\s\d{4}\s\d{4}\s\d{4}\s\d{4}/;
    if (chaveNFePattern.test(text)) {
      indicators.push('Chave de acesso NF-e');
      confidence += 25;
    }

    if (confidence >= 40) {
      return {
        type: 'DANFE',
        confidence: Math.min(confidence, 95),
        startPosition: 0,
        endPosition: text.length,
        text: text,
        indicators
      };
    }

    return null;
  }

  /**
   * Prioriza segmentos e define estratégia de processamento
   */
  private static prioritizeSegments(segments: DocumentSegment[]) {
    if (segments.length === 0) {
      return {
        primary: { type: 'OUTROS', confidence: 0 },
        priority: 'PRIMARY' as const,
        recommendation: 'Documento não identificado',
        conflicts: []
      };
    }

    if (segments.length === 1) {
      return {
        primary: segments[0],
        priority: 'PRIMARY' as const,
        recommendation: `Documento identificado como ${segments[0].type}`,
        conflicts: []
      };
    }

    // Múltiplos segmentos detectados
    const boletoSegment = segments.find(s => s.type === 'BOLETO');
    const otherSegments = segments.filter(s => s.type !== 'BOLETO');
    
    if (boletoSegment && otherSegments.length > 0) {
      const primarySegment = otherSegments.reduce((a, b) => a.confidence > b.confidence ? a : b);
      
      return {
        primary: boletoSegment, // PRIORIZAR BOLETO para agendamento
        secondary: primarySegment,
        priority: 'BOLETO_PRIORITY' as const,
        recommendation: `Documento composto detectado: ${primarySegment.type} + BOLETO. Processando BOLETO para agendamento.`,
        conflicts: this.detectConflicts(boletoSegment, primarySegment)
      };
    }

    // Sem boleto, usar o de maior confiança
    const primarySegment = segments.reduce((a, b) => a.confidence > b.confidence ? a : b);
    const secondarySegment = segments.find(s => s !== primarySegment);

    return {
      primary: primarySegment,
      secondary: secondarySegment,
      priority: 'PRIMARY' as const,
      recommendation: `Processando como ${primarySegment.type}`,
      conflicts: secondarySegment ? this.detectConflicts(primarySegment, secondarySegment) : []
    };
  }

  /**
   * Detecta conflitos entre segmentos
   */
  private static detectConflicts(segment1: DocumentSegment, segment2: DocumentSegment): string[] {
    const conflicts: string[] = [];
    
    // Lógica básica de detecção de conflitos
    if (segment1.confidence > 80 && segment2.confidence > 80) {
      conflicts.push(`Alta confiança em ambos tipos: ${segment1.type} (${segment1.confidence}%) e ${segment2.type} (${segment2.confidence}%)`);
    }

    return conflicts;
  }
}