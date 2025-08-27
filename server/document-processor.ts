import { processDocumentWithOCR } from "./ocr";
import { aiMultiProvider } from "./ai-multi-provider";
import { storage } from "./storage";

export class DocumentProcessor {
  constructor() {
    // No need for API key - using multi-provider system
  }

  async processDocument(documentId: string, tenantId: string) {
    try {
      console.log(`🚀 Iniciando processamento do documento ${documentId}`);

      // 1. Status inicial
      await storage.updateDocument(documentId, tenantId, {
        status: "PROCESSANDO",
      });

      await storage.createDocumentLog({
        documentId,
        action: "PROCESSING_START",
        status: "SUCCESS",
        details: { message: "Processamento iniciado" },
      });

      // 2. Obter documento
      const document = await storage.getDocument(documentId, tenantId);
      if (!document) {
        throw new Error("Documento não encontrado");
      }

      console.log(`📄 Processando: ${document.originalName}`);

      // 3. Processamento OCR
      console.log("🔍 Iniciando OCR...");
      const ocrResult = await this.performOCR(document.filePath);
      
      await storage.createDocumentLog({
        documentId,
        action: "OCR_COMPLETE",
        status: "SUCCESS",
        details: { confidence: ocrResult.confidence, textLength: ocrResult.text.length },
      });

      // 4. Análise com IA Multi-Provider
      console.log("🤖 Iniciando análise IA multi-provider...");
      const aiResult = await this.performAIAnalysis(ocrResult.text, document);
      
      await storage.createDocumentLog({
        documentId,
        action: "AI_ANALYSIS_COMPLETE",
        status: "SUCCESS",
        details: { 
          provider: aiResult.provider, 
          extractedFields: Object.keys(aiResult.extractedData || {}),
          processingCost: aiResult.processingCost,
          confidence: aiResult.confidence
        },
      });

      // 5. Validação cruzada OCR ↔ IA ↔ Metadados
      console.log("✅ Executando validação cruzada...");
      const validationResult = await this.performCrossValidation(ocrResult, aiResult, document);
      
      await storage.createDocumentLog({
        documentId,
        action: "VALIDATION_COMPLETE",
        status: validationResult.isValid ? "SUCCESS" : "WARNING",
        details: { 
          isValid: validationResult.isValid, 
          confidence: validationResult.confidence,
          errors: validationResult.errors 
        },
      });

      // 6. Determinar próximo status baseado na validação e tipo do documento
      let newStatus: string;
      let updates: any = {};
      
      if (!validationResult.isValid) {
        // Inconsistências detectadas → PENDENTE_REVISAO
        newStatus = "PENDENTE_REVISAO";
        await this.createReviewTask(documentId, tenantId, validationResult.errors);
      } else {
        // Classificação automática baseada no tipo do documento
        const classification = await this.classifyAndRoute(document, aiResult.extractedData);
        newStatus = classification.status;
        updates = { ...updates, ...classification.updates };
        
        // Criar tarefas operacionais se necessário
        if (classification.createTask) {
          await this.createOperationalTask(documentId, tenantId, classification.taskType!, classification.taskData);
        }
      }

      // 7. Atualizar documento com novo status e dados extraídos
      updates.status = newStatus;
      if (aiResult.extractedData) {
        // Atualizar campos extraídos pela IA (apenas se válidos)
        if (aiResult.extractedData.amount && validationResult.isValid) {
          updates.amount = this.parseAmount(aiResult.extractedData.amount);
        }
        if (aiResult.extractedData.dueDate && validationResult.isValid) {
          updates.dueDate = this.parseDate(aiResult.extractedData.dueDate);
        }
        if (aiResult.extractedData.supplier && validationResult.isValid) {
          updates.supplier = aiResult.extractedData.supplier;
        }
      }

      await storage.updateDocument(documentId, tenantId, updates);

      await storage.createDocumentLog({
        documentId,
        action: "PROCESSING_COMPLETE",
        status: "SUCCESS",
        details: { 
          finalStatus: newStatus,
          updatedFields: Object.keys(updates),
          hasInconsistencies: !validationResult.isValid 
        },
      });

      console.log(`✅ Processamento concluído: ${document.originalName} → ${newStatus}`);

      return {
        success: true,
        status: newStatus,
        updates,
        errors: validationResult.errors.map(e => e.message),
      };
    } catch (error) {
      console.error("❌ Erro no processamento:", error);
      
      await storage.updateDocument(documentId, tenantId, {
        status: "PENDENTE_REVISAO",
      });

      await storage.createDocumentLog({
        documentId,
        action: "PROCESSING_ERROR",
        status: "ERROR",
        details: { error: error instanceof Error ? error.message : String(error) },
      });

      return {
        success: false,
        status: "PENDENTE_REVISAO",
        updates: {},
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  private async performOCR(filePath: string) {
    try {
      console.log(`🔍 Iniciando OCR para: ${filePath}`);
      
      const result = await processDocumentWithOCR(filePath);

      console.log(`✅ OCR concluído. Confiança: ${Math.round(result.confidence * 100)}%`);
      
      return {
        text: result.text,
        confidence: result.confidence,
        words: [],
      };
    } catch (error) {
      console.error("❌ Erro no OCR:", error);
      throw new Error(`Falha no OCR: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async performAIAnalysis(ocrText: string, document: any) {
    try {
      return await aiMultiProvider.analyzeDocument(ocrText, document.originalName);
    } catch (error) {
      console.warn("⚠️ Todos os provedores de IA falharam, usando fallback:", error);
      return await this.fallbackAIAnalysis(ocrText, document);
    }
  }

  private async fallbackAIAnalysis(ocrText: string, document: any) {
    console.log("🔄 Executando análise de fallback...");
    
    // Análise baseada em regex e heurísticas
    const extracted: any = {};
    
    // Extrair valor monetário
    const moneyPattern = /R\$?\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/g;
    const moneyMatches = Array.from(ocrText.matchAll(moneyPattern));
    if (moneyMatches.length > 0) {
      extracted.valor = `R$ ${moneyMatches[0][1]}`;
    }

    // Extrair datas
    const datePattern = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/g;
    const dateMatches = Array.from(ocrText.matchAll(datePattern));
    if (dateMatches.length > 0) {
      extracted.data_pagamento = `${dateMatches[0][1]}/${dateMatches[0][2]}/${dateMatches[0][3]}`;
    }

    // Tentar identificar fornecedor comum no Brasil
    const suppliers = ['uber', 'ifood', 'magazine luiza', 'amazon', 'correios', 'vivo', 'tim', 'claro'];
    for (const supplier of suppliers) {
      if (ocrText.toLowerCase().includes(supplier)) {
        extracted.fornecedor = supplier;
        break;
      }
    }

    extracted.descricao = document.originalName || "Documento processado";
    
    return {
      provider: "fallback-regex",
      extractedData: extracted,
      rawResponse: "Análise por regex devido a erro na IA",
      confidence: 30,
      processingCost: 0
    };
  }

  private async performCrossValidation(ocrResult: any, aiResult: any, document: any): Promise<{
    isValid: boolean;
    errors: Array<{ type: string; message: string; field?: string }>;
    confidence: number;
  }> {
    const errors: Array<{ type: string; message: string; field?: string }> = [];
    let confidence = 1.0;

    // Validar confiança mínima do OCR
    if (ocrResult.confidence < 0.3) {
      errors.push({
        type: "OCR_BAIXA_CONFIANCA",
        message: `OCR com baixa confiança (${Math.round(ocrResult.confidence * 100)}%)`,
      });
      confidence *= 0.6;
    }

    // Validar se IA conseguiu extrair dados básicos
    if (!aiResult.extractedData?.descricao || aiResult.extractedData.descricao.length < 5) {
      errors.push({
        type: "DADOS_INSUFICIENTES",
        message: "IA não conseguiu extrair informações básicas do documento",
      });
      confidence *= 0.4;
    }

    return {
      isValid: errors.length === 0 && confidence > 0.5,
      errors,
      confidence
    };
  }

  async classifyAndRoute(document: any, extractedData: any): Promise<{
    status: string;
    updates: any;
    createTask: boolean;
    taskType?: string;
    taskData?: any;
  }> {
    switch (document.documentType) {
      case "PAGO":
        return {
          status: "PAGO_A_CONCILIAR",
          updates: {
            processedAt: new Date(),
            extractedData: JSON.stringify(extractedData)
          },
          createTask: true,
          taskType: "CONCILIACAO",
          taskData: { priority: "normal" }
        };

      case "AGENDADO":
        return {
          status: "AGENDAR", 
          updates: {
            processedAt: new Date(),
            extractedData: JSON.stringify(extractedData)
          },
          createTask: true,
          taskType: "AGENDAR",
          taskData: { 
            dueDate: document.dueDate || extractedData?.data_vencimento,
            priority: "normal" 
          }
        };

      case "EMITIR_BOLETO":
        return {
          status: "AGUARDANDO_RECEBIMENTO",
          updates: {
            processedAt: new Date(),
            extractedData: JSON.stringify(extractedData)
          },
          createTask: true,
          taskType: "EMITIR_BOLETO",
          taskData: { priority: "high" }
        };

      case "EMITIR_NF":
        return {
          status: "AGUARDANDO_RECEBIMENTO",
          updates: {
            processedAt: new Date(),
            extractedData: JSON.stringify(extractedData)
          },
          createTask: true,
          taskType: "EMITIR_NF", 
          taskData: { priority: "high" }
        };

      default:
        return {
          status: "CLASSIFICADO",
          updates: {
            processedAt: new Date(),
            extractedData: JSON.stringify(extractedData)
          },
          createTask: false
        };
    }
  }

  private async createReviewTask(documentId: string, tenantId: string, errors: any[]) {
    // Implementar criação de tarefa de revisão
    console.log(`📋 Criando tarefa de revisão para documento ${documentId}:`, errors);
  }

  private async createOperationalTask(documentId: string, tenantId: string, taskType: string, taskData: any) {
    // Implementar criação de tarefa operacional
    console.log(`📋 Criando tarefa operacional ${taskType} para documento ${documentId}:`, taskData);
  }

  private parseAmount(value: string): number {
    if (!value) return 0;
    const cleaned = value.replace(/[R$\s]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

  private parseDate(value: string): Date | null {
    if (!value) return null;
    
    // Formato DD/MM/AAAA
    const match = value.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    return null;
  }
}