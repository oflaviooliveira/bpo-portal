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
import { CloudUpload, X, Upload as UploadIcon, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
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

// Função para validar nome do arquivo conforme PRD (pipe, underscore, híbrido)
const validateFileName = (fileName: string) => {
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
  
  // Padrões aceitos conforme PRD
  const pipePattern = /\|/;
  const underscorePattern = /_/;
  
  // Validação de padrão estruturado
  const hasStructure = pipePattern.test(nameWithoutExt) || underscorePattern.test(nameWithoutExt);
  
  if (!hasStructure) {
    return {
      isValid: false,
      warning: "Nome do arquivo não segue padrão recomendado. Use pipe (|) ou underscore (_) para separar informações. Ex: 'data_valor_fornecedor.pdf' ou 'data|valor|fornecedor.pdf'"
    };
  }
  
  // Tentar extrair informações do nome do arquivo
  const extracted: any = {};
  
  // Buscar por padrões de data (DD/MM/AAAA ou DD-MM-AAAA)
  const datePattern = /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/;
  const dateMatch = nameWithoutExt.match(datePattern);
  if (dateMatch) {
    extracted.date = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
  }
  
  // Buscar por padrões de valor (R$, valores decimais)
  const valuePattern = /R?\$?\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?)/;
  const valueMatch = nameWithoutExt.match(valuePattern);
  if (valueMatch) {
    extracted.amount = valueMatch[1].replace(',', '.');
  }
  
  // Buscar por indicadores de status
  if (/\b(?:pago?|pg)\b/i.test(nameWithoutExt)) extracted.type = 'PAGO';
  if (/\b(?:agendado?|agd)\b/i.test(nameWithoutExt)) extracted.type = 'AGENDADO';
  if (/\b(?:boleto)\b/i.test(nameWithoutExt)) extracted.type = 'EMITIR_BOLETO';
  if (/\b(?:nf|nota)\b/i.test(nameWithoutExt)) extracted.type = 'EMITIR_NF';
  
  return {
    isValid: true,
    extracted,
    warning: null
  };
};

// Schemas dinâmicos conforme PRD
const baseUploadSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório"),
  documentType: z.enum(["PAGO", "AGENDADO", "EMITIR_BOLETO", "EMITIR_NF"], {
    required_error: "Tipo de solicitação é obrigatório",
  }),
});

const pagoSchema = baseUploadSchema.extend({
  documentType: z.literal("PAGO"),
  bankId: z.string().min(1, "Banco é obrigatório para pagamentos"),
  categoryId: z.string().min(1, "Categoria é obrigatória"),
  amount: z.string()
    .min(1, "Valor é obrigatório")
    .refine((val) => moneyRegex.test(val), "Valor deve estar no formato R$ X,XX"),
  paymentDate: z.string()
    .min(1, "Data de pagamento é obrigatória")
    .refine((val) => validateDate(val), "Data deve estar no formato DD/MM/AAAA"),
  supplier: z.string().min(1, "Fornecedor/Descrição é obrigatório"),
  costCenterId: z.string().optional(),
  notes: z.string().optional(),
});

const agendadoSchema = baseUploadSchema.extend({
  documentType: z.literal("AGENDADO"),
  bankId: z.string().min(1, "Banco é obrigatório para agendamentos"),
  amount: z.string()
    .min(1, "Valor é obrigatório")
    .refine((val) => moneyRegex.test(val), "Valor deve estar no formato R$ X,XX"),
  dueDate: z.string()
    .min(1, "Data de vencimento é obrigatória")
    .refine((val) => validateDate(val), "Data deve estar no formato DD/MM/AAAA"),
  beneficiary: z.string().min(1, "Favorecido é obrigatório"),
  bankCode: z.string().optional(),
  instructions: z.string().optional(),
  costCenterId: z.string().optional(),
  notes: z.string().optional(),
});

