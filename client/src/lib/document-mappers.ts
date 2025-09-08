// Sistema de mapeamento unificado para diferentes tipos de documentos

export interface PaymentInfo {
  bankName?: string;
  transactionId?: string;
  reconciliationData?: {
    paymentDate?: string;
    paymentMethod?: string;
    account?: string;
    agency?: string;
    [key: string]: any;
  };
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
  
  // Campos específicos para comprovantes de pagamento
  metodoPagamento?: string;
  contaOrigem?: string;
  agencia?: string;
  numeroOperacao?: string;
  banco?: string;
  
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
    
    // Implementar fallbacks robustos usando múltiplas fontes de dados
    const getValue = (extractedField: string, fallbackField?: string, transform?: (val: any) => any) => {
      let value = extracted[extractedField] || document[fallbackField || extractedField];
      
      // Fallbacks específicos baseados no nome do documento
      if (!value && document.originalName) {
        value = this.extractFromFilename(document.originalName, extractedField);
      }
      
      return transform ? transform(value) : value;
    };
    
    const getFormattedCurrency = (...fields: string[]) => {
      for (const field of fields) {
        const value = extracted[field] || document[field];
        if (value) return this.formatCurrency(value);
      }
      return '';
    };
    
    const getFormattedDate = (...fields: string[]) => {
      for (const field of fields) {
        const value = extracted[field] || document[field];
        if (value) return this.formatDate(value);
      }
      return '';
    };
    
    return {
      displayName: document.originalName || 'Documento Físico',
      amount: getFormattedCurrency('valor', 'amount'),
      supplier: getValue('razao_social', 'supplier') || getValue('fornecedor', 'supplier'),
      dueDate: getFormattedDate('data_vencimento', 'dueDate'),
      status: document.status,
      documentType: document.documentType || document.bpoType,
      isVirtual: false,
      
      // Campos básicos com fallbacks inteligentes
      razaoSocial: getValue('razao_social', 'supplier') || getValue('fornecedor', 'supplier') || getValue('empresa'),
      cnpj: getValue('cnpj') || getValue('cpf') || getValue('documento'),
      valor: getFormattedCurrency('valor', 'amount', 'total', 'value'),
      dataEmissao: getFormattedDate('data_emissao', 'createdAt', 'data_documento'),
      dataVencimento: getFormattedDate('data_vencimento', 'dueDate', 'vencimento'),
      dataPagamento: getFormattedDate('data_pagamento', 'paidDate', 'data_pago'),
      descricao: getValue('descricao', 'description') || getValue('observacao') || getValue('detalhes') || this.generateDescription(document),
      endereco: getValue('endereco') || getValue('address'),
      telefone: getValue('telefone') || getValue('phone'),
      email: getValue('email'),
      
      // Seções específicas aprimoradas
      paymentInfo: this.buildPaymentInfo(document, extracted),
      
      scheduleInfo: document.documentType === 'AGENDADO' ? {
        scheduledDate: getFormattedDate('data_agendamento', 'scheduledDate', 'data_agenda'),
        paymentMethod: getValue('forma_pagamento') || getValue('metodo_pagamento') || getValue('payment_method'),
        instructions: getValue('instrucoes', 'instructions') || getValue('observacoes')
      } : undefined,
      
      // Para debug
      rawExtractedData: extracted,
      rawDocument: document
    };
  }
  
  private buildPaymentInfo(document: any, extracted: any): PaymentInfo | undefined {
    if (document.documentType !== 'PAGO' && document.bpoType !== 'PAGO') {
      return undefined;
    }
    
    return {
      bankName: extracted.banco || extracted.bank_name || extracted.instituicao_financeira || 
                document.bank || this.extractBankFromText(extracted),
      transactionId: extracted.transacao_id || extracted.transaction_id || extracted.protocolo || 
                     extracted.comprovante || extracted.numero_operacao,
      reconciliationData: extracted.reconciliation_data || {
        paymentDate: this.formatDate(extracted.data_pagamento || document.paidDate),
        paymentMethod: extracted.forma_pagamento || extracted.metodo || 'Transferência',
        account: extracted.conta_origem || extracted.account_origin,
        agency: extracted.agencia || extracted.agency
      }
    };
  }
  
  private extractFromFilename(filename: string, field: string): string | undefined {
    if (!filename) return undefined;
    
    const lower = filename.toLowerCase();
    
    // Padrões comuns em nomes de arquivo
    switch (field) {
      case 'razao_social':
      case 'fornecedor':
        // Extrair nome da empresa do nome do arquivo
        const companyMatch = filename.match(/^([^-_\d]+)/);
        return companyMatch ? companyMatch[1].trim() : undefined;
        
      case 'valor':
        // Extrair valor se presente no nome
        const valueMatch = filename.match(/([R$\s]*[\d.,]+)/i);
        return valueMatch ? valueMatch[1] : undefined;
        
      case 'data_pagamento':
        // Extrair data do nome do arquivo
        const dateMatch = filename.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/);
        return dateMatch ? dateMatch[1] : undefined;
        
      default:
        return undefined;
    }
  }
  
  private extractBankFromText(extracted: any): string | undefined {
    const text = JSON.stringify(extracted).toLowerCase();
    
    const banks = [
      'itau', 'bradesco', 'banco do brasil', 'santander', 'caixa',
      'nubank', 'inter', 'c6', 'original', 'safra', 'sicoob'
    ];
    
    for (const bank of banks) {
      if (text.includes(bank)) {
        return bank.charAt(0).toUpperCase() + bank.slice(1);
      }
    }
    
    return undefined;
  }
  
  private generateDescription(document: any): string {
    const type = document.documentType || document.bpoType;
    const supplier = document.supplier || 'Fornecedor';
    
    switch (type) {
      case 'PAGO':
        return `Comprovante de pagamento - ${supplier}`;
      case 'AGENDADO':
        return `Agendamento de pagamento - ${supplier}`;
      default:
        return `Documento ${type} - ${supplier}`;
    }
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