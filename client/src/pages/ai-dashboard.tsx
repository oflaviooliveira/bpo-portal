import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Activity, 
  TrendingUp, 
  Clock, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle,
  Zap,
  Brain,
  Gauge,
  BarChart3
} from "lucide-react";

interface ProviderMetrics {
  enabled: boolean;
  status: string;
  priority: number;
  costPer1000: number;
  performance: {
    totalRequests: number;
    totalCost: number;
    totalTokens: number;
    avgResponseTime: number;
    successRate: number;
    failureReasons: Record<string, number>;
  };
}

interface ProviderComparison {
  glm: {
    name: string;
    requests: number;
    successRate: number;
    avgCost: number;
    avgTime: number;
    status: string;
  } | null;
  openai: {
    name: string;
    requests: number;
    successRate: number;
    avgCost: number;
    avgTime: number;
    status: string;
  } | null;
  recommendations: string[];
}

export function AIDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Performance metrics
  const { data: performance, refetch: refetchPerformance } = useQuery({
    queryKey: ["/api/ai-control/performance"],
    refetchInterval: autoRefresh ? 10000 : false // 10 segundos
  });

  // Real-time status
  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["/api/ai-control/status"],
    refetchInterval: autoRefresh ? 5000 : false // 5 segundos
  });

  // Analytics
  const { data: analytics } = useQuery({
    queryKey: ["/api/ai-control/analytics"],
    refetchInterval: autoRefresh ? 30000 : false // 30 segundos
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-yellow-500';
    }
  };

  const getHealthScore = (successRate: number) => {
    if (successRate >= 95) return { label: 'Excelente', color: 'text-green-600' };
    if (successRate >= 80) return { label: 'Bom', color: 'text-blue-600' };
    if (successRate >= 60) return { label: 'Regular', color: 'text-yellow-600' };
    return { label: 'Crítico', color: 'text-red-600' };
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 6
    }).format(value);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard IA</h1>
          <p className="text-muted-foreground">Monitoramento em tempo real dos providers de IA</p>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            data-testid="button-auto-refresh"
          >
            <Activity className="h-4 w-4 mr-2" />
            Auto-atualizar {autoRefresh && '(ativo)'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchPerformance();
              refetchStatus();
            }}
            data-testid="button-manual-refresh"
          >
            <Clock className="h-4 w-4 mr-2" />
            Atualizar agora
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      {status && status.systemHealth && (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Status do Sistema
              <Badge 
                variant={status.systemHealth.overall === 'healthy' ? 'default' : 'destructive'}
                className="ml-auto"
              >
                {status.systemHealth.overall === 'healthy' ? 'Saudável' : 'Degradado'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {status.providers && status.providers.map((provider: any) => (
                <div key={provider.name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(provider.status)}`} />
                    <div>
                      <div className="font-medium">{provider.name.toUpperCase()}</div>
                      <div className="text-xs text-muted-foreground">
                        Prioridade {provider.priority} • {provider.model}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${getHealthScore(provider.healthScore).color}`}>
                      {getHealthScore(provider.healthScore).label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {provider.healthScore.toFixed(1)}% sucesso
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      {performance && performance.summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-sm">
                <BarChart3 className="h-4 w-4 mr-2" />
                Total de Requests
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {performance.summary.totalRequests || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Últimos 30 dias
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-sm">
                <DollarSign className="h-4 w-4 mr-2" />
                Custo Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(performance.summary.totalCost || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Economia vs OpenAI puro
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-sm">
                <TrendingUp className="h-4 w-4 mr-2" />
                Taxa de Sucesso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(performance.summary.avgSuccessRate || 0).toFixed(1)}%
              </div>
              <Progress value={performance.summary.avgSuccessRate || 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-sm">
                <Zap className="h-4 w-4 mr-2" />
                Provider Primário
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {status?.systemHealth?.primaryProvider?.toUpperCase() || 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                Processamento ativo
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Provider Comparison */}
      {performance && performance.comparison && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* GLM Stats */}
          {performance.comparison.glm && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  GLM Performance
                  <Badge variant="outline" className="bg-blue-50">
                    Primário
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Requests</div>
                    <div className="text-xl font-bold">{performance.comparison.glm.requests}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Taxa Sucesso</div>
                    <div className="text-xl font-bold text-green-600">
                      {performance.comparison.glm.successRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Custo Médio</div>
                    <div className="text-sm font-medium">
                      {formatCurrency(performance.comparison.glm.avgCost)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Tempo Médio</div>
                    <div className="text-sm font-medium">
                      {(performance.comparison.glm.avgTime / 1000).toFixed(1)}s
                    </div>
                  </div>
                </div>
                
                <Progress value={performance.comparison.glm.successRate} className="h-2" />
              </CardContent>
            </Card>
          )}

          {/* OpenAI Stats */}
          {performance.comparison.openai && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-green-600" />
                  OpenAI Performance
                  <Badge variant="outline" className="bg-green-50">
                    Fallback
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Requests</div>
                    <div className="text-xl font-bold">{performance.comparison.openai.requests}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Taxa Sucesso</div>
                    <div className="text-xl font-bold text-green-600">
                      {performance.comparison.openai.successRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Custo Médio</div>
                    <div className="text-sm font-medium">
                      {formatCurrency(performance.comparison.openai.avgCost)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Tempo Médio</div>
                    <div className="text-sm font-medium">
                      {(performance.comparison.openai.avgTime / 1000).toFixed(1)}s
                    </div>
                  </div>
                </div>
                
                <Progress value={performance.comparison.openai.successRate} className="h-2" />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recommendations */}
      {performance && performance.comparison && performance.comparison.recommendations && performance.comparison.recommendations.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="h-5 w-5" />
              Recomendações do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {performance.comparison.recommendations.map((rec: string, index: number) => (
                <li key={index} className="flex items-start gap-2 text-yellow-800">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Analytics Timeline */}
      {analytics && analytics.timeline && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Histórico de Performance (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 flex items-end justify-between gap-1">
              {analytics.timeline.slice(-14).map((day: any, index: number) => (
                <div key={index} className="flex flex-col items-center gap-1 flex-1">
                  <div 
                    className="bg-blue-500 rounded-t w-full min-h-[4px]"
                    style={{
                      height: `${Math.max((day.requests / Math.max(...analytics.timeline.map((d: any) => d.requests))) * 100, 4)}px`
                    }}
                  />
                  <div className="text-xs text-muted-foreground">
                    {new Date(day.date).getDate()}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Últimos 14 dias • Altura = número de requests por dia
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}