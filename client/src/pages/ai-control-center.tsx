import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings,
  BarChart3,
  Gauge,
  Activity,
  RefreshCw,
  Cpu,
  Brain,
  Zap,
  Clock,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";

export default function AIControlCenter() {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  // Data queries
  const { data: providersData, isLoading } = useQuery({
    queryKey: ["/api/ai-control"],
    refetchInterval: autoRefresh ? 15000 : false
  });

  const { data: statusData } = useQuery({
    queryKey: ["/api/ai-control/status"],
    refetchInterval: autoRefresh ? 5000 : false
  });

  const { data: performanceData } = useQuery({
    queryKey: ["/api/ai-control/performance"],
    refetchInterval: autoRefresh ? 10000 : false
  });

  const { data: analyticsData } = useQuery({
    queryKey: ["/api/ai-control/analytics"],
    refetchInterval: autoRefresh ? 30000 : false
  });

  const { data: availableModels } = useQuery({
    queryKey: ["/api/ai-control/available-models"],
    refetchInterval: false // Models don't change frequently
  });

  // Mutations
  const toggleProviderMutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      return apiRequest("POST", "/api/ai-control/toggle-provider", { providerName: name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-control"] });
    },
  });

  const swapPrioritiesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/ai-control/swap-priorities", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-control"] });
    }
  });

  const updateModelMutation = useMutation({
    mutationFn: async ({ providerName, modelId }: { providerName: string; modelId: string }) => {
      return apiRequest("POST", "/api/ai-control/update-model", { providerName, modelId });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-control"] });
      toast({
        title: "Modelo atualizado",
        description: `Provider ${data.providerName} agora usa ${data.modelId}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar modelo",
        description: error?.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    }
  });

  const resetProviderMutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      return apiRequest("POST", "/api/ai-control/reset-provider", { providerName: name });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-control"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-control/status"] });
      toast({
        title: "Provider resetado",
        description: `Status do ${data.provider} foi resetado para online`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao resetar provider",
        description: error?.message || "Ocorreu um erro inesperado",
        variant: "destructive",
      });
    }
  });

  // Data processing
  const providers = (providersData as any)?.providers || [];
  const status = (statusData as any) || { providers: [], systemHealth: null };
  const performance = (performanceData as any) || { metrics: {}, comparison: null, summary: {} };
  const analytics = (analyticsData as any) || { timeline: [] };
  const models = (availableModels as any) || { glm: [], openai: [] };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6">
      {/* Header Reformulado */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#E40064]">Centro de Controle IA</h1>
          <p className="text-muted-foreground">Controle inteligente de custos e performance</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Status Geral Compacto */}
          {status.systemHealth && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              status.systemHealth.overall === 'healthy' 
                ? 'bg-green-100 text-green-800' 
                : status.systemHealth.overall === 'degraded'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-red-100 text-red-800'
            }`}>
              {status.systemHealth.overall === 'healthy' ? (
                <CheckCircle className="h-3 w-3" />
              ) : status.systemHealth.overall === 'degraded' ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              {status.systemHealth.overall === 'healthy' ? 'Sistema OK' : 
               status.systemHealth.overall === 'degraded' ? 'Atenção' : 'Problema'}
            </div>
          )}
          
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            data-testid="button-auto-refresh"
          >
            <Activity className="h-4 w-4 mr-2" />
            {autoRefresh ? 'Ao Vivo' : 'Manual'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="controls" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="controls" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuração
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Status Atual
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        {/* ABA CONFIGURAÇÃO - Reformulada */}
        <TabsContent value="controls" className="space-y-6">
          {/* Quick Actions Bar */}
          <div className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <div className="flex-1">
              <h3 className="font-semibold mb-2">Ações Rápidas</h3>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => swapPrioritiesMutation.mutate()}
                  disabled={swapPrioritiesMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Trocar Prioridades
                </Button>
                {status.systemHealth?.overall !== 'healthy' && (
                  <Button variant="outline" size="sm" className="text-yellow-600">
                    <Zap className="h-4 w-4 mr-1" />
                    Modo Emergência
                  </Button>
                )}
              </div>
            </div>
            
            {/* Custo do Mês */}
            {performance.summary && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Custo do Mês</p>
                <p className="text-2xl font-bold text-[#E40064]">
                  ${(performance.summary.totalCost || 0).toFixed(3)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {performance.summary.totalRequests || 0} documentos processados
                </p>
              </div>
            )}
          </div>

          {/* Configuração de Modelos IA */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Configuração de Modelos IA</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {providers.map((provider: any) => (
                <Card key={provider.name} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${getStatusColor(provider.status)}`} />
                        <div>
                          <CardTitle className="text-base">{provider.name.toUpperCase()}</CardTitle>
                          <CardDescription className="text-xs">
                            Prioridade {provider.priority} • {provider.status === 'online' ? 'Operacional' : 'Indisponível'}
                          </CardDescription>
                        </div>
                      </div>
                      <Switch
                        checked={provider.enabled}
                        onCheckedChange={() => toggleProviderMutation.mutate({ name: provider.name })}
                        disabled={toggleProviderMutation.isPending}
                      />
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Model Selection Melhorado */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Modelo Ativo:</label>
                      <Select 
                        value={provider.model} 
                        onValueChange={(modelId) => updateModelMutation.mutate({ 
                          providerName: provider.name, 
                          modelId 
                        })}
                        disabled={updateModelMutation.isPending || !provider.enabled}
                      >
                        <SelectTrigger data-testid={`select-model-${provider.name}`}>
                          <SelectValue placeholder="Selecionar modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          {models[provider.name]?.map((model: any) => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex justify-between items-center w-full">
                                <span className="font-medium">{model.name}</span>
                                <span className="text-xs text-[#E40064] font-semibold">
                                  ${model.avgCost.toFixed(3)}/1k
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Status e Informações */}
                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Custo:</span>
                        <span className="font-semibold">${(provider.costPer1000 || 0).toFixed(3)}/1k tokens</span>
                      </div>
                      
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Status:</span>
                        <div className="flex items-center gap-2">
                          <Badge variant={provider.status === 'online' ? 'default' : provider.status === 'error' ? 'destructive' : 'secondary'}>
                            {provider.status === 'online' ? '🟢 Online' : 
                             provider.status === 'error' ? '🔴 Erro' : 
                             '⚪ Indisponível'}
                          </Badge>
                          {provider.status === 'error' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => resetProviderMutation.mutate({ name: provider.name })}
                              disabled={resetProviderMutation.isPending}
                              className="h-6 px-2 text-xs"
                            >
                              Reset
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                </CardContent>
              </Card>
            ))}
          </div>
          </div>
        </TabsContent>

        {/* MONITORAMENTO TAB */}
        <TabsContent value="monitoring" className="space-y-6">
          {/* Recent Activity Alert */}
          {status.recentActivity && (
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-green-800">
                  <Activity className="h-4 w-4" />
                  Atividade Recente Detectada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-green-900">
                      {status.recentActivity.provider.toUpperCase()} processou documento
                    </div>
                    <div className="text-sm text-green-700">
                      {new Date(status.recentActivity.timestamp).toLocaleString('pt-BR')} • 
                      {status.recentActivity.success ? '✅ Sucesso' : '❌ Falha'} • 
                      {status.recentActivity.confidence}% confiança
                    </div>
                  </div>
                  <Badge variant={status.recentActivity.success ? 'default' : 'destructive'}>
                    {status.recentActivity.success ? 'Processado' : 'Erro'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* System Health */}
          {status.systemHealth && (
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
                        <div className={`text-sm font-medium ${getHealthScore(provider.healthScore || 0).color}`}>
                          {getHealthScore(provider.healthScore || 0).label}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(provider.healthScore || 0).toFixed(1)}% • {provider.totalRequests || 0} docs
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Performance Metrics */}
          {performance.summary && (
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
                    {status?.systemHealth?.primaryProvider?.toUpperCase() || 'GLM'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Processamento ativo
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Provider Comparison */}
          {performance.comparison && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    <Progress value={performance.comparison.glm.successRate} className="h-2" />
                  </CardContent>
                </Card>
              )}

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
                    <Progress value={performance.comparison.openai.successRate} className="h-2" />
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Timeline */}
          {analytics.timeline && analytics.timeline.length > 0 && (
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
                          height: `${Math.max((day.requests / Math.max(...analytics.timeline.map((d: any) => d.requests || 0))) * 100 || 4, 4)}px`
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

          {/* Recommendations */}
          {performance.comparison && performance.comparison.recommendations && performance.comparison.recommendations.length > 0 && (
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
        </TabsContent>
      </Tabs>
    </div>
  );
}