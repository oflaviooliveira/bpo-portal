// Wave 1 - Core Types for Business Logic

export type DocumentStatus = 
  | "RECEBIDO" 
  | "VALIDANDO" 
  | "PENDENTE_REVISAO"
  | "PAGO_A_CONCILIAR"
  | "AGENDADO" 
  | "A_PAGAR_HOJE"
  | "AGUARDANDO_RECEBIMENTO"
  | "EM_CONCILIACAO"
  | "ARQUIVADO";

export type DocumentType = 
  | "PAGO" 
  | "AGENDADO" 
  | "EMITIR_BOLETO" 
  | "EMITIR_NF";

export type UserRole = 
  | "SUPER_ADMIN"  // CEO da Gquicks - acesso total à plataforma
  | "CLIENT_USER"; // Usuário do cliente BPO - acesso limitado

// Fluxos de negócio conforme guia
export const BusinessFlows: Record<DocumentType, DocumentStatus[]> = {
  PAGO: ["RECEBIDO", "VALIDANDO", "PAGO_A_CONCILIAR", "EM_CONCILIACAO", "ARQUIVADO"],
  AGENDADO: ["RECEBIDO", "VALIDANDO", "AGENDADO", "A_PAGAR_HOJE", "AGUARDANDO_RECEBIMENTO", "EM_CONCILIACAO", "ARQUIVADO"],
  EMITIR_BOLETO: ["RECEBIDO", "VALIDANDO", "AGUARDANDO_RECEBIMENTO", "EM_CONCILIACAO", "ARQUIVADO"],
  EMITIR_NF: ["RECEBIDO", "VALIDANDO", "AGUARDANDO_RECEBIMENTO", "EM_CONCILIACAO", "ARQUIVADO"]
};

// Transições automáticas por data
export interface StatusTransition {
  from: DocumentStatus;
  to: DocumentStatus;
  condition: "date" | "manual" | "workflow";
  rule?: string;
}

export const AutoTransitions: StatusTransition[] = [
  {
    from: "AGENDADO",
    to: "A_PAGAR_HOJE", 
    condition: "date",
    rule: "dueDate <= today"
  },
  {
    from: "A_PAGAR_HOJE",
    to: "AGUARDANDO_RECEBIMENTO",
    condition: "workflow",
    rule: "after_payment_processed"
  }
];

// RBAC Permissions Matrix Simplificado
export const RolePermissions = {
  SUPER_ADMIN: {
    // CEO da Gquicks - controle total da plataforma
    documents: ["create", "read", "update", "delete", "export"],
    clients: ["create", "read", "update", "delete"],
    users: ["create", "read", "update", "delete"],
    reports: ["read", "export"],
    settings: ["read", "update"],
    platform: ["read", "manage"], // Acesso a analytics globais, IA, etc.
    tenants: ["create", "read", "update", "delete"] // Gerenciar clientes BPO
  },
  CLIENT_USER: {
    // Cliente BPO - acesso limitado apenas aos seus dados
    documents: ["create", "read"], // Só seus documentos
    clients: [], // Não gerencia clientes
    users: [], // Não gerencia usuários
    reports: ["read"], // Só seus relatórios
    settings: ["read"], // Só configurações pessoais básicas
    platform: [], // Sem acesso a dados da plataforma
    tenants: [] // Sem acesso a outros tenants
  }
} as const;

// ========================
// CORE BUSINESS INTERFACES
// ========================

// Document Processing - Interfaces para OCR e IA
export interface ProcessingResult {
  text: string;
  confidence: number;
  strategy: string;
  processingTime: number;
  strategiesAttempted: string[];
  allResults?: any[];
  success: boolean;
  status?: string;
  updates?: any;
  errors?: string[];
  warnings?: string[];
}

export interface DocumentSuggestion {
  field: string;
  value: string;
  confidence: number;
  source: 'IA' | 'DOCUMENTO' | 'OCR' | 'FILENAME' | 'MANUAL';
  isRealData?: boolean;
}

export interface ProcessingState {
  stage: 'ready' | 'processing' | 'analyzed' | 'submitting';
  message: string;
}

// Auto Supplier Detection
export interface DetectedSupplier {
  name: string;
  document: string;
  type: 'PF' | 'PJ';
  confidence: number;
  source: string;
}

export interface AutoSupplierModalState {
  open: boolean;
  detectedSupplier?: DetectedSupplier;
}

// ========================
// API CONTRACTS
// ========================

// Response padronizado para todas as APIs
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  documentId?: string; // Para endpoints de upload de documento
}

// Response de processamento de arquivo - Estrutura real da API
export interface ProcessFileResponse extends ApiResponse {
  suggestions?: ProcessedSuggestions;
  ocrText?: string;
  confidence?: number;
  qualityMetadata?: QualityMetadata;
}

