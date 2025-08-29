import { NotaFiscalAnalyzer } from "./nota-fiscal-analyzer";
import { aiMultiProvider } from "../ai-multi-provider";

// Removido OpenAI direto - agora usa AIMultiProvider

export interface DocumentAnalysisResult {
  success: boolean;
  extractedData?: {
    fornecedor?: string;
    contraparte?: string;
    documento?: string;
    tipo_documento_pessoa?: string;
    tipo_relacao?: string;
    descricao?: string;
    valor?: string;
    data_vencimento?: string;
    data_pagamento?: string;
    categoria?: string;
    centro_custo?: string;
  };
  confidence: number;
  reasoning?: string;
  error?: string;
}

export class DocumentAnalyzer {
  
  /**
   * Analisa texto extraído de documento financeiro usando AI Multi-Provider
   */
  async analyzeDocument(
    extractedText: string, 
    filename: string, 
    documentId: string,
    tenantId: string,
    documentContext?: string,
    qualityFlags?: any
  ): Promise<DocumentAnalysisResult> {
    
    if (!extractedText || extractedText.trim().length < 10) {
      return {
        success: false,
        confidence: 0,
        error: 'Texto insuficiente para análise'
      };
    }

    console.log(`🤖 Analisando documento com IA: ${filename}`);
    console.log(`📝 Texto extraído (${extractedText.length} chars): ${extractedText.substring(0, 200)}...`);

    try {
      // Se for nota fiscal, usar analisador específico primeiro
      if (NotaFiscalAnalyzer.isNotaFiscal(extractedText)) {
        console.log("📋 Detectada nota fiscal - usando analisador especializado");
        const nfData = NotaFiscalAnalyzer.analyzeNotaFiscal(extractedText);
        
        if (nfData) {
          console.log(`✅ Nota fiscal analisada: Fornecedor=${nfData.fornecedor}, Valor=${nfData.valor}`);
          return {
            success: true,
            extractedData: {
              fornecedor: nfData.fornecedor,
              contraparte: nfData.fornecedor,
              documento: nfData.fornecedorCnpj,
              tipo_documento_pessoa: "CNPJ",
              tipo_relacao: "SUPPLIER",
              descricao: nfData.descricao,
              valor: nfData.valor,
              data_vencimento: "",
              data_pagamento: "",
              categoria: "Produtos/Serviços",
              centro_custo: ""
            },
            confidence: 95,
            reasoning: `Nota fiscal analisada: Emitente identificado como fornecedor (${nfData.fornecedor}), CNPJ ${nfData.fornecedorCnpj}`
          };
        }
      }

      // Usar AI Multi-Provider (GLM-4.5 como primária, OpenAI como fallback)
      console.log("🔄 Usando AI Multi-Provider para análise...");
      
      const aiResult = await aiMultiProvider.analyzeDocument(
        extractedText, 
        filename, 
        documentId, 
        tenantId,
        qualityFlags
      );

      console.log(`🤖 IA utilizada: ${aiResult.provider}`);
      console.log(`🎯 Confiança: ${aiResult.confidence}%`);
      console.log(`💰 Custo: $${aiResult.processingCost.toFixed(6)}`);
      console.log(`⏱️ Tempo: ${aiResult.processingTimeMs}ms`);
      
      if (aiResult.fallbackReason) {
        console.log(`🔄 Fallback: ${aiResult.fallbackReason}`);
      }
      
      return {
        success: true,
        extractedData: aiResult.extractedData,
        confidence: aiResult.confidence,
        reasoning: `Analisado com ${aiResult.provider}${aiResult.fallbackReason ? ` (fallback: ${aiResult.fallbackReason})` : ''}`
      };

    } catch (error) {
      console.error(`❌ Erro na análise com IA: ${error}`);
      return {
        success: false,
        confidence: 0,
        error: `Erro na análise: ${error}`
      };
    }
  }

