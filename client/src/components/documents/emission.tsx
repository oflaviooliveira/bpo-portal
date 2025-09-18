import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Receipt, RefreshCw, CheckCircle2, Clock } from "lucide-react";

const statusConfig = {
  AGUARDANDO_RECEBIMENTO: { label: "Aguardando Recebimento", className: "bg-cyan-100 text-cyan-800" },
  EM_CONCILIACAO: { label: "Em Conciliação", className: "bg-amber-100 text-amber-800" },
};

export function Emission() {
  const [activeTab, setActiveTab] = useState("boletos");
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [showEmissionDialog, setShowEmissionDialog] = useState(false);

  // Queries para emissão
  const { data: boletoDocs = [], isLoading: loadingBoletos, refetch: refetchBoletos } = useQuery({
    queryKey: ["/api/documents/emission/boletos"],
    queryFn: () => fetch("/api/documents/emission/boletos").then(res => res.json())
  });

  const { data: nfDocs = [], isLoading: loadingNF, refetch: refetchNF } = useQuery({
    queryKey: ["/api/documents/emission/nf"],
    queryFn: () => fetch("/api/documents/emission/nf").then(res => res.json())
  });

  const handleRefreshAll = () => {
    refetchBoletos();
    refetchNF();
  };

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
    }).format(new Date(date));
  };

  const handleEmitDocument = (doc: any) => {
    setSelectedDoc(doc);
    setShowEmissionDialog(true);
  };

  const renderDocumentTable = (documents: any[], isLoading: boolean, type: "BOLETO" | "NF") => {
    if (isLoading) {
      return (
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>
      );
    }

    if (!documents || documents.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {type === "BOLETO" ? (
            <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          ) : (
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          )}
          <p>Nenhum {type === "BOLETO" ? "boleto" : "nota fiscal"} pendente de emissão</p>
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-medium text-foreground">Documento</TableHead>
            <TableHead className="font-medium text-foreground">Cliente</TableHead>
            <TableHead className="font-medium text-foreground">Status</TableHead>
            <TableHead className="font-medium text-foreground">Valor</TableHead>
            <TableHead className="font-medium text-foreground">Vencimento</TableHead>
            <TableHead className="font-medium text-foreground">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc: any) => (
            <TableRow 
              key={doc.id} 
              className="hover:bg-muted/30"
              data-testid={`emission-row-${doc.id}`}
            >
              <TableCell>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
                    {type === "BOLETO" ? (
                      <Receipt className="w-4 h-4 text-cyan-600" />
                    ) : (
                      <FileText className="w-4 h-4 text-blue-600" />
                    )}
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
              <TableCell>
                <Badge className={statusConfig[doc.status as keyof typeof statusConfig]?.className || "bg-gray-100 text-gray-800"}>
                  {statusConfig[doc.status as keyof typeof statusConfig]?.label || doc.status}
                </Badge>
              </TableCell>
              <TableCell className="font-medium text-foreground">
                {formatCurrency(doc.amount)}
              </TableCell>
              <TableCell className="text-foreground">
                {formatDate(doc.dueDate)}
              </TableCell>
              <TableCell>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEmitDocument(doc)}
                    className="text-gquicks-primary border-gquicks-primary hover:bg-gquicks-primary hover:text-white"
                    data-testid={`button-emit-${doc.id}`}
                  >
                    {type === "BOLETO" ? (
                      <>
                        <Receipt className="w-4 h-4 mr-1" />
                        Emitir Boleto
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-1" />
                        Emitir NF
                      </>
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-gilroy font-bold text-2xl text-foreground">Emissão de Documentos</h2>
          <p className="text-muted-foreground">Gerencie emissão de boletos e notas fiscais</p>
        </div>
        <Button 
          onClick={handleRefreshAll}
          className="bg-gquicks-primary hover:bg-gquicks-primary/90"
          data-testid="button-refresh-all"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar Tudo
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Boletos Pendentes</CardTitle>
            <Receipt className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-600">
              {boletoDocs?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Para emissão
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">NFs Pendentes</CardTitle>
            <FileText className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {nfDocs?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Para emissão
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different document types */}
      <Card>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="border-b">
              <TabsList className="w-full justify-start h-12 bg-transparent">
                <TabsTrigger 
                  value="boletos" 
                  className="data-[state=active]:bg-gquicks-primary data-[state=active]:text-white"
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  Boletos ({boletoDocs?.length || 0})
                </TabsTrigger>
                <TabsTrigger 
                  value="nf" 
                  className="data-[state=active]:bg-gquicks-primary data-[state=active]:text-white"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Notas Fiscais ({nfDocs?.length || 0})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="boletos" className="p-6">
              {renderDocumentTable(boletoDocs, loadingBoletos, "BOLETO")}
            </TabsContent>

            <TabsContent value="nf" className="p-6">
              {renderDocumentTable(nfDocs, loadingNF, "NF")}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Emission Dialog */}
      <Dialog open={showEmissionDialog} onOpenChange={setShowEmissionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedDoc?.documentType === "EMITIR_BOLETO" ? "Emitir Boleto" : "Emitir Nota Fiscal"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="value">Valor</Label>
                <Input
                  id="value"
                  defaultValue={selectedDoc?.amount || ""}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Vencimento</Label>
                <Input
                  id="dueDate"
                  type="date"
                  defaultValue={selectedDoc?.dueDate ? new Date(selectedDoc.dueDate).toISOString().split('T')[0] : ""}
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="instructions">Instruções</Label>
              <Textarea
                id="instructions"
                placeholder="Instruções específicas para o documento..."
                rows={3}
              />
            </div>

            {selectedDoc?.documentType === "EMITIR_BOLETO" && (
              <div className="grid gap-4">
                <h4 className="font-semibold">Dados do Pagador</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="payerName">Nome/Razão Social</Label>
                    <Input id="payerName" placeholder="Nome do pagador" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="payerDoc">CPF/CNPJ</Label>
                    <Input id="payerDoc" placeholder="000.000.000-00" />
                  </div>
                </div>
              </div>
            )}

            {selectedDoc?.documentType === "EMITIR_NF" && (
              <div className="grid gap-4">
                <h4 className="font-semibold">Dados do Tomador</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="takerName">Nome/Razão Social</Label>
                    <Input id="takerName" placeholder="Nome do tomador" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="serviceCode">Código do Serviço</Label>
                    <Input id="serviceCode" placeholder="Código do serviço" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowEmissionDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                className="bg-gquicks-primary hover:bg-gquicks-primary/90"
                onClick={() => {
                  // TODO: Implementar emissão
                  console.log("Emitindo documento:", selectedDoc);
                  setShowEmissionDialog(false);
                }}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Emitir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}