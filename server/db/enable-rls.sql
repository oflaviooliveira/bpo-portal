
-- Ativar RLS em todas as tabelas com tenant_id
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrapartes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_inconsistencies ENABLE ROW LEVEL SECURITY;

-- Políticas para users
CREATE POLICY p_users_select ON users
  FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_users_insert ON users
  FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_users_update ON users
  FOR UPDATE USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_users_delete ON users
  FOR DELETE USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Políticas para contrapartes
CREATE POLICY p_contrapartes_select ON contrapartes
  FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_contrapartes_insert ON contrapartes
  FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_contrapartes_update ON contrapartes
  FOR UPDATE USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_contrapartes_delete ON contrapartes
  FOR DELETE USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Políticas para clients
CREATE POLICY p_clients_select ON clients
  FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_clients_insert ON clients
  FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_clients_update ON clients
  FOR UPDATE USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_clients_delete ON clients
  FOR DELETE USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Políticas para categories
CREATE POLICY p_categories_select ON categories
  FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_categories_insert ON categories
  FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_categories_update ON categories
  FOR UPDATE USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_categories_delete ON categories
  FOR DELETE USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Políticas para cost_centers
CREATE POLICY p_cost_centers_select ON cost_centers
  FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_cost_centers_insert ON cost_centers
  FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_cost_centers_update ON cost_centers
  FOR UPDATE USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_cost_centers_delete ON cost_centers
  FOR DELETE USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Políticas para documents
CREATE POLICY p_documents_select ON documents
  FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_documents_insert ON documents
  FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_documents_update ON documents
  FOR UPDATE USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_documents_delete ON documents
  FOR DELETE USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Políticas para document_logs
CREATE POLICY p_document_logs_select ON document_logs
  FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_document_logs_insert ON document_logs
  FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_document_logs_update ON document_logs
  FOR UPDATE USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_document_logs_delete ON document_logs
  FOR DELETE USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Políticas para ai_runs
CREATE POLICY p_ai_runs_select ON ai_runs
  FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_ai_runs_insert ON ai_runs
  FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_ai_runs_update ON ai_runs
  FOR UPDATE USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_ai_runs_delete ON ai_runs
  FOR DELETE USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Políticas para ocr_metrics
CREATE POLICY p_ocr_metrics_select ON ocr_metrics
  FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_ocr_metrics_insert ON ocr_metrics
  FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_ocr_metrics_update ON ocr_metrics
  FOR UPDATE USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_ocr_metrics_delete ON ocr_metrics
  FOR DELETE USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Políticas para document_inconsistencies
CREATE POLICY p_document_inconsistencies_select ON document_inconsistencies
  FOR SELECT USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_document_inconsistencies_insert ON document_inconsistencies
  FOR INSERT WITH CHECK (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_document_inconsistencies_update ON document_inconsistencies
  FOR UPDATE USING (tenant_id::text = current_setting('app.current_tenant', true));
CREATE POLICY p_document_inconsistencies_delete ON document_inconsistencies
  FOR DELETE USING (tenant_id::text = current_setting('app.current_tenant', true));
