import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Users, 
  FileText, 
  TrendingUp, 
  Eye, 
  Target,
  Activity,
  Zap
} from 'lucide-react';

interface DashboardStats {
  summary: {
    tenants: {
      total: number;
      active: number;
      inactive: number;
    };
    users: {
      total: number;
      active: number;
      inactive: number;
    };
    documents: {
      total: number;
      lastWeek: number;
      lastMonth: number;
    };
    contrapartes: {
      total: number;
    };
  };
  analytics: {
    documentsByStatus: Array<{
      status: string;
      count: number;
      label: string;
    }>;
    topTenants: Array<{
      tenantId: string;
      tenantName: string;
      documentCount: number;
    }>;
    ocrPerformance: {
      totalRuns: number;
      avgProcessingTime: number;
      avgConfidence: number;
      successRate: number;
    };
    aiStats: {
      totalRuns: number;
      avgProcessingTime: number;
    };
    usersByRole: Array<{
      role: string;
      count: number;
      label: string;
    }>;
  };
}

export function AdminDashboardSidebar() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['/api/admin/dashboard/stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/dashboard/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }
      return await response.json() as DashboardStats;
    },
    refetchInterval: 30000 // Atualizar a cada 30 segundos
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'RECEBIDO': 'bg-blue-500',
      'VALIDANDO': 'bg-yellow-500',
      'PENDENTE_REVISAO': 'bg-orange-500',
      'PAGO_A_CONCILIAR': 'bg-green-500',
      'EM_CONCILIACAO': 'bg-purple-500',
      'AGENDAR': 'bg-cyan-500',
      'AGENDADO': 'bg-indigo-500',
      'A_PAGAR_HOJE': 'bg-red-500',
      'AGUARDANDO_RECEBIMENTO': 'bg-pink-500',
      'EMITIR_BOLETO': 'bg-amber-500',
      'EMITIR_NF': 'bg-emerald-500',
      'ARQUIVADO': 'bg-gray-500'
    };
    return colors[status] || 'bg-gray-400';
  };

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      'ADMIN': 'bg-red-500',
      'GERENTE': 'bg-blue-500',
      'OPERADOR': 'bg-green-500',
      'CLIENTE': 'bg-purple-500'
    };
    return colors[role] || 'bg-gray-500';
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-gquicks-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando estatísticas...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2 text-red-700">
              <Activity className="h-5 w-5" />
              <span>Erro ao carregar estatísticas administrativas</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-gilroy font-bold text-2xl text-foreground">Dashboard Administrativo</h2>
        <p className="text-muted-foreground">Visão consolidada de todos os clientes BPO</p>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-2">
          <Activity className="h-4 w-4" />
          <span>Atualizado automaticamente a cada 30s</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Clientes</p>
                <p className="text-2xl font-bold">{stats.summary.tenants.total}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.summary.tenants.active} ativos
                </p>
              </div>
              <Building2 className="h-8 w-8 text-gquicks-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Usuários Totais</p>
                <p className="text-2xl font-bold">{stats.summary.users.total}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.summary.users.active} ativos
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Documentos</p>
                <p className="text-2xl font-bold">{stats.summary.documents.total}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.summary.documents.lastWeek} esta semana
                </p>
              </div>
              <FileText className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Performance OCR</p>
                <p className="text-2xl font-bold">{stats.analytics.ocrPerformance.successRate}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Taxa de sucesso
                </p>
              </div>
              <Target className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance OCR */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Eye className="h-5 w-5" />
              <span>Performance OCR</span>
            </CardTitle>
            <CardDescription>Estatísticas de reconhecimento óptico</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Taxa de Sucesso</span>
                <span className="text-sm">{stats.analytics.ocrPerformance.successRate}%</span>
              </div>
              <Progress value={stats.analytics.ocrPerformance.successRate} className="w-full" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Confiança Média</span>
                <span className="text-sm">{stats.analytics.ocrPerformance.avgConfidence}%</span>
              </div>
              <Progress value={stats.analytics.ocrPerformance.avgConfidence} className="w-full" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div>
                <p className="text-sm font-medium">Total de Execuções</p>
                <p className="text-xl font-bold">{stats.analytics.ocrPerformance.totalRuns}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Tempo Médio</p>
                <p className="text-xl font-bold">{stats.analytics.ocrPerformance.avgProcessingTime}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance IA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5" />
              <span>Performance IA</span>
            </CardTitle>
            <CardDescription>Estatísticas de processamento inteligente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Total de Execuções</p>
                <p className="text-xl font-bold">{stats.analytics.aiStats.totalRuns}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Tempo Médio</p>
                <p className="text-xl font-bold">{stats.analytics.aiStats.avgProcessingTime}ms</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Tenants */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Top Clientes por Volume</span>
          </CardTitle>
          <CardDescription>Clientes com maior volume de documentos processados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.analytics.topTenants.map((tenant, index) => (
              <div key={tenant.tenantId} className="flex items-center space-x-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gquicks-primary text-white text-sm font-bold">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{tenant.tenantName}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-gquicks-primary h-2 rounded-full" 
                      style={{ 
                        width: `${stats.analytics.topTenants.length > 0 ? (tenant.documentCount / stats.analytics.topTenants[0].documentCount) * 100 : 0}%` 
                      }}
                    ></div>
                  </div>
                </div>
                <Badge variant="outline">{tenant.documentCount} docs</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Distribuições */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documentos por Status */}
        <Card>
          <CardHeader>
            <CardTitle>Documentos por Status</CardTitle>
            <CardDescription>Distribuição atual dos documentos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.analytics.documentsByStatus.map((item) => (
                <div key={item.status} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(item.status)}`}></div>
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <Badge variant="outline">{item.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Usuários por Papel */}
        <Card>
          <CardHeader>
            <CardTitle>Usuários por Função</CardTitle>
            <CardDescription>Distribuição de papéis no sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.analytics.usersByRole.map((item) => (
                <div key={item.role} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${getRoleColor(item.role)}`}></div>
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <Badge variant="outline">{item.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}