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
import { Filter, RefreshCw, FileText, Eye, Edit, AlertTriangle, Calendar, CheckCircle2, CreditCard, Receipt, Download, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "schedule" | "revise" | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isShowingSearchResults, setIsShowingSearchResults] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  
  // Estados para seleção múltipla
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  
  const { toast } = useToast();

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ["/api/documents"],
  });

  const filteredDocuments = (isShowingSearchResults ? searchResults : documents || []).filter((doc: any) => {
    if (statusFilter !== "all" && doc.status !== statusFilter) return false;
    if (typeFilter !== "all" && doc.documentType !== typeFilter) return false;
    return true;
  });

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
      const response = await apiRequest(`/api/documents/${documentId}/action`, {
        method: "PATCH",
        body: { action, ...data }
      });
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

  // Mutation para aprovar documento com dados da IA
  const approveAIMutation = useMutation({
    mutationFn: async (document: any) => {
      const aiData = document.extractedData;
      const updates = {
        status: 'CLASSIFICADO',
        amount: aiData?.valor?.replace(/[^\d,]/g, '').replace(',', '.'),
        supplier: aiData?.fornecedor,
        dueDate: aiData?.data_vencimento,
        paidDate: aiData?.data_pagamento,
        description: aiData?.descricao,
        category: aiData?.categoria,
        costCenter: aiData?.centro_custo,
        isValidated: true
      };
      
      return apiRequest(`/api/documents/${document.id}`, {
        method: 'PATCH',
        body: updates
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      setShowDetailsDialog(false);
      setSelectedDoc(null);
      toast({
        title: "Documento aprovado",
        description: "Os dados da IA foram aplicados com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao aprovar",
        description: error.message || "Erro ao aprovar documento com dados da IA",
        variant: "destructive",
      });
    }
  });

  const handleApproveAI = (document: any) => {
    approveAIMutation.mutate(document);
  };

  const handleManualReview = (document: any) => {
    // Redirecionar para página de edição/upload com o documento pré-carregado
    setSelectedDoc(document);
    setActionType("revise");
    setShowActionDialog(true);
    setShowDetailsDialog(false);
  };

  // Funções para seleção múltipla
  const handleSelectDocument = (documentId: string, checked: boolean) => {
    const newSelected = new Set(selectedDocuments);
    if (checked) {
      newSelected.add(documentId);
    } else {
      newSelected.delete(documentId);
    }
    setSelectedDocuments(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredDocuments.map((doc: any) => doc.id));
      setSelectedDocuments(allIds);
    } else {
      setSelectedDocuments(new Set());
    }
  };

  const isAllSelected = filteredDocuments.length > 0 && selectedDocuments.size === filteredDocuments.length;
  const isSomeSelected = selectedDocuments.size > 0 && selectedDocuments.size < filteredDocuments.length;

  // Mutation para exclusão em lote
  const bulkDeleteMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      return apiRequest(`/api/documents/bulk-delete`, {
        method: 'DELETE',
        body: { documentIds }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      setSelectedDocuments(new Set());
      setShowBulkDeleteDialog(false);
      toast({
        title: "Documentos excluídos",
        description: `${selectedDocuments.size} documento(s) foram excluídos com sucesso.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir",
        description: error.message || "Erro ao excluir documentos",
        variant: "destructive",
      });
    }
  });

  const handleBulkDelete = () => {
    const documentIds = Array.from(selectedDocuments);
    bulkDeleteMutation.mutate(documentIds);
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

  const formatCurrency = (value: string | number | null) => {
    if (!value) return "-";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
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
          <div className="flex items-center space-x-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-input rounded-md text-sm"
              data-testid="select-status-filter"
            >
              <option value="all">Todos os Status</option>
              <option value="RECEBIDO">Recebido</option>
              <option value="VALIDANDO">Validando</option>
              <option value="PENDENTE_REVISAO">Pendente Revisão</option>
              <option value="PAGO_A_CONCILIAR">A Conciliar</option>
              <option value="AGENDADO">Agendado</option>
            </select>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-input rounded-md text-sm"
              data-testid="select-type-filter"
            >
              <option value="all">Todos os Tipos</option>
              <option value="PAGO">Pago</option>
              <option value="AGENDADO">Agendado</option>
              <option value="EMITIR_BOLETO">Emitir Boleto</option>
              <option value="EMITIR_NF">Emitir NF</option>
            </select>
          </div>
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

      {/* Botão de exclusão em lote */}
      {selectedDocuments.size > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <span className="text-sm text-blue-800">
            {selectedDocuments.size} documento(s) selecionado(s)
          </span>
          <Button
            onClick={() => setShowBulkDeleteDialog(true)}
            variant="destructive"
            size="sm"
            data-testid="button-bulk-delete"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir Selecionados
          </Button>
        </div>
      )}

      {/* Document Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    {...(isSomeSelected ? { "data-indeterminate": true } : {})}
                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                    data-testid="checkbox-select-all"
                  />
                </TableHead>
                <TableHead className="font-medium text-foreground">Documento</TableHead>
                <TableHead className="font-medium text-foreground">Cliente</TableHead>
                <TableHead className="font-medium text-foreground">Status</TableHead>
                <TableHead className="font-medium text-foreground">Valor</TableHead>
                <TableHead className="font-medium text-foreground">Data/Hora</TableHead>
                <TableHead className="font-medium text-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!Array.isArray(filteredDocuments) || filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum documento encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments?.map((doc: any) => (
                  <TableRow 
                    key={doc.id} 
                    className="hover:bg-muted/30"
                    data-testid={`document-row-${doc.id}`}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedDocuments.has(doc.id)}
                        onCheckedChange={(checked) => handleSelectDocument(doc.id, !!checked)}
                        data-testid={`checkbox-select-${doc.id}`}
                      />
                    </TableCell>
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
                      {(() => {
                        try {
                          if (doc.extractedData) {
                            const data = typeof doc.extractedData === 'string' 
                              ? JSON.parse(doc.extractedData) 
                              : doc.extractedData;
                            return data.valor || formatCurrency(doc.amount) || "-";
                          }
                          return formatCurrency(doc.amount) || "-";
                        } catch (e) {
                          return formatCurrency(doc.amount) || "-";
                        }
                      })()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {(() => {
                        try {
                          if (doc.extractedData) {
                            const data = typeof doc.extractedData === 'string' 
                              ? JSON.parse(doc.extractedData) 
                              : doc.extractedData;
                            const date = data.data_vencimento || data.data_pagamento || doc.paymentDate || doc.dueDate;
                            if (date) {
                              // Convert DD/MM/YYYY to a readable format
                              const [day, month, year] = date.split('/');
                              if (day && month && year) {
                                return `${day}/${month}/${year}`;
                              }
                            }
                          }
                          return formatDate(doc.createdAt);
                        } catch (e) {
                          return formatDate(doc.createdAt);
                        }
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedDoc(doc);
                            setShowDetailsDialog(true);
                          }}
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

      {/* Document Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Detalhes do Documento</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedDoc && (
            <div className="grid gap-6 py-4">
              {/* Basic Info */}
              <div className="grid gap-3">
                <h3 className="font-semibold text-foreground">Informações Básicas</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">Nome do Arquivo</Label>
                    <p className="font-medium">{selectedDoc.originalName}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className={statusConfig[selectedDoc.status as keyof typeof statusConfig]?.className || "bg-gray-100 text-gray-800"}>
                      {statusConfig[selectedDoc.status as keyof typeof statusConfig]?.label || selectedDoc.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tamanho</Label>
                    <p>{(selectedDoc.fileSize / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Data de Upload</Label>
                    <p>{formatDate(selectedDoc.createdAt)}</p>
                  </div>
                </div>
              </div>

              {/* AI Analysis Results */}
              {selectedDoc.extractedData && (
                <div className="grid gap-3">
                  <h3 className="font-semibold text-foreground">Dados Extraídos pela IA</h3>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {selectedDoc.extractedData.valor && (
                        <div>
                          <Label className="text-green-700 font-medium">Valor</Label>
                          <p className="text-green-900">{selectedDoc.extractedData.valor}</p>
                        </div>
                      )}
                      {selectedDoc.extractedData.fornecedor && (
                        <div>
                          <Label className="text-green-700 font-medium">Fornecedor</Label>
                          <p className="text-green-900">{selectedDoc.extractedData.fornecedor}</p>
                        </div>
                      )}
                      {selectedDoc.extractedData.data_pagamento && (
                        <div>
                          <Label className="text-green-700 font-medium">Data de Pagamento</Label>
                          <p className="text-green-900">{selectedDoc.extractedData.data_pagamento}</p>
                        </div>
                      )}
                      {selectedDoc.extractedData.data_vencimento && (
                        <div>
                          <Label className="text-green-700 font-medium">Data de Vencimento</Label>
                          <p className="text-green-900">{selectedDoc.extractedData.data_vencimento}</p>
                        </div>
                      )}
                      {selectedDoc.extractedData.descricao && (
                        <div className="col-span-2">
                          <Label className="text-green-700 font-medium">Descrição</Label>
                          <p className="text-green-900">{selectedDoc.extractedData.descricao}</p>
                        </div>
                      )}
                      {selectedDoc.extractedData.categoria && (
                        <div>
                          <Label className="text-green-700 font-medium">Categoria</Label>
                          <p className="text-green-900">{selectedDoc.extractedData.categoria}</p>
                        </div>
                      )}
                      {selectedDoc.extractedData.centro_custo && (
                        <div>
                          <Label className="text-green-700 font-medium">Centro de Custo</Label>
                          <p className="text-green-900">{selectedDoc.extractedData.centro_custo}</p>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <div className="flex items-center justify-between text-xs text-green-600">
                        <span>Provider: {selectedDoc.aiProvider}</span>
                        <span>Confiança: {selectedDoc.extractedData.confidence || 'N/A'}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}



              {/* Inconsistencies/Tasks */}
              {selectedDoc.tasks && selectedDoc.tasks.length > 0 && (
                <div className="grid gap-3">
                  <h3 className="font-semibold text-foreground flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    <span>Inconsistências Detectadas</span>
                  </h3>
                  <div className="space-y-4">
                    {selectedDoc.tasks.map((task: any, index: number) => (
                      <div key={index} className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-3">
                          <AlertTriangle className="w-4 h-4 text-orange-600" />
                          <span className="font-medium text-orange-800">
                            {task.type === 'INCONSISTENCIA_AMOUNT' && 'Inconsistência no Valor'}
                            {task.type === 'INCONSISTENCIA_DATE' && 'Inconsistência na Data'}
                            {task.type === 'INCONSISTENCIA_SUPPLIER' && 'Inconsistência no Fornecedor'}
                            {task.type === 'MISSING_FIELD' && 'Campo Obrigatório Ausente'}
                          </span>
                        </div>
                        
                        {/* Comparison Table */}
                        <div className="bg-white rounded border border-orange-200 overflow-hidden mb-3">
                          <div className="grid grid-cols-3 divide-x divide-orange-200">
                            <div className="p-3 bg-red-50">
                              <div className="text-xs font-medium text-red-700 mb-1">OCR (Baixa Qualidade)</div>
                              <div className="text-sm text-red-900 break-words">
                                {task.message.includes('OCR=') ? 
                                  task.message.match(/OCR="([^"]*)"/) ?.[1] || 'N/A' : 'N/A'}
                              </div>
                            </div>
                            <div className="p-3 bg-green-50">
                              <div className="text-xs font-medium text-green-700 mb-1">IA (Confiável)</div>
                              <div className="text-sm text-green-900 font-medium break-words">
                                {task.message.includes('IA=') ? 
                                  task.message.match(/IA="([^"]*)"/) ?.[1] || 'N/A' : 'N/A'}
                              </div>
                            </div>
                            <div className="p-3 bg-blue-50">
                              <div className="text-xs font-medium text-blue-700 mb-1">Filename (Metadados)</div>
                              <div className="text-sm text-blue-900 break-words">
                                {task.field === 'amount' ? 
                                  selectedDoc.originalName.match(/R\$\s*([\d.,]+)/) ?.[0] || 'N/A' : 
                                  task.field === 'supplier' ? 'Detectado no nome' : 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-2 bg-green-100 rounded text-xs text-green-800">
                          <strong>Sistema Recomenda:</strong> Usar valor da IA (verde) pois passou na validação cruzada com metadados do filename.
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {selectedDoc?.status === 'PENDENTE_REVISAO' && (
                <div className="grid gap-3 pt-4 border-t">
                  <h3 className="font-semibold text-foreground">Ações do Operador</h3>
                  <div className="flex gap-3">
                    <Button 
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleApproveAI(selectedDoc)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Aprovar Dados da IA
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleManualReview(selectedDoc)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Revisar Manualmente
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão em lote */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Confirme a exclusão dos documentos selecionados
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir {selectedDocuments.size} documento(s) selecionado(s)?
            </p>
            <p className="text-sm text-red-600 mt-2">
              Esta ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setShowBulkDeleteDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
