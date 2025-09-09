import { storage } from "./storage";

interface InconsistencyCheck {
  field: string;
  ocrValue?: string;
  filenameValue?: string;
  formValue?: string;
  isInconsistent: boolean;
  severity: 'low' | 'medium' | 'high';
}

interface ValidationResult {
  isValid: boolean;
  confidence: number;
  errors: InconsistencyCheck[];
}

export class InconsistencyDetector {
  
  async detectInconsistencies(documentId: string, ocrResult: any, aiResult: any, document: any): Promise<ValidationResult> {
    const inconsistencies: InconsistencyCheck[] = [];

    // Limpar inconsistências anteriores
    await storage.deleteDocumentInconsistencies(documentId);

    // 1. Validar valores monetários
    const amountInconsistency = await this.validateAmount(documentId, ocrResult.text, aiResult.extractedData, document);
    if (amountInconsistency.isInconsistent) {
      inconsistencies.push(amountInconsistency);
    }

    // 2. Validar datas
    const dateInconsistency = await this.validateDates(documentId, ocrResult.text, aiResult.extractedData, document);
    if (dateInconsistency.isInconsistent) {
      inconsistencies.push(dateInconsistency);
    }

    // 3. Validar fornecedor/cliente
    const supplierInconsistency = await this.validateSupplier(documentId, ocrResult.text, aiResult.extractedData, document);
    if (supplierInconsistency.isInconsistent) {
      inconsistencies.push(supplierInconsistency);
    }

    // 4. Validar documento (CNPJ/CPF)
    const documentNumberInconsistency = await this.validateDocumentNumber(documentId, ocrResult.text, aiResult.extractedData, document);
    if (documentNumberInconsistency.isInconsistent) {
      inconsistencies.push(documentNumberInconsistency);
    }

    // Registrar inconsistências no banco
    for (const inconsistency of inconsistencies) {
      if (inconsistency.isInconsistent) {
        await storage.createDocumentInconsistency({
          documentId,
          field: inconsistency.field,
          ocrValue: inconsistency.ocrValue,
          filenameValue: inconsistency.filenameValue,
          formValue: inconsistency.formValue,
        });
      }
    }

    // Calcular confiança geral
    const highSeverityCount = inconsistencies.filter(i => i.severity === 'high').length;
    const mediumSeverityCount = inconsistencies.filter(i => i.severity === 'medium').length;
    const lowSeverityCount = inconsistencies.filter(i => i.severity === 'low').length;

    let confidence = 100;
    confidence -= (highSeverityCount * 30);
    confidence -= (mediumSeverityCount * 15);
    confidence -= (lowSeverityCount * 5);
    confidence = Math.max(0, confidence);

    const isValid = inconsistencies.length === 0 || confidence >= 70;

    return {
      isValid,
      confidence,
      errors: inconsistencies,
    };
  }

  private async validateAmount(documentId: string, ocrText: string, aiData: any, document: any): Promise<InconsistencyCheck> {
    const ocrAmount = this.extractAmountFromText(ocrText);
    const aiAmount = aiData.valor || aiData.amount;
    const filenameAmount = this.extractAmountFromFilename(document.originalName);

    const normalizedOcrAmount = this.normalizeAmount(ocrAmount);
    const normalizedAiAmount = this.normalizeAmount(aiAmount);
    const normalizedFilenameAmount = this.normalizeAmount(filenameAmount);

    // Verificar discrepâncias significativas (mais de 5% de diferença)
    const tolerance = 0.05;
    let isInconsistent = false;
    let severity: 'low' | 'medium' | 'high' = 'low';

    if (normalizedOcrAmount && normalizedAiAmount) {
      const diff = Math.abs(normalizedOcrAmount - normalizedAiAmount) / Math.max(normalizedOcrAmount, normalizedAiAmount);
      if (diff > tolerance) {
        isInconsistent = true;
        severity = diff > 0.2 ? 'high' : 'medium';
      }
    }

    if (normalizedFilenameAmount && normalizedOcrAmount) {
      const diff = Math.abs(normalizedFilenameAmount - normalizedOcrAmount) / Math.max(normalizedFilenameAmount, normalizedOcrAmount);
      if (diff > tolerance) {
        isInconsistent = true;
        severity = diff > 0.2 ? 'high' : 'medium';
      }
    }

    return {
      field: 'amount',
      ocrValue: ocrAmount,
      filenameValue: filenameAmount,
      formValue: aiAmount,
      isInconsistent,
      severity,
    };
  }

