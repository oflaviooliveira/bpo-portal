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