const boletoSchema = baseUploadSchema.extend({
  documentType: z.literal("EMITIR_BOLETO"),
  amount: z.string()
    .min(1, "Valor é obrigatório")
    .refine((val) => moneyRegex.test(val), "Valor deve estar no formato R$ X,XX"),
  dueDate: z.string()
    .min(1, "Data de vencimento é obrigatória")
    .refine((val) => validateDate(val), "Data deve estar no formato DD/MM/AAAA"),
  payerDocument: z.string().min(1, "CNPJ/CPF do tomador é obrigatório"),
  payerName: z.string().min(1, "Nome do tomador é obrigatório"),
  payerAddress: z.string().min(1, "Endereço é obrigatório"),
  payerEmail: z.string().email("Email inválido").min(1, "Email é obrigatório"),
  instructions: z.string().optional(),
  notes: z.string().optional(),
});

const nfSchema = baseUploadSchema.extend({
  documentType: z.literal("EMITIR_NF"),
  amount: z.string()
    .min(1, "Valor é obrigatório")
    .refine((val) => moneyRegex.test(val), "Valor deve estar no formato R$ X,XX"),
  serviceCode: z.string().min(1, "Código de serviço é obrigatório"),
  serviceDescription: z.string().min(1, "Descrição do serviço é obrigatória"),
  payerDocument: z.string().min(1, "CNPJ/CPF do tomador é obrigatório"),
  payerName: z.string().min(1, "Nome do tomador é obrigatório"),
  payerAddress: z.string().min(1, "Endereço é obrigatório"),
  payerEmail: z.string().email("Email inválido").min(1, "Email é obrigatório"),
  notes: z.string().optional(),
});

const uploadSchema = z.discriminatedUnion("documentType", [
  pagoSchema,
  agendadoSchema, 
  boletoSchema,
  nfSchema,
]);

type UploadFormData = z.infer<typeof uploadSchema>;

