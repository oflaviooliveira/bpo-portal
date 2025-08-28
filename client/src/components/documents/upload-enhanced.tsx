import React, { useState, useCallback } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { CloudUpload, Upload as UploadIcon, Sparkles, Loader2, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Schema conforme especificação
const uploadSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório"),
  documentType: z.enum(["PAGO", "AGENDADO", "EMITIR_BOLETO", "EMITIR_NF"]),
  bankId: z.string().min(1, "Banco é obrigatório"),
  categoryId: z.string().min(1, "Categoria é obrigatória"),
  costCenterId: z.string().min(1, "Centro de custo é obrigatório"),
  amount: z.string().min(1, "Valor é obrigatório"),
  supplier: z.string().min(1, "Fornecedor é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  notes: z.string().optional(),
  // Campos condicionais
  paymentDate: z.string().optional(),
  dueDate: z.string().optional(),
  // Campos para boleto/NF
  payerDocument: z.string().optional(),
  payerName: z.string().optional(),
  payerAddress: z.string().optional(),
  payerEmail: z.string().optional(),
  serviceCode: z.string().optional(),
  serviceDescription: z.string().optional(),
  instructions: z.string().optional(),
});

type UploadData = z.infer<typeof uploadSchema>;

interface ProcessingState {
  stage: 'idle' | 'uploading' | 'processing' | 'suggesting' | 'ready' | 'submitting';
  message: string;
}

interface SuggestedField {
  field: string;
  value: string;
  confidence: number;
}

interface OcrPreview {
  text: string;
  confidence: number;
  strategy: string;
}

