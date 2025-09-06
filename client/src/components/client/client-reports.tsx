import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BarChart3, Download, FileText, TrendingUp, Calendar, PieChart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, Pie } from 'recharts';

export function ClientReports() {
  const [selectedPeriod, setSelectedPeriod] = useState("30");
  const [selectedType, setSelectedType] = useState("all");

  const { data: documents } = useQuery({
    queryKey: ['/api/documents'],
  });

  const { data: stats } = useQuery({
    queryKey: ['/api/client/dashboard/stats'],
  });

  // Filtrar documentos por período
  const filteredDocuments = (documents as any[])?.filter((doc: any) => {
    const docDate = new Date(doc.createdAt);
    const periodDays = parseInt(selectedPeriod);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);
    
    const matchesPeriod = docDate >= cutoffDate;
    const matchesType = selectedType === "all" || doc.bpoType === selectedType;
    
    return matchesPeriod && matchesType;
  }) || [];

  // Dados para gráfico de documentos por dia
  const getDailyData = () => {
    const days: { [key: string]: number } = {};
    const periodDays = parseInt(selectedPeriod);
    
    // Inicializar todos os dias com 0
    for (let i = periodDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateKey = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      days[dateKey] = 0;
    }
    
    // Contar documentos por dia
    filteredDocuments.forEach((doc: any) => {
      const docDate = new Date(doc.createdAt);
      const dateKey = docDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (days.hasOwnProperty(dateKey)) {
        days[dateKey]++;
      }
    });
    
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  };

  // Dados para gráfico de pizza por tipo
  const getTypeData = () => {
    const types: { [key: string]: number } = {};
    
    filteredDocuments.forEach((doc: any) => {
      const type = doc.bpoType || 'Outros';
      types[type] = (types[type] || 0) + 1;
    });
    
    const typeLabels: { [key: string]: string } = {
      'PAGO': 'Pagamentos',
      'AGENDADO': 'Agendamentos',
      'EMITIR_BOLETO': 'Boletos',
      'EMITIR_NF': 'Notas Fiscais'
    };
    
    return Object.entries(types).map(([type, count], index) => ({
      name: typeLabels[type] || type,
      value: count,
      color: ['#E40064', '#0B0E30', '#22c55e', '#f59e0b', '#8b5cf6'][index % 5]
    }));
  };

  // Dados para gráfico de status
  const getStatusData = () => {
    const statuses: { [key: string]: number } = {};
    
    filteredDocuments.forEach((doc: any) => {
      const status = doc.status || 'Desconhecido';
      statuses[status] = (statuses[status] || 0) + 1;
    });
    
    const statusLabels: { [key: string]: string } = {
      'VALID': 'Válidos',
      'WARNING': 'Com Avisos',
      'ERROR': 'Com Erros',
      'RECEBIDO': 'Recebidos',
      'VALIDANDO': 'Processando'
    };
    
    return Object.entries(statuses).map(([status, count], index) => ({
      name: statusLabels[status] || status,
      value: count,
      color: ['#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'][index % 5]
    }));
  };

  const dailyData = getDailyData();
  const typeData = getTypeData();
  const statusData = getStatusData();

  const exportReport = () => {
    const csvContent = [
      ['Nome do Arquivo', 'Tipo', 'Status', 'Data de Envio', 'Empresa', 'Valor'].join(','),
      ...filteredDocuments.map((doc: any) => [
        `"${doc.originalName}"`,
        doc.bpoType || '',
        doc.status || '',
        new Date(doc.createdAt).toLocaleDateString('pt-BR'),
        `"${doc.extractedData?.razao_social || ''}"`,
        doc.extractedData?.valor || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `relatorio-documentos-${selectedPeriod}dias.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-gilroy font-bold text-foreground">
          Relatórios
        </h1>
        <p className="text-muted-foreground mt-2">
          Analise o desempenho e estatísticas dos seus documentos
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Configurações do Relatório</span>
            </div>
            <Button onClick={exportReport} data-testid="button-export-report">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger data-testid="select-period">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger data-testid="select-report-type">
                <SelectValue placeholder="Tipo de Operação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                <SelectItem value="PAGO">Pagamentos</SelectItem>
                <SelectItem value="AGENDADO">Agendamentos</SelectItem>
                <SelectItem value="EMITIR_BOLETO">Boletos</SelectItem>
                <SelectItem value="EMITIR_NF">Notas Fiscais</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Documentos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredDocuments.length}</div>
            <p className="text-xs text-muted-foreground">
              Últimos {selectedPeriod} dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredDocuments.length > 0 
                ? Math.round((filteredDocuments.filter((d: any) => d.status === 'VALID').length / filteredDocuments.length) * 100)
                : 0
              }%
            </div>
            <p className="text-xs text-muted-foreground">
              Documentos processados com sucesso
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Média Diária</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(filteredDocuments.length / parseInt(selectedPeriod))}
            </div>
            <p className="text-xs text-muted-foreground">
              Documentos por dia
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tipo Mais Usado</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {typeData.length > 0 ? typeData.sort((a, b) => b.value - a.value)[0]?.name || 'N/A' : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              Operação mais frequente
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Documents Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Documentos por Dia</CardTitle>
            <CardDescription>
              Volume de documentos enviados nos últimos {selectedPeriod} dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#E40064" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Document Types Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Tipo</CardTitle>
            <CardDescription>
              Proporção de documentos por tipo de operação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Tooltip />
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}