import { Request, Response } from 'express';
import { db } from '../db';
import { tenants, users, contrapartes, categories, costCenters, documents } from '@shared/schema';
import { eq, count, sql } from 'drizzle-orm';
import { hashPassword } from '../auth';
import { z } from 'zod';

// Validation schemas
const createTenantSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  slug: z.string().min(1, 'Slug é obrigatório').regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  adminFirstName: z.string().min(1, 'Nome do administrador é obrigatório'),
  adminLastName: z.string().min(1, 'Sobrenome do administrador é obrigatório'),
  adminEmail: z.string().email('Email inválido'),
  adminUsername: z.string().min(1, 'Nome de usuário é obrigatório'),
  adminPassword: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const createUserSchema = z.object({
  firstName: z.string().min(1, 'Nome é obrigatório'),
  lastName: z.string().min(1, 'Sobrenome é obrigatório'),
  email: z.string().email('Email inválido'),
  username: z.string().min(1, 'Nome de usuário é obrigatório'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  role: z.enum(['ADMIN', 'GERENTE', 'OPERADOR', 'CLIENTE']),
});

/**
 * Lista todos os tenants com estatísticas
 */
export async function listTenants(req: Request, res: Response) {
  try {
    const tenantsList = await db.select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      isActive: tenants.isActive,
      createdAt: tenants.createdAt,
      updatedAt: tenants.updatedAt,
    }).from(tenants);

    // Buscar estatísticas para cada tenant
    const tenantsWithStats = await Promise.all(
      tenantsList.map(async (tenant) => {
        const [userCount] = await db
          .select({ count: count() })
          .from(users)
          .where(eq(users.tenantId, tenant.id));

        const [documentCount] = await db
          .select({ count: count() })
          .from(documents)
          .where(eq(documents.tenantId, tenant.id));

        const [contraparteCount] = await db
          .select({ count: count() })
          .from(contrapartes)
          .where(eq(contrapartes.tenantId, tenant.id));

        return {
          ...tenant,
          _count: {
            users: userCount.count,
            documents: documentCount.count,
            contrapartes: contraparteCount.count,
          },
        };
      })
    );

    res.json(tenantsWithStats);
  } catch (error) {
    console.error('❌ Erro ao listar tenants:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

/**
 * Cria um novo tenant com administrador e dados padrão
 */
export async function createTenant(req: Request, res: Response) {
  try {
    const validatedData = createTenantSchema.parse(req.body);

    // Verificar se slug já existe
    const existingTenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, validatedData.slug))
      .limit(1);

    if (existingTenant.length > 0) {
      return res.status(400).json({ error: 'Slug já existe' });
    }

    // Verificar se email/username já existe globalmente
    const existingUser = await db
      .select()
      .from(users)
      .where(sql`${users.email} = ${validatedData.adminEmail} OR ${users.username} = ${validatedData.adminUsername}`)
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Email ou nome de usuário já existe' });
    }

    // Criar tenant
    const [newTenant] = await db
      .insert(tenants)
      .values({
        name: validatedData.name,
        slug: validatedData.slug,
        isActive: true,
      })
      .returning();

    console.log(`✅ Tenant criado: ${newTenant.name} (${newTenant.id})`);

    // Criar usuário administrador
    const hashedPassword = await hashPassword(validatedData.adminPassword);
    const [adminUser] = await db
      .insert(users)
      .values({
        tenantId: newTenant.id,
        username: validatedData.adminUsername,
        password: hashedPassword,
        email: validatedData.adminEmail,
        firstName: validatedData.adminFirstName,
        lastName: validatedData.adminLastName,
        role: 'ADMIN',
        isActive: true,
      })
      .returning();

    console.log(`✅ Admin criado: ${adminUser.username} para tenant ${newTenant.name}`);

    // Criar categorias padrão
    const defaultCategories = [
      { name: 'Combustível', description: 'Despesas com combustível' },
      { name: 'Manutenção', description: 'Manutenção de veículos e equipamentos' },
      { name: 'Pedágio', description: 'Taxas de pedágio' },
      { name: 'Alimentação', description: 'Despesas com alimentação' },
      { name: 'Hospedagem', description: 'Despesas com hospedagem' },
      { name: 'Transporte', description: 'Despesas gerais de transporte' },
      { name: 'Documentação', description: 'Taxas e documentos' },
    ];

    for (const category of defaultCategories) {
      await db.insert(categories).values({
        tenantId: newTenant.id,
        name: category.name,
        description: category.description,
        isActive: true,
      });
    }

    console.log(`✅ Categorias padrão criadas para tenant ${newTenant.name}`);

    // Criar centros de custo padrão
    const defaultCostCenters = [
      { name: 'Operacional', description: 'Custos operacionais' },
      { name: 'Administrativo', description: 'Custos administrativos' },
      { name: 'Frota', description: 'Custos da frota' },
      { name: 'Viagem', description: 'Custos de viagem' },
    ];

    for (const costCenter of defaultCostCenters) {
      await db.insert(costCenters).values({
        tenantId: newTenant.id,
        name: costCenter.name,
        description: costCenter.description,
        isActive: true,
      });
    }

    console.log(`✅ Centros de custo padrão criados para tenant ${newTenant.name}`);

    res.status(201).json({
      message: 'Tenant criado com sucesso',
      tenant: newTenant,
      admin: {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: error.errors,
      });
    }

    console.error('❌ Erro ao criar tenant:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

/**
 * Ativa/desativa um tenant
 */
export async function toggleTenant(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const { isActive } = req.body;

    const [updatedTenant] = await db
      .update(tenants)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId))
      .returning();

    if (!updatedTenant) {
      return res.status(404).json({ error: 'Tenant não encontrado' });
    }

    console.log(`✅ Tenant ${updatedTenant.name} ${isActive ? 'ativado' : 'desativado'}`);

    res.json({
      message: `Tenant ${isActive ? 'ativado' : 'desativado'} com sucesso`,
      tenant: updatedTenant,
    });
  } catch (error) {
    console.error('❌ Erro ao alterar status do tenant:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

/**
 * Lista usuários de um tenant específico
 */
export async function listTenantUsers(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;

    // Verificar se tenant existe
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant não encontrado' });
    }

    const tenantUsers = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    res.json(tenantUsers);
  } catch (error) {
    console.error('❌ Erro ao listar usuários do tenant:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

/**
 * Cria um novo usuário para um tenant específico
 */
export async function createTenantUser(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const validatedData = createUserSchema.parse(req.body);

    // Verificar se tenant existe
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant não encontrado' });
    }

    // Verificar se email/username já existe no tenant
    const existingUser = await db
      .select()
      .from(users)
      .where(
        sql`${users.tenantId} = ${tenantId} AND (${users.email} = ${validatedData.email} OR ${users.username} = ${validatedData.username})`
      )
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Email ou nome de usuário já existe neste cliente' });
    }

    // Criar usuário
    const hashedPassword = await hashPassword(validatedData.password);
    const [newUser] = await db
      .insert(users)
      .values({
        tenantId,
        username: validatedData.username,
        password: hashedPassword,
        email: validatedData.email,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        role: validatedData.role,
        isActive: true,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    console.log(`✅ Usuário criado: ${newUser.username} (${newUser.role}) para tenant ${tenant.name}`);

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: newUser,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: error.errors,
      });
    }

    console.error('❌ Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}