#!/usr/bin/env tsx

/**
 * Script para validar o isolamento entre tenants
 * Executa testes práticos de segurança RLS
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

interface ValidationResult {
  test: string;
  passed: boolean;
  details: string;
}

async function validateTenantIsolation(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  console.log('🔍 INICIANDO VALIDAÇÃO DE ISOLAMENTO ENTRE TENANTS\n');

  // Test 1: Verificar se RLS está ativo
  try {
    const rlsCheck = await db.execute(sql`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('users', 'documents', 'contrapartes', 'categories', 'cost_centers')
      ORDER BY tablename
    `);

    const tablesWithRLS = rlsCheck.rows?.filter((row: any) => row.rowsecurity) || [];
    const expectedTables = ['users', 'documents', 'contrapartes', 'categories', 'cost_centers'];
    
    results.push({
      test: 'RLS Activation',
      passed: tablesWithRLS.length === expectedTables.length,
      details: `${tablesWithRLS.length}/${expectedTables.length} tabelas com RLS ativo`
    });

    console.log('✅ Tabelas com RLS:', tablesWithRLS.map((t: any) => t.tablename).join(', '));
  } catch (error) {
    results.push({
      test: 'RLS Activation',
      passed: false,
      details: `Erro: ${error}`
    });
  }

  // Test 2: Verificar políticas RLS
  try {
    const policiesCheck = await db.execute(sql`
      SELECT tablename, policyname, cmd
      FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);

    const policyCount = policiesCheck.rows?.length || 0;
    
    results.push({
      test: 'RLS Policies',
      passed: policyCount >= 6, // Esperamos pelo menos 6 políticas básicas
      details: `${policyCount} políticas encontradas`
    });

    console.log('✅ Políticas RLS:', policyCount);
    if (policiesCheck.rows) {
      policiesCheck.rows.forEach((policy: any) => {
        console.log(`   - ${policy.tablename}.${policy.policyname} (${policy.cmd})`);
      });
    }
  } catch (error) {
    results.push({
      test: 'RLS Policies',
      passed: false,
      details: `Erro: ${error}`
    });
  }

  // Test 3: Buscar tenants existentes para teste
  let testTenants: any[] = [];
  try {
    // Limpar contexto primeiro
    await db.execute(sql.raw(`SET app.current_tenant = ''`));
    await db.execute(sql.raw(`SET app.current_user = ''`));

    const tenantsResult = await db.execute(sql`
      SELECT id, name, slug FROM tenants 
      WHERE is_active = true 
      LIMIT 3
    `);

    testTenants = tenantsResult.rows || [];
    
    results.push({
      test: 'Test Data Availability',
      passed: testTenants.length >= 2,
      details: `${testTenants.length} tenants ativos encontrados para teste`
    });

    console.log('✅ Tenants para teste:', testTenants.map(t => `${t.name} (${t.slug})`).join(', '));
  } catch (error) {
    results.push({
      test: 'Test Data Availability',
      passed: false,
      details: `Erro: ${error}`
    });
  }

  // Test 4: Testar isolamento real se temos tenants
  if (testTenants.length >= 2) {
    const tenant1 = testTenants[0];
    const tenant2 = testTenants[1];

    try {
      // Configurar contexto do Tenant 1
      await db.execute(sql.raw(`SET app.current_tenant = '${tenant1.id}'`));
      await db.execute(sql.raw(`SET app.current_user = '00000000-0000-0000-0000-000000000001'`));

      // Buscar usuários visíveis no contexto do Tenant 1
      const tenant1Users = await db.execute(sql`SELECT id, tenant_id FROM users`);
      const usersInTenant1 = tenant1Users.rows || [];

      // Verificar se todos os usuários pertencem ao Tenant 1
      const allBelongToTenant1 = usersInTenant1.every(u => u.tenant_id === tenant1.id);

      results.push({
        test: 'Tenant 1 User Isolation',
        passed: allBelongToTenant1,
        details: `${usersInTenant1.length} usuários visíveis, todos do tenant correto: ${allBelongToTenant1}`
      });

      console.log(`✅ Tenant 1 (${tenant1.name}): ${usersInTenant1.length} usuários visíveis`);

      // Configurar contexto do Tenant 2
      await db.execute(sql.raw(`SET app.current_tenant = '${tenant2.id}'`));
      await db.execute(sql.raw(`SET app.current_user = '00000000-0000-0000-0000-000000000002'`));

      // Buscar usuários visíveis no contexto do Tenant 2
      const tenant2Users = await db.execute(sql`SELECT id, tenant_id FROM users`);
      const usersInTenant2 = tenant2Users.rows || [];

      // Verificar se todos os usuários pertencem ao Tenant 2
      const allBelongToTenant2 = usersInTenant2.every(u => u.tenant_id === tenant2.id);

      results.push({
        test: 'Tenant 2 User Isolation',
        passed: allBelongToTenant2,
        details: `${usersInTenant2.length} usuários visíveis, todos do tenant correto: ${allBelongToTenant2}`
      });

      console.log(`✅ Tenant 2 (${tenant2.name}): ${usersInTenant2.length} usuários visíveis`);

      // Verificar que não há sobreposição de usuários
      const tenant1UserIds = usersInTenant1.map(u => u.id);
      const tenant2UserIds = usersInTenant2.map(u => u.id);
      const overlap = tenant1UserIds.filter(id => tenant2UserIds.includes(id));

      results.push({
        test: 'Cross-Tenant Data Leakage',
        passed: overlap.length === 0,
        details: `${overlap.length} usuários visíveis em ambos os tenants (deveria ser 0)`
      });

      console.log(`✅ Vazamento de dados entre tenants: ${overlap.length === 0 ? 'NENHUM' : overlap.length + ' casos'}`);

    } catch (error) {
      results.push({
        test: 'Practical Isolation Test',
        passed: false,
        details: `Erro durante teste prático: ${error}`
      });
    }
  }

  // Test 5: Testar acesso sem contexto
  try {
    await db.execute(sql.raw(`SET app.current_tenant = ''`));
    await db.execute(sql.raw(`SET app.current_user = ''`));

    const usersWithoutContext = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const userCount = usersWithoutContext.rows?.[0]?.count || 0;

    results.push({
      test: 'Access Without Context',
      passed: userCount === 0,
      details: `${userCount} usuários visíveis sem contexto (deveria ser 0)`
    });

    console.log(`✅ Acesso sem contexto: ${userCount} registros visíveis (esperado: 0)`);
  } catch (error) {
    results.push({
      test: 'Access Without Context',
      passed: false,
      details: `Erro: ${error}`
    });
  }

  return results;
}

async function main() {
  try {
    const results = await validateTenantIsolation();
    
    console.log('\n📊 RESULTADO DA VALIDAÇÃO:\n');
    
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const percentage = Math.round((passed / total) * 100);
    
    results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.test}: ${result.details}`);
    });
    
    console.log(`\n🎯 SCORE: ${passed}/${total} testes passaram (${percentage}%)`);
    
    if (percentage === 100) {
      console.log('🎉 SUCESSO! Sistema multi-tenant totalmente isolado e seguro.');
    } else if (percentage >= 80) {
      console.log('⚠️  ATENÇÃO: Sistema majoritariamente seguro, mas alguns problemas foram encontrados.');
    } else {
      console.log('🚨 CRÍTICO: Sistema NÃO é seguro para produção. Problemas graves de isolamento.');
    }
    
    process.exit(percentage === 100 ? 0 : 1);
    
  } catch (error) {
    console.error('💥 ERRO FATAL durante validação:', error);
    process.exit(1);
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  main();
}

export { validateTenantIsolation };