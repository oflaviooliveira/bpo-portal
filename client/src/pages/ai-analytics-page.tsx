import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, 
  TrendingUp, 
  Loader2,
  DollarSign,
  Clock,
  Target,
  PieChart,
  LineChart,
  Zap
} from "lucide-react";

interface AnalyticsData {
  timeline: Array<{
    date: string;
    requests: number;
    cost: number;
    avgResponseTime: number;
    successCount: number;
    errorCount: number;
  }>;
  providerStats: Array<{
    provider: string;
    requests: number;
    cost: number;
    avgResponseTime: number;
    successRate: number;
  }>;
  summary: {
    totalRequests: number;
    totalCost: number;
    avgResponseTime: number;
    overallSuccessRate: number;
  };
}

export default function AIAnalyticsPage() {
  const [period, setPeriod] = useState("30");
  const [selectedProvider, setSelectedProvider] = useState<string>("all");

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["/api/ai-control/analytics", { period, provider: selectedProvider === "all" ? undefined : selectedProvider }],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const analytics: AnalyticsData = analyticsData || { timeline: [], providerStats: [], summary: { totalRequests: 0, totalCost: 0, avgResponseTime: 0, overallSuccessRate: 0 } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics de IA</h1>
          <p className="text-muted-foreground">
            Análise detalhada do uso e performance dos provedores de IA
          </p>
        </div>
        
        <div className="flex gap-4">
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
            <SelectTrigger className="w-32">
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

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Requisições</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-requests">
              {analytics.summary.totalRequests.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Últimos {period} dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-cost">
              ${analytics.summary.totalCost.toFixed(4)}
            </div>
            <p className="text-xs text-muted-foreground">
              Custo acumulado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-response-time">
              {analytics.summary.avgResponseTime}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Resposta média
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-success-rate">
              {analytics.summary.overallSuccessRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              Taxa geral
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="providers">Comparação</TabsTrigger>
          <TabsTrigger value="costs">Custos</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5" />
                Uso ao Longo do Tempo
              </CardTitle>
              <CardDescription>
                Requisições e performance diária dos últimos {period} dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.timeline.length > 0 ? (
                  analytics.timeline.map((day, index) => (
                    <div key={day.date} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium">
                          {new Date(day.date).toLocaleDateString('pt-BR')}
                        </div>
                        <Badge variant="outline">{day.requests} req</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>${day.cost.toFixed(4)}</span>
                        <span>{day.avgResponseTime}ms</span>
                        <Badge variant={day.errorCount > 0 ? "destructive" : "default"}>
                          {day.successCount}/{day.successCount + day.errorCount}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum dado disponível para o período selecionado
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {analytics.providerStats.map((provider) => (
              <Card key={provider.provider}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="capitalize flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      {provider.provider}
                    </CardTitle>
                    <Badge variant="outline">
                      {provider.requests} requisições
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Custo</p>
                      <p className="text-lg font-bold">${provider.cost.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tempo Médio</p>
                      <p className="text-lg font-bold">{provider.avgResponseTime}ms</p>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Taxa de Sucesso</span>
                      <span>{provider.successRate}%</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${provider.successRate}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Distribuição de Custos
              </CardTitle>
              <CardDescription>
                Análise de custos por provedor
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.providerStats.map((provider) => {
                  const percentage = analytics.summary.totalCost > 0 
                    ? (provider.cost / analytics.summary.totalCost) * 100 
                    : 0;
                  
                  return (
                    <div key={provider.provider} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="capitalize font-medium">{provider.provider}</span>
                        <span className="text-sm text-muted-foreground">
                          ${provider.cost.toFixed(4)} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}