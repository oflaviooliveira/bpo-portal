import React, { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { CloudUpload, X, Upload as UploadIcon, AlertTriangle, Sparkles } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Validações conforme PRD - formatos DD/MM/AAAA e R$ X,XX
const dateRegex = /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
const moneyRegex = /^R\$\s?\d{1,3}(?:\.\d{3})*,\d{2}$/;

// Helper para validar datas no formato DD/MM/AAAA
const validateDate = (dateStr: string) => {
  if (!dateRegex.test(dateStr)) return false;
  const [day, month, year] = dateStr.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getDate() === day && date.getMonth() === month - 1 && date.getFullYear() === year;
};

// Helper para formatar valores em R$ X,XX
const formatCurrency = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (!numbers) return '';
  const amount = parseInt(numbers) / 100;
  return `R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper para formatar data DD/MM/AAAA
const formatDate = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 4) return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
};

// Schemas por tipo de documento conforme ajustes_upload.md
const baseSchema = z.object({
  clientId: z.string().uuid("Cliente é obrigatório"),
  documentType: z.enum(["PAGO", "AGENDADO", "EMITIR_BOLETO", "EMITIR_NF"]),
  bankId: z.string().uuid("Banco é obrigatório"),
  categoryId: z.string().uuid("Categoria é obrigatória"),
  costCenterId: z.string().uuid("Centro de Custo é obrigatório"),
  amount: z.string().refine((val) => moneyRegex.test(val), {
    message: "Valor deve estar no formato R$ X,XX",
  }),
  supplier: z.string().min(1, "Fornecedor/Descrição é obrigatório"),
  notes: z.string().optional(),
});

const pagoSchema = baseSchema.extend({
  documentType: z.literal("PAGO"),
  paymentDate: z.string().refine(validateDate, {
    message: "Data deve estar no formato DD/MM/AAAA",
  }),
});

const agendadoSchema = baseSchema.extend({
  documentType: z.literal("AGENDADO"),
  dueDate: z.string().refine(validateDate, {
    message: "Data deve estar no formato DD/MM/AAAA",
  }),
});

const boletoSchema = baseSchema.extend({
  documentType: z.literal("EMITIR_BOLETO"),
  dueDate: z.string().refine(validateDate, {
    message: "Data deve estar no formato DD/MM/AAAA",
  }),
  payerDocument: z.string().min(11, "CNPJ/CPF é obrigatório"),
  payerName: z.string().min(1, "Nome do tomador é obrigatório"),
  payerAddress: z.string().min(1, "Endereço é obrigatório"),
  payerEmail: z.string().email("Email inválido"),
});

const nfSchema = baseSchema.extend({
  documentType: z.literal("EMITIR_NF"),
  serviceCode: z.string().min(1, "Código de serviço é obrigatório"),
  serviceDescription: z.string().min(1, "Descrição do serviço é obrigatória"),
  payerDocument: z.string().min(11, "CNPJ/CPF é obrigatório"),
  payerName: z.string().min(1, "Nome do tomador é obrigatório"),
  payerAddress: z.string().min(1, "Endereço é obrigatório"),
  payerEmail: z.string().email("Email inválido"),
});

const uploadSchema = z.discriminatedUnion("documentType", [
  pagoSchema,
  agendadoSchema, 
  boletoSchema,
  nfSchema,
]);

type UploadFormData = z.infer<typeof uploadSchema>;

export function Upload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      clientId: "",
      documentType: "PAGO",
      bankId: "",
      categoryId: "",
      costCenterId: "",
      amount: "",
      supplier: "",
      notes: "",
    },
  });

  // Reset form when document type changes
  const watchedDocumentType = form.watch("documentType");
  React.useEffect(() => {
    const currentValues = form.getValues();
    form.reset({
      clientId: currentValues.clientId,
      documentType: watchedDocumentType,
      bankId: "",
      categoryId: "",
      costCenterId: "",
      amount: "",
      supplier: "",
      notes: "",
    });
  }, [watchedDocumentType, form]);

  // Data fetching
  const { data: clientList = [] } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: bankList = [] } = useQuery({
    queryKey: ["/api/banks"],
  });

  const { data: categoryList = [] } = useQuery({
    queryKey: ["/api/categories"],
  });

  const { data: costCenterList = [] } = useQuery({
    queryKey: ["/api/cost-centers"],
  });

  // AI Processing para pré-preenchimento
  const processFileWithAI = async (file: File) => {
    setIsProcessingAI(true);
    try {
      // Simular processamento de IA
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock de sugestões da IA baseado no nome do arquivo
      const fileName = file.name.toLowerCase();
      const suggestions = {
        amount: fileName.includes('uber') ? 'R$ 18,36' : 
                fileName.includes('ifood') ? 'R$ 45,90' : 'R$ 120,00',
        supplier: fileName.includes('uber') ? 'Uber' :
                  fileName.includes('ifood') ? 'iFood' : 'Fornecedor Identificado',
        paymentDate: '24/07/2025',
        dueDate: '30/07/2025',
      };
      
      setAiSuggestions(suggestions);
      
      // Pré-preencher campos com sugestões da IA
      form.setValue('amount', suggestions.amount);
      form.setValue('supplier', suggestions.supplier);
      if (watchedDocumentType === 'PAGO') {
        form.setValue('paymentDate', suggestions.paymentDate);
      } else if (watchedDocumentType === 'AGENDADO' || watchedDocumentType === 'EMITIR_BOLETO') {
        form.setValue('dueDate', suggestions.dueDate);
      }
      
      toast({
        title: "IA Processada",
        description: "Campos pré-preenchidos pela IA. Revise antes de confirmar.",
      });
    } catch (error) {
      console.error('Erro no processamento IA:', error);
    } finally {
      setIsProcessingAI(false);
    }
  };

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: UploadFormData & { file: File }) => {
      const formData = new FormData();
      formData.append("file", data.file);
      Object.entries(data).forEach(([key, value]) => {
        if (key !== "file" && value !== undefined) {
          formData.append(key, String(value));
        }
      });

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Erro no upload');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Documento enviado e processamento OCR + IA iniciado",
      });
      form.reset();
      setSelectedFile(null);
      setAiSuggestions(null);
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // File handlers
  const handleFileSelect = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB",
        variant: "destructive",
      });
      return;
    }

    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Apenas PDF, JPG e PNG são aceitos",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    await processFileWithAI(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const onSubmit = (data: UploadFormData) => {
    if (!selectedFile) {
      toast({
        title: "Arquivo obrigatório",
        description: "Selecione um arquivo para enviar",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({ ...data, file: selectedFile });
  };

  const renderConditionalFields = () => {
    switch (watchedDocumentType) {
      case "PAGO":
        return (
          <div className="space-y-2">
            <Label htmlFor="paymentDate">Data de Pagamento</Label>
            <Input
              id="paymentDate"
              placeholder="05/09/2025"
              value={form.watch("paymentDate") || ""}
              onChange={(e) => {
                const formatted = formatDate(e.target.value);
                form.setValue("paymentDate", formatted);
              }}
              className={aiSuggestions ? "bg-blue-50 border-blue-200" : ""}
              data-testid="input-payment-date"
            />
            {aiSuggestions && (
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Sugerido pela IA — revise antes de confirmar
              </p>
            )}
            {form.formState.errors.paymentDate && (
              <p className="text-sm text-red-600">{form.formState.errors.paymentDate.message}</p>
            )}
          </div>
        );

      case "AGENDADO":
        return (
          <div className="space-y-2">
            <Label htmlFor="dueDate">Data de Vencimento</Label>
            <Input
              id="dueDate"
              placeholder="30/09/2025"
              value={form.watch("dueDate") || ""}
              onChange={(e) => {
                const formatted = formatDate(e.target.value);
                form.setValue("dueDate", formatted);
              }}
              className={aiSuggestions ? "bg-blue-50 border-blue-200" : ""}
              data-testid="input-due-date"
            />
            {aiSuggestions && (
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Sugerido pela IA — revise antes de confirmar
              </p>
            )}
            {form.formState.errors.dueDate && (
              <p className="text-sm text-red-600">{form.formState.errors.dueDate.message}</p>
            )}
          </div>
        );

      case "EMITIR_BOLETO":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Data de Vencimento</Label>
              <Input
                id="dueDate"
                placeholder="30/09/2025"
                value={form.watch("dueDate") || ""}
                onChange={(e) => {
                  const formatted = formatDate(e.target.value);
                  form.setValue("dueDate", formatted);
                }}
                data-testid="input-due-date"
              />
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Dados do Tomador</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payerDocument">CNPJ/CPF</Label>
                  <Input
                    id="payerDocument"
                    placeholder="00.000.000/0000-00"
                    {...form.register("payerDocument")}
                    data-testid="input-payer-document"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerName">Nome/Razão Social</Label>
                  <Input
                    id="payerName"
                    placeholder="Nome do tomador"
                    {...form.register("payerName")}
                    data-testid="input-payer-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerAddress">Endereço</Label>
                  <Input
                    id="payerAddress"
                    placeholder="Endereço completo"
                    {...form.register("payerAddress")}
                    data-testid="input-payer-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerEmail">Email</Label>
                  <Input
                    id="payerEmail"
                    type="email"
                    placeholder="email@exemplo.com"
                    {...form.register("payerEmail")}
                    data-testid="input-payer-email"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case "EMITIR_NF":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceCode">Código de Serviço</Label>
                <Input
                  id="serviceCode"
                  placeholder="01.01"
                  {...form.register("serviceCode")}
                  data-testid="input-service-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serviceDescription">Descrição do Serviço</Label>
                <Input
                  id="serviceDescription"
                  placeholder="Consultoria em TI"
                  {...form.register("serviceDescription")}
                  data-testid="input-service-description"
                />
              </div>
            </div>
            
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Dados do Tomador</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payerDocument">CNPJ/CPF</Label>
                  <Input
                    id="payerDocument"
                    placeholder="00.000.000/0000-00"
                    {...form.register("payerDocument")}
                    data-testid="input-payer-document"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerName">Nome/Razão Social</Label>
                  <Input
                    id="payerName"
                    placeholder="Nome do tomador"
                    {...form.register("payerName")}
                    data-testid="input-payer-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerAddress">Endereço</Label>
                  <Input
                    id="payerAddress"
                    placeholder="Endereço completo"
                    {...form.register("payerAddress")}
                    data-testid="input-payer-address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payerEmail">Email</Label>
                  <Input
                    id="payerEmail"
                    type="email"
                    placeholder="email@exemplo.com"
                    {...form.register("payerEmail")}
                    data-testid="input-payer-email"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="font-gilroy font-bold text-2xl text-foreground">
            Upload de Documentos
          </CardTitle>
          <p className="text-muted-foreground">
            Envie seus documentos financeiros. A IA analisará e pré-preencherá os campos automaticamente.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver 
                ? "border-gquicks-primary bg-gquicks-primary/5" 
                : "border-gray-300 hover:border-gquicks-primary"
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            data-testid="upload-dropzone"
          >
            {selectedFile ? (
              <div className="flex items-center justify-center space-x-4">
                <div className="flex items-center space-x-2">
                  <UploadIcon className="w-5 h-5 text-green-600" />
                  <span className="font-medium">{selectedFile.name}</span>
                  <span className="text-sm text-gray-500">
                    ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedFile(null);
                    setAiSuggestions(null);
                  }}
                  data-testid="button-remove-file"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <CloudUpload className="w-12 h-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-lg font-medium">Arraste um arquivo aqui</p>
                  <p className="text-sm text-gray-500">ou clique para selecionar</p>
                </div>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileInput}
                  className="hidden"
                  id="file-input"
                  data-testid="input-file"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('file-input')?.click()}
                  data-testid="button-select-file"
                >
                  Selecionar Arquivo
                </Button>
                <p className="text-xs text-gray-500">
                  PDF, JPG ou PNG • Máximo 10MB
                </p>
              </div>
            )}
          </div>

          {/* AI Processing Indicator */}
          {isProcessingAI && (
            <Alert>
              <Sparkles className="h-4 w-4" />
              <AlertDescription>
                🤖 IA analisando documento... Aguarde o pré-preenchimento dos campos.
              </AlertDescription>
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Document Type Selection */}
            <div className="space-y-3">
              <Label>Tipo de Solicitação</Label>
              <RadioGroup
                value={watchedDocumentType}
                onValueChange={(value) => form.setValue("documentType", value as any)}
                className="grid grid-cols-2 md:grid-cols-4 gap-4"
                data-testid="radio-document-type"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PAGO" id="pago" />
                  <Label htmlFor="pago">Pago</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="AGENDADO" id="agendado" />
                  <Label htmlFor="agendado">Agendado</Label>
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

            {/* Common Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Cliente</Label>
                <Select onValueChange={(value) => form.setValue("clientId", value)}>
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clientList as any[])?.map((client: any) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bankId">Banco</Label>
                <Select onValueChange={(value) => form.setValue("bankId", value)}>
                  <SelectTrigger data-testid="select-bank">
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    {(bankList as any[])?.map((bank: any) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoryId">Categoria</Label>
                <Select onValueChange={(value) => form.setValue("categoryId", value)}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {(categoryList as any[])?.map((category: any) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="costCenterId">Centro de Custo</Label>
                <Select onValueChange={(value) => form.setValue("costCenterId", value)}>
                  <SelectTrigger data-testid="select-cost-center">
                    <SelectValue placeholder="Selecione o centro de custo" />
                  </SelectTrigger>
                  <SelectContent>
                    {(costCenterList as any[])?.map((costCenter: any) => (
                      <SelectItem key={costCenter.id} value={costCenter.id}>
                        {costCenter.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Valor</Label>
                <Input
                  id="amount"
                  placeholder="R$ 120,00"
                  value={form.watch("amount") || ""}
                  onChange={(e) => {
                    const formatted = formatCurrency(e.target.value);
                    form.setValue("amount", formatted);
                  }}
                  className={aiSuggestions ? "bg-blue-50 border-blue-200" : ""}
                  data-testid="input-amount"
                />
                {aiSuggestions && (
                  <p className="text-xs text-blue-600 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Sugerido pela IA — revise antes de confirmar
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier">Fornecedor/Descrição</Label>
                <Input
                  id="supplier"
                  placeholder="Uber"
                  value={form.watch("supplier") || ""}
                  onChange={(e) => form.setValue("supplier", e.target.value)}
                  className={aiSuggestions ? "bg-blue-50 border-blue-200" : ""}
                  data-testid="input-supplier"
                />
                {aiSuggestions && (
                  <p className="text-xs text-blue-600 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Sugerido pela IA — revise antes de confirmar
                  </p>
                )}
              </div>
            </div>

            {/* Conditional Fields */}
            {renderConditionalFields()}

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Informações adicionais sobre o documento..."
                {...form.register("notes")}
                data-testid="textarea-notes"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={uploadMutation.isPending || !selectedFile}
              className="w-full bg-gquicks-primary hover:bg-gquicks-primary/90 text-white font-medium py-3"
              data-testid="button-process-document"
            >
              {uploadMutation.isPending ? (
                "Processando..."
              ) : (
                "Processar Documento"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}