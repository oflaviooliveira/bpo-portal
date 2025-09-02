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
import { useToast } from "@/hooks/use-toast";
import { CloudUpload, Upload as UploadIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Schema simplificado para teste inicial
const uploadSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório"),
  documentType: z.enum(["PAGO", "AGENDADO", "EMITIR_BOLETO", "EMITIR_NF"]),
  amount: z.string().optional(),
  bankId: z.string().optional(),
  categoryId: z.string().optional(),
  costCenterId: z.string().optional(),
  notes: z.string().optional(),
  // Campos condicionais
  paymentDate: z.string().optional(),
  competenceDate: z.string().optional(),
  paidDate: z.string().optional(),
  dueDate: z.string().optional(),
  supplier: z.string().optional(),
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

export function UploadDocumentOld() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<UploadData>({
    resolver: zodResolver(uploadSchema),
  });

  const documentType = watch("documentType");

  // Buscar dados do sistema
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    enabled: true,
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["/api/banks"],
    enabled: true,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    enabled: true,
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["/api/cost-centers"],
    enabled: true,
  });

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
      console.log("✅ Upload sucesso:", data);
      toast({
        title: "Upload realizado com sucesso",
        description: `Documento ${data.documentId} foi enviado e está sendo processado`,
      });
      
      // Limpar formulário
      reset();
      setSelectedFile(null);
      setIsProcessing(false);
      
      // Invalidar cache
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error: any) => {
      console.error("❌ Erro no upload:", error);
      toast({
        title: "Erro no upload",
        description: error.message || "Erro interno do servidor",
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      console.log("📁 Arquivo selecionado:", file.name, "Tamanho:", Math.round(file.size/1024), "KB");
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

    setIsProcessing(true);
    console.log("🚀 Iniciando upload:", data);

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

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CloudUpload className="h-5 w-5" />
          Upload de Documento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          {/* Seleção de arquivo */}
          <div className="space-y-2">
            <Label htmlFor="file">Arquivo (PDF, JPG, PNG - máx 10MB)</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="cursor-pointer"
              data-testid="input-file"
            />
            {selectedFile && (
              <Alert>
                <AlertDescription>
                  Arquivo selecionado: {selectedFile.name} ({Math.round(selectedFile.size/1024)}KB)
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Cliente */}
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select onValueChange={(value) => setValue("clientId", value)}>
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
            {errors.clientId && (
              <p className="text-sm text-red-500">{errors.clientId.message}</p>
            )}
          </div>

          {/* Tipo de documento */}
          <div className="space-y-2">
            <Label>Tipo de Documento *</Label>
            <Select onValueChange={(value) => setValue("documentType", value as any)}>
              <SelectTrigger data-testid="select-document-type">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PAGO">PAGO - Documento já pago</SelectItem>
                <SelectItem value="AGENDADO">AGENDADO - Pagamento agendado</SelectItem>
                <SelectItem value="EMITIR_BOLETO">EMITIR BOLETO - Gerar boleto</SelectItem>
                <SelectItem value="EMITIR_NF">EMITIR NF - Gerar nota fiscal</SelectItem>
              </SelectContent>
            </Select>
            {errors.documentType && (
              <p className="text-sm text-red-500">{errors.documentType.message}</p>
            )}
          </div>

          {/* Valor */}
          <div className="space-y-2">
            <Label>Valor</Label>
            <Input
              {...register("amount")}
              placeholder="R$ 1.000,00"
              data-testid="input-amount"
            />
            {errors.amount && (
              <p className="text-sm text-red-500">{errors.amount.message}</p>
            )}
          </div>

          {/* Campos condicionais por tipo */}
          {documentType === "PAGO" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Competência *</Label>
                <Input
                  {...register("competenceDate")}
                  type="date"
                  data-testid="input-competence-date"
                />
                <p className="text-xs text-muted-foreground">Quando a despesa/receita pertence</p>
              </div>
              <div className="space-y-2">
                <Label>Data de Pagamento *</Label>
                <Input
                  {...register("paidDate")}
                  type="date"
                  data-testid="input-paid-date"
                />
                <p className="text-xs text-muted-foreground">Data efetiva do pagamento</p>
              </div>
            </div>
          )}

          {(documentType === "AGENDADO" || documentType === "EMITIR_BOLETO") && (
            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Input
                {...register("dueDate")}
                placeholder="DD/MM/AAAA"
                data-testid="input-due-date"
              />
            </div>
          )}

          {/* Banco */}
          <div className="space-y-2">
            <Label>Banco</Label>
            <Select onValueChange={(value) => setValue("bankId", value)}>
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
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select onValueChange={(value) => setValue("categoryId", value)}>
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

          {/* Centro de custo */}
          <div className="space-y-2">
            <Label>Centro de Custo</Label>
            <Select onValueChange={(value) => setValue("costCenterId", value)}>
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

          {/* Campos para boleto/NF */}
          {(documentType === "EMITIR_BOLETO" || documentType === "EMITIR_NF") && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-lg font-semibold">Dados do Tomador</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CPF/CNPJ do Tomador</Label>
                  <Input
                    {...register("payerDocument")}
                    placeholder="000.000.000-00 ou 00.000.000/0001-00"
                    data-testid="input-payer-document"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nome/Razão Social</Label>
                  <Input
                    {...register("payerName")}
                    placeholder="Nome completo ou razão social"
                    data-testid="input-payer-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    {...register("payerEmail")}
                    type="email"
                    placeholder="email@exemplo.com"
                    data-testid="input-payer-email"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input
                    {...register("payerAddress")}
                    placeholder="Endereço completo"
                    data-testid="input-payer-address"
                  />
                </div>
              </div>

              {documentType === "EMITIR_NF" && (
                <>
                  <div className="space-y-2">
                    <Label>Código do Serviço</Label>
                    <Input
                      {...register("serviceCode")}
                      placeholder="Código do serviço"
                      data-testid="input-service-code"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição do Serviço</Label>
                    <Textarea
                      {...register("serviceDescription")}
                      placeholder="Descrição detalhada do serviço"
                      data-testid="textarea-service-description"
                    />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>Instruções Especiais</Label>
                <Textarea
                  {...register("instructions")}
                  placeholder="Instruções adicionais para o documento"
                  data-testid="textarea-instructions"
                />
              </div>
            </div>
          )}

          {/* Fornecedor/Descrição e Observações */}
          <div className="space-y-2">
            <Label>Fornecedor/Descrição</Label>
            <Input
              {...register("supplier")}
              placeholder="Nome do fornecedor ou descrição"
              data-testid="input-supplier"
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              {...register("notes")}
              placeholder="Observações adicionais"
              data-testid="textarea-notes"
            />
          </div>

          {/* Botão de envio */}
          <Button
            type="submit"
            disabled={isProcessing || !selectedFile}
            className="w-full"
            data-testid="button-submit"
          >
            {isProcessing ? (
              "Processando..."
            ) : (
              <>
                <UploadIcon className="mr-2 h-4 w-4" />
                Enviar Documento
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}