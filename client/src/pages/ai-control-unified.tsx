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
import { Loader2, Cpu, DollarSign, Clock, TrendingUp, Activity, AlertTriangle } from "lucide-react";
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
      return apiRequest(`/api/ai-control/provider/${name}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-control"] });
    },
  });

  const providers = (providersData as any)?.providers || [];
  const summary = (providersData as any)?.summary || {};
  const analytics = (analyticsData as any) || { timeline: [], providerStats: [], summary: {} };

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
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Requests</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalRequests || 0}</div>
                <p className="text-xs text-muted-foreground">
                  ~{summary.avgDailyRequests || 0} por dia
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${summary.totalCost || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Últimos 30 dias
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Provider Mais Usado</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Object.keys(summary.mostUsedProvider || {})[0] || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(Object.values(summary.mostUsedProvider || {})[0] as number) || 0} requests
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Providers Ativos</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {providers.filter((p: Provider) => p.status === 'online').length}
                </div>
                <p className="text-xs text-muted-foreground">
                  de {providers.length} total
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Providers List */}
          <Card>
            <CardHeader>
              <CardTitle>Provedores de IA</CardTitle>
              <CardDescription>
                Configure e monitore status dos provedores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {providers.map((provider: Provider) => (
                  <div key={provider.name} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-lg">{provider.name}</h3>
                          <Badge variant={provider.status === 'online' ? 'default' : 'destructive'}>
                            {provider.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Prioridade: {provider.priority} | ${(provider.costPer1000 || 0).toFixed(4)}/1k tokens
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">{provider.totalRequests} requests</p>
                        <p className="text-sm text-muted-foreground">${(provider.totalCost || 0).toFixed(4)} gasto</p>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-sm font-medium">{provider.successRate}% sucesso</p>
                        <p className="text-sm text-muted-foreground">{provider.avgResponseTime}ms avg</p>
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
                  </div>
                ))}
              </div>
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