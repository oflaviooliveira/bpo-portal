import { type Contraparte } from "@shared/schema";

/**
 * Service para gerenciar a lógica unificada de contrapartes
 * Define automaticamente se uma contraparte é cliente ou fornecedor baseado no tipo de documento
 */
export class ContraparteService {
  
  /**
   * Calcula o tipo de relacionamento baseado no tipo de documento
   * @param documentType - Tipo do documento (PAGO, AGENDADO, EMITIR_BOLETO, EMITIR_NF)
   * @returns 'SUPPLIER' para pagamentos, 'CLIENT' para recebimentos
   */
  static calculateRelationshipType(documentType: string): 'CLIENT' | 'SUPPLIER' {
    const paymentTypes = ['PAGO', 'AGENDADO'];
    const receiptTypes = ['EMITIR_BOLETO', 'EMITIR_NF'];
    
    if (paymentTypes.includes(documentType)) {
      // Nós pagamos → Contraparte é fornecedor
      return 'SUPPLIER';
    } else if (receiptTypes.includes(documentType)) {
      // Nós recebemos → Contraparte é cliente
      return 'CLIENT';
    }
    
    // Default: tratamos como fornecedor
    return 'SUPPLIER';
  }
  
  /**
   * Valida se uma contraparte pode ser usada para um determinado tipo de documento
   * @param contraparte - Contraparte a ser validada
   * @param documentType - Tipo do documento
   * @returns true se a contraparte pode ser usada
   */
  static canUseContraparteForDocument(contraparte: Contraparte, documentType: string): boolean {
    const relationshipType = this.calculateRelationshipType(documentType);
    
    if (relationshipType === 'CLIENT') {
      return contraparte.canBeClient;
    } else {
      return contraparte.canBeSupplier;
    }
  }
  
  /**
   * Determina quais contrapartes podem ser usadas para um tipo de documento
   * @param contrapartes - Lista de contrapartes disponíveis
   * @param documentType - Tipo do documento
   * @returns Lista filtrada de contrapartes válidas
   */
  static filterContrapartesForDocument(contrapartes: Contraparte[], documentType: string): Contraparte[] {
    return contrapartes.filter(contraparte => 
      this.canUseContraparteForDocument(contraparte, documentType)
    );
  }
  
  /**
   * Obtém o label amigável para o tipo de relacionamento
   * @param documentType - Tipo do documento
   * @returns Label em português para exibição na interface
   */
  static getRelationshipLabel(documentType: string): string {
    const relationshipType = this.calculateRelationshipType(documentType);
    
    return relationshipType === 'CLIENT' ? 'Cliente' : 'Fornecedor';
  }
  
  /**
   * Obtém a descrição da operação baseada no tipo de documento
   * @param documentType - Tipo do documento
   * @returns Descrição da operação
   */
  static getOperationDescription(documentType: string): string {
    const relationshipType = this.calculateRelationshipType(documentType);
    
    if (relationshipType === 'CLIENT') {
      return 'Recebimento (empresa paga para nós)';
    } else {
      return 'Pagamento (nós pagamos para empresa)';
    }
  }
}