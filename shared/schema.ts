import { sql } from "drizzle-orm";
import { pgTable, text, varchar, uuid, timestamp, integer, decimal, jsonb, boolean, real, unique, index } from "drizzle-orm/pg-core";
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
  role: varchar("role", { length: 50 }).notNull().default("CLIENT_USER"), // SUPER_ADMIN (CEO Gquicks), CLIENT_USER (cliente único)
  tenantId: uuid("tenant_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint por tenant para username e email
  uniqueUsername: unique().on(table.tenantId, table.username),
  uniqueEmail: unique().on(table.tenantId, table.email),
  // Índice para performance
  tenantIdx: index().on(table.tenantId),
}));

// Tenants table for multi-tenant support
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contrapartes table - Estrutura completa: Nome + CNPJ + Dados completos para boletos
export const contrapartes = pgTable("contrapartes", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  document: varchar("document", { length: 18 }), // CPF: XXX.XXX.XXX-XX ou CNPJ: XX.XXX.XXX/XXXX-XX
  documentType: varchar("document_type", { length: 4 }), // "CPF" ou "CNPJ"
  
  // Dados de contato
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  contactName: varchar("contact_name", { length: 255 }), // Pessoa de contato
  
  // Documentação adicional
  stateRegistration: varchar("state_registration", { length: 50 }), // Inscrição Estadual - opcional
  
  // Endereço completo
  street: varchar("street", { length: 255 }),
  number: varchar("number", { length: 20 }),
  complement: varchar("complement", { length: 100 }),
  neighborhood: varchar("neighborhood", { length: 100 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }), // UF (SP, RJ, etc.)
  zipCode: varchar("zip_code", { length: 10 }), // CEP: XXXXX-XXX
  
  // Controle
  canBeClient: boolean("can_be_client").notNull().default(true),
  canBeSupplier: boolean("can_be_supplier").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint por tenant para documento
  uniqueDocument: unique().on(table.tenantId, table.document),
  // Índice para performance
  tenantIdx: index().on(table.tenantId),
}));

// Legacy Clients table (manter por compatibilidade temporária)
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
}, (table) => ({
  // Unique constraint por tenant para nome
  uniqueName: unique().on(table.tenantId, table.name),
  // Índice para performance
  tenantIdx: index().on(table.tenantId),
}));

// Cost centers
export const costCenters = pgTable("cost_centers", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Unique constraint por tenant para nome
  uniqueName: unique().on(table.tenantId, table.name),
  // Índice para performance
  tenantIdx: index().on(table.tenantId),
}));

// Documents table - main entity  
export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull(),

  // Nova estrutura com contrapartes unificadas
  contraparteId: uuid("contraparte_id"), // FK para contrapartes table
  relationshipType: varchar("relationship_type", { length: 20 }), // CLIENT ou SUPPLIER (calculado automaticamente)

  // Campos legacy (manter por compatibilidade)
  clientId: uuid("client_id"), // Manter para migração gradual

  bankId: uuid("bank_id"),
  categoryId: uuid("category_id"),
  costCenterId: uuid("cost_center_id"),

  // Document info
  fileName: varchar("file_name", { length: 500 }).notNull(),
  originalName: varchar("original_name", { length: 500 }).notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  filePath: text("file_path").notNull(),

  // Business data - Tipos conforme PRD
  documentType: varchar("document_type", { length: 50 }).notNull(), // PAGO, AGENDADO, EMITIR_BOLETO, EMITIR_NF
  amount: decimal("amount", { precision: 15, scale: 2 }),
  supplier: varchar("supplier", { length: 255 }), // LEGACY: Nome do fornecedor/cliente (ex: Uber, Posto Shell)
  description: text("description"), // Descrição detalhada (ex: Corrida 01/05 - Centro ao Aeroporto)

  // Datas obrigatórias para BPO
  competenceDate: timestamp("competence_date"), // Data de Competência (quando a despesa/receita pertence)
  dueDate: timestamp("due_date"), // Data de Vencimento
  paidDate: timestamp("paid_date"), // Data de Pagamento (se aplicável)

  // Campos específicos para emissão de boletos/NF
  issuerData: jsonb("issuer_data"), // Dados do tomador para boletos/NF
  instructions: text("instructions"), // Instruções específicas

  // Processing status - Estados conforme PRD Wave 1
  status: varchar("status", { length: 50 }).notNull().default("RECEBIDO"), // RECEBIDO, VALIDANDO, PENDENTE_REVISAO, PAGO_A_CONCILIAR, AGENDADO, A_PAGAR_HOJE, AGUARDANDO_RECEBIMENTO, EM_CONCILIACAO, ARQUIVADO

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
  notes: text("notes"), // Observações (opcional)
  isReadyForBpo: boolean("is_ready_for_bpo").notNull().default(false), // Flag para indicar se todos os campos obrigatórios estão preenchidos
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

