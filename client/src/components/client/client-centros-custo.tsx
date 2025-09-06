import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Target, Pencil, Search, TrendingUp } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { z } from "zod";

const centroCustoSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  code: z.string().min(1, "Código é obrigatório"),
  description: z.string().optional(),
});

type CentroCustoFormData = z.infer<typeof centroCustoSchema>;

interface CentroCusto {
  id: string;
  name: string;
  code: string;
  description?: string;
  createdAt: string;
  usageCount?: number;
}

export function ClientCentrosCusto() {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CentroCustoFormData>({
    resolver: zodResolver(centroCustoSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
    },
  });

  const { data: centrosCusto = [], isLoading } = useQuery<CentroCusto[]>({
    queryKey: ['/api/cost-centers'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CentroCustoFormData) => {
      const response = await apiRequest('POST', '/api/cost-centers', data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cost-centers'] });
      toast({
        title: "Sucesso",
        description: "Centro de custo cadastrado com sucesso",
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

  const onSubmit = (data: CentroCustoFormData) => {
    createMutation.mutate(data);
  };

  const filteredCentrosCusto = Array.isArray(centrosCusto)
    ? centrosCusto.filter((centro: CentroCusto) =>
        centro.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        centro.code.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Centros de Custo</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Gerencie os centros de custo para controle financeiro
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-cost-center" className="bg-gquicks-primary hover:bg-gquicks-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Centro de Custo
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="dialog-add-cost-center">
            <DialogHeader>
              <DialogTitle>Novo Centro de Custo</DialogTitle>
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
                          data-testid="input-cost-center-code"
                          placeholder="Código do centro de custo"
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
                          data-testid="input-cost-center-name"
                          placeholder="Nome do centro de custo"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          data-testid="input-cost-center-description"
                          placeholder="Descrição do centro de custo"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    data-testid="button-cancel-cost-center"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-save-cost-center"
                  >
                    {createMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
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
            data-testid="input-search-cost-centers"
            placeholder="Buscar centros de custo..."
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
            <Target className="h-5 w-5" />
            Centros de Custo Cadastrados
          </CardTitle>
          <CardDescription>
            {filteredCentrosCusto.length} centro(s) de custo encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="text-gray-500">Carregando...</div>
            </div>
          ) : filteredCentrosCusto.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'Nenhum centro de custo encontrado' : 'Nenhum centro de custo cadastrado'}
            </div>
          ) : (
            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Uso</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCentrosCusto.map((centro: CentroCusto) => (
                    <TableRow key={centro.id}>
                      <TableCell data-testid={`text-code-${centro.id}`} className="font-mono font-medium">
                        {centro.code}
                      </TableCell>
                      <TableCell data-testid={`text-name-${centro.id}`}>
                        {centro.name}
                      </TableCell>
                      <TableCell data-testid={`text-description-${centro.id}`}>
                        {centro.description || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-gray-400" />
                          {centro.usageCount || 0} docs
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(centro.createdAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`button-edit-${centro.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}