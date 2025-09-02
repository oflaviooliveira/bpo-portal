import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadBpo } from "@/components/documents/upload-bpo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  Upload, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Eye,
  Download 
} from "lucide-react";

export function DocumentsPage() {
  const [activeTab, setActiveTab] = useState("upload");

  // Buscar documentos
  const { data: documents = [] as any[], isLoading } = useQuery({
    queryKey: ["/api/documents"],
    refetchInterval: 5000, // Atualizar a cada 5 segundos para ver status
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: any; icon: any }> = {
      "RECEBIDO": { variant: "secondary", icon: Clock },
      "PROCESSANDO": { variant: "outline", icon: Clock },
      "VALIDANDO": { variant: "outline", icon: AlertCircle },
      "PENDENTE_REVISAO": { variant: "destructive", icon: AlertCircle },
      "PAGO": { variant: "default", icon: CheckCircle },
      "AGENDADO": { variant: "secondary", icon: Clock },
      "ARQUIVADO": { variant: "outline", icon: FileText },
    };

    const config = statusMap[status] || { variant: "outline", icon: FileText };
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, string> = {
      "PAGO": "Pago",
      "AGENDADO": "Agendado", 
      "EMITIR_BOLETO": "Emitir Boleto",
      "EMITIR_NF": "Emitir NF",
    };
    return typeMap[type] || type;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Documentos</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          {documents.length} documentos
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center gap-2" data-testid="tab-upload">
            <Upload className="h-4 w-4" />
            Enviar Documento
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2" data-testid="tab-list">
            <FileText className="h-4 w-4" />
            Lista de Documentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <UploadBpo />
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p>Carregando documentos...</p>
                </div>
              </CardContent>
            </Card>
          ) : documents.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum documento encontrado</h3>
                  <p className="text-muted-foreground mb-4">
                    Comece enviando seu primeiro documento na aba "Enviar Documento"
                  </p>
                  <Button 
                    onClick={() => setActiveTab("upload")}
                    data-testid="button-go-to-upload"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar Documento
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {documents.map((doc: any) => (
                <Card key={doc.id} data-testid={`card-document-${doc.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          {doc.originalName}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                          {getStatusBadge(doc.status)}
                          <Badge variant="outline">{getTypeLabel(doc.documentType)}</Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" data-testid={`button-view-${doc.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" data-testid={`button-download-${doc.id}`}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Valor</p>
                        <p className="font-medium">
                          {doc.amount ? `R$ ${parseFloat(doc.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Vencimento</p>
                        <p className="font-medium">
                          {doc.dueDate ? new Date(doc.dueDate).toLocaleDateString('pt-BR') : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Criado em</p>
                        <p className="font-medium">
                          {new Date(doc.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Tamanho</p>
                        <p className="font-medium">{Math.round(doc.fileSize / 1024)}KB</p>
                      </div>
                    </div>
                    
                    {doc.notes && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-muted-foreground text-sm">Observações</p>
                        <p className="text-sm">{doc.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}