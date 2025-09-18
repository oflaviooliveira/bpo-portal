#!/usr/bin/env tsx

import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

import { testDatabaseConnection } from './db';
import { testSupabaseConnection } from './supabase';

async function testConnections() {
  console.log('🔍 Testando conectividade...');
  console.log('=' .repeat(50));
  
  // Teste da conexão principal do banco
  console.log('\n1. Testando conexão principal do banco de dados:');
  const dbConnected = await testDatabaseConnection();
  
  // Teste da conexão do Supabase (se configurado)
  console.log('\n2. Testando conexão do Supabase:');
  const supabaseConnected = await testSupabaseConnection();
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 Resumo dos testes:');
  console.log(`   Database: ${dbConnected ? '✅ OK' : '❌ FALHOU'}`);
  console.log(`   Supabase: ${supabaseConnected ? '✅ OK' : '❌ FALHOU'}`);
  
  if (!dbConnected && !supabaseConnected) {
    console.log('\n⚠️  Nenhuma conexão funcionando. Verifique suas configurações.');
    console.log('\n📝 Passos para resolver:');
    console.log('   1. Verifique se o arquivo .env existe');
    console.log('   2. Configure DATABASE_URL para Neon ou Supabase');
    console.log('   3. Se usando Supabase, configure SUPABASE_URL e SUPABASE_ANON_KEY');
    process.exit(1);
  }
  
  console.log('\n🎉 Pelo menos uma conexão está funcionando!');
}

// Execute the test when running this file directly
testConnections().catch(console.error);

export { testConnections };