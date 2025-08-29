import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, isAuthenticated, requireRole, authorize } from "./auth";
import { storage } from "./storage";
import { documentProcessor } from "./document-processor";
import { StatusTransitionService, setupStatusTransitions } from "./status-transitions";
import { parseFileName } from "./validation";
import { AdvancedOcrProcessor } from "./ocr-processor-advanced";
import { 
  validateBody, 
  validateQuery, 
  documentUploadSchema, 
  documentUpdateSchema,
  listDocumentsQuerySchema,
  statusTransitionSchema 
} from "./validation/schemas";
import { createFileStorage } from "./storage/local-storage";
import { FileValidator } from "./storage/interface";
import { registerFileRoutes } from "./routes/files";
import { AIDiagnostics } from "./ai-diagnostics";

const advancedOcrProcessor = new AdvancedOcrProcessor(storage);
const fileStorage = createFileStorage();
const aiDiagnostics = AIDiagnostics.getInstance();
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { z } from "zod";

// Configure multer for file uploads com validação aprimorada
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: async (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use PDF, JPG, PNG, GIF ou WebP.'));
    }
  },
});

const uploadDocumentSchema = z.object({
  documentType: z.enum(['PAGO', 'AGENDADO', 'EMITIR_BOLETO', 'EMITIR_NF']),
  contraparteId: z.string().uuid().optional(),
  contraparteName: z.string().min(1),
  contraparteDocument: z.string().optional(),
  bankId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  costCenterId: z.string().uuid().optional(),
  amount: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  paymentDate: z.string().optional(),
  notes: z.string().optional(),
  // Campos para boleto/NF
  payerDocument: z.string().optional(),
  payerName: z.string().optional(),
  payerAddress: z.string().optional(),
  payerEmail: z.string().optional(),
  serviceCode: z.string().optional(),
  serviceDescription: z.string().optional(),
  instructions: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);
  
  // Setup file serving routes with storage interface
  registerFileRoutes(app);
  
  // Setup status transitions - Wave 1
  setupStatusTransitions();

  // Dashboard stats - Wave 1 RBAC
  app.get("/api/dashboard/stats", ...authorize(["ADMIN", "GERENTE", "OPERADOR"]), async (req, res) => {
    try {
      const user = req.user!;
      const stats = await storage.getDashboardStats(user.tenantId);
      res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Erro ao carregar estatísticas" });
    }
  });

  // Contrapartes endpoints - Nova implementação unificada
  app.get("/api/contrapartes", ...authorize(["ADMIN", "GERENTE", "OPERADOR"], true), async (req, res) => {
    try {
      const tenantId = req.user?.tenantId!;
      const filters = {
        canBeClient: req.query.canBeClient === 'true' ? true : undefined,
        canBeSupplier: req.query.canBeSupplier === 'true' ? true : undefined
      };
      
      const contrapartes = await storage.getContrapartes(tenantId, filters);
      res.json(contrapartes);
    } catch (error) {
      console.error("Get contrapartes error:", error);
      res.status(500).json({ error: "Erro ao carregar contrapartes" });
    }
  });

  app.post("/api/contrapartes", ...authorize(["ADMIN", "GERENTE"], true), async (req, res) => {
    try {
      const tenantId = req.user?.tenantId!;
      const contraparteData = { ...req.body, tenantId };
      
      const newContraparte = await storage.createContraparte(contraparteData);
      res.status(201).json(newContraparte);
    } catch (error) {
      console.error("Create contraparte error:", error);
      res.status(500).json({ error: "Erro ao criar contraparte" });
    }
  });

  // Get clients - Wave 1 RBAC (Legacy)
  app.get("/api/clients", ...authorize(["ADMIN", "GERENTE", "OPERADOR", "CLIENTE"]), async (req, res) => {
    try {
      const user = req.user!;
      
      // Cliente só vê seus próprios dados
      if (user.role === 'CLIENTE') {
        const client = await storage.getClient(user.id, user.tenantId);
        res.json(client ? [client] : []);
        return;
      }
      
      // TODO: Operador só vê clientes designados (implementar user_clients)
      const clients = await storage.getClients(user.tenantId);
      res.json(clients);
    } catch (error) {
      console.error("Get clients error:", error);
      res.status(500).json({ error: "Erro ao carregar clientes" });
    }
  });

  // Get banks
  app.get("/api/banks", isAuthenticated, async (req, res) => {
    try {
      const banks = await storage.getBanks();
      res.json(banks);
    } catch (error) {
      console.error("Get banks error:", error);
      res.status(500).json({ error: "Erro ao carregar bancos" });
    }
  });

  // Get categories
  app.get("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const categories = await storage.getCategories(user.tenantId);
      res.json(categories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Erro ao carregar categorias" });
    }
  });

  // Get cost centers
  app.get("/api/cost-centers", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const costCenters = await storage.getCostCenters(user.tenantId);
      res.json(costCenters);
    } catch (error) {
      console.error("Get cost centers error:", error);
      res.status(500).json({ error: "Erro ao carregar centros de custo" });
    }
  });

  // Get documents with filters - Wave 1 RBAC + Scoping + Validação
  app.get("/api/documents", ...authorize(["ADMIN", "GERENTE", "OPERADOR", "CLIENTE"], true), validateQuery(listDocumentsQuerySchema), async (req, res) => {
    try {
      const user = req.user!;
      const filters = {
        status: req.query.status as string,
        documentType: req.query.documentType as string,
        clientId: req.query.clientId as string,
      };
      
      // Cliente só vê seus documentos (já filtrado no middleware)
      if (user.role === 'CLIENTE') {
        filters.clientId = user.id;
      }
      
      // Remove undefined filters
      Object.keys(filters).forEach(key => 
        filters[key as keyof typeof filters] === undefined && 
        delete filters[key as keyof typeof filters]
      );

      const documents = await storage.getDocuments(user.tenantId, filters);
      res.json(documents);
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({ error: "Erro ao carregar documentos" });
    }
  });

  // Process file for OCR + AI analysis endpoint (for preview) + Validação aprimorada
  app.post("/api/documents/process-file", ...authorize(["ADMIN", "GERENTE", "OPERADOR", "CLIENTE"], true), upload.single('file'), async (req, res) => {
    try {
      const user = req.user!;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "Nenhum arquivo foi enviado" });
      }

      // Validação aprimorada do arquivo
      const fileBuffer = await fs.readFile(file.path);
      const validation = await FileValidator.validateFile(fileBuffer, file.originalname, file.mimetype);
      
      if (!validation.isValid) {
        // Limpar arquivo temporário
        await fs.unlink(file.path).catch(() => {});
        return res.status(400).json({ 
          error: "Arquivo inválido", 
          details: validation.errors 
        });
      }

      console.log(`🔍 Processando arquivo para preview: ${file.originalname}`);

      // Import processors
      const { PdfTextExtractor } = await import("./ocr/pdf-extractor");
      const { DocumentAnalyzer } = await import("./ai/document-analyzer");
      
      const pdfExtractor = new PdfTextExtractor();
      const documentAnalyzer = new DocumentAnalyzer();

      let ocrResult: any = null;
      let aiResult: any = null;

      // 1. Extrair texto OCR
      try {
        if (file.originalname.toLowerCase().endsWith('.pdf')) {
          ocrResult = await pdfExtractor.extractText(file.path);
        } else {
          // Para imagens, usar Tesseract
          const { createWorker } = await import('tesseract.js');
          const worker = await createWorker('por');
          const { data: { text, confidence } } = await worker.recognize(file.path);
          await worker.terminate();
          
          ocrResult = {
            success: true,
            text: text.trim(),
            method: 'TESSERACT_IMAGE_OCR',
            confidence: Math.round(confidence)
          };
        }
      } catch (error) {
        console.warn("⚠️ Erro no OCR:", error);
        ocrResult = {
          success: false,
          error: `Erro no OCR: ${error}`,
          method: 'FAILED',
          confidence: 0
        };
      }

      // 2. Analisar com IA se OCR foi bem-sucedido
      if (ocrResult.success && ocrResult.text && ocrResult.text.length > 10) {
        try {
          // Gerar UUID temporário válido para a análise
          const { randomUUID } = await import('crypto');
          const tempDocId = randomUUID();
          
          aiResult = await documentAnalyzer.analyzeDocument(
            ocrResult.text, 
            file.originalname,
            tempDocId,
            user.tenantId
          );
        } catch (error) {
          console.warn("⚠️ Erro na análise IA:", error);
          aiResult = {
            success: false,
            error: `Erro na IA: ${error}`,
            confidence: 0
          };
        }
      }

      // 3. Mapear dados extraídos para formato esperado pelo frontend
      let suggestions: any = {};
      if (aiResult && aiResult.success && aiResult.extractedData) {
        const data = aiResult.extractedData;
        
        console.log(`🔄 Mapeando dados IA:`, JSON.stringify(data, null, 2));
        
        suggestions = {
          amount: data.valor || '',
          supplier: data.fornecedor || '',
          contraparte: data.contraparte || data.fornecedor || '',
          documento: data.documento || '',
          description: data.descricao || '',
          dueDate: data.data_vencimento || '',
          paymentDate: data.data_pagamento || '',

          category: data.categoria || '',
          confidence: {
            amount: data.valor ? aiResult.confidence : 0,
            supplier: data.fornecedor ? aiResult.confidence : 0,
            description: data.descricao ? aiResult.confidence : 0,
            dueDate: data.data_vencimento ? aiResult.confidence : 0,
            paymentDate: data.data_pagamento ? aiResult.confidence : 0
          }
        };
        
        console.log(`✅ Sugestões mapeadas:`, JSON.stringify(suggestions, null, 2));
      } else {
        console.log(`⚠️ IA não retornou dados válidos:`, aiResult);
      }

      // 4. Retornar dados para preview
      res.json({
        success: true,
        ocrText: ocrResult?.text || '',
        ocrResult: {
          confidence: ocrResult?.confidence || 0,
          strategy: ocrResult?.method || 'UNKNOWN',
          success: ocrResult?.success || false
        },
        aiResult: {
          success: aiResult?.success || false,
          confidence: aiResult?.confidence || 0,
          reasoning: aiResult?.reasoning
        },
        aiAnalysis: aiResult?.success ? {
          provider: aiResult.provider || 'unknown',
          confidence: aiResult.confidence || 0,
          extractedData: aiResult.extractedData || {},
          processingTime: aiResult.processingTime || 0,
          processingCost: aiResult.processingCost || 0,
          rawResponse: aiResult.rawResponse
        } : null,
        suggestions
      });

    } catch (error) {
      console.error("❌ Erro no processamento do arquivo:", error);
      res.status(500).json({ 
        error: "Erro no processamento",
        success: false,
        ocrText: '',
        suggestions: {}
      });
    }
  });

  // Upload and process document - Wave 1 RBAC + Validação aprimorada
  app.post("/api/documents/upload", ...authorize(["ADMIN", "GERENTE", "OPERADOR", "CLIENTE"], true), upload.single('file'), validateBody(documentUploadSchema), async (req, res) => {
    try {
      const user = req.user!;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "Nenhum arquivo foi enviado" });
      }

      // Validação aprimorada do arquivo
      const fileBuffer = await fs.readFile(file.path);
      const validation = await FileValidator.validateFile(fileBuffer, file.originalname, file.mimetype);
      
      if (!validation.isValid) {
        // Limpar arquivo temporário
        await fs.unlink(file.path).catch(() => {});
        return res.status(400).json({ 
          error: "Arquivo inválido", 
          details: validation.errors 
        });
      }

      // Usar o handler de upload estruturado
      const { uploadHandler } = await import("./upload-handler");
      const result = await uploadHandler.processUpload(file, req.body, user);
      
      if (result.success) {
        res.json({
          message: result.message,
          documentId: result.documentId,
          warnings: result.warnings || []
        });
      } else {
        res.status(400).json({
          error: result.message,
          details: result.errors || [],
          warnings: result.warnings || []
        });
      }
    } catch (error) {
      console.error("❌ Erro no upload:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // Get document by ID
  app.get("/api/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const documentId = req.params.id;
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(documentId)) {
        return res.status(400).json({ error: "ID de documento inválido" });
      }
      
      const document = await storage.getDocument(documentId, user.tenantId);
      
      if (!document) {
        return res.status(404).json({ error: "Documento não encontrado" });
      }

      res.json(document);
    } catch (error) {
      console.error("Get document error:", error);
      res.status(500).json({ error: "Erro ao carregar documento" });
    }
  });

  // Update document - Wave 1 RBAC
  app.patch("/api/documents/:id", ...authorize(["ADMIN", "GERENTE", "OPERADOR"], true), async (req, res) => {
    try {
      const user = req.user!;
      const documentId = req.params.id;
      const updates = req.body;

      const document = await storage.updateDocument(documentId, user.tenantId, updates);

      // Log document update
      await storage.createDocumentLog({
        documentId: document.id,
        action: "UPDATE",
        status: "SUCCESS",
        details: updates,
        userId: user.id,
      });

      res.json(document);
    } catch (error) {
      console.error("Update document error:", error);
      res.status(500).json({ error: "Erro ao atualizar documento" });
    }
  });

  // Bulk delete documents - Wave 1 RBAC
  app.delete("/api/documents/bulk-delete", ...authorize(["ADMIN", "GERENTE", "OPERADOR"], true), async (req, res) => {
    try {
      const user = req.user!;
      const { documentIds } = req.body;

      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({ error: "Lista de IDs de documentos é obrigatória" });
      }

      // Validar que todos os documentos pertencem ao tenant do usuário
      const documents = await Promise.all(
        documentIds.map(id => storage.getDocument(id, user.tenantId))
      );

      const notFound = documents.some(doc => !doc);
      if (notFound) {
        return res.status(404).json({ error: "Um ou mais documentos não foram encontrados" });
      }

      // Deletar documentos em lote
      await storage.deleteDocuments(documentIds, user.tenantId);

      // Log da exclusão em lote
      await Promise.all(
        documentIds.map(documentId =>
          storage.createDocumentLog({
            documentId,
            action: "BULK_DELETE",
            status: "SUCCESS",
            details: { deletedBy: user.id, deletedAt: new Date() },
            userId: user.id,
          })
        )
      );

      res.json({ 
        success: true, 
        message: `${documentIds.length} documento(s) excluído(s) com sucesso`,
        deletedCount: documentIds.length 
      });
    } catch (error) {
      console.error("Bulk delete documents error:", error);
      res.status(500).json({ error: "Erro ao excluir documentos" });
    }
  });

  // Status transition endpoint - Wave 1 Business Logic
  app.post("/api/documents/:id/transition", ...authorize(["ADMIN", "GERENTE", "OPERADOR"]), async (req, res) => {
    try {
      const user = req.user!;
      const documentId = req.params.id;
      const { newStatus, reason } = req.body;

      const success = await StatusTransitionService.transitionDocument(
        documentId,
        user.tenantId,
        newStatus,
        user.id,
        reason
      );

      if (success) {
        const document = await storage.getDocument(documentId, user.tenantId);
        res.json({ 
          success: true, 
          document,
          message: `Status alterado para ${newStatus}` 
        });
      } else {
        res.status(400).json({ 
          error: "Transição de status inválida",
          success: false 
        });
      }
    } catch (error) {
      console.error("Status transition error:", error);
      res.status(500).json({ error: "Erro ao alterar status" });
    }
  });

  // Get valid next states for document - Wave 1
  app.get("/api/documents/:id/next-states", ...authorize(["ADMIN", "GERENTE", "OPERADOR"]), async (req, res) => {
    try {
      const user = req.user!;
      const documentId = req.params.id;
      
      const document = await storage.getDocument(documentId, user.tenantId);
      if (!document) {
        return res.status(404).json({ error: "Documento não encontrado" });
      }

      const nextStates = StatusTransitionService.getValidNextStates(
        document.documentType as any,
        document.status as any
      );

      res.json({ 
        currentStatus: document.status,
        documentType: document.documentType,
        validNextStates: nextStates 
      });
    } catch (error) {
      console.error("Get next states error:", error);
      res.status(500).json({ error: "Erro ao carregar próximos estados" });
    }
  });

  // Document download endpoint - NEW
  app.get("/api/documents/:id/download", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const documentId = req.params.id;
      
      const document = await storage.getDocument(documentId, user.tenantId);
      if (!document) {
        return res.status(404).json({ error: "Documento não encontrado" });
      }

      const filePath = document.filePath;
      if (!filePath) {
        return res.status(404).json({ error: "Arquivo não encontrado" });
      }

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: "Arquivo físico não encontrado" });
      }

      res.download(filePath, document.originalName || 'documento');
    } catch (error) {
      console.error("Document download error:", error);
      res.status(500).json({ error: "Erro ao baixar documento" });
    }
  });

  // Document preview endpoint - NEW
  app.get("/api/documents/:id/preview", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const documentId = req.params.id;
      
      const document = await storage.getDocument(documentId, user.tenantId);
      if (!document) {
        return res.status(404).json({ error: "Documento não encontrado" });
      }

      const filePath = document.filePath;
      if (!filePath) {
        return res.status(404).json({ error: "Arquivo não encontrado" });
      }

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: "Arquivo físico não encontrado" });
      }

      // Set appropriate content type
      if (document.mimeType) {
        res.setHeader('Content-Type', document.mimeType);
      }

      // For PDFs, set proper headers for inline viewing
      if (document.mimeType?.includes('pdf')) {
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Access-Control-Allow-Origin', '*');
      }

      // Stream the file with proper content handling
      const fileBuffer = await fs.readFile(filePath);
      res.end(fileBuffer);
    } catch (error) {
      console.error("Document preview error:", error);
      res.status(500).json({ error: "Erro ao visualizar documento" });
    }
  });

  // Document reprocess endpoint - NEW
  app.post("/api/documents/:id/reprocess", ...authorize(["ADMIN", "GERENTE", "OPERADOR"]), async (req, res) => {
    try {
      const user = req.user!;
      const documentId = req.params.id;
      
      const document = await storage.getDocument(documentId, user.tenantId);
      if (!document) {
        return res.status(404).json({ error: "Documento não encontrado" });
      }

      const filePath = document.filePath;
      if (!filePath) {
        return res.status(404).json({ error: "Arquivo não encontrado" });
      }

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        return res.status(404).json({ error: "Arquivo físico não encontrado" });
      }

      // Update document status to VALIDANDO
      await storage.updateDocument(documentId, user.tenantId, {
        status: 'VALIDANDO',
        ocrText: null,
        ocrConfidence: "0",
        aiAnalysis: null,
        validationErrors: []
      });

      // Log reprocessing action
      await storage.createDocumentLog({
        documentId: document.id,
        action: "REPROCESS",
        status: "STARTED",
        details: { reprocessedBy: user.id },
        userId: user.id,
      });

      // Reprocess the document using advanced OCR processor
      try {
        // Create proper file-like object for reprocessing
        const fileStats = await fs.stat(filePath);
        const mockFile = {
          path: filePath,
          filename: path.basename(filePath),
          originalname: document.originalName || path.basename(filePath),
          mimetype: document.mimeType || 'application/pdf',
          size: fileStats.size
        };

        // Process with advanced OCR
        const result = await advancedOcrProcessor.processDocument(mockFile as any, documentId, user.tenantId);
        
        if (result.success) {
          await storage.createDocumentLog({
            documentId: document.id,
            action: "REPROCESS",
            status: "SUCCESS",
            details: { 
              reprocessedBy: user.id,
              ocrConfidence: result.confidence,
              strategy: result.strategy 
            },
            userId: user.id,
          });

          const updatedDocument = await storage.getDocument(documentId, user.tenantId);
          res.json({ 
            success: true, 
            document: updatedDocument,
            message: "Documento reprocessado com sucesso" 
          });
        } else {
          await storage.createDocumentLog({
            documentId: document.id,
            action: "REPROCESS",
            status: "ERROR",
            details: { 
              reprocessedBy: user.id,
              error: "Falha no processamento OCR" 
            },
            userId: user.id,
          });

          res.status(500).json({ 
            success: false,
            error: "Erro no reprocessamento",
            details: "Falha no processamento OCR"
          });
        }
      } catch (error) {
        console.error("Reprocess error:", error);
        await storage.createDocumentLog({
          documentId: document.id,
          action: "REPROCESS",
          status: "ERROR",
          details: { 
            reprocessedBy: user.id,
            error: String(error) 
          },
          userId: user.id,
        });

        res.status(500).json({ 
          success: false,
          error: "Erro interno no reprocessamento" 
        });
      }

    } catch (error) {
      console.error("Document reprocess error:", error);
      res.status(500).json({ error: "Erro ao reprocessar documento" });
    }
  });

  // BPO Data endpoint - Salvar campos obrigatórios
  app.patch("/api/documents/:id/bpo-data", ...authorize(["ADMIN", "GERENTE", "OPERADOR"]), async (req, res) => {
    try {
      const user = req.user!;
      const documentId = req.params.id;
      const {
        competenceDate,
        dueDate,
        paidDate,
        amount,
        description,
        categoryId,
        costCenterId,
        notes,
        status,
        isReadyForBpo
      } = req.body;

      // Validar campos obrigatórios
      if (!competenceDate || !dueDate || !amount || !description || !categoryId || !costCenterId) {
        return res.status(400).json({ 
          error: "Campos obrigatórios não preenchidos",
          required: ["competenceDate", "dueDate", "amount", "description", "categoryId", "costCenterId"]
        });
      }

      // Atualizar documento com dados BPO
      const updatedDocument = await storage.updateDocument(documentId, user.tenantId, {
        competenceDate: competenceDate ? new Date(competenceDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        paidDate: paidDate ? new Date(paidDate) : null,
        amount: amount.toString(),
        description,
        categoryId,
        costCenterId,
        notes,
        status: status || 'CLASSIFICADO',
        isReadyForBpo: isReadyForBpo || true,
        validatedBy: user.id,
        validatedAt: new Date()
      });

      // Log da ação
      await storage.createDocumentLog({
        documentId,
        action: "BPO_DATA_COMPLETED",
        status: "SUCCESS",
        details: {
          completedBy: user.id,
          fieldsCompleted: ["competenceDate", "dueDate", "amount", "description", "categoryId", "costCenterId"],
          isReadyForBpo: true
        },
        userId: user.id,
      });

      res.json({ 
        success: true, 
        document: updatedDocument,
        message: "Dados BPO salvos com sucesso" 
      });
    } catch (error) {
      console.error("BPO data save error:", error);
      res.status(500).json({ error: "Erro ao salvar dados BPO" });
    }
  });

  // Categories routes - Wave 1 RBAC
  app.get("/api/categories", ...authorize(["ADMIN", "GERENTE", "OPERADOR", "CLIENTE"]), async (req, res) => {
    try {
      const user = req.user!;
      
      // Mock categories para desenvolvimento
      const mockCategories = [
        { id: "cat-1", name: "Combustível", description: "Gastos com combustível e transporte" },
        { id: "cat-2", name: "Material de Escritório", description: "Suprimentos e material de escritório" },
        { id: "cat-3", name: "Manutenção de Veículos", description: "Manutenção, pneus e serviços automotivos" },
        { id: "cat-4", name: "Hospedagem e Alimentação", description: "Hotéis, restaurantes e alimentação" },
        { id: "cat-5", name: "Serviços Terceirizados", description: "Consultoria e serviços externos" },
        { id: "cat-6", name: "Software e Licenças", description: "Assinaturas de software e licenças" },
        { id: "cat-7", name: "Marketing e Publicidade", description: "Campanhas e material promocional" },
        { id: "cat-8", name: "Telefonia e Internet", description: "Serviços de telecomunicações" }
      ];
      
      res.json(mockCategories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Erro ao carregar categorias" });
    }
  });

  app.post("/api/categories", ...authorize(["ADMIN", "GERENTE"]), async (req, res) => {
    try {
      const user = req.user!;
      const categoryData = { ...req.body, tenantId: user.tenantId };
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      console.error("Create category error:", error);
      res.status(500).json({ error: "Erro ao criar categoria" });
    }
  });

  app.patch("/api/categories/:id", ...authorize(["ADMIN", "GERENTE"]), async (req, res) => {
    try {
      const user = req.user!;
      const category = await storage.updateCategory(req.params.id, user.tenantId, req.body);
      res.json(category);
    } catch (error) {
      console.error("Update category error:", error);
      res.status(500).json({ error: "Erro ao atualizar categoria" });
    }
  });

  app.delete("/api/categories/:id", ...authorize(["ADMIN"]), async (req, res) => {
    try {
      const user = req.user!;
      await storage.deleteCategory(req.params.id, user.tenantId);
      res.status(204).send();
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({ error: "Erro ao excluir categoria" });
    }
  });

  // Cost Centers routes
  app.get("/api/cost-centers", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      
      // Mock cost centers para desenvolvimento
      const mockCostCenters = [
        { id: "cc-1", name: "Administrativo", code: "ADM", description: "Centro administrativo geral" },
        { id: "cc-2", name: "Comercial", code: "COM", description: "Área comercial e vendas" },
        { id: "cc-3", name: "Operacional", code: "OPE", description: "Operações e produção" },
        { id: "cc-4", name: "Financeiro", code: "FIN", description: "Departamento financeiro" },
        { id: "cc-5", name: "TI", code: "TEC", description: "Tecnologia da informação" },
        { id: "cc-6", name: "RH", code: "RH", description: "Recursos humanos" },
        { id: "cc-7", name: "Marketing", code: "MKT", description: "Marketing e comunicação" },
        { id: "cc-8", name: "Logística", code: "LOG", description: "Logística e transporte" }
      ];
      
      res.json(mockCostCenters);
    } catch (error) {
      console.error("Get cost centers error:", error);
      res.status(500).json({ error: "Erro ao carregar centros de custo" });
    }
  });

  app.post("/api/cost-centers", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const costCenterData = { ...req.body, tenantId: user.tenantId };
      const costCenter = await storage.createCostCenter(costCenterData);
      res.status(201).json(costCenter);
    } catch (error) {
      console.error("Create cost center error:", error);
      res.status(500).json({ error: "Erro ao criar centro de custo" });
    }
  });

  app.patch("/api/cost-centers/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const costCenter = await storage.updateCostCenter(req.params.id, user.tenantId, req.body);
      res.json(costCenter);
    } catch (error) {
      console.error("Update cost center error:", error);
      res.status(500).json({ error: "Erro ao atualizar centro de custo" });
    }
  });

  app.delete("/api/cost-centers/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      await storage.deleteCostCenter(req.params.id, user.tenantId);
      res.status(204).send();
    } catch (error) {
      console.error("Delete cost center error:", error);
      res.status(500).json({ error: "Erro ao excluir centro de custo" });
    }
  });

  // Export routes - Exportação em lote conforme PRD
  app.get("/api/documents/export", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const { format = "csv", status, clientId, bankId, startDate, endDate } = req.query;

      const filters: any = {};
      if (status) filters.status = status;
      if (clientId) filters.clientId = clientId;
      if (bankId) filters.bankId = bankId;

      const documents = await storage.getDocuments(user.tenantId, filters);

      if (format === "csv") {
        // Generate CSV export
        const csvData = documents.map(doc => ({
          id: doc.id,
          fileName: doc.originalName,
          status: doc.status,
          documentType: doc.documentType,
          amount: doc.amount || "0",
          dueDate: doc.dueDate || "",
          createdAt: doc.createdAt,
          ocrConfidence: doc.ocrConfidence || "0",
          aiProvider: doc.aiProvider || "",
        }));

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename="documentos-${Date.now()}.csv"`);
        
        const csvHeader = "ID,Nome do Arquivo,Status,Tipo,Valor,Vencimento,Data de Criação,Confiança OCR,Provider IA\n";
        const csvRows = csvData.map(row => 
          Object.values(row).map(val => `"${val}"`).join(",")
        ).join("\n");
        
        res.send(csvHeader + csvRows);
      } else {
        // Return JSON for ZIP processing on client
        res.json({ documents, count: documents.length });
      }

    } catch (error) {
      console.error("Export error:", error);
      res.status(500).json({ error: "Erro na exportação" });
    }
  });

  // Document inconsistencies endpoints - AI metrics and validation
  app.get("/api/documents/:id/inconsistencies", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const documentId = req.params.id;
      
      // Verificar se documento pertence ao tenant
      const document = await storage.getDocument(documentId, user.tenantId);
      if (!document) {
        return res.status(404).json({ error: "Documento não encontrado" });
      }

      const inconsistencies = await storage.getDocumentInconsistencies(documentId);
      res.json(inconsistencies);
    } catch (error) {
      console.error("Get inconsistencies error:", error);
      res.status(500).json({ error: "Erro ao carregar inconsistências" });
    }
  });

  app.get("/api/documents/:id/ai-runs", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const documentId = req.params.id;
      
      // Verificar se documento pertence ao tenant
      const document = await storage.getDocument(documentId, user.tenantId);
      if (!document) {
        return res.status(404).json({ error: "Documento não encontrado" });
      }

      const aiRuns = await storage.getAiRunsByDocument(documentId);
      res.json(aiRuns);
    } catch (error) {
      console.error("Get AI runs error:", error);
      res.status(500).json({ error: "Erro ao carregar métricas de IA" });
    }
  });

  // Process file for suggestions - FASE 1 da especificação
  app.post("/api/documents/process-file", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      console.log(`🔍 Processando arquivo para sugestões: ${req.file.originalname}`);

      // 1. Analisar nome do arquivo
      const filenameAnalysis = parseFileName(req.file.originalname);
      console.log("📋 Análise do nome:", filenameAnalysis);

      // 2. Executar OCR + IA  
      const ocrResult = await advancedOcrProcessor.processDocument(
        req.file.path, 
        'temp-doc-' + Date.now(), 
        req.user!.tenantId
      );

      console.log("🤖 Resultado OCR+IA:", {
        success: ocrResult.success,
        text: ocrResult.text?.substring(0, 100) + "...",
        strategy: ocrResult.strategy,
        confidence: ocrResult.confidence
      });

      // 3. Montar sugestões baseadas em OCR + filename
      const suggestions: any = {};
      const confidence: any = {};

      // Prioridade 1: Nome do arquivo
      if (filenameAnalysis.parsed) {
        if (filenameAnalysis.parsed.value) {
          const numValue = typeof filenameAnalysis.parsed.value === 'string' 
            ? parseFloat(filenameAnalysis.parsed.value) 
            : filenameAnalysis.parsed.value;
          suggestions.amount = `R$ ${numValue.toFixed(2).replace('.', ',')}`;
          confidence.amount = 0.95;
        }
        
        if (filenameAnalysis.parsed.date) {
          const [day, month, year] = filenameAnalysis.parsed.date.split('.');
          suggestions.dueDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          suggestions.paymentDate = suggestions.dueDate;
          confidence.dueDate = 0.90;
          confidence.paymentDate = 0.90;
        }
        
        if (filenameAnalysis.parsed.description) {
          suggestions.supplier = filenameAnalysis.parsed.description;
          confidence.supplier = 0.85;
        }
      }

      // Prioridade 2: Análise de texto OCR (simulação por enquanto)
      if (ocrResult.success && ocrResult.text) {
        // Extrair valores do texto OCR usando regex simples
        const text = ocrResult.text;
        
        // Buscar valores monetários
        if (!suggestions.amount) {
          const valueRegex = /(?:R\$|RS|VALOR|TOTAL)[\s:]*(\d{1,3}(?:\.\d{3})*,\d{2})/gi;
          const valueMatch = text.match(valueRegex);
          if (valueMatch) {
            suggestions.amount = valueMatch[0].replace(/.*?(\d{1,3}(?:\.\d{3})*,\d{2})/, 'R$ $1');
            confidence.amount = 0.70;
          }
        }
        
        // Buscar datas
        if (!suggestions.dueDate) {
          const dateRegex = /(?:VENCIMENTO|VENCE|DUE)[\s:]*(\d{1,2}\/\d{1,2}\/\d{4})/gi;
          const dateMatch = text.match(dateRegex);
          if (dateMatch) {
            const dateStr = dateMatch[0].replace(/.*?(\d{1,2}\/\d{1,2}\/\d{4})/, '$1');
            const [day, month, year] = dateStr.split('/');
            suggestions.dueDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            confidence.dueDate = 0.65;
          }
        }
        
        // Buscar fornecedor/empresa
        if (!suggestions.supplier) {
          const supplierRegex = /(?:FORNECEDOR|EMPRESA|CNPJ)[\s:]*([A-Z\s]{3,30})/gi;
          const supplierMatch = text.match(supplierRegex);
          if (supplierMatch) {
            suggestions.supplier = supplierMatch[0].replace(/.*?([A-Z\s]{3,30})/, '$1').trim();
            confidence.supplier = 0.60;
          }
        }
        
        // Buscar descrição do serviço/produto
        if (!suggestions.description) {
          const descRegex = /(?:DESCRIÇÃO|PRODUTO|SERVIÇO|HISTÓRICO)[\s:]*([A-Za-z0-9\s\-\/]{5,50})/gi;
          const descMatch = text.match(descRegex);
          if (descMatch) {
            suggestions.description = descMatch[0].replace(/.*?([A-Za-z0-9\s\-\/]{5,50})/, '$1').trim();
            confidence.description = 0.55;
          }
        }
      }

      // 4. Limpar arquivo temporário
      try {
        await fs.unlink(req.file.path);
      } catch (error) {
        console.log("⚠️ Erro ao limpar arquivo temporário:", error);
      }

      // 5. Retornar sugestões
      const response = {
        success: true,
        suggestions,
        confidence,
        filenameAnalysis: filenameAnalysis.parsed,
        ocrSuccess: ocrResult.success,
        processingTime: ocrResult.processingTime
      };

      console.log("✅ Sugestões enviadas:", response);
      res.json(response);

    } catch (error) {
      console.error("❌ Erro no processamento do arquivo:", error);
      
      if (req.file) {
        try {
          await fs.unlink(req.file.path);
        } catch (cleanupError) {
          console.log("⚠️ Erro ao limpar arquivo após falha:", cleanupError);
        }
      }
      
      res.status(500).json({ 
        error: "Erro interno no processamento",
        details: error instanceof Error ? error.message : "Erro desconhecido"
      });
    }
  });

  // Reprocess document with improved AI - Endpoint para testar a IA melhorada
  app.post("/api/documents/:id/reprocess", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const documentId = req.params.id;
      
      // Verificar se documento pertence ao tenant
      const document = await storage.getDocument(documentId, user.tenantId);
      if (!document) {
        return res.status(404).json({ error: "Documento não encontrado" });
      }

      console.log(`🔄 Reprocessando documento: ${document.originalName}`);
      
      const result = await documentProcessor.processDocument(documentId, user.tenantId);
      
      res.json({
        success: result.success,
        status: result.status,
        message: result.success ? "Documento reprocessado com sucesso" : "Erro no reprocessamento",
        updates: result.updates,
        errors: result.errors
      });

    } catch (error) {
      console.error("Reprocess error:", error);
      res.status(500).json({ error: "Erro ao reprocessar documento" });
    }
  });

  // Debug endpoint para verificar último documento processado
  app.get("/api/debug/last-document", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      
      // Buscar último documento do tenant
      const documents = await storage.getDocuments(user.tenantId);
      const lastDoc = documents[0];
      
      if (!lastDoc) {
        return res.json({ message: "Nenhum documento encontrado" });
      }
      
      // Buscar análises IA do documento (simulado)
      const aiRuns: any[] = [];
      
      // Buscar inconsistências 
      const inconsistencies = await storage.getDocumentInconsistencies(lastDoc.id);
      
      res.json({
        document: {
          id: lastDoc.id,
          originalName: lastDoc.originalName,
          status: lastDoc.status,
          ocrText: lastDoc.ocrText?.substring(0, 500), // Primeiros 500 chars
          aiProvider: lastDoc.aiProvider,
          ocrConfidence: lastDoc.ocrConfidence
        },
        aiRuns: aiRuns.map((run: any) => ({
          provider: run.provider,
          confidence: run.confidence,
          tokensUsed: run.tokensUsed,
          cost: run.processingCost,
          extractedData: run.extractedData,
          createdAt: run.createdAt
        })),
        inconsistencies: inconsistencies.map(inc => ({
          field: inc.field,
          ocrValue: inc.ocrValue,
          formValue: inc.formValue,
          filenameValue: inc.filenameValue
        }))
      });
      
    } catch (error) {
      console.error("Debug last document error:", error);
      res.status(500).json({ error: "Erro ao buscar dados de debug" });
    }
  });

  // AI metrics dashboard endpoint
  app.get("/api/ai-metrics", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const { dateFrom, dateTo } = req.query;
      
      // Buscar dados reais das tabelas de IA
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);
      
      const aiRuns = await storage.getAiRuns(user.tenantId, {
        dateFrom: last30Days
      });
      
      const stats = {
        totalRuns: aiRuns.length,
        averageProcessingTime: aiRuns.length > 0 
          ? Math.round(aiRuns.reduce((sum, run) => sum + (run.processingTimeMs || 0), 0) / aiRuns.length)
          : 0,
        averageCost: aiRuns.length > 0
          ? parseFloat((aiRuns.reduce((sum, run) => sum + (parseFloat(run.costUsd?.toString() || '0')), 0) / aiRuns.length).toFixed(4))
          : 0,
        providerDistribution: aiRuns.reduce((acc, run) => {
          const provider = run.providerUsed || 'unknown';
          acc[provider] = (acc[provider] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        fallbackRate: aiRuns.length > 0
          ? parseFloat(((aiRuns.filter(run => run.fallbackReason).length / aiRuns.length) * 100).toFixed(1))
          : 0,
        averageConfidence: aiRuns.length > 0
          ? parseFloat((aiRuns.reduce((sum, run) => sum + (run.confidence || 0), 0) / aiRuns.length).toFixed(1))
          : 0
      };

      res.json(stats);
    } catch (error) {
      console.error("AI metrics error:", error);
      res.status(500).json({ error: "Erro ao carregar métricas de IA" });
    }
  });

  // Operational Panel: Inbox - Wave 1 Enhanced
  app.get("/api/documents/inbox", ...authorize(["ADMIN", "GERENTE", "OPERADOR"]), async (req, res) => {
    try {
      const user = req.user!;
      const { priority, sortBy = 'createdAt', sortOrder = 'desc', status, documentType } = req.query;
      
      let statusFilter = ["RECEBIDO", "VALIDANDO", "PENDENTE_REVISAO"];
      
      // Override status filter if specific status requested
      if (status && status !== 'all') {
        statusFilter = [status as string];
      }
      
      // Build filters object
      const filters: any = { status: statusFilter };
      
      if (documentType && documentType !== 'all') {
        filters.documentType = documentType as string;
      }
      
      if (priority === 'urgent') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        filters.dueDateTo = tomorrow;
      }

      const documents = await storage.getDocuments(user.tenantId, filters);
      
      // Sort documents
      const sortedDocuments = documents.sort((a, b) => {
        const aValue = sortBy === 'createdAt' ? a.createdAt : a.originalName;
        const bValue = sortBy === 'createdAt' ? b.createdAt : b.originalName;
        
        if (sortOrder === 'desc') {
          return (aValue || '') > (bValue || '') ? -1 : 1;
        } else {
          return (aValue || '') < (bValue || '') ? -1 : 1;
        }
      });
      
      // Enhanced stats for dashboard
      const stats = {
        total: documents.length,
        recebidos: documents.filter(d => d.status === 'RECEBIDO').length,
        validando: documents.filter(d => d.status === 'VALIDANDO').length,
        pendentesRevisao: documents.filter(d => d.status === 'PENDENTE_REVISAO').length,
        urgentes: documents.filter(d => d.dueDate && d.dueDate <= new Date()).length,
        porTipo: {
          pago: documents.filter(d => d.documentType === 'PAGO').length,
          agendado: documents.filter(d => d.documentType === 'AGENDADO').length,
          boleto: documents.filter(d => d.documentType === 'EMITIR_BOLETO').length,
          nf: documents.filter(d => d.documentType === 'EMITIR_NF').length
        }
      };

      res.json({ documents: sortedDocuments, stats });
    } catch (error) {
      console.error("Inbox error:", error);
      res.status(500).json({ error: "Erro ao carregar inbox" });
    }
  });

  // Operational Panel: Scheduled - Wave 1 Enhanced  
  app.get("/api/documents/scheduled", ...authorize(["ADMIN", "GERENTE", "OPERADOR"]), async (req, res) => {
    try {
      const user = req.user!;
      const { filter = "all" } = req.query;
      
      let statusFilter = ["AGENDADO", "A_PAGAR_HOJE", "AGUARDANDO_RECEBIMENTO"];
      const documents = await storage.getDocuments(user.tenantId, { status: statusFilter });
      
      // Enhanced filtering with stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const filtered = documents.filter(doc => {
        if (!doc.dueDate) return filter === "all";
        
        const dueDate = new Date(doc.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        switch (filter) {
          case "today":
            return dueDate.getTime() === today.getTime();
          case "overdue":
            return dueDate < today;
          case "next7days":
            const next7Days = new Date(today);
            next7Days.setDate(next7Days.getDate() + 7);
            return dueDate >= today && dueDate <= next7Days;
          default:
            return true;
        }
      });

      // Enhanced stats for operational panels
      const stats = {
        total: documents.length,
        agendado: documents.filter(d => d.status === 'AGENDADO').length,
        aPagarHoje: documents.filter(d => d.status === 'A_PAGAR_HOJE').length,
        aguardandoRecebimento: documents.filter(d => d.status === 'AGUARDANDO_RECEBIMENTO').length,
        today: documents.filter(d => {
          if (!d.dueDate) return false;
          const dueDate = new Date(d.dueDate);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() === today.getTime();
        }).length,
        overdue: documents.filter(d => {
          if (!d.dueDate) return false;
          return new Date(d.dueDate) < today;
        }).length
      };

      res.json({ documents: filtered, stats });
    } catch (error) {
      console.error("Scheduled error:", error);
      res.status(500).json({ error: "Erro ao carregar agendados" });
    }
  });

  // Operational Panel: Reconciliation - Wave 1 Enhanced
  app.get("/api/documents/reconciliation", ...authorize(["ADMIN", "GERENTE", "OPERADOR"]), async (req, res) => {
    try {
      const user = req.user!;
      const { bankId, clientId } = req.query;
      
      const filters: any = { status: ["PAGO_A_CONCILIAR", "EM_CONCILIACAO"] };
      if (bankId) filters.bankId = bankId;
      if (clientId) filters.clientId = clientId;
      
      const documents = await storage.getDocuments(user.tenantId, filters);
      
      // Stats for reconciliation panel
      const stats = {
        total: documents.length,
        pagoConciliar: documents.filter(d => d.status === 'PAGO_A_CONCILIAR').length,
        emConciliacao: documents.filter(d => d.status === 'EM_CONCILIACAO').length,
        totalAmount: documents.reduce((sum, d) => sum + (parseFloat(d.amount || '0')), 0)
      };

      res.json({ documents, stats });
    } catch (error) {
      console.error("Reconciliation error:", error);
      res.status(500).json({ error: "Erro ao carregar conciliação" });
    }
  });

  // Operational Panel: Archived - Wave 1 Enhanced
  app.get("/api/documents/archived", ...authorize(["ADMIN", "GERENTE", "OPERADOR"]), async (req, res) => {
    try {
      const user = req.user!;
      const { search, clientId, bankId, dateFrom, dateTo } = req.query;
      
      const filters: any = { status: ["ARQUIVADO"] };
      if (clientId) filters.clientId = clientId;
      if (bankId) filters.bankId = bankId;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);
      
      let documents = await storage.getDocuments(user.tenantId, filters);
      
      // Advanced search by filename or notes
      if (search) {
        const searchTerm = (search as string).toLowerCase();
        documents = documents.filter(d => 
          d.originalName.toLowerCase().includes(searchTerm) ||
          (d.notes && d.notes.toLowerCase().includes(searchTerm))
        );
      }

      const stats = {
        total: documents.length,
        totalAmount: documents.reduce((sum, d) => sum + (parseFloat(d.amount || '0')), 0),
        byType: {
          pago: documents.filter(d => d.documentType === 'PAGO').length,
          agendado: documents.filter(d => d.documentType === 'AGENDADO').length,
          boleto: documents.filter(d => d.documentType === 'EMITIR_BOLETO').length,
          nf: documents.filter(d => d.documentType === 'EMITIR_NF').length
        }
      };

      res.json({ documents, stats });
    } catch (error) {
      console.error("Archived error:", error);
      res.status(500).json({ error: "Erro ao carregar arquivados" });
    }
  });

  // Scheduled documents endpoints
  app.get("/api/documents/scheduled/today", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const documents = await storage.getDocuments(user.tenantId, { 
        status: ["AGENDADO", "A_PAGAR_HOJE"],
        dueDateFrom: today,
        dueDateTo: tomorrow
      });
      res.json(documents);
    } catch (error) {
      console.error("Today scheduled error:", error);
      res.status(500).json({ error: "Erro ao carregar agendados de hoje" });
    }
  });

  app.get("/api/documents/scheduled/next7days", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const today = new Date();
      const next7Days = new Date(today);
      next7Days.setDate(next7Days.getDate() + 7);
      
      const documents = await storage.getDocuments(user.tenantId, { 
        status: ["AGENDADO"],
        dueDateFrom: today,
        dueDateTo: next7Days
      });
      res.json(documents);
    } catch (error) {
      console.error("Next 7 days error:", error);
      res.status(500).json({ error: "Erro ao carregar próximos 7 dias" });
    }
  });

  app.get("/api/documents/scheduled/overdue", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const documents = await storage.getDocuments(user.tenantId, { 
        status: ["AGENDADO", "A_PAGAR_HOJE"],
        dueDateTo: today,
        overdue: true
      });
      res.json(documents);
    } catch (error) {
      console.error("Overdue error:", error);
      res.status(500).json({ error: "Erro ao carregar atrasados" });
    }
  });

  // Emission documents endpoints
  app.get("/api/documents/emission/boletos", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const documents = await storage.getDocuments(user.tenantId, { 
        documentType: "EMITIR_BOLETO",
        status: ["AGUARDANDO_RECEBIMENTO", "EM_CONCILIACAO"]
      });
      res.json(documents);
    } catch (error) {
      console.error("Boletos emission error:", error);
      res.status(500).json({ error: "Erro ao carregar boletos para emissão" });
    }
  });

  app.get("/api/documents/emission/nf", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const documents = await storage.getDocuments(user.tenantId, { 
        documentType: "EMITIR_NF",
        status: ["AGUARDANDO_RECEBIMENTO", "EM_CONCILIACAO"]
      });
      res.json(documents);
    } catch (error) {
      console.error("NF emission error:", error);
      res.status(500).json({ error: "Erro ao carregar NFs para emissão" });
    }
  });

  // OCR Metrics - Wave 1: Advanced OCR with metrics
  app.get("/api/ocr/metrics/:documentId", ...authorize(["ADMIN", "GERENTE", "OPERADOR"]), async (req, res) => {
    try {
      const { documentId } = req.params;
      const user = req.user!;
      
      // Verificar se documento pertence ao tenant do usuário
      const document = await storage.getDocument(documentId, user.tenantId);
      if (!document) {
        return res.status(404).json({ error: "Documento não encontrado" });
      }
      
      const metrics = await storage.getOcrMetricsByDocument(documentId);
      res.json(metrics);
    } catch (error) {
      console.error("OCR metrics error:", error);
      res.status(500).json({ error: "Erro ao carregar métricas OCR" });
    }
  });

  // OCR Performance Stats - Wave 1: Analytics dashboard  
  app.get("/api/ocr/performance", ...authorize(["ADMIN", "GERENTE"]), async (req, res) => {
    try {
      const user = req.user!;
      const daysBack = parseInt(req.query.days as string) || 30;
      
      const { AdvancedOcrProcessor } = await import("./ocr-processor-advanced");
      const advancedProcessor = new AdvancedOcrProcessor(storage);
      const stats = await advancedProcessor.getProcessingStats(user.tenantId, daysBack);
      
      res.json(stats);
    } catch (error) {
      console.error("OCR performance error:", error);
      res.status(500).json({ error: "Erro ao carregar performance OCR" });
    }
  });

  // Async document processing function using comprehensive processor
  async function processDocumentAsync(documentId: string, tenantId: string) {
    try {
      const { DocumentProcessor } = await import("./document-processor");
      const documentProcessor = new DocumentProcessor();
      const result = await documentProcessor.processDocument(documentId, tenantId);
      console.log(`✅ Document ${documentId} processing completed:`, result.status);
    } catch (error) {
      console.error(`❌ Document ${documentId} processing failed:`, error);
    }
  }

  // AI Provider control endpoints - Enhanced monitoring system
  app.get("/api/ai-control", ...authorize(["ADMIN", "GERENTE"]), async (req, res) => {
    try {
      const user = req.user!;
      const { aiMultiProvider } = await import("./ai-multi-provider");
      const providers = aiMultiProvider.getProviders();
      
      // Get AI usage metrics for the tenant
      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);
      
      const aiRuns = await storage.getAiRuns(user.tenantId, {
        dateFrom: last30Days
      });
      
      const recentRuns = aiRuns;
      
      // Calculate metrics by provider
      const metrics = providers.map(provider => {
        // Mapear variações do nome do provider
        const providerVariants = provider.name === 'glm' ? ['glm', 'glm-4-plus'] : [provider.name];
        const providerRuns = recentRuns.filter(run => providerVariants.includes(run.providerUsed));
        const totalCost = providerRuns.reduce((sum, run) => sum + (parseFloat(run.costUsd?.toString() || '0')), 0);
        const totalTokens = providerRuns.reduce((sum, run) => sum + (run.tokensIn || 0) + (run.tokensOut || 0), 0);
        const avgResponseTime = providerRuns.length > 0 
          ? providerRuns.reduce((sum, run) => sum + (run.processingTimeMs || 0), 0) / providerRuns.length 
          : 0;
        const successRate = providerRuns.length > 0 
          ? (providerRuns.filter(run => (run.confidence || 0) > 80).length / providerRuns.length) * 100 
          : 0;
        
        return {
          ...provider,
          last30Days: {
            totalRequests: providerRuns.length,
            totalCost: parseFloat(totalCost.toFixed(4)),
            totalTokens,
            avgResponseTime: Math.round(avgResponseTime),
            successRate: parseFloat(successRate.toFixed(1)),
            failureReasons: providerRuns
              .filter(run => (run.confidence || 0) <= 80)
              .map(run => run.fallbackReason || 'Low confidence')
              .reduce((acc, reason) => {
                acc[reason] = (acc[reason] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
          }
        };
      });

      res.json({ 
        providers: metrics,
        summary: {
          totalRequests: recentRuns.length,
          totalCost: parseFloat(recentRuns.reduce((sum, run) => sum + (parseFloat(run.costUsd?.toString() || '0')), 0).toFixed(4)),
          avgDailyRequests: Math.round(recentRuns.length / 30),
          mostUsedProvider: recentRuns.length > 0 
            ? recentRuns.reduce((acc, run) => {
                acc[run.providerUsed] = (acc[run.providerUsed] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            : {}
        }
      });
    } catch (error) {
      console.error("AI control error:", error);
      res.status(500).json({ error: "Erro ao obter status dos provedores" });
    }
  });

  app.post("/api/ai-control/toggle-provider", ...authorize(["ADMIN", "GERENTE"]), async (req, res) => {
    try {
      const { providerName } = req.body;
      const { aiMultiProvider } = await import("./ai-multi-provider");
      const enabled = aiMultiProvider.toggleProvider(providerName);
      res.json({ success: true, providerName, enabled });
    } catch (error) {
      console.error("AI toggle error:", error);
      res.status(500).json({ error: "Erro ao alternar provedor" });
    }
  });

  // Get available models
  app.get('/api/ai-control/available-models', ...authorize(["ADMIN", "GERENTE"]), async (req, res) => {
    try {
      const { aiMultiProvider } = await import("./ai-multi-provider");
      const models = aiMultiProvider.getAvailableModels();
      res.json(models);
    } catch (error) {
      console.error('Error getting available models:', error);
      res.status(500).json({ error: 'Failed to get available models' });
    }
  });

  // Update provider model
  app.post('/api/ai-control/update-model', ...authorize(["ADMIN", "GERENTE"]), async (req, res) => {
    try {
      const { providerName, modelId } = req.body;
      
      if (!providerName || !modelId) {
        return res.status(400).json({ error: 'Provider name and model ID are required' });
      }

      const { aiMultiProvider } = await import("./ai-multi-provider");
      const success = aiMultiProvider.updateProviderModel(providerName, modelId);
      
      if (!success) {
        return res.status(400).json({ error: 'Invalid provider or model' });
      }

      res.json({ 
        success: true, 
        message: `Model updated to ${modelId}`,
        providerName,
        modelId
      });
    } catch (error) {
      console.error('Error updating model:', error);
      res.status(500).json({ error: 'Failed to update model' });
    }
  });

  // Update provider configuration (model, priority, etc)
  app.post("/api/ai-control/update-config", ...authorize(["ADMIN", "GERENTE"]), async (req, res) => {
    try {
      const { providerName, config } = req.body;
      const { aiMultiProvider } = await import("./ai-multi-provider");
      const success = aiMultiProvider.updateProviderConfig(providerName, config);
      
      if (success) {
        res.json({ success: true, providerName, config });
      } else {
        res.status(404).json({ error: "Provider não encontrado" });
      }
    } catch (error) {
      console.error("AI config update error:", error);
      res.status(500).json({ error: "Erro ao atualizar configuração" });
    }
  });

  // Swap provider priorities
  app.post("/api/ai-control/swap-priorities", ...authorize(["ADMIN", "GERENTE"]), async (req, res) => {
    try {
      const { aiMultiProvider } = await import("./ai-multi-provider");
      aiMultiProvider.swapPriorities();
      res.json({ success: true });
    } catch (error) {
      console.error("AI swap priorities error:", error);
      res.status(500).json({ error: "Erro ao alternar prioridades" });
    }
  });

  // AI Control - Performance metrics
  app.get("/api/ai-control/performance", ...authorize(["ADMIN", "GERENTE"]), async (req, res) => {
    try {
      const { aiMultiProvider } = await import("./ai-multi-provider");
      const metrics = aiMultiProvider.getProviderMetrics();
      const comparison = aiMultiProvider.getProviderComparison();
      
      res.json({
        metrics,
        comparison,
        summary: {
          totalRequests: Object.values(metrics).reduce((sum: number, m: any) => sum + m.performance.totalRequests, 0),
          totalCost: Object.values(metrics).reduce((sum: number, m: any) => sum + m.performance.totalCost, 0),
          avgSuccessRate: Object.values(metrics).reduce((sum: number, m: any) => sum + m.performance.successRate, 0) / Object.keys(metrics).length
        }
      });
    } catch (error) {
      console.error("❌ Erro ao buscar métricas:", error);
      res.status(500).json({ error: "Erro interno" });
    }
  });

  // AI Control - Real-time status with recent activity
  app.get("/api/ai-control/status", ...authorize(["ADMIN", "GERENTE", "OPERADOR"]), async (req, res) => {
    try {
      const { aiMultiProvider } = await import("./ai-multi-provider");
      const providers = aiMultiProvider.getProviders();
      const user = req.user!;
      const now = new Date();
      
      // Get recent AI activity (last 10 minutes)
      const recentActivity = await storage.getAiRuns(user.tenantId, {
        dateFrom: new Date(Date.now() - 10 * 60 * 1000),
        limit: 1
      });
      
      res.json({
        providers: providers.map(p => ({
          name: p.name,
          status: p.status,
          enabled: p.enabled,
          priority: p.priority,
          model: p.model,
          lastUpdate: now.toISOString(),
          healthScore: p.last30Days.successRate,
          totalRequests: p.last30Days.totalRequests,
          totalCost: p.last30Days.totalCost
        })),
        systemHealth: {
          overall: providers.every(p => p.status === 'online') ? 'healthy' : 'degraded',
          primaryProvider: providers.find(p => p.priority === 1)?.name,
          lastCheck: now.toISOString()
        },
        recentActivity: recentActivity.length > 0 ? {
          timestamp: recentActivity[0].createdAt,
          provider: recentActivity[0].providerUsed,
          confidence: recentActivity[0].confidence,
          success: (recentActivity[0].confidence || 0) > 80
        } : null
      });
    } catch (error) {
      console.error("❌ Erro ao buscar status:", error);
      res.status(500).json({ error: "Erro interno" });
    }
  });

  // Emergency mode control
  app.post("/api/ai-control/emergency-mode", ...authorize(["ADMIN", "GERENTE"]), async (req, res) => {
    try {
      const { enabled } = req.body;
      const { aiMultiProvider } = await import("./ai-multi-provider");
      
      if (enabled) {
        aiMultiProvider.enableEmergencyMode();
      } else {
        aiMultiProvider.disableEmergencyMode();
      }
      
      res.json({ success: true, emergencyMode: enabled });
    } catch (error) {
      console.error("AI emergency mode error:", error);
      res.status(500).json({ error: "Erro ao alterar modo emergência" });
    }
  });

  // Reset provider status
  app.post("/api/ai-control/reset-provider", ...authorize(["ADMIN", "GERENTE"]), async (req, res) => {
    try {
      const { providerName } = req.body;
      const { aiMultiProvider } = await import("./ai-multi-provider");
      
      aiMultiProvider.resetProviderStatus(providerName);
      
      res.json({ success: true, provider: providerName, status: "reset" });
    } catch (error) {
      console.error("AI reset provider error:", error);
      res.status(500).json({ error: "Erro ao resetar provider" });
    }
  });

  // Get detailed status
  app.get("/api/ai-control/detailed-status", ...authorize(["ADMIN", "GERENTE", "OPERADOR"]), async (req, res) => {
    try {
      const { aiMultiProvider } = await import("./ai-multi-provider");
      const detailedStatus = aiMultiProvider.getDetailedStatus();
      
      res.json({ providers: detailedStatus });
    } catch (error) {
      console.error("AI detailed status error:", error);
      res.status(500).json({ error: "Erro ao buscar status detalhado" });
    }
  });

  // Get recent AI document history
  app.get("/api/ai-control/recent-documents", ...authorize(["ADMIN", "GERENTE"]), async (req, res) => {
    try {
      const user = req.user!;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const aiRuns = await storage.getAiRuns(user.tenantId, {
        limit,
        dateFrom: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24h
      });

      // Get document details for each run
      const documentsWithRuns = await Promise.all(
        aiRuns.map(async (run) => {
          try {
            const doc = await storage.getDocument(run.documentId, user.tenantId);
            return {
              id: run.id,
              documentName: doc?.originalName || 'Documento removido',
              provider: run.providerUsed,
              timestamp: run.createdAt,
              confidence: run.confidence,
              processingTime: run.processingTimeMs,
              cost: parseFloat(run.costUsd?.toString() || '0'),
              success: (run.confidence || 0) > 80,
              fallbackReason: run.fallbackReason
            };
          } catch (error) {
            return {
              id: run.id,
              documentName: 'Documento não encontrado',
              provider: run.providerUsed,
              timestamp: run.createdAt,
              confidence: run.confidence,
              processingTime: run.processingTimeMs,
              cost: parseFloat(run.costUsd?.toString() || '0'),
              success: (run.confidence || 0) > 80,
              fallbackReason: run.fallbackReason
            };
          }
        })
      );

      res.json({
        recentDocuments: documentsWithRuns,
        lastActivity: documentsWithRuns[0] || null
      });
    } catch (error) {
      console.error("AI recent documents error:", error);
      res.status(500).json({ error: "Erro ao buscar documentos recentes" });
    }
  });

  // AI usage analytics endpoint
  app.get("/api/ai-control/analytics", ...authorize(["ADMIN", "GERENTE"]), async (req, res) => {
    try {
      const user = req.user!;
      const { period = '30', provider } = req.query;
      
      const daysBack = parseInt(period as string);
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - daysBack);
      
      let aiRuns = await storage.getAiRuns(user.tenantId, {
        dateFrom,
        limit: 50000
      });
      
      if (provider) {
        aiRuns = aiRuns.filter(run => run.providerUsed === provider);
      }
      
      // Group by day for timeline chart
      const timeline = [];
      for (let i = daysBack - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        
        const dayRuns = aiRuns.filter(run => {
          const runDate = new Date(run.createdAt || new Date());
          return runDate >= dayStart && runDate < dayEnd;
        });
        
        timeline.push({
          date: dayStart.toISOString().split('T')[0],
          requests: dayRuns.length,
          cost: parseFloat((dayRuns.reduce((sum, run) => sum + (parseFloat(run.costUsd?.toString() || '0')), 0)).toFixed(4)),
          avgResponseTime: dayRuns.length > 0 
            ? Math.round(dayRuns.reduce((sum, run) => sum + (run.processingTimeMs || 0), 0) / dayRuns.length)
            : 0,
          successCount: dayRuns.filter(run => (run.confidence || 0) > 80).length,
          errorCount: dayRuns.filter(run => (run.confidence || 0) <= 80).length
        });
      }
      
      // Provider comparison
      const providerStats = Object.entries(
        aiRuns.reduce((acc, run) => {
          if (!acc[run.providerUsed]) {
            acc[run.providerUsed] = {
              requests: 0,
              cost: 0,
              avgResponseTime: 0,
              successRate: 0,
              totalResponseTime: 0,
              successCount: 0
            };
          }
          acc[run.providerUsed].requests++;
          acc[run.providerUsed].cost += parseFloat(run.costUsd?.toString() || '0');
          acc[run.providerUsed].totalResponseTime += run.processingTimeMs || 0;
          if ((run.confidence || 0) > 80) {
            acc[run.providerUsed].successCount++;
          }
          return acc;
        }, {} as Record<string, any>)
      ).map(([provider, stats]) => ({
        provider,
        requests: stats.requests,
        cost: parseFloat(stats.cost.toFixed(4)),
        avgResponseTime: Math.round(stats.totalResponseTime / stats.requests),
        successRate: parseFloat(((stats.successCount / stats.requests) * 100).toFixed(1))
      }));
      
      res.json({
        timeline,
        providerStats,
        summary: {
          totalRequests: aiRuns.length,
          totalCost: parseFloat(aiRuns.reduce((sum, run) => sum + (parseFloat(run.costUsd?.toString() || '0')), 0).toFixed(4)),
          avgResponseTime: aiRuns.length > 0 
            ? Math.round(aiRuns.reduce((sum, run) => sum + (run.processingTimeMs || 0), 0) / aiRuns.length)
            : 0,
          overallSuccessRate: aiRuns.length > 0 
            ? parseFloat(((aiRuns.filter(run => (run.confidence || 0) > 80).length / aiRuns.length) * 100).toFixed(1))
            : 0
        }
      });
    } catch (error) {
      console.error("AI analytics error:", error);
      res.status(500).json({ error: "Erro ao obter analytics de IA" });
    }
  });

  // AI provider configuration endpoint
  app.patch("/api/ai-control/provider/:name", ...authorize(["ADMIN"]), async (req, res) => {
    try {
      const { name } = req.params;
      const { priority, costPer1000 } = req.body;
      
      const { aiMultiProvider } = await import("./ai-multi-provider");
      const success = aiMultiProvider.updateProviderConfig(name, { priority, costPer1000 });
      
      if (success) {
        res.json({ success: true, message: "Configuração atualizada" });
      } else {
        res.status(404).json({ error: "Provider não encontrado" });
      }
    } catch (error) {
      console.error("Update provider config error:", error);
      res.status(500).json({ error: "Erro ao atualizar configuração" });
    }
  });

  // Document actions endpoint
  app.patch("/api/documents/:id/action", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { action, dueDate, notes } = req.body;
      const user = req.user!;

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: "ID de documento inválido" });
      }

      const document = await storage.getDocument(id, user.tenantId);
      if (!document) {
        return res.status(404).json({ error: "Documento não encontrado" });
      }

      let newStatus = document.status;
      let updates: any = {};

      switch (action) {
        case "approve":
          if (document.documentType === "PAGO") {
            newStatus = "PAGO_A_CONCILIAR";
          } else if (document.documentType === "AGENDADO") {
            newStatus = "AGENDADO";
          } else if (document.documentType === "EMITIR_BOLETO" || document.documentType === "EMITIR_NF") {
            newStatus = "AGUARDANDO_RECEBIMENTO";
          } else {
            newStatus = "CLASSIFICADO";
          }
          break;
        
        case "schedule":
          if (dueDate) {
            updates.dueDate = new Date(dueDate);
            newStatus = "AGENDADO";
          }
          break;
        
        case "revise":
          newStatus = "PENDENTE_REVISAO";
          if (notes) {
            updates.notes = notes;
          }
          break;
        
        default:
          return res.status(400).json({ error: "Ação inválida" });
      }

      updates.status = newStatus;
      await storage.updateDocument(id, user.tenantId, updates);

      res.json({ message: "Ação realizada com sucesso", status: newStatus });
    } catch (error) {
      console.error("Document action error:", error);
      res.status(500).json({ error: "Erro ao processar ação" });
    }
  });

  // FASE 3: Endpoints de ações operacionais avançadas
  
  // Ação em lote para documentos
  app.post("/api/documents/batch-action", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const { documentIds, action, actionData } = req.body;
      
      if (!Array.isArray(documentIds) || documentIds.length === 0) {
        return res.status(400).json({ error: "Lista de documentos é obrigatória" });
      }
      
      const results = [];
      
      for (const documentId of documentIds) {
        try {
          const document = await storage.getDocument(documentId, user.tenantId);
          if (!document) continue;
          
          let updates = {};
          let logAction = action.toUpperCase();
          
          switch (action) {
            case "approve":
              updates = { status: "CLASSIFICADO", reviewedBy: user.id, reviewedAt: new Date() };
              break;
            case "reject":
              updates = { status: "PENDENTE_REVISAO", notes: actionData?.reason || "Rejeitado" };
              break;
            case "archive":
              updates = { status: "ARQUIVADO", archivedBy: user.id, archivedAt: new Date() };
              break;
            case "reassign":
              updates = { assignedTo: actionData?.assignedTo };
              logAction = "REASSIGN";
              break;
          }
          
          await storage.updateDocument(documentId, user.tenantId, updates);
          
          await storage.createDocumentLog({
            documentId,
            action: logAction,
            status: "SUCCESS",
            details: { action, actionData },
            userId: user.id,
          });
          
          results.push({ documentId, success: true });
        } catch (error) {
          results.push({ documentId, success: false, error: error instanceof Error ? error.message : "Erro desconhecido" });
        }
      }
      
      res.json({ results });
    } catch (error) {
      console.error("Batch action error:", error);
      res.status(500).json({ error: "Erro ao executar ação em lote" });
    }
  });

  // Filtros avançados para documentos
  app.post("/api/documents/advanced-search", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const { 
        dateRange, 
        amountRange, 
        statuses, 
        types, 
        clientIds, 
        bankIds,
        hasConflicts,
        text
      } = req.body;
      
      let documents = await storage.getDocuments(user.tenantId, {});
      
      // Aplicar filtros
      if (dateRange?.start || dateRange?.end) {
        documents = documents.filter(doc => {
          const docDate = doc.createdAt ? new Date(doc.createdAt) : new Date();
          if (dateRange.start && docDate < new Date(dateRange.start)) return false;
          if (dateRange.end && docDate > new Date(dateRange.end)) return false;
          return true;
        });
      }
      
      if (amountRange?.min || amountRange?.max) {
        documents = documents.filter(doc => {
          if (!doc.amount) return false;
          const amount = parseFloat(doc.amount);
          if (amountRange.min && amount < amountRange.min) return false;
          if (amountRange.max && amount > amountRange.max) return false;
          return true;
        });
      }
      
      if (statuses && statuses.length > 0) {
        documents = documents.filter(doc => statuses.includes(doc.status));
      }
      
      if (types && types.length > 0) {
        documents = documents.filter(doc => types.includes(doc.documentType));
      }
      
      if (clientIds && clientIds.length > 0) {
        documents = documents.filter(doc => clientIds.includes(doc.clientId));
      }
      
      if (bankIds && bankIds.length > 0) {
        documents = documents.filter(doc => bankIds.includes(doc.bankId));
      }
      
      if (hasConflicts === true) {
        documents = documents.filter(doc => 
          doc.status === "PENDENTE_REVISAO"
        );
      }
      
      if (text) {
        const searchText = text.toLowerCase();
        documents = documents.filter(doc => 
          doc.originalName.toLowerCase().includes(searchText) ||
          (doc.notes && doc.notes.toLowerCase().includes(searchText)) ||
          (doc.ocrText && doc.ocrText.toLowerCase().includes(searchText))
        );
      }
      
      res.json(documents);
    } catch (error) {
      console.error("Advanced search error:", error);
      res.status(500).json({ error: "Erro na busca avançada" });
    }
  });

  // FASE 2: Routes para painéis operacionais conforme PRD
  
  // Painel Agendados - Filtros: Hoje, Próximos 7 dias, Atrasados
  app.get("/api/documents/scheduled/today", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const documents = await storage.getDocuments(user.tenantId, {
        status: ["AGENDADO", "A_PAGAR_HOJE"],
        dueDateFrom: today,
        dueDateTo: tomorrow,
      });
      
      res.json(documents);
    } catch (error) {
      console.error("Get today scheduled error:", error);
      res.status(500).json({ error: "Erro ao carregar documentos de hoje" });
    }
  });

  app.get("/api/documents/scheduled/next7days", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const today = new Date();
      const next7Days = new Date(today);
      next7Days.setDate(next7Days.getDate() + 7);
      
      const documents = await storage.getDocuments(user.tenantId, {
        status: ["AGENDADO"],
        dueDateFrom: today,
        dueDateTo: next7Days,
      });
      
      res.json(documents);
    } catch (error) {
      console.error("Get next 7 days scheduled error:", error);
      res.status(500).json({ error: "Erro ao carregar documentos dos próximos 7 dias" });
    }
  });

  app.get("/api/documents/scheduled/overdue", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const today = new Date();
      
      const documents = await storage.getDocuments(user.tenantId, {
        status: ["AGENDADO", "A_PAGAR_HOJE"],
        dueDateTo: today,
      });
      
      res.json(documents);
    } catch (error) {
      console.error("Get overdue scheduled error:", error);
      res.status(500).json({ error: "Erro ao carregar documentos atrasados" });
    }
  });

  // Painel Conciliação - Por banco/cliente
  app.get("/api/documents/reconciliation", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const documents = await storage.getDocuments(user.tenantId, {
        status: ["PAGO_A_CONCILIAR", "EM_CONCILIACAO"],
      });
      
      res.json(documents);
    } catch (error) {
      console.error("Get reconciliation documents error:", error);
      res.status(500).json({ error: "Erro ao carregar documentos para conciliação" });
    }
  });

  // Painel Emissão - Boletos e NF
  app.get("/api/documents/emission/boletos", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const documents = await storage.getDocuments(user.tenantId, {
        documentType: ["EMITIR_BOLETO"],
        status: ["RECEBIDO", "VALIDANDO", "AGUARDANDO_RECEBIMENTO"],
      });
      
      res.json(documents);
    } catch (error) {
      console.error("Get boleto documents error:", error);
      res.status(500).json({ error: "Erro ao carregar documentos de boleto" });
    }
  });

  app.get("/api/documents/emission/nf", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const documents = await storage.getDocuments(user.tenantId, {
        documentType: ["EMITIR_NF"],
        status: ["RECEBIDO", "VALIDANDO", "AGUARDANDO_RECEBIMENTO"],
      });
      
      res.json(documents);
    } catch (error) {
      console.error("Get NF documents error:", error);
      res.status(500).json({ error: "Erro ao carregar documentos de NF" });
    }
  });

  // Health check endpoints - Sistema de diagnóstico GLM aprimorado
  app.get("/healthz", async (req, res) => {
    try {
      const health = await aiDiagnostics.getHealthReport();
      const isHealthy = health.summary.downProviders === 0;
      
      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: health.timestamp,
        providers: health.providers.map(p => ({
          name: p.name,
          status: p.status,
          latency: p.latency,
          error: p.error
        }))
      });
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  app.get("/readyz", async (req, res) => {
    try {
      // Verificar se pelo menos um provedor está funcionando
      const health = await aiDiagnostics.getHealthReport();
      const hasHealthyProvider = health.providers.some(p => p.status === 'healthy');
      
      if (hasHealthyProvider) {
        res.status(200).json({
          status: 'ready',
          timestamp: health.timestamp,
          healthyProviders: health.summary.healthyProviders
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          timestamp: health.timestamp,
          error: 'No healthy AI providers available'
        });
      }
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Readiness check failed'
      });
    }
  });

  app.get("/api/ai/diagnostics", isAuthenticated, async (req, res) => {
    try {
      const health = await aiDiagnostics.getHealthReport();
      res.json(health);
    } catch (error) {
      console.error("AI diagnostics error:", error);
      res.status(500).json({ error: "Failed to get AI diagnostics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
