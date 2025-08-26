import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Filter, RefreshCw, FileText, Eye, Edit, AlertTriangle, Calendar, CheckCircle2, CreditCard, Receipt, Download } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdvancedSearch } from "@/components/advanced-search";

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
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "schedule" | "revise" | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isShowingSearchResults, setIsShowingSearchResults] = useState(false);
  const { toast } = useToast();

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ["/api/documents"],
  });

  const displayDocuments = isShowingSearchResults ? searchResults : documents || [];

  const handleRefresh = () => {
    refetch();
    setIsShowingSearchResults(false);
    setSearchResults([]);
  };

  const handleSearchResults = (results: any[]) => {
    setSearchResults(results);
    setIsShowingSearchResults(true);
  };

  const handleClearSearch = () => {
    setIsShowingSearchResults(false);
    setSearchResults([]);
  };

  // Mutation para ações operacionais
  const actionMutation = useMutation({
    mutationFn: async ({ documentId, action, data }: { documentId: string, action: string, data?: any }) => {
      const response = await apiRequest("PATCH", `/api/documents/${documentId}/action`, { action, ...data });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Ação realizada com sucesso",
        description: "O documento foi processado.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setShowActionDialog(false);
      setSelectedDoc(null);
      setActionType(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao processar",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
      });
    },
  });

  const handleDocumentAction = (doc: any, action: "approve" | "schedule" | "revise") => {
    setSelectedDoc(doc);
    setActionType(action);
    setShowActionDialog(true);
  };

  const handleSubmitAction = () => {
    if (!selectedDoc || !actionType) return;

    let actionData: any = {};
    
    if (actionType === "approve") {
      actionData = { action: "approve" };
    } else if (actionType === "schedule") {
      const dueDate = (document.getElementById("schedule-date") as HTMLInputElement)?.value;
      actionData = { action: "schedule", dueDate };
    } else if (actionType === "revise") {
      const notes = (document.getElementById("revision-notes") as HTMLTextAreaElement)?.value;
      actionData = { action: "revise", notes };
    }

    actionMutation.mutate({
      documentId: selectedDoc.id,
      ...actionData
    });
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
                        
                        {/* Ações operacionais baseadas no status e tipo do documento */}
                        {doc.status === "PENDENTE_REVISAO" && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDocumentAction(doc, "approve")}
                              className="text-green-600 border-green-600 hover:bg-green-600 hover:text-white"
                              data-testid={`button-approve-${doc.id}`}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleDocumentAction(doc, "revise")}
                              className="text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white"
                              data-testid={`button-revise-${doc.id}`}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Revisar
                            </Button>
                          </>
                        )}
                        
                        {(doc.status === "RECEBIDO" || doc.status === "CLASSIFICADO") && doc.documentType === "AGENDADO" && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDocumentAction(doc, "schedule")}
                            className="text-purple-600 border-purple-600 hover:bg-purple-600 hover:text-white"
                            data-testid={`button-schedule-${doc.id}`}
                          >
                            <Calendar className="w-4 h-4 mr-1" />
                            Agendar
                          </Button>
                        )}

                        {(doc.status === "RECEBIDO" || doc.status === "CLASSIFICADO") && doc.documentType === "PAGO" && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDocumentAction(doc, "approve")}
                            className="text-cyan-600 border-cyan-600 hover:bg-cyan-600 hover:text-white"
                            data-testid={`button-conciliate-${doc.id}`}
                          >
                            <CreditCard className="w-4 h-4 mr-1" />
                            Conciliar
                          </Button>
                        )}

                        {(doc.status === "RECEBIDO" || doc.status === "CLASSIFICADO") && 
                         (doc.documentType === "EMITIR_BOLETO" || doc.documentType === "EMITIR_NF") && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDocumentAction(doc, "approve")}
                            className="text-indigo-600 border-indigo-600 hover:bg-indigo-600 hover:text-white"
                            data-testid={`button-emit-${doc.id}`}
                          >
                            <Receipt className="w-4 h-4 mr-1" />
                            Emitir
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )) || []
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" && "Aprovar Documento"}
              {actionType === "schedule" && "Agendar Documento"}
              {actionType === "revise" && "Solicitar Revisão"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {actionType === "schedule" && (
              <div className="grid gap-2">
                <Label htmlFor="schedule-date">Data de Vencimento</Label>
                <Input
                  id="schedule-date"
                  type="date"
                  required
                />
              </div>
            )}
            
            {actionType === "revise" && (
              <div className="grid gap-2">
                <Label htmlFor="revision-notes">Motivo da Revisão</Label>
                <Textarea
                  id="revision-notes"
                  placeholder="Descreva o que precisa ser revisado..."
                  rows={3}
                  required
                />
              </div>
            )}

            {actionType === "approve" && selectedDoc && (
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">
                  Confirma a aprovação do documento <strong>{selectedDoc.originalName}</strong>?
                </p>
                <p className="text-sm">
                  Tipo: <strong>{selectedDoc.documentType}</strong>
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowActionDialog(false)}
                disabled={actionMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                className="bg-gquicks-primary hover:bg-gquicks-primary/90"
                onClick={handleSubmitAction}
                disabled={actionMutation.isPending}
              >
                {actionMutation.isPending ? "Processando..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
