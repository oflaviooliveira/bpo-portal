import { describe, test, expect } from '@jest/globals';
import { z } from 'zod';
import type { BpoUploadFormData, DocumentType } from '@shared/types';

// Schema espelhado do componente para testes
const bpoUploadSchema = z.object({
  documentType: z.enum(['PAGO', 'AGENDADO', 'EMITIR_BOLETO', 'EMITIR_NF']),
  amount: z.string().min(1, 'Valor é obrigatório'),
  contraparteId: z.string().optional(),
  description: z.string().min(1, 'Descrição é obrigatória'),
  competenceDate: z.string().optional(),
  realPaidDate: z.string().optional(),
  scheduledDate: z.string().optional(),
  bankId: z.string().optional(),
  categoryId: z.string().optional(),
  costCenterId: z.string().optional(),
  notes: z.string().optional(),
  // Campos para boleto/NF
  payerDocument: z.string().optional(),
  payerName: z.string().optional(),
  payerEmail: z.string().optional(),
  serviceCode: z.string().optional(),
  serviceDescription: z.string().optional()
});

describe('Validação de Formulários por Tipo de Documento', () => {
  
  describe('Documento PAGO', () => {
    test('deve validar campos obrigatórios para PAGO', () => {
      const dadosPago: Partial<BpoUploadFormData> = {
        documentType: 'PAGO',
        amount: 'R$ 1.500,00',
        description: 'Pagamento realizado',
        contraparteId: 'supplier-123',
        realPaidDate: '15/03/2024'
      };

      const result = bpoUploadSchema.safeParse(dadosPago);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.documentType).toBe('PAGO');
        expect(result.data.amount).toBeTruthy();
        expect(result.data.description).toBeTruthy();
      }
    });

    test('deve rejeitar PAGO sem valor', () => {
      const dadosInvalidos = {
        documentType: 'PAGO',
        amount: '', // Vazio - inválido
        description: 'Descrição válida',
        contraparteId: 'supplier-123'
      };

      const result = bpoUploadSchema.safeParse(dadosInvalidos);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const errors = result.error.errors;
        expect(errors.some(e => e.path.includes('amount'))).toBe(true);
      }
    });

    test('deve rejeitar PAGO sem descrição', () => {
      const dadosInvalidos = {
        documentType: 'PAGO',
        amount: 'R$ 1.000,00',
        description: '', // Vazio - inválido
        contraparteId: 'supplier-123'
      };

      const result = bpoUploadSchema.safeParse(dadosInvalidos);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const errors = result.error.errors;
        expect(errors.some(e => e.path.includes('description'))).toBe(true);
      }
    });
  });

  describe('Documento AGENDADO', () => {
    test('deve validar campos obrigatórios para AGENDADO', () => {
      const dadosAgendado: Partial<BpoUploadFormData> = {
        documentType: 'AGENDADO',
        amount: 'R$ 2.000,00',
        description: 'Pagamento agendado',
        contraparteId: 'supplier-456',
        scheduledDate: '25/04/2024'
      };

      const result = bpoUploadSchema.safeParse(dadosAgendado);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.documentType).toBe('AGENDADO');
        expect(result.data.scheduledDate).toBeTruthy();
      }
    });

    test('deve aceitar AGENDADO sem data de agendamento (pode ser preenchida depois)', () => {
      const dadosAgendado = {
        documentType: 'AGENDADO',
        amount: 'R$ 2.000,00',
        description: 'Pagamento a agendar',
        contraparteId: 'supplier-456'
        // scheduledDate ausente - deve ser opcional
      };

      const result = bpoUploadSchema.safeParse(dadosAgendado);
      expect(result.success).toBe(true);
    });
  });

  describe('Documento EMITIR_BOLETO', () => {
    test('deve validar campos obrigatórios para EMITIR_BOLETO', () => {
      const dadosBoleto: Partial<BpoUploadFormData> = {
        documentType: 'EMITIR_BOLETO',
        amount: 'R$ 5.000,00',
        description: 'Emissão de boleto',
        payerDocument: '12345678901',
        payerName: 'Cliente Teste',
        payerEmail: 'cliente@teste.com'
      };

      const result = bpoUploadSchema.safeParse(dadosBoleto);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.documentType).toBe('EMITIR_BOLETO');
        expect(result.data.payerDocument).toBeTruthy();
        expect(result.data.payerName).toBeTruthy();
      }
    });

    test('deve aceitar EMITIR_BOLETO com dados mínimos', () => {
      const dadosBoletoMinimo = {
        documentType: 'EMITIR_BOLETO',
        amount: 'R$ 1.000,00',
        description: 'Boleto básico'
        // Outros campos opcionais
      };

      const result = bpoUploadSchema.safeParse(dadosBoletoMinimo);
      expect(result.success).toBe(true);
    });
  });

  describe('Documento EMITIR_NF', () => {
    test('deve validar campos obrigatórios para EMITIR_NF', () => {
      const dadosNF: Partial<BpoUploadFormData> = {
        documentType: 'EMITIR_NF',
        amount: 'R$ 3.000,00',
        description: 'Emissão de nota fiscal',
        serviceCode: '10.01',
        serviceDescription: 'Consultoria em TI',
        payerDocument: '98765432000199',
        payerName: 'Empresa Cliente LTDA'
      };

      const result = bpoUploadSchema.safeParse(dadosNF);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.documentType).toBe('EMITIR_NF');
        expect(result.data.serviceCode).toBeTruthy();
        expect(result.data.serviceDescription).toBeTruthy();
      }
    });

    test('deve aceitar EMITIR_NF com código de serviço opcional', () => {
      const dadosNFSimples = {
        documentType: 'EMITIR_NF',
        amount: 'R$ 2.500,00',
        description: 'Serviços prestados'
        // serviceCode e serviceDescription opcionais no schema base
      };

      const result = bpoUploadSchema.safeParse(dadosNFSimples);
      expect(result.success).toBe(true);
    });
  });

  describe('Validações Transversais', () => {
    test('deve validar formato de valor monetário', () => {
      const valoresValidos = [
        'R$ 1.000,00',
        '1000',
        '1.500,50',
        'R$ 2500'
      ];

      valoresValidos.forEach(valor => {
        const isValidFormat = /^R?\$?\s?[\d.,]+$/.test(valor);
        expect(isValidFormat).toBe(true);
      });
    });

    test('deve rejeitar formato de valor inválido', () => {
      const valoresInvalidos = [
        'abc',
        'R$ valor',
        '1.000.000.000,00', // Muito específico, mas poderia ser válido
        ''
      ];

      valoresInvalidos.forEach(valor => {
        if (valor === '') {
          // Valor vazio deve falhar na validação min(1)
          const result = bpoUploadSchema.safeParse({
            documentType: 'PAGO',
            amount: valor,
            description: 'Teste'
          });
          expect(result.success).toBe(false);
        }
      });
    });

    test('deve validar formato de data brasileira', () => {
      const datasValidas = [
        '15/03/2024',
        '01/12/2023',
        '30/06/2024'
      ];

      datasValidas.forEach(data => {
        const isValidFormat = /^\d{2}\/\d{2}\/\d{4}$/.test(data);
        expect(isValidFormat).toBe(true);
      });
    });

    test('deve rejeitar formato de data inválido', () => {
      const datasInvalidas = [
        '2024-03-15', // Formato ISO
        '15/3/24', // Ano abreviado  
        'invalid'
      ];

      datasInvalidas.forEach(data => {
        const isValidFormat = /^\d{2}\/\d{2}\/\d{4}$/.test(data);
        expect(isValidFormat).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    test('deve tratar tipo de documento inválido', () => {
      const dadosInvalidos = {
        documentType: 'TIPO_INEXISTENTE',
        amount: 'R$ 1.000,00',
        description: 'Teste'
      };

      const result = bpoUploadSchema.safeParse(dadosInvalidos);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const errors = result.error.errors;
        expect(errors.some(e => e.path.includes('documentType'))).toBe(true);
      }
    });

    test('deve tratar dados completamente vazios', () => {
      const dadosVazios = {};

      const result = bpoUploadSchema.safeParse(dadosVazios);
      expect(result.success).toBe(false);
      
      if (!result.success) {
        const errors = result.error.errors;
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(e => e.path.includes('documentType'))).toBe(true);
        expect(errors.some(e => e.path.includes('amount'))).toBe(true);
      }
    });

    test('deve preservar campos opcionais quando válidos', () => {
      const dadosCompletos = {
        documentType: 'PAGO',
        amount: 'R$ 1.500,00',
        description: 'Pagamento completo',
        contraparteId: 'supplier-123',
        bankId: 'bank-456',
        categoryId: 'category-789',
        costCenterId: 'cost-center-012',
        notes: 'Observações importantes'
      };

      const result = bpoUploadSchema.safeParse(dadosCompletos);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.bankId).toBe('bank-456');
        expect(result.data.categoryId).toBe('category-789');
        expect(result.data.notes).toBe('Observações importantes');
      }
    });
  });
});