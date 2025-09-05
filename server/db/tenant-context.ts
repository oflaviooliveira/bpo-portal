import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Context global para tenant atual
 */
class TenantContext {
  private currentTenantId: string | null = null;

  setTenant(tenantId: string) {
    this.currentTenantId = tenantId;
  }

  clearTenant() {
    this.currentTenantId = null;
  }

  getTenant(): string | null {
    return this.currentTenantId;
  }

  /**
   * Executa query com contexto tenant configurado
   */
  async withTenantContext<T>(callback: () => Promise<T>): Promise<T> {
    if (this.currentTenantId) {
      // Configurar contexto tenant para esta conexão
      await db.execute(sql.raw(`SET LOCAL app.current_tenant = '${this.currentTenantId}'`));
    } else {
      // Limpar contexto tenant
      await db.execute(sql.raw(`SET LOCAL app.current_tenant = ''`));
    }
    
    return await callback();
  }
}

// Instância global
export const tenantContext = new TenantContext();

/**
 * Wrapper para executar queries com contexto tenant
 */
export async function withTenant<T>(tenantId: string | null, callback: () => Promise<T>): Promise<T> {
  const originalTenant = tenantContext.getTenant();
  
  try {
    if (tenantId) {
      tenantContext.setTenant(tenantId);
    } else {
      tenantContext.clearTenant();
    }
    
    return await tenantContext.withTenantContext(callback);
  } finally {
    // Restaurar tenant original
    if (originalTenant) {
      tenantContext.setTenant(originalTenant);
    } else {
      tenantContext.clearTenant();
    }
  }
}

/**
 * Helper para queries tenant-aware
 */
export const tenantDb = {
  async query<T>(tenantId: string | null, callback: () => Promise<T>): Promise<T> {
    return withTenant(tenantId, callback);
  },

  async adminQuery<T>(callback: () => Promise<T>): Promise<T> {
    return withTenant(null, callback);
  }
};