// AI Runs table - Nova tabela para rastreabilidade de IA
export const aiRuns = pgTable("ai_runs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: uuid("document_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  providerUsed: varchar("provider_used", { length: 50 }).notNull(), // 'glm', 'openai'
  fallbackReason: varchar("fallback_reason", { length: 100 }), // 'timeout', 'invalid_json', 'error', 'low_confidence'
  ocrStrategy: varchar("ocr_strategy", { length: 50 }).notNull(), // 'pdf', 'image', 'filename_fallback'
  processingTimeMs: integer("processing_time_ms").notNull(),
  tokensIn: integer("tokens_in").notNull(),
  tokensOut: integer("tokens_out").notNull(),
  costUsd: decimal("cost_usd", { precision: 10, scale: 6 }).notNull(),
  confidence: real("confidence").notNull(), // 0-100 (aceita decimais)
  createdAt: timestamp("created_at").defaultNow(),
});

// OCR Metrics table - Nova tabela para rastreabilidade detalhada do OCR
export const ocrMetrics = pgTable("ocr_metrics", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: uuid("document_id").notNull(),
  tenantId: uuid("tenant_id").notNull(),
  strategyUsed: varchar("strategy_used", { length: 50 }).notNull(), // 'PDF_DIRECT_TEXT', 'PDFTOTEXT_COMMAND', etc.
  success: boolean("success").notNull(),
  processingTimeMs: integer("processing_time_ms"), // Allow null for failed strategies
  characterCount: integer("character_count").notNull(),
  confidence: integer("confidence").notNull(), // 0-100
  fallbackLevel: integer("fallback_level").notNull().default(0), // 0 = primeira tentativa, 1+ = fallbacks
  metadata: jsonb("metadata"), // dados específicos da estratégia
  createdAt: timestamp("created_at").defaultNow(),
});

// Document Inconsistencies table - Nova tabela para divergências
export const documentInconsistencies = pgTable("document_inconsistencies", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: uuid("document_id").notNull(),
  field: varchar("field", { length: 50 }).notNull(), // 'valor', 'data_pagamento', 'competencia', 'categoria', 'centro_custo', 'fornecedor'
  ocrValue: text("ocr_value"),
  filenameValue: text("filename_value"),
  formValue: text("form_value"),
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
  contrapartes: many(contrapartes),
  clients: many(clients),
  categories: many(categories),
  costCenters: many(costCenters),
  documents: many(documents),
}));

