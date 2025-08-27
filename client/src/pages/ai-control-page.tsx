import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Cpu, DollarSign, Activity } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface AIProvider {
  name: string;
  enabled: boolean;
  priority: number;
  costPer1000: number;
  status: 'online' | 'offline' | 'error';
}

export default function AIControlPage() {
  const { data: providersData, isLoading } = useQuery({
    queryKey: ["/api/ai-control"],
  });

  const toggleMutation = useMutation({
    mutationFn: (providerName: string) =>
      apiRequest("/api/ai-control/toggle-provider", {
        method: "POST",
        body: JSON.stringify({ providerName }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-control"] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const providers: AIProvider[] = providersData?.providers || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Controle de IA Multi-Provider</h1>
        <p className="text-muted-foreground">
          Configure e monitore os provedores de IA para análise de documentos
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {providers.map((provider) => (
          <Card key={provider.name} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Cpu className="h-5 w-5" />
                  <CardTitle className="capitalize">{provider.name}</CardTitle>
                </div>
                <Badge
                  variant={
                    provider.status === 'online' ? 'default' :
                    provider.status === 'error' ? 'destructive' : 'secondary'
                  }
                  data-testid={`badge-status-${provider.name}`}
                >
                  {provider.status}
                </Badge>
              </div>
              <CardDescription>
                Prioridade: {provider.priority} • 
                {provider.name === 'glm' ? ' Provider Principal' : ' Fallback'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="h-4 w-4" />
                  <span className="text-sm font-medium">Ativo</span>
                </div>
                <Switch
                  checked={provider.enabled}
                  onCheckedChange={() => toggleMutation.mutate(provider.name)}
                  disabled={toggleMutation.isPending}
                  data-testid={`switch-${provider.name}`}
                />
              </div>

              <div className="flex items-center space-x-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm">
                  <span className="font-medium">${provider.costPer1000}</span>
                  <span className="text-muted-foreground"> por 1000 tokens</span>
                </span>
              </div>

              {provider.name === 'glm' && (
                <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-lg">
                  <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                    💰 94% mais econômico que OpenAI
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-500">
                    Custo médio: $0.00234 por documento
                  </p>
                </div>
              )}

              {provider.name === 'openai' && (
                <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                    🔧 Fallback confiável
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-500">
                    Ativado quando GLM não está disponível
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estatísticas do Sistema</CardTitle>
          <CardDescription>
            Baseado na documentação do outro portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600">94%</div>
              <div className="text-sm text-green-700 dark:text-green-400">Economia vs Manual</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">$0.00234</div>
              <div className="text-sm text-blue-700 dark:text-blue-400">Custo por Documento</div>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">2</div>
              <div className="text-sm text-purple-700 dark:text-purple-400">Provedores Ativos</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}