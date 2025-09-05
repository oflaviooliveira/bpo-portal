import { 
  users, clients, contrapartes, tenants, banks, categories, costCenters, documents, documentLogs, aiRuns, documentInconsistencies, ocrMetrics,
  type User, type InsertUser, type Tenant, type InsertTenant, 
  type Client, type InsertClient, type Contraparte, type InsertContraparte, type Document, type InsertDocument,
  type Bank, type Category, type CostCenter, type DocumentLog,
  type InsertCategory, type InsertCostCenter, type AiRun, type DocumentInconsistency
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sum, avg, inArray, gte, lte, lt, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { secureDb } from "./db/secure-queries";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  sessionStore: session.Store;
  
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Tenants
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  
  // Contrapartes
  getContrapartes(tenantId: string, filters?: { canBeClient?: boolean; canBeSupplier?: boolean }): Promise<Contraparte[]>;
  getContraparte(id: string, tenantId: string): Promise<Contraparte | undefined>;
  createContraparte(contraparte: InsertContraparte): Promise<Contraparte>;
  updateContraparte(id: string, tenantId: string, updates: Partial<Contraparte>): Promise<Contraparte>;
  findOrCreateContraparte(name: string, tenantId: string, extraData?: Partial<InsertContraparte>): Promise<Contraparte>;
  
  // Clients (Legacy)
  getClients(tenantId: string): Promise<Client[]>;
  getClient(id: string, tenantId: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  
  // Banks
  getBanks(): Promise<Bank[]>;
  getBank(id: string): Promise<Bank | undefined>;
  
  // Categories
  getCategories(tenantId: string): Promise<Category[]>;
  getCategory(id: string, tenantId: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, tenantId: string, updates: Partial<Category>): Promise<Category>;
  deleteCategory(id: string, tenantId: string): Promise<void>;
  
  // Cost Centers
  getCostCenters(tenantId: string): Promise<CostCenter[]>;
  getCostCenter(id: string, tenantId: string): Promise<CostCenter | undefined>;
  createCostCenter(costCenter: InsertCostCenter): Promise<CostCenter>;
  updateCostCenter(id: string, tenantId: string, updates: Partial<CostCenter>): Promise<CostCenter>;
  deleteCostCenter(id: string, tenantId: string): Promise<void>;
  
  // Documents
  getDocuments(tenantId: string, filters?: any): Promise<Document[]>;
  getDocument(id: string, tenantId: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, tenantId: string, updates: Partial<Document>): Promise<Document>;
  deleteDocuments(ids: string[], tenantId: string): Promise<void>;
  
  // Dashboard stats
  getDashboardStats(tenantId: string): Promise<{
    totalDocuments: number;
    pendingReview: number;
    processedToday: number;
    totalAmount: number;
    avgProcessingTime: number;
  }>;
  
  // Document logs
  createDocumentLog(log: {
    documentId: string;
    action: string;
    status: string;
    details?: any;
    userId?: string;
  }): Promise<DocumentLog>;
  
  // Tasks
  createTask(taskData: {
    documentId: string;
    tenantId: string;
    type: string;
    status: string;
    priority: string;
    title: string;
    description: string;
    payload?: any;
  }): Promise<void>;

  // AI Runs
  getAiRuns(tenantId: string, filters?: {
    dateFrom?: Date;
    limit?: number;
  }): Promise<AiRun[]>;

  // OCR Metrics
  createOcrMetrics(metrics: {
    documentId: string;
    tenantId: string;
    strategyUsed: string;
    success: boolean;
    processingTimeMs: number;
    characterCount: number;
    confidence: number;
    fallbackLevel: number;
    metadata?: any;
  }): Promise<void>;
  
  getOcrMetrics(tenantId: string, filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  }): Promise<any[]>;
  
  getOcrMetricsByDocument(documentId: string): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant || undefined;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return tenant || undefined;
  }

  async createTenant(insertTenant: InsertTenant): Promise<Tenant> {
    const [tenant] = await db
      .insert(tenants)
      .values(insertTenant)
      .returning();
    return tenant;
  }

  async getClients(tenantId: string): Promise<Client[]> {
    return await db
      .select()
      .from(clients)
      .where(and(eq(clients.tenantId, tenantId), eq(clients.isActive, true)))
      .orderBy(clients.name);
  }

  async getClient(id: string, tenantId: string): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)));
    return client || undefined;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db
      .insert(clients)
      .values(insertClient)
      .returning();
    return client;
  }

  // Contrapartes methods
  async getContrapartes(tenantId: string, filters?: { canBeClient?: boolean; canBeSupplier?: boolean }): Promise<Contraparte[]> {
    let additionalFilters;
    const conditions = [eq(contrapartes.isActive, true)];
    
    if (filters?.canBeClient !== undefined) {
      conditions.push(eq(contrapartes.canBeClient, filters.canBeClient));
    }
    
    if (filters?.canBeSupplier !== undefined) {
      conditions.push(eq(contrapartes.canBeSupplier, filters.canBeSupplier));
    }
    
    additionalFilters = conditions.length > 1 ? and(...conditions) : conditions[0];
    return await secureDb.contrapartes.findMany(tenantId, additionalFilters);
  }

  async getContraparte(id: string, tenantId: string): Promise<Contraparte | undefined> {
    return await secureDb.contrapartes.findById(tenantId, id);
  }

  async createContraparte(insertContraparte: InsertContraparte): Promise<Contraparte> {
    return await secureDb.contrapartes.create(insertContraparte.tenantId, insertContraparte);
  }

  async updateContraparte(id: string, tenantId: string, updates: Partial<Contraparte>): Promise<Contraparte> {
    const updateData = { ...updates, updatedAt: new Date() };
    return await secureDb.contrapartes.update(tenantId, id, updateData);
  }

  async findOrCreateContraparte(name: string, tenantId: string, extraData?: Partial<InsertContraparte>): Promise<Contraparte> {
    // Primeiro, tentar encontrar uma contraparte existente pelo nome
    const [existing] = await db.select().from(contrapartes)
      .where(and(
        eq(contrapartes.name, name),
        eq(contrapartes.tenantId, tenantId),
        eq(contrapartes.isActive, true)
      ))
      .limit(1);
    
    if (existing) {
      // Se existe e extraData contém documento, atualizar se necessário
      if (extraData?.document && !existing.document) {
        return this.updateContraparte(existing.id, tenantId, {
          document: extraData.document,
          documentType: extraData.documentType
        });
      }
      return existing;
    }
    
    // Se não encontrou, criar uma nova
    const newContraparte: InsertContraparte = {
      name,
      tenantId,
      canBeClient: true,
      canBeSupplier: true,
      ...extraData
    };
    
    return this.createContraparte(newContraparte);
  }

  async getBanks(): Promise<Bank[]> {
    return await db
      .select()
      .from(banks)
      .where(eq(banks.isActive, true))
      .orderBy(banks.name);
  }

  async getBank(id: string): Promise<Bank | undefined> {
    const [bank] = await db.select().from(banks).where(eq(banks.id, id));
    return bank || undefined;
  }

  async getCategories(tenantId: string): Promise<Category[]> {
    return await db
      .select()
      .from(categories)
      .where(and(eq(categories.tenantId, tenantId), eq(categories.isActive, true)))
      .orderBy(categories.name);
  }

  async getCategory(id: string, tenantId: string): Promise<Category | undefined> {
    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)));
    return category || undefined;
  }

  async getCostCenters(tenantId: string): Promise<CostCenter[]> {
    return await db
      .select()
      .from(costCenters)
      .where(and(eq(costCenters.tenantId, tenantId), eq(costCenters.isActive, true)))
      .orderBy(costCenters.name);
  }

  async getCostCenter(id: string, tenantId: string): Promise<CostCenter | undefined> {
    const [costCenter] = await db
      .select()
      .from(costCenters)
      .where(and(eq(costCenters.id, id), eq(costCenters.tenantId, tenantId)));
    return costCenter || undefined;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: string, tenantId: string, updates: Partial<Category>): Promise<Category> {
    const [updated] = await db.update(categories)
      .set(updates)
      .where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteCategory(id: string, tenantId: string): Promise<void> {
    await db.update(categories)
      .set({ isActive: false })
      .where(and(eq(categories.id, id), eq(categories.tenantId, tenantId)));
  }

  async createCostCenter(costCenter: InsertCostCenter): Promise<CostCenter> {
    const [newCostCenter] = await db.insert(costCenters).values(costCenter).returning();
    return newCostCenter;
  }

  async updateCostCenter(id: string, tenantId: string, updates: Partial<CostCenter>): Promise<CostCenter> {
    const [updated] = await db.update(costCenters)
      .set(updates)
      .where(and(eq(costCenters.id, id), eq(costCenters.tenantId, tenantId)))
      .returning();
    return updated;
  }

  async deleteCostCenter(id: string, tenantId: string): Promise<void> {
    await db.update(costCenters)
      .set({ isActive: false })
      .where(and(eq(costCenters.id, id), eq(costCenters.tenantId, tenantId)));
  }

  async getDocuments(tenantId: string, filters: {
    status?: string | string[];
    clientId?: string | string[];
    dateFrom?: Date;
    dateTo?: Date;
    dueDateFrom?: Date;
    dueDateTo?: Date;
    documentType?: string | string[];
    bankId?: string | string[];
    overdue?: boolean;
  } = {}): Promise<Document[]> {
    const conditions = [eq(documents.tenantId, tenantId)];

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push(inArray(documents.status, filters.status));
      } else {
        conditions.push(eq(documents.status, filters.status));
      }
    }

    if (filters.documentType) {
      if (Array.isArray(filters.documentType)) {
        conditions.push(inArray(documents.documentType, filters.documentType));
      } else {
        conditions.push(eq(documents.documentType, filters.documentType));
      }
    }

    if (filters.clientId && filters.clientId !== '') {
      if (Array.isArray(filters.clientId)) {
        const validIds = filters.clientId.filter(id => id && id !== '');
        if (validIds.length > 0) {
          conditions.push(inArray(documents.clientId, validIds));
        }
      } else {
        conditions.push(eq(documents.clientId, filters.clientId));
      }
    }

    if (filters.bankId && filters.bankId !== '') {
      if (Array.isArray(filters.bankId)) {
        const validIds = filters.bankId.filter(id => id && id !== '');
        if (validIds.length > 0) {
          conditions.push(inArray(documents.bankId, validIds));
        }
      } else {
        conditions.push(eq(documents.bankId, filters.bankId));
      }
    }

    // Date filters for scheduled documents
    if (filters.dueDateFrom) {
      conditions.push(gte(documents.dueDate, new Date(filters.dueDateFrom)));
    }

    if (filters.dueDateTo) {
      if (filters.overdue) {
        conditions.push(lt(documents.dueDate, new Date(filters.dueDateTo)));
      } else {
        conditions.push(lte(documents.dueDate, new Date(filters.dueDateTo)));
      }
    }

    // Buscar documentos com inconsistências
    const docsWithInconsistencies = await db
      .select({
        id: documents.id,
        tenantId: documents.tenantId,
        contraparteId: documents.contraparteId,
        relationshipType: documents.relationshipType,
        clientId: documents.clientId,
        bankId: documents.bankId,
        categoryId: documents.categoryId,
        costCenterId: documents.costCenterId,
        fileName: documents.fileName,
        originalName: documents.originalName,
        fileSize: documents.fileSize,
        mimeType: documents.mimeType,
        filePath: documents.filePath,
        documentType: documents.documentType,
        amount: documents.amount,
        supplier: documents.supplier,
        description: documents.description,
        competenceDate: documents.competenceDate,
        dueDate: documents.dueDate,
        paidDate: documents.paidDate,
        issuerData: documents.issuerData,
        instructions: documents.instructions,
        status: documents.status,
        ocrText: documents.ocrText,
        ocrConfidence: documents.ocrConfidence,
        aiAnalysis: documents.aiAnalysis,
        aiProvider: documents.aiProvider,
        validationErrors: documents.validationErrors,
        isValidated: documents.isValidated,
        validatedBy: documents.validatedBy,
        validatedAt: documents.validatedAt,
        notes: documents.notes,
        isReadyForBpo: documents.isReadyForBpo,
        createdBy: documents.createdBy,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
        inconsistencies: sql<any[]>`
          COALESCE(
            json_agg(
              CASE 
                WHEN ${documentInconsistencies.id} IS NOT NULL 
                THEN json_build_object(
                  'type', CASE 
                    WHEN ${documentInconsistencies.field} = 'amount' THEN 'INCONSISTENCIA_AMOUNT'
                    WHEN ${documentInconsistencies.field} = 'supplier' THEN 'INCONSISTENCIA_SUPPLIER'
                    WHEN ${documentInconsistencies.field} = 'due_date' THEN 'INCONSISTENCIA_DATE'
                    ELSE 'INCONSISTENCIA_GENERAL'
                  END,
                  'field', ${documentInconsistencies.field},
                  'message', CONCAT(
                    'Inconsistência detectada em ', ${documentInconsistencies.field}, 
                    ': OCR="', COALESCE(${documentInconsistencies.ocrValue}, 'N/A'), 
                    '", IA="', COALESCE(${documentInconsistencies.filenameValue}, 'N/A'), '"'
                  )
                )
                ELSE NULL 
              END
            ) FILTER (WHERE ${documentInconsistencies.id} IS NOT NULL),
            '[]'::json
          )
        `
      })
      .from(documents)
      .leftJoin(documentInconsistencies, eq(documents.id, documentInconsistencies.documentId))
      .where(and(...conditions))
      .groupBy(documents.id)
      .orderBy(desc(documents.createdAt));

    // Mapear os resultados para incluir extractedData corretamente
    return docsWithInconsistencies.map(doc => ({
      id: doc.id,
      tenantId: doc.tenantId,
      contraparteId: doc.contraparteId,
      relationshipType: doc.relationshipType,
      clientId: doc.clientId,
      bankId: doc.bankId,
      categoryId: doc.categoryId,
      costCenterId: doc.costCenterId,
      fileName: doc.fileName,
      originalName: doc.originalName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      filePath: doc.filePath,
      documentType: doc.documentType,
      amount: doc.amount,
      supplier: doc.supplier,
      description: doc.description,
      competenceDate: doc.competenceDate,
      dueDate: doc.dueDate,
      paidDate: doc.paidDate,
      issuerData: doc.issuerData,
      instructions: doc.instructions,
      status: doc.status,
      ocrText: doc.ocrText,
      ocrConfidence: doc.ocrConfidence,
      aiAnalysis: doc.aiAnalysis,
      aiProvider: doc.aiProvider,
      validationErrors: doc.validationErrors,
      isValidated: doc.isValidated,
      validatedBy: doc.validatedBy,
      validatedAt: doc.validatedAt,
      notes: doc.notes,
      isReadyForBpo: doc.isReadyForBpo,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      extractedData: doc.aiAnalysis, // aiAnalysis contém os dados extraídos
      tasks: doc.inconsistencies || []
    }));
  }

  async getDocument(id: string, tenantId: string): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)));
    return document || undefined;
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(insertDocument)
      .returning();
    return document;
  }

  async updateDocument(id: string, tenantId: string, updates: Partial<Document>): Promise<Document> {
    const [document] = await db
      .update(documents)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)))
      .returning();
    return document;
  }

  async deleteDocuments(ids: string[], tenantId: string): Promise<void> {
    // Primeiro, remove inconsistências relacionadas
    await db.delete(documentInconsistencies)
      .where(inArray(documentInconsistencies.documentId, ids));
    
    // Remove logs relacionados
    await db.delete(documentLogs)
      .where(inArray(documentLogs.documentId, ids));
    
    // Remove runs de IA relacionados
    await db.delete(aiRuns)
      .where(inArray(aiRuns.documentId, ids));
    
    // Por fim, remove os documentos
    await db.delete(documents)
      .where(and(
        inArray(documents.id, ids),
        eq(documents.tenantId, tenantId)
      ));
  }

  async getDashboardStats(tenantId: string): Promise<{
    totalDocuments: number;
    pendingReview: number;
    processedToday: number;
    totalAmount: number;
    avgProcessingTime: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [stats] = await db
      .select({
        totalDocuments: count(),
        totalAmount: sum(documents.amount),
      })
      .from(documents)
      .where(eq(documents.tenantId, tenantId));

    const [pendingCount] = await db
      .select({ count: count() })
      .from(documents)
      .where(and(
        eq(documents.tenantId, tenantId),
        eq(documents.status, "PENDENTE_REVISAO")
      ));

    const [todayCount] = await db
      .select({ count: count() })
      .from(documents)
      .where(and(
        eq(documents.tenantId, tenantId),
        eq(documents.status, "CLASSIFICADO")
      ));

    return {
      totalDocuments: stats.totalDocuments || 0,
      pendingReview: pendingCount.count || 0,
      processedToday: todayCount.count || 0,
      totalAmount: Number(stats.totalAmount) || 0,
      avgProcessingTime: 94, // Mock for now - would calculate from logs
    };
  }

  async createDocumentLog(log: {
    documentId: string;
    action: string;
    status: string;
    details?: any;
    userId?: string;
  }): Promise<DocumentLog> {
    const [documentLog] = await db
      .insert(documentLogs)
      .values({
        ...log,
        details: log.details ? JSON.stringify(log.details) : null,
      })
      .returning();
    return documentLog;
  }

  // AI Runs methods
  async createAiRun(aiRunData: {
    documentId: string;
    tenantId: string;
    providerUsed: string;
    fallbackReason?: string | null;
    ocrStrategy: string;
    processingTimeMs: number;
    tokensIn: number;
    tokensOut: number;
    costUsd: string;
    confidence: number;
  }): Promise<AiRun> {
    const [aiRun] = await db.insert(aiRuns).values(aiRunData).returning();
    return aiRun;
  }

  async getAiRunsByDocument(documentId: string): Promise<AiRun[]> {
    return await db.select().from(aiRuns).where(eq(aiRuns.documentId, documentId));
  }

  async getAiRuns(tenantId: string, filters?: {
    provider?: string;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  }): Promise<AiRun[]> {
    const conditions = [eq(documents.tenantId, tenantId)];

    if (filters?.provider) {
      conditions.push(eq(aiRuns.providerUsed, filters.provider));
    }
    
    if (filters?.dateFrom) {
      conditions.push(gte(aiRuns.createdAt, filters.dateFrom));
    }
    
    if (filters?.dateTo) {
      conditions.push(lte(aiRuns.createdAt, filters.dateTo));
    }

    const results = await db.select({
      id: aiRuns.id,
      documentId: aiRuns.documentId,
      tenantId: aiRuns.tenantId,
      providerUsed: aiRuns.providerUsed,
      fallbackReason: aiRuns.fallbackReason,
      ocrStrategy: aiRuns.ocrStrategy,
      processingTimeMs: aiRuns.processingTimeMs,
      tokensIn: aiRuns.tokensIn,
      tokensOut: aiRuns.tokensOut,
      costUsd: aiRuns.costUsd,
      confidence: aiRuns.confidence,
      createdAt: aiRuns.createdAt
    })
      .from(aiRuns)
      .innerJoin(documents, eq(aiRuns.documentId, documents.id))
      .where(and(...conditions))
      .orderBy(desc(aiRuns.createdAt))
      .limit(filters?.limit || 1000);

    return results;
  }

  // Document Inconsistencies methods
  async createDocumentInconsistency(inconsistencyData: {
    documentId: string;
    field: string;
    ocrValue?: string;
    filenameValue?: string;
    formValue?: string;
  }): Promise<DocumentInconsistency> {
    const [inconsistency] = await db.insert(documentInconsistencies).values(inconsistencyData).returning();
    return inconsistency;
  }

  async getDocumentInconsistencies(documentId: string): Promise<DocumentInconsistency[]> {
    return await db.select().from(documentInconsistencies).where(eq(documentInconsistencies.documentId, documentId));
  }

  async deleteDocumentInconsistencies(documentId: string): Promise<void> {
    await db.delete(documentInconsistencies).where(eq(documentInconsistencies.documentId, documentId));
  }

  async createTask(taskData: {
    documentId: string;
    tenantId: string;
    type: string;
    status: string;
    priority: string;
    title: string;
    description: string;
    payload?: any;
  }): Promise<void> {
    // For now, just log the task creation since tasks table needs to be imported
    console.log(`📋 Criando tarefa: ${taskData.type} para documento ${taskData.documentId}`);
    console.log(`   Título: ${taskData.title}`);
    console.log(`   Prioridade: ${taskData.priority}`);
    
    // TODO: Implementar inserção real na tabela tasks quando schema for atualizado
  }

  // OCR Metrics methods
  async createOcrMetrics(metrics: {
    documentId: string;
    tenantId: string;
    strategyUsed: string;
    success: boolean;
    processingTimeMs: number | null;
    characterCount: number;
    confidence: number;
    fallbackLevel: number;
    metadata?: any;
  }): Promise<void> {
    await db.insert(ocrMetrics).values({
      ...metrics,
      processingTimeMs: metrics.processingTimeMs || null,
      metadata: metrics.metadata ? JSON.stringify(metrics.metadata) : null
    });
  }

  async getOcrMetrics(tenantId: string, filters?: {
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
  }): Promise<any[]> {
    const conditions = [eq(ocrMetrics.tenantId, tenantId)];

    if (filters?.dateFrom) {
      conditions.push(gte(ocrMetrics.createdAt, filters.dateFrom));
    }
    
    if (filters?.dateTo) {
      conditions.push(lte(ocrMetrics.createdAt, filters.dateTo));
    }

    return await db.select()
      .from(ocrMetrics)
      .where(and(...conditions))
      .orderBy(desc(ocrMetrics.createdAt))
      .limit(filters?.limit || 1000);
  }

  async getOcrMetricsByDocument(documentId: string): Promise<any[]> {
    return await db.select().from(ocrMetrics).where(eq(ocrMetrics.documentId, documentId))
      .orderBy(desc(ocrMetrics.createdAt));
  }
}

export const storage = new DatabaseStorage();