export const contrapartesRelations = relations(contrapartes, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [contrapartes.tenantId],
    references: [tenants.id],
  }),
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
  contraparte: one(contrapartes, {
    fields: [documents.contraparteId],
    references: [contrapartes.id],
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

export const aiRunsRelations = relations(aiRuns, ({ one }) => ({
  document: one(documents, {
    fields: [aiRuns.documentId],
    references: [documents.id],
  }),
  tenant: one(tenants, {
    fields: [aiRuns.tenantId],
    references: [tenants.id],
  }),
}));

export const documentInconsistenciesRelations = relations(documentInconsistencies, ({ one }) => ({
  document: one(documents, {
    fields: [documentInconsistencies.documentId],
    references: [documents.id],
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

export const insertContraparteSchema = createInsertSchema(contrapartes).pick({
  tenantId: true,
  name: true,
  document: true,
  documentType: true,
  canBeClient: true,
  canBeSupplier: true,
});

export const insertClientSchema = createInsertSchema(clients).pick({
  tenantId: true,
  name: true,
  document: true,
  email: true,
  phone: true,
});

export const insertCategorySchema = createInsertSchema(categories).pick({
  tenantId: true,
  name: true,
  description: true,
});

export const insertCostCenterSchema = createInsertSchema(costCenters).pick({
  tenantId: true,
  name: true,
  description: true,
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  tenantId: true,
  contraparteId: true,
  relationshipType: true,
  clientId: true, // Legacy
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
  supplier: true, // Legacy field for supplier name
  description: true,
  dueDate: true,
  paidDate: true,
  issuerData: true,
  instructions: true,
  status: true,
  notes: true,
  createdBy: true,
});

export const insertDocumentLogSchema = createInsertSchema(documentLogs).pick({
  documentId: true,
  action: true,
  status: true,
  details: true,
  userId: true,
});

export const insertAiRunSchema = createInsertSchema(aiRuns).pick({
  documentId: true,
  tenantId: true,
  providerUsed: true,
  fallbackReason: true,
  ocrStrategy: true,
  processingTimeMs: true,
  tokensIn: true,
  tokensOut: true,
  costUsd: true,
  confidence: true,
});

export const insertDocumentInconsistencySchema = createInsertSchema(documentInconsistencies).pick({
  documentId: true,
  field: true,
  ocrValue: true,
  filenameValue: true,
  formValue: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

export type InsertContraparte = z.infer<typeof insertContraparteSchema>;
export type Contraparte = typeof contrapartes.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertCostCenter = z.infer<typeof insertCostCenterSchema>;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertAiRun = z.infer<typeof insertAiRunSchema>;
export type AiRun = typeof aiRuns.$inferSelect;

export type InsertDocumentInconsistency = z.infer<typeof insertDocumentInconsistencySchema>;
export type DocumentInconsistency = typeof documentInconsistencies.$inferSelect;

export type InsertDocumentLog = z.infer<typeof insertDocumentLogSchema>;

// 🤖 NOVA: Tabela de preferências do usuário por fornecedor
export const userSupplierPreferences = pgTable("user_supplier_preferences", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull(),
  userId: uuid("user_id").notNull(),
  supplierId: uuid("supplier_id").notNull(), // referencia contrapartes
  
  // Preferências operacionais aprendidas
  preferredBankId: uuid("preferred_bank_id"),
  preferredCategoryId: uuid("preferred_category_id"), 
  preferredCostCenterId: uuid("preferred_cost_center_id"),
  
  // Descrição padrão personalizada (opcional)
  customDescription: text("custom_description"),
  
  // Métricas de confiança
  usageCount: integer("usage_count").notNull().default(1),
  lastUsedAt: timestamp("last_used_at").defaultNow(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint: um usuário tem uma preferência por fornecedor
  uniqueUserSupplier: unique().on(table.tenantId, table.userId, table.supplierId),
  // Índices para performance
  tenantIdx: index().on(table.tenantId),
  userIdx: index().on(table.userId),
  supplierIdx: index().on(table.supplierId),
}));

export const insertUserSupplierPreferencesSchema = createInsertSchema(userSupplierPreferences);

export type Bank = typeof banks.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type CostCenter = typeof costCenters.$inferSelect;
export type DocumentLog = typeof documentLogs.$inferSelect;
export type InsertUserSupplierPreferences = z.infer<typeof insertUserSupplierPreferencesSchema>;
export type UserSupplierPreferences = typeof userSupplierPreferences.$inferSelect;