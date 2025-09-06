import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ClientDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['/api/client/dashboard/stats'],
  });

  const { data: documents } = useQuery({
    queryKey: ['/api/documents'],
  });

  const recentDocuments = (documents as any[])?.slice(0, 5) || [];

  const cards = [
    {
      title: "Total de Documentos",
      value: (stats as any)?.totalDocuments || 0,
      description: "Documentos enviados",
      icon: FileText,
      color: "bg-blue-500",
    },
    {
      title: "Em Processamento",
      value: (stats as any)?.pendingReview || 0,
      description: "Aguardando análise",
      icon: Clock,
      color: "bg-yellow-500",
    },
    {
      title: "Processados",
      value: ((stats as any)?.totalDocuments || 0) - ((stats as any)?.pendingReview || 0),
      description: "Documentos finalizados",
      icon: CheckCircle,
      color: "bg-green-500",
    },
    {
      title: "Requer Atenção",
      value: (stats as any)?.inconsistentDocuments || 0,
      description: "Documentos com problemas",
      icon: AlertCircle,
      color: "bg-red-500",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-gilroy font-bold text-foreground">
          Meu Painel BPO
        </h1>
        <p className="text-muted-foreground mt-2">
          Acompanhe o status dos seus documentos enviados
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={cn("p-2 rounded-lg", card.color)}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Documents */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos Recentes</CardTitle>
          <CardDescription>
            Últimos documentos enviados para processamento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum documento enviado ainda</p>
              <p className="text-sm mt-2">
                Use a seção "Enviar Documentos" para começar
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentDocuments.map((doc: any) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{doc.originalName}</p>
                      <p className="text-sm text-muted-foreground">
                        {doc.bpoType} • {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        doc.status === 'VALID' && "bg-green-100 text-green-800",
                        doc.status === 'WARNING' && "bg-yellow-100 text-yellow-800",
                        doc.status === 'ERROR' && "bg-red-100 text-red-800",
                        doc.status === 'RECEBIDO' && "bg-blue-100 text-blue-800",
                        doc.status === 'VALIDANDO' && "bg-purple-100 text-purple-800"
                      )}
                    >
                      {doc.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}