
# 🗄️ Schema Completo do Banco de Dados - Portal BPO OCR

## Visão Geral
Sistema multi-tenant com Row Level Security (RLS) para isolamento completo entre clientes. Utiliza PostgreSQL 15 com Drizzle ORM.

## 📊 Diagrama Conceitual

```
TENANTS (1) ──→ (N) USERS
    │
    ├──→ (N) CONTRAPARTES
    ├──→ (N) CLIENTS (Legacy)
    ├──→ (N) CATEGORIES
    ├──→ (N) COST_CENTERS
    └──→ (N) DOCUMENTS
              │
              ├──→ (N) DOCUMENT_LOGS
              ├──→ (N) AI_RUNS
              ├──→ (N) OCR_METRICS
              └──→ (N) DOCUMENT_INCONSISTENCIES

BANKS (Global)
USER_SUPPLIER_PREFERENCES (N:N entre Users e Contrapartes)
```

## 🏢 1. TENANTS - Tabela de Inquilinos

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Campos:**
- `id`: Identificador único do tenant
- `name`: Nome da empresa/cliente
- `slug`: Identificador único para URLs (ex: "empresa-abc")
- `is_active`: Status do tenant
- `created_at/updated_at`: Controle temporal

## 👥 2. USERS - Sistema de Usuários com RBAC

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(255) NOT NULL,
  password TEXT NOT NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'CLIENT_USER',
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(tenant_id, username),
  UNIQUE(tenant_id, email)
);
```

**Roles Disponíveis:**
- `SUPER_ADMIN`: CEO da Gquicks (acesso global)
- `CLIENT_USER`: Usuário cliente (acesso limitado ao próprio tenant)

## 🏪 3. CONTRAPARTES - Fornecedores e Clientes Unificados

```sql
CREATE TABLE contrapartes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  document VARCHAR(18), -- CPF: XXX.XXX.XXX-XX ou CNPJ: XX.XXX.XXX/XXXX-XX
  document_type VARCHAR(4), -- "CPF" ou "CNPJ"
  
  -- Dados de contato
  email VARCHAR(255),
  phone VARCHAR(20),
  contact_name VARCHAR(255),
  
  -- Documentação adicional
  state_registration VARCHAR(50), -- Inscrição Estadual
  
  -- Endereço completo
  street VARCHAR(255),
  number VARCHAR(20),
  complement VARCHAR(100),
  neighborhood VARCHAR(100),
  city VARCHAR(100),
  state VARCHAR(2), -- UF (SP, RJ, etc.)
  zip_code VARCHAR(10), -- CEP: XXXXX-XXX
  
  -- Controle de tipo
  can_be_client BOOLEAN NOT NULL DEFAULT true,
  can_be_supplier BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(tenant_id, document)
);
```

## 🏦 4. BANKS - Bancos (Tabela Global)

```sql
CREATE TABLE banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) NOT NULL UNIQUE, -- 341, 237, etc
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);
```

**Dados Iniciais:**
- 341 - Itaú
- 237 - Bradesco
- 001 - Banco do Brasil
- 104 - Caixa Econômica Federal

## 📂 5. CATEGORIES - Categorias de Documentos

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(tenant_id, name)
);
```

## 🏢 6. COST_CENTERS - Centros de Custo

```sql
CREATE TABLE cost_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(tenant_id, name)
);
```

## 📄 7. DOCUMENTS - Tabela Principal de Documentos

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),

  -- Nova estrutura com contrapartes unificadas
  contraparte_id UUID REFERENCES contrapartes(id),
  relationship_type VARCHAR(20), -- CLIENT ou SUPPLIER

  -- Campos legacy (compatibilidade)
  client_id UUID REFERENCES clients(id),

  -- Relacionamentos
  bank_id UUID REFERENCES banks(id),
  category_id UUID REFERENCES categories(id),
  cost_center_id UUID REFERENCES cost_centers(id),

  -- Informações do arquivo (opcional para documentos virtuais)
  file_name VARCHAR(500),
  original_name VARCHAR(500),
  file_size INTEGER,
  mime_type VARCHAR(100),
  file_path TEXT,
  is_virtual_document BOOLEAN NOT NULL DEFAULT false,

  -- Dados de negócio
  document_type VARCHAR(50) NOT NULL, -- PAGO, AGENDADO, EMITIR_BOLETO, EMITIR_NF
  amount DECIMAL(15,2),
  supplier VARCHAR(255), -- LEGACY: Nome do fornecedor
  description TEXT,

  -- Datas obrigatórias para BPO
  competence_date TIMESTAMP, -- Data de Competência
  due_date TIMESTAMP, -- Data de Vencimento
  paid_date TIMESTAMP, -- Data de Pagamento

  -- Campos específicos para emissão
  issuer_data JSONB, -- Dados do tomador para boletos/NF
  instructions TEXT, -- Instruções específicas

  -- Status do processamento
  status VARCHAR(50) NOT NULL DEFAULT 'RECEBIDO',
  -- Estados: RECEBIDO, VALIDANDO, PENDENTE_REVISAO, PAGO_A_CONCILIAR, 
  -- AGENDADO, A_PAGAR_HOJE, AGUARDANDO_RECEBIMENTO, EM_CONCILIACAO, 
  -- ARQUIVADO, PENDENTE_EMISSAO, BOLETO_EMITIDO, AGUARDANDO_PAGAMENTO, BOLETO_VENCIDO

  -- Resultados OCR e IA
  ocr_text TEXT,
  ocr_confidence DECIMAL(5,2),
  ai_analysis JSONB, -- Dados estruturados da IA
  ai_provider VARCHAR(50), -- GLM, GPT, etc

  -- Validação
  validation_errors JSONB,
  is_validated BOOLEAN NOT NULL DEFAULT false,
  validated_by UUID REFERENCES users(id),
  validated_at TIMESTAMP,

  -- Metadata
  notes TEXT,
  is_ready_for_bpo BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 📋 8. DOCUMENT_LOGS - Logs de Ações nos Documentos

