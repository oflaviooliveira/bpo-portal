// Sistema de mapeamento unificado para diferentes tipos de documentos

export interface PaymentInfo {
  bankName?: string;
  transactionId?: string;
  reconciliationData?: any;
}

export interface ScheduleInfo {
  scheduledDate?: string;
  paymentMethod?: string;
  instructions?: string;
}

export interface BoletoInfo {
  payerName?: string;
  payerDocument?: string;
  payerEmail?: string;
  payerPhone?: string;
  payerAddress?: string;
  instructions?: string;
  dueDate?: string;
}

export interface UnifiedDocumentData {
  // Campos padronizados para todos os tipos
  displayName: string;
  amount?: string;
  supplier?: string;
  dueDate?: string;
  status: string;
  documentType: string;
  isVirtual: boolean;
  
  // Campos básicos sempre disponíveis
  razaoSocial?: string;
  cnpj?: string;
  valor?: string;
  dataEmissao?: string;
  dataVencimento?: string;
  dataPagamento?: string;
  descricao?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  
  // Seções específicas por tipo
  paymentInfo?: PaymentInfo;
  scheduleInfo?: ScheduleInfo;
  boletoInfo?: BoletoInfo;
  
  // Dados originais para debug
  rawExtractedData?: any;
  rawDocument?: any;
}

export abstract class DocumentMapper {
  abstract map(document: any): UnifiedDocumentData;
  
  protected formatCurrency(value: string | number): string {
    if (!value) return '';
    
    const numValue = typeof value === 'string' 
      ? parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'))
      : value;
      
    if (isNaN(numValue)) return value?.toString() || '';
    
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numValue);
  }
  
  protected formatDate(dateStr: string): string {
    if (!dateStr) return '';
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  }
  
  protected parseExtractedData(extractedData: any): any {
    if (!extractedData) return {};
    
    // Se é string JSON, fazer parse
    if (typeof extractedData === 'string') {
      try {
        return JSON.parse(extractedData);
      } catch {
        return {};
      }
    }
    
    return extractedData;
  }
}

export class PhysicalDocumentMapper extends DocumentMapper {
  map(document: any): UnifiedDocumentData {
    const extracted = this.parseExtractedData(document.extractedData);
    
    return {
      displayName: document.originalName || 'Documento Físico',
      amount: this.formatCurrency(extracted.valor || document.amount),
      supplier: extracted.razao_social || document.supplier,
      dueDate: this.formatDate(extracted.data_vencimento || document.dueDate),
      status: document.status,
      documentType: document.documentType || document.bpoType,
      isVirtual: false,
      
      // Campos básicos mapeados
      razaoSocial: extracted.razao_social,
      cnpj: extracted.cnpj || extracted.cpf,
      valor: this.formatCurrency(extracted.valor),
      dataEmissao: this.formatDate(extracted.data_emissao),
      dataVencimento: this.formatDate(extracted.data_vencimento),
      dataPagamento: this.formatDate(extracted.data_pagamento),
      descricao: extracted.descricao || document.description,
      endereco: extracted.endereco,
      telefone: extracted.telefone,
      email: extracted.email,
      
      // Seções específicas
      paymentInfo: document.documentType === 'PAGO' ? {
        bankName: extracted.banco || extracted.bank_name,
        transactionId: extracted.transacao_id,
        reconciliationData: extracted.reconciliation_data
      } : undefined,
      
      scheduleInfo: document.documentType === 'AGENDADO' ? {
        scheduledDate: this.formatDate(extracted.data_agendamento || document.scheduledDate),
        paymentMethod: extracted.forma_pagamento,
        instructions: extracted.instrucoes || document.instructions
      } : undefined,
      
      // Para debug
      rawExtractedData: extracted,
      rawDocument: document
    };
  }
}

export class VirtualDocumentMapper extends DocumentMapper {
  map(document: any): UnifiedDocumentData {
    const issuerData = document.issuerData || {};
    
    return {
      displayName: `Documento Virtual - ${this.getTypeLabel(document.documentType || document.bpoType)}`,
      amount: this.formatCurrency(document.amount),
      supplier: document.supplier,
      dueDate: this.formatDate(document.dueDate),
      status: document.status,
      documentType: document.documentType || document.bpoType,
      isVirtual: true,
      
      // Campos básicos para documentos virtuais
      razaoSocial: document.supplier,
      valor: this.formatCurrency(document.amount),
      dataVencimento: this.formatDate(document.dueDate),
      dataPagamento: this.formatDate(document.paidDate),
      descricao: document.description,
      
      // Seção específica para boletos
      boletoInfo: document.documentType === 'EMITIR_BOLETO' ? {
        payerName: issuerData.payerName,
        payerDocument: issuerData.payerDocument,
        payerEmail: issuerData.payerEmail,
        payerPhone: issuerData.payerPhone,
        payerAddress: issuerData.payerAddress || this.buildAddress(issuerData),
        instructions: document.instructions,
        dueDate: this.formatDate(document.dueDate)
      } : undefined,
      
      // Para debug
      rawExtractedData: issuerData,
      rawDocument: document
    };
  }
  
  private getTypeLabel(type: string): string {
    switch (type) {
      case 'EMITIR_BOLETO':
        return 'Emissão de Boleto';
      case 'EMITIR_NF':
        return 'Emissão de Nota Fiscal';
      default:
        return type;
    }
  }
  
  private buildAddress(issuerData: any): string {
    const parts = [
      issuerData.payerStreet,
      issuerData.payerNumber,
      issuerData.payerComplement,
      issuerData.payerNeighborhood,
      issuerData.payerCity,
      issuerData.payerState,
      issuerData.payerZipCode
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : '';
  }
}

export class DocumentMapperFactory {
  static create(document: any): DocumentMapper {
    const isVirtual = document.isVirtualDocument || 
                     document.filePath === null || 
                     ['EMITIR_BOLETO', 'EMITIR_NF'].includes(document.documentType || document.bpoType);
    
    return isVirtual 
      ? new VirtualDocumentMapper()
      : new PhysicalDocumentMapper();
  }
  
  static mapDocument(document: any): UnifiedDocumentData {
    const mapper = this.create(document);
    return mapper.map(document);
  }
}