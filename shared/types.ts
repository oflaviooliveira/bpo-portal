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
  | "ADMIN" 
  | "GERENTE" 
  | "OPERADOR" 
  | "CLIENTE";

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

// RBAC Permissions Matrix
export const RolePermissions = {
  ADMIN: {
    documents: ["create", "read", "update", "delete", "export"],
    clients: ["create", "read", "update", "delete"],
    users: ["create", "read", "update", "delete"],
    reports: ["read", "export"],
    settings: ["read", "update"]
  },
  GERENTE: {
    documents: ["create", "read", "update", "export"],
    clients: ["create", "read", "update"],
    users: ["read"],
    reports: ["read", "export"],
    settings: ["read"]
  },
  OPERADOR: {
    documents: ["create", "read", "update"],
    clients: ["read"],
    users: [],
    reports: ["read"],
    settings: []
  },
  CLIENTE: {
    documents: ["create", "read"],
    clients: ["read"],
    users: [],
    reports: ["read"],
    settings: []
  }
} as const;