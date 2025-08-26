import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, timestamp, integer, decimal, jsonb, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table with RBAC
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  lastName: varchar("last_name", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).notNull().default("OPERADOR"), // ADMIN, GERENTE, OPERADOR
  tenantId: uuid("tenant_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tenants table for multi-tenant support
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Clients table
export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  document: varchar("document", { length: 50 }), // CNPJ/CPF
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Banks table
export const banks = pgTable("banks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 10 }).notNull().unique(), // 341, 237, etc
  name: varchar("name", { length: 255 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// Document categories
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Cost centers
export const costCenters = pgTable("cost_centers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Documents table - main entity
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull(),
  clientId: uuid("client_id").notNull(),
  bankId: uuid("bank_id"),
  categoryId: uuid("category_id"),
  costCenterId: uuid("cost_center_id"),
  
  // Document info
  fileName: varchar("file_name", { length: 500 }).notNull(),
  originalName: varchar("original_name", { length: 500 }).notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  filePath: text("file_path").notNull(),
  
  // Business data
  documentType: varchar("document_type", { length: 50 }).notNull(), // PAGO, AGENDADO, BOLETO, NF
  amount: decimal("amount", { precision: 15, scale: 2 }),
  dueDate: timestamp("due_date"),
  paidDate: timestamp("paid_date"),
  
  // Processing status
  status: varchar("status", { length: 50 }).notNull().default("RECEBIDO"), // RECEBIDO, VALIDANDO, PENDENTE_REVISAO, CLASSIFICADO, ARQUIVADO
  
  // OCR and AI results
  ocrText: text("ocr_text"),
  ocrConfidence: decimal("ocr_confidence", { precision: 5, scale: 2 }),
  aiAnalysis: jsonb("ai_analysis"), // Structured data from AI
  aiProvider: varchar("ai_provider", { length: 50 }), // GLM, GPT, etc
  
  // Validation
  validationErrors: jsonb("validation_errors"),
  isValidated: boolean("is_validated").notNull().default(false),
  validatedBy: uuid("validated_by"),
  validatedAt: timestamp("validated_at"),
  
  // Metadata
  notes: text("notes"),
  createdBy: uuid("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document processing logs
export const documentLogs = pgTable("document_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: uuid("document_id").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  status: varchar("status", { length: 50 }).notNull(),
  details: jsonb("details"),
  userId: uuid("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
  createdDocuments: many(documents, { relationName: "createdBy" }),
  validatedDocuments: many(documents, { relationName: "validatedBy" }),
  logs: many(documentLogs),
}));

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  clients: many(clients),
  categories: many(categories),
  costCenters: many(costCenters),
  documents: many(documents),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [clients.tenantId],
    references: [tenants.id],
  }),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [documents.tenantId],
    references: [tenants.id],
  }),
  client: one(clients, {
    fields: [documents.clientId],
    references: [clients.id],
  }),
  bank: one(banks, {
    fields: [documents.bankId],
    references: [banks.id],
  }),
  category: one(categories, {
    fields: [documents.categoryId],
    references: [categories.id],
  }),
  costCenter: one(costCenters, {
    fields: [documents.costCenterId],
    references: [costCenters.id],
  }),
  createdByUser: one(users, {
    fields: [documents.createdBy],
    references: [users.id],
    relationName: "createdBy",
  }),
  validatedByUser: one(users, {
    fields: [documents.validatedBy],
    references: [users.id],
    relationName: "validatedBy",
  }),
  logs: many(documentLogs),
}));

export const documentLogsRelations = relations(documentLogs, ({ one }) => ({
  document: one(documents, {
    fields: [documentLogs.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [documentLogs.userId],
    references: [users.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  tenantId: true,
});

export const insertTenantSchema = createInsertSchema(tenants).pick({
  name: true,
  slug: true,
});

export const insertClientSchema = createInsertSchema(clients).pick({
  tenantId: true,
  name: true,
  document: true,
  email: true,
  phone: true,
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  tenantId: true,
  clientId: true,
  bankId: true,
  categoryId: true,
  costCenterId: true,
  fileName: true,
  originalName: true,
  fileSize: true,
  mimeType: true,
  filePath: true,
  documentType: true,
  amount: true,
  dueDate: true,
  notes: true,
  createdBy: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type Bank = typeof banks.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type CostCenter = typeof costCenters.$inferSelect;
export type DocumentLog = typeof documentLogs.$inferSelect;
