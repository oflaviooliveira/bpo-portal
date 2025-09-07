import { z } from 'zod';

/**
 * Schemas de validação Zod para endpoints críticos
 * Previne bugs e ataques durante desenvolvimento
 */

// Validação base para upload de documento - COMPLETA com todos os campos necessários
const baseDocumentUploadSchema = z.object({
  // Tipo de documento
  documentType: z.enum(['PAGO', 'AGENDADO', 'EMITIR_BOLETO', 'EMITIR_NF'], {
    errorMap: () => ({ message: 'Tipo de documento inválido' })
  }),
  
  // Campos básicos do documento
  supplier: z.string().optional(), // Pode ser UUID ou nome
  description: z.string().max(1000, 'Descrição muito longa').optional(),
  amount: z.string().regex(/^R?\$?\s?[\d.,]+$/, 'Valor inválido').optional(),
  
  // Sistema de contrapartes (novo)
  contraparteId: z.string().uuid().optional(),
  contraparteName: z.string().optional(),
  contraparteDocument: z.string().optional(),
  
  // Campos legacy para compatibilidade
  clientId: z.string().uuid().optional(),
  
  // Campos operacionais (sugestões da IA)
  bankId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(), 
  costCenterId: z.string().uuid().optional(),
  
  // Datas do documento
  competenceDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Data de competência inválida (DD/MM/AAAA)').optional(),
  dueDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Data de vencimento inválida (DD/MM/AAAA)').optional(),
  paidDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Data de pagamento inválida (DD/MM/AAAA)').optional(),
  realPaidDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Data real de pagamento inválida (DD/MM/AAAA)').optional(),
  scheduledDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Data de agendamento inválida (DD/MM/AAAA)').optional(),
  paymentDate: z.string().optional(),
  
  // Campos para emissão de boleto/NF
  payerDocument: z.string().optional(),
  payerName: z.string().optional(), 
  payerAddress: z.string().optional(),
  payerEmail: z.string().optional(),
  serviceCode: z.string().optional(),
  serviceDescription: z.string().optional(),
  instructions: z.string().optional(),
  
  // Observações
  notes: z.string().max(500, 'Observações muito longas').optional(),
});

// Validação condicional para documentos PAGO - apenas competenceDate e paidDate obrigatórios
export const pagoDocumentUploadSchema = baseDocumentUploadSchema.extend({
  competenceDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Data de competência é obrigatória para documentos PAGO (DD/MM/AAAA)'),
  paidDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Data de pagamento é obrigatória para documentos PAGO (DD/MM/AAAA)'),
});

// Validação para outros tipos de documento - mantém validação atual
export const defaultDocumentUploadSchema = baseDocumentUploadSchema;

// Schema principal com validação condicional
export const documentUploadSchema = z.discriminatedUnion('documentType', [
  pagoDocumentUploadSchema.extend({ documentType: z.literal('PAGO') }),
  defaultDocumentUploadSchema.extend({ documentType: z.literal('AGENDADO') }),
  defaultDocumentUploadSchema.extend({ documentType: z.literal('EMITIR_BOLETO') }),
  defaultDocumentUploadSchema.extend({ documentType: z.literal('EMITIR_NF') }),
]);

// Validação de login
export const loginSchema = z.object({
  username: z.string().min(3, 'Username deve ter pelo menos 3 caracteres').max(50),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(100),
});

// Validação de atualização de documento
export const documentUpdateSchema = z.object({
  documentType: z.enum(['PAGO', 'AGENDADO', 'EMITIR_BOLETO', 'EMITIR_NF']).optional(),
  supplier: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  amount: z.string().regex(/^\d+[,.]?\d{0,2}$/).optional(),
  competenceDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/).optional(),
  dueDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/).optional(),
  paidDate: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/).optional(),
  notes: z.string().max(500).optional(),
  status: z.enum([
    'RECEBIDO', 'VALIDANDO', 'PENDENTE_REVISAO', 'PAGO_A_CONCILIAR', 
    'AGENDADO', 'A_PAGAR_HOJE', 'AGUARDANDO_RECEBIMENTO', 'EM_CONCILIACAO', 'ARQUIVADO'
  ]).optional(),
});

// Validação de query parameters
export const listDocumentsQuerySchema = z.object({
  page: z.preprocess((val) => val ? Number(val) : 1, z.number().min(1).default(1)),
  limit: z.preprocess((val) => val ? Number(val) : 50, z.number().min(1).max(100).default(50)),
  status: z.string().optional(),
  documentType: z.enum(['PAGO', 'AGENDADO', 'EMITIR_BOLETO', 'EMITIR_NF']).optional(),
  supplier: z.string().max(255).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Validação de AI provider settings
export const aiProviderSettingsSchema = z.object({
  name: z.enum(['glm', 'openai']),
  enabled: z.boolean(),
  priority: z.number().min(1).max(10),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(100).max(4000).optional(),
});

// Validação de transição de status
export const statusTransitionSchema = z.object({
  documentId: z.string().uuid('ID do documento inválido'),
  newStatus: z.enum([
    'RECEBIDO', 'VALIDANDO', 'PENDENTE_REVISAO', 'PAGO_A_CONCILIAR', 
    'AGENDADO', 'A_PAGAR_HOJE', 'AGUARDANDO_RECEBIMENTO', 'EM_CONCILIACAO', 'ARQUIVADO'
  ]),
  reason: z.string().max(200).optional(),
});

/**
 * Middleware para validar request body
 */
export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Dados inválidos',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
}

/**
 * Middleware para validar query parameters
 */
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Parâmetros inválidos',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      next(error);
    }
  };
}

/**
 * Sanitização básica de strings
 */
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>\"']/g, '') // Remove caracteres perigosos
    .substring(0, 1000); // Limita tamanho
}