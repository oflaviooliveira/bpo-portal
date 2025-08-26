import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, isAuthenticated } from "./auth";
import { storage } from "./storage";
import { processDocumentWithOCR } from "./ocr";
import { analyzeDocumentWithAI } from "./ai";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { z } from "zod";

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use PDF, JPG ou PNG.'));
    }
  },
});

const uploadDocumentSchema = z.object({
  clientId: z.string().uuid(),
  bankId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  costCenterId: z.string().uuid().optional(),
  documentType: z.enum(['PAGO', 'AGENDADO', 'BOLETO', 'NF']),
  amount: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Dashboard stats
  app.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const stats = await storage.getDashboardStats(user.tenantId);
      res.json(stats);
    } catch (error) {
      console.error("Dashboard stats error:", error);
      res.status(500).json({ error: "Erro ao carregar estatísticas" });
    }
  });

  // Get clients
  app.get("/api/clients", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
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

  // Get documents with filters
  app.get("/api/documents", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const filters = {
        status: req.query.status as string,
        documentType: req.query.documentType as string,
        clientId: req.query.clientId as string,
      };
      
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

  // Upload and process document
  app.post("/api/documents/upload", isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      const user = req.user!;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "Nenhum arquivo foi enviado" });
      }

      // Validate request body
      const validatedData = uploadDocumentSchema.parse(req.body);

      // Create document record
      const document = await storage.createDocument({
        tenantId: user.tenantId,
        clientId: validatedData.clientId,
        bankId: validatedData.bankId,
        categoryId: validatedData.categoryId,
        costCenterId: validatedData.costCenterId,
        fileName: file.filename,
        originalName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        filePath: file.path,
        documentType: validatedData.documentType,
        amount: validatedData.amount ? validatedData.amount : null,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        notes: validatedData.notes,
        createdBy: user.id,
      });

      // Log document creation
      await storage.createDocumentLog({
        documentId: document.id,
        action: "UPLOAD",
        status: "SUCCESS",
        details: { fileName: file.originalname, fileSize: file.size },
        userId: user.id,
      });

      // Process document asynchronously
      processDocumentAsync(document.id, user.tenantId);

      res.json({ 
        message: "Documento enviado com sucesso",
        documentId: document.id,
      });
    } catch (error) {
      console.error("Document upload error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Dados inválidos", details: error.errors });
      }
      res.status(500).json({ error: "Erro ao processar documento" });
    }
  });

  // Get document by ID
  app.get("/api/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const document = await storage.getDocument(req.params.id, user.tenantId);
      
      if (!document) {
        return res.status(404).json({ error: "Documento não encontrado" });
      }

      res.json(document);
    } catch (error) {
      console.error("Get document error:", error);
      res.status(500).json({ error: "Erro ao carregar documento" });
    }
  });

  // Update document
  app.patch("/api/documents/:id", isAuthenticated, async (req, res) => {
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

  // Categories routes
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

  app.post("/api/categories", isAuthenticated, async (req, res) => {
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

  app.patch("/api/categories/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const category = await storage.updateCategory(req.params.id, user.tenantId, req.body);
      res.json(category);
    } catch (error) {
      console.error("Update category error:", error);
      res.status(500).json({ error: "Erro ao atualizar categoria" });
    }
  });

  app.delete("/api/categories/:id", isAuthenticated, async (req, res) => {
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
      const costCenters = await storage.getCostCenters(user.tenantId);
      res.json(costCenters);
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

  // Document filters for operational panels
  app.get("/api/documents/inbox", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const documents = await storage.getDocuments(user.tenantId, { 
        status: ["RECEBIDO", "VALIDANDO", "PENDENTE_REVISAO"] 
      });
      res.json(documents);
    } catch (error) {
      console.error("Inbox error:", error);
      res.status(500).json({ error: "Erro ao carregar inbox" });
    }
  });

  app.get("/api/documents/scheduled", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const { filter = "all" } = req.query;
      
      let statusFilter = ["AGENDADO", "A_PAGAR_HOJE"];
      const documents = await storage.getDocuments(user.tenantId, { status: statusFilter });
      
      // Filter by date
      const today = new Date();
      const filtered = documents.filter(doc => {
        if (!doc.dueDate) return false;
        const dueDate = new Date(doc.dueDate);
        
        switch (filter) {
          case "today":
            return dueDate.toDateString() === today.toDateString();
          case "week":
            const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
            return dueDate >= today && dueDate <= weekFromNow;
          case "overdue":
            return dueDate < today;
          default:
            return true;
        }
      });

      res.json(filtered);
    } catch (error) {
      console.error("Scheduled error:", error);
      res.status(500).json({ error: "Erro ao carregar agendados" });
    }
  });

  app.get("/api/documents/reconciliation", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const documents = await storage.getDocuments(user.tenantId, { 
        status: ["PAGO_A_CONCILIAR", "EM_CONCILIACAO"] 
      });
      res.json(documents);
    } catch (error) {
      console.error("Reconciliation error:", error);
      res.status(500).json({ error: "Erro ao carregar conciliação" });
    }
  });

  app.get("/api/documents/archived", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const documents = await storage.getDocuments(user.tenantId, { status: "ARQUIVADO" });
      res.json(documents);
    } catch (error) {
      console.error("Archived error:", error);
      res.status(500).json({ error: "Erro ao carregar arquivados" });
    }
  });

  // Async document processing function
  async function processDocumentAsync(documentId: string, tenantId: string) {
    try {
      // Update status to VALIDATING
      await storage.updateDocument(documentId, tenantId, { status: "VALIDANDO" });
      
      await storage.createDocumentLog({
        documentId,
        action: "PROCESSING_START",
        status: "SUCCESS",
        details: { stage: "OCR" },
      });

      // Get document
      const document = await storage.getDocument(documentId, tenantId);
      if (!document) return;

      // Process with OCR
      const ocrResult = await processDocumentWithOCR(document.filePath);
      
      // Process with AI
      const aiResult = await analyzeDocumentWithAI(ocrResult.text, document.fileName);

      // Cross-validation logic
      const validationResult = performCrossValidation(document, ocrResult, aiResult);

      // Update document with results
      const updates: any = {
        ocrText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
        aiAnalysis: aiResult,
        aiProvider: aiResult.provider,
      };

      if (validationResult.isValid) {
        updates.status = "CLASSIFICADO";
        updates.isValidated = true;
        
        // Apply AI extracted values if validation passes
        if (aiResult.amount && !document.amount) {
          updates.amount = aiResult.amount;
        }
        if (aiResult.dueDate && !document.dueDate) {
          updates.dueDate = new Date(aiResult.dueDate);
        }
      } else {
        updates.status = "PENDENTE_REVISAO";
        updates.validationErrors = validationResult.errors;
      }

      await storage.updateDocument(documentId, tenantId, updates);

      await storage.createDocumentLog({
        documentId,
        action: "PROCESSING_COMPLETE",
        status: validationResult.isValid ? "SUCCESS" : "NEEDS_REVIEW",
        details: {
          ocrConfidence: ocrResult.confidence,
          aiProvider: aiResult.provider,
          validationResult,
        },
      });

    } catch (error) {
      console.error("Document processing error:", error);
      
      await storage.updateDocument(documentId, tenantId, {
        status: "PENDENTE_REVISAO",
        validationErrors: [{ type: "PROCESSING_ERROR", message: "Erro no processamento automático" }],
      });

      await storage.createDocumentLog({
        documentId,
        action: "PROCESSING_ERROR",
        status: "ERROR",
        details: { error: error.message },
      });
    }
  }

  function performCrossValidation(document: any, ocrResult: any, aiResult: any) {
    const errors: any[] = [];
    
    // Check OCR confidence
    if (ocrResult.confidence < 80) {
      errors.push({
        type: "LOW_OCR_CONFIDENCE",
        message: `Baixa confiança no OCR: ${ocrResult.confidence}%`,
      });
    }

    // Cross-validate amount if provided
    if (document.amount && aiResult.amount) {
      const docAmount = Number(document.amount);
      const aiAmount = Number(aiResult.amount);
      const variance = Math.abs(docAmount - aiAmount) / docAmount;
      
      if (variance > 0.1) { // 10% tolerance
        errors.push({
          type: "AMOUNT_MISMATCH",
          message: `Divergência no valor: Manual R$ ${docAmount} vs IA R$ ${aiAmount}`,
        });
      }
    }

    // Validate filename patterns
    const filename = document.fileName.toLowerCase();
    if (document.documentType === "PAGO" && !filename.includes("pag")) {
      errors.push({
        type: "FILENAME_MISMATCH",
        message: "Nome do arquivo não condiz com tipo 'Pago'",
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  const httpServer = createServer(app);
  return httpServer;
}
