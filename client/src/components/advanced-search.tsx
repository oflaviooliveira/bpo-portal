// FASE 3: Componente de busca avançada para documentos
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, Calendar, DollarSign, AlertCircle } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const statusOptions = [
  { value: "RECEBIDO", label: "Recebido" },
  { value: "VALIDANDO", label: "Validando" },
  { value: "PENDENTE_REVISAO", label: "Pendente Revisão" },
  { value: "CLASSIFICADO", label: "Classificado" },
  { value: "PAGO_A_CONCILIAR", label: "Pago - A Conciliar" },
  { value: "AGENDADO", label: "Agendado" },
  { value: "A_PAGAR_HOJE", label: "A Pagar Hoje" },
  { value: "EM_CONCILIACAO", label: "Em Conciliação" },
  { value: "ARQUIVADO", label: "Arquivado" },
];

const typeOptions = [
  { value: "PAGO", label: "Pago" },
  { value: "AGENDADO", label: "Agendado" },
  { value: "EMITIR_BOLETO", label: "Emitir Boleto" },
  { value: "EMITIR_NF", label: "Emitir NF" },
];

export function AdvancedSearch({ onResults }: { onResults: (documents: any[]) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchCriteria, setSearchCriteria] = useState({
    text: "",
    dateRange: { start: "", end: "" },
    amountRange: { min: "", max: "" },
    statuses: [] as string[],
    types: [] as string[],
    hasConflicts: false,
  });
  const { toast } = useToast();

  const { data: clients } = useQuery({ queryKey: ["/api/clients"] });
  const { data: banks } = useQuery({ queryKey: ["/api/banks"] });

  const searchMutation = useMutation({
    mutationFn: async (criteria: typeof searchCriteria) => {
      const response = await apiRequest("POST", "/api/documents/advanced-search", {
        ...criteria,
        amountRange: {
          min: criteria.amountRange.min ? parseFloat(criteria.amountRange.min) : undefined,
          max: criteria.amountRange.max ? parseFloat(criteria.amountRange.max) : undefined,
        },
      });
      return response.json();
    },
    onSuccess: (documents) => {
      onResults(documents);
      setIsOpen(false);
      toast({
        title: "Busca realizada",
        description: `${documents.length} documentos encontrados`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro na busca",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    searchMutation.mutate(searchCriteria);
  };

  const handleClearFilters = () => {
    setSearchCriteria({
      text: "",
      dateRange: { start: "", end: "" },
      amountRange: { min: "", max: "" },
      statuses: [],
      types: [],
      hasConflicts: false,
    });
  };

  const toggleStatus = (status: string) => {
    setSearchCriteria(prev => ({
      ...prev,
      statuses: prev.statuses.includes(status)
        ? prev.statuses.filter(s => s !== status)
        : [...prev.statuses, status]
    }));
  };

  const toggleType = (type: string) => {
    setSearchCriteria(prev => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter(t => t !== type)
        : [...prev.types, type]
    }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2" data-testid="button-advanced-search">
          <Search className="h-4 w-4" />
          Busca Avançada
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Busca Avançada de Documentos
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Busca por texto */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Label htmlFor="search-text">Buscar por texto</Label>
                <Input
                  id="search-text"
                  placeholder="Nome do arquivo, observações, texto extraído..."
                  value={searchCriteria.text}
                  onChange={(e) => setSearchCriteria(prev => ({ ...prev, text: e.target.value }))}
                  data-testid="input-search-text"
                />
              </div>
            </CardContent>
          </Card>

          {/* Filtros de data */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <Label>Período</Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date-start">Data inicial</Label>
                    <Input
                      id="date-start"
                      type="date"
                      value={searchCriteria.dateRange.start}
                      onChange={(e) => setSearchCriteria(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, start: e.target.value }
                      }))}
                      data-testid="input-date-start"
                    />
                  </div>
                  <div>
                    <Label htmlFor="date-end">Data final</Label>
                    <Input
                      id="date-end"
                      type="date"
                      value={searchCriteria.dateRange.end}
                      onChange={(e) => setSearchCriteria(prev => ({
                        ...prev,
                        dateRange: { ...prev.dateRange, end: e.target.value }
                      }))}
                      data-testid="input-date-end"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filtros de valor */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <Label>Faixa de valores</Label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount-min">Valor mínimo</Label>
                    <Input
                      id="amount-min"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={searchCriteria.amountRange.min}
                      onChange={(e) => setSearchCriteria(prev => ({
                        ...prev,
                        amountRange: { ...prev.amountRange, min: e.target.value }
                      }))}
                      data-testid="input-amount-min"
                    />
                  </div>
                  <div>
                    <Label htmlFor="amount-max">Valor máximo</Label>
                    <Input
                      id="amount-max"
                      type="number"
                      step="0.01"
                      placeholder="999999.99"
                      value={searchCriteria.amountRange.max}
                      onChange={(e) => setSearchCriteria(prev => ({
                        ...prev,
                        amountRange: { ...prev.amountRange, max: e.target.value }
                      }))}
                      data-testid="input-amount-max"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filtros de status */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Label>Status</Label>
                <div className="grid grid-cols-3 gap-2">
                  {statusOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${option.value}`}
                        checked={searchCriteria.statuses.includes(option.value)}
                        onCheckedChange={() => toggleStatus(option.value)}
                        data-testid={`checkbox-status-${option.value}`}
                      />
                      <Label htmlFor={`status-${option.value}`} className="text-sm">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filtros de tipo */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Label>Tipo de documento</Label>
                <div className="grid grid-cols-2 gap-2">
                  {typeOptions.map((option) => (
                    <div key={option.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${option.value}`}
                        checked={searchCriteria.types.includes(option.value)}
                        onCheckedChange={() => toggleType(option.value)}
                        data-testid={`checkbox-type-${option.value}`}
                      />
                      <Label htmlFor={`type-${option.value}`} className="text-sm">
                        {option.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Filtros especiais */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Label>Filtros especiais</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="has-conflicts"
                    checked={searchCriteria.hasConflicts}
                    onCheckedChange={(checked) => setSearchCriteria(prev => ({
                      ...prev,
                      hasConflicts: !!checked
                    }))}
                    data-testid="checkbox-has-conflicts"
                  />
                  <Label htmlFor="has-conflicts" className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-500" />
                    Apenas documentos com conflitos de validação
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botões de ação */}
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleClearFilters}
              data-testid="button-clear-filters"
            >
              Limpar filtros
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                data-testid="button-cancel-search"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSearch}
                disabled={searchMutation.isPending}
                className="bg-gquicks-primary hover:bg-gquicks-primary/90"
                data-testid="button-execute-search"
              >
                {searchMutation.isPending ? "Buscando..." : "Buscar"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}