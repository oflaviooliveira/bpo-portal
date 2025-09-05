
import { execSync } from 'child_process';
import { seedTenants } from './seed-tenants';

async function setupMultiTenant() {
  console.log('🚀 Iniciando configuração completa de multi-tenancy...');

  try {
    // 1. Aplicar RLS no banco
    console.log('📊 Aplicando Row Level Security...');
    if (process.env.DATABASE_URL) {
      execSync(`psql "${process.env.DATABASE_URL}" -f server/db/setup-rls.sql`, { stdio: 'inherit' });
      console.log('✅ RLS aplicado com sucesso');
    } else {
      console.log('⚠️ DATABASE_URL não encontrada, RLS não aplicado');
    }

    // 2. Sincronizar schema atualizado
    console.log('🔄 Sincronizando schema...');
    execSync('npm run db:push --force', { stdio: 'inherit' });
    console.log('✅ Schema sincronizado');

    // 3. Executar seeds
    console.log('🌱 Executando seeds...');
    await seedTenants();
    console.log('✅ Seeds executados');

    console.log('🎉 Configuração de multi-tenancy concluída com sucesso!');
    console.log('');
    console.log('📋 Próximos passos:');
    console.log('1. Executar testes: npm test');
    console.log('2. Iniciar aplicação: npm run dev');
    console.log('3. Testar isolamento entre tenants');

  } catch (error) {
    console.error('❌ Erro na configuração:', error);
    process.exit(1);
  }
}

// Se executado diretamente
if (require.main === module) {
  setupMultiTenant()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { setupMultiTenant };
