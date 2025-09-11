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
  Info,
  Receipt,
  Clock,
  CreditCard,
  Hash,
  Briefcase,
  Download,
  Folder
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DocumentMapperFactory, type UnifiedDocumentData } from "@/lib/document-mappers";

interface DocumentPreviewProps {
  document: {
    id: string;
    originalName?: string;
    filePath?: string;
    status: string;
    bpoType?: string;
    documentType?: string;
    extractedData?: Record<string, any>;
    confidence?: number;
    createdAt: string;
    metadata?: Record<string, any>;
    isVirtualDocument?: boolean;
    amount?: string | number;
    supplier?: string;
    dueDate?: string;
    description?: string;
    issuerData?: Record<string, any>;
    instructions?: string;
  };
}

export function DocumentPreview({ document }: DocumentPreviewProps) {
  const [activeTab, setActiveTab] = useState<'extracted' | 'raw'>('extracted');
  
  // Usar mapper para unificar dados independente do tipo
  const unifiedData: UnifiedDocumentData = DocumentMapperFactory.mapDocument(document);

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


  const renderField = (label: string, value: any, icon?: React.ReactNode, highlight?: boolean) => {
    if (!value) return null;
    
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          {icon}
          {label}
        </div>
        <div className={cn(
          "text-sm p-2 rounded border",
          highlight 
            ? "text-gray-900 bg-blue-50 border-blue-200" 
            : "text-gray-900 bg-gray-50"
        )}>
          {value}
        </div>
      </div>
    );
  };
  
  const renderSpecializedContent = () => {
    if (unifiedData.isVirtual && unifiedData.boletoInfo) {
      return (
        <div className="space-y-6">
          {/* Seção de Dados Básicos do Boleto */}
          <div className="space-y-3">
            <h4 className="font-medium text-[#E40064] border-b border-[#E40064]/20 pb-1 flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Dados do Pagador
            </h4>
            
            {renderField(
              "Nome/Razão Social", 
              unifiedData.boletoInfo.payerName,
              <User className="h-4 w-4" />,
              true
            )}
            
            {renderField(
              "CPF/CNPJ", 
              unifiedData.boletoInfo.payerDocument,
              <FileText className="h-4 w-4" />,
              true
            )}
            
            {renderField(
              "E-mail", 
              unifiedData.boletoInfo.payerEmail,
              <Mail className="h-4 w-4" />
            )}
            
            {renderField(
              "Telefone", 
              unifiedData.boletoInfo.payerPhone,
              <Phone className="h-4 w-4" />
            )}
            
            {renderField(
              "Nome do Contato", 
              unifiedData.boletoInfo.payerContactName,
              <User className="h-4 w-4" />
            )}
            
            {renderField(
              "Inscrição Estadual", 
              unifiedData.boletoInfo.payerStateRegistration,
              <FileText className="h-4 w-4" />
            )}
          </div>

          {/* Seção de Endereço Completo */}
          {(unifiedData.boletoInfo.payerStreet || unifiedData.boletoInfo.payerAddress) && (
            <div className="space-y-3">
              <h4 className="font-medium text-[#0B0E30] border-b border-[#0B0E30]/20 pb-1 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Endereço do Pagador
              </h4>
              
              {unifiedData.boletoInfo.payerAddress && renderField(
                "Endereço Completo", 
                unifiedData.boletoInfo.payerAddress,
                <MapPin className="h-4 w-4" />
              )}
              
              <div className="grid grid-cols-2 gap-4">
                {unifiedData.boletoInfo.payerStreet && renderField(
                  "Rua/Avenida", 
                  unifiedData.boletoInfo.payerStreet,
                  <Building className="h-4 w-4" />
                )}
                
                {unifiedData.boletoInfo.payerNumber && renderField(
                  "Número", 
                  unifiedData.boletoInfo.payerNumber,
                  <Hash className="h-4 w-4" />
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {unifiedData.boletoInfo.payerComplement && renderField(
                  "Complemento", 
                  unifiedData.boletoInfo.payerComplement,
                  <Building className="h-4 w-4" />
                )}
                
                {unifiedData.boletoInfo.payerNeighborhood && renderField(
                  "Bairro", 
                  unifiedData.boletoInfo.payerNeighborhood,
                  <MapPin className="h-4 w-4" />
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {unifiedData.boletoInfo.payerCity && renderField(
                  "Cidade", 
                  unifiedData.boletoInfo.payerCity,
                  <Building className="h-4 w-4" />
                )}
                
                {unifiedData.boletoInfo.payerState && renderField(
                  "Estado", 
                  unifiedData.boletoInfo.payerState,
                  <MapPin className="h-4 w-4" />
                )}
              </div>
              
              {unifiedData.boletoInfo.payerZipCode && renderField(
                "CEP", 
                unifiedData.boletoInfo.payerZipCode,
                <Hash className="h-4 w-4" />
              )}
            </div>
          )}

          {/* Seção de Instruções */}
          {unifiedData.boletoInfo.instructions && (
            <div className="space-y-3">
              <h4 className="font-medium text-[#E40064] border-b border-[#E40064]/20 pb-1 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Instruções do Boleto
              </h4>
              
              {renderField(
                "Instruções", 
                unifiedData.boletoInfo.instructions,
                <FileText className="h-4 w-4" />
              )}
            </div>
          )}
          
          <Separator />
        </div>
      );
    }
    
    if (unifiedData.isVirtual && unifiedData.nfInfo) {
      return (
        <div className="space-y-6">
          {/* Seção de Dados Básicos da NF */}
          <div className="space-y-3">
            <h4 className="font-medium text-[#0B0E30] border-b border-[#0B0E30]/20 pb-1 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Dados do Tomador do Serviço
            </h4>
            
            {renderField(
              "Nome/Razão Social", 
              unifiedData.nfInfo.payerName,
              <User className="h-4 w-4" />,
              true
            )}
            
            {renderField(
              "CPF/CNPJ", 
              unifiedData.nfInfo.payerDocument,
              <FileText className="h-4 w-4" />,
              true
            )}
            
            {renderField(
              "E-mail", 
              unifiedData.nfInfo.payerEmail,
              <Mail className="h-4 w-4" />
            )}
            
            {renderField(
              "Telefone", 
              unifiedData.nfInfo.payerPhone,
              <Phone className="h-4 w-4" />
            )}
            
            {renderField(
              "Nome do Contato", 
              unifiedData.nfInfo.payerContactName,
              <User className="h-4 w-4" />
            )}
            
            {renderField(
              "Inscrição Estadual", 
              unifiedData.nfInfo.payerStateRegistration,
              <FileText className="h-4 w-4" />
            )}
          </div>

          {/* Seção de Endereço Completo */}
          {(unifiedData.nfInfo.payerStreet || unifiedData.nfInfo.payerAddress) && (
            <div className="space-y-3">
              <h4 className="font-medium text-[#0B0E30] border-b border-[#0B0E30]/20 pb-1 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Endereço do Tomador
              </h4>
              
              {unifiedData.nfInfo.payerAddress && renderField(
                "Endereço Completo", 
                unifiedData.nfInfo.payerAddress,
                <MapPin className="h-4 w-4" />
              )}
              
              <div className="grid grid-cols-2 gap-4">
                {unifiedData.nfInfo.payerStreet && renderField(
                  "Rua/Avenida", 
                  unifiedData.nfInfo.payerStreet,
                  <Building className="h-4 w-4" />
                )}
                
                {unifiedData.nfInfo.payerNumber && renderField(
                  "Número", 
                  unifiedData.nfInfo.payerNumber,
                  <Hash className="h-4 w-4" />
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {unifiedData.nfInfo.payerComplement && renderField(
                  "Complemento", 
                  unifiedData.nfInfo.payerComplement,
                  <Building className="h-4 w-4" />
                )}
                
                {unifiedData.nfInfo.payerNeighborhood && renderField(
                  "Bairro", 
                  unifiedData.nfInfo.payerNeighborhood,
                  <MapPin className="h-4 w-4" />
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {unifiedData.nfInfo.payerCity && renderField(
                  "Cidade", 
                  unifiedData.nfInfo.payerCity,
                  <Building className="h-4 w-4" />
                )}
                
                {unifiedData.nfInfo.payerState && renderField(
                  "Estado", 
                  unifiedData.nfInfo.payerState,
                  <MapPin className="h-4 w-4" />
                )}
              </div>
              
              {unifiedData.nfInfo.payerZipCode && renderField(
                "CEP", 
                unifiedData.nfInfo.payerZipCode,
                <Hash className="h-4 w-4" />
              )}
            </div>
          )}

          {/* Seção de Informações do Serviço */}
          <div className="space-y-3">
            <h4 className="font-medium text-[#E40064] border-b border-[#E40064]/20 pb-1 flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Dados do Serviço
            </h4>
            
            {renderField(
              "Descrição do Serviço", 
              unifiedData.nfInfo.serviceDescription,
              <FileText className="h-4 w-4" />,
              true
            )}
            
            {renderField(
              "Data de Competência", 
              unifiedData.nfInfo.competenceDate,
              <Calendar className="h-4 w-4" />
            )}
            
            <div className="grid grid-cols-2 gap-4">
              {unifiedData.nfInfo.categoryName && renderField(
                "Categoria", 
                unifiedData.nfInfo.categoryName,
                <FileText className="h-4 w-4" />
              )}
              
              {unifiedData.nfInfo.costCenterName && renderField(
                "Centro de Custo", 
                unifiedData.nfInfo.costCenterName,
                <Building className="h-4 w-4" />
              )}
            </div>
          </div>
          
          <Separator />
        </div>
      );
    }
    
    if (unifiedData.scheduleInfo) {
      return (
        <div className="space-y-6">
          {/* Seção de Dados Básicos do Agendamento */}
          <div className="space-y-3">
            <h4 className="font-medium text-[#0B0E30] border-b border-[#0B0E30]/20 pb-1 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Dados do Agendamento
            </h4>
            
            {/* CORREÇÃO 1: Data de Agendamento com fallback para dueDate */}
            {renderField(
              "Data para Agendamento", 
              unifiedData.scheduleInfo.scheduledDate || unifiedData.dueDate,
              <Calendar className="h-4 w-4" />,
              true
            )}
            
            {/* CORREÇÃO 2: Banco */}
            {renderField(
              "Banco", 
              unifiedData.scheduleInfo.bankName,
              <Building className="h-4 w-4" />
            )}
            
            {/* CORREÇÃO 3: Forma de Pagamento */}
            {renderField(
              "Forma de Pagamento", 
              unifiedData.scheduleInfo.paymentMethod,
              <CreditCard className="h-4 w-4" />
            )}
            
            {/* CORREÇÃO 4: Observações (document.notes) */}
            {renderField(
              "Observações", 
              unifiedData.scheduleInfo.instructions,
              <FileText className="h-4 w-4" />
            )}
            
            {/* CORREÇÃO 5: Categoria e Centro de Custo (se preenchidos) */}
            {(unifiedData.scheduleInfo.categoryName || unifiedData.scheduleInfo.costCenterName) && (
              <>
                {renderField(
                  "Categoria", 
                  unifiedData.scheduleInfo.categoryName,
                  <Folder className="h-4 w-4" />
                )}
                
                {renderField(
                  "Centro de Custo", 
                  unifiedData.scheduleInfo.costCenterName,
                  <Building className="h-4 w-4" />
                )}
              </>
            )}
          </div>

          {/* Seção de Dados do Pagador */}
          <div className="space-y-3">
            <h4 className="font-medium text-[#E40064] border-b border-[#E40064]/20 pb-1 flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados do Pagador
            </h4>
            
            {renderField(
              "Nome/Razão Social", 
              unifiedData.scheduleInfo.payerName,
              <User className="h-4 w-4" />,
              true
            )}
            
            {renderField(
              "CPF/CNPJ", 
              unifiedData.scheduleInfo.payerDocument,
              <FileText className="h-4 w-4" />,
              true
            )}
            
            {renderField(
              "E-mail", 
              unifiedData.scheduleInfo.payerEmail,
              <Mail className="h-4 w-4" />
            )}
            
            {renderField(
              "Telefone", 
              unifiedData.scheduleInfo.payerPhone,
              <Phone className="h-4 w-4" />
            )}
            
            {renderField(
              "Nome do Contato", 
              unifiedData.scheduleInfo.payerContactName,
              <User className="h-4 w-4" />
            )}
            
            {renderField(
              "Inscrição Estadual", 
              unifiedData.scheduleInfo.payerStateRegistration,
              <FileText className="h-4 w-4" />
            )}
          </div>

          {/* Seção de Endereço Completo */}
          {(unifiedData.scheduleInfo.payerStreet || unifiedData.scheduleInfo.payerAddress) && (
            <div className="space-y-3">
              <h4 className="font-medium text-[#0B0E30] border-b border-[#0B0E30]/20 pb-1 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Endereço do Pagador
              </h4>
              
              {unifiedData.scheduleInfo.payerAddress && renderField(
                "Endereço Completo", 
                unifiedData.scheduleInfo.payerAddress,
                <MapPin className="h-4 w-4" />
              )}
              
              <div className="grid grid-cols-2 gap-4">
                {unifiedData.scheduleInfo.payerStreet && renderField(
                  "Rua/Avenida", 
                  unifiedData.scheduleInfo.payerStreet,
                  <Building className="h-4 w-4" />
                )}
                
                {unifiedData.scheduleInfo.payerNumber && renderField(
                  "Número", 
                  unifiedData.scheduleInfo.payerNumber,
                  <Hash className="h-4 w-4" />
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {unifiedData.scheduleInfo.payerComplement && renderField(
                  "Complemento", 
                  unifiedData.scheduleInfo.payerComplement,
                  <Building className="h-4 w-4" />
                )}
                
                {unifiedData.scheduleInfo.payerNeighborhood && renderField(
                  "Bairro", 
                  unifiedData.scheduleInfo.payerNeighborhood,
                  <MapPin className="h-4 w-4" />
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {unifiedData.scheduleInfo.payerCity && renderField(
                  "Cidade", 
                  unifiedData.scheduleInfo.payerCity,
                  <Building className="h-4 w-4" />
                )}
                
                {unifiedData.scheduleInfo.payerState && renderField(
                  "Estado", 
                  unifiedData.scheduleInfo.payerState,
                  <MapPin className="h-4 w-4" />
                )}
              </div>
              
              {unifiedData.scheduleInfo.payerZipCode && renderField(
                "CEP", 
                unifiedData.scheduleInfo.payerZipCode,
                <Hash className="h-4 w-4" />
              )}
            </div>
          )}
          
          <Separator />
        </div>
      );
    }
    
    if (unifiedData.paymentInfo) {
      return (
        <div className="space-y-4">
          {/* Seção específica de Pagamentos */}
          <div className="space-y-3">
            <h4 className="font-medium text-green-700 border-b border-green-200 pb-1 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Dados da Conciliação
            </h4>
            
            {renderField(
              "Banco / Instituição", 
              unifiedData.paymentInfo.bankName,
              <Building className="h-4 w-4" />,
              true
            )}
            
            {renderField(
              "ID da Transação / Protocolo", 
              unifiedData.paymentInfo.transactionId,
              <FileText className="h-4 w-4" />,
              true
            )}
            
            {unifiedData.paymentInfo.reconciliationData?.account && renderField(
              "Conta Origem", 
              unifiedData.paymentInfo.reconciliationData.account,
              <CreditCard className="h-4 w-4" />
            )}
            
            {unifiedData.paymentInfo.reconciliationData?.agency && renderField(
              "Agência", 
              unifiedData.paymentInfo.reconciliationData.agency,
              <Building className="h-4 w-4" />
            )}
            
            {unifiedData.paymentInfo.reconciliationData?.paymentMethod && renderField(
              "Forma de Pagamento", 
              unifiedData.paymentInfo.reconciliationData.paymentMethod,
              <CreditCard className="h-4 w-4" />
            )}
          </div>
          
          <Separator />
        </div>
      );
    }
    
    return null;
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
              {unifiedData.isVirtual ? (
                <div className="text-center space-y-4">
                  <Receipt className="h-16 w-16 text-[#E40064] mx-auto" />
                  <div>
                    <p className="text-gray-600">Documento Virtual</p>
                    <p className="text-sm text-gray-500">{unifiedData.displayName}</p>
                  </div>
                  <div className="flex gap-2 justify-center">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open(`/api/documents/${document.id}/virtual-preview`, '_blank')}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Visualizar
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        const link = window.document.createElement('a');
                        link.href = `/api/documents/${document.id}/virtual-download`;
                        link.download = `${unifiedData.displayName}.pdf`;
                        link.click();
                      }}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Baixar PDF
                    </Button>
                  </div>
                </div>
              ) : (document.filePath?.endsWith('.pdf') || document.originalName?.toLowerCase().endsWith('.pdf') || document.mimeType?.includes('pdf')) ? (
                <div className="text-center space-y-4">
                  <FileText className="h-16 w-16 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-gray-600">Documento PDF</p>
                    <Button 
                      variant="outline" 
                      className="mt-2"
                      onClick={() => window.open(`/api/documents/${document.id}/preview`, '_blank')}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Abrir PDF
                    </Button>
                  </div>
                </div>
              ) : (
                <img
                  src={`/api/documents/${document.id}/preview`}
                  alt={document.originalName || 'Documento'}
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
                <Badge className={cn("flex items-center gap-1", getStatusColor(unifiedData.status))}>
                  {getStatusIcon(unifiedData.status)}
                  {unifiedData.status}
                </Badge>
                
                <div className="text-sm text-gray-600">
                  {Math.round(document.confidence || 0)}% confiança
                </div>
                
                {unifiedData.isVirtual && (
                  <Badge variant="outline" className="text-xs text-[#E40064] border-[#E40064]">
                    Virtual
                  </Badge>
                )}
              </div>
            </div>

            {/* Document Type */}
            <div className="pt-2">
              <Badge variant="outline" className="text-xs">
                {getBpoTypeLabel(unifiedData.documentType)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            <ScrollArea className="h-[50vh]">
              <div className="space-y-4">
                {/* Core Information */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 border-b pb-1">Informações Principais</h4>
                  
                  {renderField(
                    "Razão Social / Fornecedor", 
                    unifiedData.razaoSocial,
                    <Building className="h-4 w-4" />,
                    true
                  )}
                  
                  {renderField(
                    "CNPJ/CPF", 
                    unifiedData.cnpj,
                    <User className="h-4 w-4" />,
                    true
                  )}
                  
                  {renderField(
                    "Valor Pago", 
                    unifiedData.valor,
                    <DollarSign className="h-4 w-4" />,
                    true
                  )}
                  
                  {renderField(
                    "Data de Pagamento", 
                    unifiedData.dataPagamento,
                    <Calendar className="h-4 w-4" />,
                    true
                  )}
                  
                  {unifiedData.documentType === 'PAGO' && renderField(
                    "Método de Pagamento", 
                    unifiedData.metodoPagamento || unifiedData.paymentInfo?.reconciliationData?.paymentMethod,
                    <CreditCard className="h-4 w-4" />
                  )}
                </div>

                <Separator />

                {/* Conteúdo Especializado por Tipo */}
                {renderSpecializedContent()}

                {/* Additional Information */}
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 border-b pb-1">Informações Adicionais</h4>
                  
                  {renderField(
                    "Descrição / Finalidade", 
                    unifiedData.descricao,
                    <FileText className="h-4 w-4" />
                  )}
                  
                  {unifiedData.documentType === 'PAGO' && unifiedData.numeroOperacao && renderField(
                    "Número da Operação", 
                    unifiedData.numeroOperacao,
                    <FileText className="h-4 w-4" />
                  )}
                  
                  {unifiedData.documentType === 'PAGO' && unifiedData.banco && renderField(
                    "Banco", 
                    unifiedData.banco,
                    <Building className="h-4 w-4" />
                  )}
                  
                  {renderField(
                    "Data de Emissão", 
                    unifiedData.dataEmissao,
                    <Calendar className="h-4 w-4" />
                  )}
                  
                  {renderField(
                    "Data de Vencimento", 
                    unifiedData.dataVencimento,
                    <Calendar className="h-4 w-4" />
                  )}

                  {renderField(
                    "Endereço", 
                    unifiedData.endereco,
                    <MapPin className="h-4 w-4" />
                  )}

                  {renderField(
                    "Telefone", 
                    unifiedData.telefone,
                    <Phone className="h-4 w-4" />
                  )}

                  {renderField(
                    "E-mail", 
                    unifiedData.email,
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
                      <div className="mb-2 text-xs font-semibold text-gray-600">Dados Unificados:</div>
                      <pre className="mb-4">{JSON.stringify(unifiedData, null, 2)}</pre>
                      
                      <div className="mb-2 text-xs font-semibold text-gray-600">Dados Originais:</div>
                      <pre>{JSON.stringify(unifiedData.rawExtractedData, null, 2)}</pre>
                    </div>
                  )}
                </div>

                {/* Processing Info */}
                <Separator />
                
                <div className="text-xs text-gray-500 space-y-1">
                  <div>Processado em: {document.createdAt}</div>
                  <div>ID do documento: {document.id}</div>
                  <div>Tipo: {unifiedData.isVirtual ? 'Virtual' : 'Físico'}</div>
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