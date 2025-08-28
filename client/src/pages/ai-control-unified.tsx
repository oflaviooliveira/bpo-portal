import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Cpu, DollarSign, Clock, TrendingUp, Activity, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

interface Provider {
  name: string;
  status: 'online' | 'offline' | 'error';
  priority: number;
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  avgResponseTime: number;
  successRate: number;
  costPer1000: number;
  failureReasons: Record<string, number>;
}

export default function AIControlUnified() {
  const [period, setPeriod] = useState("30");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");

  const { data: providersData, isLoading: providersLoading, error: providersError } = useQuery({
    queryKey: ["/api/ai-control"],
  });

  const { data: analyticsData, isLoading: analyticsLoading, error: analyticsError } = useQuery({
    queryKey: ["/api/ai-control/analytics", period, selectedProvider],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('period', period);
      if (selectedProvider !== "all") {
        params.append('provider', selectedProvider);
      }
      
      const response = await fetch(`/api/ai-control/analytics?${params.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
  });

  const toggleProviderMutation = useMutation({
    mutationFn: async ({ name, enabled }: { name: string; enabled: boolean }) => {
      return apiRequest("/api/ai-control/toggle-provider", "POST", { providerName: name, enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-control"] });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ providerName, config }: { providerName: string; config: any }) => {
      return apiRequest("/api/ai-control/update-config", "POST", { providerName, config });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-control"] });
    }
  });

  const swapPrioritiesMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/ai-control/swap-priorities", "POST", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-control"] });
    }
  });

  const emergencyModeMutation = useMutation({
    mutationFn: async ({ enabled }: { enabled: boolean }) => {
      return apiRequest("/api/ai-control/emergency-mode", "POST", { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-control"] });
    }
  });

  const { data: recentDocsData, isLoading: recentDocsLoading } = useQuery({
    queryKey: ["/api/ai-control/recent-documents"],
    refetchInterval: 30000
  });

  const providers = (providersData as any)?.providers || [];
  const summary = (providersData as any)?.summary || {};
  const analytics = (analyticsData as any) || { timeline: [], providerStats: [], summary: {} };
  const recentDocs = (recentDocsData as any)?.recentDocuments || [];
  const lastActivity = (recentDocsData as any)?.lastActivity || null;

  console.log("Unified - Providers:", providersData, "Analytics:", analyticsData, "Errors:", providersError, analyticsError);

  if (providersLoading || analyticsLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (providersError || analyticsError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Erro ao carregar dados de IA</h2>
          <p className="text-muted-foreground mb-4">
            {providersError?.message || analyticsError?.message || "Verifique se você tem permissão para acessar este recurso"}
          </p>
          <Button onClick={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/ai-control"] });
            queryClient.invalidateQueries({ queryKey: ["/api/ai-control/analytics"] });
          }}>
            Tentar Novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue="control" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="control">Controle</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="space-y-6">
          {/* Status Cards - Informação em Tempo Real */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Status GLM */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">GLM-4.5</CardTitle>
                <div className={`h-3 w-3 rounded-full ${providers.find((p: any) => p.name === 'glm')?.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {providers.find((p: any) => p.name === 'glm')?.model || 'glm-4-0520'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Prioridade {providers.find((p: any) => p.name === 'glm')?.priority || 1} | ${(providers.find((p: any) => p.name === 'glm')?.costPer1000 || 0.0002).toFixed(4)}/1k tokens
                </p>
              </CardContent>
            </Card>

            {/* Status OpenAI */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">OpenAI</CardTitle>
                <div className={`h-3 w-3 rounded-full ${providers.find((p: any) => p.name === 'openai')?.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {providers.find((p: any) => p.name === 'openai')?.model || 'gpt-4o-mini'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Prioridade {providers.find((p: any) => p.name === 'openai')?.priority || 2} | ${(providers.find((p: any) => p.name === 'openai')?.costPer1000 || 0.03).toFixed(4)}/1k tokens
                </p>
              </CardContent>
            </Card>

            {/* Última Atividade */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Última Atividade</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {lastActivity ? new Date(lastActivity.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {lastActivity ? `${lastActivity.provider} | ${lastActivity.documentName}` : 'Nenhum documento processado'}
                </p>
              </CardContent>
            </Card>

            {/* Status Geral */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Status Geral</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">
                  {providers.filter((p: any) => p.status === 'online').length}/{providers.length} Ativos
                </div>
                <p className="text-xs text-muted-foreground">
                  {lastActivity && lastActivity.success ? '✅ Último: Sucesso' : '⚠️ Último: Falha'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Controles Unificados */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Configuração de Providers */}
            <Card>
              <CardHeader>
                <CardTitle>Configuração de Providers</CardTitle>
                <CardDescription>
                  Ativar/desativar e configurar modelos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {providers.map((provider: any) => (
                  <div key={provider.name} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-semibold">
                          {provider.name === 'glm' ? 'GLM-4.5' : 'OpenAI'}
                        </h4>
                        <Badge variant={provider.status === 'online' ? 'default' : 'destructive'}>
                          {provider.status}
                        </Badge>
                      </div>
                      <Switch
                        checked={provider.status === 'online'}
                        onCheckedChange={(checked) => {
                          toggleProviderMutation.mutate({
                            name: provider.name,
                            enabled: checked
                          });
                        }}
                        disabled={toggleProviderMutation.isPending}
                      />
                    </div>
                    
                    <Select
                      value={provider.model}
                      onValueChange={(value) => {
                        updateConfigMutation.mutate({ 
                          providerName: provider.name, 
                          config: { model: value } 
                        });
                      }}
                      disabled={updateConfigMutation.isPending}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {provider.name === 'glm' ? (
                          <>
                            <SelectItem value="glm-4-0520">glm-4-0520</SelectItem>
                            <SelectItem value="glm-4-plus">glm-4-plus</SelectItem>
                            <SelectItem value="glm-3.5-turbo">glm-3.5-turbo</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="gpt-4o">gpt-4o</SelectItem>
                            <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
                            <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Controles de Prioridade e Emergência */}
            <Card>
              <CardHeader>
                <CardTitle>Prioridade e Controles</CardTitle>
                <CardDescription>
                  Alterar ordem de processamento e modo emergência
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Prioridade de Processamento</Label>
                  <RadioGroup 
                    value={providers.find((p: any) => p.name === 'glm')?.priority === 1 ? "glm_first" : "openai_first"}
                    onValueChange={(value) => {
                      if ((value === "openai_first" && providers.find((p: any) => p.name === 'glm')?.priority === 1) ||
                          (value === "glm_first" && providers.find((p: any) => p.name === 'openai')?.priority === 1)) {
                        swapPrioritiesMutation.mutate();
                      }
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="glm_first" id="glm_first" />
                      <Label htmlFor="glm_first">GLM Primeiro (Custo-Eficiente)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="openai_first" id="openai_first" />
                      <Label htmlFor="openai_first">OpenAI Primeiro (Máxima Precisão)</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => emergencyModeMutation.mutate({ enabled: true })}
                    disabled={emergencyModeMutation.isPending}
                    className="w-full"
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    🚨 Modo Emergência: Apenas OpenAI
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => emergencyModeMutation.mutate({ enabled: false })}
                    disabled={emergencyModeMutation.isPending}
                    className="w-full"
                  >
                    Restaurar Configuração Normal
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Histórico Compacto */}
          <Card>
            <CardHeader>
              <CardTitle>Histórico Recente</CardTitle>
              <CardDescription>
                Últimos {Math.min(recentDocs.length, 5)} documentos processados nas últimas 24h
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentDocsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : recentDocs.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  Nenhum documento processado nas últimas 24h
                </div>
              ) : (
                <div className="space-y-2">
                  {recentDocs.slice(0, 5).map((doc: any) => (
                    <div key={doc.id} className="flex items-center justify-between p-2 border rounded hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.documentName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(doc.timestamp).toLocaleString('pt-BR', { 
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                          })}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="px-1.5 py-0.5 bg-muted rounded">
                          {doc.provider}
                        </span>
                        <div className="flex items-center space-x-1">
                          {doc.success ? (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          ) : (
                            <XCircle className="h-3 w-3 text-red-500" />
                          )}
                          <span>{doc.confidence}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Analytics Controls */}
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="glm">GLM</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Timeline Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline de Uso</CardTitle>
              <CardDescription>Requests e custos por dia</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.timeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line yAxisId="left" type="monotone" dataKey="requests" stroke="#E40064" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#0B0E30" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Provider Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Comparação de Provedores</CardTitle>
              <CardDescription>Performance e custos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.providerStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="provider" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="requests" fill="#E40064" />
                    <Bar dataKey="cost" fill="#0B0E30" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Total de Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.summary.totalRequests || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Custo Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${analytics.summary.totalCost || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Taxa de Sucesso</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.summary.overallSuccessRate || 0}%</div>
                <Progress value={analytics.summary.overallSuccessRate || 0} className="mt-2" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

