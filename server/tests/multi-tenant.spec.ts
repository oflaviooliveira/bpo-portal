
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { db } from '../db';
import { tenants, users, contrapartes, categories, costCenters } from '../../shared/schema';
import { eq } from 'drizzle-orm';

describe('Multi-tenant Isolation', () => {
  let tenant1Id: string;
  let tenant2Id: string;
  let user1Id: string;
  let user2Id: string;

  beforeEach(async () => {
    // Limpar dados de teste
    await db.delete(users);
    await db.delete(contrapartes);
    await db.delete(categories);
    await db.delete(costCenters);
    await db.delete(tenants);

    // Criar tenants de teste
    const tenant1 = await db.insert(tenants).values({
      name: 'Tenant Test 1',
      slug: 'test-1',
    }).returning();

    const tenant2 = await db.insert(tenants).values({
      name: 'Tenant Test 2',
      slug: 'test-2',
    }).returning();

    tenant1Id = tenant1[0].id;
    tenant2Id = tenant2[0].id;

    // Criar usuários para cada tenant
    const user1 = await db.insert(users).values({
      username: 'user1',
      email: 'user1@test.com',
      password: 'hashed_password',
      firstName: 'User',
      lastName: 'One',
      tenantId: tenant1Id,
      role: 'CLIENT_USER',
    }).returning();

    const user2 = await db.insert(users).values({
      username: 'user2',
      email: 'user2@test.com',
      password: 'hashed_password',
      firstName: 'User',
      lastName: 'Two',
      tenantId: tenant2Id,
      role: 'CLIENT_USER',
    }).returning();

    user1Id = user1[0].id;
    user2Id = user2[0].id;
  });

  afterEach(async () => {
    // Limpar dados de teste
    await db.delete(users);
    await db.delete(contrapartes);
    await db.delete(categories);
    await db.delete(costCenters);
    await db.delete(tenants);
  });

  test('Same CNPJ can exist in different tenants', async () => {
    const sameCnpj = '11222333000144';

    // Criar contraparte com mesmo CNPJ em ambos tenants
    await db.insert(contrapartes).values([
      {
        tenantId: tenant1Id,
        name: 'Empresa A - Tenant 1',
        document: sameCnpj,
        documentType: 'CNPJ',
        canBeSupplier: true,
      },
      {
        tenantId: tenant2Id,
        name: 'Empresa A - Tenant 2',
        document: sameCnpj,
        documentType: 'CNPJ',
        canBeSupplier: true,
      }
    ]);

    // Verificar que ambos foram criados
    const contrapartesTenant1 = await db.select()
      .from(contrapartes)
      .where(eq(contrapartes.tenantId, tenant1Id));
    
    const contrapartesTenant2 = await db.select()
      .from(contrapartes)
      .where(eq(contrapartes.tenantId, tenant2Id));

    expect(contrapartesTenant1).toHaveLength(1);
    expect(contrapartesTenant2).toHaveLength(1);
    expect(contrapartesTenant1[0].document).toBe(sameCnpj);
    expect(contrapartesTenant2[0].document).toBe(sameCnpj);
  });

  test('Same category name can exist in different tenants', async () => {
    const sameCategoryName = 'Combustível';

    // Criar categoria com mesmo nome em ambos tenants
    await db.insert(categories).values([
      {
        tenantId: tenant1Id,
        name: sameCategoryName,
        description: 'Combustível Tenant 1',
      },
      {
        tenantId: tenant2Id,
        name: sameCategoryName,
        description: 'Combustível Tenant 2',
      }
    ]);

    // Verificar que ambas foram criadas
    const categoriesTenant1 = await db.select()
      .from(categories)
      .where(eq(categories.tenantId, tenant1Id));
    
    const categoriesTenant2 = await db.select()
      .from(categories)
      .where(eq(categories.tenantId, tenant2Id));

    expect(categoriesTenant1).toHaveLength(1);
    expect(categoriesTenant2).toHaveLength(1);
    expect(categoriesTenant1[0].name).toBe(sameCategoryName);
    expect(categoriesTenant2[0].name).toBe(sameCategoryName);
  });

  test('Cannot create duplicate CNPJ within same tenant', async () => {
    const sameCnpj = '11222333000144';

    // Criar primeira contraparte
    await db.insert(contrapartes).values({
      tenantId: tenant1Id,
      name: 'Empresa A',
      document: sameCnpj,
      documentType: 'CNPJ',
      canBeSupplier: true,
    });

    // Tentar criar segunda com mesmo CNPJ no mesmo tenant deve falhar
    await expect(async () => {
      await db.insert(contrapartes).values({
        tenantId: tenant1Id,
        name: 'Empresa B',
        document: sameCnpj,
        documentType: 'CNPJ',
        canBeSupplier: true,
      });
    }).rejects.toThrow();
  });

  test('Cannot create duplicate category name within same tenant', async () => {
    const sameName = 'Combustível';

    // Criar primeira categoria
    await db.insert(categories).values({
      tenantId: tenant1Id,
      name: sameName,
      description: 'Primeira categoria',
    });

    // Tentar criar segunda com mesmo nome no mesmo tenant deve falhar
    await expect(async () => {
      await db.insert(categories).values({
        tenantId: tenant1Id,
        name: sameName,
        description: 'Segunda categoria',
      });
    }).rejects.toThrow();
  });

  test('Data isolation works correctly', async () => {
    // Criar dados específicos para cada tenant
    await db.insert(contrapartes).values([
      {
        tenantId: tenant1Id,
        name: 'Fornecedor Tenant 1',
        canBeSupplier: true,
      },
      {
        tenantId: tenant2Id,
        name: 'Fornecedor Tenant 2',
        canBeSupplier: true,
      }
    ]);

    // Verificar isolamento
    const contrapartesTenant1 = await db.select()
      .from(contrapartes)
      .where(eq(contrapartes.tenantId, tenant1Id));
    
    const contrapartesTenant2 = await db.select()
      .from(contrapartes)
      .where(eq(contrapartes.tenantId, tenant2Id));

    expect(contrapartesTenant1).toHaveLength(1);
    expect(contrapartesTenant2).toHaveLength(1);
    expect(contrapartesTenant1[0].name).toBe('Fornecedor Tenant 1');
    expect(contrapartesTenant2[0].name).toBe('Fornecedor Tenant 2');
  });
});
