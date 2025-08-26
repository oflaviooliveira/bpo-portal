import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, AlertTriangle, CheckCircle, Clock } from "lucide-react";

type FilterType = "today" | "week" | "overdue" | "all";

const statusConfig = {
  today: { label: "Hoje", className: "bg-blue-100 text-blue-800" },
  overdue: { label: "Atrasado", className: "bg-red-100 text-red-800" },
  upcoming: { label: "Próximo", className: "bg-orange-100 text-orange-800" },
  processed: { label: "Processado", className: "bg-green-100 text-green-800" },
};

export function Scheduled() {
  const [activeFilter, setActiveFilter] = useState<FilterType>("today");

  const { data: scheduledDocs, isLoading, refetch } = useQuery({
    queryKey: ["/api/documents", { documentType: "AGENDADO" }],
  });

  const formatCurrency = (value: string | number | null) => {
    if (!value) return "-";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date));
  };

  const isOverdue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const isToday = (dueDate: string | null) => {
    if (!dueDate) return false;
    const today = new Date();
    const due = new Date(dueDate);
    return today.toDateString() === due.toDateString();
  };

  const getStatusInfo = (doc: any) => {
    if (isOverdue(doc.dueDate)) {
      return {
        status: "overdue",
        icon: AlertTriangle,
        iconColor: "text-red-600",
        bgColor: "bg-red-100",
        borderColor: "border-red-500",
        buttonColor: "bg-red-600 hover:bg-red-700",
        buttonText: "Urgente - Processar"
      };
    } else if (isToday(doc.dueDate)) {
      return {
        status: "today",
        icon: Calendar,
        iconColor: "text-blue-600", 
        bgColor: "bg-blue-100",
        borderColor: "border-blue-500",
        buttonColor: "bg-gquicks-primary hover:bg-gquicks-primary/90",
        buttonText: "Processar Hoje"
      };
    } else {
      return {
        status: "upcoming",
        icon: Clock,
        iconColor: "text-orange-600",
        bgColor: "bg-orange-100", 
        borderColor: "border-orange-500",
        buttonColor: "bg-gquicks-primary hover:bg-gquicks-primary/90",
        buttonText: "Processar Pagamento"
      };
    }
  };

  const filterDocuments = (docs: any[]) => {
    if (!docs) return [];
    
    switch (activeFilter) {
      case "today":
        return docs.filter(doc => isToday(doc.dueDate));
      case "week":
        const weekFromNow = new Date();
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        return docs.filter(doc => {
          if (!doc.dueDate) return false;
          const dueDate = new Date(doc.dueDate);
          return dueDate <= weekFromNow && dueDate >= new Date();
        });
      case "overdue":
        return docs.filter(doc => isOverdue(doc.dueDate));
      default:
        return docs;
    }
  };

  const filteredDocs = filterDocuments(scheduledDocs);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-gilroy font-bold text-2xl text-foreground">Documentos Agendados</h2>
          <p className="text-muted-foreground">Documentos aguardando data de vencimento</p>
        </div>
        <div className="flex space-x-3">
          <Button
            onClick={() => setActiveFilter("today")}
            variant={activeFilter === "today" ? "default" : "outline"}
            className={activeFilter === "today" ? "bg-gquicks-primary hover:bg-gquicks-primary/90" : ""}
            data-testid="filter-today"
          >
            Hoje
          </Button>
          <Button
            onClick={() => setActiveFilter("week")}
            variant={activeFilter === "week" ? "default" : "outline"}
            className={activeFilter === "week" ? "bg-gquicks-primary hover:bg-gquicks-primary/90" : ""}
            data-testid="filter-week"
          >
            Próximos 7 dias
          </Button>
          <Button
            onClick={() => setActiveFilter("overdue")}
            variant={activeFilter === "overdue" ? "default" : "outline"}
            className={activeFilter === "overdue" ? "bg-gquicks-primary hover:bg-gquicks-primary/90" : ""}
            data-testid="filter-overdue"
          >
            Atrasados
          </Button>
        </div>
      </div>

      {/* Scheduled Cards */}
      {filteredDocs?.length === 0 ? (
        <Card className="p-8 text-center">
          <CardContent>
            <Calendar className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-gilroy font-bold text-lg text-foreground mb-2">
              Nenhum documento encontrado
            </h3>
            <p className="text-muted-foreground">
              {activeFilter === "today" && "Não há documentos vencendo hoje."}
              {activeFilter === "week" && "Não há documentos vencendo nos próximos 7 dias."}
              {activeFilter === "overdue" && "Não há documentos atrasados."}
              {activeFilter === "all" && "Não há documentos agendados."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocs?.map((doc: any) => {
            const statusInfo = getStatusInfo(doc);
            const Icon = statusInfo.icon;

            return (
              <Card 
                key={doc.id} 
                className={`card-hover border-l-4 ${statusInfo.borderColor} transition-all duration-200 hover:shadow-lg`}
                data-testid={`scheduled-card-${doc.id}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 ${statusInfo.bgColor} rounded-lg flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${statusInfo.iconColor}`} />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">
                          {doc.category?.name || "Documento Financeiro"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {doc.client?.name || "Cliente não informado"}
                        </p>
                      </div>
                    </div>
                    <Badge className={statusConfig[statusInfo.status as keyof typeof statusConfig]?.className}>
                      {statusConfig[statusInfo.status as keyof typeof statusConfig]?.label}
                    </Badge>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Valor:</span>
                      <span className="text-sm font-medium text-foreground">
                        {formatCurrency(doc.amount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Banco:</span>
                      <span className="text-sm font-medium text-foreground">
                        {doc.bank?.name || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Vencimento:</span>
                      <span className="text-sm font-medium text-foreground">
                        {formatDate(doc.dueDate)}
                      </span>
                    </div>
                    {doc.notes && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Observações:</span>
                        <span className="text-sm font-medium text-foreground truncate max-w-32" title={doc.notes}>
                          {doc.notes}
                        </span>
                      </div>
                    )}
                  </div>

                  <Button
                    className={`w-full ${statusInfo.buttonColor} text-white`}
                    data-testid={`button-process-${doc.id}`}
                    onClick={() => {
                      // TODO: Implement payment processing
                      console.log(`Processing payment for document ${doc.id}`);
                    }}
                  >
                    {statusInfo.buttonText}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
