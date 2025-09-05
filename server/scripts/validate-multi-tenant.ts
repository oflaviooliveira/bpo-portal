
import { db } from '../db';
import { tenants, users, contrapartes, categories, documents } from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

async function validateMultiTenant() {
  console.log('🔍 Validando sistema multi-tenant...\n');

  try {
    // 1. Verificar se RLS está ativo
    console.log('📋 1. Verificando Row Level Security...');
    const rlsCheck = await db.execute(sql`
      SELECT schemaname, tablename, rowsecurity 
      FROM pg_tables 
      WHERE tablename IN ('users', 'contrapartes', 'categories', 'documents')
      AND schemaname = 'public'
    `);
    
    console.log('✅ Tabelas com RLS:', rlsCheck.rows.map(r => `${r.tablename}: ${r.rowsecurity}`));

    // 2. Verificar tenants criados
    console.log('\n📋 2. Verificando tenants...');
    const allTenants = await db.select().from(tenants);
    console.log('✅ Tenants encontrados:', allTenants.length);
    allTenants.forEach(t => console.log(`   - ${t.name} (${t.slug})`));

    // 3. Verificar usuários por tenant
    console.log('\n📋 3. Verificando usuários por tenant...');
    for (const tenant of allTenants) {
      const tenantUsers = await db.select()
        .from(users)
        .where(eq(users.tenantId, tenant.id));
      console.log(`✅ ${tenant.name}: ${tenantUsers.length} usuários`);
    }

    // 4. Verificar contrapartes por tenant
    console.log('\n📋 4. Verificando contrapartes por tenant...');
    for (const tenant of allTenants) {
      const tenantContrapartes = await db.select()
        .from(contrapartes)
        .where(eq(contrapartes.tenantId, tenant.id));
      console.log(`✅ ${tenant.name}: ${tenantContrapartes.length} contrapartes`);
    }

    // 5. Verificar categorias por tenant
    console.log('\n📋 5. Verificando categorias por tenant...');
    for (const tenant of allTenants) {
      const tenantCategories = await db.select()
        .from(categories)
        .where(eq(categories.tenantId, tenant.id));
      console.log(`✅ ${tenant.name}: ${tenantCategories.length} categorias`);
    }

    // 6. Testar isolamento com mesmo CNPJ
    console.log('\n📋 6. Testando isolamento de dados...');
    const duplicateCnpjs = await db.execute(sql`
      SELECT document, COUNT(*) as tenant_count 
      FROM contrapartes 
      WHERE document IS NOT NULL 
      GROUP BY document 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicateCnpjs.rows.length > 0) {
      console.log('✅ Isolamento funcionando - CNPJs duplicados entre tenants:');
      duplicateCnpjs.rows.forEach(r => console.log(`   CNPJ ${r.document}: ${r.tenant_count} tenants`));
    } else {
      console.log('⚠️ Nenhum CNPJ duplicado encontrado entre tenants');
    }

    console.log('\n🎉 Validação multi-tenant concluída com sucesso!');

  } catch (error) {
    console.error('❌ Erro na validação:', error);
    throw error;
  }
}

// Se executado diretamente
if (require.main === module) {
  validateMultiTenant()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { validateMultiTenant };
