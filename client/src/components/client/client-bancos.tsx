import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Building2, Pencil, Search, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

const bancoSchema = z.object({
  code: z.string().min(3, "Código deve ter pelo menos 3 caracteres"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  isActive: z.boolean().default(true),
});

type BancoFormData = z.infer<typeof bancoSchema>;

interface Banco {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export function ClientBancos() {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingBanco, setEditingBanco] = useState<Banco | null>(null);
  const [deletingBanco, setDeletingBanco] = useState<Banco | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<BancoFormData>({
    resolver: zodResolver(bancoSchema),
    defaultValues: {
      code: '',
      name: '',
      isActive: true,
    },
  });

  const { data: bancos = [], isLoading } = useQuery<Banco[]>({
    queryKey: ['/api/banks'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: BancoFormData) => {
      const response = await apiRequest('POST', '/api/banks', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
      toast({
        title: "Sucesso",
        description: "Banco cadastrado com sucesso",
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
    mutationFn: async ({ id, data }: { id: string; data: BancoFormData }) => {
      const response = await apiRequest('PATCH', `/api/banks/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
      toast({
        title: "Sucesso",
        description: "Banco atualizado com sucesso",
      });
      setEditingBanco(null);
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
      await apiRequest('DELETE', `/api/banks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
      toast({
        title: "Sucesso",
        description: "Banco excluído com sucesso",
      });
      setDeletingBanco(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: BancoFormData) => {
    if (editingBanco) {
      updateMutation.mutate({ id: editingBanco.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredBancos = Array.isArray(bancos)
    ? bancos.filter((banco: Banco) =>
        banco.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        banco.code.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  const startEdit = (banco: Banco) => {
    setEditingBanco(banco);
    form.reset({
      code: banco.code,
      name: banco.name,
      isActive: banco.isActive,
    });
    setOpen(true);
  };

  const cancelEdit = () => {
    setEditingBanco(null);
    form.reset();
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Bancos</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Gerencie os bancos utilizados nos documentos financeiros
          </p>
        </div>

        <Dialog open={open} onOpenChange={(newOpen) => {
          setOpen(newOpen);
          if (!newOpen) {
            setEditingBanco(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-bank" className="bg-gquicks-primary hover:bg-gquicks-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Banco
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-add-bank">
            <DialogHeader>
              <DialogTitle>
                {editingBanco ? 'Editar Banco' : 'Novo Banco'}
              </DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código</FormLabel>
                      <FormControl>
                        <Input
                          data-testid="input-bank-code"
                          placeholder="Ex: 341, 237, 001"
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
                          data-testid="input-bank-name"
                          placeholder="Nome do banco"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Ativo</FormLabel>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Banco está disponível para uso
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          data-testid="switch-bank-active"
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelEdit}
                    data-testid="button-cancel-bank"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    data-testid="button-save-bank"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="bg-gquicks-primary hover:bg-gquicks-primary/90"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? 'Salvando...'
                      : editingBanco ? 'Atualizar' : 'Cadastrar'
                    }
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            data-testid="input-search-banks"
            placeholder="Buscar bancos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Lista de Bancos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building2 className="h-5 w-5 mr-2" />
            Bancos Cadastrados
          </CardTitle>
          <CardDescription>
            {filteredBancos.length} banco(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Carregando bancos...</div>
            </div>
          ) : filteredBancos.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">
                {searchTerm ? "Nenhum banco encontrado" : "Nenhum banco cadastrado"}
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBancos.map((banco) => (
                  <TableRow key={banco.id} data-testid={`row-bank-${banco.id}`}>
                    <TableCell className="font-medium">
                      {banco.code}
                    </TableCell>
                    <TableCell>{banco.name}</TableCell>
                    <TableCell>
                      <Badge 
                        variant={banco.isActive ? "default" : "secondary"}
                        data-testid={`status-bank-${banco.id}`}
                      >
                        {banco.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(banco)}
                          data-testid={`button-edit-bank-${banco.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingBanco(banco)}
                          data-testid={`button-delete-bank-${banco.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!deletingBanco} onOpenChange={() => setDeletingBanco(null)}>
        <AlertDialogContent data-testid="dialog-delete-bank">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o banco "{deletingBanco?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-bank">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-delete-bank"
              onClick={() => deletingBanco && deleteMutation.mutate(deletingBanco.id)}
              disabled={deleteMutation.isPending}
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