```sql
CREATE TABLE document_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  action VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  details JSONB,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🤖 9. AI_RUNS - Rastreabilidade de Execuções de IA

```sql
CREATE TABLE ai_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  provider_used VARCHAR(50) NOT NULL, -- 'glm', 'openai'
  fallback_reason VARCHAR(100), -- 'timeout', 'invalid_json', 'error', 'low_confidence'
  ocr_strategy VARCHAR(50) NOT NULL, -- 'pdf', 'image', 'filename_fallback'
  processing_time_ms INTEGER NOT NULL,
  tokens_in INTEGER NOT NULL,
  tokens_out INTEGER NOT NULL,
  cost_usd DECIMAL(10,6) NOT NULL,
  confidence REAL NOT NULL, -- 0-100
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 👁️ 10. OCR_METRICS - Métricas Detalhadas do OCR

```sql
CREATE TABLE ocr_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  strategy_used VARCHAR(50) NOT NULL, -- 'PDF_DIRECT_TEXT', 'PDFTOTEXT_COMMAND', etc.
  success BOOLEAN NOT NULL,
  processing_time_ms INTEGER,
  character_count INTEGER NOT NULL,
  confidence INTEGER NOT NULL, -- 0-100
  fallback_level INTEGER NOT NULL DEFAULT 0, -- 0 = primeira tentativa, 1+ = fallbacks
  metadata JSONB, -- dados específicos da estratégia
  created_at TIMESTAMP DEFAULT NOW()
);
```

## ⚠️ 11. DOCUMENT_INCONSISTENCIES - Divergências Detectadas

```sql
CREATE TABLE document_inconsistencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  field VARCHAR(50) NOT NULL, -- 'valor', 'data_pagamento', 'competencia', etc.
  ocr_value TEXT,
  filename_value TEXT,
  form_value TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 🎯 12. USER_SUPPLIER_PREFERENCES - Preferências Aprendidas

```sql
CREATE TABLE user_supplier_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  supplier_id UUID NOT NULL REFERENCES contrapartes(id),
  
  -- Preferências operacionais aprendidas
  preferred_bank_id UUID REFERENCES banks(id),
  preferred_category_id UUID REFERENCES categories(id),
  preferred_cost_center_id UUID REFERENCES cost_centers(id),
  
  -- Descrição padrão personalizada
  custom_description TEXT,
  
  -- Métricas de confiança
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP DEFAULT NOW(),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(tenant_id, user_id, supplier_id)
);
```

## 👥 13. CLIENTS - Tabela Legacy (Compatibilidade)

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  document VARCHAR(50), -- CNPJ/CPF
  email VARCHAR(255),
  phone VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🔐 Row Level Security (RLS)

### Ativação do RLS

```sql
-- Ativar RLS em todas as tabelas multi-tenant
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrapartes ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_inconsistencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_supplier_preferences ENABLE ROW LEVEL SECURITY;
```

### Políticas RLS

```sql
-- Política para isolamento por tenant (padrão para todas as tabelas)
CREATE POLICY p_[TABLE]_tenant ON [TABLE]
  FOR ALL USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Política especial para tenants (apenas SUPER_ADMIN vê todos)
CREATE POLICY tenant_policy_admin ON tenants
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = current_setting('app.current_user', true)::uuid 
    AND u.role = 'SUPER_ADMIN'
  )
);

