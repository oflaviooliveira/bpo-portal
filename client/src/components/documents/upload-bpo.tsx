import React, { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CloudUpload, Upload as UploadIcon, FileText, Calendar, DollarSign, Building2, Sparkles, AlertTriangle, CheckCircle2, Bot, CheckCircle, X, RotateCcw, Eye, Plus, Cog, Info, MessageSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { AutoSupplierModal } from "@/components/client/auto-supplier-modal";
import { 
  DocumentSuggestion, 
  ProcessingState, 
  AutoSupplierModalState,
  BpoUploadFormData,
  ProcessFileResponse,
  ApiResponse 
} from "@shared/types";

// Schema de validação inteligente
const bpoUploadSchema = z.object({
  // Seleção de tipo
  documentType: z.enum(["PAGO", "AGENDADO", "EMITIR_BOLETO", "EMITIR_NF"]),

  // Dados básicos sempre obrigatórios
  amount: z.string().min(1, "Valor é obrigatório"),
  contraparteId: z.string().optional(), // Será validado condicionalmente abaixo
  description: z.string().optional(), // Será validado condicionalmente por tipo

  // Dados condicionais por tipo
  competenceDate: z.string().optional(),
  realPaidDate: z.string().optional(),
  scheduledDate: z.string().optional(),

  // Dados opcionais BPO
  bankId: z.string().optional(),
  categoryId: z.string().optional(),
  costCenterId: z.string().optional(),
  notes: z.string().optional(),

  // Campos para boleto/NF - dados do tomador (expandidos)
  payerDocument: z.string().optional(),
  payerName: z.string().optional(),
  payerEmail: z.string().optional(),
  payerPhone: z.string().optional(),
  payerContactName: z.string().optional(),
  payerStateRegistration: z.string().optional(), // IE - opcional
  
  // Endereço completo do tomador
  payerStreet: z.string().optional(),
  payerNumber: z.string().optional(),
  payerComplement: z.string().optional(),
  payerNeighborhood: z.string().optional(),
  payerCity: z.string().optional(),
  payerState: z.string().optional(), // UF
  payerZipCode: z.string().optional(), // CEP
  
  // Compatibilidade (manter o campo legado)
  payerAddress: z.string().optional(),
  
  // Campos de serviço
  serviceCode: z.string().optional(),
  serviceDescription: z.string().optional(),
  instructions: z.string().optional(),
}).superRefine((data, ctx) => {
  // Validação condicional da contraparte - obrigatória para PAGO e AGENDADO
  if ((data.documentType === "PAGO" || data.documentType === "AGENDADO") && !data.contraparteId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Contraparte é obrigatória para documentos PAGO e AGENDADO",
      path: ["contraparteId"]
    });
  }

  // Validação condicional: description obrigatória apenas para PAGO e AGENDADO
  if ((data.documentType === "PAGO" || data.documentType === "AGENDADO") && !data.description) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Descrição é obrigatória para documentos PAGO e AGENDADO",
      path: ["description"]
    });
  }

  // Validação condicional por tipo
  if (data.documentType === "PAGO") {
    if (!data.competenceDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data de Competência é obrigatória para documentos PAGO",
        path: ["competenceDate"]
      });
    }
    if (!data.realPaidDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data Real de Pagamento é obrigatória para documentos PAGO",
        path: ["realPaidDate"]
      });
    }
  }

  if (data.documentType === "AGENDADO") {
    if (!data.scheduledDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data para Agendamento é obrigatória para documentos AGENDADO",
        path: ["scheduledDate"]
      });
    }
    if (!data.bankId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Banco é obrigatório para agendamento",
        path: ["bankId"]
      });
    }
  }

  if (data.documentType === "EMITIR_BOLETO") {
    // 🔴 CAMPOS OBRIGATÓRIOS PARA BOLETO (mantém validação original)
    const requiredFields = [
      // Campos de negócio obrigatórios
      { field: "categoryId", name: "Categoria" },
      { field: "costCenterId", name: "Centro de Custo" },
      { field: "scheduledDate", name: "Data de Vencimento" }, // será mapeado para dueDate
      
      // Dados do tomador obrigatórios
      { field: "payerDocument", name: "CNPJ/CPF do Tomador" },
      { field: "payerName", name: "Nome/Razão Social" },
      { field: "payerEmail", name: "Email" },
      { field: "payerPhone", name: "Telefone" },
      { field: "payerStreet", name: "Rua/Avenida" },
      { field: "payerNumber", name: "Número" },
      { field: "payerNeighborhood", name: "Bairro" },
      { field: "payerCity", name: "Cidade" },
      { field: "payerState", name: "Estado" },
      { field: "payerZipCode", name: "CEP" }
    ];

    requiredFields.forEach(({ field, name }) => {
      if (!data[field as keyof typeof data]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${name} é obrigatório para ${data.documentType}`,
          path: [field]
        });
      }
    });
  }

  if (data.documentType === "EMITIR_NF") {
    // 🎯 VALIDAÇÃO SLA SIMPLIFICADA - Apenas campos essenciais conforme SLA
    const requiredFieldsNF = [
      { field: "payerDocument", name: "CNPJ/CPF do Tomador" },
      { field: "payerName", name: "Nome/Razão Social" },
      { field: "payerPhone", name: "Telefone" },
      { field: "payerStreet", name: "Rua/Avenida" },
      { field: "payerNumber", name: "Número" },
      { field: "payerNeighborhood", name: "Bairro" },
      { field: "payerCity", name: "Cidade" },
      { field: "payerState", name: "Estado" },
      { field: "payerZipCode", name: "CEP" }
    ];

    requiredFieldsNF.forEach(({ field, name }) => {
      if (!data[field as keyof typeof data]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${name} é obrigatório para Nota Fiscal`,
          path: [field]
        });
      }
    });

    // Descrição do serviço obrigatória
    if (!data.serviceDescription) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Descrição do Serviço é obrigatória para emissão de NF",
        path: ["serviceDescription"]
      });
    }
  }
});

type BpoUploadData = z.infer<typeof bpoUploadSchema>;

