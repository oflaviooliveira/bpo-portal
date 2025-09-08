import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Search, Filter, Download, Eye, X, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DocumentPreview } from "./document-preview";
import { DocumentMapperFactory, type UnifiedDocumentData } from "@/lib/document-mappers";

export function ClientDocuments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['/api/documents'],
  });

  // Mapear todos os documentos para dados unificados
  const unifiedDocuments = useMemo(() => {
    if (!documents) return [];
    return (documents as any[]).map(doc => ({
      originalDoc: doc,
      unified: DocumentMapperFactory.mapDocument(doc)
    }));
  }, [documents]);


  // Função auxiliar para evitar erro de hoisting
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'PAGO':
        return "Comprovante de Pagamento";
      case 'AGENDADO':
        return "Agendamento de Pagamento";
      case 'EMITIR_BOLETO':
        return "Emissão de Boleto";
      case 'EMITIR_NF':
        return "Emissão de Nota Fiscal";
      default:
        return type;
    }
  };

  const filteredDocuments = unifiedDocuments?.filter(({ originalDoc, unified }) => {
    // Usar dados unificados para busca mais robusta
    const docName = unified.displayName;
    const matchesSearch = docName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         unified.razaoSocial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         unified.supplier?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || unified.status === statusFilter;
    const matchesType = typeFilter === "all" || unified.documentType === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  }) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VALID':
        return "bg-green-100 text-green-800";
      case 'WARNING':
        return "bg-yellow-100 text-yellow-800";
      case 'ERROR':
        return "bg-red-100 text-red-800";
      case 'RECEBIDO':
        return "bg-blue-100 text-blue-800";
      case 'VALIDANDO':
      case 'PROCESSANDO':
        return "bg-purple-100 text-purple-800";
      case 'PENDENTE_EMISSAO':
        return "bg-orange-100 text-orange-800";
      case 'PENDENTE_REVISAO':
        return "bg-amber-100 text-amber-800";
      case 'PAGO_A_CONCILIAR':
        return "bg-green-100 text-green-800";
      case 'AGENDADO':
        return "bg-blue-100 text-blue-800";
      case 'A_PAGAR_HOJE':
        return "bg-red-100 text-red-800";
      case 'EM_CONCILIACAO':
        return "bg-yellow-100 text-yellow-800";
      case 'AGUARDANDO_RECEBIMENTO':
        return "bg-cyan-100 text-cyan-800";
      case 'ARQUIVADO':
        return "bg-gray-100 text-gray-800";
      case 'BOLETO_EMITIDO':
        return "bg-indigo-100 text-indigo-800";
      case 'AGUARDANDO_PAGAMENTO':
        return "bg-pink-100 text-pink-800";
      case 'BOLETO_VENCIDO':
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getBpoTypeLabel = (type: string) => {
    switch (type) {
      case 'PAGO':
        return "Comprovante de Pagamento";
      case 'AGENDADO':
        return "Agendamento de Pagamento";
      case 'EMITIR_BOLETO':
        return "Emissão de Boleto";
      case 'EMITIR_NF':
        return "Emissão de Nota Fiscal";
      default:
        return type;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-gilroy font-bold text-foreground">
          Meus Documentos
        </h1>
        <p className="text-muted-foreground mt-2">
          Gerencie e acompanhe todos os seus documentos enviados
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filtros</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou empresa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-documents"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="RECEBIDO">Recebido</SelectItem>
                <SelectItem value="VALIDANDO">Validando</SelectItem>
                <SelectItem value="PROCESSANDO">Processando</SelectItem>
                <SelectItem value="PENDENTE_EMISSAO">Pendente Emissão</SelectItem>
                <SelectItem value="PENDENTE_REVISAO">Pendente Revisão</SelectItem>
                <SelectItem value="PAGO_A_CONCILIAR">Pago a Conciliar</SelectItem>
                <SelectItem value="AGENDADO">Agendado</SelectItem>
                <SelectItem value="A_PAGAR_HOJE">A Pagar Hoje</SelectItem>
                <SelectItem value="EM_CONCILIACAO">Em Conciliação</SelectItem>
                <SelectItem value="AGUARDANDO_RECEBIMENTO">Aguardando Recebimento</SelectItem>
                <SelectItem value="ARQUIVADO">Arquivado</SelectItem>
                <SelectItem value="BOLETO_EMITIDO">Boleto Emitido</SelectItem>
                <SelectItem value="AGUARDANDO_PAGAMENTO">Aguardando Pagamento</SelectItem>
                <SelectItem value="BOLETO_VENCIDO">Boleto Vencido</SelectItem>
                <SelectItem value="VALID">Válido</SelectItem>
                <SelectItem value="WARNING">Com Aviso</SelectItem>
                <SelectItem value="ERROR">Com Erro</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger data-testid="select-type-filter">
                <SelectValue placeholder="Tipo de Operação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="PAGO">Comprovante de Pagamento</SelectItem>
                <SelectItem value="AGENDADO">Agendamento de Pagamento</SelectItem>
                <SelectItem value="EMITIR_BOLETO">Emissão de Boleto</SelectItem>
                <SelectItem value="EMITIR_NF">Emissão de Nota Fiscal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos ({filteredDocuments.length})</CardTitle>
          <CardDescription>
            Lista completa dos seus documentos processados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gquicks-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Carregando documentos...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum documento encontrado</p>
              <p className="text-sm mt-2">
                {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                  ? "Tente ajustar os filtros"
                  : "Envie seu primeiro documento para começar"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredDocuments.map(({ originalDoc, unified }) => (
                <div
                  key={originalDoc.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      {unified.isVirtual ? (
                        <Receipt className="h-8 w-8 text-[#E40064]" />
                      ) : (
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">
                            {unified.displayName}
                          </h3>
                          {unified.isVirtual && (
                            <span className="px-2 py-1 bg-[#E40064]/10 text-[#E40064] text-xs rounded-full border border-[#E40064]/20">
                              Virtual
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                          <span>{getTypeLabel(unified.documentType)}</span>
                          <span>•</span>
                          <span>{new Date(originalDoc.createdAt).toLocaleDateString('pt-BR')}</span>
                          {unified.razaoSocial && (
                            <>
                              <span>•</span>
                              <span className="truncate">{unified.razaoSocial}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium",
                        getStatusColor(unified.status)
                      )}>
                        {unified.status}
                      </span>
                      
                      <div className="flex items-center space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          data-testid={`button-view-${originalDoc.id}`}
                          onClick={() => {
                            setSelectedDocument(originalDoc);
                            setPreviewOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {!unified.isVirtual && (
                          <Button variant="ghost" size="sm" data-testid={`button-download-${originalDoc.id}`}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Informações unificadas para todos os tipos de documento */}
                  <div className="mt-3 pt-3 border-t grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {unified.valor && (
                      <div>
                        <span className="text-muted-foreground">Valor:</span>
                        <span className="ml-1 font-medium">{unified.valor}</span>
                      </div>
                    )}
                    {unified.dataPagamento && (
                      <div>
                        <span className="text-muted-foreground">Data Pagamento:</span>
                        <span className="ml-1 font-medium">{unified.dataPagamento}</span>
                      </div>
                    )}
                    {unified.dataVencimento && (
                      <div>
                        <span className="text-muted-foreground">Vencimento:</span>
                        <span className="ml-1 font-medium">{unified.dataVencimento}</span>
                      </div>
                    )}
                    {unified.cnpj && (
                      <div>
                        <span className="text-muted-foreground">CNPJ/CPF:</span>
                        <span className="ml-1 font-medium">{unified.cnpj}</span>
                      </div>
                    )}
                    {originalDoc.confidence && (
                      <div>
                        <span className="text-muted-foreground">Confiança:</span>
                        <span className="ml-1 font-medium">{Math.round(originalDoc.confidence)}%</span>
                      </div>
                    )}
                    {unified.isVirtual && unified.boletoInfo?.payerName && (
                      <div>
                        <span className="text-muted-foreground">Pagador:</span>
                        <span className="ml-1 font-medium">{unified.boletoInfo.payerName}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Document Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {selectedDocument?.isVirtualDocument || ['EMITIR_BOLETO', 'EMITIR_NF'].includes(selectedDocument?.documentType) ? (
                <Receipt className="h-5 w-5 text-[#E40064]" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
              {selectedDocument?.originalName || DocumentMapperFactory.mapDocument(selectedDocument || {}).displayName}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPreviewOpen(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          
          {selectedDocument && (
            <DocumentPreview document={selectedDocument} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}