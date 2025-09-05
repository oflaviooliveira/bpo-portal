import { Request, Response } from 'express';
import { db } from '../db';
import { eq, and, gte, count, sum, sql } from 'drizzle-orm';
import { 
  tenants, 
  users, 
  documents, 
  contrapartes, 
  categories, 
  costCenters,
  ocrMetrics,
  aiRuns 
} from '@shared/schema';

/**
 * Estatísticas avançadas do dashboard administrativo
 */
export async function getDashboardStats(req: Request, res: Response) {
  try {
    console.log('📊 Gerando estatísticas do dashboard administrativo...');

    // Data de referência para métricas temporais
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Estatísticas Gerais
    const generalStats = await db.select({
      totalTenants: count(tenants.id),
      activeTenants: sql<number>`COUNT(CASE WHEN ${tenants.isActive} = true THEN 1 END)`,
      totalUsers: sql<number>`COUNT(DISTINCT ${users.id})`,
      activeUsers: sql<number>`COUNT(DISTINCT CASE WHEN ${users.isActive} = true THEN ${users.id} END)`,
      totalDocuments: sql<number>`COUNT(DISTINCT ${documents.id})`,
      totalContrapartes: sql<number>`COUNT(DISTINCT ${contrapartes.id})`,
    }).from(tenants)
    .leftJoin(users, eq(users.tenantId, tenants.id))
    .leftJoin(documents, eq(documents.tenantId, tenants.id))
    .leftJoin(contrapartes, eq(contrapartes.tenantId, tenants.id));

    // 2. Estatísticas por Status de Documento
    const documentsByStatus = await db.select({
      status: documents.status,
      count: count()
    }).from(documents)
    .groupBy(documents.status);

    // 3. Documentos Processados por Período
    const documentsLastWeek = await db.select({
      count: count()
    }).from(documents)
    .where(gte(documents.createdAt, lastWeek));

    const documentsLastMonth = await db.select({
      count: count()
    }).from(documents)
    .where(gte(documents.createdAt, lastMonth));

    // 4. Top 5 Tenants por Volume de Documentos
    const topTenantsByDocuments = await db.select({
      tenantId: documents.tenantId,
      tenantName: tenants.name,
      documentCount: count(documents.id)
    }).from(documents)
    .innerJoin(tenants, eq(tenants.id, documents.tenantId))
    .groupBy(documents.tenantId, tenants.name)
    .orderBy(sql`count(${documents.id}) DESC`)
    .limit(5);

    // 5. Estatísticas de Performance OCR
    const ocrStats = await db.select({
      totalRuns: count(ocrMetrics.id),
      avgProcessingTime: sql<number>`AVG(${ocrMetrics.processingTimeMs})`,
      avgConfidence: sql<number>`AVG(${ocrMetrics.confidence})`,
      successRate: sql<number>`AVG(CASE WHEN ${ocrMetrics.success} = true THEN 100.0 ELSE 0.0 END)`
    }).from(ocrMetrics);

    // 6. Estatísticas básicas de IA (sem provider específico por enquanto)
    const aiStats = await db.select({
      totalRuns: count(aiRuns.id),
      avgProcessingTime: sql<number>`AVG(${aiRuns.processingTimeMs})`
    }).from(aiRuns);

    // 7. Crescimento de Tenants por Mês (últimos 6 meses)
    const tenantGrowth = await db.select({
      month: sql<string>`TO_CHAR(${tenants.createdAt}, 'YYYY-MM')`,
      count: count()
    }).from(tenants)
    .where(gte(tenants.createdAt, new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000)))
    .groupBy(sql`TO_CHAR(${tenants.createdAt}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${tenants.createdAt}, 'YYYY-MM')`);

    // 8. Estatísticas de Usuários por Papel
    const usersByRole = await db.select({
      role: users.role,
      count: count()
    }).from(users)
    .where(eq(users.isActive, true))
    .groupBy(users.role);

    // 9. Tenants com Estatísticas Detalhadas
    const tenantsWithDetailedStats = await db.select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      isActive: tenants.isActive,
      createdAt: tenants.createdAt,
      userCount: sql<number>`COUNT(DISTINCT ${users.id})`,
      documentCount: sql<number>`COUNT(DISTINCT ${documents.id})`,
      contraparteCount: sql<number>`COUNT(DISTINCT ${contrapartes.id})`,
      categoryCount: sql<number>`COUNT(DISTINCT ${categories.id})`,
      costCenterCount: sql<number>`COUNT(DISTINCT ${costCenters.id})`,
      lastDocumentUpload: sql<Date>`MAX(${documents.createdAt})`
    }).from(tenants)
    .leftJoin(users, eq(users.tenantId, tenants.id))
    .leftJoin(documents, eq(documents.tenantId, tenants.id))
    .leftJoin(contrapartes, eq(contrapartes.tenantId, tenants.id))
    .leftJoin(categories, eq(categories.tenantId, tenants.id))
    .leftJoin(costCenters, eq(costCenters.tenantId, tenants.id))
    .groupBy(tenants.id, tenants.name, tenants.slug, tenants.isActive, tenants.createdAt)
    .orderBy(sql`COUNT(DISTINCT ${documents.id}) DESC`);

    // Montar resposta
    const response = {
      summary: {
        tenants: {
          total: Number(generalStats[0]?.totalTenants || 0),
          active: Number(generalStats[0]?.activeTenants || 0),
          inactive: Number(generalStats[0]?.totalTenants || 0) - Number(generalStats[0]?.activeTenants || 0)
        },
        users: {
          total: Number(generalStats[0]?.totalUsers || 0),
          active: Number(generalStats[0]?.activeUsers || 0),
          inactive: Number(generalStats[0]?.totalUsers || 0) - Number(generalStats[0]?.activeUsers || 0)
        },
        documents: {
          total: Number(generalStats[0]?.totalDocuments || 0),
          lastWeek: Number(documentsLastWeek[0]?.count || 0),
          lastMonth: Number(documentsLastMonth[0]?.count || 0)
        },
        contrapartes: {
          total: Number(generalStats[0]?.totalContrapartes || 0)
        }
      },
      
      analytics: {
        documentsByStatus: documentsByStatus.map(item => ({
          status: item.status,
          count: Number(item.count),
          label: getStatusLabel(item.status)
        })),
        
        topTenants: topTenantsByDocuments.map(item => ({
          tenantId: item.tenantId,
          tenantName: item.tenantName,
          documentCount: Number(item.documentCount)
        })),
        
        ocrPerformance: {
          totalRuns: Number(ocrStats[0]?.totalRuns || 0),
          avgProcessingTime: Math.round(Number(ocrStats[0]?.avgProcessingTime || 0)),
          avgConfidence: Math.round(Number(ocrStats[0]?.avgConfidence || 0)),
          successRate: Math.round(Number(ocrStats[0]?.successRate || 0))
        },
        
        aiStats: {
          totalRuns: Number(aiStats[0]?.totalRuns || 0),
          avgProcessingTime: Math.round(Number(aiStats[0]?.avgProcessingTime || 0))
        },
        
        tenantGrowth: tenantGrowth.map(item => ({
          month: item.month,
          count: Number(item.count)
        })),
        
        usersByRole: usersByRole.map(item => ({
          role: item.role,
          count: Number(item.count),
          label: getRoleLabel(item.role)
        }))
      },
      
      tenants: tenantsWithDetailedStats.map(tenant => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        isActive: tenant.isActive,
        createdAt: tenant.createdAt,
        stats: {
          users: Number(tenant.userCount),
          documents: Number(tenant.documentCount),
          contrapartes: Number(tenant.contraparteCount),
          categories: Number(tenant.categoryCount),
          costCenters: Number(tenant.costCenterCount),
          lastDocumentUpload: tenant.lastDocumentUpload
        }
      }))
    };

    console.log('✅ Estatísticas geradas com sucesso');
    res.json(response);

  } catch (error) {
    console.error('❌ Erro ao gerar estatísticas do dashboard:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

/**
 * Labels amigáveis para status de documentos
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'RECEBIDO': 'Recebido',
    'VALIDANDO': 'Em Validação',
    'PENDENTE_REVISAO': 'Pendente Revisão',
    'PAGO_A_CONCILIAR': 'Pago - A Conciliar',
    'EM_CONCILIACAO': 'Em Conciliação',
    'AGENDAR': 'Agendar',
    'AGENDADO': 'Agendado',
    'A_PAGAR_HOJE': 'A Pagar Hoje',
    'AGUARDANDO_RECEBIMENTO': 'Aguardando Recebimento',
    'EMITIR_BOLETO': 'Emitir Boleto',
    'EMITIR_NF': 'Emitir Nota Fiscal',
    'ARQUIVADO': 'Arquivado'
  };
  return labels[status] || status;
}

/**
 * Labels amigáveis para papéis de usuários
 */
function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    'ADMIN': 'Administrador',
    'GERENTE': 'Gerente',
    'OPERADOR': 'Operador',
    'CLIENTE': 'Cliente'
  };
  return labels[role] || role;
}