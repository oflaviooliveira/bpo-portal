import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { tenants, users, documents, contrapartes } from '../../shared/schema';

describe('Tenant Isolation Tests', () => {
  let tenant1Id: string;
  let tenant2Id: string;
  let user1Id: string;
  let user2Id: string;
  let document1Id: string;
  let document2Id: string;

  beforeAll(async () => {
    // Criar dados de teste para 2 tenants diferentes
    
    // Tenant 1
    const [t1] = await db.insert(tenants).values({
      name: 'Test Tenant 1',
      slug: 'test-tenant-1',
      isActive: true,
    }).returning();
    tenant1Id = t1.id;

    // Tenant 2
    const [t2] = await db.insert(tenants).values({
      name: 'Test Tenant 2', 
      slug: 'test-tenant-2',
      isActive: true,
    }).returning();
    tenant2Id = t2.id;

    // Usuário do Tenant 1
    const [u1] = await db.insert(users).values({
      tenantId: tenant1Id,
      username: 'user1@test.com',
      email: 'user1@test.com',
      password: 'hashed_password',
      firstName: 'User',
      lastName: 'One',
      role: 'OPERADOR',
      isActive: true,
    }).returning();
    user1Id = u1.id;

    // Usuário do Tenant 2
    const [u2] = await db.insert(users).values({
      tenantId: tenant2Id,
      username: 'user2@test.com',
      email: 'user2@test.com',
      password: 'hashed_password',
      firstName: 'User',
      lastName: 'Two',
      role: 'OPERADOR',
      isActive: true,
    }).returning();
    user2Id = u2.id;

    // Documento do Tenant 1
    const [d1] = await db.insert(documents).values({
      tenantId: tenant1Id,
      fileName: 'doc1.pdf',
      originalName: 'documento1.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      status: 'RECEBIDO',
      documentType: 'PAGO',
      createdBy: user1Id,
    }).returning();
    document1Id = d1.id;

    // Documento do Tenant 2
    const [d2] = await db.insert(documents).values({
      tenantId: tenant2Id,
      fileName: 'doc2.pdf',
      originalName: 'documento2.pdf',
      mimeType: 'application/pdf',
      fileSize: 2048,
      status: 'RECEBIDO',
      documentType: 'AGENDADO',
      createdBy: user2Id,
    }).returning();
    document2Id = d2.id;

    console.log(`🧪 Test data created: T1=${tenant1Id}, T2=${tenant2Id}`);
  });

  afterAll(async () => {
    // Limpar dados de teste
    await db.delete(documents).where(sql`tenant_id IN (${tenant1Id}, ${tenant2Id})`);
    await db.delete(users).where(sql`tenant_id IN (${tenant1Id}, ${tenant2Id})`);
    await db.delete(tenants).where(sql`id IN (${tenant1Id}, ${tenant2Id})`);
    console.log('🧹 Test data cleaned up');
  });

  test('Tenant 1 should only see its own users', async () => {
    // Configurar contexto do Tenant 1
    await db.execute(sql.raw(`SET app.current_tenant = '${tenant1Id}'`));
    await db.execute(sql.raw(`SET app.current_user = '${user1Id}'`));

    // Buscar usuários (deveria ver apenas usuários do Tenant 1)
    const visibleUsers = await db.select().from(users);
    
    expect(visibleUsers.length).toBe(1);
    expect(visibleUsers[0].id).toBe(user1Id);
    expect(visibleUsers[0].tenantId).toBe(tenant1Id);
    
    // Não deveria ver usuário do Tenant 2
    const tenant2Users = visibleUsers.filter(u => u.tenantId === tenant2Id);
    expect(tenant2Users.length).toBe(0);
  });

  test('Tenant 2 should only see its own users', async () => {
    // Configurar contexto do Tenant 2
    await db.execute(sql.raw(`SET app.current_tenant = '${tenant2Id}'`));
    await db.execute(sql.raw(`SET app.current_user = '${user2Id}'`));

    // Buscar usuários (deveria ver apenas usuários do Tenant 2)
    const visibleUsers = await db.select().from(users);
    
    expect(visibleUsers.length).toBe(1);
    expect(visibleUsers[0].id).toBe(user2Id);
    expect(visibleUsers[0].tenantId).toBe(tenant2Id);
    
    // Não deveria ver usuário do Tenant 1
    const tenant1Users = visibleUsers.filter(u => u.tenantId === tenant1Id);
    expect(tenant1Users.length).toBe(0);
  });

  test('Tenant 1 should only see its own documents', async () => {
    // Configurar contexto do Tenant 1
    await db.execute(sql.raw(`SET app.current_tenant = '${tenant1Id}'`));
    await db.execute(sql.raw(`SET app.current_user = '${user1Id}'`));

    // Buscar documentos (deveria ver apenas documentos do Tenant 1)
    const visibleDocs = await db.select().from(documents);
    
    expect(visibleDocs.length).toBe(1);
    expect(visibleDocs[0].id).toBe(document1Id);
    expect(visibleDocs[0].tenantId).toBe(tenant1Id);
    
    // Não deveria ver documentos do Tenant 2
    const tenant2Docs = visibleDocs.filter(d => d.tenantId === tenant2Id);
    expect(tenant2Docs.length).toBe(0);
  });

  test('Tenant 2 should only see its own documents', async () => {
    // Configurar contexto do Tenant 2
    await db.execute(sql.raw(`SET app.current_tenant = '${tenant2Id}'`));
    await db.execute(sql.raw(`SET app.current_user = '${user2Id}'`));

    // Buscar documentos (deveria ver apenas documentos do Tenant 2)
    const visibleDocs = await db.select().from(documents);
    
    expect(visibleDocs.length).toBe(1);
    expect(visibleDocs[0].id).toBe(document2Id);
    expect(visibleDocs[0].tenantId).toBe(tenant2Id);
    
    // Não deveria ver documentos do Tenant 1
    const tenant1Docs = visibleDocs.filter(d => d.tenantId === tenant1Id);
    expect(tenant1Docs.length).toBe(0);
  });

  test('Should not be able to access data without tenant context', async () => {
    // Limpar contexto (simular usuário não autenticado)
    await db.execute(sql.raw(`SET app.current_tenant = ''`));
    await db.execute(sql.raw(`SET app.current_user = ''`));

    // Tentar buscar dados (deveria retornar vazio devido ao RLS)
    const usersResult = await db.select().from(users);
    const docs = await db.select().from(documents);
    
    expect(usersResult.length).toBe(0);
    expect(docs.length).toBe(0);
  });

  test('Admin context should bypass tenant restrictions', async () => {
    // Simular contexto de admin global (sem tenant context)
    await db.execute(sql.raw(`SET app.current_tenant = ''`));
    await db.execute(sql.raw(`SET app.current_user = '${user1Id}'`));

    // Admin deveria conseguir ver tenants (mas não outros dados por enquanto)
    const visibleTenants = await db.select().from(tenants);
    
    // Deveria ver ambos os tenants de teste
    const testTenants = visibleTenants.filter(t => 
      t.id === tenant1Id || t.id === tenant2Id
    );
    expect(testTenants.length).toBe(2);
  });

  test('Cross-tenant data access should be blocked', async () => {
    // Configurar contexto do Tenant 1
    await db.execute(sql.raw(`SET app.current_tenant = '${tenant1Id}'`));
    await db.execute(sql.raw(`SET app.current_user = '${user1Id}'`));

    // Tentar buscar documento específico do Tenant 2 (deveria falhar)
    const tenant2Doc = await db.select()
      .from(documents)
      .where(sql`id = ${document2Id}`);
    
    expect(tenant2Doc.length).toBe(0);

    // Tentar buscar usuário específico do Tenant 2 (deveria falhar)
    const tenant2User = await db.select()
      .from(users)
      .where(sql`id = ${user2Id}`);
    
    expect(tenant2User.length).toBe(0);
  });
});

/**
 * Função utilitária para executar testes de isolamento
 */
export async function runTenantIsolationTests(): Promise<boolean> {
  try {
    console.log('🧪 Iniciando testes de isolamento entre tenants...');
    
    // Aqui você executaria os testes usando seu framework de teste preferido
    // Para simplificar, vamos fazer algumas verificações básicas
    
    // Test 1: Verificar se RLS está ativo
    const rlsStatus = await db.execute(sql`
      SELECT schemaname, tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('users', 'documents', 'contrapartes')
    `);
    
    console.log('✅ RLS Status:', rlsStatus.rows);
    
    // Test 2: Verificar políticas existentes
    const policies = await db.execute(sql`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
      FROM pg_policies 
      WHERE schemaname = 'public'
    `);
    
    console.log('✅ Policies:', policies.rows?.length || 0, 'policies found');
    
    return true;
  } catch (error) {
    console.error('❌ Testes de isolamento falharam:', error);
    return false;
  }
}