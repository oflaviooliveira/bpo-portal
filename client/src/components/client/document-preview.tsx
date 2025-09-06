import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileText, 
  Building, 
  Calendar, 
  DollarSign, 
  User, 
  MapPin, 
  Phone, 
  Mail,
  Eye,
  Zap,
  AlertTriangle,
  CheckCircle,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentPreviewProps {
  document: {
    id: string;
    originalName: string;
    filePath: string;
    status: string;
    bpoType: string;
    extractedData: Record<string, any>;
    confidence: number;
    createdAt: string;
    metadata?: Record<string, any>;
  };
}

export function DocumentPreview({ document }: DocumentPreviewProps) {
  const [activeTab, setActiveTab] = useState<'extracted' | 'raw'>('extracted');

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VALID':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'ERROR':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <Info className="h-4 w-4 text-blue-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'VALID':
        return "bg-green-100 text-green-800 border-green-200";
      case 'WARNING':
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 'ERROR':
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return null;
    
    // Try parsing different date formats
    const formats = [
      // ISO format
      /^\d{4}-\d{2}-\d{2}/,
      // Brazilian format DD/MM/YYYY
      /^\d{2}\/\d{2}\/\d{4}/,
      // US format MM/DD/YYYY  
      /^\d{2}\/\d{2}\/\d{4}/
    ];
    
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (value: string | number) => {
    if (!value) return null;
    
    const numValue = typeof value === 'string' 
      ? parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'))
      : value;
      
    if (isNaN(numValue)) return value;
    
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(numValue);
  };

  const renderExtractedField = (label: string, value: any, icon?: React.ReactNode) => {
    if (!value) return null;
    
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          {icon}
          {label}
        </div>
        <div className="text-sm text-gray-900 bg-gray-50 p-2 rounded border">
          {value}
        </div>
      </div>
    );
  };

  return (
    <div className="flex gap-6 h-[70vh]">
      {/* Document View */}
      <div className="flex-1">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Documento
            </CardTitle>
            <CardDescription>
              Visualização do arquivo original
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="bg-gray-100 h-full rounded-b-lg flex items-center justify-center">
              {document.filePath?.endsWith('.pdf') ? (
                <div className="text-center space-y-4">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-gray-600">Documento PDF</p>
                    <Button 
                      variant="outline" 
                      className="mt-2"
                      onClick={() => window.open(`/api/files/${document.id}`, '_blank')}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Abrir PDF
                    </Button>
                  </div>
                </div>
              ) : (
                <img
                  src={`/api/files/${document.id}`}
                  alt={document.originalName}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              )}
              <div className="hidden text-center space-y-4">
                <AlertTriangle className="h-16 w-16 text-gray-400 mx-auto" />
                <p className="text-gray-600">Não foi possível carregar o arquivo</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data View */}
      <div className="flex-1">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5" />
                  Dados Extraídos
                </CardTitle>
                <CardDescription>
                  Informações processadas por IA
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-3">
                <Badge className={cn("flex items-center gap-1", getStatusColor(document.status))}>
                  {getStatusIcon(document.status)}
                  {document.status}
                </Badge>
                
                <div className="text-sm text-gray-600">
                  {Math.round(document.confidence || 0)}% confiança
                </div>
              </div>
            </div>

            {/* Document Type */}
            <div className="pt-2">
              <Badge variant="outline" className="text-xs">
                {getBpoTypeLabel(document.bpoType)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            <ScrollArea className="h-[50vh]">
              <div className="space-y-4">
                {/* Core Information */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 border-b pb-1">Informações Principais</h4>
                  
                  {renderExtractedField(
                    "Razão Social", 
                    document.extractedData?.razao_social,
                    <Building className="h-4 w-4" />
                  )}
                  
                  {renderExtractedField(
                    "CNPJ/CPF", 
                    document.extractedData?.cnpj || document.extractedData?.cpf,
                    <User className="h-4 w-4" />
                  )}
                  
                  {renderExtractedField(
                    "Valor", 
                    formatCurrency(document.extractedData?.valor),
                    <DollarSign className="h-4 w-4" />
                  )}
                  
                  {renderExtractedField(
                    "Data de Pagamento", 
                    formatDate(document.extractedData?.data_pagamento),
                    <Calendar className="h-4 w-4" />
                  )}
                </div>

                <Separator />

                {/* Additional Information */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 border-b pb-1">Informações Adicionais</h4>
                  
                  {renderExtractedField(
                    "Descrição", 
                    document.extractedData?.descricao,
                    <FileText className="h-4 w-4" />
                  )}
                  
                  {renderExtractedField(
                    "Data de Emissão", 
                    formatDate(document.extractedData?.data_emissao),
                    <Calendar className="h-4 w-4" />
                  )}
                  
                  {renderExtractedField(
                    "Data de Vencimento", 
                    formatDate(document.extractedData?.data_vencimento),
                    <Calendar className="h-4 w-4" />
                  )}

                  {renderExtractedField(
                    "Endereço", 
                    document.extractedData?.endereco,
                    <MapPin className="h-4 w-4" />
                  )}

                  {renderExtractedField(
                    "Telefone", 
                    document.extractedData?.telefone,
                    <Phone className="h-4 w-4" />
                  )}

                  {renderExtractedField(
                    "E-mail", 
                    document.extractedData?.email,
                    <Mail className="h-4 w-4" />
                  )}
                </div>

                {/* Raw Data Toggle */}
                <Separator />
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">Dados Brutos</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab(activeTab === 'raw' ? 'extracted' : 'raw')}
                    >
                      {activeTab === 'raw' ? 'Ocultar' : 'Mostrar'} JSON
                    </Button>
                  </div>
                  
                  {activeTab === 'raw' && (
                    <div className="bg-gray-50 p-3 rounded border text-xs font-mono max-h-40 overflow-y-auto">
                      <pre>{JSON.stringify(document.extractedData, null, 2)}</pre>
                    </div>
                  )}
                </div>

                {/* Processing Info */}
                <Separator />
                
                <div className="text-xs text-gray-500 space-y-1">
                  <div>Processado em: {formatDate(document.createdAt)}</div>
                  <div>ID do documento: {document.id}</div>
                  {document.metadata?.processingTime && (
                    <div>Tempo de processamento: {document.metadata.processingTime}ms</div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}