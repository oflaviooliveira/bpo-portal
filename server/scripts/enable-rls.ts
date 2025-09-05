
import { execSync } from 'child_process';

async function enableRLS() {
  console.log('🔐 Ativando Row Level Security...');

  try {
    if (process.env.DATABASE_URL) {
      execSync(`psql "${process.env.DATABASE_URL}" -f server/db/enable-rls.sql`, { stdio: 'inherit' });
      console.log('✅ RLS ativado com sucesso');
    } else {
      console.log('⚠️ DATABASE_URL não encontrada, RLS não aplicado');
    }
  } catch (error) {
    console.error('❌ Erro ao ativar RLS:', error);
    throw error;
  }
}

// Se executado diretamente
if (require.main === module) {
  enableRLS()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { enableRLS };