// Estrutura real das sugestões retornadas pela API
export interface ProcessedSuggestions {
  // Campos principais
  amount?: string;
  supplier?: string;
  contraparte?: string;
  description?: string;
  documento?: string;
  category?: string;
  centerCost?: string;
  paymentDate?: string;
  dueDate?: string;
  
  // Níveis de confiança
  confidence?: {
    amount?: number;
    supplier?: number;
    description?: number;
    [key: string]: number | undefined;
  };
  
  // Dados reais para preenchimento automático
  hasRealData?: boolean;
  realData?: {
    contraparteId?: string;
    amount?: string;
    description?: string;
    competenceDate?: string;
    realPaidDate?: string;
    scheduledDate?: string;
    [key: string]: any;
  };
  
  // Sugestões operacionais
  hasOperationalSuggestions?: boolean;
  operationalSuggestions?: {
    bankId?: string;
    categoryId?: string;
    costCenterId?: string;
  };
  
  // IDs para preenchimento direto
  bankId?: string;
  categoryId?: string;
  costCenterId?: string;
}

export interface QualityMetadata {
  dataSource: 'OCR' | 'FILENAME' | 'MIXED';
  isFilenameData: boolean;
  ocrQuality: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL';
  isSystemPage: boolean;
  isIncomplete: boolean;
  characterCount: number;
  hasMonetaryValues: boolean;
}

// ========================
// FORM DATA TYPES
// ========================

// Dados do formulário de upload BPO
export interface BpoUploadFormData {
  // Tipo de documento
  documentType: DocumentType;
  
  // Dados básicos sempre obrigatórios
  amount: string;
  description: string;
  contraparteId?: string;
  
  // Dados condicionais por tipo
  competenceDate?: string;
  realPaidDate?: string;
  scheduledDate?: string;
  
  // Dados operacionais (sugestões da IA)
  bankId?: string;
  categoryId?: string;
  costCenterId?: string;
  notes?: string;
  
  // Campos para boleto/NF - dados do tomador
  payerDocument?: string;
  payerName?: string;
  payerEmail?: string;
  payerPhone?: string;
  payerContactName?: string;
  payerStateRegistration?: string;
  
  // Endereço completo do tomador
  payerStreet?: string;
  payerNumber?: string;
  payerComplement?: string;
  payerNeighborhood?: string;
  payerCity?: string;
  payerState?: string;
  payerZipCode?: string;
  payerAddress?: string;
  
  // Campos de serviço
  serviceCode?: string;
  serviceDescription?: string;
  instructions?: string;
}

// ========================
// DOCUMENT MAPPING
// ========================

export interface UnifiedDocumentData {
  // Campos padronizados para todos os tipos
  displayName: string;
  amount?: string;
  supplier?: string;
  dueDate?: string;
  status: string;
  documentType: string;
  isVirtual: boolean;
  
  // Campos básicos sempre disponíveis
  razaoSocial?: string;
  cnpj?: string;
  valor?: string;
  dataEmissao?: string;
  dataVencimento?: string;
  dataPagamento?: string;
  descricao?: string;
  endereco?: string;
  telefone?: string;
  email?: string;
  
  // Campos específicos para comprovantes de pagamento
  metodoPagamento?: string;
  contaOrigem?: string;
  agencia?: string;
  numeroOperacao?: string;
  banco?: string;
  
  // Seções específicas por tipo
  paymentInfo?: PaymentInfo;
  scheduleInfo?: ScheduleInfo;
  boletoInfo?: BoletoInfo;
  
  // Dados originais para debug
  rawExtractedData?: any;
  rawDocument?: any;
}

export interface PaymentInfo {
  method?: string;
  account?: string;
  agency?: string;
  operationNumber?: string;
  bank?: string;
  paidAt?: string;
}

export interface ScheduleInfo {
  scheduledAt?: string;
  expectedValue?: string;
  status?: string;
}

export interface BoletoInfo {
  dueDate?: string;
  payerName?: string;
  barcode?: string;
  digitableLine?: string;
  bank?: string;
  value?: string;
}

// ========================
// INCONSISTENCY MANAGEMENT
// ========================

export interface DataSource {
  value: any;
  confidence: number;
  source: 'OCR' | 'IA' | 'FILENAME' | 'MANUAL';
  quality?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface SmartRecommendation {
  recommendedValue: any;
  recommendedSource: DataSource;
  reasoning: string;
  confidence: number;
  action: 'AUTO_ACCEPT' | 'SUGGEST_REVIEW' | 'MANUAL_REQUIRED';
}

// ========================
// ERROR HANDLING
// ========================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
}

export interface ProcessingError {
  type: 'OCR_ERROR' | 'AI_ERROR' | 'VALIDATION_ERROR' | 'SYSTEM_ERROR';
  message: string;
  details?: any;
  field?: string;
  recoverable: boolean;
}