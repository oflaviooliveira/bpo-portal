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

// Schema de validação inteligente
const bpoUploadSchema = z.object({
  // Seleção de tipo
  documentType: z.enum(["PAGO", "AGENDADO", "EMITIR_BOLETO", "EMITIR_NF"]),
  
  // Dados básicos sempre obrigatórios
  clientId: z.string().min(1, "Cliente é obrigatório"),
  amount: z.string().min(1, "Valor é obrigatório"),
  supplier: z.string().min(1, "Fornecedor/Descrição é obrigatório"),
  description: z.string().optional(),
  
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({ 
    stage: 'ready', 
    message: 'Selecione um arquivo para começar' 
  });
  const [suggestions, setSuggestions] = useState<DocumentSuggestion[]>([]);
  const [documentMetadata, setDocumentMetadata] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<BpoUploadData>({
    resolver: zodResolver(bpoUploadSchema),
    defaultValues: {
      documentType: "PAGO",
      clientId: "",
      amount: "",
      supplier: "",
      description: "",
      notes: "",
    },
  });

  const documentType = form.watch("documentType");
  const needsDocument = documentType === "PAGO" || documentType === "AGENDADO";

  // Buscar dados do sistema
  const { data: clients = [] as any[] } = useQuery({ queryKey: ["/api/clients"] });
  const { data: banks = [] as any[] } = useQuery({ queryKey: ["/api/banks"] });
  const { data: categories = [] as any[] } = useQuery({ queryKey: ["/api/categories"] });
  const { data: costCenters = [] as any[] } = useQuery({ queryKey: ["/api/cost-centers"] });

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
      
      // Mapear sugestões da IA
      const newSuggestions: DocumentSuggestion[] = [];
      
      if (data.amount) {
        newSuggestions.push({
          field: "amount",
          value: data.amount,
          confidence: data.confidence?.amount || 95,
          source: "IA"
        });
      }
      
      if (data.supplier) {
        newSuggestions.push({
          field: "supplier", 
          value: data.supplier,
          confidence: data.confidence?.supplier || 95,
          source: "IA"
        });
      }
      
      if (data.description) {
        newSuggestions.push({
          field: "description",
          value: data.description,
          confidence: data.confidence?.description || 95,
          source: "IA"
        });
      }
      
      // Pré-preencher campos com sugestões
      form.setValue("amount", data.amount || "");
      form.setValue("supplier", data.supplier || "");
      form.setValue("description", data.description || "");
      
      // Salvar metadados do documento para referência
      setDocumentMetadata({
        documentDate: data.paymentDate || data.dueDate,
        documentValue: data.amount,
        ocrQuality: data.qualityMetadata?.ocrQuality,
        confidence: data.confidence
      });
      
      setSuggestions(newSuggestions);
      setProcessingState({ 
        stage: 'analyzed', 
        message: `IA analisou o documento com ${Math.round((data.confidence?.amount || 95))}% de precisão` 
      });
      
      toast({
        title: "Documento processado com sucesso",
        description: `IA identificou ${newSuggestions.length} campos automaticamente`,
      });
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

  // Mutation para upload final
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro no upload');
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
      
      toast({
        title: "Erro no envio",
        description: error.message || "Verifique os campos obrigatórios",
        variant: "destructive",
      });
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
    
    // Adicionar todos os campos do formulário
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        formData.append(key, String(value));
      }
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

  const isFieldSuggested = (fieldName: string) => {
    return suggestions.some(s => s.field === fieldName);
  };

  // Reset form when document type changes
  useEffect(() => {
    const currentValues = form.getValues();
    form.reset({
      documentType: currentValues.documentType,
      clientId: currentValues.clientId,
      amount: currentValues.amount,
      supplier: currentValues.supplier,
      description: currentValues.description,
    });
  }, [documentType, form]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-[#E40064]/20">
        <CardHeader className="bg-gradient-to-r from-[#E40064]/5 to-[#0B0E30]/5">
          <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
            <CloudUpload className="h-5 w-5 text-[#E40064]" />
            Upload de Documentos BPO
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
            
            {/* Cliente */}
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select onValueChange={(value) => form.setValue("clientId", value)}>
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(clients) && clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.clientId && (
                <p className="text-sm text-red-500">{form.formState.errors.clientId.message}</p>
              )}
            </div>

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

              {/* Fornecedor */}
              <div className="space-y-2">
                <Label className="flex items-center">
                  Fornecedor/Descrição *
                  {getSuggestionBadge('supplier')}
                </Label>
                <Input
                  {...form.register("supplier")}
                  placeholder="Nome do fornecedor"
                  className={isFieldSuggested('supplier') ? 'border-[#E40064]/30 bg-[#E40064]/5' : ''}
                  data-testid="input-supplier"
                />
                {form.formState.errors.supplier && (
                  <p className="text-sm text-red-500">{form.formState.errors.supplier.message}</p>
                )}
              </div>
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label className="flex items-center">
                Descrição
                {getSuggestionBadge('description')}
              </Label>
              <Textarea
                {...form.register("description")}
                placeholder="Descrição detalhada"
                className={isFieldSuggested('description') ? 'border-[#E40064]/30 bg-[#E40064]/5' : ''}
                data-testid="textarea-description"
              />
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
    </div>
  );
}