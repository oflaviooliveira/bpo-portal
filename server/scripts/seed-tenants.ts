
import { db } from '../db';
import { tenants, users, contrapartes, categories, costCenters } from '../../shared/schema';

export async function seedTenants() {
  console.log('🌱 Iniciando seeds de tenants...');

  try {
    // Criar tenants demo
    const tenant1 = await db.insert(tenants).values({
      name: 'ACME Logística',
      slug: 'acme-log',
    }).returning();

    const tenant2 = await db.insert(tenants).values({
      name: 'Beta Transportes', 
      slug: 'beta-cargo',
    }).returning();

    console.log('✅ Tenants criados:', tenant1[0].name, tenant2[0].name);

    // Criar usuários admin para cada tenant
    await db.insert(users).values([
      {
        username: 'admin@acme',
        email: 'admin@acme-log.com',
        tenantId: tenant1[0].id,
        role: 'ADMIN',
        name: 'Administrador ACME',
      },
      {
        username: 'admin@beta',
        email: 'admin@beta-cargo.com',
        tenantId: tenant2[0].id,
        role: 'ADMIN',
        name: 'Administrador Beta',
      }
    ]);

    console.log('✅ Usuários admin criados');

    // Criar contrapartes demo para ACME
    await db.insert(contrapartes).values([
      {
        tenantId: tenant1[0].id,
        name: 'Fornecedor ACME 1',
        document: '11222333000144',
        documentType: 'CNPJ',
        canBeSupplier: true,
        canBeClient: false,
      },
      {
        tenantId: tenant1[0].id,
        name: 'Cliente ACME 1',
        document: '55666777000188',
        documentType: 'CNPJ',
        canBeSupplier: false,
        canBeClient: true,
      }
    ]);

    // Criar contrapartes demo para Beta
    await db.insert(contrapartes).values([
      {
        tenantId: tenant2[0].id,
        name: 'Fornecedor Beta 1',
        document: '99888777000166',
        documentType: 'CNPJ',
        canBeSupplier: true,
        canBeClient: false,
      },
      {
        tenantId: tenant2[0].id,
        name: 'Cliente Beta 1',
        document: '33444555000122',
        documentType: 'CNPJ',
        canBeSupplier: false,
        canBeClient: true,
      }
    ]);

    console.log('✅ Contrapartes criadas para ambos tenants');

    // Criar categorias base para ACME
    await db.insert(categories).values([
      {
        tenantId: tenant1[0].id,
        code: 'COMB',
        name: 'Combustível',
        description: 'Despesas com combustível',
      },
      {
        tenantId: tenant1[0].id,
        code: 'MANUT',
        name: 'Manutenção',
        description: 'Manutenção de veículos',
      }
    ]);

    // Criar categorias base para Beta  
    await db.insert(categories).values([
      {
        tenantId: tenant2[0].id,
        code: 'COMB',
        name: 'Combustível',
        description: 'Despesas com combustível',
      },
      {
        tenantId: tenant2[0].id,
        code: 'MANUT',
        name: 'Manutenção',
        description: 'Manutenção de veículos',
      }
    ]);

    console.log('✅ Categorias criadas para ambos tenants');

    // Criar centros de custo para ACME
    await db.insert(costCenters).values([
      {
        tenantId: tenant1[0].id,
        code: 'SRJ1',
        name: 'São João - Rota 1',
        description: 'Centro de custo rota SJ1',
      },
      {
        tenantId: tenant1[0].id,
        code: 'SPR1',
        name: 'Santos - Rota 1',
        description: 'Centro de custo rota Santos',
      }
    ]);

    // Criar centros de custo para Beta
    await db.insert(costCenters).values([
      {
        tenantId: tenant2[0].id,
        code: 'RJ01',
        name: 'Rio - Operação 1',
        description: 'Centro de custo Rio',
      },
      {
        tenantId: tenant2[0].id,
        code: 'SP01',
        name: 'São Paulo - Operação 1',
        description: 'Centro de custo SP',
      }
    ]);

    console.log('✅ Centros de custo criados para ambos tenants');

    console.log('🎉 Seeds de tenants completados com sucesso!');

  } catch (error) {
    console.error('❌ Erro ao executar seeds:', error);
    throw error;
  }
}

// Se executado diretamente
if (require.main === module) {
  seedTenants()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
