import { KpiCards } from "./kpi-cards";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, Clock, AlertTriangle, Upload } from "lucide-react";

export function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: documents } = useQuery({
    queryKey: ["/api/documents"],
  });

  const recentDocuments = Array.isArray(documents) ? documents.slice(0, 5) : [];

  const recentActivities = [
    {
      id: "1",
      type: "success",
      title: "Documento conciliado com sucesso",
      description: "Banco Itaú • Cliente Eco Express • R$ 1.245,67",
      time: "há 5 min",
      icon: CheckCircle,
      iconColor: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      id: "2",
      type: "warning",
      title: "Agendamento próximo ao vencimento",
      description: "Banco Bradesco • Cliente Decargo • Vence amanhã",
      time: "há 12 min",
      icon: Clock,
      iconColor: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      id: "3",
      type: "info",
      title: "Novo documento recebido",
      description: "Cliente Eco Express • Aguardando processamento OCR",
      time: "há 18 min",
      icon: Upload,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-100",
    },
  ];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-80 bg-gray-200 rounded-lg" />
            <div className="h-80 bg-gray-200 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8">
      {/* KPI Cards */}
      <KpiCards stats={stats} />

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <Card className="card-hover">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-gilroy font-bold text-lg text-foreground">
                Receitas
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Button 
                  size="sm" 
                  className="bg-gquicks-secondary text-white"
                  data-testid="button-new-week"
                >
                  Nova semana
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  data-testid="button-last-week"
                >
                  Semana passada
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Simplified chart representation */}
            <div className="h-64 bg-gradient-to-r from-gquicks-primary/10 to-gquicks-primary/5 rounded-lg flex items-end justify-between p-4">
              {[20, 32, 24, 40, 28, 36, 44].map((height, index) => (
                <div
                  key={index}
                  className="w-8 bg-gquicks-primary rounded-t chart-gradient"
                  style={{ height: `${height * 4}px` }}
                />
              ))}
            </div>
            <div className="mt-4 flex justify-between text-sm text-muted-foreground">
              <span>Dom</span>
              <span>Seg</span>
              <span>Ter</span>
              <span>Qua</span>
              <span>Qui</span>
              <span>Sex</span>
              <span>Sab</span>
            </div>
          </CardContent>
        </Card>

        {/* Processing Status */}
        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="font-gilroy font-bold text-lg text-foreground">
              Status de Processamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-green-500 rounded-full" />
                  <span className="text-sm text-foreground">Processados Automaticamente</span>
                </div>
                <span className="font-medium text-foreground">
                  {stats?.totalDocuments ? Math.floor(stats.totalDocuments * 0.94) : 1170} (94%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-orange-500 rounded-full" />
                  <span className="text-sm text-foreground">Pendente de Revisão</span>
                </div>
                <span className="font-medium text-foreground">
                  {stats?.pendingReview || 60} (5%)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-4 h-4 bg-red-500 rounded-full" />
                  <span className="text-sm text-foreground">Com Erro</span>
                </div>
                <span className="font-medium text-foreground">17 (1%)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activities */}
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="font-gilroy font-bold text-lg text-foreground">
            Atividades Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivities.map((activity) => {
              const Icon = activity.icon;
              return (
                <div 
                  key={activity.id}
                  className="flex items-center space-x-4 p-4 bg-muted/50 rounded-lg"
                  data-testid={`activity-${activity.id}`}
                >
                  <div className={`w-10 h-10 ${activity.bgColor} rounded-full flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${activity.iconColor}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-foreground font-medium">{activity.title}</p>
                    <p className="text-muted-foreground text-sm">{activity.description}</p>
                  </div>
                  <span className="text-muted-foreground text-sm">{activity.time}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
