import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CloudUpload, Upload as UploadIcon, FileText, Calendar, DollarSign, Building2, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AutoSupplierModal } from "@/components/client/auto-supplier-modal";

// Schema de validação inteligente
const bpoUploadSchema = z.object({
  // Seleção de tipo
  documentType: z.enum(["PAGO", "AGENDADO", "EMITIR_BOLETO", "EMITIR_NF"]),

  // Dados básicos sempre obrigatórios
  amount: z.string().min(1, "Valor é obrigatório"),
  contraparteId: z.string().min(1, "Contraparte é obrigatória"),
  description: z.string().min(1, "Descrição é obrigatória"),

  // Dados condicionais por tipo
  competenceDate: z.string().optional(),
  realPaidDate: z.string().optional(),
  scheduledDate: z.string().optional(),

  // Dados opcionais BPO
  bankId: z.string().optional(),
  categoryId: z.string().optional(),
  costCenterId: z.string().optional(),
  notes: z.string().optional(),

  // Campos para boleto/NF
  payerDocument: z.string().optional(),
  payerName: z.string().optional(),
  payerAddress: z.string().optional(),
  payerEmail: z.string().optional(),
  serviceCode: z.string().optional(),
  serviceDescription: z.string().optional(),
}).superRefine((data, ctx) => {
  // Validação condicional por tipo
  if (data.documentType === "PAGO") {
    if (!data.competenceDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data de Competência é obrigatória para documentos PAGO",
        path: ["competenceDate"]
      });
    }
    if (!data.realPaidDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data Real de Pagamento é obrigatória para documentos PAGO",
        path: ["realPaidDate"]
      });
    }
  }

  if (data.documentType === "AGENDADO") {
    if (!data.scheduledDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data para Agendamento é obrigatória para documentos AGENDADO",
        path: ["scheduledDate"]
      });
    }
    if (!data.bankId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Banco é obrigatório para agendamento",
        path: ["bankId"]
      });
    }
  }

  if (data.documentType === "EMITIR_BOLETO" || data.documentType === "EMITIR_NF") {
    const requiredFields = [
      { field: "payerDocument", name: "CNPJ/CPF do Tomador" },
      { field: "payerName", name: "Nome/Razão Social" },
      { field: "payerAddress", name: "Endereço" },
      { field: "payerEmail", name: "Email" }
    ];

    requiredFields.forEach(({ field, name }) => {
      if (!data[field as keyof typeof data]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${name} é obrigatório para ${data.documentType}`,
          path: [field]
        });
      }
    });

    if (data.documentType === "EMITIR_NF") {
      if (!data.serviceCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Código do Serviço é obrigatório para emissão de NF",
          path: ["serviceCode"]
        });
      }
      if (!data.serviceDescription) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Descrição do Serviço é obrigatória para emissão de NF",
          path: ["serviceDescription"]
        });
      }
    }
  }
});

type BpoUploadData = z.infer<typeof bpoUploadSchema>;

interface DocumentSuggestion {
  field: string;
  value: string;
  confidence: number;
  source: 'IA' | 'DOCUMENTO';
}

interface ProcessingState {
  stage: 'ready' | 'processing' | 'analyzed' | 'submitting';
  message: string;
}

export function UploadBpo() {
  console.log("🎯 UploadBpo component está sendo renderizado!");
  console.log("🔄 Component UploadBpo carregado no DOM");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({ 
    stage: 'ready', 
    message: 'Selecione um arquivo para começar' 
  });
  const [suggestions, setSuggestions] = useState<DocumentSuggestion[]>([]);
  const [documentMetadata, setDocumentMetadata] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estado para auto-detecção de fornecedor
  const [autoSupplierModal, setAutoSupplierModal] = useState<{
    open: boolean;
    detectedSupplier?: {
      name: string;
      document: string;
      type: 'PF' | 'PJ';
      confidence: number;
      source: string;
    };
  }>({ open: false });

  const form = useForm<BpoUploadData>({
    resolver: zodResolver(bpoUploadSchema),
    defaultValues: {
      documentType: "PAGO",
      amount: "",
      contraparteId: "",
      description: "",
      notes: "",
    },
  });

  const documentType = form.watch("documentType");
  const needsDocument = documentType === "PAGO" || documentType === "AGENDADO";

  // Buscar dados do sistema
  const { data: banks = [] as any[] } = useQuery({ queryKey: ["/api/banks"] });
  const { data: categories = [] as any[] } = useQuery({ queryKey: ["/api/categories"] });
  const { data: costCenters = [] as any[] } = useQuery({ queryKey: ["/api/cost-centers"] });

  // Buscar contrapartes filtradas por tipo de documento
  const getContraparteFilters = () => {
    if (documentType === "PAGO" || documentType === "AGENDADO") {
      return { canBeSupplier: true };
    } else {
      return { canBeClient: true };
    }
  };

  const { data: contrapartes = [] as any[] } = useQuery({
    queryKey: ["/api/fornecedores", documentType],
    queryFn: async () => {
      const response = await fetch(`/api/fornecedores`);
      if (!response.ok) throw new Error('Erro ao buscar fornecedores');
      return response.json();
    },
  });

  // Mutation para processar arquivo com IA
  const processFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/documents/process-file", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro ao processar arquivo");
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log("✅ Processamento IA concluído:", data);

      // Verificar se temos sugestões da API
      if (!data.suggestions) {
        console.log("⚠️ Nenhuma sugestão recebida da API");
        setProcessingState({ 
          stage: 'ready', 
          message: 'Documento processado mas sem sugestões automáticas' 
        });
        return;
      }

      console.log("🎯 Recebendo sugestões:", data.suggestions);

      // Mapear sugestões da IA usando estrutura correta
      const newSuggestions: DocumentSuggestion[] = [];

      if (data.suggestions.amount) {
        newSuggestions.push({
          field: "amount",
          value: data.suggestions.amount,
          confidence: data.suggestions.confidence?.amount || 95,
          source: "IA"
        });
        form.setValue("amount", data.suggestions.amount);
        console.log("💰 Valor preenchido:", data.suggestions.amount);
      }

      if (data.suggestions.supplier || data.suggestions.contraparte) {
        const contraparteValue = data.suggestions.contraparte || data.suggestions.supplier;
        newSuggestions.push({
          field: "contraparte", 
          value: contraparteValue,
          confidence: data.suggestions.confidence?.supplier || 95,
          source: "IA"
        });

        // Detectar e processar fornecedor inteligentemente
        detectAndHandleSupplier(
          contraparteValue, 
          data.suggestions.documento,
          data.suggestions.confidence?.supplier || 95
        );
        console.log("🏢 Processando fornecedor da IA:", contraparteValue);
      }

      if (data.suggestions.description) {
        newSuggestions.push({
          field: "description",
          value: data.suggestions.description,
          confidence: data.suggestions.confidence?.description || 95,
          source: "IA"
        });
        form.setValue("description", data.suggestions.description);
        console.log("📝 Descrição preenchida:", data.suggestions.description);
      }

      // Converter datas brasileiras para formato ISO (YYYY-MM-DD)
      const convertBRDateToISO = (brDate: string) => {
        if (!brDate) return "";
        try {
          const [day, month, year] = brDate.split('/');
          const convertedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          console.log(`📅 Conversão de data: ${brDate} → ${convertedDate}`);
          return convertedDate;
        } catch (error) {
          console.log(`⚠️ Erro na conversão de data: ${brDate}`);
          return "";
        }
      };

      // Mapear campos adicionais importantes
      if (data.suggestions.documento) {
        console.log("📄 Documento identificado:", data.suggestions.documento);
      }

      if (data.suggestions.category) {
        console.log("🏷️ Categoria sugerida:", data.suggestions.category);
      }

      if (data.suggestions.centerCost) {
        console.log("🏢 Centro de custo sugerido:", data.suggestions.centerCost);
      }

      // Mapear datas do documento (separadas dos dados BPO reais)
      if (data.suggestions.paymentDate) {
        const convertedDate = convertBRDateToISO(data.suggestions.paymentDate);
        console.log("💳 Data pagamento (documento):", data.suggestions.paymentDate, "→", convertedDate);
      }

      if (data.suggestions.dueDate) {
        const convertedDate = convertBRDateToISO(data.suggestions.dueDate);
        console.log("📅 Data vencimento (documento):", data.suggestions.dueDate, "→", convertedDate);
      }

      // IMPORTANTE: NÃO auto-preencher datas BPO - são dados operacionais reais
      console.log("⚠️ NOTA: Datas do documento NÃO são preenchidas automaticamente nos campos BPO");
      console.log("💡 Usuário deve confirmar as datas reais de operação manualmente");

      // Salvar metadados do documento para referência
      setDocumentMetadata({
        documentDate: data.suggestions.paymentDate || data.suggestions.dueDate,
        documentValue: data.suggestions.amount,
        ocrQuality: data.qualityMetadata?.ocrQuality,
        confidence: data.suggestions.confidence
      });

      setSuggestions(newSuggestions);
      setProcessingState({ 
        stage: 'analyzed', 
        message: `IA analisou o documento com ${Math.round((data.suggestions.confidence?.amount || 95))}% de precisão` 
      });

      toast({
        title: "Documento processado com sucesso",
        description: `IA identificou ${newSuggestions.length} campos automaticamente`,
      });

      console.log("✅ Total de campos sugeridos:", newSuggestions.length);
    },
    onError: (error: any) => {
      console.error("❌ Erro no processamento IA:", error);
      setProcessingState({ 
        stage: 'ready', 
        message: 'Erro no processamento. Preencha manualmente.' 
      });

      toast({
        title: "Erro no processamento IA",
        description: "Preencha os campos manualmente",
        variant: "destructive",
      });
    },
  });

  // Função de detecção inteligente de fornecedor
  const detectAndHandleSupplier = async (name: string, document?: string, confidence?: number) => {
    try {
      console.log("🔍 Detectando fornecedor:", name, document);
      
      // Primeiro buscar fornecedor existente por nome
      const existingFornecedor = contrapartes.find((c: any) => 
        c.name.toLowerCase().includes(name.toLowerCase()) || 
        name.toLowerCase().includes(c.name.toLowerCase())
      );

      if (existingFornecedor) {
        form.setValue("contraparteId", existingFornecedor.id);
        console.log("✅ Fornecedor existente encontrado:", existingFornecedor.name);
        return;
      }

      // Se não encontrou, verificar se temos dados suficientes para sugerir cadastro
      if (name && name.length > 2 && document && document !== "CNPJ não informado") {
        const cleanDocument = document.replace(/[^\d]/g, '');
        const documentType = cleanDocument.length === 14 ? 'PJ' : cleanDocument.length === 11 ? 'PF' : null;
        
        if (documentType) {
          console.log("🚀 Novo fornecedor detectado, abrindo modal...");
          
          setAutoSupplierModal({
            open: true,
            detectedSupplier: {
              name,
              document: cleanDocument,
              type: documentType,
              confidence: confidence || 90,
              source: `Documento processado com IA`
            }
          });
          return;
        }
      }

      console.log("⚠️ Fornecedor não encontrado e dados insuficientes para cadastro automático");
    } catch (error) {
      console.error("❌ Erro na detecção de fornecedor:", error);
    }
  };

  // Handlers do modal
  const handleSupplierCreated = (newSupplier: any) => {
    form.setValue("contraparteId", newSupplier.id);
    queryClient.invalidateQueries({ queryKey: ["/api/fornecedores"] });
    
    toast({
      title: "Fornecedor cadastrado",
      description: `${newSupplier.name} foi adicionado com sucesso`,
    });
  };

  const handleSupplierSkip = () => {
    console.log("🔄 Usuário pulou o cadastro automático de fornecedor");
  };

  // Mutation para upload final
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.log("🔍 Detalhes completos do erro do servidor:", errorData);
        
        // Criar mensagem detalhada se houver details
        if (errorData.details && Array.isArray(errorData.details)) {
          const fieldErrors = errorData.details.map((detail: any) => 
            `• ${detail.field}: ${detail.message}`
          ).join('\n');
          throw new Error(`${errorData.error}\n\nCampos com problema:\n${fieldErrors}`);
        }
        
        throw new Error(errorData.message || errorData.error || 'Erro no upload');
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log("✅ Upload BPO concluído:", data);

      toast({
        title: "Documento enviado com sucesso",
        description: `Documento ${data.documentId} foi processado e está no fluxo BPO`,
      });

      // Reset form
      form.reset();
      setSelectedFile(null);
      setSuggestions([]);
      setDocumentMetadata(null);
      setProcessingState({ stage: 'ready', message: 'Selecione um arquivo para começar' });

      // Invalidar cache
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error: any) => {
      console.error("❌ Erro no upload BPO:", error);
      setProcessingState({ stage: 'analyzed', message: 'Erro no envio. Verifique os dados.' });

      // Melhorar exibição da mensagem de erro
      const errorMessage = error.message || "Verifique os campos obrigatórios";
      const isDetailedError = errorMessage.includes('Campos com problema:');
      
      toast({
        title: "Erro no envio",
        description: isDetailedError 
          ? errorMessage.split('\n').slice(0, 3).join('\n') + (errorMessage.split('\n').length > 3 ? '\n...' : '')
          : errorMessage,
        variant: "destructive",
      });

      // Log detalhado para debugging
      console.log("📋 Mensagem de erro completa:", errorMessage);
    },
  });

  // Handlers
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setProcessingState({ stage: 'processing', message: 'Processando documento...' });
      processFileMutation.mutate(file);
    }
  };

  const onSubmit = async (data: BpoUploadData) => {
    if (needsDocument && !selectedFile) {
      toast({
        title: "Arquivo obrigatório",
        description: "Selecione um documento para análise",
        variant: "destructive",
      });
      return;
    }

    setProcessingState({ stage: 'submitting', message: 'Enviando para BPO...' });

    const formData = new FormData();

    if (selectedFile) {
      formData.append("file", selectedFile);
    }

    // Função para converter datas para formato DD/MM/AAAA
    const formatDateForServer = (dateStr: string) => {
      if (!dateStr) return dateStr;
      
      // Se já está no formato DD/MM/AAAA, manter
      if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        return dateStr;
      }
      
      // Se está no formato AAAA-MM-DD, converter para DD/MM/AAAA
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      }
      
      return dateStr;
    };

    // Mapear campos do frontend para backend
    const fieldMapping: Record<string, string> = {
      contraparteId: 'supplier',
      realPaidDate: 'paidDate'
    };

    // Adicionar todos os campos do formulário com mapeamento correto
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        const backendKey = fieldMapping[key] || key;
        
        // Converter formato de datas para DD/MM/AAAA
        let finalValue = String(value);
        if (key === 'competenceDate' || key === 'realPaidDate') {
          finalValue = formatDateForServer(finalValue);
          console.log(`📅 Convertendo data ${key}: ${value} → ${finalValue}`);
        }
        
        formData.append(backendKey, finalValue);
      }
    });

    // Log para debugging
    console.log("📤 Dados sendo enviados para o servidor:");
    const formEntries = Array.from(formData.entries());
    formEntries.forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    uploadMutation.mutate(formData);
  };

  const getSuggestionBadge = (fieldName: string) => {
    const suggestion = suggestions.find(s => s.field === fieldName);
    if (!suggestion) return null;

    return (
      <Badge variant="secondary" className="ml-2 text-xs bg-[#E40064]/10 text-[#E40064] border-[#E40064]/20">
        <Sparkles className="h-3 w-3 mr-1" />
        IA {suggestion.confidence}%
      </Badge>
    );
  };

  // Função para obter o rótulo correto da contraparte
  const getContraparteLabel = () => {
    if (documentType === "PAGO" || documentType === "AGENDADO") {
      return "Fornecedor";
    } else {
      return "Cliente";
    }
  };

  const isFieldSuggested = (fieldName: string) => {
    return suggestions.some(s => s.field === fieldName);
  };

  // Reset form when document type changes
  useEffect(() => {
    const currentValues = form.getValues();
    form.reset({
      documentType: currentValues.documentType,
      amount: currentValues.amount,
      contraparteId: currentValues.contraparteId,
      description: currentValues.description,
    });
  }, [documentType, form]);

  return (
    <div className="space-y-6">
      {/* Header - NOVO COMPONENTE BPO */}
      <Card className="border-[#E40064]/20">
        <CardHeader className="bg-gradient-to-r from-[#E40064]/5 to-[#0B0E30]/5">
          <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
            <CloudUpload className="h-5 w-5 text-[#E40064]" />
            Upload de Documentos BPO
            <Badge variant="destructive" className="ml-2 text-xs bg-green-500">
              NOVO SISTEMA
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* Seleção de Tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
              <FileText className="h-5 w-5 text-[#E40064]" />
              Tipo de Operação BPO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={documentType}
              onValueChange={(value) => form.setValue("documentType", value as any)}
              className="grid grid-cols-2 gap-4"
            >
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-[#E40064]/5 transition-colors">
                <RadioGroupItem value="PAGO" id="PAGO" />
                <Label htmlFor="PAGO" className="flex-1 cursor-pointer">
                  <div className="font-medium text-[#0B0E30]">Pago (PG)</div>
                  <div className="text-sm text-gray-600">Documento já pago</div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-[#E40064]/5 transition-colors">
                <RadioGroupItem value="AGENDADO" id="AGENDADO" />
                <Label htmlFor="AGENDADO" className="flex-1 cursor-pointer">
                  <div className="font-medium text-[#0B0E30]">Agendado (AGD)</div>
                  <div className="text-sm text-gray-600">Pagamento agendado</div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-[#E40064]/5 transition-colors">
                <RadioGroupItem value="EMITIR_BOLETO" id="EMITIR_BOLETO" />
                <Label htmlFor="EMITIR_BOLETO" className="flex-1 cursor-pointer">
                  <div className="font-medium text-[#0B0E30]">Emitir Boleto</div>
                  <div className="text-sm text-gray-600">Gerar boleto bancário</div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-[#E40064]/5 transition-colors">
                <RadioGroupItem value="EMITIR_NF" id="EMITIR_NF" />
                <Label htmlFor="EMITIR_NF" className="flex-1 cursor-pointer">
                  <div className="font-medium text-[#0B0E30]">Emitir NF</div>
                  <div className="text-sm text-gray-600">Gerar nota fiscal</div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Upload de Arquivo (apenas para PAGO/AGENDADO) */}
        {needsDocument && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
                <UploadIcon className="h-5 w-5 text-[#E40064]" />
                Documento para Análise
                <Badge variant="destructive">Obrigatório</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="cursor-pointer"
                  data-testid="input-file"
                />

                {selectedFile && (
                  <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex items-center justify-between">
                        <span>
                          {selectedFile.name} ({Math.round(selectedFile.size/1024)}KB)
                        </span>
                        {processingState.stage === 'processing' && (
                          <Badge variant="outline">
                            <Sparkles className="h-3 w-3 mr-1 animate-spin" />
                            Processando...
                          </Badge>
                        )}
                        {processingState.stage === 'analyzed' && (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Analisado
                          </Badge>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <p className="text-sm text-gray-600">
                  {processingState.message}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Dados Básicos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
              <DollarSign className="h-5 w-5 text-[#E40064]" />
              Dados Básicos
              <Badge variant="destructive">Obrigatório</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Valor */}
              <div className="space-y-2">
                <Label className="flex items-center">
                  Valor *
                  {getSuggestionBadge('amount')}
                </Label>
                <Input
                  {...form.register("amount")}
                  placeholder="R$ 1.000,00"
                  className={isFieldSuggested('amount') ? 'border-[#E40064]/30 bg-[#E40064]/5' : ''}
                  data-testid="input-amount"
                />
                {form.formState.errors.amount && (
                  <p className="text-sm text-red-500">{form.formState.errors.amount.message}</p>
                )}
              </div>

              {/* Contraparte dinâmica */}
              <div className="space-y-2">
                <Label className="flex items-center">
                  {getContraparteLabel()} *
                  {getSuggestionBadge('contraparte')}
                </Label>
                <Select onValueChange={(value) => form.setValue("contraparteId", value)}>
                  <SelectTrigger 
                    data-testid="select-contraparte"
                    className={isFieldSuggested('contraparte') ? 'border-[#E40064]/30 bg-[#E40064]/5' : ''}
                  >
                    <SelectValue placeholder={`Selecione o ${getContraparteLabel().toLowerCase()}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(contrapartes) && contrapartes.map((contraparte: any) => (
                      <SelectItem key={contraparte.id} value={contraparte.id}>
                        {contraparte.name} {contraparte.document && `(${contraparte.document})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.contraparteId && (
                  <p className="text-sm text-red-500">{form.formState.errors.contraparteId.message}</p>
                )}
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label className="flex items-center">
                Descrição *
                {getSuggestionBadge('description')}
              </Label>
              <Textarea
                {...form.register("description")}
                placeholder="Descrição detalhada da transação"
                className={isFieldSuggested('description') ? 'border-[#E40064]/30 bg-[#E40064]/5' : ''}
                data-testid="textarea-description"
              />
              {form.formState.errors.description && (
                <p className="text-sm text-red-500">{form.formState.errors.description.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Campos Específicos por Tipo */}
        {(documentType === "PAGO" || documentType === "AGENDADO") && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
                <Calendar className="h-5 w-5 text-[#E40064]" />
                Datas BPO - {documentType}
                <Badge variant="destructive">Obrigatório</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {documentType === "PAGO" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data de Competência *</Label>
                    <Input
                      {...form.register("competenceDate")}
                      type="date"
                      data-testid="input-competence-date"
                    />
                    <p className="text-xs text-gray-600">
                      Quando a despesa/receita pertence (mês de competência)
                    </p>
                    {form.formState.errors.competenceDate && (
                      <p className="text-sm text-red-500">{form.formState.errors.competenceDate.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Data Real de Pagamento *</Label>
                    <Input
                      {...form.register("realPaidDate")}
                      type="date"
                      data-testid="input-real-paid-date"
                    />
                    <p className="text-xs text-gray-600">
                      Quando o pagamento foi realmente efetuado
                    </p>
                    {form.formState.errors.realPaidDate && (
                      <p className="text-sm text-red-500">{form.formState.errors.realPaidDate.message}</p>
                    )}
                  </div>
                </div>
              )}

              {documentType === "AGENDADO" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Data para Agendamento *</Label>
                    <Input
                      {...form.register("scheduledDate")}
                      type="date"
                      data-testid="input-scheduled-date"
                    />
                    <p className="text-xs text-gray-600">
                      Quando deve ser agendado o pagamento no banco
                    </p>
                    {form.formState.errors.scheduledDate && (
                      <p className="text-sm text-red-500">{form.formState.errors.scheduledDate.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Banco para Agendamento *</Label>
                    <Select onValueChange={(value) => form.setValue("bankId", value)}>
                      <SelectTrigger data-testid="select-bank">
                        <SelectValue placeholder="Selecione o banco" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(banks) && banks.map((bank: any) => (
                          <SelectItem key={bank.id} value={bank.id}>
                            {bank.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.bankId && (
                      <p className="text-sm text-red-500">{form.formState.errors.bankId.message}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Mostrar dados do documento para referência */}
              {documentMetadata && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="text-sm">
                      <strong>Dados do documento:</strong> Data {documentMetadata.documentDate}, Valor {documentMetadata.documentValue}
                      <br />
                      <em>Ajuste as datas acima conforme a realidade do BPO (podem ser diferentes do documento)</em>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Campos para Emissão de Boleto/NF */}
        {(documentType === "EMITIR_BOLETO" || documentType === "EMITIR_NF") && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
                <Building2 className="h-5 w-5 text-[#E40064]" />
                Dados do Tomador - {documentType}
                <Badge variant="destructive">Obrigatório</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CNPJ/CPF do Tomador *</Label>
                  <Input
                    {...form.register("payerDocument")}
                    placeholder="00.000.000/0000-00"
                    data-testid="input-payer-document"
                  />
                  {form.formState.errors.payerDocument && (
                    <p className="text-sm text-red-500">{form.formState.errors.payerDocument.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Nome/Razão Social *</Label>
                  <Input
                    {...form.register("payerName")}
                    placeholder="Nome completo ou razão social"
                    data-testid="input-payer-name"
                  />
                  {form.formState.errors.payerName && (
                    <p className="text-sm text-red-500">{form.formState.errors.payerName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    {...form.register("payerEmail")}
                    type="email"
                    placeholder="email@exemplo.com"
                    data-testid="input-payer-email"
                  />
                  {form.formState.errors.payerEmail && (
                    <p className="text-sm text-red-500">{form.formState.errors.payerEmail.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Endereço *</Label>
                  <Input
                    {...form.register("payerAddress")}
                    placeholder="Endereço completo"
                    data-testid="input-payer-address"
                  />
                  {form.formState.errors.payerAddress && (
                    <p className="text-sm text-red-500">{form.formState.errors.payerAddress.message}</p>
                  )}
                </div>
              </div>

              {documentType === "EMITIR_NF" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Código do Serviço *</Label>
                    <Input
                      {...form.register("serviceCode")}
                      placeholder="Código do serviço"
                      data-testid="input-service-code"
                    />
                    {form.formState.errors.serviceCode && (
                      <p className="text-sm text-red-500">{form.formState.errors.serviceCode.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição do Serviço *</Label>
                    <Textarea
                      {...form.register("serviceDescription")}
                      placeholder="Descrição detalhada do serviço"
                      data-testid="textarea-service-description"
                    />
                    {form.formState.errors.serviceDescription && (
                      <p className="text-sm text-red-500">{form.formState.errors.serviceDescription.message}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Dados Opcionais BPO */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
              <Building2 className="h-5 w-5 text-[#E40064]" />
              Informações Complementares
              <Badge variant="outline">Opcional</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Categoria */}
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select onValueChange={(value) => form.setValue("categoryId", value)}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(categories) && categories.map((category: any) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Centro de Custo */}
              <div className="space-y-2">
                <Label>Centro de Custo</Label>
                <Select onValueChange={(value) => form.setValue("costCenterId", value)}>
                  <SelectTrigger data-testid="select-cost-center">
                    <SelectValue placeholder="Selecione o centro de custo" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(costCenters) && costCenters.map((center: any) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                {...form.register("notes")}
                placeholder="Observações adicionais para o BPO"
                data-testid="textarea-notes"
              />
            </div>
          </CardContent>
        </Card>

        {/* Botão de Envio */}
        <Card>
          <CardContent className="pt-6">
            <Button
              type="submit"
              disabled={processingState.stage === 'processing' || processingState.stage === 'submitting'}
              className="w-full bg-[#E40064] hover:bg-[#E40064]/90 text-white"
              data-testid="button-submit"
            >
              {processingState.stage === 'submitting' ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Enviar para BPO Financeiro
                </>
              )}
            </Button>
          </CardContent>
        </Card>

      </form>

      {/* Modal de Auto-detecção de Fornecedor */}
      {autoSupplierModal.detectedSupplier && (
        <AutoSupplierModal
          open={autoSupplierModal.open}
          onOpenChange={(open) => setAutoSupplierModal({ ...autoSupplierModal, open })}
          detectedSupplier={autoSupplierModal.detectedSupplier}
          onSupplierCreated={handleSupplierCreated}
          onSkip={handleSupplierSkip}
        />
      )}
    </div>
  );
}