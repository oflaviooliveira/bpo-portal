/**
 * BoletoDetector - Detector Especializado para Boletos
 * Identifica boletos mesmo quando anexados a outros documentos
 */

export interface BoletoData {
  cedente: string;
  cnpjCedente?: string;
  sacado: string;
  documentoSacado?: string;
  valor: string;
  dataVencimento: string;
  nossoNumero?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  linhaDigitavel?: string;
  codigoBarras?: string;
  localPagamento?: string;
  instrucoes?: string;
}

export interface BoletoDetectionResult {
  isBoleto: boolean;
  confidence: number;
  data?: BoletoData;
  indicators: string[];
  section?: {
    start: number;
    end: number;
    text: string;
  };
  reasoning: string;
}

export class BoletoDetector {
  
  /**
   * Indicadores fortes de boleto
   */
  private static STRONG_INDICATORS = [
    { pattern: /FICHA DE COMPENSAÇÃO/gi, weight: 30, name: 'FICHA DE COMPENSAÇÃO' },
    { pattern: /\d{5}\.\d{5}\s\d{5}\.\d{6}\s\d{5}\.\d{6}/g, weight: 25, name: 'Linha digitável' },
    { pattern: /\d{47,48}/g, weight: 25, name: 'Código de barras' },
    { pattern: /CÓDIGO DE BARRAS/gi, weight: 20, name: 'CÓDIGO DE BARRAS' },
    { pattern: /NOSSO NÚMERO/gi, weight: 15, name: 'NOSSO NÚMERO' },
    { pattern: /CEDENTE/gi, weight: 15, name: 'CEDENTE' },
    { pattern: /SACADO/gi, weight: 15, name: 'SACADO' }
  ];

  /**
   * Indicadores moderados
   */
  private static MODERATE_INDICATORS = [
    { pattern: /VENCIMENTO/gi, weight: 10, name: 'VENCIMENTO' },
    { pattern: /AGÊNCIA/gi, weight: 8, name: 'AGÊNCIA' },
    { pattern: /CONTA/gi, weight: 8, name: 'CONTA' },
    { pattern: /CARTEIRA/gi, weight: 8, name: 'CARTEIRA' },
    { pattern: /BANCO/gi, weight: 5, name: 'BANCO' },
    { pattern: /PAGADOR/gi, weight: 10, name: 'PAGADOR' },
    { pattern: /LOCAL DE PAGAMENTO/gi, weight: 12, name: 'LOCAL DE PAGAMENTO' },
    { pattern: /INSTRUÇÕES/gi, weight: 8, name: 'INSTRUÇÕES' },
    { pattern: /ATÉ O VENCIMENTO/gi, weight: 10, name: 'ATÉ O VENCIMENTO' }
  ];

  /**
   * Padrões de layout típico de boleto
   */
  private static LAYOUT_PATTERNS = [
    { pattern: /CORTE AQUI/gi, weight: 15, name: 'CORTE AQUI' },
    { pattern: /AUTENTICAÇÃO MECÂNICA/gi, weight: 15, name: 'AUTENTICAÇÃO MECÂNICA' },
    { pattern: /═{3,}/g, weight: 8, name: 'Bordas de boleto' },
    { pattern: /─{5,}/g, weight: 5, name: 'Linhas divisórias' }
  ];

  /**
   * Detecta presença de boleto no texto
   */
  static detectBoleto(text: string): BoletoDetectionResult {
    const indicators: string[] = [];
    let confidence = 0;
    const reasoning: string[] = [];

    // Teste dos indicadores fortes
    this.STRONG_INDICATORS.forEach(indicator => {
      const matches = text.match(indicator.pattern);
      if (matches && matches.length > 0) {
        indicators.push(indicator.name);
        confidence += indicator.weight;
        reasoning.push(`✓ ${indicator.name} detectado (${matches.length}x)`);
      }
    });

    // Teste dos indicadores moderados
    this.MODERATE_INDICATORS.forEach(indicator => {
      const matches = text.match(indicator.pattern);
      if (matches && matches.length > 0) {
        indicators.push(indicator.name);
        confidence += indicator.weight * Math.min(matches.length, 2); // Max 2x peso
        reasoning.push(`• ${indicator.name} encontrado`);
      }
    });

    // Teste dos padrões de layout
    this.LAYOUT_PATTERNS.forEach(indicator => {
      const matches = text.match(indicator.pattern);
      if (matches && matches.length > 0) {
        indicators.push(indicator.name);
        confidence += indicator.weight;
        reasoning.push(`+ Layout: ${indicator.name}`);
      }
    });

    // Detectar seção do boleto se confiança alta
    let section;
    if (confidence >= 50) {
      section = this.extractBoletoSection(text);
    }

    // Extrair dados se boleto confirmado
    let data;
    if (confidence >= 60) {
      data = this.extractBoletoData(section?.text || text);
    }

    const isBoleto = confidence >= 40;
    
    return {
      isBoleto,
      confidence: Math.min(confidence, 95),
      data,
      indicators,
      section,
      reasoning: reasoning.join('; ')
    };
  }

