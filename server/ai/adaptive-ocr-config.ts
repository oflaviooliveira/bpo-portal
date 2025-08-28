/**
 * Sistema de OCR Adaptativo
 * Melhoria de Alta Prioridade #2: Thresholds inteligentes por tipo de documento
 */

export interface OcrConfig {
  confidenceThreshold: number;
  strategies: string[];
  fallbackStrategies: string[];
  qualitySettings: {
    resolution: number;
    preprocessing: string[];
    language: string;
  };
}

export interface DocumentTypeConfig {
  [key: string]: OcrConfig;
}

export class AdaptiveOcrConfig {
  
  private static documentConfigs: DocumentTypeConfig = {
    'PDF': {
      confidenceThreshold: 80, // PDFs geralmente têm melhor qualidade
      strategies: ['PDF_DIRECT', 'GHOSTSCRIPT_OCR', 'PDF2PIC_TESSERACT'],
      fallbackStrategies: ['ADVANCED_TESSERACT', 'GOOGLE_VISION'],
      qualitySettings: {
        resolution: 300,
        preprocessing: ['noise_removal', 'contrast_enhancement'],
        language: 'por'
      }
    },
    
    'IMAGE_HIGH_QUALITY': {
      confidenceThreshold: 70,
      strategies: ['TESSERACT_ENHANCED', 'GOOGLE_VISION'],
      fallbackStrategies: ['TESSERACT_BASIC', 'MANUAL_REVIEW'],
      qualitySettings: {
        resolution: 300,
        preprocessing: ['deskew', 'noise_removal', 'binarization'],
        language: 'por'
      }
    },
    
    'IMAGE_LOW_QUALITY': {
      confidenceThreshold: 50, // Threshold mais baixo para imagens ruins
      strategies: ['GOOGLE_VISION', 'TESSERACT_ENHANCED'],
      fallbackStrategies: ['TESSERACT_PREPROCESSED', 'MANUAL_REVIEW'],
      qualitySettings: {
        resolution: 400, // Resolução maior para compensar qualidade
        preprocessing: ['super_resolution', 'noise_removal', 'contrast_enhancement', 'deskew'],
        language: 'por'
      }
    },
    
    'MOBILE_PHOTO': {
      confidenceThreshold: 55,
      strategies: ['TESSERACT_MOBILE_OPTIMIZED', 'GOOGLE_VISION'],
      fallbackStrategies: ['TESSERACT_ENHANCED', 'MANUAL_REVIEW'],
      qualitySettings: {
        resolution: 350,
        preprocessing: ['deskew', 'perspective_correction', 'noise_removal'],
        language: 'por'
      }
    }
  };

  private static supplierConfigs: { [key: string]: any } = {
    // Fornecedores conhecidos com padrões específicos
    'UBER': {
      confidenceBonus: 10,
      expectedFields: ['valor', 'data', 'origem', 'destino'],
      preprocessing: ['receipt_enhancement']
    },
    
    'POSTO': {
      confidenceBonus: 15,
      expectedFields: ['valor', 'litros', 'combustivel'],
      preprocessing: ['fuel_receipt_enhancement']
    },
    
    'NOTA_FISCAL': {
      confidenceBonus: 20,
      expectedFields: ['cnpj', 'valor', 'data_emissao'],
      preprocessing: ['nf_layout_detection']
    }
  };

  /**
   * Obtém configuração otimizada baseada no tipo de documento
   */
  static getConfigForDocument(
    fileType: string, 
    fileSize: number, 
    filename: string
  ): OcrConfig {
    
    let baseConfig: OcrConfig;
    
    // Determinar tipo base
    if (fileType.toLowerCase().includes('pdf')) {
      baseConfig = this.documentConfigs.PDF;
    } else if (fileSize > 2 * 1024 * 1024) { // > 2MB = alta qualidade
      baseConfig = this.documentConfigs.IMAGE_HIGH_QUALITY;
    } else if (this.isMobilePhoto(filename)) {
      baseConfig = this.documentConfigs.MOBILE_PHOTO;
    } else {
      baseConfig = this.documentConfigs.IMAGE_LOW_QUALITY;
    }

    // Ajustes baseados no fornecedor
    const supplierType = this.detectSupplierType(filename);
    if (supplierType) {
      const supplierConfig = this.supplierConfigs[supplierType];
      return {
        ...baseConfig,
        confidenceThreshold: baseConfig.confidenceThreshold + supplierConfig.confidenceBonus,
        qualitySettings: {
          ...baseConfig.qualitySettings,
          preprocessing: [
            ...baseConfig.qualitySettings.preprocessing,
            ...supplierConfig.preprocessing
          ]
        }
      };
    }

    return baseConfig;
  }

