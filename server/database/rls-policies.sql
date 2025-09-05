-- ================================
-- ROW LEVEL SECURITY POLICIES
-- Portal BPO Financeiro - Gquicks
-- ================================

-- Ativar RLS em todas as tabelas multi-tenant
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrapartes ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;

-- ================================
-- POLÍTICAS PARA TABELA TENANTS
-- ================================

-- Apenas ADMIN global pode ver todos os tenants
CREATE POLICY tenant_policy_admin ON tenants
FOR ALL TO authenticated
USING (
  -- Usuários ADMIN podem ver todos os tenants
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = current_setting('app.current_user', true)::uuid 
    AND u.role = 'ADMIN'
  )
);

-- Usuários normais só veem seu próprio tenant
CREATE POLICY tenant_policy_self ON tenants
FOR SELECT TO authenticated
USING (
  id = current_setting('app.current_tenant', true)::uuid
);

-- ================================
-- POLÍTICAS PARA TABELA USERS
-- ================================

-- Usuários só podem ver outros usuários do mesmo tenant
CREATE POLICY users_policy_tenant ON users
FOR ALL TO authenticated
USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ADMIN global pode ver usuários de qualquer tenant (para gestão)
CREATE POLICY users_policy_admin ON users
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = current_setting('app.current_user', true)::uuid 
    AND u.role = 'ADMIN'
  )
);

-- ================================
-- POLÍTICAS PARA TABELA DOCUMENTS
-- ================================

-- Documentos isolados por tenant
CREATE POLICY documents_policy_tenant ON documents
FOR ALL TO authenticated
USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- Clientes só veem seus próprios documentos
CREATE POLICY documents_policy_client ON documents
FOR SELECT TO authenticated
USING (
  tenant_id = current_setting('app.current_tenant', true)::uuid
  AND (
    -- Admins, gerentes e operadores veem todos os docs do tenant
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = current_setting('app.current_user', true)::uuid 
      AND u.role IN ('ADMIN', 'GERENTE', 'OPERADOR')
      AND u.tenant_id = current_setting('app.current_tenant', true)::uuid
    )
    OR
    -- Clientes só veem seus próprios documentos
    client_id = current_setting('app.current_user', true)::uuid
  )
);

-- ================================
-- POLÍTICAS PARA TABELA CONTRAPARTES
-- ================================

-- Contrapartes isoladas por tenant
CREATE POLICY contrapartes_policy_tenant ON contrapartes
FOR ALL TO authenticated
USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ================================
-- POLÍTICAS PARA TABELA CATEGORIES
-- ================================

-- Categorias isoladas por tenant
CREATE POLICY categories_policy_tenant ON categories
FOR ALL TO authenticated
USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ================================
-- POLÍTICAS PARA TABELA COST_CENTERS
-- ================================

-- Centros de custo isolados por tenant
CREATE POLICY cost_centers_policy_tenant ON cost_centers
FOR ALL TO authenticated
USING (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- ================================
-- CONFIGURAÇÕES DE SEGURANÇA
-- ================================

-- Garantir que as variáveis de contexto sejam obrigatórias
ALTER DATABASE postgres SET app.current_tenant = '';
ALTER DATABASE postgres SET app.current_user = '';

-- Criar função para validar contexto tenant
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

-- ================================
-- GRANTS E PERMISSÕES
-- ================================

-- Garantir que o role 'authenticated' tenha as permissões necessárias
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ================================
-- ÍNDICES PARA PERFORMANCE
-- ================================

-- Índices para melhorar performance das consultas com tenant_id
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contrapartes_tenant_id ON contrapartes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_tenant_id ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_tenant_id ON cost_centers(tenant_id);

-- Índices compostos para queries comuns
CREATE INDEX IF NOT EXISTS idx_documents_tenant_status ON documents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_client ON documents(tenant_id, client_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);