-- Usuários normais só veem seu próprio tenant
CREATE POLICY tenant_policy_self ON tenants
FOR SELECT TO authenticated
USING (id = current_setting('app.current_tenant', true)::uuid);
```

## 📊 Índices para Performance

```sql
-- Índices principais para tenant_id
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX idx_contrapartes_tenant_id ON contrapartes(tenant_id);
CREATE INDEX idx_categories_tenant_id ON categories(tenant_id);
CREATE INDEX idx_cost_centers_tenant_id ON cost_centers(tenant_id);

-- Índices compostos para queries comuns
CREATE INDEX idx_documents_tenant_status ON documents(tenant_id, status);
CREATE INDEX idx_documents_tenant_client ON documents(tenant_id, client_id);
CREATE INDEX idx_users_tenant_role ON users(tenant_id, role);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_ai_runs_document_id ON ai_runs(document_id);
CREATE INDEX idx_ocr_metrics_document_id ON ocr_metrics(document_id);
```

## 🔧 Configurações de Segurança

```sql
-- Configurações obrigatórias de contexto
ALTER DATABASE postgres SET app.current_tenant = '';
ALTER DATABASE postgres SET app.current_user = '';

-- Função para validar contexto
CREATE OR REPLACE FUNCTION validate_tenant_context()
RETURNS void AS $$
BEGIN
  IF current_setting('app.current_tenant', true) = '' OR current_setting('app.current_tenant', true) IS NULL THEN
    RAISE EXCEPTION 'Tenant context not set. Access denied.';
  END IF;
  
  IF current_setting('app.current_user', true) = '' OR current_setting('app.current_user', true) IS NULL THEN
    RAISE EXCEPTION 'User context not set. Access denied.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 📈 Estatísticas e Monitoramento

### Views Úteis

```sql
-- View para estatísticas por tenant
CREATE VIEW tenant_stats AS
SELECT 
  t.name as tenant_name,
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT d.id) as total_documents,
  COUNT(DISTINCT c.id) as total_contrapartes,
  SUM(CASE WHEN d.status = 'PENDENTE_REVISAO' THEN 1 ELSE 0 END) as pending_review,
  SUM(CASE WHEN d.status = 'ARQUIVADO' THEN 1 ELSE 0 END) as archived
FROM tenants t
LEFT JOIN users u ON t.id = u.tenant_id
LEFT JOIN documents d ON t.id = d.tenant_id  
LEFT JOIN contrapartes c ON t.id = c.tenant_id
GROUP BY t.id, t.name;

-- View para métricas de IA
CREATE VIEW ai_performance_stats AS
SELECT 
  tenant_id,
  provider_used,
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_runs,
  AVG(confidence) as avg_confidence,
  AVG(processing_time_ms) as avg_processing_time,
  SUM(cost_usd) as total_cost
FROM ai_runs
GROUP BY tenant_id, provider_used, DATE_TRUNC('day', created_at);
```

## 🚀 Scripts de Setup

### 1. Seed de Dados Iniciais

```sql
-- Inserir bancos padrão
INSERT INTO banks (code, name) VALUES 
('001', 'Banco do Brasil'),
('237', 'Bradesco'),
('341', 'Itaú'),
('104', 'Caixa Econômica Federal'),
('033', 'Santander'),
('260', 'Nu Pagamentos');

-- Inserir tenant exemplo
INSERT INTO tenants (name, slug) VALUES 
('Empresa Exemplo', 'empresa-exemplo');
```

### 2. Validação de Integridade

```sql
-- Verificar isolamento RLS
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'documents', 'contrapartes', 'categories', 'cost_centers')
ORDER BY tablename;

-- Verificar políticas ativas
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual
FROM pg_policies 
WHERE schemaname = 'public';
```

## 📋 Checklist de Implementação

- [x] Estrutura multi-tenant com RLS
- [x] Sistema RBAC (Super Admin + Client User)
- [x] Contrapartes unificadas (clientes + fornecedores)
- [x] Rastreabilidade completa de OCR e IA
- [x] Sistema de preferências inteligentes
- [x] Logs detalhados de ações
- [x] Detecção de inconsistências
- [x] Índices otimizados para performance
- [x] Views para relatórios e estatísticas
- [x] Configurações de segurança robustas

## 🔄 Migrações Futuras

1. **Versão 1.1**: Adicionar suporte a notificações
2. **Versão 1.2**: Integração com ERPs externos
3. **Versão 1.3**: Sistema de aprovações em múltiplos níveis
4. **Versão 1.4**: Auditoria avançada e compliance

---

**Autor**: Sistema BPO OCR - Gquicks  
**Versão**: 1.0  
**Data**: Janeiro 2025
