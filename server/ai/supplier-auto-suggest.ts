/**
 * SupplierAutoSuggest - Sistema Inteligente de Auto-Sugestão de Fornecedores
 * Combina detecção OCR + busca fuzzy + auto-cadastro inteligente
 */

import { SupplierDetector, type SupplierDetectionResult } from "./supplier-detector";
import { SupplierMatcher, type MatchResult } from "./supplier-matcher";
import { storage } from "../storage";
import { type InsertContraparte } from "@shared/schema";

export interface AutoSuggestResult {
  // Resultado da detecção
  detected: SupplierDetectionResult;
  
  // Matches encontrados na base
  matches: MatchResult[];
  
  // Recomendação final
  recommendation: AutoSuggestRecommendation;
  
  // Dados para auto-preenchimento
  suggestedSupplier?: SuggestedSupplierData;
}

export interface AutoSuggestRecommendation {
  action: 'AUTO_SELECT' | 'SUGGEST_MATCH' | 'CREATE_NEW' | 'MANUAL_REVIEW';
  confidence: number;
  reasoning: string;
  supplierToUse?: any; // Existing supplier from database
  dataToCreate?: InsertContraparte; // New supplier data
}

export interface SuggestedSupplierData {
  name: string;
  document?: string;
  documentType?: 'CPF' | 'CNPJ' | 'OUTROS';
  category?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  canBeSupplier: boolean;
  canBeClient: boolean;
}

export class SupplierAutoSuggest {
  
  /**
   * Processamento completo: detecção + busca + sugestão
   */
  static async processDocument(
    ocrText: string, 
    fileName: string, 
    tenantId: string,
    documentType?: string
  ): Promise<AutoSuggestResult> {
    console.log('🤖 Iniciando auto-sugestão inteligente de fornecedor...');
    
    // 1. DETECÇÃO: Extrair dados do documento
    const detected = SupplierDetector.detectSupplier(ocrText, fileName, documentType);
    console.log(`🔍 Fornecedor detectado: ${detected.supplier?.name || 'NENHUM'} (${detected.supplier?.confidence || 0}%)`);
    
    // 2. BUSCA: Procurar similares na base
    let matches: MatchResult[] = [];
    if (detected.supplier) {
      matches = await SupplierMatcher.findSimilarSuppliers(
        detected.supplier.name,
        detected.supplier.cnpj,
        { 
          tenantId,
          minSimilarity: 60,
          maxResults: 3
        }
      );
      console.log(`📊 Encontrados ${matches.length} matches na base`);
    }
    
    // 3. RECOMENDAÇÃO: Decidir ação baseada nos dados
    const recommendation = this.generateRecommendation(detected, matches);
    console.log(`💡 Recomendação: ${recommendation.action} (${recommendation.confidence}%)`);
    
    // 4. DADOS SUGERIDOS: Preparar dados para interface
    const suggestedSupplier = this.prepareSuggestedData(detected, matches, recommendation);
    
    return {
      detected,
      matches,
      recommendation,
      suggestedSupplier
    };
  }

  /**
   * Gera recomendação inteligente baseada na detecção e matches
   */
  private static generateRecommendation(
    detected: SupplierDetectionResult,
    matches: MatchResult[]
  ): AutoSuggestRecommendation {
    
    // Caso 1: Nenhum fornecedor detectado
    if (!detected.supplier) {
      return {
        action: 'MANUAL_REVIEW',
        confidence: 0,
        reasoning: 'Não foi possível detectar fornecedor automaticamente. Revisão manual necessária.'
      };
    }

    // Caso 2: Match exato por CNPJ
    const exactCnpjMatch = matches.find(m => m.matchType === 'EXACT_CNPJ');
    if (exactCnpjMatch) {
      return {
        action: 'AUTO_SELECT',
        confidence: 95,
        reasoning: `CNPJ ${detected.supplier.cnpj} encontrado na base. Seleção automática do fornecedor "${exactCnpjMatch.supplier.name}".`,
        supplierToUse: exactCnpjMatch.supplier
      };
    }

    // Caso 3: Match exato por nome
    const exactNameMatch = matches.find(m => m.matchType === 'EXACT_NAME' && m.similarity >= 95);
    if (exactNameMatch) {
      return {
        action: 'AUTO_SELECT',
        confidence: 90,
        reasoning: `Nome "${detected.supplier.name}" encontrado na base. Seleção automática do fornecedor "${exactNameMatch.supplier.name}".`,
        supplierToUse: exactNameMatch.supplier
      };
    }

    // Caso 4: Match fuzzy muito forte
    const strongMatch = matches.find(m => SupplierMatcher.isAutoSelectableMatch(m));
    if (strongMatch) {
      return {
        action: 'AUTO_SELECT',
        confidence: strongMatch.confidence,
        reasoning: `Fornecedor muito similar encontrado: "${strongMatch.supplier.name}" (${strongMatch.similarity}% similaridade). Seleção automática.`,
        supplierToUse: strongMatch.supplier
      };
    }

    // Caso 5: Matches bons mas não automáticos
    const goodMatches = matches.filter(m => m.similarity >= 75);
    if (goodMatches.length > 0) {
      const bestMatch = goodMatches[0];
      return {
        action: 'SUGGEST_MATCH',
        confidence: bestMatch.confidence,
        reasoning: `Fornecedor similar encontrado: "${bestMatch.supplier.name}" (${bestMatch.similarity}% similaridade). Confirme se é o mesmo.`,
        supplierToUse: bestMatch.supplier
      };
    }

    // Caso 6: Detecção boa mas sem matches - criar novo
    if (detected.supplier.confidence >= 70) {
      const newSupplierData = this.buildNewSupplierData(detected.supplier);
      return {
        action: 'CREATE_NEW',
        confidence: detected.supplier.confidence,
        reasoning: `Fornecedor "${detected.supplier.name}" não encontrado na base. Sugerindo cadastro automático.`,
        dataToCreate: newSupplierData
      };
    }

    // Caso 7: Detecção fraca - revisão manual
    return {
      action: 'MANUAL_REVIEW',
      confidence: detected.supplier.confidence,
      reasoning: `Fornecedor "${detected.supplier.name}" detectado com baixa confiança (${detected.supplier.confidence}%). Revisão manual recomendada.`
    };
  }

