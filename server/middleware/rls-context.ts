import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

/**
 * Middleware para configurar contexto RLS (Row Level Security)
 * Define app.current_tenant e app.current_user para políticas de segurança
 */
export async function setRLSContext(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    // Para usuários não autenticados, limpar contexto
    try {
      await db.execute(sql.raw(`SET app.current_tenant = ''`));
    } catch (error) {
      console.error('❌ Erro ao limpar contexto RLS:', error);
    }
    return next();
  }

  const user = req.user;
  
  try {
    // Configurar contexto de tenant para RLS
    await db.execute(sql.raw(`SET app.current_tenant = '${user.tenantId}'`));
    
    console.log(`🔐 RLS Context: tenant=${user.tenantId}, user=${user.id}, role=${user.role}`);
  } catch (error) {
    console.error('❌ Erro ao configurar contexto RLS:', error);
    return res.status(500).json({ 
      error: 'Erro interno - contexto de segurança não configurado' 
    });
  }

  next();
}

/**
 * Middleware para rotas de admin que precisam de contexto global
 * Remove restrições de tenant para operações administrativas
 */
export async function setGlobalAdminContext(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const user = req.user;
  
  console.log(`🔍 setGlobalAdminContext - User role: ${user.role}, Expected: ADMIN or SUPER_ADMIN`);
  
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    console.log(`❌ Access denied - Role ${user.role} not allowed`);
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    // Para admins globais, permitir acesso a todos os tenants
    await db.execute(sql.raw(`SET app.current_tenant = ''`));
    
    console.log(`🌐 Global Admin Context: user=${user.id}, unrestricted access`);
  } catch (error) {
    console.error('❌ Erro ao configurar contexto admin global:', error);
    return res.status(500).json({ 
      error: 'Erro interno - contexto admin não configurado' 
    });
  }

  next();
}

/**
 * Middleware para validar que o contexto RLS está configurado
 * Usado em rotas sensíveis para garantir segurança
 */
export async function validateRLSContext(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    // Executar função de validação do PostgreSQL
    await db.execute(sql.raw(`SELECT validate_tenant_context()`));
    console.log('✅ RLS Context validated successfully');
  } catch (error) {
    console.error('❌ RLS Context validation failed:', error);
    return res.status(403).json({ 
      error: 'Contexto de segurança inválido. Acesso negado.' 
    });
  }

  next();
}