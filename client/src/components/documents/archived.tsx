import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Search, Download, Archive, RefreshCw, Calendar, Filter } from "lucide-react";

const statusConfig = {
  ARQUIVADO: { label: "Arquivado", className: "bg-gray-100 text-gray-800" },
};

export function Archived() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedBank, setSelectedBank] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Queries - Wave 1 Enhanced
  const { data: archivedData, isLoading, refetch } = useQuery({
    queryKey: ["/api/documents/archived", searchTerm, selectedClient, selectedBank, dateFrom, dateTo],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (selectedClient !== "all") params.set("clientId", selectedClient);
      if (selectedBank !== "all") params.set("bankId", selectedBank);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      return fetch(`/api/documents/archived?${params}`).then(res => res.json());
    }
  });

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: banks } = useQuery({
    queryKey: ["/api/banks"],
  });

  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
  });

  const archivedDocs = archivedData?.documents || [];
  const stats = archivedData?.stats || { total: 0, totalAmount: 0, byType: { pago: 0, agendado: 0, boleto: 0, nf: 0 } };

  const formatCurrency = (value: string | number | null) => {
    if (!value) return "-";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(num);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  // Filter documents based on category (server already handles other filters)
  const filteredDocs = archivedDocs?.filter((doc: any) => {
    if (selectedCategory !== "all" && doc.categoryId !== selectedCategory) {
      return false;
    }
    return true;
  }) || [];

  const handleExportCSV = () => {
    // TODO: Implementar exportação CSV
    console.log("Exportando CSV...");
  };

  const handleExportZIP = () => {
    // TODO: Implementar exportação ZIP
    console.log("Exportando ZIP...");
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedClient("all");
    setSelectedBank("all");
    setSelectedCategory("all");
    setDateFrom("");
    setDateTo("");
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4" />
          <div className="h-96 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-gilroy font-bold text-2xl text-foreground">Documentos Arquivados</h2>
          <p className="text-muted-foreground">Histórico completo com busca avançada e exportação</p>
        </div>
        <div className="flex space-x-3">
          <Button 
            onClick={handleExportCSV}
            variant="outline"
            className="text-green-600 border-green-600 hover:bg-green-600 hover:text-white"
            data-testid="button-export-csv"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button 
            onClick={handleExportZIP}
            variant="outline"
            className="text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white"
            data-testid="button-export-zip"
          >
            <Archive className="w-4 h-4 mr-2" />
            Exportar ZIP
          </Button>
          <Button 
            onClick={() => refetch()}
            className="bg-gquicks-primary hover:bg-gquicks-primary/90"
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filtros de Busca
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Buscar Arquivo</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Nome do arquivo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cliente</label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os clientes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os clientes</SelectItem>
                  {(clients as any[])?.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Banco</label>
              <Select value={selectedBank} onValueChange={setSelectedBank}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os bancos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os bancos</SelectItem>
                  {(banks as any[])?.map((bank: any) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Categoria</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas as categorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {(categories as any[])?.map((category: any) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Inicial</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="input-date-from"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Data Final</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="input-date-to"
              />
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            <Button
              variant="outline"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              Limpar Filtros
            </Button>
            <p className="text-sm text-muted-foreground">
              {filteredDocs.length} de {archivedDocs?.length || 0} documentos
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-medium text-foreground">Documento</TableHead>
                <TableHead className="font-medium text-foreground">Cliente</TableHead>
                <TableHead className="font-medium text-foreground">Banco</TableHead>
                <TableHead className="font-medium text-foreground">Categoria</TableHead>
                <TableHead className="font-medium text-foreground">Valor</TableHead>
                <TableHead className="font-medium text-foreground">Data</TableHead>
                <TableHead className="font-medium text-foreground">Status</TableHead>
                <TableHead className="font-medium text-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <Archive className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum documento arquivado encontrado</p>
                    {(searchTerm || selectedClient !== "all" || selectedBank !== "all" || selectedCategory !== "all" || dateFrom || dateTo) && (
                      <p className="text-sm mt-2">Tente ajustar os filtros de busca</p>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocs.map((doc: any) => (
                  <TableRow 
                    key={doc.id} 
                    className="hover:bg-muted/30"
                    data-testid={`archived-row-${doc.id}`}
                  >
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                          <Archive className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground truncate max-w-48">
                            {doc.originalName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {doc.documentType}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-foreground">
                      {doc.client?.name || "-"}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {doc.bank?.name || "-"}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {doc.category?.name || "-"}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {formatCurrency(doc.amount)}
                    </TableCell>
                    <TableCell className="text-foreground">
                      {formatDate(doc.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusConfig.ARQUIVADO.className}>
                        {statusConfig.ARQUIVADO.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white"
                          data-testid={`button-download-${doc.id}`}
                        >
                          <Download className="w-4 h-4 mr-1" />
                          Baixar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}