  /**
   * Ajusta threshold baseado no histórico de sucesso
   */
  static adaptThresholdFromHistory(
    baseConfig: OcrConfig, 
    supplierSuccessRate: number,
    documentTypeSuccessRate: number
  ): OcrConfig {
    
    let adjustedThreshold = baseConfig.confidenceThreshold;
    
    // Se fornecedor tem alta taxa de sucesso, pode baixar threshold
    if (supplierSuccessRate > 0.9) {
      adjustedThreshold -= 10;
    } else if (supplierSuccessRate < 0.7) {
      adjustedThreshold += 10;
    }

    // Mesmo para tipo de documento
    if (documentTypeSuccessRate > 0.9) {
      adjustedThreshold -= 5;
    } else if (documentTypeSuccessRate < 0.7) {
      adjustedThreshold += 5;
    }

    // Limites de segurança
    adjustedThreshold = Math.max(30, Math.min(90, adjustedThreshold));

    return {
      ...baseConfig,
      confidenceThreshold: adjustedThreshold
    };
  }

  /**
   * Escolhe estratégias de OCR baseado na análise do documento
   */
  static selectOptimalStrategies(
    config: OcrConfig,
    documentComplexity: 'LOW' | 'MEDIUM' | 'HIGH'
  ): string[] {
    
    switch (documentComplexity) {
      case 'LOW':
        // Documentos simples: usar estratégias rápidas
        return config.strategies.slice(0, 2);
      
      case 'MEDIUM':
        // Documentos médios: usar todas as estratégias
        return config.strategies;
      
      case 'HIGH':
        // Documentos complexos: usar todas + fallbacks
        return [...config.strategies, ...config.fallbackStrategies.slice(0, 1)];
      
      default:
        return config.strategies;
    }
  }

  /**
   * Analisa se é provável foto de celular
   */
  private static isMobilePhoto(filename: string): boolean {
    const mobilePatterns = [
      /IMG_\d+/i,
      /photo_\d+/i,
      /whatsapp/i,
      /camera/i
    ];
    
    return mobilePatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Detecta tipo de fornecedor pelo nome do arquivo
   */
  private static detectSupplierType(filename: string): string | null {
    const lowerFilename = filename.toLowerCase();
    
    if (lowerFilename.includes('uber')) return 'UBER';
    if (lowerFilename.includes('posto') || lowerFilename.includes('shell') || lowerFilename.includes('petrobras')) return 'POSTO';
    if (lowerFilename.includes('nota') && lowerFilename.includes('fiscal')) return 'NOTA_FISCAL';
    
    return null;
  }

  /**
   * Estima complexidade do documento baseado em metadados
   */
  static estimateComplexity(
    fileSize: number, 
    fileType: string, 
    filename: string
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    
    // PDFs geralmente são mais simples
    if (fileType.includes('pdf')) {
      return fileSize > 5 * 1024 * 1024 ? 'MEDIUM' : 'LOW';
    }
    
    // Imagens muito grandes podem ser complexas
    if (fileSize > 10 * 1024 * 1024) return 'HIGH';
    
    // Fotos de celular tendem a ser mais complexas
    if (this.isMobilePhoto(filename)) return 'MEDIUM';
    
    // Documentos fiscais são mais complexos
    if (filename.toLowerCase().includes('fiscal') || filename.toLowerCase().includes('nf')) {
      return 'HIGH';
    }
    
    return 'LOW';
  }
}