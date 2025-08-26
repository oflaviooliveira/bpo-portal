import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Calendar, Clock, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";

const statusConfig = {
  AGENDADO: { label: "Agendado", className: "bg-indigo-100 text-indigo-800" },
  A_PAGAR_HOJE: { label: "A Pagar Hoje", className: "bg-red-100 text-red-800" },
  AGUARDANDO_RECEBIMENTO: { label: "Aguardando Recebimento", className: "bg-cyan-100 text-cyan-800" },
};

export function Scheduled() {
  const [activeTab, setActiveTab] = useState("hoje");

  // Queries para diferentes filtros de agendados
  const { data: todayDocs, isLoading: loadingToday, refetch: refetchToday } = useQuery({
    queryKey: ["/api/documents/scheduled/today"],
  });

  const { data: next7Days, isLoading: loading7Days, refetch: refetch7Days } = useQuery({
    queryKey: ["/api/documents/scheduled/next7days"],
  });

  const { data: overdue, isLoading: loadingOverdue, refetch: refetchOverdue } = useQuery({
    queryKey: ["/api/documents/scheduled/overdue"],
  });

  const handleRefreshAll = () => {
    refetchToday();
    refetch7Days();
    refetchOverdue();
  };

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

  const getDaysUntilDue = (dueDate: string | null) => {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const renderDocumentTable = (documents: any[], isLoading: boolean) => {
    if (isLoading) {
      return (
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>
      );
    }

    if (!documents || documents.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>Nenhum documento agendado neste período</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-medium text-foreground">Documento</TableHead>
            <TableHead className="font-medium text-foreground">Cliente</TableHead>
            <TableHead className="font-medium text-foreground">Status</TableHead>
            <TableHead className="font-medium text-foreground">Valor</TableHead>
            <TableHead className="font-medium text-foreground">Vencimento</TableHead>
            <TableHead className="font-medium text-foreground">Dias</TableHead>
            <TableHead className="font-medium text-foreground">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc: any) => {
            const daysUntilDue = getDaysUntilDue(doc.dueDate);
            return (
              <TableRow 
                key={doc.id} 
                className="hover:bg-muted/30"
                data-testid={`scheduled-row-${doc.id}`}
              >
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground truncate max-w-48">
                        {doc.originalName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {doc.documentType}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-foreground">
                  {doc.client?.name || "-"}
                </TableCell>
                <TableCell>
                  <Badge className={statusConfig[doc.status as keyof typeof statusConfig]?.className || "bg-gray-100 text-gray-800"}>
                    {statusConfig[doc.status as keyof typeof statusConfig]?.label || doc.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  {formatCurrency(doc.amount)}
                </TableCell>
                <TableCell className="text-foreground">
                  {formatDate(doc.dueDate)}
                </TableCell>
                <TableCell>
                  {daysUntilDue !== null && (
                    <div className="flex items-center space-x-1">
                      {daysUntilDue < 0 ? (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      ) : daysUntilDue === 0 ? (
                        <Clock className="w-4 h-4 text-orange-500" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                      <span className={`text-sm font-medium ${
                        daysUntilDue < 0 ? 'text-red-600' : 
                        daysUntilDue === 0 ? 'text-orange-600' : 
                        'text-green-600'
                      }`}>
                        {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} dias atrasado` :
                         daysUntilDue === 0 ? 'Hoje' :
                         `${daysUntilDue} dias`}
                      </span>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-gquicks-primary border-gquicks-primary hover:bg-gquicks-primary hover:text-white"
                      data-testid={`button-process-${doc.id}`}
                    >
                      Processar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-gilroy font-bold text-2xl text-foreground">Documentos Agendados</h2>
          <p className="text-muted-foreground">Gerencie documentos por vencimento e prioridade</p>
        </div>
        <Button 
          onClick={handleRefreshAll}
          className="bg-gquicks-primary hover:bg-gquicks-primary/90"
          data-testid="button-refresh-all"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar Tudo
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Pagar Hoje</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {todayDocs?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Vencimento hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Próximos 7 Dias</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {next7Days?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Agendados na semana
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasados</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {overdue?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Precisam atenção
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different time periods */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="border-b">
              <TabsList className="w-full justify-start h-12 bg-transparent">
                <TabsTrigger 
                  value="hoje" 
                  className="data-[state=active]:bg-gquicks-primary data-[state=active]:text-white"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  A Pagar Hoje ({todayDocs?.length || 0})
                </TabsTrigger>
                <TabsTrigger 
                  value="proximos7" 
                  className="data-[state=active]:bg-gquicks-primary data-[state=active]:text-white"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Próximos 7 Dias ({next7Days?.length || 0})
                </TabsTrigger>
                <TabsTrigger 
                  value="atrasados" 
                  className="data-[state=active]:bg-gquicks-primary data-[state=active]:text-white"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Atrasados ({overdue?.length || 0})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="hoje" className="p-6">
              {renderDocumentTable(todayDocs, loadingToday)}
            </TabsContent>

            <TabsContent value="proximos7" className="p-6">
              {renderDocumentTable(next7Days, loading7Days)}
            </TabsContent>

            <TabsContent value="atrasados" className="p-6">
              {renderDocumentTable(overdue, loadingOverdue)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}