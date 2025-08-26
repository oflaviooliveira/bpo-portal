import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Filter, RefreshCw, FileText, Eye, Edit, AlertTriangle } from "lucide-react";

const statusConfig = {
  RECEBIDO: { label: "Recebido", className: "bg-blue-100 text-blue-800" },
  VALIDANDO: { label: "Validando", className: "bg-yellow-100 text-yellow-800" },
  PENDENTE_REVISAO: { label: "Pendente Revisão", className: "bg-orange-100 text-orange-800" },
  CLASSIFICADO: { label: "Classificado", className: "bg-green-100 text-green-800" },
  PAGO_A_CONCILIAR: { label: "Pago - A Conciliar", className: "bg-purple-100 text-purple-800" },
  AGENDADO: { label: "Agendado", className: "bg-indigo-100 text-indigo-800" },
  A_PAGAR_HOJE: { label: "A Pagar Hoje", className: "bg-red-100 text-red-800" },
  AGUARDANDO_RECEBIMENTO: { label: "Aguardando Recebimento", className: "bg-cyan-100 text-cyan-800" },
  EM_CONCILIACAO: { label: "Em Conciliação", className: "bg-amber-100 text-amber-800" },
  ARQUIVADO: { label: "Arquivado", className: "bg-gray-100 text-gray-800" },
};

export function Inbox() {
  const [filter, setFilter] = useState<string>("");

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ["/api/documents"],
  });

  const handleRefresh = () => {
    refetch();
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
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-600" />;
    }
    return <FileText className="w-5 h-5 text-blue-600" />;
  };

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
          <h2 className="font-gilroy font-bold text-2xl text-foreground">Inbox de Documentos</h2>
          <p className="text-muted-foreground">Documentos recebidos aguardando processamento</p>
        </div>
        <div className="flex space-x-3">
          <Button 
            variant="outline" 
            onClick={() => {/* TODO: Implement filters */}}
            data-testid="button-filters"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          <Button 
            onClick={handleRefresh}
            className="bg-gquicks-primary hover:bg-gquicks-primary/90"
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Document Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-medium text-foreground">Documento</TableHead>
                <TableHead className="font-medium text-foreground">Cliente</TableHead>
                <TableHead className="font-medium text-foreground">Status</TableHead>
                <TableHead className="font-medium text-foreground">Valor</TableHead>
                <TableHead className="font-medium text-foreground">Data/Hora</TableHead>
                <TableHead className="font-medium text-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!Array.isArray(documents) || documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum documento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                documents?.map((doc: any) => (
                  <TableRow 
                    key={doc.id} 
                    className="hover:bg-muted/30"
                    data-testid={`document-row-${doc.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                          {getFileIcon(doc.mimeType)}
                        </div>
                        <div>
                          <p className="font-medium text-foreground truncate max-w-48">
                            {doc.originalName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {(doc.fileSize / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {doc.client?.name || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        className={statusConfig[doc.status as keyof typeof statusConfig]?.className || "bg-gray-100 text-gray-800"}
                      >
                        {statusConfig[doc.status as keyof typeof statusConfig]?.label || doc.status}
                      </Badge>
                      {doc.status === "PENDENTE_REVISAO" && (
                        <AlertTriangle className="w-4 h-4 text-orange-500 ml-2 inline" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {formatCurrency(doc.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(doc.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          data-testid={`button-view-${doc.id}`}
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          data-testid={`button-edit-${doc.id}`}
                        >
                          <Edit className="w-4 h-4 text-gquicks-primary" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) || []
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
