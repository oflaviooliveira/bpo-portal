import { processDocumentWithOCR } from "./ocr";
import { aiMultiProvider } from "./ai-multi-provider";
import { storage } from "./storage";
import { inconsistencyDetector } from "./inconsistency-detector";
import { AdvancedOcrProcessor } from "./ocr-processor-advanced";
import { PdfTextExtractor } from "./ocr/pdf-extractor";
import { DocumentAnalyzer } from "./ai/document-analyzer";
import { SmartInconsistencyManager, type DataSource } from "./ai/smart-inconsistency-manager";
import { AdaptiveOcrConfig } from "./ai/adaptive-ocr-config";

export class DocumentProcessor {
  private advancedOcrProcessor: AdvancedOcrProcessor;
  private pdfExtractor: PdfTextExtractor;
  private documentAnalyzer: DocumentAnalyzer;

  constructor() {
    // No need for API key - using multi-provider system
    this.advancedOcrProcessor = new AdvancedOcrProcessor(storage);
    this.pdfExtractor = new PdfTextExtractor();
    this.documentAnalyzer = new DocumentAnalyzer();
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

      console.log(`📄 Processando: ${document.originalName || 'Documento Virtual'}`);

      let ocrResult, aiResult, validationResult;

      // 3. Verificar se é documento virtual (boleto/NF sem arquivo físico)
      if (document.isVirtualDocument || !document.filePath || ['EMITIR_BOLETO', 'EMITIR_NF'].includes(document.documentType)) {
        console.log("📋 Documento virtual detectado - pulando OCR e IA");
        
        // Para documentos virtuais, usar dados já fornecidos
        ocrResult = {
          text: '',
          confidence: 1.0,
          strategy: 'virtual',
          strategiesAttempted: ['virtual'],
          processingTime: 0
        };

        aiResult = {
          provider: 'VIRTUAL',
          documentType: document.documentType,
          confidence: 100,
          extractedData: {} // Dados já estão nos campos diretos
        };

        validationResult = {
          isValid: true,
          errors: [],
          confidence: 1.0
        };

        await storage.createDocumentLog({
          documentId,
          action: "VIRTUAL_DOCUMENT_PROCESSED",
          status: "SUCCESS",
          details: { message: "Documento virtual processado diretamente" },
        });
      } else {
        // Processamento normal para documentos físicos
        console.log("🔍 Iniciando OCR melhorado com extração de PDF...");
        ocrResult = await this.performEnhancedOCR(document.filePath!, document.originalName!, documentId, tenantId);
        
        await storage.createDocumentLog({
          documentId,
          action: "OCR_COMPLETE",
          status: "SUCCESS",
          details: { 
            strategy: ocrResult.strategy,
            confidence: ocrResult.confidence, 
            textLength: ocrResult.text.length,
            strategiesAttempted: ocrResult.strategiesAttempted,
            processingTime: ocrResult.processingTime
          },
        });

        // 4. Análise com IA Melhorada
        console.log("🤖 Iniciando análise IA melhorada...");
        aiResult = await this.performEnhancedAIAnalysis(ocrResult.text, document.originalName!, documentId, tenantId);
        
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
        validationResult = await this.performCrossValidation(ocrResult, aiResult, document);
      }
      
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

  // Método OCR Melhorado com PDF Extraction
  private async performEnhancedOCR(filePath: string, filename: string, documentId: string, tenantId: string) {
    try {
      console.log(`🚀 Iniciando OCR melhorado para: ${filename}`);
      
      // Primeiro tentar extração de PDF melhorada
      if (filename.toLowerCase().endsWith('.pdf')) {
        console.log(`📄 Detectado PDF, usando extrator otimizado...`);
        const pdfResult = await this.pdfExtractor.extractText(filePath);
        
        if (pdfResult.success && pdfResult.text && pdfResult.text.length > 20) {
          console.log(`✅ PDF extraction bem-sucedida: ${pdfResult.method}, confiança: ${pdfResult.confidence}%`);
          
          // Salvar métricas OCR
          await storage.createOcrMetrics({
            documentId,
            tenantId,
            strategyUsed: pdfResult.method,
            success: true,
            processingTimeMs: 0, // TODO: medir tempo
            characterCount: pdfResult.text.length,
            confidence: pdfResult.confidence,
            fallbackLevel: 0,
            metadata: { method: pdfResult.method }
          });
          
          return {
            text: pdfResult.text,
            confidence: pdfResult.confidence / 100,
            strategy: pdfResult.method,
            strategiesAttempted: 1,
            processingTime: 0
          };
        }
      }
      
      // Fallback para OCR avançado se PDF extraction falhar
      console.log(`📷 Usando OCR avançado como fallback...`);
      const result = await this.advancedOcrProcessor.processDocument(filePath, documentId, tenantId);

      console.log(`✅ OCR avançado concluído. Estratégia: ${result.strategy}, Confiança: ${result.confidence}%`);
      
      return {
        text: result.text,
        confidence: result.confidence / 100, // Normalizar para 0-1
        strategy: result.strategy,
        strategiesAttempted: result.strategiesAttempted,
        processingTime: result.processingTime,
      };
    } catch (error) {
      console.error("❌ Erro no OCR melhorado:", error);
      throw new Error(`Falha no OCR melhorado: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Método OCR avançado original (mantido para compatibilidade)
  private async performAdvancedOCR(filePath: string, documentId: string, tenantId: string) {
    try {
      console.log(`🚀 Iniciando OCR avançado com fallbacks para: ${filePath}`);
      
      const result = await this.advancedOcrProcessor.processDocument(filePath, documentId, tenantId);

      console.log(`✅ OCR avançado concluído. Estratégia: ${result.strategy}, Confiança: ${result.confidence}%`);
      
      return {
        text: result.text,
        confidence: result.confidence / 100, // Normalizar para 0-1
        strategy: result.strategy,
        strategiesAttempted: result.strategiesAttempted,
        processingTime: result.processingTime,
        metadata: result.metadata
      };
    } catch (error) {
      console.error("❌ Erro no OCR:", error);
      throw new Error(`Falha no OCR: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Método de análise IA melhorado
  private async performEnhancedAIAnalysis(ocrText: string, filename: string, documentId: string, tenantId: string) {
    try {
      console.log(`🤖 Iniciando análise IA melhorada para: ${filename}`);
      
      // Usar o novo analisador de documentos melhorado com AI Multi-Provider
      const result = await this.documentAnalyzer.analyzeDocument(ocrText, filename, documentId, tenantId);
      
      if (result.success && result.extractedData) {
        console.log(`✅ Análise IA bem-sucedida. Confiança: ${result.confidence}%`);
        
        // Validar dados extraídos
        const validation = this.documentAnalyzer.validateExtractedData(result.extractedData);
        if (!validation.isValid) {
          console.warn(`⚠️ Dados extraídos com problemas: ${validation.errors.join(', ')}`);
        }
        
        // Salvar métricas de IA (comentado até implementação do método)
        /*
        await storage.createAiMetrics({
          documentId,
          tenantId,
          provider: 'gpt-4o-mini',
          model: 'gpt-4o-mini',
          success: true,
          processingTimeMs: 0, // TODO: medir tempo
          tokensUsed: 0, // TODO: contar tokens
          cost: 0.001, // Estimativa
          confidence: result.confidence,
          extractedFields: Object.keys(result.extractedData),
          metadata: { reasoning: result.reasoning }
        });
        */
        
        return {
          provider: 'gpt-4o-mini-enhanced',
          extractedData: result.extractedData,
          rawResponse: result.reasoning || '',
          confidence: result.confidence,
          processingCost: 0.001
        };
      } else {
        // Fallback para análise multi-provider original
        console.log(`🔄 Usando análise multi-provider como fallback...`);
        return await this.performAIAnalysis(ocrText, { originalName: filename, id: documentId, tenantId });
      }
    } catch (error) {
      console.error("❌ Erro na análise IA melhorada:", error);
      // Fallback para análise multi-provider original
      console.log(`🔄 Usando análise multi-provider como fallback após erro...`);
      return await this.performAIAnalysis(ocrText, { originalName: filename, id: documentId, tenantId });
    }
  }

  private async performAIAnalysis(ocrText: string, document: any) {
    try {
      return await aiMultiProvider.analyzeDocument(ocrText, document.originalName, document.id, document.tenantId);
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
    console.log("🧠 Executando validação cruzada inteligente...");
    
    // Usar o detector de inconsistências avançado
    const validationResult = await inconsistencyDetector.detectInconsistencies(
      document.id, 
      ocrResult, 
      aiResult, 
      document
    );

    // Usar o sistema inteligente de gestão de inconsistências para cada campo
    const smartInconsistencyManager = new SmartInconsistencyManager();
    const intelligentErrors: Array<{ type: string; message: string; field?: string; smartRecommendation?: any }> = [];

    // Analisar campos críticos com recomendações inteligentes
    const criticalFields = ['amount', 'supplier', 'description', 'dueDate'];
    
    for (const fieldName of criticalFields) {
      const dataSources: DataSource[] = [];
      
      // OCR source
      if (ocrResult.extractedData && ocrResult.extractedData[fieldName]) {
        dataSources.push({
          value: ocrResult.extractedData[fieldName],
          confidence: ocrResult.confidence * 100,
          source: 'OCR',
          quality: SmartInconsistencyManager.calculateQuality(ocrResult.confidence * 100, 'OCR')
        });
      }
      
      // AI source
      if (aiResult.extractedData && aiResult.extractedData[fieldName]) {
        dataSources.push({
          value: aiResult.extractedData[fieldName],
          confidence: aiResult.confidence,
          source: 'AI',
          quality: SmartInconsistencyManager.calculateQuality(aiResult.confidence, 'AI')
        });
      }

      // Filename source (se relevante)
      if (fieldName === 'supplier' && document.originalName) {
        const filenameValue = this.extractFromFilename(document.originalName, fieldName);
        if (filenameValue) {
          dataSources.push({
            value: filenameValue,
            confidence: 60,
            source: 'FILENAME',
            quality: 'MEDIUM'
          });
        }
      }

      // Se há múltiplas fontes para este campo, usar o sistema inteligente
      if (dataSources.length > 1) {
        const recommendation = smartInconsistencyManager.analyzeField(fieldName, dataSources);
        
        if (recommendation.action === 'MANUAL_REQUIRED') {
          intelligentErrors.push({
            type: `INCONSISTENCIA_${fieldName.toUpperCase()}`,
            message: `${recommendation.reasoning} - Recomendado: ${recommendation.recommendedValue}`,
            field: fieldName,
            smartRecommendation: recommendation
          });
        } else if (recommendation.action === 'SUGGEST_REVIEW' && recommendation.confidence < 75) {
          intelligentErrors.push({
            type: `REVISAO_${fieldName.toUpperCase()}`,
            message: `Sugestão: ${recommendation.reasoning} - Valor recomendado: ${recommendation.recommendedValue}`,
            field: fieldName,
            smartRecommendation: recommendation
          });
        }
      }
    }

    // Converter formato de resposta para manter compatibilidade com errors originais
    const originalErrors = validationResult.errors.map(error => ({
      type: `INCONSISTENCIA_${error.field.toUpperCase()}`,
      message: `Inconsistência detectada em ${error.field}: OCR="${error.ocrValue || 'N/A'}", IA="${error.formValue || 'N/A'}"`,
      field: error.field
    }));

    // Combinar errors originais com análise inteligente (priorizar inteligente)
    const allErrors = [...intelligentErrors, ...originalErrors.filter(
      original => !intelligentErrors.some(intelligent => intelligent.field === original.field)
    )];

    // Adicionar validações adicionais
    if (ocrResult.confidence < 0.3) {
      allErrors.push({
        type: "OCR_BAIXA_CONFIANCA",
        message: `OCR com baixa confiança (${Math.round(ocrResult.confidence * 100)}%) - Considere melhorar qualidade da imagem`,
        field: "ocr_confidence"
      });
    }

    if (!aiResult.extractedData?.descricao || aiResult.extractedData.descricao.length < 5) {
      allErrors.push({
        type: "DADOS_INSUFICIENTES",
        message: "IA não conseguiu extrair informações básicas do documento - Pode indicar documento ilegível",
        field: "description"
      });
    }

    console.log(`🧠 Análise inteligente concluída: ${intelligentErrors.length} inconsistências inteligentes, ${allErrors.length} total`);

    return {
      isValid: allErrors.length === 0 || allErrors.every(e => e.type.startsWith('REVISAO_')),
      errors: allErrors,
      confidence: Math.min(validationResult.confidence / 100, ocrResult.confidence)
    };
  }

  private extractFromFilename(filename: string, fieldName: string): string | null {
    const lowerFilename = filename.toLowerCase();
    
    switch (fieldName) {
      case 'supplier':
        const suppliers = ['uber', 'ifood', 'amazon', 'correios', 'magazine luiza', 'petrobras', 'shell'];
        const foundSupplier = suppliers.find(s => lowerFilename.includes(s));
        return foundSupplier ? foundSupplier.toUpperCase() : null;
      
      case 'amount':
        const amountMatch = filename.match(/R?\$?\s?(\d+[.,]\d{2})/);
        return amountMatch ? amountMatch[1] : null;
        
      default:
        return null;
    }
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
            extractedData: extractedData // Salvar como JSONB direto
          },
          createTask: true,
          taskType: "CONCILIACAO",
          taskData: { priority: "normal" }
        };

      case "AGENDADO":
        return {
          status: "AGENDADO", 
          updates: {
            processedAt: new Date(),
            extractedData: extractedData // Salvar como JSONB direto
          },
          createTask: true,
          taskType: "AGENDAMENTO",
          taskData: { 
            dueDate: document.dueDate || extractedData?.data_vencimento,
            priority: "normal" 
          }
        };

      case "EMITIR_BOLETO":
        return {
          status: "PENDENTE_EMISSAO",
          updates: {
            processedAt: new Date(),
            extractedData: extractedData // Salvar como JSONB direto
          },
          createTask: true,
          taskType: "EMITIR_BOLETO",
          taskData: { priority: "high" }
        };

      case "EMITIR_NF":
        return {
          status: "PENDENTE_EMISSAO",
          updates: {
            processedAt: new Date(),
            extractedData: extractedData // Salvar como JSONB direto
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
            extractedData: extractedData // Salvar como JSONB direto
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
    // Ordem correta: Remove R$/espaços → Remove pontos de milhares → Converte vírgula decimal
    const cleaned = value.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
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

export const documentProcessor = new DocumentProcessor();

// Função para processamento síncrono
export async function processDocumentSync(documentId: string, tenantId: string) {
  return await documentProcessor.processDocument(documentId, tenantId);
}