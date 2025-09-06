/**
 * SupplierMatcher - Sistema de Busca Fuzzy para Fornecedores
 * Encontra fornecedores similares na base existente usando algoritmos de similaridade
 */

import { storage } from "../storage";

export interface MatchResult {
  supplier: any; // Existing supplier from database
  similarity: number; // 0-100 score
  matchType: 'EXACT_NAME' | 'FUZZY_NAME' | 'EXACT_CNPJ' | 'PARTIAL_NAME';
  confidence: number;
}

export interface MatchingOptions {
  minSimilarity?: number; // Minimum similarity score (default: 60)
  maxResults?: number; // Maximum results to return (default: 5)
  exactCNPJOnly?: boolean; // Only match by exact CNPJ
  tenantId: string; // Required for tenant isolation
}

export class SupplierMatcher {
  
  /**
   * Encontra fornecedores similares na base existente
   */
  static async findSimilarSuppliers(
    supplierName: string,
    cnpj?: string,
    options: MatchingOptions = { tenantId: '' }
  ): Promise<MatchResult[]> {
    console.log(`🔍 Buscando fornecedores similares a: "${supplierName}"${cnpj ? ` (CNPJ: ${cnpj})` : ''}`);
    
    const {
      minSimilarity = 60,
      maxResults = 5,
      exactCNPJOnly = false,
      tenantId
    } = options;

    try {
      // Buscar todos os fornecedores do tenant
      const existingSuppliers = await storage.getContrapartes(tenantId, { canBeSupplier: true });
      console.log(`📊 Encontrados ${existingSuppliers.length} fornecedores na base`);

      const matches: MatchResult[] = [];

      for (const supplier of existingSuppliers) {
        // 1. MATCH EXATO POR CNPJ (maior prioridade)
        if (cnpj && supplier.document && this.normalizeCNPJ(cnpj) === this.normalizeCNPJ(supplier.document)) {
          matches.push({
            supplier,
            similarity: 100,
            matchType: 'EXACT_CNPJ',
            confidence: 95
          });
          continue;
        }

        // Se só quer match por CNPJ, pula outros tipos
        if (exactCNPJOnly) continue;

        // 2. MATCH EXATO POR NOME (normalizado)
        const normalizedInput = this.normalizeCompanyName(supplierName);
        const normalizedExisting = this.normalizeCompanyName(supplier.name);
        
        if (normalizedInput === normalizedExisting) {
          matches.push({
            supplier,
            similarity: 95,
            matchType: 'EXACT_NAME',
            confidence: 90
          });
          continue;
        }

        // 3. MATCH FUZZY POR NOME
        const similarity = this.calculateStringSimilarity(normalizedInput, normalizedExisting);
        if (similarity >= minSimilarity) {
          matches.push({
            supplier,
            similarity,
            matchType: similarity >= 85 ? 'FUZZY_NAME' : 'PARTIAL_NAME',
            confidence: Math.min(similarity - 10, 85) // Confidence é sempre menor que similarity
          });
        }

        // 4. MATCH PARCIAL (palavras-chave)
        if (similarity < minSimilarity) {
          const partialSimilarity = this.calculatePartialMatch(normalizedInput, normalizedExisting);
          if (partialSimilarity >= minSimilarity) {
            matches.push({
              supplier,
              similarity: partialSimilarity,
              matchType: 'PARTIAL_NAME',
              confidence: Math.min(partialSimilarity - 15, 70)
            });
          }
        }
      }

      // Ordenar por similarity (maior primeiro) e limitar resultados
      const sortedMatches = matches
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, maxResults);

      console.log(`✅ Encontrados ${sortedMatches.length} matches para "${supplierName}"`);
      sortedMatches.forEach(match => {
        console.log(`  - ${match.supplier.name} (${match.similarity}% similar, ${match.matchType})`);
      });

      return sortedMatches;

    } catch (error) {
      console.error(`❌ Erro na busca de fornecedores similares: ${error}`);
      return [];
    }
  }

  /**
   * Normaliza CNPJ removendo caracteres especiais
   */
  private static normalizeCNPJ(cnpj: string): string {
    return cnpj.replace(/\D/g, '');
  }

  /**
   * Normaliza nome da empresa para comparação
   */
  private static normalizeCompanyName(name: string): string {
    return name
      .toUpperCase()
      .trim()
      .replace(/\s+/g, ' ')
      // Remove sufixos comuns de empresa
      .replace(/\s+(LTDA|S\.?A\.?|EIRELI|ME|EPP|CIA|COMPANHIA)\.?$/i, '')
      // Remove artigos e preposições
      .replace(/\b(DA|DE|DO|DOS|DAS|E|&)\b/g, '')
      // Remove caracteres especiais
      .replace(/[^A-Z0-9\s]/g, '')
      .trim();
  }

  /**
   * Calcula similaridade entre duas strings usando algoritmo de Levenshtein adaptado
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 100;
    if (str1.length === 0 || str2.length === 0) return 0;

    // Usar Levenshtein distance
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    
    // Converter distância em percentual de similaridade
    const similarity = ((maxLength - distance) / maxLength) * 100;
    
    return Math.round(similarity);
  }

  /**
   * Implementação eficiente do algoritmo de Levenshtein
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calcula match parcial baseado em palavras-chave comuns
   */
  private static calculatePartialMatch(str1: string, str2: string): number {
    const words1 = str1.split(/\s+/).filter(w => w.length > 2); // Palavras com mais de 2 chars
    const words2 = str2.split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;

    let commonWords = 0;
    let totalLength = 0;

    for (const word1 of words1) {
      for (const word2 of words2) {
        if (word1 === word2) {
          commonWords += 1;
          totalLength += word1.length;
          break;
        }
        // Match parcial para palavras longas
        if (word1.length >= 4 && word2.length >= 4) {
          if (word1.includes(word2) || word2.includes(word1)) {
            commonWords += 0.7;
            totalLength += Math.min(word1.length, word2.length);
            break;
          }
        }
      }
    }

    // Score baseado na proporção de palavras em comum e seu peso
    const wordScore = (commonWords / Math.max(words1.length, words2.length)) * 100;
    const lengthBonus = Math.min(totalLength / Math.max(str1.length, str2.length) * 20, 20);
    
    return Math.round(Math.min(wordScore + lengthBonus, 85)); // Max 85% para match parcial
  }

  /**
   * Sugere novo fornecedor se nenhum match for encontrado
   */
  static generateNewSupplierSuggestion(supplierName: string, cnpj?: string, category?: string) {
    return {
      name: supplierName,
      document: cnpj || '',
      documentType: cnpj ? 'CNPJ' : 'OUTROS',
      category: category || 'OUTROS',
      canBeSupplier: true,
      canBeClient: false,
      // Campos opcionais que podem ser preenchidos depois
      email: '',
      phone: '',
      address: '',
      notes: `Auto-sugerido a partir do documento processado em ${new Date().toLocaleDateString('pt-BR')}`
    };
  }

  /**
   * Avalia se um match é confiável o suficiente para seleção automática
   */
  static isAutoSelectableMatch(match: MatchResult): boolean {
    // CNPJ exato = seleção automática
    if (match.matchType === 'EXACT_CNPJ') return true;
    
    // Nome exato = seleção automática
    if (match.matchType === 'EXACT_NAME' && match.similarity >= 95) return true;
    
    // Match fuzzy muito alto = seleção automática
    if (match.matchType === 'FUZZY_NAME' && match.similarity >= 90 && match.confidence >= 80) return true;
    
    return false;
  }
}