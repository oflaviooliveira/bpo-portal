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

// FASE 2: Formulários dinâmicos por tipo de documento conforme PRD
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

// Função para validar nome do arquivo conforme PRD (pipe, underscore, híbrido)
const validateFileName = (fileName: string) => {
  // Remove extensão para análise
  const nameWithoutExt = fileName.replace(/\.(pdf|jpg|jpeg|png)$/i, '');
  
  // Formatos aceitos: pipe (|), underscore (_), híbrido
  const pipeFormat = /.*\|.*\|.*\|.*/;
  const underscoreFormat = /.*_.*_.*_.*/;
  const hybridFormat = /.*[|_].*[|_].*[|_].*/;
  
  return pipeFormat.test(nameWithoutExt) || 
         underscoreFormat.test(nameWithoutExt) || 
         hybridFormat.test(nameWithoutExt);
};

export function Upload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState<"PAGO" | "AGENDADO" | "EMITIR_BOLETO" | "EMITIR_NF">("PAGO");
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

  // Reset form when document type changes - FASE 2 IMPLEMENTAÇÃO
  const watchedDocumentType = form.watch("documentType");
  React.useEffect(() => {
    if (watchedDocumentType !== selectedDocumentType) {
      setSelectedDocumentType(watchedDocumentType);
      // Reset form with only base fields
      const currentClientId = form.getValues("clientId");
      form.reset();
      form.setValue("clientId", currentClientId);
      form.setValue("documentType", watchedDocumentType);
    }
  }, [watchedDocumentType, selectedDocumentType, form]);

  // Fetch dropdown options
  const { data: clients } = useQuery({ queryKey: ["/api/clients"] });
  const { data: banks } = useQuery({ queryKey: ["/api/banks"] });
  const { data: categories } = useQuery({ queryKey: ["/api/categories"] });
  const { data: costCenters } = useQuery({ queryKey: ["/api/cost-centers"] });

  // Default to empty arrays if data is undefined
  const clientList = Array.isArray(clients) ? clients : [];
  const bankList = Array.isArray(banks) ? banks : [];
  const categoryList = Array.isArray(categories) ? categories : [];
  const costCenterList = Array.isArray(costCenters) ? costCenters : [];

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadFormData & { file: File }) => {
      const formData = new FormData();
      formData.append('file', data.file);
      Object.entries(data).forEach(([key, value]) => {
        if (key !== 'file' && value !== null && value !== undefined && value !== '') {
          formData.append(key, value);
        }
      });

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro no upload');
      }

      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Upload Concluído!",
        description: "Documento enviado. Processamento OCR + IA iniciado automaticamente conforme PRD.",
      });
      
      // Reset form and file
      form.reset();
      setSelectedFile(null);
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (file: File) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Tipo de arquivo não permitido",
        description: "Use apenas PDF, JPG ou PNG conforme especificação do PRD",
        variant: "destructive",
      });
      return;
    }

    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB conforme PRD",
        variant: "destructive",
      });
      return;
    }

    // Validação do nome do arquivo conforme PRD
    if (!validateFileName(file.name)) {
      setFileNameWarning(
        "⚠️ Nome do arquivo não segue o padrão recomendado. Use formatos com pipe (|), underscore (_) ou híbrido para melhor processamento OCR."
      );
    } else {
      setFileNameWarning(null);
    }

    setSelectedFile(file);
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
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedFile(null)}
                  data-testid="button-remove-file"
                >
                  <X className="w-4 h-4 mr-2" />
                  Remover Arquivo
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 bg-gquicks-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <CloudUpload className="w-8 h-8 text-gquicks-primary" />
                </div>
                <div>
                  <h3 className="font-gilroy font-bold text-lg text-foreground mb-2">
                    Arraste arquivos aqui ou clique para selecionar
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Suporte para PDF, JPG, PNG até 10MB
                  </p>
                </div>
                <div>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileInputChange}
                    className="hidden"
                    id="file-input"
                    data-testid="input-file"
                  />
                  <Button
                    type="button"
                    className="bg-gquicks-primary hover:bg-gquicks-primary/90"
                    onClick={() => document.getElementById('file-input')?.click()}
                    data-testid="button-select-files"
                  >
                    Selecionar Arquivos
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Metadata Form */}
          <Card>
            <CardHeader>
              <CardTitle className="font-gilroy font-bold text-lg text-foreground">
                Metadados do Documento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Client */}
                <div className="space-y-2">
                  <Label htmlFor="clientId">Cliente *</Label>
                  <Select 
                    onValueChange={(value) => form.setValue("clientId", value)}
                    value={form.watch("clientId")}
                  >
                    <SelectTrigger data-testid="select-client">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientList.map((client: any) => (
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

                {/* FASE 2: Formulários dinâmicos baseados no tipo de documento */}
                {renderDynamicFields()}
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

  // FASE 2: Renderização dinâmica de campos baseada no tipo de documento
  function renderDynamicFields() {
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
                value={form.watch("bankId" as any)}
              >
                <SelectTrigger data-testid="select-bank">
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  {bankList.map((bank: any) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.bankId && (
                <p className="text-destructive text-sm">{form.formState.errors.bankId.message}</p>
              )}
            </div>

            {/* Categoria - obrigatória para PAGO */}
            <div className="space-y-2">
              <Label htmlFor="categoryId">Categoria *</Label>
              <Select 
                onValueChange={(value) => form.setValue("categoryId" as any, value)}
                value={form.watch("categoryId" as any)}
              >
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoryList.map((category: any) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.categoryId && (
                <p className="text-destructive text-sm">{form.formState.errors.categoryId.message}</p>
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
              {form.formState.errors.amount && (
                <p className="text-destructive text-sm">{form.formState.errors.amount.message}</p>
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
              {form.formState.errors.paymentDate && (
                <p className="text-destructive text-sm">{form.formState.errors.paymentDate.message}</p>
              )}
            </div>

            {/* Fornecedor/Descrição - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="supplier">Fornecedor/Descrição *</Label>
              <Input
                id="supplier"
                placeholder="Nome do fornecedor ou descrição do pagamento"
                {...form.register("supplier")}
                data-testid="input-supplier"
              />
              {form.formState.errors.supplier && (
                <p className="text-destructive text-sm">{form.formState.errors.supplier.message}</p>
              )}
            </div>

            {/* Centro de Custo - opcional */}
            <div className="space-y-2">
              <Label htmlFor="costCenterId">Centro de Custo</Label>
              <Select 
                onValueChange={(value) => form.setValue("costCenterId", value)}
                value={form.watch("costCenterId")}
              >
                <SelectTrigger data-testid="select-cost-center">
                  <SelectValue placeholder="Selecione o centro de custo" />
                </SelectTrigger>
                <SelectContent>
                  {costCenterList.map((costCenter: any) => (
                    <SelectItem key={costCenter.id} value={costCenter.id}>
                      {costCenter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Observações - opcional */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Observações adicionais..."
                rows={3}
                {...form.register("notes")}
                data-testid="textarea-notes"
              />
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
                onValueChange={(value) => form.setValue("bankId", value)}
                value={form.watch("bankId")}
              >
                <SelectTrigger data-testid="select-bank">
                  <SelectValue placeholder="Selecione o banco" />
                </SelectTrigger>
                <SelectContent>
                  {bankList.map((bank: any) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.bankId && (
                <p className="text-destructive text-sm">{form.formState.errors.bankId.message}</p>
              )}
            </div>

            {/* Valor - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="amount">Valor *</Label>
              <Input
                id="amount"
                placeholder="Ex: 1500.00"
                {...form.register("amount")}
                data-testid="input-amount"
              />
              {form.formState.errors.amount && (
                <p className="text-destructive text-sm">{form.formState.errors.amount.message}</p>
              )}
            </div>

            {/* Data de Vencimento - obrigatória */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Data de Vencimento *</Label>
              <Input
                id="dueDate"
                type="date"
                {...form.register("dueDate")}
                data-testid="input-due-date"
              />
              {form.formState.errors.dueDate && (
                <p className="text-destructive text-sm">{form.formState.errors.dueDate.message}</p>
              )}
            </div>

            {/* Favorecido - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="beneficiary">Favorecido *</Label>
              <Input
                id="beneficiary"
                placeholder="Nome do favorecido"
                {...form.register("beneficiary")}
                data-testid="input-beneficiary"
              />
              {form.formState.errors.beneficiary && (
                <p className="text-destructive text-sm">{form.formState.errors.beneficiary.message}</p>
              )}
            </div>

            {/* Linha Digitável/Código - opcional */}
            <div className="space-y-2">
              <Label htmlFor="bankCode">Linha Digitável/Código</Label>
              <Input
                id="bankCode"
                placeholder="Código de barras ou linha digitável"
                {...form.register("bankCode")}
                data-testid="input-bank-code"
              />
            </div>

            {/* Centro de Custo - opcional */}
            <div className="space-y-2">
              <Label htmlFor="costCenterId">Centro de Custo</Label>
              <Select 
                onValueChange={(value) => form.setValue("costCenterId", value)}
                value={form.watch("costCenterId")}
              >
                <SelectTrigger data-testid="select-cost-center">
                  <SelectValue placeholder="Selecione o centro de custo" />
                </SelectTrigger>
                <SelectContent>
                  {costCenterList.map((costCenter: any) => (
                    <SelectItem key={costCenter.id} value={costCenter.id}>
                      {costCenter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Observações - opcional */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Observações adicionais..."
                rows={3}
                {...form.register("notes")}
                data-testid="textarea-notes"
              />
            </div>
          </>
        );

      case "EMITIR_BOLETO":
        return (
          <>
            {/* Valor - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="amount">Valor *</Label>
              <Input
                id="amount"
                placeholder="Ex: 1500.00"
                {...form.register("amount")}
                data-testid="input-amount"
              />
              {form.formState.errors.amount && (
                <p className="text-destructive text-sm">{form.formState.errors.amount.message}</p>
              )}
            </div>

            {/* Data de Vencimento - obrigatória */}
            <div className="space-y-2">
              <Label htmlFor="dueDate">Data de Vencimento *</Label>
              <Input
                id="dueDate"
                type="date"
                {...form.register("dueDate")}
                data-testid="input-due-date"
              />
              {form.formState.errors.dueDate && (
                <p className="text-destructive text-sm">{form.formState.errors.dueDate.message}</p>
              )}
            </div>

            {/* CNPJ/CPF do Tomador - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="payerDocument">CNPJ/CPF do Tomador *</Label>
              <Input
                id="payerDocument"
                placeholder="00.000.000/0000-00 ou 000.000.000-00"
                {...form.register("payerDocument")}
                data-testid="input-payer-document"
              />
              {form.formState.errors.payerDocument && (
                <p className="text-destructive text-sm">{form.formState.errors.payerDocument.message}</p>
              )}
            </div>

            {/* Nome do Tomador - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="payerName">Nome do Tomador *</Label>
              <Input
                id="payerName"
                placeholder="Nome completo ou razão social"
                {...form.register("payerName")}
                data-testid="input-payer-name"
              />
              {form.formState.errors.payerName && (
                <p className="text-destructive text-sm">{form.formState.errors.payerName.message}</p>
              )}
            </div>

            {/* Endereço - obrigatório */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="payerAddress">Endereço Completo *</Label>
              <Input
                id="payerAddress"
                placeholder="Rua, número, bairro, cidade, estado, CEP"
                {...form.register("payerAddress")}
                data-testid="input-payer-address"
              />
              {form.formState.errors.payerAddress && (
                <p className="text-destructive text-sm">{form.formState.errors.payerAddress.message}</p>
              )}
            </div>

            {/* Email - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="payerEmail">Email *</Label>
              <Input
                id="payerEmail"
                type="email"
                placeholder="email@exemplo.com"
                {...form.register("payerEmail")}
                data-testid="input-payer-email"
              />
              {form.formState.errors.payerEmail && (
                <p className="text-destructive text-sm">{form.formState.errors.payerEmail.message}</p>
              )}
            </div>

            {/* Observações - opcional */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Observações internas..."
                rows={3}
                {...form.register("notes")}
                data-testid="textarea-notes"
              />
            </div>
          </>
        );

      case "EMITIR_NF":
        return (
          <>
            {/* Valor - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="amount">Valor *</Label>
              <Input
                id="amount"
                placeholder="Ex: 1500.00"
                {...form.register("amount")}
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
                placeholder="Ex: 14.01, 25.02"
                {...form.register("serviceCode")}
                data-testid="input-service-code"
              />
              {form.formState.errors.serviceCode && (
                <p className="text-destructive text-sm">{form.formState.errors.serviceCode.message}</p>
              )}
            </div>

            {/* Descrição do Serviço - obrigatória */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="serviceDescription">Descrição do Serviço/Itens *</Label>
              <Textarea
                id="serviceDescription"
                placeholder="Descrição detalhada dos serviços ou itens..."
                rows={3}
                {...form.register("serviceDescription")}
                data-testid="textarea-service-description"
              />
              {form.formState.errors.serviceDescription && (
                <p className="text-destructive text-sm">{form.formState.errors.serviceDescription.message}</p>
              )}
            </div>

            {/* CNPJ/CPF do Tomador - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="payerDocument">CNPJ/CPF do Tomador *</Label>
              <Input
                id="payerDocument"
                placeholder="00.000.000/0000-00 ou 000.000.000-00"
                {...form.register("payerDocument")}
                data-testid="input-payer-document"
              />
              {form.formState.errors.payerDocument && (
                <p className="text-destructive text-sm">{form.formState.errors.payerDocument.message}</p>
              )}
            </div>

            {/* Nome do Tomador - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="payerName">Nome do Tomador *</Label>
              <Input
                id="payerName"
                placeholder="Nome completo ou razão social"
                {...form.register("payerName")}
                data-testid="input-payer-name"
              />
              {form.formState.errors.payerName && (
                <p className="text-destructive text-sm">{form.formState.errors.payerName.message}</p>
              )}
            </div>

            {/* Endereço - obrigatório */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="payerAddress">Endereço Completo *</Label>
              <Input
                id="payerAddress"
                placeholder="Rua, número, bairro, cidade, estado, CEP"
                {...form.register("payerAddress")}
                data-testid="input-payer-address"
              />
              {form.formState.errors.payerAddress && (
                <p className="text-destructive text-sm">{form.formState.errors.payerAddress.message}</p>
              )}
            </div>

            {/* Email - obrigatório */}
            <div className="space-y-2">
              <Label htmlFor="payerEmail">Email *</Label>
              <Input
                id="payerEmail"
                type="email"
                placeholder="email@exemplo.com"
                {...form.register("payerEmail")}
                data-testid="input-payer-email"
              />
              {form.formState.errors.payerEmail && (
                <p className="text-destructive text-sm">{form.formState.errors.payerEmail.message}</p>
              )}
            </div>

            {/* Observações - opcional */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Observações internas..."
                rows={3}
                {...form.register("notes")}
                data-testid="textarea-notes"
              />
            </div>
          </>
        );

      default:
        return (
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Observações adicionais..."
              rows={3}
              {...form.register("notes")}
              data-testid="textarea-notes"
            />
          </div>
        );
    }
  }
}