  /**
   * Extrai a seção específica do boleto do documento
   */
  private static extractBoletoSection(text: string): { start: number; end: number; text: string } | undefined {
    const lines = text.split('\n');
    let startIndex = -1;
    let endIndex = lines.length;

    // Procurar início da seção do boleto
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toUpperCase();
      
      if (line.includes('FICHA DE COMPENSAÇÃO') || 
          line.includes('CÓDIGO DE BARRAS') ||
          line.includes('CORTE AQUI')) {
        startIndex = Math.max(0, i - 3); // Incluir algumas linhas antes
        break;
      }

      // Procurar por linha digitável
      if (/\d{5}\.\d{5}\s\d{5}\.\d{6}\s\d{5}\.\d{6}/.test(line)) {
        startIndex = Math.max(0, i - 5);
        break;
      }
    }

    // Se não encontrou início específico, usar últimos 40% do documento
    if (startIndex === -1) {
      startIndex = Math.floor(lines.length * 0.6);
    }

    const sectionLines = lines.slice(startIndex, endIndex);
    const sectionText = sectionLines.join('\n');
    
    const startChar = lines.slice(0, startIndex).join('\n').length;
    const endChar = startChar + sectionText.length;

    return {
      start: startChar,
      end: endChar,
      text: sectionText
    };
  }

  /**
   * Extrai dados estruturados do boleto
   */
  private static extractBoletoData(text: string): BoletoData {
    const data: Partial<BoletoData> = {};
    const lines = text.split('\n');

    // Extrair linha digitável
    const linhaDigitavelMatch = text.match(/(\d{5}\.\d{5}\s\d{5}\.\d{6}\s\d{5}\.\d{6}[\s\d]*)/);
    if (linhaDigitavelMatch) {
      data.linhaDigitavel = linhaDigitavelMatch[1].trim();
    }

    // Extrair código de barras
    const codigoBarrasMatch = text.match(/(\d{47,48})/);
    if (codigoBarrasMatch) {
      data.codigoBarras = codigoBarrasMatch[1];
    }

    // Extrair valor - procurar por padrões monetários
    const valorPatterns = [
      /VALOR.*?R\$\s*([\d.,]+)/gi,
      /R\$\s*([\d.,]+)/g,
      /(\d{1,3}(?:\.\d{3})*,\d{2})/g
    ];

    for (const pattern of valorPatterns) {
      const match = text.match(pattern);
      if (match && !data.valor) {
        data.valor = match[1] || match[0];
        break;
      }
    }

    // Extrair data de vencimento
    const vencimentoMatch = text.match(/VENCIMENTO.*?(\d{2}\/\d{2}\/\d{4})/i) ||
                           text.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (vencimentoMatch) {
      data.dataVencimento = vencimentoMatch[1];
    }

    // Extrair cedente (beneficiário)
    const cedenteMatch = text.match(/CEDENTE[:\s]*([^\n]+)/i);
    if (cedenteMatch) {
      data.cedente = cedenteMatch[1].trim();
    }

    // Extrair sacado (pagador)
    const sacadoMatch = text.match(/SACADO[:\s]*([^\n]+)/i) ||
                       text.match(/PAGADOR[:\s]*([^\n]+)/i);
    if (sacadoMatch) {
      data.sacado = sacadoMatch[1].trim();
    }

    // Extrair nosso número
    const nossoNumeroMatch = text.match(/NOSSO NÚMERO[:\s]*([^\n\s]+)/i);
    if (nossoNumeroMatch) {
      data.nossoNumero = nossoNumeroMatch[1].trim();
    }

    // Extrair banco
    const bancoMatch = text.match(/BANCO[:\s]*([^\n]+)/i);
    if (bancoMatch) {
      data.banco = bancoMatch[1].trim();
    }

    return data as BoletoData;
  }

  /**
   * Valida se os dados extraídos são consistentes
   */
  static validateBoletoData(data: BoletoData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validar linha digitável
    if (data.linhaDigitavel && !/^\d{5}\.\d{5}\s\d{5}\.\d{6}\s\d{5}\.\d{6}/.test(data.linhaDigitavel)) {
      errors.push('Linha digitável em formato inválido');
    }

    // Validar código de barras
    if (data.codigoBarras && !/^\d{47,48}$/.test(data.codigoBarras.replace(/\s/g, ''))) {
      errors.push('Código de barras deve ter 47 ou 48 dígitos');
    }

    // Validar data de vencimento
    if (data.dataVencimento && !/^\d{2}\/\d{2}\/\d{4}$/.test(data.dataVencimento)) {
      errors.push('Data de vencimento deve estar no formato DD/MM/AAAA');
    }

    // Validar valor
    if (data.valor && !/^\d+[.,]\d{2}$/.test(data.valor.replace(/[R$\s.]/g, ''))) {
      errors.push('Valor deve estar em formato monetário válido');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}