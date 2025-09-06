import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Building, User, Zap, CheckCircle, AlertTriangle, Info, Eye, FileText } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

const supplierSchema = z.object({
  type: z.enum(['PF', 'PJ'], { required_error: "Selecione o tipo" }),
  document: z.string().min(11, "CPF deve ter 11 dígitos ou CNPJ 14 dígitos"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
});

type SupplierFormData = z.infer<typeof supplierSchema>;

interface DetectedSupplier {
  name: string;
  document: string;
  type: 'PF' | 'PJ';
  confidence: number;
  source: string;
}

interface AutoSupplierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  detectedSupplier: DetectedSupplier;
  onSupplierCreated: (supplier: any) => void;
  onSkip: () => void;
  documentFile?: File;
}

export function AutoSupplierModal({ 
  open, 
  onOpenChange, 
  detectedSupplier, 
  onSupplierCreated,
  onSkip,
  documentFile 
}: AutoSupplierModalProps) {
  const [action, setAction] = useState<'create' | 'skip' | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      type: detectedSupplier.type,
      document: detectedSupplier.document,
      name: detectedSupplier.name,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      const response = await apiRequest('POST', '/api/fornecedores', data);
      return await response.json();
    },
    onSuccess: (newSupplier) => {
      queryClient.invalidateQueries({ queryKey: ['/api/fornecedores'] });
      toast({
        title: "Sucesso",
        description: "Novo fornecedor cadastrado com sucesso",
      });
      onSupplierCreated(newSupplier);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCreate = (data: SupplierFormData) => {
    createMutation.mutate(data);
  };

  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "bg-green-100 text-green-800 border-green-200";
    if (confidence >= 70) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 90) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (confidence >= 70) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <AlertTriangle className="h-4 w-4 text-red-600" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-gquicks-primary" />
            Novo Fornecedor Detectado
          </DialogTitle>
          <DialogDescription>
            Identificamos um fornecedor não cadastrado nos dados do documento. 
            Deseja cadastrá-lo automaticamente?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Detection Info */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Confiança da detecção:</span>
                  <Badge className={getConfidenceColor(detectedSupplier.confidence)}>
                    {getConfidenceIcon(detectedSupplier.confidence)}
                    {Math.round(detectedSupplier.confidence)}%
                  </Badge>
                </div>
                <div className="text-sm text-gray-600">
                  Dados extraídos de: {detectedSupplier.source}
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Preview */}
          <div className="border rounded-lg p-3 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {detectedSupplier.type === 'PF' ? (
                  <User className="h-5 w-5 text-blue-600" />
                ) : (
                  <Building className="h-5 w-5 text-blue-600" />
                )}
                <div>
                  <div className="font-medium">{detectedSupplier.name}</div>
                  <div className="text-sm text-gray-600">
                    {detectedSupplier.type === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                  </div>
                </div>
              </div>
              
              {/* Botão Ver Documento */}
              {documentFile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(true)}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Ver
                </Button>
              )}
            </div>
            
            <div className="text-sm">
              <span className="text-gray-600">Documento:</span>
              <span className="ml-2 font-mono">{detectedSupplier.document}</span>
            </div>
          </div>

          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <div className="text-sm font-medium text-gray-700 border-b pb-2">
                Confirmar ou editar dados:
              </div>

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PF">Pessoa Física</SelectItem>
                        <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="document"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {form.watch('type') === 'PF' ? 'CPF' : 'CNPJ'}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder={form.watch('type') === 'PF' ? 'CPF (somente números)' : 'CNPJ (somente números)'}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Nome do fornecedor"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSkip}
                  className="flex-1"
                >
                  Pular por agora
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1"
                >
                  {createMutation.isPending ? 'Cadastrando...' : 'Cadastrar Fornecedor'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>

      {/* Modal de Pré-visualização do Documento */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Documento - {documentFile?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex items-center justify-center">
            {documentFile && (
              <div className="w-full h-full flex items-center justify-center border border-gray-300 rounded-lg bg-gray-50">
                {documentFile.type === 'application/pdf' ? (
                  <iframe
                    src={URL.createObjectURL(documentFile)}
                    className="w-full h-full rounded-lg"
                    title="Visualização do documento"
                  />
                ) : (
                  <img
                    src={URL.createObjectURL(documentFile)}
                    alt="Documento"
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}