export function UploadEnhanced() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({ stage: 'idle', message: '' });
  const [suggestedFields, setSuggestedFields] = useState<SuggestedField[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [ocrPreview, setOcrPreview] = useState<OcrPreview | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
    control,
  } = useForm<UploadData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      documentType: "PAGO"
    }
  });

  const documentType = watch("documentType");

  // Buscar dados do sistema
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    enabled: true,
  });

  const { data: banks = [] } = useQuery<any[]>({
    queryKey: ["/api/banks"],
    enabled: true,
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/categories"],
    enabled: true,
  });

  const { data: costCenters = [] } = useQuery<any[]>({
    queryKey: ["/api/cost-centers"],
    enabled: true,
  });

  // Processar OCR+IA automaticamente
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
      setProcessingState({ stage: 'suggesting', message: 'Sugerindo campos com base na análise...' });
      
      // Mostrar preview do OCR se disponível
      if (data.ocrText && data.ocrText.length > 20) {
        setOcrPreview({
          text: data.ocrText,
          confidence: data.ocrResult?.confidence || 0,
          strategy: data.ocrResult?.strategy || 'unknown'
        });
      }
      
      // Simular delay para UX
      setTimeout(() => {
        // Auto-preencher campos sugeridos
        if (data.suggestions) {
          console.log("🎯 Recebendo sugestões:", data.suggestions);
          const suggestions: SuggestedField[] = [];
          
          if (data.suggestions.amount) {
            setValue("amount", data.suggestions.amount);
            suggestions.push({ field: 'amount', value: data.suggestions.amount, confidence: data.suggestions.confidence?.amount || 0.9 });
            console.log("💰 Valor preenchido:", data.suggestions.amount);
          }
          
          if (data.suggestions.supplier) {
            setValue("supplier", data.suggestions.supplier);
            suggestions.push({ field: 'supplier', value: data.suggestions.supplier, confidence: data.suggestions.confidence?.supplier || 0.8 });
            console.log("🏢 Fornecedor preenchido:", data.suggestions.supplier);
          }
          
          if (data.suggestions.description) {
            setValue("description", data.suggestions.description);
            suggestions.push({ field: 'description', value: data.suggestions.description, confidence: data.suggestions.confidence?.description || 0.75 });
            console.log("📝 Descrição preenchida:", data.suggestions.description);
          }
          
          if (data.suggestions.dueDate) {
            setValue("dueDate", data.suggestions.dueDate);
            suggestions.push({ field: 'dueDate', value: data.suggestions.dueDate, confidence: data.suggestions.confidence?.dueDate || 0.85 });
            console.log("📅 Data vencimento preenchida:", data.suggestions.dueDate);
          }
          
          if (data.suggestions.paymentDate) {
            setValue("paymentDate", data.suggestions.paymentDate);
            suggestions.push({ field: 'paymentDate', value: data.suggestions.paymentDate, confidence: data.suggestions.confidence?.paymentDate || 0.85 });
            console.log("💳 Data pagamento preenchida:", data.suggestions.paymentDate);
          }
          
          if (data.suggestions.documentType) {
            setValue("documentType", data.suggestions.documentType);
            console.log("📄 Tipo documento preenchido:", data.suggestions.documentType);
          }
          
          setSuggestedFields(suggestions);
          console.log("✅ Total de campos sugeridos:", suggestions.length);
        } else {
          console.log("⚠️ Nenhuma sugestão recebida do backend");
        }
        
        setProcessingState({ stage: 'ready', message: 'Documento analisado! Revise os campos sugeridos.' });
      }, 1500);
    },
    onError: (error) => {
      console.error("Erro no processamento:", error);
      setProcessingState({ stage: 'ready', message: 'Erro na análise. Preencha os campos manualmente.' });
      toast({
        title: "Aviso",
        description: "Não foi possível analisar automaticamente. Preencha os campos manualmente.",
        variant: "default",
      });
    }
  });

  // Upload final do documento
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro no upload');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log("✅ Documento processado:", data);
      
      if (data.inconsistencias && data.inconsistencias.length > 0) {
        toast({
          title: "Documento enviado com divergências",
          description: `Documento ${data.documentId} foi enviado para revisão devido a inconsistências detectadas.`,
        });
      } else {
        toast({
          title: "Documento processado com sucesso",
          description: `Documento ${data.documentId} foi processado e está no fluxo ${data.status_inicial}.`,
        });
      }
      
      // Limpar formulário
      reset();
      setSelectedFile(null);
      setSuggestedFields([]);
      setOcrPreview(null);
      setProcessingState({ stage: 'idle', message: '' });
      
      // Invalidar cache
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error: any) => {
      console.error("❌ Erro no upload:", error);
      toast({
        title: "Erro no processamento",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
      });
      setProcessingState({ stage: 'ready', message: 'Erro no envio. Tente novamente.' });
    },
  });

  // Drag & Drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  }, []);

  const handleFileSelect = (file: File) => {
    // Validar arquivo
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    
    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB",
        variant: "destructive",
      });
      return;
    }
    
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Formato não suportado",
        description: "Apenas PDF, JPG e PNG são aceitos",
        variant: "destructive",
      });
      return;
    }
    
    setSelectedFile(file);
    setProcessingState({ stage: 'processing', message: 'Lendo documento...' });
    
    // Iniciar processamento automático
    processFileMutation.mutate(file);
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const onSubmit = async (data: UploadData) => {
    if (!selectedFile) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo",
        variant: "destructive",
      });
      return;
    }

    setProcessingState({ stage: 'submitting', message: 'Processando documento...' });

    const formData = new FormData();
    formData.append("file", selectedFile);
    
    // Adicionar todos os campos do formulário
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        formData.append(key, value);
      }
    });

    uploadMutation.mutate(formData);
  };

  const isFieldSuggested = (fieldName: string) => {
    return suggestedFields.some(s => s.field === fieldName);
  };

  const getSuggestionBadge = (fieldName: string) => {
    const suggestion = suggestedFields.find(s => s.field === fieldName);
    if (!suggestion) return null;
    
    return (
      <Badge variant="secondary" className="ml-2 text-xs">
        <Sparkles className="h-3 w-3 mr-1" />
        Sugerido pela IA
      </Badge>
    );
  };

  // Determinar quais campos mostrar baseado no tipo
  const getConditionalFields = () => {
    switch (documentType) {
      case "PAGO":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="paymentDate" className="flex items-center">
                Data de Pagamento *
                {getSuggestionBadge('paymentDate')}
              </Label>
              <Input
                id="paymentDate"
                type="date"
                {...register("paymentDate")}
                className={isFieldSuggested('paymentDate') ? 'border-blue-300 bg-blue-50' : ''}
                data-testid="input-payment-date"
              />
              {errors.paymentDate && (
                <p className="text-sm text-red-600 mt-1">{errors.paymentDate.message}</p>
              )}
            </div>
          </div>
        );
        
      case "AGENDADO":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="dueDate" className="flex items-center">
                Data de Vencimento *
                {getSuggestionBadge('dueDate')}
              </Label>
              <Input
                id="dueDate"
                type="date"
                {...register("dueDate")}
                className={isFieldSuggested('dueDate') ? 'border-blue-300 bg-blue-50' : ''}
                data-testid="input-due-date"
              />
              {errors.dueDate && (
                <p className="text-sm text-red-600 mt-1">{errors.dueDate.message}</p>
              )}
            </div>
          </div>
        );
        
      case "EMITIR_BOLETO":
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="dueDate" className="flex items-center">
                Data de Vencimento *
                {getSuggestionBadge('dueDate')}
              </Label>
              <Input
                id="dueDate"
                type="date"
                {...register("dueDate")}
                className={isFieldSuggested('dueDate') ? 'border-blue-300 bg-blue-50' : ''}
                data-testid="input-due-date"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="payerDocument">CNPJ/CPF do Tomador *</Label>
                <Input
                  id="payerDocument"
                  {...register("payerDocument")}
                  placeholder="00.000.000/0000-00"
                  data-testid="input-payer-document"
                />
              </div>
              <div>
                <Label htmlFor="payerName">Nome/Razão Social *</Label>
                <Input
                  id="payerName"
                  {...register("payerName")}
                  placeholder="Nome do tomador"
                  data-testid="input-payer-name"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="payerAddress">Endereço Completo *</Label>
              <Input
                id="payerAddress"
                {...register("payerAddress")}
                placeholder="Rua, número, bairro, cidade, CEP"
                data-testid="input-payer-address"
              />
            </div>
            
            <div>
              <Label htmlFor="payerEmail">Email *</Label>
              <Input
                id="payerEmail"
                type="email"
                {...register("payerEmail")}
                placeholder="email@exemplo.com"
                data-testid="input-payer-email"
              />
            </div>
          </div>
        );
        
      case "EMITIR_NF":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="serviceCode">Código de Serviço *</Label>
                <Input
                  id="serviceCode"
                  {...register("serviceCode")}
                  placeholder="01.01"
                  data-testid="input-service-code"
                />
              </div>
              <div>
                <Label htmlFor="serviceDescription">Descrição do Serviço *</Label>
                <Input
                  id="serviceDescription"
                  {...register("serviceDescription")}
                  placeholder="Descrição detalhada"
                  data-testid="input-service-description"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="payerDocument">CNPJ/CPF do Tomador *</Label>
                <Input
                  id="payerDocument"
                  {...register("payerDocument")}
                  placeholder="00.000.000/0000-00"
                  data-testid="input-payer-document"
                />
              </div>
              <div>
                <Label htmlFor="payerName">Nome/Razão Social *</Label>
                <Input
                  id="payerName"
                  {...register("payerName")}
                  placeholder="Nome do tomador"
                  data-testid="input-payer-name"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="payerAddress">Endereço Completo *</Label>
              <Input
                id="payerAddress"
                {...register("payerAddress")}
                placeholder="Rua, número, bairro, cidade, CEP"
                data-testid="input-payer-address"
              />
            </div>
            
            <div>
              <Label htmlFor="payerEmail">Email *</Label>
              <Input
                id="payerEmail"
                type="email"
                {...register("payerEmail")}
                placeholder="email@exemplo.com"
                data-testid="input-payer-email"
              />
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Upload de Documentos</h1>
        <p className="text-muted-foreground">
          Envie seu documento e nossa IA irá pré-preencher os campos automaticamente
        </p>
      </div>

      {/* Drag & Drop Upload Area */}
      <Card className="relative">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? 'border-primary bg-primary/5'
              : selectedFile
              ? 'border-green-300 bg-green-50'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
          onDragEnter={handleDragIn}
          onDragLeave={handleDragOut}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {selectedFile ? (
            <div className="space-y-2">
              <FileText className="h-12 w-12 mx-auto text-green-600" />
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {Math.round(selectedFile.size / 1024)} KB
              </p>
              {processingState.stage !== 'idle' && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  {processingState.stage === 'processing' || processingState.stage === 'suggesting' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  <span className="text-sm text-muted-foreground">{processingState.message}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <CloudUpload className="h-16 w-16 mx-auto text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">Arraste seu documento aqui</p>
                <p className="text-muted-foreground">ou clique para selecionar</p>
              </div>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                data-testid="input-file-drop"
              />
            </div>
          )}
        </div>
      </Card>

      {/* Banner de Requisitos */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Formatos aceitos:</strong> PDF, JPG, PNG (máx. 10MB) • 
          <strong> Datas:</strong> DD/MM/AAAA • 
          <strong> Valores:</strong> R$ X,XX • 
          <strong> Dica:</strong> Nomeie o arquivo com dados do documento para melhor precisão
        </AlertDescription>
      </Alert>

      {/* OCR Preview */}
      {ocrPreview && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Texto Extraído do Documento
              <Badge variant={ocrPreview.confidence > 80 ? 'default' : ocrPreview.confidence > 50 ? 'secondary' : 'destructive'}>
                {Math.round(ocrPreview.confidence)}% confiança
              </Badge>
              <Badge variant="outline" className="text-xs">
                {ocrPreview.strategy}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 p-4 rounded-lg">
              <Textarea
                value={ocrPreview.text}
                readOnly
                rows={4}
                className="resize-none text-sm font-mono bg-transparent border-none shadow-none"
                placeholder="Texto extraído aparecerá aqui..."
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Este texto foi extraído automaticamente. Os campos abaixo foram preenchidos com base nesta análise.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Formulário */}
      {selectedFile && processingState.stage !== 'processing' && processingState.stage !== 'suggesting' && (
        <Card>
          <CardHeader>
            <CardTitle>Dados do Documento</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              
              {/* Campos Comuns */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientId">Cliente *</Label>
                  <Select onValueChange={(value) => setValue("clientId", value)}>
                    <SelectTrigger data-testid="select-client">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client: any) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.clientId && (
                    <p className="text-sm text-red-600 mt-1">{errors.clientId.message}</p>
                  )}
                </div>

                <div>
                  <Label>Tipo de Solicitação *</Label>
                  <RadioGroup
                    defaultValue="PAGO"
                    onValueChange={(value) => setValue("documentType", value as any)}
                    className="flex gap-4 mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="PAGO" id="pago" />
                      <Label htmlFor="pago">Pago (PG)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="AGENDADO" id="agendado" />
                      <Label htmlFor="agendado">Agendado (AGD)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="EMITIR_BOLETO" id="boleto" />
                      <Label htmlFor="boleto">Emitir Boleto</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="EMITIR_NF" id="nf" />
                      <Label htmlFor="nf">Emitir NF</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="bankId">Banco *</Label>
                  <Select onValueChange={(value) => setValue("bankId", value)}>
                    <SelectTrigger data-testid="select-bank">
                      <SelectValue placeholder="Selecione o banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((bank: any) => (
                        <SelectItem key={bank.id} value={bank.id}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.bankId && (
                    <p className="text-sm text-red-600 mt-1">{errors.bankId.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="categoryId">Categoria *</Label>
                  <Select onValueChange={(value) => setValue("categoryId", value)}>
                    <SelectTrigger data-testid="select-category">
                      <SelectValue placeholder="Selecione a categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category: any) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.categoryId && (
                    <p className="text-sm text-red-600 mt-1">{errors.categoryId.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="costCenterId">Centro de Custo *</Label>
                  <Select onValueChange={(value) => setValue("costCenterId", value)}>
                    <SelectTrigger data-testid="select-cost-center">
                      <SelectValue placeholder="Selecione o CC" />
                    </SelectTrigger>
                    <SelectContent>
                      {costCenters.map((cc: any) => (
                        <SelectItem key={cc.id} value={cc.id}>
                          {cc.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.costCenterId && (
                    <p className="text-sm text-red-600 mt-1">{errors.costCenterId.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="amount" className="flex items-center">
                    Valor *
                    {getSuggestionBadge('amount')}
                  </Label>
                  <Input
                    id="amount"
                    {...register("amount")}
                    placeholder="R$ 120,00"
                    className={isFieldSuggested('amount') ? 'border-blue-300 bg-blue-50' : ''}
                    data-testid="input-amount"
                  />
                  {errors.amount && (
                    <p className="text-sm text-red-600 mt-1">{errors.amount.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="supplier" className="flex items-center">
                    Fornecedor *
                    {getSuggestionBadge('supplier')}
                  </Label>
                  <Input
                    id="supplier"
                    {...register("supplier")}
                    placeholder="Uber, Posto Shell, Locadora X"
                    className={isFieldSuggested('supplier') ? 'border-blue-300 bg-blue-50' : ''}
                    data-testid="input-supplier"
                  />
                  {errors.supplier && (
                    <p className="text-sm text-red-600 mt-1">{errors.supplier.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="description" className="flex items-center">
                    Descrição *
                    {getSuggestionBadge('description')}
                  </Label>
                  <Input
                    id="description"
                    {...register("description")}
                    placeholder="Corrida 01/05 - Centro ao Aeroporto"
                    className={isFieldSuggested('description') ? 'border-blue-300 bg-blue-50' : ''}
                    data-testid="input-description"
                  />
                  {errors.description && (
                    <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
                  )}
                </div>
              </div>

              {/* Campos Condicionais */}
              {getConditionalFields()}

              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  {...register("notes")}
                  placeholder="Informações adicionais (opcional)"
                  data-testid="input-notes"
                />
              </div>

              {/* Ações */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    reset();
                    setSelectedFile(null);
                    setSuggestedFields([]);
                    setProcessingState({ stage: 'idle', message: '' });
                  }}
                  data-testid="button-cancel"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={processingState.stage === 'submitting' || Object.keys(errors).length > 0}
                  className="bg-[#E40064] hover:bg-[#E40064]/90"
                  data-testid="button-process"
                >
                  {processingState.stage === 'submitting' ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <UploadIcon className="h-4 w-4 mr-2" />
                      Processar Documento
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}