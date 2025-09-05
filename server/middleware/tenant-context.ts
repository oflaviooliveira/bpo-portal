
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
    // Para usuários não autenticados, limpar contexto RLS
    try {
      await db.execute(sql.raw(`SET app.current_tenant = ''`));
      await db.execute(sql.raw(`SET app.current_user = ''`));
    } catch (error) {
      console.error('❌ Erro ao limpar contexto RLS:', error);
    }
    return next();
  }

  const user = req.user;
  const tenantContext: TenantContext = {
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
  };

  req.tenantContext = tenantContext;

  // Configurar contexto RLS completo (tenant + user)
  try {
    await db.execute(sql.raw(`SET app.current_tenant = '${user.tenantId}'`));
    await db.execute(sql.raw(`SET app.current_user = '${user.id}'`));
    console.log(`🔐 RLS Context: tenant=${user.tenantId}, user=${user.id}, role=${user.role}`);
  } catch (error) {
    console.error('❌ Erro ao configurar contexto RLS:', error);
    return res.status(500).json({ 
      error: 'Erro interno - contexto de segurança não configurado' 
    });
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
