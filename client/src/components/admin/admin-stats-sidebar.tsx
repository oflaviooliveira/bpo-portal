import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Users, 
  FileText, 
  Calendar,
  Clock,
  Activity,
  AlertCircle
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
  tenants: Array<{
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    createdAt: string;
    stats: {
      users: number;
      documents: number;
      contrapartes: number;
      categories: number;
      costCenters: number;
      lastDocumentUpload: string | null;
    };
  }>;
}

export function AdminStatsSidebar() {
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
              <AlertCircle className="h-5 w-5" />
              <span>Erro ao carregar estatísticas globais</span>
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
        <h2 className="font-gilroy font-bold text-2xl text-foreground">Estatísticas Globais</h2>
        <p className="text-muted-foreground">Detalhamento completo por cliente BPO</p>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-2">
          <Activity className="h-4 w-4" />
          <span>Atualizado automaticamente a cada 30s</span>
        </div>
      </div>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Resumo de Atividade</p>
                <div className="space-y-1 mt-2">
                  <div className="flex justify-between text-sm">
                    <span>Documentos (última semana)</span>
                    <span className="font-medium">{stats.summary.documents.lastWeek}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Documentos (último mês)</span>
                    <span className="font-medium">{stats.summary.documents.lastMonth}</span>
                  </div>
                </div>
              </div>
              <FileText className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status dos Clientes</p>
                <div className="space-y-1 mt-2">
                  <div className="flex justify-between text-sm">
                    <span>Clientes ativos</span>
                    <span className="font-medium text-green-600">{stats.summary.tenants.active}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Clientes inativos</span>
                    <span className="font-medium text-red-600">{stats.summary.tenants.inactive}</span>
                  </div>
                </div>
              </div>
              <Building2 className="h-8 w-8 text-gquicks-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista Detalhada de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Cliente</CardTitle>
          <CardDescription>
            Estatísticas completas de cada cliente BPO
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats.tenants.map((tenant) => (
              <Card key={tenant.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-lg">{tenant.name}</h3>
                    <p className="text-sm text-muted-foreground">@{tenant.slug}</p>
                  </div>
                  <Badge variant={tenant.isActive ? "default" : "secondary"}>
                    {tenant.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{tenant.stats.users}</p>
                    <p className="text-xs text-muted-foreground">Usuários</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{tenant.stats.documents}</p>
                    <p className="text-xs text-muted-foreground">Documentos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{tenant.stats.contrapartes}</p>
                    <p className="text-xs text-muted-foreground">Contrapartes</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-lg font-bold">{tenant.stats.categories}</p>
                    <p className="text-xs text-muted-foreground">Categorias</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold">{tenant.stats.costCenters}</p>
                    <p className="text-xs text-muted-foreground">Centros de Custo</p>
                  </div>
                </div>
                
                <div className="pt-3 border-t">
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Criado em {new Date(tenant.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {tenant.stats.lastDocumentUpload && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
                      <Clock className="h-4 w-4" />
                      <span>
                        Último documento: {new Date(tenant.stats.lastDocumentUpload).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}
                  {!tenant.stats.lastDocumentUpload && (
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
                      <Clock className="h-4 w-4" />
                      <span>Nenhum documento processado</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
            
            {stats.tenants.length === 0 && (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum cliente cadastrado no sistema</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}