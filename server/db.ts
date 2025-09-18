import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL deve estar configurada. Esqueceu de provisionar o banco de dados?",
  );
}

const databaseUrl = process.env.DATABASE_URL;
const isSupabase = databaseUrl.includes('supabase.co');

if (isSupabase) {
  console.log('🟢 Detectado Supabase URL. Para usar Supabase, configure as variáveis SUPABASE_URL e SUPABASE_ANON_KEY no .env');
  console.log('📝 Use o cliente Supabase em server/supabase.ts para operações específicas do Supabase');
}

// Create the pool with proper error handling using standard pg for Supabase
export const pool = new Pool({ 
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

export const db = drizzle(pool, { schema });

// Função para testar conectividade
export async function testDatabaseConnection() {
  try {
    await pool.query('SELECT 1');
    if (isSupabase) {
      console.log('✅ Conexão com Supabase estabelecida');
    } else {
      console.log('✅ Conexão com banco de dados estabelecida');
    }
    return true;
  } catch (error) {
    console.error('❌ Erro na conexão com o banco:', error);
    return false;
  }
}