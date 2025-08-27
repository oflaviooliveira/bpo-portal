import OpenAI from "openai";
import { storage } from "./storage";
import { aiAnalysisResponseSchema, autoCorrectJsonResponse, normalizeValue, normalizeDate, type AiAnalysisResponse } from "./ai-validation-schema";

// Multi-provider AI system based on the other portal's documentation
interface AIProvider {
  name: string;
  enabled: boolean;
  priority: number;
  costPer1000: number;
  status: 'online' | 'offline' | 'error';
}

interface AIAnalysisResult {
  provider: string;
  extractedData: AiAnalysisResponse;
  rawResponse: string;
  confidence: number;
  processingCost: number;
  tokensIn: number;
  tokensOut: number;
  processingTimeMs: number;
  fallbackReason?: string;
}

class AIMultiProvider {
  private providers: AIProvider[] = [
    {
      name: 'glm',
      enabled: true,
      priority: 1,
      costPer1000: 0.0002,
      status: 'online'
    },
    {
      name: 'openai',
      enabled: true, 
      priority: 2,
      costPer1000: 0.03,
      status: 'online'
    }
  ];

  private openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || ""
  });

  async analyzeDocument(ocrText: string, fileName: string, documentId: string, tenantId: string): Promise<AIAnalysisResult> {
    const enabledProviders = this.providers
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    let lastError: any = null;
    let fallbackReason: string | undefined = undefined;
    
    for (let i = 0; i < enabledProviders.length; i++) {
      const provider = enabledProviders[i];
      const isSecondaryProvider = i > 0;
      
      try {
        console.log(`🤖 Tentando análise com ${provider.name}${isSecondaryProvider ? ' (fallback)' : ''}...`);
        
        let result: AIAnalysisResult;
        const startTime = Date.now();
        
        if (provider.name === 'glm') {
          result = await this.analyzeWithGLM(ocrText, fileName);
        } else if (provider.name === 'openai') {
          result = await this.analyzeWithOpenAI(ocrText, fileName);
        } else {
          throw new Error(`Provider desconhecido: ${provider.name}`);
        }
        
        result.processingTimeMs = Date.now() - startTime;
        if (isSecondaryProvider) {
          result.fallbackReason = fallbackReason;
        }
        
        // Validar a resposta com o schema stricto
        try {
          const validatedData = aiAnalysisResponseSchema.parse(result.extractedData);
          result.extractedData = validatedData;
          
          // Normalizar valores
          result.extractedData.valor = normalizeValue(result.extractedData.valor);
          if (result.extractedData.data_pagamento) {
            result.extractedData.data_pagamento = normalizeDate(result.extractedData.data_pagamento);
          }
          if (result.extractedData.data_vencimento) {
            result.extractedData.data_vencimento = normalizeDate(result.extractedData.data_vencimento);
          }
          
          provider.status = 'online';
          
          // Registrar no banco
          await this.logAiRun(documentId, tenantId, result);
          
          return result;
          
        } catch (validationError) {
          console.warn(`❌ Validação falhou para ${provider.name}:`, validationError);
          fallbackReason = 'invalid_response_format';
          lastError = validationError;
          continue;
        }
        
      } catch (error: any) {
        console.warn(`⚠️ Falha com ${provider.name}:`, error);
        provider.status = 'error';
        
        // Determinar o motivo do fallback
        if (error.message?.includes('timeout') || error.code === 'ECONNRESET') {
          fallbackReason = 'timeout';
        } else if (error.message?.includes('JSON')) {
          fallbackReason = 'invalid_json';
        } else {
          fallbackReason = 'provider_error';
        }
        
        lastError = error;
        continue;
      }
    }

    throw new Error(`Todos os provedores de IA falharam. Último erro: ${lastError?.message || 'Erro desconhecido'}`);
  }

  private async logAiRun(documentId: string, tenantId: string, result: AIAnalysisResult): Promise<void> {
    try {
      await storage.createAiRun({
        documentId,
        tenantId,
        providerUsed: result.provider,
        fallbackReason: result.fallbackReason || null,
        ocrStrategy: 'pdf', // Será parametrizado depois
        processingTimeMs: result.processingTimeMs,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costUsd: result.processingCost.toString(),
        confidence: result.confidence,
      });
    } catch (error) {
      console.error('Erro ao registrar AI run:', error);
    }
  }

  async analyzeWithGLM(ocrText: string, fileName: string): Promise<AIAnalysisResult> {
    const apiKey = process.env.GLM_API_KEY;
    if (!apiKey) {
      throw new Error('GLM API key not configured');
    }

    const prompt = this.buildAnalysisPrompt(ocrText, fileName);
    
    try {
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'glm-4-plus',
          messages: [
            {
              role: 'system',
              content: 'Você é um especialista em análise de documentos financeiros brasileiros. Responda sempre em JSON válido.'
            },
            {
              role: 'user', 
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        throw new Error(`GLM API error: ${response.status}`);
      }

      const data = await response.json();
      let aiResponse = data.choices[0].message.content;
      
      console.log("🤖 GLM Response:", aiResponse);

      // Clean markdown formatting from GLM response
      if (aiResponse.includes('```json')) {
        aiResponse = aiResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
      }
      if (aiResponse.includes('```')) {
        aiResponse = aiResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
      }
      
      const extractedData = JSON.parse(aiResponse.trim());
      const tokenCount = this.estimateTokenCount(prompt + aiResponse);
      
      return {
        provider: 'glm-4-plus',
        extractedData,
        rawResponse: aiResponse,
        confidence: extractedData.confidence || 85,
        processingCost: (tokenCount / 1000) * 0.0002,
        tokensIn: Math.floor(tokenCount * 0.7),
        tokensOut: Math.floor(tokenCount * 0.3),
        processingTimeMs: 0,
      };
    } catch (error) {
      console.error('GLM analysis error:', error);
      throw error;
    }
  }

  async analyzeWithOpenAI(ocrText: string, fileName: string): Promise<AIAnalysisResult> {
    const prompt = this.buildAnalysisPrompt(ocrText, fileName);
    
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Você é um especialista em análise de documentos financeiros brasileiros. Responda sempre em JSON válido."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1000,
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      console.log("🤖 OpenAI Response:", content);

      const extractedData = JSON.parse(content);
      const tokenCount = response.usage?.total_tokens || this.estimateTokenCount(prompt + content);
      
      return {
        provider: 'openai-gpt4o-mini',
        extractedData,
        rawResponse: content,
        confidence: extractedData.confidence || 80,
        processingCost: (tokenCount / 1000) * 0.03,
        tokensIn: response.usage?.prompt_tokens || Math.floor(tokenCount * 0.7),
        tokensOut: response.usage?.completion_tokens || Math.floor(tokenCount * 0.3),
        processingTimeMs: 0,
      };
    } catch (error) {
      console.error('OpenAI analysis error:', error);
      throw error;
    }
  }

  private buildAnalysisPrompt(ocrText: string, fileName: string): string {
    return `
Você é um especialista em análise de documentos fiscais brasileiros (notas fiscais, recibos, boletos).

DOCUMENTO PARA ANÁLISE:
Nome do arquivo: ${fileName}
Texto OCR: "${ocrText}"

INSTRUÇÕES CRÍTICAS:
1. Analise CUIDADOSAMENTE o texto OCR buscando:
   - VALORES MONETÁRIOS: procure por "R$", valores com vírgulas/pontos (ex: 1.450,00)
   - DATAS: formatos DD/MM/AAAA ou DD/MM/AA 
   - EMPRESAS: nomes em maiúsculas, CNPJs
   - PRODUTOS/SERVIÇOS: descrições detalhadas

2. Para NOTAS FISCAIS, identifique:
   - Emissor (quem vendeu)
   - Destinatário (quem comprou) 
   - Valor total da nota
   - Data de emissão

3. Use o NOME DO ARQUIVO como validação cruzada dos dados extraídos.

4. ATENÇÃO: Se encontrar múltiplos valores, use o VALOR TOTAL DA NOTA/DOCUMENTO.

5. Responda SOMENTE em JSON válido, sem markdown ou explicações.

EXEMPLO para Nota Fiscal:
Se o texto contém "ROBSON PNEUS" como emissor, "1.450,00" como valor, "19/07/2025" como data:
{
  "valor": "R$ 1.450,00",
  "data_pagamento": "19/07/2025",
  "data_vencimento": "não_identificado",
  "fornecedor": "ROBSON PNEUS E AUTOPECAS LTDA",
  "descricao": "COMPRA DE 2 PNEUS",
  "categoria": "Manutenção de Veículos", 
  "centro_custo": "SRJ1",
  "documento": "58.950.018/0001-34",
  "cliente_fornecedor": "ECO EXPRESS SERVICOS SUSTENTAVEIS LTDA",
  "observacoes": "Nota Fiscal Eletrônica - 2 pneus WANLI 225/75R16LT",
  "confidence": 95
}`;
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  // Provider control methods
  getProviders(): AIProvider[] {
    return this.providers;
  }

  toggleProvider(providerName: string): boolean {
    const provider = this.providers.find(p => p.name === providerName);
    if (provider) {
      provider.enabled = !provider.enabled;
      return provider.enabled;
    }
    return false;
  }

  updateProviderStatus(providerName: string, status: 'online' | 'offline' | 'error'): void {
    const provider = this.providers.find(p => p.name === providerName);
    if (provider) {
      provider.status = status;
    }
  }
}

export const aiMultiProvider = new AIMultiProvider();
export type { AIAnalysisResult, AIProvider };