export function UploadBpo() {

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingState, setProcessingState] = useState<ProcessingState>({ 
    stage: 'ready', 
    message: 'Selecione um arquivo para começar' 
  });
  const [suggestions, setSuggestions] = useState<DocumentSuggestion[]>([]);
  const [documentMetadata, setDocumentMetadata] = useState<any>(null);
  const [autoFilledFields, setAutoFilledFields] = useState<any[]>([]);
  const [showAutoFillConfirmation, setShowAutoFillConfirmation] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estado para auto-detecção de fornecedor
  const [autoSupplierModal, setAutoSupplierModal] = useState<AutoSupplierModalState>({ open: false });

  // Estado para visualização de documento
  const [documentPreviewModal, setDocumentPreviewModal] = useState(false);

  // 🎯 NOVO: Estados para busca híbrida de clientes
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // 🔒 VALIDAÇÃO PREVENTIVA: Validar CNPJ/CPF
  const validateDocument = (doc: string): { isValid: boolean; type?: 'CPF' | 'CNPJ' } => {
    const cleanDoc = doc.replace(/\D/g, '');
    
    if (cleanDoc.length === 11) {
      return { isValid: validateCPF(cleanDoc), type: 'CPF' };
    } else if (cleanDoc.length === 14) {
      return { isValid: validateCNPJ(cleanDoc), type: 'CNPJ' };
    }
    
    return { isValid: false };
  };

  const validateCNPJ = (cnpj: string): boolean => {
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    
    // CNPJs de teste válidos para desenvolvimento
    const testCNPJs = [
      '12345678000190', // 12.345.678/0001-90
      '11222333000181', // 11.222.333/0001-81
      '11444777000161', // 11.444.777/0001-61
    ];
    
    if (testCNPJs.includes(cnpj)) {
      return true;
    }
    
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += parseInt(cnpj[i]) * weights1[i];
    }
    let remainder = sum % 11;
    const digit1 = remainder < 2 ? 0 : 11 - remainder;
    if (digit1 !== parseInt(cnpj[12])) return false;
    
    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += parseInt(cnpj[i]) * weights2[i];
    }
    remainder = sum % 11;
    const digit2 = remainder < 2 ? 0 : 11 - remainder;
    
    return digit2 === parseInt(cnpj[13]);
  };

  const validateCPF = (cpf: string): boolean => {
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf[i]) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf[9])) return false;
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf[i]) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    
    return remainder === parseInt(cpf[10]);
  };

  // 🎯 NOVA FUNCIONALIDADE: Busca inteligente de clientes
  const searchClients = async (searchTerm: string) => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    
    try {
      const response = await fetch(`/api/clientes/search?q=${encodeURIComponent(searchTerm)}`);
      if (response.ok) {
        const results = await response.json();
        setSearchResults(results);
      }
    } catch (error) {
      console.error('Erro na busca de clientes:', error);
    }
  };

  // 🚀 FUNCIONALIDADE PRINCIPAL: Auto-preenchimento inteligente
  const autoFillClientData = (cliente: any) => {
    // 🔒 VALIDAÇÃO PREVENTIVA: Verificar CNPJ/CPF antes do preenchimento
    if (cliente.document && documentType === 'EMITIR_BOLETO') {
      const docValidation = validateDocument(cliente.document);
      if (!docValidation.isValid) {
        toast({
          title: "⚠️ CNPJ/CPF Inválido",
          description: `O documento ${cliente.document} é inválido. Use CNPJs de teste: 11.222.333/0001-81 ou 11.444.777/0001-61`,
          variant: "destructive",
          duration: 8000,
        });
        console.warn("🚨 Cliente com documento inválido:", cliente.name, cliente.document);
        
        // Ainda permite selecionar, mas com aviso claro
        setSelectedClient(cliente);
        setShowNewClientForm(false);
        
        // Preencher com CNPJ válido sugerido
        form.setValue("payerDocument", "11.222.333/0001-81");
        toast({
          title: "🔧 Documento Corrigido",
          description: "Documento substituído por CNPJ válido. Você pode editá-lo se necessário.",
          duration: 5000,
        });
      } else {
        form.setValue("payerDocument", cliente.document || "");
      }
    } else {
      form.setValue("payerDocument", cliente.document || "");
    }

    setSelectedClient(cliente);
    setShowNewClientForm(false);
    
    // 🎯 Auto-preenchimento COMPLETO de todos os campos
    form.setValue("payerName", cliente.name || "");
    form.setValue("payerEmail", cliente.email || "");
    form.setValue("payerPhone", cliente.phone || "");
    form.setValue("payerContactName", cliente.contactName || "");
    form.setValue("payerStateRegistration", cliente.stateRegistration || "");
    
    // Endereço completo
    form.setValue("payerStreet", cliente.street || "");
    form.setValue("payerNumber", cliente.number || "");
    form.setValue("payerComplement", cliente.complement || "");
    form.setValue("payerNeighborhood", cliente.neighborhood || "");
    form.setValue("payerCity", cliente.city || "");
    form.setValue("payerState", cliente.state || "");
    form.setValue("payerZipCode", cliente.zipCode || "");

    // 🎊 Feedback visual de sucesso
    toast({
      title: "✅ Cliente selecionado!",
      description: `Dados de ${cliente.name} preenchidos automaticamente`,
      duration: 3000,
    });
    
    // Limpar busca
    setClientSearchTerm('');
    setSearchResults([]);
  };

  const form = useForm<BpoUploadData>({
    resolver: zodResolver(bpoUploadSchema),
    defaultValues: {
      documentType: "PAGO",
      amount: "",
      contraparteId: "",
      description: "",
      notes: "",
    },
  });

  const documentType = form.watch("documentType");
  const needsDocument = documentType === "PAGO" || documentType === "AGENDADO";

  // Buscar dados do sistema
  const { data: banks = [] as any[] } = useQuery({ queryKey: ["/api/banks"] });
  const { data: categories = [] as any[] } = useQuery({ queryKey: ["/api/categories"] });
  const { data: costCenters = [] as any[] } = useQuery({ queryKey: ["/api/cost-centers"] });

  // Buscar contrapartes filtradas por tipo de documento - ENDPOINT DINÂMICO
  const getContraparteEndpoint = () => {
    if (documentType === "PAGO" || documentType === "AGENDADO") {
      return "/api/fornecedores"; // Para documentos PAGO/AGENDADO, busca fornecedores (canBeSupplier: true)
    } else {
      return "/api/clientes"; // Para EMITIR_BOLETO/EMITIR_NF, busca clientes (canBeClient: true)
    }
  };

  const { data: contrapartes = [] } = useQuery<any[]>({
    queryKey: [getContraparteEndpoint()],
    enabled: !!documentType, // Só busca quando tem tipo de documento
  });

  // Mutation para processar arquivo com IA
  const processFileMutation = useMutation<ProcessFileResponse, Error, File>({
    mutationFn: async (file: File): Promise<ProcessFileResponse> => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/documents/process-file", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro ao processar arquivo");
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log("✅ Processamento IA concluído:", data);
      
      // 🚨 DEBUG EXTREMO: Logs abrangentes para rastrear tudo
      console.log("🔍 ===== DEBUG PROCESSAMENTO IA =====");
      console.log("📊 Estrutura completa do data:", JSON.stringify(data, null, 2));
      console.log("🎯 data.suggestions:", data.suggestions);
      console.log("📋 data.suggestions keys:", data.suggestions ? Object.keys(data.suggestions) : 'N/A');
      console.log("🏢 data.suggestions.supplier:", data.suggestions?.supplier);
      console.log("🏢 data.suggestions.contraparte:", data.suggestions?.contraparte);
      console.log("📄 data.suggestions.documento:", data.suggestions?.documento);
      console.log("📄 data.suggestions.documento:", data.suggestions?.documento);
      console.log("🔑 data.suggestions.realData:", data.suggestions?.realData);
      console.log("✅ data.suggestions.hasRealData:", data.suggestions?.hasRealData);
      console.log("🏢 data.suggestions.realData?.supplier:", data.suggestions?.realData?.supplier);
      console.log("📊 Contrapartes disponíveis:", contrapartes?.length || 0);
      console.log("🔍 ===== FIM DEBUG PROCESSAMENTO =====");

      // Verificar se temos sugestões da API
      if (!data.suggestions) {
        console.log("⚠️ Nenhuma sugestão recebida da API");
        setProcessingState({ 
          stage: 'ready', 
          message: 'Documento processado mas sem sugestões automáticas' 
        });
        return;
      }

      console.log("🎯 Recebendo sugestões:", data.suggestions);

      // Mapear sugestões da IA usando estrutura correta
      const newSuggestions: DocumentSuggestion[] = [];

      if (data.suggestions.amount) {
        newSuggestions.push({
          field: "amount",
          value: data.suggestions.amount,
          confidence: data.suggestions.confidence?.amount || 95,
          source: "IA"
        });
        form.setValue("amount", data.suggestions.amount);
        console.log("💰 Valor preenchido:", data.suggestions.amount);
      }

      if (data.suggestions?.supplier || data.suggestions?.contraparte) {
        const contraparteValue = data.suggestions?.contraparte || data.suggestions?.supplier || '';
        newSuggestions.push({
          field: "contraparte", 
          value: contraparteValue,
          confidence: data.suggestions?.confidence?.supplier || 95,
          source: "IA"
        });

        console.log("🏢 Processando fornecedor da IA:", contraparteValue);
        
        // 🚨 CRÍTICO: DETECÇÃO AUTOMÁTICA DE FORNECEDOR AQUI!
        console.log("🔍 INICIANDO DETECÇÃO AUTOMÁTICA DE FORNECEDOR");
        console.log("📄 Supplier detectado:", contraparteValue);
        console.log("🆔 Document:", data.suggestions?.documento || '');
        
        // Aguardar queries carregarem e executar detecção automática
        setTimeout(() => {
          console.log("🚀 EXECUTANDO detectAndHandleSupplier COM DADOS REAIS:");
          console.log("  Supplier:", contraparteValue);
          console.log("  Document:", data.suggestions?.documento || '');
          
          detectAndHandleSupplier(
            contraparteValue,
            data.suggestions?.documento || '',
            data.suggestions?.confidence?.supplier || 95
          );
        }, 200);
      }

      if (data.suggestions.description) {
        newSuggestions.push({
          field: "description",
          value: data.suggestions.description,
          confidence: data.suggestions.confidence?.description || 95,
          source: "IA"
        });
        form.setValue("description", data.suggestions.description);
        console.log("📝 Descrição preenchida:", data.suggestions.description);
      }

      // Converter datas brasileiras para formato ISO (YYYY-MM-DD)
      const convertBRDateToISO = (brDate: string) => {
        if (!brDate) return "";
        try {
          const [day, month, year] = brDate.split('/');
          const convertedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          console.log(`📅 Conversão de data: ${brDate} → ${convertedDate}`);
          return convertedDate;
        } catch (error) {
          console.log(`⚠️ Erro na conversão de data: ${brDate}`);
          return "";
        }
      };

      // Mapear campos adicionais importantes
      if (data.suggestions.documento) {
        console.log("📄 Documento identificado:", data.suggestions.documento);
      }

      if (data.suggestions.category) {
        console.log("🏷️ Categoria sugerida:", data.suggestions.category);
      }

      if (data.suggestions.centerCost) {
        console.log("🏢 Centro de custo sugerido:", data.suggestions.centerCost);
      }

      // Mapear datas do documento (separadas dos dados BPO reais)
      if (data.suggestions.paymentDate) {
        const convertedDate = convertBRDateToISO(data.suggestions.paymentDate);
        console.log("💳 Data pagamento (documento):", data.suggestions.paymentDate, "→", convertedDate);
      }

      if (data.suggestions.dueDate) {
        const convertedDate = convertBRDateToISO(data.suggestions.dueDate);
        console.log("📅 Data vencimento (documento):", data.suggestions.dueDate, "→", convertedDate);
      }

      // IMPORTANTE: NÃO auto-preencher datas BPO - são dados operacionais reais
      console.log("⚠️ NOTA: Datas do documento NÃO são preenchidas automaticamente nos campos BPO");
      console.log("💡 Usuário deve confirmar as datas reais de operação manualmente");

      // Salvar metadados do documento para referência
      setDocumentMetadata({
        documentDate: data.suggestions.paymentDate || data.suggestions.dueDate,
        documentValue: data.suggestions.amount,
        ocrQuality: data.qualityMetadata?.ocrQuality,
        confidence: data.suggestions.confidence
      });

      setSuggestions(newSuggestions);

      // 📋 NOVA LÓGICA: Aplicar dados reais automaticamente (sem confirmação)
      if (data.suggestions?.hasRealData && data.suggestions?.realData) {
        console.log("📋 Dados reais detectados - preenchimento automático:", data.suggestions.realData);
        
        // Preencher dados reais automaticamente (fatos do documento)
        if (data.suggestions.realData.amount) {
          form.setValue("amount", data.suggestions.realData.amount);
          console.log("💰 Valor preenchido automaticamente:", data.suggestions.realData.amount);
        }
        
        if (data.suggestions.realData.description) {
          form.setValue("description", data.suggestions.realData.description);
          console.log("📝 Descrição preenchida automaticamente:", data.suggestions.realData.description);
        }
        
        // 🏢 DEBUG: Verificar dados recebidos do backend
        console.log("🐛 DEBUG - Dados completos do backend:", JSON.stringify(data, null, 2));
        console.log("🐛 DEBUG - data.suggestions:", data.suggestions);
        console.log("🐛 DEBUG - data.suggestions?.realData:", data.suggestions?.realData);
        console.log("🐛 DEBUG - data.suggestions?.realData?.supplier:", data.suggestions?.realData?.supplier);
        
        // 🏢 NOVA LÓGICA: Detectar fornecedor uma única vez
        if (data.suggestions?.realData?.supplier) {
          console.log("✅ CONDIÇÃO ATENDIDA - Iniciando detecção de fornecedor:");
          console.log("  📄 Supplier:", data.suggestions.realData.supplier);
          console.log("  🆔 Document:", data.suggestions.realData.document);
          
          // Aguardar um momento para garantir que as queries foram carregadas
          console.log("⏰ Agendando execução da detecção em 100ms...");
          setTimeout(() => {
            console.log("🚀 EXECUTANDO detectAndHandleSupplier...");
            detectAndHandleSupplier(
              data.suggestions?.realData?.supplier || '', 
              data.suggestions?.realData?.document || '', 
              90
            );
          }, 100);
        } else {
          console.log("❌ CONDIÇÃO NÃO ATENDIDA - Não há supplier para detectar");
          console.log("  🐛 Verificação detalhada:");
          console.log("    data.suggestions existe?", !!data.suggestions);
          console.log("    data.suggestions.realData existe?", !!data.suggestions?.realData);
          console.log("    data.suggestions.realData.supplier existe?", !!data.suggestions?.realData?.supplier);
          console.log("    Valor do supplier:", data.suggestions?.realData?.supplier);
        }
        
        // 📅 NOVA FUNCIONALIDADE: Auto-preencher data de agendamento com data de vencimento
        if (data.suggestions.realData.dueDate && (documentType === "AGENDADO" || documentType === "PAGO")) {
          const convertedDate = convertBRDateToISO(data.suggestions.realData.dueDate);
          if (convertedDate) {
            // Para PAGO, preencher competenceDate
            if (documentType === "PAGO") {
              form.setValue("competenceDate", convertedDate);
              console.log("📅 Data de competência preenchida automaticamente:", data.suggestions.realData.dueDate, "→", convertedDate);
            }
            
            // Para AGENDADO, preencher scheduledDate
            if (documentType === "AGENDADO") {
              form.setValue("scheduledDate", convertedDate);
              console.log("📅 Data de agendamento preenchida automaticamente:", data.suggestions.realData.dueDate, "→", convertedDate);
            }
            
            console.log("💡 DICA: Você pode alterar esta data se quiser pagar em outro dia");
          }
        }
      }

      // 🏢 SUGESTÕES OPERACIONAIS: Mostrar para aprovação do usuário
      if (data.suggestions?.hasOperationalSuggestions && data.suggestions?.operationalSuggestions) {
        console.log("🏢 Sugestões operacionais recebidas:", data.suggestions.operationalSuggestions);
        const operationalFields = Object.entries(data.suggestions.operationalSuggestions).map(([key, value]) => {
          // 🔧 CORREÇÃO: Formatação segura de valores para evitar renderização de objetos
          let displayValue = '';
          if (typeof value === 'object' && value !== null) {
            // Se for objeto, extrair informação útil
            if ((value as any).name) displayValue = (value as any).name;
            else if ((value as any).label) displayValue = (value as any).label;
            else displayValue = '[Objeto complexo]';
          } else {
            displayValue = String(value || '');
          }
          
          return {
            field: key,
            value: displayValue,
            confidence: 85,
            source: 'ai_suggestion',
            reasoning: `Sugestão para ${key} baseada no documento`
          };
        });
        setAutoFilledFields(operationalFields);
        setShowAutoFillConfirmation(true);
        
        // Aplicar sugestões operacionais (usuário pode aceitar/rejeitar)
        if (data.suggestions?.bankId) {
          form.setValue('bankId', data.suggestions.bankId);
        }
        if (data.suggestions?.categoryId) {
          form.setValue('categoryId', data.suggestions.categoryId);
        }
        if (data.suggestions?.costCenterId) {
          form.setValue('costCenterId', data.suggestions.costCenterId);
        }
      }

      setProcessingState({ 
        stage: 'analyzed', 
        message: `IA analisou o documento com ${Math.round((data.suggestions.confidence?.amount || 95))}% de precisão` 
      });

      toast({
        title: "Documento processado com sucesso",
        description: `IA identificou ${newSuggestions.length} campos automaticamente`,
      });

      console.log("✅ Total de campos sugeridos:", newSuggestions.length);
    },
    onError: (error: any) => {
      console.error("❌ Erro no processamento IA:", error);
      setProcessingState({ 
        stage: 'ready', 
        message: 'Erro no processamento. Preencha manualmente.' 
      });

      toast({
        title: "Erro no processamento IA",
        description: "Preencha os campos manualmente",
        variant: "destructive",
      });
    },
  });

  // Função auxiliar para normalizar CNPJ/CPF
  const normalizeCNPJ = (doc: string): string => {
    if (!doc) return '';
    return doc.replace(/[^\d]/g, '');
  };

  // Função de detecção inteligente de fornecedor
  const detectAndHandleSupplier = async (name: string, document?: string, confidence?: number) => {
    try {
      console.log("🚨 ===== INICIANDO DETECÇÃO DE FORNECEDOR =====");
      console.log("🔍 DETECTANDO FORNECEDOR:");
      console.log("  📄 Nome recebido:", name);
      console.log("  🆔 Documento recebido:", document);
      console.log("  📊 Confiança recebida:", confidence);
      console.log("  📋 Total de fornecedores disponíveis:", contrapartes?.length || 0);
      console.log("  🔍 Contrapartes carregadas:", !!contrapartes);
      console.log("  📊 Estado do modal atual:", autoSupplierModal.open);
      
      // Se modal já está aberto, não duplicar detecção
      if (autoSupplierModal.open) {
        console.log("⏸️ Modal já aberto, ignorando detecção duplicada");
        console.log("🚨 ===== FIM DETECÇÃO (MODAL ABERTO) =====");
        return;
      }
      
      // Verificar se os dados estão carregados
      console.log("✅ Modal não está aberto, prosseguindo com detecção...");
      if (!contrapartes || contrapartes.length === 0) {
        console.log("⏳ Lista de fornecedores vazia, abrindo modal para criar novo...");
        setAutoSupplierModal({
          open: true,
          detectedSupplier: {
            name: name,
            document: document || '',
            type: 'PJ',
            confidence: confidence || 0,
            source: 'IA'
          }
        });
        return;
      }

      console.log("🔎 INICIANDO BUSCA DE FORNECEDOR EXISTENTE...");
      
      // ESTRATÉGIA 1: Buscar por CNPJ/CPF primeiro (mais confiável)
      let existingFornecedor = null;
      
      if (document && document !== "CNPJ não informado" && document !== "CNPJ não disponível") {
        const cleanDocument = normalizeCNPJ(document);
        console.log("  🔍 Buscando por documento:", cleanDocument);
        
        existingFornecedor = contrapartes?.find((c: any) => {
          const fornecedorDoc = normalizeCNPJ(c.document || '');
          const match = fornecedorDoc === cleanDocument;
          if (match) {
            console.log("    ✅ MATCH POR DOCUMENTO:", c.name, "Doc:", fornecedorDoc);
          }
          return match;
        });
      }
      
      // ESTRATÉGIA 2: Se não encontrou por documento, buscar por nome
      if (!existingFornecedor && name) {
        console.log("  🔍 Buscando por nome:", name);
        const cleanName = name.toLowerCase().trim();
        
        existingFornecedor = contrapartes?.find((c: any) => {
          const fornecedorName = c.name.toLowerCase().trim();
          
          // Match exato
          const exactMatch = fornecedorName === cleanName;
          if (exactMatch) {
            console.log("    ✅ MATCH EXATO POR NOME:", c.name);
            return true;
          }
          
          // Match por inclusão (mais flexível)
          const inclusionMatch = fornecedorName.includes(cleanName) || cleanName.includes(fornecedorName);
          if (inclusionMatch) {
            console.log("    ✅ MATCH POR INCLUSÃO:", c.name);
            return true;
          }
          
          return false;
        });
      }

      // Se encontrou fornecedor existente, selecionar automaticamente
      if (existingFornecedor) {
        console.log("🎯 FORNECEDOR EXISTENTE ENCONTRADO:");
        console.log("  📛 Nome:", existingFornecedor.name);
        console.log("  🆔 ID:", existingFornecedor.id);
        console.log("  📄 Documento:", existingFornecedor.document);
        
        console.log("🔄 SELECIONANDO AUTOMATICAMENTE...");
        
        // Seleção automática mais robusta
        form.setValue("contraparteId", existingFornecedor.id, { 
          shouldValidate: true, 
          shouldDirty: true,
          shouldTouch: true 
        });
        
        // Forçar atualização do formulário
        form.trigger("contraparteId");
        
        // Verificação após delay para garantir que foi aplicado
        setTimeout(() => {
          const currentValue = form.getValues("contraparteId");
          console.log("✅ VERIFICAÇÃO PÓS-SELEÇÃO:");
          console.log("  🎯 ID Esperado:", existingFornecedor.id);
          console.log("  📋 ID Atual:", currentValue);
          
          if (currentValue === existingFornecedor.id) {
            console.log("🎉 SUCESSO! Fornecedor selecionado automaticamente");
            
            toast({
              title: "Fornecedor selecionado automaticamente",
              description: `${existingFornecedor.name} foi encontrado e selecionado`,
            });
          } else {
            console.log("⚠️ FALHA na seleção, tentando novamente...");
            form.setValue("contraparteId", existingFornecedor.id, { 
              shouldValidate: true, 
              shouldDirty: true,
              shouldTouch: true 
            });
          }
        }, 300);
        
        return; // Não abrir modal
      }

      // Se não encontrou e temos um nome válido, sempre mostrar modal para confirmação
      if (name && name.trim().length > 1) {
        console.log("🚀 Novo fornecedor detectado, abrindo modal para confirmação...");
        
        // Processar documento se disponível
        let cleanDocument = '';
        let detectedType: 'PF' | 'PJ' = 'PJ'; // Default para PJ
        
        if (document && document !== "CNPJ não informado" && document !== "CNPJ não disponível") {
          cleanDocument = document.replace(/[^\d]/g, '');
          if (cleanDocument.length === 11) {
            detectedType = 'PF';
          } else if (cleanDocument.length === 14) {
            detectedType = 'PJ';
          }
        }

        // Lista de fornecedores conhecidos para maior confiança
        const fornecedoresConhecidos = [
          'uber', 'ifood', '99', 'rappi', 'amazon', 'mercado livre', 'americanas',
          'magazine luiza', 'shopee', 'aliexpress', 'netflix', 'spotify', 
          'google', 'microsoft', 'apple', 'samsung', 'dell', 'hp',
          'correios', 'sedex', 'dhl', 'fedex', 'loggi'
        ];

        const isKnownSupplier = fornecedoresConhecidos.some(known => 
          name.toLowerCase().includes(known) || known.includes(name.toLowerCase())
        );

        setAutoSupplierModal({
          open: true,
          detectedSupplier: {
            name: name.trim(),
            document: cleanDocument,
            type: detectedType,
            confidence: confidence || (isKnownSupplier ? 95 : 80),
            source: isKnownSupplier ? 'Fornecedor conhecido detectado' : 'Novo fornecedor detectado no documento'
          }
        });
        return;
      }

      console.log("⚠️ Nome de fornecedor inválido ou muito curto:", name);
    } catch (error) {
      console.error("❌ Erro na detecção de fornecedor:", error);
    }
  };

  // Handlers do modal
  const handleSupplierCreated = (newSupplier: any) => {
    form.setValue("contraparteId", newSupplier.id);
    
    // CORREÇÃO: Invalidar cache corretamente usando endpoint dinâmico
    queryClient.invalidateQueries({ queryKey: ["/api/fornecedores"] });
    queryClient.invalidateQueries({ queryKey: ["/api/clientes"] });
    queryClient.invalidateQueries({ queryKey: [getContraparteEndpoint()] });
    
    console.log("✅ Fornecedor criado e selecionado automaticamente:", newSupplier.id, newSupplier.name);
    
    toast({
      title: "Fornecedor cadastrado",
      description: `${newSupplier.name} foi adicionado com sucesso e selecionado`,
    });
  };

  const handleSupplierSkip = () => {
    console.log("🔄 Usuário pulou o cadastro automático de fornecedor");
  };

  // Mutation para upload final
  const uploadMutation = useMutation<ApiResponse, Error, FormData>({
    mutationFn: async (formData: FormData): Promise<ApiResponse> => {
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.log("🔍 Detalhes completos do erro do servidor:", errorData);
        
        // Criar mensagem detalhada se houver details
        if (errorData.details && Array.isArray(errorData.details)) {
          const fieldErrors = errorData.details.map((detail: any) => {
            // Se detail é uma string simples
            if (typeof detail === 'string') {
              return `• ${detail}`;
            }
            // Se detail é um objeto com field e message
            return `• ${detail.field || 'Campo'}: ${detail.message || detail}`;
          }).join('\n');
          throw new Error(`${errorData.error}\n\nProblemas encontrados:\n${fieldErrors}`);
        }
        
        throw new Error(errorData.message || errorData.error || 'Erro no upload');
      }

      return response.json();
    },
    onSuccess: (data) => {
      console.log("✅ Upload BPO concluído:", data);

      toast({
        title: "Documento enviado com sucesso",
        description: `Documento ${data.documentId} foi processado e está no fluxo BPO`,
      });

      // Reset form
      form.reset();
      setSelectedFile(null);
      setSuggestions([]);
      setDocumentMetadata(null);
      setProcessingState({ stage: 'ready', message: 'Selecione um arquivo para começar' });

      // Invalidar cache
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
    },
    onError: (error: any) => {
      console.error("❌ Erro no upload BPO:", error);
      setProcessingState({ stage: 'analyzed', message: 'Erro no envio. Verifique os dados.' });

      // Melhorar exibição da mensagem de erro
      const errorMessage = error.message || "Verifique os campos obrigatórios";
      const isDetailedError = errorMessage.includes('Campos com problema:');
      
      toast({
        title: "Erro no envio",
        description: isDetailedError 
          ? errorMessage.split('\n').slice(0, 3).join('\n') + (errorMessage.split('\n').length > 3 ? '\n...' : '')
          : errorMessage,
        variant: "destructive",
      });

      // Log detalhado para debugging
      console.log("📋 Mensagem de erro completa:", errorMessage);
    },
  });

  // Handlers
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setProcessingState({ stage: 'processing', message: 'Processando documento...' });
      processFileMutation.mutate(file);
    }
  };

  const onSubmit = async (data: BpoUploadData) => {
    // Para EMITIR_BOLETO e EMITIR_NF, arquivo não é obrigatório (documento virtual)
    const requiresFile = data.documentType === "PAGO" || data.documentType === "AGENDADO";
    
    if (requiresFile && !selectedFile) {
      toast({
        title: "Arquivo obrigatório",
        description: "Selecione um documento para análise",
        variant: "destructive",
      });
      return;
    }
    
    // 🚨 FEEDBACK MELHORADO: Verificar e mostrar erros específicos
    const formErrors = form.formState.errors;
    if (Object.keys(formErrors).length > 0) {
      const missingFields = Object.entries(formErrors)
        .map(([field, error]: [string, any]) => {
          const fieldNames: { [key: string]: string } = {
            'categoryId': 'Categoria',
            'costCenterId': 'Centro de Custo', 
            'scheduledDate': 'Data de Vencimento',
            'payerDocument': 'CNPJ/CPF do Tomador',
            'payerName': 'Nome/Razão Social',
            'payerEmail': 'Email',
            'payerPhone': 'Telefone',
            'payerStreet': 'Rua/Avenida',
            'payerNumber': 'Número',
            'payerNeighborhood': 'Bairro',
            'payerCity': 'Cidade',
            'payerState': 'Estado',
            'payerZipCode': 'CEP',
            'serviceCode': 'Código do Serviço',
            'serviceDescription': 'Descrição do Serviço'
          };
          return `• ${fieldNames[field] || field}: ${error.message}`;
        })
        .join('\n');

      toast({
        title: `⚠️ Campos obrigatórios faltando (${Object.keys(formErrors).length})`,
        description: missingFields,
        variant: "destructive",
        duration: 8000,
      });
      console.log("❌ Formulário inválido. Erros:", formErrors);
      return;
    }
    
    console.log("📊 Estado do formulário:", {
      isValid: form.formState.isValid,
      isDirty: form.formState.isDirty,
      isSubmitting: form.formState.isSubmitting,
      errorCount: Object.keys(form.formState.errors).length
    });
    setProcessingState({ stage: 'submitting', message: 'Enviando para BPO...' });

    // 🔍 DEBUG: Capturar TODOS os valores do formulário (incluindo Select controlados)
    const allFormValues = form.getValues();
    console.log("🔍 TODOS os valores do formulário capturados:", allFormValues);

    const formData = new FormData();
    
    // Para documentos que requerem arquivo, anexar
    if (selectedFile && requiresFile) {
      formData.append('file', selectedFile);
    }
    
    // Para documentos virtuais (EMITIR_BOLETO/EMITIR_NF), marcar como virtual
    if (!requiresFile) {
      formData.append('isVirtualDocument', 'true');
    }

    // Função para converter datas para formato DD/MM/AAAA
    const formatDateForServer = (dateStr: string) => {
      if (!dateStr) return dateStr;
      
      // Se já está no formato DD/MM/AAAA, manter
      if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        return dateStr;
      }
      
      // Se está no formato AAAA-MM-DD, converter para DD/MM/AAAA
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
      }
      
      return dateStr;
    };

    // Mapear campos do frontend para backend
    const fieldMapping: Record<string, string> = {
      contraparteId: 'supplier',
      realPaidDate: 'paidDate',
      scheduledDate: documentType === 'EMITIR_BOLETO' ? 'dueDate' : 'scheduledDate'
    };

    // 🎯 CORREÇÃO: Usar form.getValues() para capturar TODOS os campos (incluindo Select controlados)
    const completeData: any = form.getValues();

    // 🔧 CORREÇÃO CRÍTICA: Backend espera clientId obrigatório para EMITIR_NF
    if (documentType === 'EMITIR_NF' && completeData.contraparteId) {
      completeData.clientId = completeData.contraparteId;
      console.log("✅ Mapeamento EMITIR_NF: contraparteId → clientId:", completeData.contraparteId);
    }
    
    // Adicionar campos essenciais que podem estar faltando
    const essentialFields: Array<keyof BpoUploadData> = ['bankId', 'categoryId', 'costCenterId', 'contraparteId'];
    essentialFields.forEach(fieldName => {
      if (!completeData[fieldName]) {
        const fieldValue = form.watch(fieldName);
        if (fieldValue) {
          completeData[fieldName] = fieldValue;
          console.log(`✅ Campo ${fieldName} recuperado via watch:`, fieldValue);
        }
      }
    });

    // 🔧 CORREÇÃO CRÍTICA: Garantir dueDate para EMITIR_BOLETO
    if (documentType === 'EMITIR_BOLETO') {
      // Para boleto, scheduledDate É a data de vencimento (dueDate)
      if (completeData.scheduledDate && !completeData.dueDate) {
        completeData.dueDate = formatDateForServer(completeData.scheduledDate);
        console.log("📅 BOLETO: scheduledDate → dueDate:", completeData.scheduledDate);
      }
      
      // Fallback: buscar nas sugestões se não tiver
      if (!completeData.dueDate) {
        let dueDate = null;
        if (suggestions && Array.isArray(suggestions)) {
          const dueDateSuggestion = suggestions.find((s: any) => s.field === 'dueDate' || (s as any).dueDate);
          if (dueDateSuggestion) {
            dueDate = dueDateSuggestion.value || (dueDateSuggestion as any).dueDate;
          }
        } else if (suggestions && typeof suggestions === 'object') {
          dueDate = (suggestions as any)?.realData?.dueDate || (suggestions as any)?.dueDate;
        }

        if (dueDate) {
          completeData.dueDate = formatDateForServer(dueDate);
          console.log("📅 Data de vencimento adicionada das sugestões:", dueDate);
        }
      }
    }

    // 🎯 CORREÇÃO ADICIONAL: Buscar nome da contraparte pelo ID
    if (completeData.contraparteId && contrapartes) {
      const contraparte = contrapartes?.find((c: any) => c.id === completeData.contraparteId);
      if (contraparte) {
        completeData.contraparteName = contraparte.name;
        console.log("✅ Nome da contraparte adicionado:", contraparte.name);
      }
    }

    // 🔧 CORREÇÃO CRÍTICA: Backend espera payerAddress concatenado obrigatório para EMITIR_NF
    if (documentType === 'EMITIR_NF') {
      const addressParts = [
        completeData.payerStreet,
        completeData.payerNumber,
        completeData.payerComplement ? `- ${completeData.payerComplement}` : '',
        completeData.payerNeighborhood,
        `${completeData.payerCity} - ${completeData.payerState}`,
        `CEP: ${completeData.payerZipCode}`
      ].filter(part => part && part.trim() !== '' && part !== '-');
      
      completeData.payerAddress = addressParts.join(', ');
      console.log("✅ Endereço concatenado para EMITIR_NF:", completeData.payerAddress);
    }

    // Processar todos os campos
    Object.entries(completeData).forEach(([key, value]) => {
      if (value !== undefined && value !== "" && value !== null) {
        const backendKey = fieldMapping[key] || key;
        
        // Converter formato de datas para DD/MM/AAAA
        let finalValue = String(value);
        if (key === 'competenceDate' || key === 'realPaidDate' || key === 'scheduledDate' || key === 'dueDate') {
          finalValue = formatDateForServer(finalValue);
          console.log(`📅 Convertendo data ${key}: ${value} → ${finalValue}`);
        }
        
        formData.append(backendKey, finalValue);
      }
    });

    // Log para debugging
    console.log("📤 Dados sendo enviados para o servidor:");
    const formEntries = Array.from(formData.entries());
    formEntries.forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    uploadMutation.mutate(formData);
  };

  const getSuggestionBadge = (fieldName: string) => {
    const suggestion = suggestions.find(s => s.field === fieldName);
    if (!suggestion) return null;

    return (
      <Badge variant="secondary" className="ml-2 text-xs bg-[#E40064]/10 text-[#E40064] border-[#E40064]/20">
        <Sparkles className="h-3 w-3 mr-1" />
        IA {suggestion.confidence}%
      </Badge>
    );
  };

  // Função para obter o rótulo correto da contraparte
  const getContraparteLabel = () => {
    if (documentType === "PAGO" || documentType === "AGENDADO") {
      return "Fornecedor";
    } else {
      return "Cliente";
    }
  };

  const isFieldSuggested = (fieldName: string) => {
    return suggestions.some(s => s.field === fieldName);
  };

  // 🔧 CORREÇÃO CRÍTICA: Reset form when document type changes (sem loop infinito)
  useEffect(() => {
    const currentValues = form.getValues();
    form.reset({
      documentType: currentValues.documentType,
      amount: currentValues.amount,
      contraparteId: currentValues.contraparteId,
      description: currentValues.description,
    });
  }, [documentType]); // ← Removido 'form' para evitar loop infinito

  // 🔧 CORREÇÃO CRÍTICA: Auto-preencher contraparte (sem loop infinito)
  useEffect(() => {
    if ((documentType === "EMITIR_BOLETO" || documentType === "EMITIR_NF") && selectedClient) {
      form.setValue("contraparteId", selectedClient.id, { 
        shouldValidate: false, // ← Reduzido para evitar re-validações excessivas
        shouldDirty: true,
        shouldTouch: true 
      });
      
      // 🎯 AUTO-PREENCHER EMAIL DO CLIENTE PARA EMITIR_NF (conforme SLA)
      if (documentType === "EMITIR_NF" && selectedClient.email) {
        form.setValue("payerEmail", selectedClient.email, {
          shouldValidate: false,
          shouldDirty: true,
          shouldTouch: true
        });
        console.log("✅ Email auto-preenchido do cliente:", selectedClient.email);
      }
    } else if (documentType === "PAGO" || documentType === "AGENDADO") {
      // Limpar contraparteId para que o usuário selecione manualmente
      form.setValue("contraparteId", "", { 
        shouldValidate: false, // ← Reduzido para evitar re-validações excessivas
        shouldDirty: true,
        shouldTouch: true 
      });
    }
  }, [documentType, selectedClient]); // ← Removido 'form' para evitar loop infinito

  return (
    <div className="space-y-6">
      {/* Header - NOVO COMPONENTE BPO */}
      <Card className="border-[#E40064]/20">
        <CardHeader className="bg-gradient-to-r from-[#E40064]/5 to-[#0B0E30]/5">
          <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
            <CloudUpload className="h-5 w-5 text-[#E40064]" />
            Upload de Documentos BPO
            <Badge variant="destructive" className="ml-2 text-xs bg-green-500">
              NOVO SISTEMA
            </Badge>
          </CardTitle>
        </CardHeader>
      </Card>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" autoComplete="new-password" noValidate data-lpignore="true" data-1p-ignore="true">

        {/* Seleção de Tipo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
              <FileText className="h-5 w-5 text-[#E40064]" />
              Tipo de Operação BPO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={documentType}
              onValueChange={(value) => form.setValue("documentType", value as any)}
              className="grid grid-cols-2 gap-4"
            >
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-[#E40064]/5 transition-colors">
                <RadioGroupItem value="PAGO" id="PAGO" />
                <Label htmlFor="PAGO" className="flex-1 cursor-pointer">
                  <div className="font-medium text-[#0B0E30]">Pago</div>
                  <div className="text-sm text-gray-600">Documento já pago</div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-[#E40064]/5 transition-colors">
                <RadioGroupItem value="AGENDADO" id="AGENDADO" />
                <Label htmlFor="AGENDADO" className="flex-1 cursor-pointer">
                  <div className="font-medium text-[#0B0E30]">Agendamento</div>
                  <div className="text-sm text-gray-600">Pagamento agendado</div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-[#E40064]/5 transition-colors">
                <RadioGroupItem value="EMITIR_BOLETO" id="EMITIR_BOLETO" />
                <Label htmlFor="EMITIR_BOLETO" className="flex-1 cursor-pointer">
                  <div className="font-medium text-[#0B0E30]">Emitir Boleto</div>
                  <div className="text-sm text-gray-600">Gerar boleto bancário</div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-[#E40064]/5 transition-colors">
                <RadioGroupItem value="EMITIR_NF" id="EMITIR_NF" />
                <Label htmlFor="EMITIR_NF" className="flex-1 cursor-pointer">
                  <div className="font-medium text-[#0B0E30]">Emitir NF</div>
                  <div className="text-sm text-gray-600">Gerar nota fiscal</div>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Upload de Arquivo (apenas para PAGO/AGENDADO) */}
        {needsDocument && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
                <UploadIcon className="h-5 w-5 text-[#E40064]" />
                Documento para Análise
                <Badge variant="destructive">Obrigatório</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileSelect}
                  className="cursor-pointer"
                  data-testid="input-file"
                />

                {selectedFile && (
                  <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>
                            {selectedFile.name} ({Math.round(selectedFile.size/1024)}KB)
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDocumentPreviewModal(true)}
                            className="h-6 px-2 text-xs"
                            data-testid="button-view-document"
                          >
                            👁️ Ver
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          {processingState.stage === 'processing' && (
                            <Badge variant="outline">
                              <Sparkles className="h-3 w-3 mr-1 animate-spin" />
                              Processando...
                            </Badge>
                          )}
                          {processingState.stage === 'analyzed' && (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Analisado
                            </Badge>
                          )}
                        </div>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <p className="text-sm text-gray-600">
                  {processingState.message}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campos para Emissão de Boleto/NF - REORGANIZADO PARA VIR PRIMEIRO */}
        {(documentType === "EMITIR_BOLETO" || documentType === "EMITIR_NF") && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
                <Building2 className="h-5 w-5 text-[#E40064]" />
                Dados do Tomador - {documentType}
                <Badge variant="destructive">Obrigatório</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* 🎯 BUSCA HÍBRIDA INTELIGENTE */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#0B0E30] border-b pb-2 flex-1">
                    {selectedClient ? `Cliente: ${selectedClient.name}` : 'Buscar Cliente'}
                  </h4>
                  {selectedClient && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedClient(null);
                        setClientSearchTerm('');
                        form.reset({ ...form.getValues(), payerDocument: '', payerName: '', payerEmail: '', payerPhone: '', payerStreet: '', payerNumber: '', payerNeighborhood: '', payerCity: '', payerState: '', payerZipCode: '' });
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Limpar
                    </Button>
                  )}
                </div>

                {!selectedClient && (
                  <>
                    <p className="text-sm text-gray-600">
                      🔍 Busque um cliente existente ou cadastre um novo
                    </p>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={clientSearchTerm}
                          onChange={(e) => {
                            const term = e.target.value;
                            setClientSearchTerm(term);
                            searchClients(term);
                          }}
                          placeholder="Digite nome, CNPJ ou email do cliente..."
                          className="flex-1"
                          data-testid="input-client-search"
                        />
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setShowNewClientForm(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Novo Cliente
                        </Button>
                      </div>

                      {/* 📋 Resultados da busca em tempo real */}
                      {searchResults.length > 0 && (
                        <div className="border rounded-md bg-white shadow-sm max-h-60 overflow-y-auto">
                          {searchResults.map((cliente) => (
                            <div
                              key={cliente.id}
                              onClick={() => autoFillClientData(cliente)}
                              className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
                              data-testid={`client-result-${cliente.id}`}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-gray-900">{cliente.name}</p>
                                  <p className="text-sm text-gray-600">{cliente.document}</p>
                                  {cliente.email && (
                                    <p className="text-sm text-gray-500">{cliente.email}</p>
                                  )}
                                </div>
                                <div className="text-right text-xs text-gray-400">
                                  {cliente.city && <p>{cliente.city}/{cliente.state}</p>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {clientSearchTerm.length >= 2 && searchResults.length === 0 && (
                        <div className="text-sm text-gray-500 text-center py-3 border border-dashed rounded">
                          Nenhum cliente encontrado. 
                          <Button 
                            type="button" 
                            variant="link" 
                            className="p-0 h-auto ml-1"
                            onClick={() => setShowNewClientForm(true)}
                          >
                            Cadastrar novo cliente?
                          </Button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {selectedClient && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Cliente selecionado</span>
                    </div>
                    <div className="text-sm text-green-700">
                      <p><strong>{selectedClient.name}</strong></p>
                      <p>{selectedClient.document} • {selectedClient.email}</p>
                      {selectedClient.city && <p>{selectedClient.city}/{selectedClient.state}</p>}
                    </div>
                  </div>
                )}
              </div>

              {showNewClientForm && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[#0B0E30] border-b pb-2 flex-1">Dados do Novo Cliente</h4>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowNewClientForm(false)}
                      className="text-gray-500"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancelar
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>CNPJ/CPF do Tomador *</Label>
                      <Input
                        {...form.register("payerDocument")}
                        placeholder="00.000.000/0000-00"
                        data-testid="input-payer-document"
                      />
                      {form.formState.errors.payerDocument && (
                        <p className="text-sm text-red-500">{form.formState.errors.payerDocument.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Nome/Razão Social *</Label>
                      <Input
                        {...form.register("payerName")}
                        placeholder="Nome completo ou razão social"
                        data-testid="input-payer-name"
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                      />
                      {form.formState.errors.payerName && (
                        <p className="text-sm text-red-500">{form.formState.errors.payerName.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Inscrição Estadual</Label>
                      <Input
                        {...form.register("payerStateRegistration")}
                        placeholder="000.000.000.000 (opcional)"
                        data-testid="input-payer-state-registration"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Contato */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-[#0B0E30] border-b pb-2">Contato</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      {...form.register("payerEmail")}
                      type="email"
                      placeholder="email@exemplo.com"
                      data-testid="input-payer-email"
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-form-type="other"
                    />
                    {form.formState.errors.payerEmail && (
                      <p className="text-sm text-red-500">{form.formState.errors.payerEmail.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Telefone *</Label>
                    <Input
                      {...form.register("payerPhone")}
                      placeholder="(11) 99999-9999"
                      data-testid="input-payer-phone"
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-form-type="other"
                    />
                    {form.formState.errors.payerPhone && (
                      <p className="text-sm text-red-500">{form.formState.errors.payerPhone.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Nome da Pessoa de Contato</Label>
                    <Input
                      {...form.register("payerContactName")}
                      placeholder="Nome do responsável"
                      data-testid="input-payer-contact-name"
                      autoComplete="new-password"
                      data-lpignore="true"
                      data-1p-ignore="true"
                      data-form-type="other"
                    />
                  </div>
                </div>
              </div>

              {/* Endereço Completo */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-[#0B0E30] border-b pb-2">Endereço</h4>
                <div className="grid grid-cols-1 gap-4">
                  {/* Linha 1: CEP e Rua */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>CEP *</Label>
                      <Input
                        {...form.register("payerZipCode")}
                        placeholder="00000-000"
                        data-testid="input-payer-zip-code"
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                      />
                      {form.formState.errors.payerZipCode && (
                        <p className="text-sm text-red-500">{form.formState.errors.payerZipCode.message}</p>
                      )}
                    </div>

                    <div className="space-y-2 md:col-span-3">
                      <Label>Rua/Avenida *</Label>
                      <Input
                        {...form.register("payerStreet")}
                        placeholder="Nome da rua/avenida"
                        data-testid="input-payer-street"
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                      />
                      {form.formState.errors.payerStreet && (
                        <p className="text-sm text-red-500">{form.formState.errors.payerStreet.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Linha 2: Número, Complemento, Bairro */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Número *</Label>
                      <Input
                        {...form.register("payerNumber")}
                        placeholder="123"
                        data-testid="input-payer-number"
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                      />
                      {form.formState.errors.payerNumber && (
                        <p className="text-sm text-red-500">{form.formState.errors.payerNumber.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Complemento</Label>
                      <Input
                        {...form.register("payerComplement")}
                        placeholder="Apto 45, Bloco B..."
                        data-testid="input-payer-complement"
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Bairro *</Label>
                      <Input
                        {...form.register("payerNeighborhood")}
                        placeholder="Nome do bairro"
                        data-testid="input-payer-neighborhood"
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                      />
                      {form.formState.errors.payerNeighborhood && (
                        <p className="text-sm text-red-500">{form.formState.errors.payerNeighborhood.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Linha 3: Cidade e Estado */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label>Cidade *</Label>
                      <Input
                        {...form.register("payerCity")}
                        placeholder="Nome da cidade"
                        data-testid="input-payer-city"
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                      />
                      {form.formState.errors.payerCity && (
                        <p className="text-sm text-red-500">{form.formState.errors.payerCity.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Estado *</Label>
                      <Input
                        {...form.register("payerState")}
                        placeholder="SP"
                        maxLength={2}
                        data-testid="input-payer-state"
                        autoComplete="new-password"
                        data-lpignore="true"
                        data-1p-ignore="true"
                        data-form-type="other"
                        spellCheck="false"
                      />
                      {form.formState.errors.payerState && (
                        <p className="text-sm text-red-500">{form.formState.errors.payerState.message}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Instruções Especiais - Esconder para EMITIR_NF (já tem campos específicos) */}
              <div className={`space-y-4 ${documentType === "EMITIR_NF" ? "hidden" : ""}`}>
                <h4 className="text-sm font-semibold text-[#0B0E30] border-b pb-2">Instruções Especiais</h4>
                <div className="space-y-2">
                  <Label>Instruções especiais para o boleto/NF (opcional)</Label>
                  <Textarea
                    {...form.register("instructions")}
                    placeholder="Instruções especiais para o boleto/NF (opcional)"
                    className="min-h-[80px]"
                    data-testid="textarea-special-instructions"
                  />
                </div>
              </div>

            </CardContent>
          </Card>
        )}

        {/* Dados da Operação - SIMPLIFICADO E REORGANIZADO */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
              <DollarSign className="h-5 w-5 text-[#E40064]" />
              {documentType === "EMITIR_BOLETO" ? "Dados da Operação" : "Dados Básicos"}
              <Badge variant="destructive">Obrigatório</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Valor */}
              <div className="space-y-2">
                <Label className="flex items-center">
                  Valor *
                  {getSuggestionBadge('amount')}
                </Label>
                <Input
                  {...form.register("amount")}
                  placeholder="R$ 1.000,00"
                  className={isFieldSuggested('amount') ? 'border-[#E40064]/30 bg-[#E40064]/5' : ''}
                  data-testid="input-amount"
                />
                {form.formState.errors.amount && (
                  <p className="text-sm text-red-500">{form.formState.errors.amount.message}</p>
                )}
              </div>

              {/* Data de Vencimento - USAR scheduledDate */}
              {documentType === "EMITIR_BOLETO" && (
                <div className="space-y-2">
                  <Label>Data de Vencimento *</Label>
                  <Input
                    {...form.register("scheduledDate")}
                    type="date"
                    data-testid="input-due-date"
                  />
                  <p className="text-xs text-gray-600">
                    Data limite para pagamento do boleto
                  </p>
                  {form.formState.errors.scheduledDate && (
                    <p className="text-sm text-red-500">{form.formState.errors.scheduledDate.message}</p>
                  )}
                </div>
              )}

              {/* Contraparte dinâmica - SÓ PARA PAGO E AGENDADO */}
              {(documentType === "PAGO" || documentType === "AGENDADO") && (
                <div className="space-y-2">
                  <Label className="flex items-center">
                    {getContraparteLabel()} *
                    {getSuggestionBadge('contraparte')}
                  </Label>
                  <Select 
                    value={form.watch("contraparteId") || ""} 
                    onValueChange={(value) => form.setValue("contraparteId", value)}
                  >
                    <SelectTrigger 
                      data-testid="select-contraparte"
                      className={isFieldSuggested('contraparte') ? 'border-[#E40064]/30 bg-[#E40064]/5' : ''}
                    >
                      <SelectValue placeholder={`Selecione o ${getContraparteLabel().toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(contrapartes) && contrapartes.map((contraparte: any) => (
                        <SelectItem key={contraparte.id} value={contraparte.id}>
                          {contraparte.name} {contraparte.document && `(${contraparte.document})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.contraparteId && (
                    <p className="text-sm text-red-500">{form.formState.errors.contraparteId.message}</p>
                  )}
                </div>
              )}

              {/* Auto-preencher contraparte para EMITIR_BOLETO com cliente selecionado */}
              {(documentType === "EMITIR_BOLETO" || documentType === "EMITIR_NF") && selectedClient && (
                <div className="space-y-2">
                  <Label className="text-gray-600">Cliente Selecionado (Automático)</Label>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-green-800 font-medium">{selectedClient.name}</p>
                    <p className="text-green-600 text-sm">{selectedClient.document}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Descrição - Esconder para EMITIR_NF (evita confusão com "Descrição do Serviço") */}
            {documentType !== "EMITIR_NF" && (
              <div className="space-y-2">
                <Label className="flex items-center">
                  Descrição *
                  {getSuggestionBadge('description')}
                </Label>
                <Textarea
                  {...form.register("description")}
                  placeholder="Descrição detalhada da transação"
                  className={isFieldSuggested('description') ? 'border-[#E40064]/30 bg-[#E40064]/5' : ''}
                  data-testid="textarea-description"
                />
                {form.formState.errors.description && (
                  <p className="text-sm text-red-500">{form.formState.errors.description.message}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campos Específicos por Tipo */}
        {(documentType === "PAGO" || documentType === "AGENDADO") && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
                <Calendar className="h-5 w-5 text-[#E40064]" />
                Datas BPO - {documentType}
                <Badge variant="destructive">Obrigatório</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* Mostrar dados do documento para referência */}
              {documentMetadata && (
                <Alert className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="text-sm">
                      <strong>Dados do documento:</strong> Data {documentMetadata.documentDate}, Valor {documentMetadata.documentValue}
                      <br />
                      <em>Ajuste as datas abaixo conforme a realidade do BPO (podem ser diferentes do documento)</em>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {documentType === "PAGO" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data de Competência *</Label>
                      <Input
                        {...form.register("competenceDate")}
                        type="date"
                        data-testid="input-competence-date"
                      />
                      <p className="text-xs text-gray-600">
                        Quando a despesa/receita pertence (mês de competência)
                      </p>
                      {/* 💡 NOVA FUNCIONALIDADE: Dica sobre auto-preenchimento da data */}
                      <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                        💡 Data preenchida automaticamente com vencimento do documento. Você pode alterar se preferir pagar em outro dia.
                      </p>
                      {form.formState.errors.competenceDate && (
                        <p className="text-sm text-red-500">{form.formState.errors.competenceDate.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Data Real de Pagamento *</Label>
                      <Input
                        {...form.register("realPaidDate")}
                        type="date"
                        data-testid="input-real-paid-date"
                      />
                      <p className="text-xs text-gray-600">
                        Quando o pagamento foi realmente efetuado
                      </p>
                      {form.formState.errors.realPaidDate && (
                        <p className="text-sm text-red-500">{form.formState.errors.realPaidDate.message}</p>
                      )}
                    </div>
                  </div>

                  {/* 🏦 NOVA FUNCIONALIDADE: Campo Banco para Comprovantes de Pagamento */}
                  <div className="space-y-2">
                    <Label>Banco do Pagamento</Label>
                    <Select 
                      value={form.watch("bankId") || ""} 
                      onValueChange={(value) => form.setValue("bankId", value)}
                    >
                      <SelectTrigger data-testid="select-bank-pago">
                        <SelectValue placeholder="Selecione o banco que efetuou o pagamento" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.isArray(banks) && banks.map((bank: any) => (
                          <SelectItem key={bank.id} value={bank.id}>
                            {bank.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-600">
                      Banco de origem do pagamento (preenchido automaticamente quando detectado)
                    </p>
                    {!form.watch("bankId") && (
                      <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3" />
                        <span>💡 Se possível, informe o banco para melhor rastreabilidade do pagamento</span>
                      </div>
                    )}
                    {form.formState.errors.bankId && (
                      <p className="text-sm text-red-500">{form.formState.errors.bankId.message}</p>
                    )}
                  </div>
                </div>
              )}

              {documentType === "AGENDADO" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Data para Agendamento *</Label>
                    <Input
                      {...form.register("scheduledDate")}
                      type="date"
                      data-testid="input-scheduled-date"
                    />
                    <p className="text-xs text-gray-600">
                      Quando deve ser agendado o pagamento no banco
                    </p>
                    {/* 💡 NOVA FUNCIONALIDADE: Dica sobre auto-preenchimento da data */}
                    <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                      💡 Data preenchida automaticamente com vencimento do documento. Você pode alterar se preferir agendar para outro dia.
                    </p>
                    {form.formState.errors.scheduledDate && (
                      <p className="text-sm text-red-500">{form.formState.errors.scheduledDate.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Banco para Agendamento *</Label>
                    <Select 
                      value={form.watch("bankId") || ""} 
                      onValueChange={(value) => form.setValue("bankId", value)}
                    >
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
                    {form.formState.errors.bankId && (
                      <p className="text-sm text-red-500">{form.formState.errors.bankId.message}</p>
                    )}
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        )}

        {/* 🤖 NOVO: Card de campos auto-preenchidos */}
        {showAutoFillConfirmation && autoFilledFields.length > 0 && (
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <CardHeader>
              <CardTitle className="text-blue-800 dark:text-blue-200 flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Campos preenchidos automaticamente
                <Badge variant="secondary" className="ml-2">
                  {autoFilledFields.length} campo{autoFilledFields.length > 1 ? 's' : ''}
                </Badge>
              </CardTitle>
              <p className="text-sm text-blue-600 dark:text-blue-300">
                A IA preencheu automaticamente alguns campos. Confirme se estão corretos antes de enviar.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {autoFilledFields.map((field, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-md border border-blue-200 dark:border-blue-700">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-blue-600" />
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">
                          {field.field === 'bankId' && 'Banco'}
                          {field.field === 'categoryId' && 'Categoria'}
                          {field.field === 'costCenterId' && 'Centro de Custo'}
                          {field.field === 'dueDate' && 'Data de Vencimento'}
                        </p>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                        {field.value}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {typeof field.reasoning === 'string' ? field.reasoning : "Sugestão automática"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge 
                        variant={field.confidence >= 80 ? "default" : "secondary"} 
                        className={field.confidence >= 80 ? 
                          "text-blue-700 border-blue-300 bg-blue-100 dark:text-blue-400 dark:border-blue-600 dark:bg-blue-900" :
                          "text-yellow-700 border-yellow-300 bg-yellow-100 dark:text-yellow-400 dark:border-yellow-600 dark:bg-yellow-900"
                        }
                      >
                        {field.confidence}% confiança
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {field.source === 'ai_suggestion' && '🤖 IA'}
                        {field.source === 'intelligent_default' && '💡 Inteligente'}
                        {field.source === 'historical_pattern' && '📊 Histórico'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowAutoFillConfirmation(false)}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Aceitar Sugestões
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={() => {
                    // Limpar campos auto-preenchidos
                    autoFilledFields.forEach((field) => {
                      if (field.field === 'bankId') form.setValue('bankId', '');
                      if (field.field === 'categoryId') form.setValue('categoryId', '');
                      if (field.field === 'costCenterId') form.setValue('costCenterId', '');
                      if (field.field === 'dueDate') form.setValue('competenceDate', '');
                    });
                    setShowAutoFillConfirmation(false);
                    setAutoFilledFields([]);
                  }}
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Limpar Auto-Fill
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SEÇÃO ÓRFÃ COMPLETAMENTE REMOVIDA */}

        {/* Dados Opcionais BPO */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
              <Building2 className="h-5 w-5 text-[#E40064]" />
              Informações Complementares
              <Badge variant="outline">Opcional</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

              {/* Categoria */}
              <div className="space-y-2">
                <Label>Categoria {documentType === "EMITIR_BOLETO" && <span className="text-red-500">*</span>}{documentType === "EMITIR_NF" && <span className="text-gray-500">(Opcional)</span>}</Label>
                <Select 
                  value={form.watch("categoryId") || ""} 
                  onValueChange={(value) => form.setValue("categoryId", value)}
                >
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
                {form.formState.errors.categoryId && (
                  <p className="text-sm text-red-500">{form.formState.errors.categoryId.message}</p>
                )}
              </div>

              {/* Centro de Custo */}
              <div className="space-y-2">
                <Label>Centro de Custo {documentType === "EMITIR_BOLETO" && <span className="text-red-500">*</span>}{documentType === "EMITIR_NF" && <span className="text-gray-500">(Opcional)</span>}</Label>
                <Select 
                  value={form.watch("costCenterId") || ""} 
                  onValueChange={(value) => form.setValue("costCenterId", value)}
                >
                  <SelectTrigger data-testid="select-cost-center">
                    <SelectValue placeholder="Selecione o centro de custo" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(costCenters) && costCenters.map((costCenter: any) => (
                      <SelectItem key={costCenter.id} value={costCenter.id}>
                        {costCenter.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.costCenterId && (
                  <p className="text-sm text-red-500">{form.formState.errors.costCenterId.message}</p>
                )}
              </div>
            </div>

            {/* Data de Competência */}
            <div className="space-y-2">
              <Label>Data de Competência</Label>
              <Input
                {...form.register("competenceDate")}
                type="date"
                data-testid="input-competence-date"
              />
            </div>

            {/* Campos específicos para EMITIR_NF */}
            {documentType === "EMITIR_NF" && (
              <>
                {/* Descrição do Serviço - Campo ÚNICO para EMITIR_NF (evita confusão) */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#E40064]" />
                    Descrição do Serviço <span className="text-red-500">*</span>
                    <Badge variant="outline" className="text-xs">Campo Principal</Badge>
                  </Label>
                  <Textarea
                    {...form.register("serviceDescription")}
                    placeholder="Descreva detalhadamente o serviço prestado. Ex: Consultoria em tecnologia, desenvolvimento de sistema, manutenção, etc. (inclua valores individuais se necessário)..."
                    className="min-h-[100px]"
                    data-testid="textarea-service-description"
                  />
                  <p className="text-xs text-gray-600">
                    💡 Esta é a descrição principal que aparecerá na Nota Fiscal. Seja específico e detalhado.
                  </p>
                  {form.formState.errors.serviceDescription && (
                    <p className="text-sm text-red-500">{form.formState.errors.serviceDescription.message}</p>
                  )}
                </div>

                {/* Data de Vencimento - Opcional */}
                <div className="space-y-2">
                  <Label>Data de Vencimento (Opcional)</Label>
                  <Input
                    {...form.register("scheduledDate")}
                    type="date"
                    data-testid="input-scheduled-date-nf"
                  />
                  {form.formState.errors.scheduledDate && (
                    <p className="text-sm text-red-500">{form.formState.errors.scheduledDate.message}</p>
                  )}
                </div>
              </>
            )}

            {/* Observações */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-gray-500" />
                {documentType === "EMITIR_NF" ? "Observações Internas" : "Observações"}
                <Badge variant="secondary" className="text-xs">Opcional</Badge>
              </Label>
              <Textarea
                {...form.register("notes")}
                placeholder={documentType === "EMITIR_NF" ? 
                  "Anotações internas para controle (não aparece na NF)..." : 
                  "Observações adicionais (opcional)"
                }
                data-testid="textarea-notes"
              />
              {documentType === "EMITIR_NF" && (
                <p className="text-xs text-gray-500">
                  ℹ️ Campo para anotações internas da equipe. Não aparece na Nota Fiscal.
                </p>
              )}
            </div>

          </CardContent>
        </Card>



        {/* Botão de Envio */}
        <Card>
          <CardContent className="pt-6">
            <Button
              type="submit"
              disabled={processingState.stage === 'processing' || processingState.stage === 'submitting'}
              className="w-full bg-[#E40064] hover:bg-[#E40064]/90 text-white"
              data-testid="button-submit"
            >
              {processingState.stage === 'submitting' ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Enviar para BPO Financeiro
                </>
              )}
            </Button>
          </CardContent>
        </Card>

      </form>

      {/* Processamento em Tempo Real */}
      {processingState.stage !== 'ready' && (
        <ProcessingSteps 
          stage={processingState.stage}
        />
      )}

      {/* Modal de Auto-Detecção de Fornecedor */}
      <AutoSupplierModal
        open={autoSupplierModal.open}
        onClose={() => setAutoSupplierModal({ open: false })}
        detectedSupplier={autoSupplierModal.detectedSupplier || null}
        onSupplierCreated={handleSupplierCreated}
        onSkip={handleSupplierSkip}
      />

      {/* Modal de Preview do Documento */}
      <Dialog open={documentPreviewModal} onOpenChange={setDocumentPreviewModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#E40064]" />
              Prévia do Documento
            </DialogTitle>
          </DialogHeader>
          
          {selectedFile && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                <p><strong>Arquivo:</strong> {selectedFile.name}</p>
                <p><strong>Tamanho:</strong> {Math.round(selectedFile.size/1024)}KB</p>
                <p><strong>Tipo:</strong> {selectedFile.type}</p>
              </div>
              
              {selectedFile.type.startsWith('image/') ? (
                <div className="flex justify-center">
                  <img 
                    src={URL.createObjectURL(selectedFile)} 
                    alt="Preview do documento"
                    className="max-w-full max-h-[60vh] object-contain border rounded"
                  />
                </div>
              ) : selectedFile.type === 'application/pdf' ? (
                <div className="w-full h-[60vh] border rounded">
                  <iframe
                    src={URL.createObjectURL(selectedFile)}
                    className="w-full h-full"
                    title="Preview do PDF"
                  />
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-2" />
                  <p>Prévia não disponível para este tipo de arquivo</p>
                  <p className="text-sm">({selectedFile.type})</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};

// Componente para mostrar o progresso do processamento
interface ProcessingStepsProps {
  stage: 'ready' | 'processing' | 'analyzed' | 'submitting';
}

const ProcessingSteps: React.FC<ProcessingStepsProps> = ({ stage }) => {
  if (stage === 'ready') return null;

  const stages = [
    { key: 'processing', label: 'Processando com IA...', icon: Sparkles },
    { key: 'analyzed', label: 'Análise concluída...', icon: CheckCircle },
    { key: 'submitting', label: 'Finalizando envio...', icon: UploadIcon },
  ];

  const currentStageIndex = stages.findIndex(s => s.key === stage);

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#0B0E30]">
          <Sparkles className="h-5 w-5 text-[#E40064] animate-pulse" />
          Processamento em Andamento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {stages.map((stageItem, index) => {
            const Icon = stageItem.icon;
            const isActive = index === currentStageIndex;
            const isCompleted = index < currentStageIndex;
            
            return (
              <div
                key={stageItem.key}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  isActive ? 'bg-[#E40064]/10 border border-[#E40064]/20' : 
                  isCompleted ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                }`}
              >
                <Icon className={`h-5 w-5 ${
                  isActive ? 'text-[#E40064] animate-spin' :
                  isCompleted ? 'text-green-600' : 'text-gray-400'
                }`} />
                <span className={`flex-1 ${
                  isActive ? 'text-[#0B0E30] font-medium' :
                  isCompleted ? 'text-green-700' : 'text-gray-500'
                }`}>
                  {stageItem.label}
                </span>
                {isCompleted && <CheckCircle className="h-5 w-5 text-green-600" />}
              </div>
            );
          })}
        </div>
        
      </CardContent>
    </Card>
  );
};

export default UploadBpo;
