import { 
  users, clients, tenants, banks, categories, costCenters, documents, documentLogs,
  type User, type InsertUser, type Tenant, type InsertTenant, 
  type Client, type InsertClient, type Document, type InsertDocument,
  type Bank, type Category, type CostCenter, type DocumentLog 
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sum, avg } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  sessionStore: session.SessionStore;
  
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Tenants
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantBySlug(slug: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  
  // Clients
  getClients(tenantId: string): Promise<Client[]>;
  getClient(id: string, tenantId: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  
  // Banks
  getBanks(): Promise<Bank[]>;
  getBank(id: string): Promise<Bank | undefined>;
  
  // Categories
  getCategories(tenantId: string): Promise<Category[]>;
  getCategory(id: string, tenantId: string): Promise<Category | undefined>;
  
  // Cost Centers
  getCostCenters(tenantId: string): Promise<CostCenter[]>;
  getCostCenter(id: string, tenantId: string): Promise<CostCenter | undefined>;
  
  // Documents
  getDocuments(tenantId: string, filters?: any): Promise<Document[]>;
  getDocument(id: string, tenantId: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, tenantId: string, updates: Partial<Document>): Promise<Document>;
  
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
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

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

  async getDocuments(tenantId: string, filters: any = {}): Promise<Document[]> {
    const conditions = [eq(documents.tenantId, tenantId)];

    if (filters.status) {
      conditions.push(eq(documents.status, filters.status));
    }

    if (filters.documentType) {
      conditions.push(eq(documents.documentType, filters.documentType));
    }

    if (filters.clientId) {
      conditions.push(eq(documents.clientId, filters.clientId));
    }

    return await db
      .select()
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.createdAt));
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
      .values(log)
      .returning();
    return documentLog;
  }
}

export const storage = new DatabaseStorage();
