/**
 * SupplierDetector - Sistema Inteligente de Detecção de Fornecedor
 * Extrai automaticamente dados de fornecedor dos documentos e verifica na base existente
 */

export interface SupplierData {
  name: string;
  cnpj?: string;
  category?: string;
  confidence: number;
  source: 'HEADER' | 'EMITENTE' | 'CEDENTE' | 'FILENAME' | 'MIXED';
  rawText?: string;
}

export interface SupplierDetectionResult {
  supplier: SupplierData | null;
  suggestions: SupplierSuggestion[];
  requiresManualReview: boolean;
  reasoning: string;
}

export interface SupplierSuggestion {
  name: string;
  cnpj?: string;
  category?: string;
  matchScore: number;
  isExactMatch: boolean;
  existingId?: string;
}

export class SupplierDetector {
  
  /**
   * Padrões para identificar fornecedores por tipo de documento
   */
  private static SUPPLIER_PATTERNS = {
    DANFE: {
      keywords: ['EMITENTE', 'RAZÃO SOCIAL', 'CNPJ'],
      sections: ['DADOS DO EMITENTE', 'EMITENTE'],
      priority: 90
    },
    BOLETO: {
      keywords: ['CEDENTE', 'BENEFICIÁRIO', 'FAVORECIDO'],
      sections: ['CEDENTE', 'BENEFICIÁRIO'],
      priority: 85
    },
    APOLICE: {
      keywords: ['SEGURADORA', 'CIA DE SEGUROS', 'SEGUROS'],
      sections: ['SEGURADORA', 'EMPRESA'],
      priority: 80
    },
    FATURA: {
      keywords: ['PRESTADOR', 'EMPRESA', 'FORNECEDOR'],
      sections: ['DADOS DA EMPRESA', 'PRESTADOR'],
      priority: 75
    },
    RECIBO: {
      keywords: ['RECEBEDOR', 'FAVORECIDO', 'EMPRESA'],
      sections: ['RECEBEDOR', 'DADOS'],
      priority: 70
    }
  };

  /**
   * Categorias automáticas baseadas em palavras-chave
   */
  private static CATEGORY_MAPPING = {
    'SEGUROS': ['SEGURO', 'CIA DE SEGUROS', 'SEGURADORA', 'SUSEP'],
    'TELECOMUNICAÇÕES': ['TELECOM', 'TELEFONE', 'CELULAR', 'INTERNET', 'ANATEL'],
    'ENERGIA': ['ENERGIA', 'ELÉTRICA', 'ELETRICIDADE', 'ANEEL', 'DISTRIBUIDORA'],
    'COMBUSTÍVEL': ['POSTO', 'COMBUSTÍVEL', 'GASOLINA', 'ÁLCOOL', 'ANP'],
    'ALIMENTAÇÃO': ['RESTAURANTE', 'LANCHONETE', 'ALIMENTAÇÃO', 'PADARIA'],
    'TRANSPORTE': ['TRANSPORTE', 'FRETE', 'LOGÍSTICA', 'ANTT'],
    'SAÚDE': ['MÉDICO', 'HOSPITAL', 'CLÍNICA', 'FARMÁCIA', 'ANS'],
    'CONSULTORIA': ['CONSULTORIA', 'ASSESSORIA', 'SERVIÇOS'],
    'MANUTENÇÃO': ['MANUTENÇÃO', 'REPARO', 'ASSISTÊNCIA'],
    'OUTROS': []
  };

  /**
   * Detecta automaticamente o fornecedor no documento
   */
  static detectSupplier(ocrText: string, fileName: string, documentType?: string): SupplierDetectionResult {
    console.log('🔍 Iniciando detecção inteligente de fornecedor...');
    
    const supplier = this.extractSupplierData(ocrText, fileName, documentType);
    const suggestions = supplier ? this.generateSuggestions(supplier) : [];
    
    return {
      supplier,
      suggestions,
      requiresManualReview: !supplier || supplier.confidence < 70,
      reasoning: this.buildReasoning(supplier, suggestions)
    };
  }

  /**
   * Extrai dados do fornecedor do texto OCR
   */
  private static extractSupplierData(ocrText: string, fileName: string, documentType?: string): SupplierData | null {
    // Estratégia 1: Extração baseada no tipo de documento
    if (documentType && this.SUPPLIER_PATTERNS[documentType as keyof typeof this.SUPPLIER_PATTERNS]) {
      const typeBasedResult = this.extractByDocumentType(ocrText, documentType);
      if (typeBasedResult) return typeBasedResult;
    }

    // Estratégia 2: Extração genérica por padrões
    const genericResult = this.extractGenericSupplier(ocrText);
    if (genericResult) return genericResult;

    // Estratégia 3: Fallback para análise do filename
    const filenameResult = this.extractFromFilename(fileName);
    if (filenameResult) return filenameResult;

    return null;
  }

