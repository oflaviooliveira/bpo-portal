import { db } from '../db';
import { eq, and } from 'drizzle-orm';
import { users, documents, contrapartes, categories, costCenters } from '@shared/schema';

/**
 * QUERIES SEGURAS COM FILTRO DE TENANT FORÇADO
 * Esta implementação garante isolamento através de filtros WHERE explícitos
 * em vez de confiar apenas no RLS do PostgreSQL
 */

export interface SecureDb {
  users: {
    findMany: (tenantId: string, filters?: any) => Promise<any[]>;
    findById: (tenantId: string, id: string) => Promise<any | null>;
    create: (tenantId: string, data: any) => Promise<any>;
    update: (tenantId: string, id: string, data: any) => Promise<any>;
    delete: (tenantId: string, id: string) => Promise<void>;
  };
  documents: {
    findMany: (tenantId: string, filters?: any) => Promise<any[]>;
    findById: (tenantId: string, id: string) => Promise<any | null>;
    create: (tenantId: string, data: any) => Promise<any>;
    update: (tenantId: string, id: string, data: any) => Promise<any>;
    delete: (tenantId: string, id: string) => Promise<void>;
  };
  contrapartes: {
    findMany: (tenantId: string, filters?: any) => Promise<any[]>;
    findById: (tenantId: string, id: string) => Promise<any | null>;
    create: (tenantId: string, data: any) => Promise<any>;
    update: (tenantId: string, id: string, data: any) => Promise<any>;
    delete: (tenantId: string, id: string) => Promise<void>;
  };
  categories: {
    findMany: (tenantId: string, filters?: any) => Promise<any[]>;
    findById: (tenantId: string, id: string) => Promise<any | null>;
    create: (tenantId: string, data: any) => Promise<any>;
    update: (tenantId: string, id: string, data: any) => Promise<any>;
    delete: (tenantId: string, id: string) => Promise<void>;
  };
  costCenters: {
    findMany: (tenantId: string, filters?: any) => Promise<any[]>;
    findById: (tenantId: string, id: string) => Promise<any | null>;
    create: (tenantId: string, data: any) => Promise<any>;
    update: (tenantId: string, id: string, data: any) => Promise<any>;
    delete: (tenantId: string, id: string) => Promise<void>;
  };
}

/**
 * Implementação de queries seguras para USERS
 */
const secureUsers = {
  async findMany(tenantId: string, filters?: any) {
    const baseFilter = eq(users.tenantId, tenantId);
    const whereClause = filters ? and(baseFilter, filters) : baseFilter;
    
    return await db.select().from(users).where(whereClause);
  },

  async findById(tenantId: string, id: string) {
    const result = await db.select()
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.id, id)
      ))
      .limit(1);
    
    return result[0] || null;
  },

  async create(tenantId: string, data: any) {
    const userWithTenant = { ...data, tenantId };
    const result = await db.insert(users).values(userWithTenant).returning();
    return result[0];
  },

  async update(tenantId: string, id: string, data: any) {
    const result = await db.update(users)
      .set(data)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.id, id)
      ))
      .returning();
    
    return result[0];
  },

  async delete(tenantId: string, id: string) {
    await db.delete(users)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.id, id)
      ));
  }
};

/**
 * Implementação de queries seguras para DOCUMENTS
 */
const secureDocuments = {
  async findMany(tenantId: string, filters?: any) {
    const baseFilter = eq(documents.tenantId, tenantId);
    const whereClause = filters ? and(baseFilter, filters) : baseFilter;
    
    return await db.select().from(documents).where(whereClause);
  },

  async findById(tenantId: string, id: string) {
    const result = await db.select()
      .from(documents)
      .where(and(
        eq(documents.tenantId, tenantId),
        eq(documents.id, id)
      ))
      .limit(1);
    
    return result[0] || null;
  },

  async create(tenantId: string, data: any) {
    const docWithTenant = { ...data, tenantId };
    const result = await db.insert(documents).values(docWithTenant).returning();
    return result[0];
  },

  async update(tenantId: string, id: string, data: any) {
    const result = await db.update(documents)
      .set(data)
      .where(and(
        eq(documents.tenantId, tenantId),
        eq(documents.id, id)
      ))
      .returning();
    
    return result[0];
  },

  async delete(tenantId: string, id: string) {
    await db.delete(documents)
      .where(and(
        eq(documents.tenantId, tenantId),
        eq(documents.id, id)
      ));
  }
};

/**
 * Implementação de queries seguras para CONTRAPARTES
 */
