import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || ""
});

export interface DocumentAnalysisResult {
  success: boolean;
  extractedData?: {
    fornecedor?: string;
    descricao?: string;
    valor?: string;
    data_vencimento?: string;
    data_pagamento?: string;
    categoria?: string;
    centro_custo?: string;
    tipo_documento?: 'PAGO' | 'AGENDADO' | 'EMITIR_BOLETO' | 'EMITIR_NF';
  };
  confidence: number;
  reasoning?: string;
  error?: string;
}

export class DocumentAnalyzer {
  
  /**
   * Analisa texto extraído de documento financeiro
   */
  async analyzeDocument(
    extractedText: string, 
    filename: string, 
    documentContext?: string
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
      const prompt = this.buildAnalysisPrompt(extractedText, filename, documentContext);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Você é um especialista em análise de documentos financeiros brasileiros. 
            Sua tarefa é extrair informações estruturadas de recibos, notas fiscais, boletos e comprovantes de pagamento.
            
            CRÍTICO: Sempre responda APENAS com JSON válido, sem markdown, sem explicações.
            Não use \`\`\`json ou qualquer formatação markdown na resposta.
            Seja preciso e extraia apenas informações claramente presentes no documento.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1500
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        throw new Error('Resposta vazia da IA');
      }

      console.log(`🤖 Resposta da IA: ${responseText}`);

      // Limpar resposta removendo markdown se presente
      const cleanedResponse = responseText
        .replace(/```json\s*/g, '')
        .replace(/\s*```/g, '')
        .trim();

      console.log(`🧹 Resposta limpa: ${cleanedResponse}`);

      // Parse da resposta JSON
      const result = JSON.parse(cleanedResponse);
      
      return {
        success: true,
        extractedData: result.dados_extraidos,
        confidence: result.confianca || 0,
        reasoning: result.raciocinio
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
1. Extraia APENAS informações que estão claramente presentes no texto
2. Para valores monetários, use o formato "R$ XX,XX" 
3. Para datas, use o formato "DD/MM/AAAA"
4. Se não encontrar uma informação, deixe o campo vazio ""
5. Para descrição, seja específico e útil (ex: "Corrida Uber do Centro ao Aeroporto")
6. RETORNE APENAS JSON VÁLIDO, sem markdown, sem \`\`\`json, sem explicações extras

**RESPOSTA ESPERADA (APENAS JSON PURO):**
{
  "dados_extraidos": {
    "fornecedor": "Nome da empresa/prestador (ex: Uber, Posto Shell)",
    "descricao": "Descrição específica do serviço/produto",
    "valor": "Valor total pago (formato R$ XX,XX)",
    "data_vencimento": "Data de vencimento se for boleto (DD/MM/AAAA)",
    "data_pagamento": "Data do pagamento se já pago (DD/MM/AAAA)",
    "categoria": "Categoria do gasto (Transporte, Combustível, Alimentação, etc)",
    "centro_custo": "Centro de custo se identificado",
    "tipo_documento": "PAGO se já foi pago, AGENDADO se for para pagamento futuro, EMITIR_BOLETO ou EMITIR_NF se for emissão"
  },
  "confianca": 85,
  "raciocinio": "Explicação breve de como chegou às conclusões"
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
    if (lowerFilename.includes('nota') || lowerText.includes('nota fiscal')) {
      return 'Nota fiscal';
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