  /**
   * Prepara dados sugeridos para interface
   */
  private static prepareSuggestedData(
    detected: SupplierDetectionResult,
    matches: MatchResult[],
    recommendation: AutoSuggestRecommendation
  ): SuggestedSupplierData | undefined {
    
    if (recommendation.action === 'AUTO_SELECT' || recommendation.action === 'SUGGEST_MATCH') {
      // Usar dados do fornecedor existente
      const supplier = recommendation.supplierToUse;
      return {
        name: supplier.name,
        document: supplier.document || '',
        documentType: supplier.documentType || 'OUTROS',
        email: supplier.email || '',
        phone: supplier.phone || '',
        address: supplier.address || '',
        notes: supplier.notes || '',
        canBeSupplier: supplier.canBeSupplier,
        canBeClient: supplier.canBeClient
      };
    }
    
    if (recommendation.action === 'CREATE_NEW' && detected.supplier) {
      // Usar dados detectados para novo fornecedor
      return {
        name: detected.supplier.name,
        document: detected.supplier.cnpj || '',
        documentType: detected.supplier.cnpj ? 'CNPJ' : 'OUTROS',
        email: '',
        phone: '',
        address: '',
        notes: `Auto-detectado em ${new Date().toLocaleDateString('pt-BR')} (${detected.supplier.source})`,
        canBeSupplier: true,
        canBeClient: false
      };
    }

    return undefined;
  }

  /**
   * Constrói dados para novo fornecedor
   */
  private static buildNewSupplierData(supplier: any): InsertContraparte {
    return {
      name: supplier.name,
      document: supplier.cnpj || '',
      documentType: supplier.cnpj ? 'CNPJ' : 'OUTROS',
      canBeSupplier: true,
      canBeClient: false,
      notes: `Auto-detectado em ${new Date().toLocaleDateString('pt-BR')} (${supplier.source})`,
      tenantId: '' // Será preenchido no momento da criação
    };
  }

  /**
   * Executa a ação recomendada automaticamente
   */
  static async executeRecommendation(
    result: AutoSuggestResult,
    tenantId: string
  ): Promise<{ success: boolean, supplier?: any, created?: boolean, error?: string }> {
    
    const { recommendation } = result;
    
    try {
      switch (recommendation.action) {
        case 'AUTO_SELECT':
        case 'SUGGEST_MATCH':
          // Retornar fornecedor existente
          return {
            success: true,
            supplier: recommendation.supplierToUse,
            created: false
          };
          
        case 'CREATE_NEW':
          if (!recommendation.dataToCreate) {
            throw new Error('Dados para criação não disponíveis');
          }
          
          // Criar novo fornecedor
          const newSupplierData = {
            ...recommendation.dataToCreate,
            tenantId
          };
          
          const createdSupplier = await storage.createContraparte(newSupplierData);
          console.log(`✅ Novo fornecedor criado: ${createdSupplier.name} (ID: ${createdSupplier.id})`);
          
          return {
            success: true,
            supplier: createdSupplier,
            created: true
          };
          
        case 'MANUAL_REVIEW':
          // Não executa ação automática
          return {
            success: true,
            supplier: null,
            created: false
          };
          
        default:
          throw new Error(`Ação não reconhecida: ${recommendation.action}`);
      }
      
    } catch (error) {
      console.error(`❌ Erro ao executar recomendação: ${error}`);
      return {
        success: false,
        error: `Erro ao executar recomendação: ${error}`
      };
    }
  }

  /**
   * Interface para uso direto no pipeline de processamento
   */
  static async autoDetectAndSuggest(
    ocrText: string,
    fileName: string,
    tenantId: string,
    documentType?: string,
    autoExecute: boolean = false
  ): Promise<{
    supplierName?: string;
    supplierDocument?: string;
    supplierCategory?: string;
    autoSuggestResult: AutoSuggestResult;
    executionResult?: any;
  }> {
    
    // Processar detecção e sugestão
    const autoSuggestResult = await this.processDocument(ocrText, fileName, tenantId, documentType);
    
    let executionResult;
    let supplierName, supplierDocument, supplierCategory;
    
    // Executar automaticamente se solicitado
    if (autoExecute) {
      executionResult = await this.executeRecommendation(autoSuggestResult, tenantId);
      
      if (executionResult.success && executionResult.supplier) {
        supplierName = executionResult.supplier.name;
        supplierDocument = executionResult.supplier.document;
        supplierCategory = executionResult.supplier.category;
      }
    } else {
      // Apenas sugerir dados sem executar
      const suggested = autoSuggestResult.suggestedSupplier;
      if (suggested) {
        supplierName = suggested.name;
        supplierDocument = suggested.document;
        supplierCategory = suggested.category;
      }
    }
    
    return {
      supplierName,
      supplierDocument,
      supplierCategory,
      autoSuggestResult,
      executionResult
    };
  }
}