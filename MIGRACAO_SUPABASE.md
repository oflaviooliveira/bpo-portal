# 🔄 Migração para Supabase - Portal BPO

## ✅ Status Atual

### Concluído
- ✅ Dependências do Supabase instaladas
- ✅ Configuração dual Neon/Supabase implementada
- ✅ Cliente Supabase configurado (`server/supabase.ts`)
- ✅ Scripts de teste criados
- ✅ Arquivo `.env` com template criado
- ✅ Guia de configuração disponível

### Próximos Passos

#### 🔴 URGENTE: Configurar Credenciais
1. **Obter credenciais do Supabase:**
   - Acesse https://supabase.com/dashboard
   - Crie um novo projeto ou use existente
   - Copie: Project URL, anon key, service role key

2. **Atualizar arquivo `.env`:**
   ```bash
   # Edite o arquivo .env e substitua os placeholders:
   # [YOUR-PASSWORD] → sua senha do Supabase
   # [YOUR-PROJECT-REF] → referência do seu projeto
   # [YOUR-ANON-KEY] → chave anônima
   # [YOUR-SERVICE-ROLE-KEY] → chave de serviço
   ```

3. **Testar conectividade:**
   ```bash
   npm run test:supabase
   ```

#### 🟡 MÉDIO: Migrar Schema
1. **Sincronizar schema com Supabase:**
   ```bash
   # Atualizar drizzle.config.ts se necessário
   npx drizzle-kit push
   ```

2. **Configurar RLS (Row Level Security):**
   ```bash
   npm run setup:multi-tenant
   ```

#### 🟢 BAIXO: Configurar Storage
1. **Criar bucket no Supabase:**
   - Acesse Storage no dashboard
   - Crie bucket `documents`
   - Configure políticas de acesso

2. **Atualizar código para usar Supabase Storage:**
   - Substituir `server/storage/local-storage.ts`
   - Usar `supabaseStorage` de `server/supabase.ts`

## 🛠️ Comandos Úteis

```bash
# Testar conectividade
npm run test:supabase

# Ver guia de configuração
cat SUPABASE_SETUP.md

# Sincronizar schema
npx drizzle-kit push

# Configurar multi-tenant
npm run setup:multi-tenant

# Iniciar desenvolvimento
npm run dev
```

## 🔍 Verificação de Problemas

### Erro: "DATABASE_URL deve estar configurada"
- ✅ Arquivo `.env` existe?
- ✅ DATABASE_URL está preenchida com valores reais?
- ✅ Formato da URL está correto?

### Erro: "Missing Supabase environment variables"
- ✅ SUPABASE_URL está configurada?
- ✅ SUPABASE_ANON_KEY está configurada?
- ✅ Valores não contêm placeholders `[YOUR-...]`?

### Erro de Conexão
- ✅ Projeto Supabase está ativo?
- ✅ Senha não contém caracteres especiais não codificados?
- ✅ Firewall/rede permite conexões?

## 📋 Checklist de Migração

- [ ] Credenciais do Supabase obtidas
- [ ] Arquivo `.env` configurado com valores reais
- [ ] Teste de conectividade passou
- [ ] Schema migrado para Supabase
- [ ] RLS configurado
- [ ] Storage configurado
- [ ] Aplicação funcionando com Supabase
- [ ] Dados migrados (se necessário)
- [ ] Testes passando
- [ ] Deploy atualizado

## 🆘 Suporte

Se encontrar problemas:
1. Execute `npm run test:supabase` para diagnóstico
2. Consulte `SUPABASE_SETUP.md` para detalhes
3. Verifique logs do console para erros específicos
4. Documentação oficial: https://supabase.com/docs