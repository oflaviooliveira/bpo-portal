// Wave 1 - Status Transitions Service
import { storage } from "./storage";
import { DocumentStatus, DocumentType, BusinessFlows, AutoTransitions } from "@shared/types";

export class StatusTransitionService {
  
  // Verificar se transição é válida conforme fluxo de negócio
  static isValidTransition(
    documentType: DocumentType, 
    fromStatus: DocumentStatus, 
    toStatus: DocumentStatus
  ): boolean {
    const allowedFlow = BusinessFlows[documentType];
    const fromIndex = allowedFlow.indexOf(fromStatus);
    const toIndex = allowedFlow.indexOf(toStatus);
    
    // Pode avançar no fluxo ou voltar um passo (para correções)
    return toIndex >= fromIndex - 1 && toIndex <= fromIndex + 1;
  }

  // Executar transições automáticas por data
  static async executeAutoTransitions(): Promise<void> {
    console.log("🔄 Executando transições automáticas...");
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    try {
      // Get all tenants and process their documents
      // For now, we'll process all documents since we need tenantId
      // TODO: Implement tenant iteration or global processing
      console.log("⚠️ Auto-transitions temporarily disabled - need tenant-specific processing");
      return;

      // This code will be enabled when tenant iteration is implemented
      /*
      for (const doc of agendadosVencendo) {
        if (doc.dueDate && doc.dueDate <= today) {
          await storage.updateDocument(doc.id, doc.tenantId, {
            status: "A_PAGAR_HOJE"
          });

          await storage.createDocumentLog({
            documentId: doc.id,
            action: "AUTO_TRANSITION",
            status: "SUCCESS",
            details: {
              from: "AGENDADO",
              to: "A_PAGAR_HOJE",
              reason: "due_date_reached",
              dueDate: doc.dueDate
            }
          });

          console.log(`✅ Auto-transição: ${doc.id} AGENDADO → A_PAGAR_HOJE`);
        }
      }

      console.log(`🎯 Processadas ${agendadosVencendo.length} transições automáticas`);
      */
      
    } catch (error) {
      console.error("❌ Erro nas transições automáticas:", error);
    }
  }

  // Transição manual com validação
  static async transitionDocument(
    documentId: string, 
    tenantId: string, 
    newStatus: DocumentStatus, 
    userId: string,
    reason?: string
  ): Promise<boolean> {
    try {
      const document = await storage.getDocument(documentId, tenantId);
      if (!document) {
        throw new Error("Documento não encontrado");
      }

      const isValid = this.isValidTransition(
        document.documentType as DocumentType, 
        document.status as DocumentStatus, 
        newStatus
      );

      if (!isValid) {
        throw new Error(`Transição inválida: ${document.status} → ${newStatus} para tipo ${document.documentType}`);
      }

      await storage.updateDocument(documentId, tenantId, { status: newStatus });

      await storage.createDocumentLog({
        documentId,
        action: "STATUS_TRANSITION",
        status: "SUCCESS",
        details: {
          from: document.status,
          to: newStatus,
          reason: reason || "manual_transition",
          documentType: document.documentType
        },
        userId
      });

      console.log(`✅ Transição manual: ${documentId} ${document.status} → ${newStatus}`);
      return true;

    } catch (error) {
      console.error(`❌ Erro na transição de ${documentId}:`, error);
      return false;
    }
  }

  // Obter próximos estados válidos para um documento
  static getValidNextStates(documentType: DocumentType, currentStatus: DocumentStatus): DocumentStatus[] {
    const flow = BusinessFlows[documentType];
    const currentIndex = flow.indexOf(currentStatus);
    
    if (currentIndex === -1) return [];
    
    const validNext: DocumentStatus[] = [];
    
    // Pode avançar um passo
    if (currentIndex < flow.length - 1) {
      validNext.push(flow[currentIndex + 1]);
    }
    
    // Pode voltar um passo (correção)
    if (currentIndex > 0) {
      validNext.push(flow[currentIndex - 1]);
    }
    
    return validNext;
  }
}

// Agendar execução automática das transições (executar a cada hora)
export function setupStatusTransitions() {
  console.log("📅 Configurando transições automáticas de status...");
  
  // Executar imediatamente
  StatusTransitionService.executeAutoTransitions();
  
  // Executar a cada hora
  setInterval(() => {
    StatusTransitionService.executeAutoTransitions();
  }, 60 * 60 * 1000); // 1 hora
  
  console.log("✅ Transições automáticas configuradas");
}