  /**
   * Extração especializada por tipo de documento
   */
  private static extractByDocumentType(ocrText: string, documentType: string): SupplierData | null {
    const pattern = this.SUPPLIER_PATTERNS[documentType as keyof typeof this.SUPPLIER_PATTERNS];
    if (!pattern) return null;

    const lines = ocrText.split('\n');
    let supplierName = '';
    let cnpj = '';
    let confidence = pattern.priority;
    let source: SupplierData['source'] = 'MIXED';

    // Procurar por seções específicas do tipo de documento
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim().toUpperCase();
      
      // Verificar se a linha contém indicadores do tipo
      const hasKeyword = pattern.keywords.some(keyword => line.includes(keyword));
      
      if (hasKeyword) {
        // Procurar nome da empresa nas próximas linhas
        for (let j = i; j < Math.min(i + 5, lines.length); j++) {
          const candidateLine = lines[j].trim();
          
          // Ignorar linhas muito pequenas ou apenas números
          if (candidateLine.length < 3 || /^\d+$/.test(candidateLine)) continue;
          
          // Verificar se parece com nome de empresa
          if (this.looksLikeCompanyName(candidateLine)) {
            supplierName = this.cleanCompanyName(candidateLine);
            source = documentType === 'DANFE' ? 'EMITENTE' : 
                    documentType === 'BOLETO' ? 'CEDENTE' : 'HEADER';
            break;
          }
        }
        
        // Procurar CNPJ próximo
        for (let j = Math.max(0, i - 2); j < Math.min(i + 8, lines.length); j++) {
          const cnpjMatch = lines[j].match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
          if (cnpjMatch) {
            cnpj = this.formatCNPJ(cnpjMatch[1]);
            break;
          }
        }
        
        if (supplierName) break;
      }
    }

    if (supplierName) {
      return {
        name: supplierName,
        cnpj: cnpj || undefined,
        category: this.inferCategory(supplierName),
        confidence,
        source,
        rawText: `${supplierName} ${cnpj}`.trim()
      };
    }

