import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Building, User, Pencil, Search, FileText, Trash2, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

const fornecedorSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  document: z.string().min(11, "Documento deve ter pelo menos 11 dígitos"),
  documentType: z.enum(['CPF', 'CNPJ'], { required_error: "Selecione o tipo de documento" }),
  email: z.string().email("E-mail inválido").optional().or(z.literal('')),
  phone: z.string().optional(),
  contactName: z.string().optional(),
  stateRegistration: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
});

type FornecedorFormData = z.infer<typeof fornecedorSchema>;

interface Fornecedor {
  id: string;
  name: string;
  document: string;
  documentType: 'CPF' | 'CNPJ';
  email?: string;
  phone?: string;
  contactName?: string;
  stateRegistration?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  createdAt: string;
}

export function ClientFornecedores() {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [deletingFornecedor, setDeletingFornecedor] = useState<Fornecedor | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FornecedorFormData>({
    resolver: zodResolver(fornecedorSchema),
    defaultValues: {
      name: '',
      document: '',
      documentType: 'CPF' as const,
      email: '',
      phone: '',
      contactName: '',
      stateRegistration: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: '',
      zipCode: '',
    },
  });

  const { data: fornecedores = [], isLoading } = useQuery<Fornecedor[]>({
    queryKey: ['/api/fornecedores'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FornecedorFormData) => {
      const response = await apiRequest('POST', '/api/fornecedores', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fornecedores'] });
      toast({
        title: "Sucesso",
        description: "Fornecedor cadastrado com sucesso",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FornecedorFormData }) => {
      const response = await apiRequest('PUT', `/api/fornecedores/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fornecedores'] });
      toast({
        title: "Sucesso",
        description: "Fornecedor atualizado com sucesso",
      });
      setEditingFornecedor(null);
      setOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/fornecedores/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fornecedores'] });
      toast({
        title: "Sucesso",
        description: "Fornecedor excluído com sucesso",
      });
      setDeletingFornecedor(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FornecedorFormData) => {
    if (editingFornecedor) {
      updateMutation.mutate({ id: editingFornecedor.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditModal = (fornecedor: Fornecedor) => {
    setEditingFornecedor(fornecedor);
    form.reset({
      name: fornecedor.name || '',
      document: fornecedor.document || '',
      documentType: fornecedor.documentType || 'CPF',
      email: fornecedor.email || '',
      phone: fornecedor.phone || '',
      contactName: fornecedor.contactName || '',
      stateRegistration: fornecedor.stateRegistration || '',
      street: fornecedor.street || '',
      number: fornecedor.number || '',
      complement: fornecedor.complement || '',
      neighborhood: fornecedor.neighborhood || '',
      city: fornecedor.city || '',
      state: fornecedor.state || '',
      zipCode: fornecedor.zipCode || '',
    });
    setOpen(true);
  };

  const deleteFornecedor = (fornecedor: Fornecedor) => {
    setDeletingFornecedor(fornecedor);
  };

  const confirmDelete = () => {
    if (deletingFornecedor) {
      deleteMutation.mutate(deletingFornecedor.id);
    }
  };

  const closeModal = () => {
    setOpen(false);
    setEditingFornecedor(null);
    form.reset();
  };

  const formatDocument = (doc: string | null | undefined, type: 'CPF' | 'CNPJ') => {
    if (!doc) return '';
    if (type === 'CPF') {
      return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else {
      return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
  };

  const filteredFornecedores = Array.isArray(fornecedores) 
    ? fornecedores.filter((fornecedor: Fornecedor) =>
        (fornecedor.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (fornecedor.document || '').includes(searchTerm) ||
        (fornecedor.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (fornecedor.city || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Fornecedores</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Gerencie os fornecedores da sua empresa
          </p>
        </div>

        <Dialog open={open} onOpenChange={closeModal}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-supplier" className="bg-gquicks-primary hover:bg-gquicks-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-add-supplier" className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </DialogTitle>
              <DialogDescription>
                {editingFornecedor 
                  ? 'Atualize as informações do fornecedor' 
                  : 'Preencha as informações do novo fornecedor'
                }
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Informações Básicas */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Informações Básicas</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome / Razão Social *</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-supplier-name"
                              placeholder="Nome do fornecedor"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="documentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Documento *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-supplier-document-type">
                                <SelectValue placeholder="Selecione o tipo" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="CPF">CPF</SelectItem>
                              <SelectItem value="CNPJ">CNPJ</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="document"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {form.watch('documentType') === 'CPF' ? 'CPF *' : 'CNPJ *'}
                          </FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-supplier-document"
                              placeholder={form.watch('documentType') === 'CPF' ? 'CPF (somente números)' : 'CNPJ (somente números)'}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="stateRegistration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Inscrição Estadual</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-supplier-state-registration"
                              placeholder="Número da inscrição estadual"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Contato */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Contato</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>E-mail</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-supplier-email"
                              type="email"
                              placeholder="email@exemplo.com"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Telefone</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-supplier-phone"
                              placeholder="(11) 99999-9999"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="contactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pessoa de Contato</FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-supplier-contact-name"
                            placeholder="Nome da pessoa de contato"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Endereço */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Endereço</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="zipCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CEP</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-supplier-zip-code"
                              placeholder="00000-000"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="md:col-span-2">
                      <FormField
                        control={form.control}
                        name="street"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Logradouro</FormLabel>
                            <FormControl>
                              <Input
                                data-testid="input-supplier-street"
                                placeholder="Rua, Avenida, etc."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Número</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-supplier-number"
                              placeholder="123"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="md:col-span-2">
                      <FormField
                        control={form.control}
                        name="complement"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complemento</FormLabel>
                            <FormControl>
                              <Input
                                data-testid="input-supplier-complement"
                                placeholder="Apartamento, Sala, etc."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="neighborhood"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bairro</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-supplier-neighborhood"
                              placeholder="Nome do bairro"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cidade</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-supplier-city"
                              placeholder="Nome da cidade"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="state"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estado</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-supplier-state"
                              placeholder="SP"
                              maxLength={2}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <DialogFooter className="gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeModal}
                    data-testid="button-cancel-supplier"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-supplier"
                  >
                    {(createMutation.isPending || updateMutation.isPending) 
                      ? 'Salvando...' 
                      : editingFornecedor ? 'Atualizar' : 'Salvar'
                    }
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            data-testid="input-search-suppliers"
            placeholder="Buscar fornecedores..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Fornecedores Cadastrados
          </CardTitle>
          <CardDescription>
            {filteredFornecedores.length} fornecedor(es) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="text-gray-500">Carregando...</div>
            </div>
          ) : filteredFornecedores.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
            </div>
          ) : (
            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Documento</TableHead>
                    <TableHead>Nome / Razão Social</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFornecedores.map((fornecedor: Fornecedor) => (
                    <TableRow key={fornecedor.id}>
                      <TableCell data-testid={`text-document-${fornecedor.id}`}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            {fornecedor.documentType === 'CPF' ? <User className="h-3 w-3" /> : <Building className="h-3 w-3" />}
                            {fornecedor.documentType}
                          </Badge>
                          <span>{formatDocument(fornecedor.document, fornecedor.documentType)}</span>
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-name-${fornecedor.id}`}>
                        <div>
                          <div className="font-medium">{fornecedor.name}</div>
                          {fornecedor.contactName && (
                            <div className="text-sm text-gray-500">Contato: {fornecedor.contactName}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell data-testid={`text-email-${fornecedor.id}`}>
                        {fornecedor.email || '-'}
                      </TableCell>
                      <TableCell data-testid={`text-phone-${fornecedor.id}`}>
                        {fornecedor.phone || '-'}
                      </TableCell>
                      <TableCell data-testid={`text-city-${fornecedor.id}`}>
                        {fornecedor.city ? `${fornecedor.city}${fornecedor.state ? ` - ${fornecedor.state}` : ''}` : '-'}
                      </TableCell>
                      <TableCell>
                        {new Date(fornecedor.createdAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(fornecedor)}
                            data-testid={`button-edit-${fornecedor.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteFornecedor(fornecedor)}
                            data-testid={`button-delete-${fornecedor.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!deletingFornecedor} onOpenChange={() => setDeletingFornecedor(null)}>
        <AlertDialogContent data-testid="dialog-delete-supplier">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o fornecedor "{deletingFornecedor?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-supplier">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete-supplier"
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}