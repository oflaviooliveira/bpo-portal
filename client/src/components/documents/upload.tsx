import { useState } from "react";
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
import { CloudUpload, X, Upload as UploadIcon } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const uploadSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório"),
  bankId: z.string().optional(),
  categoryId: z.string().optional(),
  costCenterId: z.string().optional(),
  documentType: z.enum(["PAGO", "AGENDADO", "BOLETO", "NF"], {
    required_error: "Tipo de solicitação é obrigatório",
  }),
  amount: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

type UploadFormData = z.infer<typeof uploadSchema>;

export function Upload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      clientId: "",
      bankId: "",
      categoryId: "",
      costCenterId: "",
      documentType: "PAGO",
      amount: "",
      dueDate: "",
      notes: "",
    },
  });

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
    onSuccess: () => {
      toast({
        title: "Sucesso!",
        description: "Documento enviado e sendo processado automaticamente.",
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
        description: "Use apenas PDF, JPG ou PNG",
        variant: "destructive",
      });
      return;
    }

    if (file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 10MB",
        variant: "destructive",
      });
      return;
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
        description: "Selecione um arquivo para upload",
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
            Faça upload de PDF, JPG ou PNG até 10MB. Preencha os metadados obrigatórios.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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

                {/* Bank */}
                <div className="space-y-2">
                  <Label htmlFor="bankId">Banco</Label>
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
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="categoryId">Categoria</Label>
                  <Select 
                    onValueChange={(value) => form.setValue("categoryId", value)}
                    value={form.watch("categoryId")}
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
                </div>

                {/* Cost Center */}
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

                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor (opcional)</Label>
                  <Input
                    id="amount"
                    placeholder="1234.56"
                    {...form.register("amount")}
                    data-testid="input-amount"
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Data de Vencimento (opcional)</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    {...form.register("dueDate")}
                    data-testid="input-due-date"
                  />
                </div>
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
              disabled={uploadMutation.isPending}
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
