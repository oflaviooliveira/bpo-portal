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
import { Filter, RefreshCw, FileText, Eye, Edit, AlertTriangle, Calendar, CheckCircle2, CreditCard, Receipt, Download, Trash2, RotateCcw, ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [contraparteFilter, setContraparteFilter] = useState<string>("all");
  const [valueFilter, setValueFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [showActionDialog, setShowActionDialog] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "schedule" | "revise" | "reprocess" | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isShowingSearchResults, setIsShowingSearchResults] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [showBpoFieldsDialog, setShowBpoFieldsDialog] = useState(false);
  
  // Estados para campos BPO editáveis
  const [bpoFormData, setBpoFormData] = useState({
    competenceDate: '',
    dueDate: '',
    paidDate: '',
    amount: '',
    description: '',
    categoryId: '',
    costCenterId: '',
    notes: ''
  });
  
  // Estados para seleção múltipla
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  
  const { toast } = useToast();

  const { data: documents, isLoading, refetch } = useQuery({
    queryKey: ["/api/documents"],
  });

  // Queries para dropdowns
  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: costCenters } = useQuery({
    queryKey: ["/api/cost-centers"],
  });

  // Ensure documents is always an array to prevent filter errors
  const documentsArray = Array.isArray(documents) ? documents : [];

  const filteredDocuments = (isShowingSearchResults ? searchResults : documentsArray).filter((doc: any) => {
    if (statusFilter !== "all" && doc.status !== statusFilter) return false;
    if (typeFilter !== "all" && doc.documentType !== typeFilter) return false;
    if (contraparteFilter !== "all") {
      const contraparteName = doc.supplier || doc.client?.name || "";
      if (!contraparteName.toLowerCase().includes(contraparteFilter.toLowerCase())) return false;
    }
    if (valueFilter !== "all") {
      const value = parseFloat(String(doc.amount || 0));
      if (valueFilter === "low" && value >= 1000) return false;
      if (valueFilter === "medium" && (value < 1000 || value >= 5000)) return false;
      if (valueFilter === "high" && value < 5000) return false;
    }
    if (dateFilter !== "all") {
      const today = new Date();
      const docDate = new Date(doc.createdAt);
      const diffDays = Math.floor((today.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (dateFilter === "today" && diffDays !== 0) return false;
      if (dateFilter === "week" && diffDays > 7) return false;
      if (dateFilter === "month" && diffDays > 30) return false;
    }
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

  const handleDocumentAction = (doc: any, action: "approve" | "schedule" | "revise" | "reprocess") => {
    setSelectedDoc(doc);
    setActionType(action);
    setShowActionDialog(true);
  };

  const handleSubmitAction = () => {
    if (!selectedDoc || !actionType) return;

    if (actionType === "reprocess") {
      reprocessMutation.mutate(selectedDoc.id);
      return;
    }

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

  // Mutation for document reprocessing
  const reprocessMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return apiRequest('POST', `/api/documents/${documentId}/reprocess`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      setShowActionDialog(false);
      setSelectedDoc(null);
      toast({
        title: "Reprocessamento iniciado",
        description: "O documento está sendo reprocessado com OCR e IA.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao reprocessar",
        description: error.message || "Erro ao reprocessar documento",
        variant: "destructive",
      });
    },
  });

  // Function to handle document download
  const handleDownloadDocument = async (doc: any) => {
    try {
      const response = await fetch(`/api/documents/${doc.id}/download`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Erro ao baixar documento');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = doc.originalName || 'documento';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Download iniciado",
        description: `Baixando ${doc.originalName}`,
      });
    } catch (error) {
      toast({
        title: "Erro no download",
        description: "Não foi possível baixar o documento",
        variant: "destructive",
      });
    }
  };

  // Mutation para salvar dados BPO
  const saveBpoDataMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('PATCH', `/api/documents/${selectedDoc.id}/bpo-data`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      setShowBpoFieldsDialog(false);
      setSelectedDoc(null);
      toast({
        title: "Dados BPO salvos",
        description: "Documento marcado como pronto para processamento BPO.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Erro ao salvar dados BPO",
        variant: "destructive",
      });
    }
  });

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
      
      return apiRequest('PATCH', `/api/documents/${document.id}`, updates);
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
    // Preencher formulário com dados atuais do documento e extraídos pela IA
    const aiData = document.extractedData || {};
    setBpoFormData({
      competenceDate: document.competenceDate ? new Date(document.competenceDate).toISOString().split('T')[0] : '',
      dueDate: document.dueDate ? new Date(document.dueDate).toISOString().split('T')[0] : 
               (aiData.data_vencimento ? aiData.data_vencimento : ''),
      paidDate: document.paidDate ? new Date(document.paidDate).toISOString().split('T')[0] : 
                (aiData.data_pagamento ? aiData.data_pagamento : ''),
      amount: document.amount ? document.amount.toString() : (aiData.valor || ''),
      description: document.description || aiData.descricao || '',
      categoryId: document.categoryId || '',
      costCenterId: document.costCenterId || '',
      notes: document.notes || ''
    });
    setSelectedDoc(document);
    setShowBpoFieldsDialog(true);
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
      const allIds = new Set<string>(filteredDocuments.map((doc: any) => doc.id));
      setSelectedDocuments(allIds);
    } else {
      setSelectedDocuments(new Set<string>());
    }
  };

  const isAllSelected = filteredDocuments.length > 0 && selectedDocuments.size === filteredDocuments.length;
  const isSomeSelected = selectedDocuments.size > 0 && selectedDocuments.size < filteredDocuments.length;

  // Mutation para exclusão em lote
  const bulkDeleteMutation = useMutation({
    mutationFn: async (documentIds: string[]) => {
      return apiRequest('DELETE', `/api/documents/bulk-delete`, { documentIds });
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

  const getClientFornecedorChip = (documentType: string) => {
    const isPago = documentType === "PAGO" || documentType === "AGENDADO";
    const isClient = documentType === "EMITIR_BOLETO" || documentType === "EMITIR_NF";
    
    if (isPago) {
      return <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">Fornecedor</Badge>;
    } else if (isClient) {
      return <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Cliente</Badge>;
    }
    return null;
  };

  const getOCRConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-600";
    if (confidence >= 70) return "text-yellow-600";
    return "text-red-600";
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
          <div className="flex items-center space-x-2 flex-wrap gap-2">
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

            <select
              value={valueFilter}
              onChange={(e) => setValueFilter(e.target.value)}
              className="px-3 py-2 border border-input rounded-md text-sm"
              data-testid="select-value-filter"
            >
              <option value="all">Todos os Valores</option>
              <option value="low">Até R$ 1.000</option>
              <option value="medium">R$ 1.000 - R$ 5.000</option>
              <option value="high">Acima R$ 5.000</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-input rounded-md text-sm"
              data-testid="select-date-filter"
            >
              <option value="all">Todas as Datas</option>
              <option value="today">Hoje</option>
              <option value="week">Última Semana</option>
              <option value="month">Último Mês</option>
            </select>

            <Input
              placeholder="Filtrar por contraparte..."
              value={contraparteFilter === "all" ? "" : contraparteFilter}
              onChange={(e) => setContraparteFilter(e.target.value || "all")}
              className="px-3 py-2 w-48 text-sm"
              data-testid="input-contraparte-filter"
            />
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
                <TableHead className="font-medium text-foreground">Contraparte</TableHead>
                <TableHead className="font-medium text-foreground">Status</TableHead>
                <TableHead className="font-medium text-foreground">Valor</TableHead>
                <TableHead className="font-medium text-foreground">Confiança OCR</TableHead>
                <TableHead className="font-medium text-foreground">Data/Hora</TableHead>
                <TableHead className="font-medium text-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!Array.isArray(filteredDocuments) || filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">{doc.supplier || doc.client?.name || "-"}</span>
                        {getClientFornecedorChip(doc.documentType)}
                      </div>
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
                    <TableCell className="text-center">
                      {(() => {
                        const confidence = typeof doc.ocrConfidence === 'number' 
                          ? doc.ocrConfidence 
                          : typeof doc.ocrConfidence === 'string' 
                            ? parseFloat(doc.ocrConfidence) || 0
                            : 0;
                        return (
                          <div className="flex flex-col items-center">
                            <span className={`font-medium ${getOCRConfidenceColor(confidence)}`}>
                              {confidence.toFixed(0)}%
                            </span>
                            <div className="w-12 bg-gray-200 rounded-full h-1.5 mt-1">
                              <div 
                                className={`h-1.5 rounded-full ${confidence >= 90 ? 'bg-green-500' : confidence >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${Math.min(confidence, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        );
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
                          data-testid={`button-details-${doc.id}`}
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
                              onClick={() => handleManualReview(doc)}
                              className="text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white"
                              data-testid={`button-bpo-data-${doc.id}`}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Dados BPO
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

                        {/* Ação de reprocessar para documentos com erro */}
                        {(doc.status === "ERRO" || doc.ocrConfidence < 50) && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDocumentAction(doc, "reprocess")}
                            className="text-yellow-600 border-yellow-600 hover:bg-yellow-600 hover:text-white"
                            data-testid={`button-reprocess-${doc.id}`}
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Reprocessar
                          </Button>
                        )}

                        {/* Ação de download sempre disponível */}
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDownloadDocument(doc)}
                          className="text-green-600 hover:text-green-700"
                          data-testid={`button-download-${doc.id}`}
                        >
                          <Download className="w-4 h-4" />
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

      {/* Action Dialog */}
      <Dialog open={showActionDialog} onOpenChange={setShowActionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" && "Aprovar Documento"}
              {actionType === "schedule" && "Agendar Documento"}
              {actionType === "revise" && "Solicitar Revisão"}
              {actionType === "reprocess" && "Reprocessar Documento"}
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

            {actionType === "reprocess" && selectedDoc && (
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">
                  Confirma o reprocessamento do documento <strong>{selectedDoc.originalName}</strong>?
                </p>
                <p className="text-sm text-yellow-600">
                  O OCR e análise de IA serão executados novamente.
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
                      Completar Dados BPO
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview Dialog/Drawer */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden p-0">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Preview: {selectedDoc?.originalName}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDoc && (
            <div className="flex h-[80vh]">
              {/* Preview Panel */}
              <div className="flex-1 bg-muted/30 p-4 overflow-auto">
                {selectedDoc.mimeType?.includes('pdf') ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <iframe 
                      src={`/api/documents/${selectedDoc.id}/preview#view=FitH`}
                      className="w-full h-full border rounded"
                      title="Document Preview"
                      style={{ minHeight: '600px' }}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <img 
                      src={`/api/documents/${selectedDoc.id}/preview`}
                      alt="Document Preview"
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Sidebar com dados extraídos */}
              <div className="w-96 border-l bg-background p-4 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Informações do Arquivo</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        <Badge 
                          className={statusConfig[selectedDoc.status as keyof typeof statusConfig]?.className || "bg-gray-100 text-gray-800"}
                        >
                          {statusConfig[selectedDoc.status as keyof typeof statusConfig]?.label || selectedDoc.status}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tipo:</span>
                        <span>{selectedDoc.documentType || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tamanho:</span>
                        <span>{(selectedDoc.fileSize / 1024 / 1024).toFixed(1)} MB</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">OCR:</span>
                        <span className={getOCRConfidenceColor(
                          typeof selectedDoc.ocrConfidence === 'number' 
                            ? selectedDoc.ocrConfidence 
                            : typeof selectedDoc.ocrConfidence === 'string' 
                              ? parseFloat(selectedDoc.ocrConfidence) || 0
                              : 0
                        )}>
                          {(typeof selectedDoc.ocrConfidence === 'number' 
                            ? selectedDoc.ocrConfidence 
                            : typeof selectedDoc.ocrConfidence === 'string' 
                              ? parseFloat(selectedDoc.ocrConfidence) || 0
                              : 0
                          ).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* OCR Text */}
                  {selectedDoc.ocrText && (
                    <div>
                      <h3 className="font-semibold mb-2">Texto OCR</h3>
                      <div className="bg-muted rounded p-3 text-xs max-h-32 overflow-y-auto">
                        <pre className="whitespace-pre-wrap">{selectedDoc.ocrText}</pre>
                      </div>
                    </div>
                  )}

                  {/* Dados extraídos */}
                  {selectedDoc.extractedData && (
                    <div>
                      <h3 className="font-semibold mb-2">Dados Extraídos por IA</h3>
                      <div className="bg-muted rounded p-3 text-xs max-h-48 overflow-y-auto">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(typeof selectedDoc.extractedData === 'string' 
                            ? JSON.parse(selectedDoc.extractedData) 
                            : selectedDoc.extractedData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="space-y-2 pt-4 border-t">
                    <Button 
                      onClick={() => handleDownloadDocument(selectedDoc)}
                      className="w-full" 
                      variant="outline"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Baixar Original
                    </Button>
                    
                    {(selectedDoc.status === "ERRO" || selectedDoc.ocrConfidence < 50) && (
                      <Button 
                        onClick={() => {
                          setShowPreviewDialog(false);
                          handleDocumentAction(selectedDoc, "reprocess");
                        }}
                        className="w-full" 
                        variant="outline"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reprocessar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
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

      {/* BPO Fields Modal - Campos Obrigatórios */}
      <Dialog open={showBpoFieldsDialog} onOpenChange={setShowBpoFieldsDialog}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Completar Dados BPO - {selectedDoc?.originalName}
            </DialogTitle>
            <DialogDescription>
              Complete todos os campos obrigatórios para o processamento BPO financeiro.
            </DialogDescription>
          </DialogHeader>
          
          {selectedDoc && (
            <div className="grid grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto p-1">
              {/* Coluna 1 - Campos Obrigatórios */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground border-b pb-2">
                  Campos Obrigatórios BPO
                </h3>
                
                {/* Data de Competência */}
                <div className="space-y-2">
                  <Label htmlFor="competence-date" className="text-sm font-medium text-red-600">
                    Data de Competência *
                  </Label>
                  <Input
                    id="competence-date"
                    type="date"
                    value={bpoFormData.competenceDate}
                    onChange={(e) => setBpoFormData(prev => ({ ...prev, competenceDate: e.target.value }))}
                    className="w-full"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Quando a despesa/receita pertence (competência contábil)
                  </p>
                </div>

                {/* Data de Vencimento */}
                <div className="space-y-2">
                  <Label htmlFor="due-date" className="text-sm font-medium text-red-600">
                    Data de Vencimento *
                  </Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={bpoFormData.dueDate}
                    onChange={(e) => setBpoFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full"
                    required
                  />
                </div>

                {/* Data de Pagamento */}
                <div className="space-y-2">
                  <Label htmlFor="paid-date" className="text-sm font-medium">
                    Data de Pagamento
                  </Label>
                  <Input
                    id="paid-date"
                    type="date"
                    value={bpoFormData.paidDate}
                    onChange={(e) => setBpoFormData(prev => ({ ...prev, paidDate: e.target.value }))}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se aplicável - quando foi pago/recebido
                  </p>
                </div>

                {/* Valor */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-medium text-red-600">
                    Valor *
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={bpoFormData.amount}
                    onChange={(e) => setBpoFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {/* Coluna 2 - Campos Complementares */}
              <div className="space-y-4">
                <h3 className="font-semibold text-foreground border-b pb-2">
                  Classificação e Detalhes
                </h3>

                {/* Categoria */}
                <div className="space-y-2">
                  <Label htmlFor="category" className="text-sm font-medium text-red-600">
                    Categoria *
                  </Label>
                  <Select value={bpoFormData.categoryId} onValueChange={(value) => setBpoFormData(prev => ({ ...prev, categoryId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories || []).map((category: any) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Centro de Custo */}
                <div className="space-y-2">
                  <Label htmlFor="cost-center" className="text-sm font-medium text-red-600">
                    Centro de Custo *
                  </Label>
                  <Select value={bpoFormData.costCenterId} onValueChange={(value) => setBpoFormData(prev => ({ ...prev, costCenterId: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um centro de custo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(costCenters || []).map((costCenter: any) => (
                        <SelectItem key={costCenter.id} value={costCenter.id}>
                          {costCenter.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium text-red-600">
                    Descrição *
                  </Label>
                  <Textarea
                    id="description"
                    value={bpoFormData.description}
                    onChange={(e) => setBpoFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full h-20"
                    placeholder="Ex: Compra de descartáveis para escritório"
                    required
                  />
                </div>

                {/* Observações */}
                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm font-medium">
                    Observações
                  </Label>
                  <Textarea
                    id="notes"
                    value={bpoFormData.notes}
                    onChange={(e) => setBpoFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full h-20"
                    placeholder="Inconsistências, dúvidas ou informações extras..."
                  />
                </div>

                {/* Validação Visual */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800 mb-2">Status de Validação</h4>
                  <div className="space-y-1 text-sm">
                    <div className={`flex items-center gap-2 ${bpoFormData.competenceDate ? 'text-green-600' : 'text-red-600'}`}>
                      {bpoFormData.competenceDate ? '✓' : '✗'} Data de Competência
                    </div>
                    <div className={`flex items-center gap-2 ${bpoFormData.dueDate ? 'text-green-600' : 'text-red-600'}`}>
                      {bpoFormData.dueDate ? '✓' : '✗'} Data de Vencimento
                    </div>
                    <div className={`flex items-center gap-2 ${bpoFormData.amount ? 'text-green-600' : 'text-red-600'}`}>
                      {bpoFormData.amount ? '✓' : '✗'} Valor
                    </div>
                    <div className={`flex items-center gap-2 ${bpoFormData.categoryId ? 'text-green-600' : 'text-red-600'}`}>
                      {bpoFormData.categoryId ? '✓' : '✗'} Categoria
                    </div>
                    <div className={`flex items-center gap-2 ${bpoFormData.costCenterId ? 'text-green-600' : 'text-red-600'}`}>
                      {bpoFormData.costCenterId ? '✓' : '✗'} Centro de Custo
                    </div>
                    <div className={`flex items-center gap-2 ${bpoFormData.description ? 'text-green-600' : 'text-red-600'}`}>
                      {bpoFormData.description ? '✓' : '✗'} Descrição
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setShowBpoFieldsDialog(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => {
                saveBpoDataMutation.mutate({
                  competenceDate: bpoFormData.competenceDate,
                  dueDate: bpoFormData.dueDate,
                  paidDate: bpoFormData.paidDate || null,
                  amount: parseFloat(bpoFormData.amount),
                  description: bpoFormData.description,
                  categoryId: bpoFormData.categoryId,
                  costCenterId: bpoFormData.costCenterId,
                  notes: bpoFormData.notes || null,
                  status: 'CLASSIFICADO',
                  isReadyForBpo: true
                });
              }}
              className="flex-1 bg-gquicks-primary hover:bg-gquicks-primary/90"
              disabled={!bpoFormData.competenceDate || !bpoFormData.dueDate || !bpoFormData.amount || !bpoFormData.categoryId || !bpoFormData.costCenterId || !bpoFormData.description || saveBpoDataMutation.isPending}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Salvar e Marcar como Pronto
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
