import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Search, Filter, Download, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DocumentPreview } from "./document-preview";

export function ClientDocuments() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['/api/documents'],
  });

  // Debug log para verificar documentos carregados
  console.log('Documentos carregados:', documents?.length, documents?.map(d => ({
    nome: d.originalName,
    bpoType: d.bpoType,
    documentType: d.documentType,
    status: d.status
  })));

  const filteredDocuments = (documents as any[])?.filter((doc: any) => {
    const matchesSearch = doc.originalName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.extractedData?.razao_social?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    
    // Aceitar tanto bpoType quanto documentType para documentos virtuais
    const docType = doc.bpoType || doc.documentType;
    const matchesType = typeFilter === "all" || docType === typeFilter;
    
    // Debug log para identificar problemas
    if (!matchesType && typeFilter !== "all") {
      console.log(`Documento filtrado - Nome: ${doc.originalName}, bpoType: ${doc.bpoType}, documentType: ${doc.documentType}, filtro: ${typeFilter}`);
    }
    
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
        return "bg-purple-100 text-purple-800";
      case 'PENDENTE_EMISSAO':
        return "bg-orange-100 text-orange-800";
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
                <SelectItem value="PENDENTE_EMISSAO">Pendente Emissão</SelectItem>
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
              {filteredDocuments.map((doc: any) => (
                <div
                  key={doc.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{doc.originalName}</h3>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1">
                          <span>{getBpoTypeLabel(doc.bpoType || doc.documentType)}</span>
                          <span>•</span>
                          <span>{new Date(doc.createdAt).toLocaleDateString('pt-BR')}</span>
                          {doc.extractedData?.razao_social && (
                            <>
                              <span>•</span>
                              <span className="truncate">{doc.extractedData.razao_social}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium",
                        getStatusColor(doc.status)
                      )}>
                        {doc.status}
                      </span>
                      
                      <div className="flex items-center space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          data-testid={`button-view-${doc.id}`}
                          onClick={() => {
                            setSelectedDocument(doc);
                            setPreviewOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" data-testid={`button-download-${doc.id}`}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Additional info for documents with extracted data */}
                  {doc.extractedData && Object.keys(doc.extractedData).length > 0 && (
                    <div className="mt-3 pt-3 border-t grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      {doc.extractedData.valor && (
                        <div>
                          <span className="text-muted-foreground">Valor:</span>
                          <span className="ml-1 font-medium">{doc.extractedData.valor}</span>
                        </div>
                      )}
                      {doc.extractedData.data_pagamento && (
                        <div>
                          <span className="text-muted-foreground">Data:</span>
                          <span className="ml-1 font-medium">{doc.extractedData.data_pagamento}</span>
                        </div>
                      )}
                      {doc.extractedData.cnpj && (
                        <div>
                          <span className="text-muted-foreground">CNPJ:</span>
                          <span className="ml-1 font-medium">{doc.extractedData.cnpj}</span>
                        </div>
                      )}
                      {doc.confidence && (
                        <div>
                          <span className="text-muted-foreground">Confiança:</span>
                          <span className="ml-1 font-medium">{Math.round(doc.confidence)}%</span>
                        </div>
                      )}
                    </div>
                  )}
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
              <FileText className="h-5 w-5" />
              {selectedDocument?.originalName}
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