const secureContrapartes = {
  async findMany(tenantId: string, filters?: any) {
    const baseFilter = eq(contrapartes.tenantId, tenantId);
    const whereClause = filters ? and(baseFilter, filters) : baseFilter;
    
    return await db.select().from(contrapartes).where(whereClause);
  },

  async findById(tenantId: string, id: string) {
    const result = await db.select()
      .from(contrapartes)
      .where(and(
        eq(contrapartes.tenantId, tenantId),
        eq(contrapartes.id, id)
      ))
      .limit(1);
    
    return result[0] || null;
  },

  async create(tenantId: string, data: any) {
    const dataWithTenant = { ...data, tenantId };
    const result = await db.insert(contrapartes).values(dataWithTenant).returning();
    return result[0];
  },

  async update(tenantId: string, id: string, data: any) {
    const result = await db.update(contrapartes)
      .set(data)
      .where(and(
        eq(contrapartes.tenantId, tenantId),
        eq(contrapartes.id, id)
      ))
      .returning();
    
    return result[0];
  },

  async delete(tenantId: string, id: string) {
    await db.delete(contrapartes)
      .where(and(
        eq(contrapartes.tenantId, tenantId),
        eq(contrapartes.id, id)
      ));
  }
};

/**
 * Implementação de queries seguras para CATEGORIES
 */
const secureCategories = {
  async findMany(tenantId: string, filters?: any) {
    const baseFilter = eq(categories.tenantId, tenantId);
    const whereClause = filters ? and(baseFilter, filters) : baseFilter;
    
    return await db.select().from(categories).where(whereClause);
  },

  async findById(tenantId: string, id: string) {
    const result = await db.select()
      .from(categories)
      .where(and(
        eq(categories.tenantId, tenantId),
        eq(categories.id, id)
      ))
      .limit(1);
    
    return result[0] || null;
  },

  async create(tenantId: string, data: any) {
    const dataWithTenant = { ...data, tenantId };
    const result = await db.insert(categories).values(dataWithTenant).returning();
    return result[0];
  },

  async update(tenantId: string, id: string, data: any) {
    const result = await db.update(categories)
      .set(data)
      .where(and(
        eq(categories.tenantId, tenantId),
        eq(categories.id, id)
      ))
      .returning();
    
    return result[0];
  },

  async delete(tenantId: string, id: string) {
    await db.delete(categories)
      .where(and(
        eq(categories.tenantId, tenantId),
        eq(categories.id, id)
      ));
  }
};

/**
 * Implementação de queries seguras para COST_CENTERS
 */
const secureCostCenters = {
  async findMany(tenantId: string, filters?: any) {
    const baseFilter = eq(costCenters.tenantId, tenantId);
    const whereClause = filters ? and(baseFilter, filters) : baseFilter;
    
    return await db.select().from(costCenters).where(whereClause);
  },

  async findById(tenantId: string, id: string) {
    const result = await db.select()
      .from(costCenters)
      .where(and(
        eq(costCenters.tenantId, tenantId),
        eq(costCenters.id, id)
      ))
      .limit(1);
    
    return result[0] || null;
  },

  async create(tenantId: string, data: any) {
    const dataWithTenant = { ...data, tenantId };
    const result = await db.insert(costCenters).values(dataWithTenant).returning();
    return result[0];
  },

  async update(tenantId: string, id: string, data: any) {
    const result = await db.update(costCenters)
      .set(data)
      .where(and(
        eq(costCenters.tenantId, tenantId),
        eq(costCenters.id, id)
      ))
      .returning();
    
    return result[0];
  },

  async delete(tenantId: string, id: string) {
    await db.delete(costCenters)
      .where(and(
        eq(costCenters.tenantId, tenantId),
        eq(costCenters.id, id)
      ));
  }
};

/**
 * INTERFACE SEGURA - GARANTE ISOLAMENTO DE TENANT
 */
export const secureDb: SecureDb = {
  users: secureUsers,
  documents: secureDocuments,
  contrapartes: secureContrapartes,
  categories: secureCategories,
  costCenters: secureCostCenters,
};

/**
 * Função utilitária para validar se um tenant ID é válido
 */
export function validateTenantId(tenantId: string): boolean {
  if (!tenantId || typeof tenantId !== 'string') {
    return false;
  }
  
  // Validar formato UUID básico
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(tenantId);
}

/**
 * Helper para extrair tenant ID do contexto da requisição
 */
export function extractTenantId(req: any): string | null {
  return req.tenantContext?.tenantId || req.user?.tenantId || null;
}