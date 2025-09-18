# 🚀 Guia de Configuração do Supabase

## 📋 Pré-requisitos

1. Conta no Supabase (https://supabase.com)
2. Projeto criado no Supabase

## 🔧 Configuração Passo a Passo

### 1. Obter Credenciais do Supabase

1. Acesse o [Dashboard do Supabase](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Copie as seguintes informações:
   - **Project URL** (ex: `https://abc123.supabase.co`)
   - **anon/public key**
   - **service_role key** (opcional, para operações administrativas)

### 2. Configurar DATABASE_URL

1. No Dashboard do Supabase, vá em **Settings** → **Database**
2. Na seção **Connection string**, copie a **URI**
3. A URL terá o formato:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.abc123.supabase.co:5432/postgres
   ```

### 3. Atualizar o arquivo .env

Substitua os placeholders no arquivo `.env` pelos valores reais:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:SUA_SENHA@db.SEU_PROJECT_REF.supabase.co:5432/postgres

# Supabase Configuration
SUPABASE_URL=https://SEU_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=SUA_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=SUA_SERVICE_ROLE_KEY

# Storage Configuration
STORAGE_URL=https://SEU_PROJECT_REF.supabase.co/storage/v1

# AI Configuration (configure conforme necessário)
OPENAI_API_KEY=SUA_OPENAI_KEY
GLM_API_KEY=SUA_GLM_KEY

# Session Configuration
SESSION_SECRET=uma_string_secreta_aleatoria_muito_longa

# Environment
NODE_ENV=development
PORT=5000
```

### 4. Testar Conectividade

Após configurar as variáveis, execute:

```bash
npm run test:supabase
```

Ou manualmente:

```bash
npx tsx server/test-supabase-connection.ts
```

## 🗄️ Migração do Schema

### Opção 1: Usar Drizzle Push (Recomendado para desenvolvimento)

```bash
npx drizzle-kit push
```

### Opção 2: Gerar e Aplicar Migrações

```bash
# Gerar migração
npx drizzle-kit generate

# Aplicar migração
npx drizzle-kit migrate
```

## 📦 Configurar Storage

1. No Dashboard do Supabase, vá em **Storage**
2. Crie um bucket chamado `documents`
3. Configure as políticas de acesso conforme necessário

## 🔐 Configurar RLS (Row Level Security)

O projeto já inclui políticas RLS. Para aplicá-las:

```bash
npx tsx server/scripts/setup-multi-tenant.ts
```

## ✅ Verificação Final

Após a configuração, verifique se:

- [ ] Variáveis de ambiente estão configuradas
- [ ] Conexão com banco está funcionando
- [ ] Schema foi migrado
- [ ] Storage está configurado
- [ ] RLS está ativo

## 🆘 Problemas Comuns

### Erro de Conexão
- Verifique se a DATABASE_URL está correta
- Confirme se a senha não contém caracteres especiais que precisam ser codificados

### Erro de Autenticação
- Verifique se as chaves SUPABASE_URL e SUPABASE_ANON_KEY estão corretas
- Confirme se o projeto está ativo no Supabase

### Erro de Schema
- Execute `npx drizzle-kit push` para sincronizar o schema
- Verifique se as tabelas foram criadas no Dashboard do Supabase

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs do console
2. Execute o teste de conectividade
3. Consulte a documentação do Supabase: https://supabase.com/docs