  /**
   * Constrói o prompt otimizado para análise de documentos financeiros
   */
  private buildAnalysisPrompt(text: string, filename: string, context?: string): string {
    return `
Analise o seguinte documento financeiro e extraia as informações em formato JSON.

**CONTEXTO:**
- Nome do arquivo: ${filename}
- Tipo provável: ${this.inferDocumentType(filename, text)}
${context ? `- Contexto adicional: ${context}` : ''}

**TEXTO DO DOCUMENTO:**
${text}

**INSTRUÇÕES IMPORTANTES:**
1. Para NOTAS FISCAIS (DANFE): O EMITENTE (topo do documento) é sempre o FORNECEDOR
2. Para NOTAS FISCAIS: Use CNPJ e Razão Social do EMITENTE, nunca do destinatário
3. Extraia APENAS informações que estão claramente presentes no texto
4. Para valores monetários, use o formato "R$ XX,XX" 
5. Para datas, use o formato "DD/MM/AAAA"
6. Se não encontrar uma informação, deixe o campo vazio ""
7. Para descrição, seja específico e útil (ex: "Corrida Uber do Centro ao Aeroporto")
8. RETORNE APENAS JSON VÁLIDO, sem markdown, sem \`\`\`json, sem explicações extras

**RESPOSTA ESPERADA (APENAS JSON PURO):**
{
  "dados_extraidos": {
    "contraparte": "Nome da empresa/pessoa (ex: Uber, Posto Shell, João Silva)",
    "documento": "CPF ou CNPJ se identificado (apenas números: 12345678901 ou 12345678000123)",
    "tipo_documento_pessoa": "CPF ou CNPJ conforme o documento encontrado",
    "tipo_relacao": "SUPPLIER se estamos pagando para eles, CLIENT se eles estão pagando para nós",
    "descricao": "Descrição específica do serviço/produto",
    "valor": "Valor total pago (formato R$ XX,XX)",
    "data_vencimento": "Data de vencimento se for boleto (DD/MM/AAAA)",
    "data_pagamento": "Data do pagamento se já pago (DD/MM/AAAA)",
    "categoria": "Categoria do gasto (Transporte, Combustível, Alimentação, etc)",
    "centro_custo": "Centro de custo se identificado",
    
    "fornecedor": "Mesmo valor que contraparte (compatibilidade)"
  },
  "confianca": 85,
  "raciocinio": "Explicação breve de como chegou às conclusões, se encontrou CPF/CNPJ, e por que é SUPPLIER ou CLIENT"
}`;
  }

  /**
   * Infere o tipo de documento baseado no filename e conteúdo
   */
  private inferDocumentType(filename: string, text: string): string {
    const lowerFilename = filename.toLowerCase();
    const lowerText = text.toLowerCase();

    if (lowerFilename.includes('uber') || lowerText.includes('uber')) {
      return 'Recibo de transporte Uber';
    }
    if (lowerFilename.includes('nota') || lowerText.includes('nota fiscal') || lowerText.includes('danfe')) {
      return 'Nota fiscal eletrônica - LEMBRE: Emitente é o FORNECEDOR, Destinatário é o CLIENTE';
    }
    if (lowerFilename.includes('boleto') || lowerText.includes('boleto')) {
      return 'Boleto bancário';
    }
    if (lowerFilename.includes('recibo') || lowerText.includes('recibo')) {
      return 'Recibo de pagamento';
    }
    if (lowerText.includes('comprovante')) {
      return 'Comprovante de pagamento';
    }
    
    return 'Documento financeiro';
  }

  /**
   * Valida se os dados extraídos fazem sentido
   */
  validateExtractedData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validar valor monetário
    if (data.valor && !data.valor.match(/R\$\s*\d+[,.]?\d*/)) {
      errors.push('Formato de valor monetário inválido');
    }

    // Validar datas
    if (data.data_pagamento && !data.data_pagamento.match(/\d{2}\/\d{2}\/\d{4}/)) {
      errors.push('Formato de data de pagamento inválido');
    }

    if (data.data_vencimento && !data.data_vencimento.match(/\d{2}\/\d{2}\/\d{4}/)) {
      errors.push('Formato de data de vencimento inválido');
    }

    // Validar campos obrigatórios
    if (!data.fornecedor || data.fornecedor.length < 2) {
      errors.push('Fornecedor não identificado ou muito curto');
    }

    if (!data.descricao || data.descricao.length < 5) {
      errors.push('Descrição não identificada ou muito curta');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}