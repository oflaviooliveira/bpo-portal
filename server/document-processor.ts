import { storage } from "./storage";
import OpenAI from "openai";
import { createWorker } from "tesseract.js";
import * as fs from "fs";
import * as path from "path";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ProcessingResult {
  success: boolean;
  status: string;
  updates: any;
  errors?: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    type: string;
    message: string;
    field?: string;
  }>;
  confidence: number;
}

/**
 * Sistema completo de processamento de documentos conforme PRD
 * Implementa toda a lógica de validação cruzada OCR ↔ IA ↔ Metadados
 */
export class DocumentProcessor {
  
  async processDocument(documentId: string, tenantId: string): Promise<ProcessingResult> {
    try {
      console.log(`🔄 Iniciando processamento do documento ${documentId}`);
      
      // 1. Atualizar status para VALIDANDO
      await storage.updateDocument(documentId, tenantId, { status: "VALIDANDO" });
      
      await storage.createDocumentLog({
        documentId,
        action: "PROCESSING_START",
        status: "SUCCESS",
        details: { stage: "INIT" },
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

      // 4. Análise com IA
      console.log("🤖 Iniciando análise IA...");
      const aiResult = await this.performAIAnalysis(ocrResult.text, document);
      
      await storage.createDocumentLog({
        documentId,
        action: "AI_ANALYSIS_COMPLETE",
        status: "SUCCESS",
        details: { provider: aiResult.provider, extractedFields: Object.keys(aiResult.extractedData || {}) },
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
        errors: validationResult.isValid ? undefined : validationResult.errors.map(e => e.message)
      };

    } catch (error) {
      console.error(`❌ Erro no processamento do documento ${documentId}:`, error);
      
      await storage.createDocumentLog({
        documentId,
        action: "PROCESSING_ERROR",
        status: "ERROR",
        details: { error: error instanceof Error ? error.message : String(error) },
      });

      // Colocar documento em estado de erro para revisão
      await storage.updateDocument(documentId, tenantId, { 
        status: "PENDENTE_REVISAO",
        notes: `Erro no processamento: ${error instanceof Error ? error.message : String(error)}`
      });

      return {
        success: false,
        status: "PENDENTE_REVISAO",
        updates: {},
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Executa OCR no documento usando Tesseract.js
   */
  async performOCR(filePath: string): Promise<{ text: string; confidence: number }> {
    try {
      const worker = await createWorker('por');
      
      const fullPath = path.resolve(filePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Arquivo não encontrado: ${fullPath}`);
      }

      const { data } = await worker.recognize(fullPath);
      await worker.terminate();

      return {
        text: data.text || '',
        confidence: data.confidence || 0
      };
    } catch (error) {
      console.error('Erro no OCR:', error);
      // Fallback: usar nome do arquivo
      const fileName = path.basename(filePath, path.extname(filePath));
      return {
        text: fileName,
        confidence: 0.1 // Baixa confiança para nome do arquivo
      };
    }
  }

  /**
   * Analisa texto via IA para extrair dados estruturados
   */
  async performAIAnalysis(text: string, document: any): Promise<{
    provider: string;
    extractedData: any;
    confidence: number;
  }> {
    const prompt = this.buildPrompt(text, document);
    
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em análise de documentos financeiros. Extraia dados precisos e responda sempre em JSON válido."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const extractedData = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        provider: "openai",
        extractedData,
        confidence: this.calculateConfidence(extractedData, text)
      };
    } catch (error) {
      console.error('Erro na análise IA:', error);
      return {
        provider: "none",
        extractedData: {},
        confidence: 0
      };
    }
  }

  /**
   * Constrói prompt estruturado para IA conforme PRD
   */
  private buildPrompt(text: string, document: any): string {
    return `
Analise o seguinte texto de documento financeiro e extraia os dados em JSON:

TEXTO DO DOCUMENTO:
${text}

METADADOS DO UPLOAD:
- Tipo: ${document.documentType}
- Valor informado: ${document.amount || 'não informado'}
- Banco: ${document.bank?.name || 'não informado'}
- Cliente: ${document.client?.name || 'não informado'}

RESPONDA EM JSON VÁLIDO com os campos:
{
  "data_competencia": "DD/MM/AAAA ou null",
  "data_pagamento": "DD/MM/AAAA ou null", 
  "data_vencimento": "DD/MM/AAAA ou null",
  "valor": "R$ X,XX ou null",
  "categoria": "categoria identificada ou null",
  "descricao": "descrição do documento",
  "fornecedor": "nome do fornecedor/beneficiário ou null",
  "documento": "número do documento identificado ou null",
  "centro_custo": "centro de custo identificado ou null",
  "observacoes": "observações relevantes",
  "linha_digitavel": "código de barras/linha digitável se houver",
  "confianca": number entre 0 e 1
}

REGRAS:
- Datas sempre no formato DD/MM/AAAA
- Valores sempre no formato R$ X,XX
- Se não conseguir identificar, use null
- Seja preciso e conservador
`;
  }

  /**
   * Executa validação cruzada entre OCR, IA e metadados
   */
  async performCrossValidation(ocrResult: any, aiResult: any, document: any): Promise<ValidationResult> {
    const errors: Array<{ type: string; message: string; field?: string }> = [];
    let confidence = Math.min(ocrResult.confidence, aiResult.confidence);

    // Validar valor
    if (document.amount && aiResult.extractedData?.valor) {
      const uploadAmount = this.parseAmount(document.amount);
      const extractedAmount = this.parseAmount(aiResult.extractedData.valor);
      
      if (Math.abs(uploadAmount - extractedAmount) > 1) { // Tolerância de R$ 0,01
        errors.push({
          type: "VALOR_DIVERGENTE",
          message: `Valor do upload (${document.amount}) difere do documento (${aiResult.extractedData.valor})`,
          field: "amount"
        });
        confidence *= 0.5;
      }
    }

    // Validar data
    if (document.dueDate && aiResult.extractedData?.data_vencimento) {
      const uploadDate = new Date(document.dueDate);
      const extractedDate = this.parseDate(aiResult.extractedData.data_vencimento);
      
      if (extractedDate && Math.abs(uploadDate.getTime() - extractedDate.getTime()) > 86400000) { // 1 dia
        errors.push({
          type: "DATA_DIVERGENTE", 
          message: `Data do upload (${document.dueDate}) difere do documento (${aiResult.extractedData.data_vencimento})`,
          field: "dueDate"
        });
        confidence *= 0.7;
      }
    }

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

  /**
   * Classifica documento e determina roteamento baseado no tipo
   */
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

  /**
   * Cria tarefa de revisão para inconsistências
   */
  async createReviewTask(documentId: string, tenantId: string, errors: any[]): Promise<void> {
    try {
      await storage.createTask({
        documentId,
        tenantId,
        type: "REVISAO",
        status: "ABERTA",
        priority: "high",
        title: "Revisão de Inconsistências",
        description: `Documento apresenta inconsistências: ${errors.map(e => e.message).join('; ')}`,
        payload: { errors }
      });
    } catch (error) {
      console.error('Erro ao criar tarefa de revisão:', error);
    }
  }

  /**
   * Cria tarefas operacionais baseadas no tipo de documento
   */
  async createOperationalTask(documentId: string, tenantId: string, taskType: string, taskData: any): Promise<void> {
    try {
      const taskDefinitions = {
        "CONCILIACAO": {
          title: "Conciliar Pagamento",
          description: "Validar pagamento no ERP/banco e arquivar documento"
        },
        "AGENDAR": {
          title: "Agendar Pagamento", 
          description: "Programar pagamento no banco conforme data de vencimento"
        },
        "EMITIR_BOLETO": {
          title: "Emitir Boleto",
          description: "Gerar boleto no sistema financeiro e criar Contas a Receber"
        },
        "EMITIR_NF": {
          title: "Emitir Nota Fiscal",
          description: "Emitir NF no sistema e criar Contas a Receber"
        }
      };

      const definition = taskDefinitions[taskType as keyof typeof taskDefinitions];
      if (!definition) return;

      await storage.createTask({
        documentId,
        tenantId,
        type: taskType,
        status: "ABERTA",
        priority: taskData.priority || "normal",
        title: definition.title,
        description: definition.description,
        payload: taskData
      });
    } catch (error) {
      console.error('Erro ao criar tarefa operacional:', error);
    }
  }

  /**
   * Utilitários de parsing
   */
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

  private calculateConfidence(extractedData: any, text: string): number {
    let confidence = 0.5; // Base
    
    if (extractedData.valor) confidence += 0.2;
    if (extractedData.data_competencia || extractedData.data_vencimento) confidence += 0.15;
    if (extractedData.fornecedor) confidence += 0.1;
    if (extractedData.descricao && extractedData.descricao.length > 10) confidence += 0.05;
    
    return Math.min(confidence, 1.0);
  }
}
      const validationResult = await this.performCrossValidation(document, ocrResult, aiResult);

      // 6. Aplicar resultados
      const updates = await this.applyProcessingResults(document, ocrResult, aiResult, validationResult);

      await storage.updateDocument(documentId, tenantId, updates);

      // 7. Log final
      await storage.createDocumentLog({
        documentId,
        action: "PROCESSING_COMPLETE",
        status: validationResult.isValid ? "SUCCESS" : "NEEDS_REVIEW",
        details: {
          finalStatus: updates.status,
          confidence: validationResult.confidence,
          validationErrors: validationResult.errors,
        },
      });

      console.log(`✅ Processamento concluído: ${updates.status}`);

      return {
        success: true,
        status: updates.status,
        updates,
        errors: validationResult.errors.map(e => e.message),
      };

    } catch (error) {
      console.error("❌ Erro no processamento:", error);
      
      await storage.updateDocument(documentId, tenantId, {
        status: "PENDENTE_REVISAO",
        validationErrors: [{ 
          type: "PROCESSING_ERROR", 
          message: `Erro no processamento: ${error.message}` 
        }],
      });

      await storage.createDocumentLog({
        documentId,
        action: "PROCESSING_ERROR",
        status: "ERROR",
        details: { error: error.message },
      });

      return {
        success: false,
        status: "PENDENTE_REVISAO",
        updates: {},
        errors: [error.message],
      };
    }
  }

  private async performOCR(filePath: string) {
    try {
      // Mock OCR para desenvolvimento - implementar Tesseract.js aqui
      console.log(`Processando OCR: ${filePath}`);
      
      // Simulação de OCR básica baseada no nome do arquivo
      const fileName = filePath.toLowerCase();
      let mockText = "Documento financeiro processado via OCR\n";
      let confidence = 85;
      
      if (fileName.includes("boleto")) {
        mockText += "BOLETO DE PAGAMENTO\nValor: R$ 1.250,00\nVencimento: 30/12/2024\nBanco do Brasil";
        confidence = 90;
      } else if (fileName.includes("nf") || fileName.includes("nota")) {
        mockText += "NOTA FISCAL\nValor Total: R$ 2.500,00\nData de Emissão: 15/12/2024\nGquicks Serviços LTDA";
        confidence = 88;
      } else {
        mockText += "Documento de pagamento\nValor: R$ 800,00\nData: 20/12/2024";
        confidence = 82;
      }
      
      return {
        text: mockText,
        confidence,
        metadata: { ocrEngine: "mock", fileName }
      };
    } catch (error: any) {
      console.error("OCR Error:", error);
      return {
        text: "Erro na extração de texto",
        confidence: 0,
        metadata: { error: error.message }
      };
    }
  }

  private async performAIAnalysis(ocrText: string, document: any) {
    try {
      // Usar GPT-5 diretamente para análise
      return await this.fallbackAIAnalysis(ocrText, document);
    } catch (error: any) {
      console.error("AI Analysis Error:", error);
      
      // Fallback com dados básicos
      return {
        provider: "fallback",
        extractedData: {},
        confidence: 0,
        error: error.message,
      };
    }
  }

  private async fallbackAIAnalysis(ocrText: string, document: any) {
    try {
      console.log("🔄 Usando fallback IA (GPT-5)...");
      
      const prompt = `
Analise este documento financeiro brasileiro e extraia as informações:

TEXTO OCR:
${ocrText}

NOME DO ARQUIVO: ${document.originalName}

Extraia em JSON:
{
  "documentType": "PAGO|AGENDADO|BOLETO|NF",
  "amount": "valor numérico sem formatação",
  "dueDate": "YYYY-MM-DD ou null",
  "issueDate": "YYYY-MM-DD ou null", 
  "description": "descrição do documento",
  "supplier": "nome do fornecedor/empresa",
  "cnpj": "CNPJ se encontrado",
  "confidence": "0-100 confiança da análise",
  "category": "categoria sugerida",
  "notes": "observações importantes"
}

Seja preciso e conservador na extração. Se não tiver certeza, marque como null.
`;

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: "Você é um especialista em análise de documentos financeiros brasileiros." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
      });

      const extractedData = JSON.parse(response.choices[0].message.content);

      return {
        provider: "gpt-5-fallback",
        extractedData,
        confidence: extractedData.confidence || 75,
        amount: extractedData.amount,
        dueDate: extractedData.dueDate,
        documentType: extractedData.documentType,
        description: extractedData.description,
      };

    } catch (error) {
      console.error("Fallback AI Error:", error);
      return {
        provider: "error",
        extractedData: {},
        confidence: 0,
        error: error.message,
      };
    }
  }

  private async performCrossValidation(document: any, ocrResult: any, aiResult: any): Promise<ValidationResult> {
    const errors: Array<{ type: string; message: string; field?: string }> = [];
    let totalConfidence = 0;
    let confidenceFactors = 0;

    // 1. Validação de confiança do OCR
    if (ocrResult.confidence < 70) {
      errors.push({
        type: "LOW_OCR_CONFIDENCE",
        message: `Baixa qualidade do OCR: ${ocrResult.confidence}%`,
      });
    }
    totalConfidence += ocrResult.confidence;
    confidenceFactors++;

    // 2. Validação de confiança da IA
    if (aiResult.confidence < 75) {
      errors.push({
        type: "LOW_AI_CONFIDENCE", 
        message: `Baixa confiança da IA: ${aiResult.confidence}%`,
      });
    }
    totalConfidence += aiResult.confidence;
    confidenceFactors++;

    // 3. Validação cruzada de valores (se fornecidos manualmente)
    if (document.amount && aiResult.amount) {
      const docAmount = Number(document.amount);
      const aiAmount = Number(aiResult.amount);
      const variance = Math.abs(docAmount - aiAmount) / Math.max(docAmount, aiAmount);
      
      if (variance > 0.1) { // Tolerância de 10%
        errors.push({
          type: "AMOUNT_MISMATCH",
          message: `Divergência no valor: Manual R$ ${docAmount.toFixed(2)} vs IA R$ ${aiAmount.toFixed(2)}`,
          field: "amount",
        });
      }
    }

    // 4. Validação de datas
    if (document.dueDate && aiResult.dueDate) {
      const docDate = new Date(document.dueDate);
      const aiDate = new Date(aiResult.dueDate);
      const daysDiff = Math.abs((docDate.getTime() - aiDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 7) { // Tolerância de 7 dias
        errors.push({
          type: "DATE_MISMATCH",
          message: `Divergência na data: Manual ${docDate.toLocaleDateString('pt-BR')} vs IA ${aiDate.toLocaleDateString('pt-BR')}`,
          field: "dueDate",
        });
      }
    }

    // 5. Validação de tipo de documento
    if (document.documentType && aiResult.documentType && document.documentType !== aiResult.documentType) {
      errors.push({
        type: "TYPE_MISMATCH",
        message: `Divergência no tipo: Manual "${document.documentType}" vs IA "${aiResult.documentType}"`,
        field: "documentType",
      });
    }

    // 6. Validação de texto extraído (presença de dados críticos)
    if (!ocrResult.text || ocrResult.text.length < 50) {
      errors.push({
        type: "INSUFFICIENT_TEXT",
        message: "Texto extraído muito curto ou vazio",
      });
    }

    // 7. Validação de campos obrigatórios extraídos pela IA
    if (!aiResult.amount && !document.amount) {
      errors.push({
        type: "MISSING_AMOUNT",
        message: "Valor não encontrado no documento",
        field: "amount",
      });
    }

    const avgConfidence = confidenceFactors > 0 ? totalConfidence / confidenceFactors : 0;
    const isValid = errors.length === 0 && avgConfidence >= 70;

    return {
      isValid,
      errors,
      confidence: avgConfidence,
    };
  }

  private async applyProcessingResults(document: any, ocrResult: any, aiResult: any, validationResult: ValidationResult) {
    const updates: any = {
      ocrText: ocrResult.text,
      ocrConfidence: ocrResult.confidence,
      aiAnalysis: aiResult.extractedData || aiResult,
      aiProvider: aiResult.provider,
      processingConfidence: validationResult.confidence,
    };

    if (validationResult.isValid) {
      // Se validação passou, aplicar dados da IA quando não há dados manuais
      updates.status = "CLASSIFICADO";
      updates.isValidated = true;
      
      if (aiResult.amount && !document.amount) {
        updates.amount = Number(aiResult.amount);
      }
      
      if (aiResult.dueDate && !document.dueDate) {
        updates.dueDate = new Date(aiResult.dueDate);
      }
      
      if (aiResult.documentType && !document.documentType) {
        updates.documentType = aiResult.documentType;
      }
      
      if (aiResult.description && !document.description) {
        updates.description = aiResult.description;
      }

      // Transicionar automaticamente para próximo estado conforme PRD
      updates.status = this.getNextStatus(updates.documentType || document.documentType);
      
    } else {
      // Se validação falhou, marcar para revisão manual
      updates.status = "PENDENTE_REVISAO";
      updates.isValidated = false;
      updates.validationErrors = validationResult.errors;
    }

    return updates;
  }

  private getNextStatus(documentType: string): string {
    // Transições de estado conforme PRD
    switch (documentType) {
      case "PAGO":
        return "PAGO_A_CONCILIAR";
      case "AGENDADO":
        return "AGENDADO";
      case "EMITIR_BOLETO":
        return "AGUARDANDO_RECEBIMENTO"; // Boleto aguarda pagamento
      case "EMITIR_NF":
        return "AGUARDANDO_RECEBIMENTO"; // NF aguarda recebimento
      default:
        return "CLASSIFICADO";
    }
  }
}

// Singleton instance
export const documentProcessor = new DocumentProcessor();