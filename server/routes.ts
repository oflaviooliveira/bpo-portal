import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth, isAuthenticated } from "./auth";
import { storage } from "./storage";
import { documentProcessor } from "./document-processor";
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
  documentType: z.enum(['PAGO', 'AGENDADO', 'EMITIR_BOLETO', 'EMITIR_NF']),
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

      // FASE 3: Validação avançada do nome do arquivo
      const { parseFileName, documentValidationSchemas, validateBusinessRules } = await import("./validation");
      const fileNameValidation = parseFileName(file.originalname);
      
      if (!fileNameValidation.isValid && fileNameValidation.errors) {
        console.log(`⚠️ Avisos no nome do arquivo: ${fileNameValidation.errors.join(', ')}`);
      }

      // Validate request body
      const validatedData = uploadDocumentSchema.parse(req.body);

      // FASE 3: Validação específica por tipo de documento
      const documentType = validatedData.documentType;
      const validationSchemas = {
        'PAGO': z.object({
          clientId: z.string().uuid(),
          bankId: z.string().uuid(),
          categoryId: z.string().uuid(),
          amount: z.string(),
          documentType: z.literal('PAGO'),
          notes: z.string().optional(),
        }),
        'AGENDADO': z.object({
          clientId: z.string().uuid(),
          bankId: z.string().uuid(),
          categoryId: z.string().uuid(),
          amount: z.string(),
          dueDate: z.string(),
          documentType: z.literal('AGENDADO'),
          notes: z.string().optional(),
        }),
        'EMITIR_BOLETO': z.object({
          clientId: z.string().uuid(),
          bankId: z.string().uuid(),
          categoryId: z.string().uuid(),
          amount: z.string(),
          dueDate: z.string(),
          documentType: z.literal('EMITIR_BOLETO'),
          notes: z.string().optional(),
        }),
        'EMITIR_NF': z.object({
          clientId: z.string().uuid(),
          categoryId: z.string().uuid(),
          amount: z.string(),
          documentType: z.literal('EMITIR_NF'),
          notes: z.string().optional(),
        })
      };
      
      if (validationSchemas[documentType]) {
        try {
          validationSchemas[documentType].parse(validatedData);
        } catch (validationError) {
          if (validationError instanceof z.ZodError) {
            return res.status(400).json({ 
              error: "Dados inválidos para o tipo de documento selecionado", 
              details: validationError.errors 
            });
          }
        }
      }

      // FASE 3: Validação de regras de negócio
      const businessValidation = { isValid: true, errors: [], warnings: [] };
      // Validação será implementada posteriormente na FASE 3

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
        // FASE 3: Incluir dados de validação (removido temporariamente até implementar no schema)
      });

      // Log document creation
      await storage.createDocumentLog({
        documentId: document.id,
        action: "UPLOAD",
        status: "SUCCESS",
        details: { fileName: file.originalname, fileSize: file.size },
        userId: user.id,
      });

      console.log(`🚀 Iniciando processamento automático para ${document.originalName}`);

      // Process document asynchronously using new processor - FASE 1 IMPLEMENTADA
      processDocumentAsync(document.id, user.tenantId).catch(error => {
        console.error(`Erro no processamento do documento ${document.id}:`, error);
      });

      res.json({ 
        message: "Documento enviado com sucesso. Processamento OCR + IA iniciado automaticamente.",
        documentId: document.id,
        warnings: businessValidation.warnings.length > 0 ? businessValidation.warnings : undefined,
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
      const documents = await storage.getDocuments(user.tenantId, { 
        status: ["ARQUIVADO"] 
      });
      res.json(documents);
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

  const httpServer = createServer(app);
  return httpServer;
}