  private async validateDates(documentId: string, ocrText: string, aiData: any, document: any): Promise<InconsistencyCheck> {
    const ocrDates = this.extractDatesFromText(ocrText);
    const aiDate = aiData.data_pagamento || aiData.data_vencimento || aiData.date;
    const filenameDate = this.extractDateFromFilename(document.originalName);

    let isInconsistent = false;
    let severity: 'low' | 'medium' | 'high' = 'low';

    // Verificar se datas são muito distantes (mais de 1 ano)
    if (aiDate && ocrDates.length > 0) {
      const aiDateObj = this.parseDate(aiDate);
      const ocrDateObj = this.parseDate(ocrDates[0]);
      
      if (aiDateObj && ocrDateObj) {
        const daysDiff = Math.abs((aiDateObj.getTime() - ocrDateObj.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 365) {
          isInconsistent = true;
          severity = 'high';
        } else if (daysDiff > 30) {
          isInconsistent = true;
          severity = 'medium';
        }
      }
    }

    return {
      field: 'date',
      ocrValue: ocrDates.join(', '),
      filenameValue: filenameDate,
      formValue: aiDate,
      isInconsistent,
      severity,
    };
  }

  private async validateSupplier(documentId: string, ocrText: string, aiData: any, document: any): Promise<InconsistencyCheck> {
    const ocrSupplier = this.extractSupplierFromText(ocrText);
    const aiSupplier = aiData.fornecedor || aiData.supplier || aiData.cliente_fornecedor;
    const filenameSupplier = this.extractSupplierFromFilename(document.originalName);

    let isInconsistent = false;
    let severity: 'low' | 'medium' | 'high' = 'low';

    // Comparação fuzzy para nomes de fornecedores
    if (ocrSupplier && aiSupplier) {
      const similarity = this.calculateTextSimilarity(ocrSupplier, aiSupplier);
      if (similarity < 0.6) {
        isInconsistent = true;
        severity = similarity < 0.3 ? 'high' : 'medium';
      }
    }

    return {
      field: 'supplier',
      ocrValue: ocrSupplier,
      filenameValue: filenameSupplier,
      formValue: aiSupplier,
      isInconsistent,
      severity,
    };
  }

  private async validateDocumentNumber(documentId: string, ocrText: string, aiData: any, document: any): Promise<InconsistencyCheck> {
    const ocrDocNumbers = this.extractDocumentNumbers(ocrText);
    const aiDocNumber = aiData.documento || aiData.cnpj || aiData.cpf;
    const filenameDocNumber = this.extractDocumentNumberFromFilename(document.originalName);

    let isInconsistent = false;
    let severity: 'low' | 'medium' | 'high' = 'low';

    // CNPJ/CPF devem ser exatos
    if (aiDocNumber && ocrDocNumbers.length > 0) {
      const normalizedAi = this.normalizeDocumentNumber(aiDocNumber);
      const normalizedOcr = ocrDocNumbers.map(doc => this.normalizeDocumentNumber(doc));
      
      if (!normalizedOcr.includes(normalizedAi)) {
        isInconsistent = true;
        severity = 'high'; // Documento é campo crítico
      }
    }

    return {
      field: 'document',
      ocrValue: ocrDocNumbers.join(', '),
      filenameValue: filenameDocNumber,
      formValue: aiDocNumber,
      isInconsistent,
      severity,
    };
  }

  // Utility methods for extraction and normalization
  private extractAmountFromText(text: string): string | undefined {
    const pattern = /R\$?\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/;
    const match = text.match(pattern);
    return match ? `R$ ${match[1]}` : undefined;
  }

  private extractAmountFromFilename(filename: string): string | undefined {
    const pattern = /(\d+[.,]\d{2})/;
    const match = filename.match(pattern);
    return match ? `R$ ${match[1]}` : undefined;
  }

  private normalizeAmount(amount: string | undefined): number | undefined {
    if (!amount) return undefined;
    // Ordem correta: Remove R$/espaços → Remove pontos de milhares → Converte vírgula decimal
    const cleaned = amount.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }

  private extractDatesFromText(text: string): string[] {
    const pattern = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/g;
    const matches = Array.from(text.matchAll(pattern));
    return matches.map(match => `${match[1]}/${match[2]}/${match[3]}`);
  }

  private extractDateFromFilename(filename: string): string | undefined {
    const pattern = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/;
    const match = filename.match(pattern);
    return match ? `${match[1]}/${match[2]}/${match[3]}` : undefined;
  }

  private parseDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return undefined;
  }

  private extractSupplierFromText(text: string): string | undefined {
    // Lista de fornecedores comuns no Brasil
    const commonSuppliers = [
      'uber', 'ifood', 'magazine luiza', 'amazon', 'correios', 'vivo', 'tim', 'claro',
      'petrobrás', 'shell', 'ipiranga', 'ambev', 'coca-cola', 'nestlé', 'unilever'
    ];
    
    for (const supplier of commonSuppliers) {
      if (text.toLowerCase().includes(supplier)) {
        return supplier;
      }
    }
    
    // Buscar nomes em maiúsculas (geralmente empresas)
    const upperCasePattern = /[A-Z][A-Z\s]+[A-Z]/g;
    const matches = text.match(upperCasePattern);
    return matches ? matches[0].trim() : undefined;
  }

  private extractSupplierFromFilename(filename: string): string | undefined {
    // Extrair palavras relevantes do nome do arquivo
    const words = filename.toLowerCase().split(/[_\-\s.]/);
    const meaningfulWords = words.filter(word => 
      word.length > 3 && 
      !['pdf', 'jpg', 'png', 'doc', 'docx'].includes(word) &&
      !/^\d+$/.test(word)
    );
    return meaningfulWords.length > 0 ? meaningfulWords[0] : undefined;
  }

  private extractDocumentNumbers(text: string): string[] {
    const cnpjPattern = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g;
    const cpfPattern = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
    
    const cnpjMatches = Array.from(text.matchAll(cnpjPattern));
    const cpfMatches = Array.from(text.matchAll(cpfPattern));
    
    return [...cnpjMatches, ...cpfMatches].map(match => match[0]);
  }

  private extractDocumentNumberFromFilename(filename: string): string | undefined {
    const pattern = /\d{2}\.?\d{3}\.?\d{3}[\/\-]?\d{4}[\/\-]?\d{2}/;
    const match = filename.match(pattern);
    return match ? match[0] : undefined;
  }

  private normalizeDocumentNumber(doc: string): string {
    return doc.replace(/[^\d]/g, '');
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const normalize = (str: string) => str.toLowerCase().trim();
    const a = normalize(text1);
    const b = normalize(text2);
    
    if (a === b) return 1.0;
    
    // Levenshtein distance simplified
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

export const inconsistencyDetector = new InconsistencyDetector();