import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { CheckCircle2, RefreshCw, Building2, TrendingUp, AlertCircle } from "lucide-react";

const statusConfig = {
  PAGO_A_CONCILIAR: { label: "A Conciliar", className: "bg-purple-100 text-purple-800" },
  EM_CONCILIACAO: { label: "Em Conciliação", className: "bg-amber-100 text-amber-800" },
};

export function Reconciliation() {
  const [selectedBank, setSelectedBank] = useState<string>("all");

  // Queries para conciliação - Wave 1 Enhanced
  const { data: reconciliationData, isLoading, refetch } = useQuery({
    queryKey: ["/api/documents/reconciliation", selectedBank],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedBank !== "all") {
        params.set("bankId", selectedBank);
      }
      return fetch(`/api/documents/reconciliation?${params}`).then(res => res.json());
    }
  });

  const { data: banks } = useQuery({
    queryKey: ["/api/banks"],
  });

  const reconciliationDocs = reconciliationData?.documents || [];
  const stats = reconciliationData?.stats || { total: 0, pagoConciliar: 0, emConciliacao: 0, totalAmount: 0 };

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
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const handleConciliate = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          newStatus: 'EM_CONCILIACAO',
          reason: 'Iniciada conciliação manual'
        })
      });
      
      if (response.ok) {
        refetch();
      } else {
        console.error("Erro ao conciliar documento");
      }
    } catch (error) {
      console.error("Erro na conciliação:", error);
    }
  };

  const totalToReconcile = stats.total;
  const totalValue = stats.totalAmount;

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-96 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-gilroy font-bold text-2xl text-foreground">Conciliação Bancária</h2>
          <p className="text-muted-foreground">Valide documentos pagos com extratos bancários</p>
        </div>
        <div className="flex space-x-3">
          <Select value={selectedBank} onValueChange={setSelectedBank}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por banco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os bancos</SelectItem>
              {(banks as any[])?.map((bank: any) => (
                <SelectItem key={bank.id} value={bank.id}>
                  {bank.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={() => refetch()}
            className="bg-gquicks-primary hover:bg-gquicks-primary/90"
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A Conciliar</CardTitle>
            <AlertCircle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {totalToReconcile}
            </div>
            <p className="text-xs text-muted-foreground">
              Documentos pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Para conciliação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bancos Ativos</CardTitle>
            <Building2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {(banks as any[])?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Bancos configurados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reconciliation Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-medium text-foreground">Documento</TableHead>
                <TableHead className="font-medium text-foreground">Cliente</TableHead>
                <TableHead className="font-medium text-foreground">Banco</TableHead>
                <TableHead className="font-medium text-foreground">Status</TableHead>
                <TableHead className="font-medium text-foreground">Valor</TableHead>
                <TableHead className="font-medium text-foreground">Data Pagamento</TableHead>
                <TableHead className="font-medium text-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reconciliationDocs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-300" />
                    <p>Nenhum documento pendente de conciliação</p>
                    {selectedBank !== "all" && (
                      <p className="text-sm mt-2">Tente selecionar "Todos os bancos"</p>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                reconciliationDocs.map((doc: any) => (
                  <TableRow 
                    key={doc.id} 
                    className="hover:bg-muted/30"
                    data-testid={`reconciliation-row-${doc.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4 text-purple-600" />
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
                    <TableCell className="text-foreground">
                      {doc.bank?.name || "-"}
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
                      {formatDate(doc.paidDate || doc.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleConciliate(doc.id)}
                          className="text-green-600 border-green-600 hover:bg-green-600 hover:text-white"
                          data-testid={`button-conciliate-${doc.id}`}
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Conciliar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}