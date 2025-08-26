import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, BarChart3, AlertTriangle } from "lucide-react";
import React from "react";

interface KpiCardsProps {
  stats?: {
    totalDocuments: number;
    pendingReview: number;
    processedToday: number;
    totalAmount: number;
    avgProcessingTime: number;
  };
}

export function KpiCards({ stats }: KpiCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const kpiCards = [
    {
      title: "Receita Processada",
      value: formatCurrency(stats?.totalAmount || 2309.68),
      change: "+12% em relação ao mês anterior",
      trend: "up",
      icon: TrendingUp,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      testId: "kpi-revenue",
    },
    {
      title: "Documentos Processados",
      value: (stats?.totalDocuments || 1247).toLocaleString('pt-BR'),
      change: `Taxa de automação: ${stats?.avgProcessingTime || 94}%`,
      trend: "up",
      icon: BarChart3,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      testId: "kpi-documents",
    },
    {
      title: "Processados Hoje",
      value: (stats?.processedToday || 156).toString(),
      change: "+8% em relação a ontem",
      trend: "up",
      icon: TrendingUp,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
      testId: "kpi-today",
    },
    {
      title: "Pendências Ativas",
      value: (stats?.pendingReview || 17).toString(),
      change: "Requer atenção",
      trend: "warning",
      icon: AlertTriangle,
      iconBg: "bg-red-100",
      iconColor: "text-gquicks-primary",
      testId: "kpi-pending",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {kpiCards.map((kpi) => {
        const Icon = kpi.icon;
        const trendIcon = kpi.trend === "up" ? TrendingUp : kpi.trend === "down" ? TrendingDown : AlertTriangle;
        const trendColor = kpi.trend === "up" ? "text-green-600" : kpi.trend === "down" ? "text-orange-600" : "text-gquicks-primary";

        return (
          <Card key={kpi.testId} className="card-hover" data-testid={kpi.testId}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-muted-foreground text-sm font-medium">
                    {kpi.title}
                  </p>
                  <p className="font-gilroy font-bold text-2xl text-foreground mt-1">
                    {kpi.value}
                  </p>
                  <p className={`text-sm mt-2 flex items-center ${trendColor}`}>
                    {React.createElement(trendIcon, { className: "w-4 h-4 mr-1" })}
                    <span>{kpi.change}</span>
                  </p>
                </div>
                <div className={`w-12 h-12 ${kpi.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`${kpi.iconColor} text-xl w-6 h-6`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