    return null;
  }

  /**
   * Extração genérica buscando padrões comuns
   */
  private static extractGenericSupplier(ocrText: string): SupplierData | null {
    const lines = ocrText.split('\n');
    const candidates: Array<{name: string, cnpj?: string, score: number}> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Procurar linhas que parecem com nome de empresa
      if (this.looksLikeCompanyName(line)) {
        let score = 50;
        let cnpj = '';
        
        // Bonus se está no início do documento
        if (i < lines.length * 0.3) score += 20;
        
        // Procurar CNPJ próximo
        for (let j = Math.max(0, i - 2); j < Math.min(i + 5, lines.length); j++) {
          const cnpjMatch = lines[j].match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
          if (cnpjMatch) {
            cnpj = this.formatCNPJ(cnpjMatch[1]);
            score += 25;
            break;
          }
        }
        
        // Bonus para indicadores de empresa
        if (/LTDA|S\.A\.|EIRELI|ME|EPP/i.test(line)) score += 15;
        
        candidates.push({
          name: this.cleanCompanyName(line),
          cnpj: cnpj || undefined,
          score
        });
      }
    }

    // Retornar o candidato com maior score
    if (candidates.length > 0) {
      const best = candidates.reduce((a, b) => a.score > b.score ? a : b);
      
      if (best.score >= 60) {
        return {
          name: best.name,
          cnpj: best.cnpj,
          category: this.inferCategory(best.name),
          confidence: Math.min(best.score, 90),
          source: 'HEADER',
          rawText: `${best.name} ${best.cnpj || ''}`.trim()
        };
      }
    }

    return null;
  }

  /**
   * Extração básica do nome do arquivo
   */
  private static extractFromFilename(fileName: string): SupplierData | null {
    // Remover extensão e caracteres especiais
    const cleanName = fileName.replace(/\.[^.]+$/, '').replace(/[_\-\d]/g, ' ').trim();
    
    // Procurar por nomes de empresas conhecidas
    const companies = ['SOMPO', 'PORTO', 'BRADESCO', 'SANTANDER', 'ITAU', 'CAIXA', 'BB', 'VIVO', 'TIM', 'CLARO'];
    
    for (const company of companies) {
      if (cleanName.toUpperCase().includes(company)) {
        return {
          name: this.expandCompanyName(company),
          confidence: 40,
          source: 'FILENAME',
          category: this.inferCategory(company),
          rawText: cleanName
        };
      }
    }

    return null;
  }

  /**
   * Verifica se uma linha parece com nome de empresa
   */
  private static looksLikeCompanyName(line: string): boolean {
    if (line.length < 5 || line.length > 80) return false;
    
    // Deve ter pelo menos 2 palavras
    const words = line.trim().split(/\s+/);
    if (words.length < 2) return false;
    
    // Indicadores positivos
    const positiveIndicators = /LTDA|S\.A\.|EIRELI|ME|EPP|CIA|COMPANHIA|EMPRESA|COMERCIAL/i;
    const hasPositiveIndicator = positiveIndicators.test(line);
    
    // Indicadores negativos
    const negativeIndicators = /^(RUA|AV|AVENIDA|TELEFONE|EMAIL|CEP|CNPJ|CPF|\d+$)/i;
    const hasNegativeIndicator = negativeIndicators.test(line);
    
    // Muito texto em maiúscula pode ser nome de empresa
    const upperCaseRatio = (line.match(/[A-Z]/g) || []).length / line.length;
    
    return (hasPositiveIndicator || upperCaseRatio > 0.7) && !hasNegativeIndicator;
  }

  /**
   * Limpa e normaliza nome da empresa
   */
  private static cleanCompanyName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^[^a-zA-Z]+/, '') // Remove números do início
      .replace(/[^a-zA-Z0-9\s\-\.]/g, '') // Remove caracteres especiais
      .toUpperCase();
  }

  /**
   * Formata CNPJ para padrão XX.XXX.XXX/XXXX-XX
   */
  private static formatCNPJ(cnpj: string): string {
    const numbers = cnpj.replace(/\D/g, '');
    if (numbers.length !== 14) return cnpj;
    
    return `${numbers.slice(0,2)}.${numbers.slice(2,5)}.${numbers.slice(5,8)}/${numbers.slice(8,12)}-${numbers.slice(12,14)}`;
  }

  /**
   * Infere categoria baseada no nome da empresa
   */
  private static inferCategory(companyName: string): string {
    const upperName = companyName.toUpperCase();
    
    for (const [category, keywords] of Object.entries(this.CATEGORY_MAPPING)) {
      if (keywords.some(keyword => upperName.includes(keyword))) {
        return category;
      }
    }
    
    return 'OUTROS';
  }

  /**
   * Expande nomes de empresas conhecidas
   */
  private static expandCompanyName(shortName: string): string {
    const expansions: Record<string, string> = {
      'SOMPO': 'SOMPO SEGUROS S.A.',
      'PORTO': 'PORTO SEGURO CIA DE SEGUROS GERAIS',
      'BRADESCO': 'BRADESCO SEGUROS S.A.',
      'VIVO': 'TELEFONICA BRASIL S.A.',
      'TIM': 'TIM CELULAR S.A.',
      'CLARO': 'CLARO S.A.'
    };
    
    return expansions[shortName.toUpperCase()] || shortName;
  }

  /**
   * Gera sugestões de fornecedores similares
   */
  private static generateSuggestions(supplier: SupplierData): SupplierSuggestion[] {
    // Por agora, retorna o próprio fornecedor como sugestão
    // Isso será expandido quando integrarmos com a base de dados
    return [{
      name: supplier.name,
      cnpj: supplier.cnpj,
      category: supplier.category,
      matchScore: supplier.confidence,
      isExactMatch: false
    }];
  }

  /**
   * Constrói explicação do processo de detecção
   */
  private static buildReasoning(supplier: SupplierData | null, suggestions: SupplierSuggestion[]): string {
    if (!supplier) {
      return 'Nenhum fornecedor detectado automaticamente. Revisão manual necessária.';
    }
    
    const sourceLabels = {
      'HEADER': 'cabeçalho do documento',
      'EMITENTE': 'seção do emitente (DANFE)',
      'CEDENTE': 'seção do cedente (Boleto)',
      'FILENAME': 'nome do arquivo',
      'MIXED': 'múltiplas fontes'
    };
    
    return `Fornecedor "${supplier.name}" detectado no ${sourceLabels[supplier.source]} com ${supplier.confidence}% de confiança. ${supplier.cnpj ? `CNPJ: ${supplier.cnpj}. ` : ''}Categoria sugerida: ${supplier.category}.`;
  }
}