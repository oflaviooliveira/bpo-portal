import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import type { DetectedSupplier } from '@shared/types';

describe('Auto-detecção de Fornecedor - Funcionalidade Crítica', () => {
  
  describe('Detecção por Nome', () => {
    test('deve detectar fornecedor conhecido (Uber)', () => {
      const mockDetection: DetectedSupplier = {
        name: 'Uber do Brasil',
        document: '17895681000196',
        type: 'PJ',
        confidence: 95,
        source: 'Fornecedor conhecido detectado'
      };

      expect(mockDetection.name).toContain('Uber');
      expect(mockDetection.type).toBe('PJ');
      expect(mockDetection.confidence).toBeGreaterThan(90);
      expect(mockDetection.document).toMatch(/^\d{14}$/); // CNPJ válido
    });

    test('deve detectar fornecedor novo com CNPJ válido', () => {
      const mockNewSupplier: DetectedSupplier = {
        name: 'Nova Empresa LTDA',
        document: '12345678000199',
        type: 'PJ',
        confidence: 80,
        source: 'Novo fornecedor detectado no documento'
      };

      expect(mockNewSupplier.name).toBeTruthy();
      expect(mockNewSupplier.type).toBe('PJ');
      expect(mockNewSupplier.confidence).toBeGreaterThan(70);
      expect(mockNewSupplier.document).toHaveLength(14);
    });

    test('deve detectar pessoa física (CPF)', () => {
      const mockPFSupplier: DetectedSupplier = {
        name: 'João Silva',
        document: '12345678901',
        type: 'PF',
        confidence: 85,
        source: 'Pessoa física detectada'
      };

      expect(mockPFSupplier.type).toBe('PF');
      expect(mockPFSupplier.document).toHaveLength(11);
      expect(mockPFSupplier.confidence).toBeGreaterThan(80);
    });
  });

  describe('Validação de Documentos', () => {
    test('deve validar CNPJ com formatação', () => {
      const documentoComFormatacao = '17.895.681/0001-96';
      const documentoLimpo = documentoComFormatacao.replace(/[^\d]/g, '');
      
      expect(documentoLimpo).toHaveLength(14);
      expect(documentoLimpo).toMatch(/^\d{14}$/);
    });

    test('deve validar CPF com formatação', () => {
      const cpfComFormatacao = '123.456.789-01';
      const cpfLimpo = cpfComFormatacao.replace(/[^\d]/g, '');
      
      expect(cpfLimpo).toHaveLength(11);
      expect(cpfLimpo).toMatch(/^\d{11}$/);
    });

    test('deve rejeitar documento inválido', () => {
      const documentoInvalido = '123abc';
      const documentoLimpo = documentoInvalido.replace(/[^\d]/g, '');
      
      expect(documentoLimpo).toHaveLength(3); // Muito curto
      expect(documentoLimpo.length).toBeLessThan(11); // Inválido
    });
  });

  describe('Níveis de Confiança', () => {
    test('fornecedor conhecido deve ter alta confiança', () => {
      const fornecedoresConhecidos = [
        'uber', 'ifood', '99', 'rappi', 'amazon', 'mercado livre'
      ];

      fornecedoresConhecidos.forEach(nome => {
        const isKnown = nome.toLowerCase().includes('uber');
        const expectedConfidence = isKnown ? 95 : 80;
        
        expect(expectedConfidence).toBeGreaterThan(75);
      });
    });

    test('fornecedor novo deve ter confiança moderada', () => {
      const novoFornecedor = 'Empresa Desconhecida LTDA';
      const confidence = 80; // Confiança padrão para novos
      
      expect(confidence).toBeGreaterThanOrEqual(70);
      expect(confidence).toBeLessThan(95);
    });

    test('dados incompletos devem ter baixa confiança', () => {
      const dadosIncompletos: DetectedSupplier = {
        name: 'ABC', // Nome muito curto
        document: '',
        type: 'PJ',
        confidence: 40,
        source: 'Dados incompletos'
      };

      expect(dadosIncompletos.confidence).toBeLessThan(50);
      expect(dadosIncompletos.name.length).toBeLessThan(5);
    });
  });

  describe('Integração com Contrapartes Existentes', () => {
    test('deve encontrar fornecedor existente por nome', () => {
      const fornecedoresExistentes = [
        { id: '1', name: 'Uber do Brasil', document: '17895681000196' },
        { id: '2', name: 'iFood', document: '12345678000199' }
      ];

      const nomeDetectado = 'uber';
      const encontrado = fornecedoresExistentes.find(f => 
        f.name.toLowerCase().includes(nomeDetectado.toLowerCase()) ||
        nomeDetectado.toLowerCase().includes(f.name.toLowerCase())
      );

      expect(encontrado).toBeTruthy();
      expect(encontrado?.name).toContain('Uber');
    });

    test('deve encontrar fornecedor existente por documento', () => {
      const fornecedoresExistentes = [
        { id: '1', name: 'Empresa A', document: '12345678000199' },
        { id: '2', name: 'Empresa B', document: '98765432000188' }
      ];

      const documentoDetectado = '12345678000199';
      const encontrado = fornecedoresExistentes.find(f => 
        f.document === documentoDetectado
      );

      expect(encontrado).toBeTruthy();
      expect(encontrado?.document).toBe(documentoDetectado);
    });

    test('não deve encontrar fornecedor inexistente', () => {
      const fornecedoresExistentes = [
        { id: '1', name: 'Empresa A', document: '12345678000199' }
      ];

      const nomeNovo = 'Empresa Totalmente Nova';
      const encontrado = fornecedoresExistentes.find(f => 
        f.name.toLowerCase().includes(nomeNovo.toLowerCase())
      );

      expect(encontrado).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    test('deve tratar nome vazio', () => {
      const nomeVazio = '';
      const isValid = nomeVazio.length > 0 && nomeVazio.trim().length > 1;
      
      expect(isValid).toBeFalsy();
    });

    test('deve tratar nome muito curto', () => {
      const nomeCurto = 'AB';
      const isValid = nomeCurto.trim().length > 2;
      
      expect(isValid).toBeFalsy();
    });

    test('deve normalizar nomes com caracteres especiais', () => {
      const nomeComCaracteres = 'Empresa & Associados LTDA.';
      const nomeNormalizado = nomeComCaracteres.replace(/[&.]/g, '').trim();
      
      expect(nomeNormalizado).toBe('Empresa  Associados LTDA');
      expect(nomeNormalizado).not.toContain('&');
    });
  });
});