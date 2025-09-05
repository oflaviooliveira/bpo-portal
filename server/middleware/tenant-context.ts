
import { Request, Response, NextFunction } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';

export interface TenantContext {
  userId: string;
  tenantId: string;
  role: string;
  tenantSlug?: string;
}

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

export async function tenantContextMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return next();
  }

  const user = req.user;
  const tenantContext: TenantContext = {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
  };

  req.tenantContext = tenantContext;

  // Setar contexto tenant no PostgreSQL para RLS
  try {
    // Usar uma conexão direta para setar o contexto de forma segura
    await db.execute(sql.raw(`SET app.current_tenant = '${user.tenantId}'`));
    console.log(`🔐 Tenant context set: ${user.tenantId}`);
  } catch (error) {
    console.error('❌ Erro ao setar tenant context:', error);
  }

  next();
}

export function validateTenantSlug(req: Request, res: Response, next: NextFunction) {
  const { tenantSlug } = req.params;
  const userTenantId = req.tenantContext?.tenantId;
  
  if (!userTenantId) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  // TODO: Implementar validação do slug quando necessário
  // Por enquanto permitir acesso se o usuário estiver autenticado
  next();
}

export function requireTenantContext(req: Request, res: Response, next: NextFunction) {
  if (!req.tenantContext) {
    return res.status(401).json({ error: 'Contexto de tenant obrigatório' });
  }
  next();
}