export function UploadOld() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileNameWarning, setFileNameWarning] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      clientId: "",
      documentType: "PAGO",
    },
  });

  // Reset form when document type changes
  const watchedDocumentType = form.watch("documentType");
  React.useEffect(() => {
    const currentClientId = form.getValues("clientId");
    form.reset({
      clientId: currentClientId,
      documentType: watchedDocumentType,
    } as any);
  }, [watchedDocumentType, form]);

  // Data fetching
  const { data: clientList = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/clients");
      return response.json();
    }
  });

  const { data: bankList = [] } = useQuery({
    queryKey: ["/api/banks"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/banks");
      return response.json();
    }
  });

  const { data: categoryList = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/categories");
      return response.json();
    }
  });

  const { data: costCenterList = [] } = useQuery({
    queryKey: ["/api/cost-centers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/cost-centers");
      return response.json();
    }
  });

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
        throw new Error(await response.text());
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
      setFileNameWarning(null);
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error) => {
      toast({
        title: "Erro no upload",
        description: error.message || "Erro ao processar documento",
        variant: "destructive",
      });
    },
  });

  // File handling
  const handleFileSelect = (file: File) => {
    // Validar tipo de arquivo
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Arquivo inválido",
        description: "Apenas PDF, JPG e PNG são aceitos conforme PRD",
        variant: "destructive",
      });
      return;
    }

    // Validar tamanho (10MB conforme PRD)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "Tamanho máximo: 10MB conforme PRD",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);

    // Validar nome do arquivo conforme PRD
    const validation = validateFileName(file.name);
    if (!validation.isValid) {
      setFileNameWarning(validation.warning!);
    } else {
      setFileNameWarning(null);
      
      // Auto-preencher campos baseado no nome do arquivo conforme PRD
      if (validation.extracted) {
        const { extracted } = validation;
        
        if (extracted.type) {
          form.setValue("documentType", extracted.type);
        }
        
        if (extracted.amount) {
          const formattedAmount = formatCurrency(extracted.amount);
          form.setValue("amount" as any, formattedAmount);
        }
        
        if (extracted.date) {
          if (extracted.type === 'PAGO') {
            form.setValue("paymentDate" as any, extracted.date);
          } else if (extracted.type === 'AGENDADO' || extracted.type === 'EMITIR_BOLETO') {
            form.setValue("dueDate" as any, extracted.date);
          }
        }
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const onSubmit = (data: UploadFormData) => {
    if (!selectedFile) {
      toast({
        title: "Arquivo obrigatório",
        description: "Selecione um arquivo para upload conforme PRD",
        variant: "destructive",
      });
      return;
    }

    uploadMutation.mutate({ ...data, file: selectedFile });
  };

  // Renderização dinâmica de campos baseada no tipo de documento
  const renderDynamicFields = () => {
    const documentType = form.watch("documentType");

    switch (documentType) {
      case "PAGO":
        return (
          <>
            {/* Banco - obrigatório para PAGO */}
            <div className="space-y-2">
              <Label htmlFor="bankId">Banco *</Label>
              <Select 
                onValueChange={(value) => form.setValue("bankId" as any, value)}
                value={form.watch("bankId" as any) || ""}
              >
                <SelectTrigger data-testid="select-bank">
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  {(bankList as any[]).map((bank: any) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(form.formState.errors as any).bankId && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).bankId.message}</p>
              )}
            </div>

            {/* Categoria - obrigatória para PAGO */}
            <div className="space-y-2">
              <Label htmlFor="categoryId">Categoria *</Label>
              <Select 
                onValueChange={(value) => form.setValue("categoryId" as any, value)}
                value={form.watch("categoryId" as any) || ""}
              >
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {(categoryList as any[]).map((category: any) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(form.formState.errors as any).categoryId && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).categoryId.message}</p>
              )}
            </div>

            {/* Valor - obrigatório com formatação R$ X,XX */}
            <div className="space-y-2">
              <Label htmlFor="amount">Valor * (formato: R$ X,XX)</Label>
              <Input
                id="amount"
                placeholder="R$ 1.500,00"
                value={form.watch("amount" as any) || ''}
                onChange={(e) => {
                  const formatted = formatCurrency(e.target.value);
                  form.setValue("amount" as any, formatted);
                }}
                data-testid="input-amount"
              />
              {(form.formState.errors as any).amount && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).amount.message}</p>
              )}
            </div>

            {/* Data de Pagamento - obrigatória no formato DD/MM/AAAA */}
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Data de Pagamento * (DD/MM/AAAA)</Label>
              <Input
                id="paymentDate"
                placeholder="DD/MM/AAAA"
                value={form.watch("paymentDate" as any) || ''}
                onChange={(e) => {
                  const formatted = formatDate(e.target.value);
                  form.setValue("paymentDate" as any, formatted);
                }}
                data-testid="input-payment-date"
              />
              {(form.formState.errors as any).paymentDate && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).paymentDate.message}</p>
              )}
            </div>

            {/* Fornecedor/Descrição - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="supplier">Fornecedor/Descrição *</Label>
              <Input
                id="supplier"
                placeholder="Nome do fornecedor ou descrição do pagamento"
                {...form.register("supplier" as any)}
                data-testid="input-supplier"
              />
              {(form.formState.errors as any).supplier && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).supplier.message}</p>
              )}
            </div>

            {/* Centro de Custo - opcional */}
            <div className="space-y-2">
              <Label htmlFor="costCenterId">Centro de Custo</Label>
              <Select 
                onValueChange={(value) => form.setValue("costCenterId" as any, value)}
                value={form.watch("costCenterId" as any) || ""}
              >
                <SelectTrigger data-testid="select-cost-center">
                  <SelectValue placeholder="Selecione o centro de custo" />
                </SelectTrigger>
                <SelectContent>
                  {(costCenterList as any[]).map((costCenter: any) => (
                    <SelectItem key={costCenter.id} value={costCenter.id}>
                      {costCenter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        );

      case "AGENDADO":
        return (
          <>
            {/* Banco - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="bankId">Banco *</Label>
              <Select 
                onValueChange={(value) => form.setValue("bankId" as any, value)}
                value={form.watch("bankId" as any) || ""}
              >
                <SelectTrigger data-testid="select-bank">
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  {(bankList as any[]).map((bank: any) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(form.formState.errors as any).bankId && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).bankId.message}</p>
              )}
            </div>

            {/* Valor - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="amount">Valor * (formato: R$ X,XX)</Label>
              <Input
                id="amount"
                placeholder="R$ 1.500,00"
                value={form.watch("amount" as any) || ''}
                onChange={(e) => {
                  const formatted = formatCurrency(e.target.value);
                  form.setValue("amount" as any, formatted);
                }}
                data-testid="input-amount"
              />
              {form.formState.errors.amount && (
                <p className="text-destructive text-sm">{form.formState.errors.amount.message}</p>
              )}
            </div>

            {/* Data de Vencimento - obrigatória */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Data de Vencimento * (DD/MM/AAAA)</Label>
              <Input
                id="dueDate"
                placeholder="DD/MM/AAAA"
                value={form.watch("dueDate" as any) || ''}
                onChange={(e) => {
                  const formatted = formatDate(e.target.value);
                  form.setValue("dueDate" as any, formatted);
                }}
                data-testid="input-due-date"
              />
              {(form.formState.errors as any).dueDate && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).dueDate.message}</p>
              )}
            </div>

            {/* Favorecido - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="beneficiary">Favorecido *</Label>
              <Input
                id="beneficiary"
                placeholder="Nome do favorecido"
                {...form.register("beneficiary" as any)}
                data-testid="input-beneficiary"
              />
              {(form.formState.errors as any).beneficiary && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).beneficiary.message}</p>
              )}
            </div>

            {/* Código do Banco - opcional */}
            <div className="space-y-2">
              <Label htmlFor="bankCode">Código do Banco</Label>
              <Input
                id="bankCode"
                placeholder="Ex: 341, 237"
                {...form.register("bankCode" as any)}
                data-testid="input-bank-code"
              />
            </div>

            {/* Instruções - opcional */}
            <div className="space-y-2">
              <Label htmlFor="instructions">Instruções</Label>
              <Textarea
                id="instructions"
                rows={3}
                placeholder="Instruções específicas para o agendamento"
                {...form.register("instructions" as any)}
                data-testid="textarea-instructions"
              />
            </div>

            {/* Centro de Custo - opcional */}
            <div className="space-y-2">
              <Label htmlFor="costCenterId">Centro de Custo</Label>
              <Select 
                onValueChange={(value) => form.setValue("costCenterId" as any, value)}
                value={form.watch("costCenterId" as any) || ""}
              >
                <SelectTrigger data-testid="select-cost-center">
                  <SelectValue placeholder="Selecione o centro de custo" />
                </SelectTrigger>
                <SelectContent>
                  {(costCenterList as any[]).map((costCenter: any) => (
                    <SelectItem key={costCenter.id} value={costCenter.id}>
                      {costCenter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        );

      case "EMITIR_BOLETO":
        return (
          <>
            {/* Valor - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="amount">Valor * (formato: R$ X,XX)</Label>
              <Input
                id="amount"
                placeholder="R$ 1.500,00"
                value={form.watch("amount" as any) || ''}
                onChange={(e) => {
                  const formatted = formatCurrency(e.target.value);
                  form.setValue("amount" as any, formatted);
                }}
                data-testid="input-amount"
              />
              {form.formState.errors.amount && (
                <p className="text-destructive text-sm">{form.formState.errors.amount.message}</p>
              )}
            </div>

            {/* Data de Vencimento - obrigatória */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Data de Vencimento * (DD/MM/AAAA)</Label>
              <Input
                id="dueDate"
                placeholder="DD/MM/AAAA"
                value={form.watch("dueDate" as any) || ''}
                onChange={(e) => {
                  const formatted = formatDate(e.target.value);
                  form.setValue("dueDate" as any, formatted);
                }}
                data-testid="input-due-date"
              />
              {(form.formState.errors as any).dueDate && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).dueDate.message}</p>
              )}
            </div>

            {/* CNPJ/CPF do Tomador - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="payerDocument">CNPJ/CPF do Tomador *</Label>
              <Input
                id="payerDocument"
                placeholder="00.000.000/0000-00 ou 000.000.000-00"
                {...form.register("payerDocument" as any)}
                data-testid="input-payer-document"
              />
              {(form.formState.errors as any).payerDocument && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).payerDocument?.message}</p>
              )}
            </div>

            {/* Nome do Tomador - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="payerName">Nome do Tomador *</Label>
              <Input
                id="payerName"
                placeholder="Nome completo ou razão social"
                {...form.register("payerName" as any)}
                data-testid="input-payer-name"
              />
              {(form.formState.errors as any).payerName && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).payerName?.message}</p>
              )}
            </div>

            {/* Endereço - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="payerAddress">Endereço *</Label>
              <Input
                id="payerAddress"
                placeholder="Endereço completo"
                {...form.register("payerAddress" as any)}
                data-testid="input-payer-address"
              />
              {(form.formState.errors as any).payerAddress && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).payerAddress?.message}</p>
              )}
            </div>

            {/* Email - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="payerEmail">Email *</Label>
              <Input
                id="payerEmail"
                type="email"
                placeholder="email@exemplo.com"
                {...form.register("payerEmail" as any)}
                data-testid="input-payer-email"
              />
              {(form.formState.errors as any).payerEmail && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).payerEmail?.message}</p>
              )}
            </div>

            {/* Instruções - opcional */}
            <div className="space-y-2">
              <Label htmlFor="instructions">Instruções</Label>
              <Textarea
                id="instructions"
                rows={3}
                placeholder="Instruções específicas para o boleto"
                {...form.register("instructions" as any)}
                data-testid="textarea-instructions"
              />
            </div>
          </>
        );

      case "EMITIR_NF":
        return (
          <>
            {/* Valor - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="amount">Valor * (formato: R$ X,XX)</Label>
              <Input
                id="amount"
                placeholder="R$ 1.500,00"
                value={form.watch("amount" as any) || ''}
                onChange={(e) => {
                  const formatted = formatCurrency(e.target.value);
                  form.setValue("amount" as any, formatted);
                }}
                data-testid="input-amount"
              />
              {form.formState.errors.amount && (
                <p className="text-destructive text-sm">{form.formState.errors.amount.message}</p>
              )}
            </div>

            {/* Código de Serviço - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="serviceCode">Código de Serviço *</Label>
              <Input
                id="serviceCode"
                placeholder="Ex: 14.01, 17.05"
                {...form.register("serviceCode" as any)}
                data-testid="input-service-code"
              />
              {(form.formState.errors as any).serviceCode && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).serviceCode.message}</p>
              )}
            </div>

            {/* Descrição do Serviço - obrigatória */}
            <div className="space-y-2">
              <Label htmlFor="serviceDescription">Descrição do Serviço *</Label>
              <Textarea
                id="serviceDescription"
                rows={3}
                placeholder="Descrição detalhada do serviço prestado"
                {...form.register("serviceDescription" as any)}
                data-testid="textarea-service-description"
              />
              {(form.formState.errors as any).serviceDescription && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).serviceDescription.message}</p>
              )}
            </div>

            {/* CNPJ/CPF do Tomador - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="payerDocument">CNPJ/CPF do Tomador *</Label>
              <Input
                id="payerDocument"
                placeholder="00.000.000/0000-00 ou 000.000.000-00"
                {...form.register("payerDocument" as any)}
                data-testid="input-payer-document"
              />
              {(form.formState.errors as any).payerDocument && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).payerDocument.message}</p>
              )}
            </div>

            {/* Nome do Tomador - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="payerName">Nome do Tomador *</Label>
              <Input
                id="payerName"
                placeholder="Nome completo ou razão social"
                {...form.register("payerName" as any)}
                data-testid="input-payer-name"
              />
              {(form.formState.errors as any).payerName && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).payerName.message}</p>
              )}
            </div>

            {/* Endereço - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="payerAddress">Endereço *</Label>
              <Input
                id="payerAddress"
                placeholder="Endereço completo"
                {...form.register("payerAddress" as any)}
                data-testid="input-payer-address"
              />
              {(form.formState.errors as any).payerAddress && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).payerAddress.message}</p>
              )}
            </div>

            {/* Email - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="payerEmail">Email *</Label>
              <Input
                id="payerEmail"
                type="email"
                placeholder="email@exemplo.com"
                {...form.register("payerEmail" as any)}
                data-testid="input-payer-email"
              />
              {(form.formState.errors as any).payerEmail && (
                <p className="text-destructive text-sm">{(form.formState.errors as any).payerEmail.message}</p>
              )}
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h2 className="font-gilroy font-bold text-2xl text-foreground mb-2">
            Upload de Documentos
          </h2>
          <p className="text-muted-foreground">
            Faça upload de PDF, JPG ou PNG até 10MB. Preencha os metadados obrigatórios conforme PRD.
          </p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-blue-800 mb-2">📋 Requisitos do PRD:</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>Formatos:</strong> PDF, JPG, PNG (até 10MB)</li>
              <li>• <strong>Datas:</strong> DD/MM/AAAA</li>
              <li>• <strong>Valores:</strong> R$ X,XX</li>
              <li>• <strong>Nome do arquivo:</strong> Use pipe (|), underscore (_) ou híbrido para melhor OCR</li>
              <li>• <strong>Prioridade de validação:</strong> Nome do arquivo &gt; OCR &gt; escolha do usuário</li>
            </ul>
          </div>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Aviso de nome de arquivo */}
          {fileNameWarning && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                {fileNameWarning}
              </AlertDescription>
            </Alert>
          )}

          {/* Upload Zone */}
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
              ${isDragOver 
                ? 'border-gquicks-primary bg-gquicks-primary/5' 
                : selectedFile
                  ? 'border-green-400 bg-green-50'
                  : 'border-gquicks-primary/50 bg-gquicks-primary/5 hover:border-gquicks-primary hover:bg-gquicks-primary/10'
              }
            `}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
            data-testid="upload-zone"
          >
            {selectedFile ? (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <UploadIcon className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h3 className="font-gilroy font-bold text-lg text-foreground mb-2">
                    Arquivo Selecionado
                  </h3>
                  <p className="text-foreground font-medium">{selectedFile.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setSelectedFile(null);
                      setFileNameWarning(null);
                    }}
                    data-testid="button-remove-file"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remover
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-gquicks-primary/20 rounded-full flex items-center justify-center mx-auto">
                  <CloudUpload className="w-8 h-8 text-gquicks-primary" />
                </div>
                <div>
                  <h3 className="font-gilroy font-bold text-lg text-foreground mb-2">
                    Arraste e solte ou clique para selecionar
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    PDF, JPG ou PNG até 10MB conforme PRD
                  </p>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileInputChange}
                    id="file-upload"
                    data-testid="input-file"
                  />
                  <label htmlFor="file-upload">
                    <Button type="button" variant="outline" className="mt-4" asChild>
                      <span>Selecionar Arquivo</span>
                    </Button>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <Card>
            <CardHeader>
              <CardTitle className="font-gilroy">Metadados do Documento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Client Selection */}
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select
                  onValueChange={(value) => form.setValue("clientId", value)}
                  value={form.watch("clientId")}
                >
                  <SelectTrigger data-testid="select-client">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {(clientList as any[]).map((client: any) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.clientId && (
                  <p className="text-destructive text-sm">{form.formState.errors.clientId.message}</p>
                )}
              </div>

              {/* Document Type */}
              <div className="space-y-2">
                <Label>Tipo de Solicitação *</Label>
                <RadioGroup
                  value={form.watch("documentType")}
                  onValueChange={(value) => form.setValue("documentType", value as any)}
                  className="grid grid-cols-2 md:grid-cols-4 gap-4"
                  data-testid="radio-document-type"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PAGO" id="pago" />
                    <Label htmlFor="pago" className="cursor-pointer">Pago</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="AGENDADO" id="agendado" />
                    <Label htmlFor="agendado" className="cursor-pointer">Agendado</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="EMITIR_BOLETO" id="boleto" />
                    <Label htmlFor="boleto" className="cursor-pointer">Emitir Boleto</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="EMITIR_NF" id="nf" />
                    <Label htmlFor="nf" className="cursor-pointer">Emitir NF</Label>
                  </div>
                </RadioGroup>
                {form.formState.errors.documentType && (
                  <p className="text-destructive text-sm">{form.formState.errors.documentType.message}</p>
                )}
              </div>

              {/* Dynamic Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderDynamicFields()}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  placeholder="Informações adicionais sobre o documento..."
                  {...form.register("notes")}
                  data-testid="textarea-notes"
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-4">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => {
                form.reset();
                setSelectedFile(null);
                setFileNameWarning(null);
              }}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-gquicks-primary hover:bg-gquicks-primary/90"
              disabled={!selectedFile || uploadMutation.isPending}
              data-testid="button-process"
            >
              {uploadMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                <>
                  <UploadIcon className="w-4 h-4 mr-2" />
                  Processar Documento
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}