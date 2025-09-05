
import { db } from '../db';
import { sql } from 'drizzle-orm';

async function enableRLS() {
  console.log('🔐 Ativando Row Level Security...');

  try {
    // Ativar RLS apenas nas tabelas principais que já existem
    const tables = [
      'users', 'contrapartes', 'clients', 'categories', 
      'cost_centers', 'documents'
    ];

    for (const table of tables) {
      console.log(`🔐 Verificando e ativando RLS para tabela: ${table}`);
      
      // Verificar se a tabela tem coluna tenant_id
      try {
        const result = await db.execute(sql.raw(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = '${table}' AND column_name = 'tenant_id';
        `));
        
        if ((result as any).length === 0) {
          console.log(`⚠️ Tabela ${table} não tem coluna tenant_id, pulando...`);
          continue;
        }
        
        // Ativar RLS
        await db.execute(sql.raw(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`));
      
        // Criar políticas CRUD
        await db.execute(sql.raw(`
          DROP POLICY IF EXISTS p_${table}_select ON ${table};
          CREATE POLICY p_${table}_select ON ${table}
            FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant', true));
        `));
        
        await db.execute(sql.raw(`
          DROP POLICY IF EXISTS p_${table}_insert ON ${table};
          CREATE POLICY p_${table}_insert ON ${table}
            FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
        `));
        
        await db.execute(sql.raw(`
          DROP POLICY IF EXISTS p_${table}_update ON ${table};
          CREATE POLICY p_${table}_update ON ${table}
            FOR UPDATE USING (tenant_id::text = current_setting('app.current_tenant', true));
        `));
        
        await db.execute(sql.raw(`
          DROP POLICY IF EXISTS p_${table}_delete ON ${table};
          CREATE POLICY p_${table}_delete ON ${table}
            FOR DELETE USING (tenant_id::text = current_setting('app.current_tenant', true));
        `));
        
        console.log(`✅ RLS ativado para tabela: ${table}`);
        
      } catch (tableError: any) {
        console.error(`❌ Erro ao ativar RLS para tabela ${table}:`, tableError.message);
      }
    }

    console.log('✅ RLS ativado com sucesso em todas as tabelas');
    
  } catch (error) {
    console.error('❌ Erro ao ativar RLS:', error);
    throw error;
  }
}

// Auto-execute when run directly
enableRLS()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

export { enableRLS };
