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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Controle de IA</h1>
          <p className="text-muted-foreground">
            Configure provedores de IA e monitore performance
          </p>
        </div>
      </div>

      <Tabs defaultValue="control" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="control">Controle</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="control" className="space-y-6">
          {/* Status em Tempo Real */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Status Atual</CardTitle>
            </CardHeader>
            <CardContent>
              <AIRealtimeStatus />
            </CardContent>
          </Card>

          {/* Controles de Configuração */}
          <Card>
            <CardHeader>
              <CardTitle>Controles de IA</CardTitle>
              <CardDescription>
                Configure modelos, prioridades e modo de operação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIControlsInterface providers={providers} />
            </CardContent>
          </Card>

          {/* Histórico de Documentos */}
          <Card>
            <CardHeader>
              <CardTitle>Últimos Documentos Processados</CardTitle>
              <CardDescription>
                Histórico dos 10 documentos mais recentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AIDocumentHistory />
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

// Componente para Status em Tempo Real
function AIRealtimeStatus() {
  const { data: recentDocsData } = useQuery({
    queryKey: ["/api/ai-control/recent-documents"],
    refetchInterval: 30000
  });

  const { data: providersData } = useQuery({
    queryKey: ["/api/ai-control"]
  });

  const lastActivity = (recentDocsData as any)?.lastActivity || null;
  const providers = (providersData as any)?.providers || [];
  const glm = providers.find((p: any) => p.name === 'glm');
  const openai = providers.find((p: any) => p.name === 'openai');

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "Nunca";
    return new Date(timestamp).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className="space-y-4">
      {/* Status das IAs */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center space-x-3">
            <div className={`h-3 w-3 rounded-full ${glm?.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
            <div>
              <p className="font-semibold">GLM-4.5</p>
              <p className="text-sm text-muted-foreground">Prioridade {glm?.priority || 1}</p>
            </div>
          </div>
          <Badge variant={glm?.status === 'online' ? 'default' : 'destructive'}>
            {glm?.status || 'offline'}
          </Badge>
        </div>

        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center space-x-3">
            <div className={`h-3 w-3 rounded-full ${openai?.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`} />
            <div>
              <p className="font-semibold">OpenAI</p>
              <p className="text-sm text-muted-foreground">Prioridade {openai?.priority || 2}</p>
            </div>
          </div>
          <Badge variant={openai?.status === 'online' ? 'default' : 'destructive'}>
            {openai?.status || 'offline'}
          </Badge>
        </div>
      </div>

      {/* Última Atividade */}
      {lastActivity && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Último documento: {lastActivity.documentName}</p>
              <p className="text-sm text-muted-foreground">IA: {lastActivity.provider} | {formatTime(lastActivity.timestamp)}</p>
            </div>
            <div className="flex items-center space-x-2">
              {lastActivity.success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">{lastActivity.confidence}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente para Controles de Interface
function AIControlsInterface({ providers }: { providers: any[] }) {
  const [selectedPriority, setSelectedPriority] = useState("glm_first");
  
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
      setSelectedPriority(prev => prev === "glm_first" ? "openai_first" : "glm_first");
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

  const toggleProviderMutation = useMutation({
    mutationFn: async ({ name, enabled }: { name: string; enabled: boolean }) => {
      return apiRequest("/api/ai-control/toggle-provider", "POST", { providerName: name, enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-control"] });
    }
  });

  const glm = providers.find(p => p.name === 'glm');
  const openai = providers.find(p => p.name === 'openai');

  const handlePriorityChange = (value: string) => {
    setSelectedPriority(value);
    if (value === "openai_first" && glm?.priority === 1) {
      swapPrioritiesMutation.mutate();
    } else if (value === "glm_first" && openai?.priority === 1) {
      swapPrioritiesMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      {/* Controle de Prioridade */}
      <div>
        <Label className="text-base font-semibold">Prioridade de Processamento</Label>
        <RadioGroup value={selectedPriority} onValueChange={handlePriorityChange} className="mt-2">
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

      {/* Configuração de Providers */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-semibold">GLM-4.5</Label>
            <Switch
              checked={glm?.status === 'online'}
              onCheckedChange={(checked) => {
                toggleProviderMutation.mutate({ name: 'glm', enabled: checked });
              }}
              disabled={toggleProviderMutation.isPending}
            />
          </div>
          <Select
            value={glm?.model || 'glm-4-0520'}
            onValueChange={(value) => {
              updateConfigMutation.mutate({ providerName: 'glm', config: { model: value } });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="glm-4-0520">glm-4-0520</SelectItem>
              <SelectItem value="glm-4-plus">glm-4-plus</SelectItem>
              <SelectItem value="glm-3.5-turbo">glm-3.5-turbo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="font-semibold">OpenAI</Label>
            <Switch
              checked={openai?.status === 'online'}
              onCheckedChange={(checked) => {
                toggleProviderMutation.mutate({ name: 'openai', enabled: checked });
              }}
              disabled={toggleProviderMutation.isPending}
            />
          </div>
          <Select
            value={openai?.model || 'gpt-4o-mini'}
            onValueChange={(value) => {
              updateConfigMutation.mutate({ providerName: 'openai', config: { model: value } });
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecionar modelo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gpt-4o">gpt-4o</SelectItem>
              <SelectItem value="gpt-4o-mini">gpt-4o-mini</SelectItem>
              <SelectItem value="gpt-3.5-turbo">gpt-3.5-turbo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Botão de Emergência */}
      <div className="pt-4 border-t">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => emergencyModeMutation.mutate({ enabled: true })}
          disabled={emergencyModeMutation.isPending}
          className="w-full"
        >
          <AlertTriangle className="h-4 w-4 mr-2" />
          🚨 Emergência: Forçar Apenas OpenAI
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Desativa GLM temporariamente para usar apenas OpenAI
        </p>
      </div>
    </div>
  );
}

// Componente para Histórico de Documentos
function AIDocumentHistory() {
  const { data: recentDocsData, isLoading } = useQuery({
    queryKey: ["/api/ai-control/recent-documents"],
    refetchInterval: 30000
  });

  const recentDocs = (recentDocsData as any)?.recentDocuments || [];

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (recentDocs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum documento processado recentemente
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recentDocs.slice(0, 10).map((doc: any) => (
        <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{doc.documentName}</p>
            <p className="text-sm text-muted-foreground">{formatTime(doc.timestamp)}</p>
          </div>
          
          <div className="flex items-center space-x-3 text-sm">
            <span className="px-2 py-1 bg-muted rounded text-xs">
              {doc.provider}
            </span>
            
            <div className="flex items-center space-x-1">
              {doc.success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span>{doc.confidence}%</span>
            </div>

            <span className="text-muted-foreground">
              {doc.processingTime}ms
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}