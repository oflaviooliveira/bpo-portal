import { Request, Response } from 'express';
import { db } from '../db';
import { eq, and, count, sql } from 'drizzle-orm';
import { 
  tenants, 
  users, 
  documents, 
  contrapartes, 
  categories, 
  costCenters 
} from '@shared/schema';
import { z } from 'zod';

const resetTenantSchema = z.object({
  confirmText: z.string().min(1, 'Texto de confirmação é obrigatório'),
  resetData: z.object({
    documents: z.boolean().default(false),
    contrapartes: z.boolean().default(false),
    categories: z.boolean().default(false),
    costCenters: z.boolean().default(false),
    keepAdminUser: z.boolean().default(true)
  }).optional()
});

/**
 * Reset completo de um tenant (CUIDADO: ação destrutiva)
 */
export async function resetTenant(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const validationResult = resetTenantSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validationResult.error.errors
      });
    }

    const { confirmText, resetData } = validationResult.data;

    // Buscar o tenant
    const [tenant] = await db.select()
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    if (!tenant) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    // Verificar texto de confirmação
    const expectedText = `RESET ${tenant.name.toUpperCase()}`;
    if (confirmText !== expectedText) {
      return res.status(400).json({
        error: 'Texto de confirmação incorreto',
        expected: expectedText
      });
    }

    console.log(`🚨 Iniciando reset do tenant: ${tenant.name} (${tenantId})`);

    // Executar reset baseado nas opções selecionadas
    const deletionStats = {
      documents: 0,
      contrapartes: 0,
      categories: 0,
      costCenters: 0,
      users: 0
    };

    await db.transaction(async (tx) => {
      // 1. Reset de documentos
      if (resetData?.documents) {
        const deletedDocs = await tx.delete(documents)
          .where(eq(documents.tenantId, tenantId))
          .returning({ id: documents.id });
        deletionStats.documents = deletedDocs.length;
        console.log(`📄 Removidos ${deletionStats.documents} documentos`);
      }

      // 2. Reset de contrapartes
      if (resetData?.contrapartes) {
        const deletedContrapartes = await tx.delete(contrapartes)
          .where(eq(contrapartes.tenantId, tenantId))
          .returning({ id: contrapartes.id });
        deletionStats.contrapartes = deletedContrapartes.length;
        console.log(`🏢 Removidas ${deletionStats.contrapartes} contrapartes`);
      }

      // 3. Reset de categorias
      if (resetData?.categories) {
        const deletedCategories = await tx.delete(categories)
          .where(eq(categories.tenantId, tenantId))
          .returning({ id: categories.id });
        deletionStats.categories = deletedCategories.length;
        console.log(`📋 Removidas ${deletionStats.categories} categorias`);
      }

      // 4. Reset de centros de custo
      if (resetData?.costCenters) {
        const deletedCostCenters = await tx.delete(costCenters)
          .where(eq(costCenters.tenantId, tenantId))
          .returning({ id: costCenters.id });
        deletionStats.costCenters = deletedCostCenters.length;
        console.log(`💰 Removidos ${deletionStats.costCenters} centros de custo`);
      }

      // 5. Reset de usuários (exceto admin se solicitado)
      if (!resetData?.keepAdminUser) {
        const deletedUsers = await tx.delete(users)
          .where(eq(users.tenantId, tenantId))
          .returning({ id: users.id });
        deletionStats.users = deletedUsers.length;
        console.log(`👤 Removidos ${deletionStats.users} usuários`);
      } else {
        // Remover apenas usuários não-admin
        const deletedUsers = await tx.delete(users)
          .where(and(
            eq(users.tenantId, tenantId),
            sql`${users.role} != 'ADMIN'`
          ))
          .returning({ id: users.id });
        deletionStats.users = deletedUsers.length;
        console.log(`👤 Removidos ${deletionStats.users} usuários (mantido admin)`);
      }
    });

    console.log(`✅ Reset do tenant ${tenant.name} concluído com sucesso`);

    res.json({
      message: 'Reset do cliente realizado com sucesso',
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug
      },
      statistics: deletionStats
    });

  } catch (error) {
    console.error('❌ Erro ao fazer reset do tenant:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

/**
 * Estatísticas detalhadas de um tenant específico
 */
export async function getTenantDetails(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;

    // Buscar o tenant
    const [tenant] = await db.select()
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    if (!tenant) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    // Buscar estatísticas detalhadas
    const userStats = await db.select({
      total: count(),
      adminCount: sql<number>`COUNT(CASE WHEN ${users.role} = 'ADMIN' THEN 1 END)`,
      managerCount: sql<number>`COUNT(CASE WHEN ${users.role} = 'GERENTE' THEN 1 END)`,
      operatorCount: sql<number>`COUNT(CASE WHEN ${users.role} = 'OPERADOR' THEN 1 END)`,
      clientCount: sql<number>`COUNT(CASE WHEN ${users.role} = 'CLIENTE' THEN 1 END)`,
      activeCount: sql<number>`COUNT(CASE WHEN ${users.isActive} = true THEN 1 END)`
    }).from(users)
    .where(eq(users.tenantId, tenantId));

    const documentStats = await db.select({
      total: count()
    }).from(documents)
    .where(eq(documents.tenantId, tenantId));

    const contraparteStats = await db.select({
      total: count()
    }).from(contrapartes)
    .where(eq(contrapartes.tenantId, tenantId));

    const categoryStats = await db.select({
      total: count()
    }).from(categories)
    .where(eq(categories.tenantId, tenantId));

    const costCenterStats = await db.select({
      total: count()
    }).from(costCenters)
    .where(eq(costCenters.tenantId, tenantId));

    // Buscar usuários recentes
    const recentUsers = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt
    }).from(users)
    .where(eq(users.tenantId, tenantId))
    .orderBy(sql`${users.createdAt} DESC`)
    .limit(5);

    const response = {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt
      },
      statistics: {
        users: {
          total: Number(userStats[0]?.total || 0),
          byRole: {
            admin: Number(userStats[0]?.adminCount || 0),
            manager: Number(userStats[0]?.managerCount || 0),
            operator: Number(userStats[0]?.operatorCount || 0),
            client: Number(userStats[0]?.clientCount || 0)
          },
          active: Number(userStats[0]?.activeCount || 0)
        },
        documents: {
          total: Number(documentStats[0]?.total || 0)
        },
        contrapartes: {
          total: Number(contraparteStats[0]?.total || 0)
        },
        categories: {
          total: Number(categoryStats[0]?.total || 0)
        },
        costCenters: {
          total: Number(costCenterStats[0]?.total || 0)
        }
      },
      recentUsers: recentUsers.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      }))
    };

    res.json(response);

  } catch (error) {
    console.error('❌ Erro ao buscar detalhes do tenant:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

/**
 * Duplicar configurações básicas de um tenant para outro (versão simplificada)
 */
export async function duplicateTenantConfig(req: Request, res: Response) {
  try {
    const { sourceTenantId } = req.params;
    const { targetTenantId } = req.body;

    if (!targetTenantId) {
      return res.status(400).json({ error: 'ID do tenant de destino é obrigatório' });
    }

    // Verificar se ambos os tenants existem
    const [sourceTenant] = await db.select()
      .from(tenants)
      .where(eq(tenants.id, sourceTenantId));

    const [targetTenant] = await db.select()
      .from(tenants)
      .where(eq(tenants.id, targetTenantId));

    if (!sourceTenant || !targetTenant) {
      return res.status(404).json({ error: 'Um ou ambos os clientes não foram encontrados' });
    }

    console.log(`🔄 Funcionalidade de duplicação em desenvolvimento`);

    res.json({
      message: 'Funcionalidade em desenvolvimento',
      source: {
        id: sourceTenant.id,
        name: sourceTenant.name
      },
      target: {
        id: targetTenant.id,
        name: targetTenant.name
      }
    });

  } catch (error) {
    console.error('❌ Erro ao duplicar configurações do tenant:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}