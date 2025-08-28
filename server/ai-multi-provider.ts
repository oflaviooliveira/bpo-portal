import OpenAI from "openai";
import { storage } from "./storage";
import { aiAnalysisResponseSchema, autoCorrectJsonResponse, normalizeValue, normalizeDate, type AiAnalysisResponse } from "./ai-validation-schema";

// Available models configuration
const AVAILABLE_MODELS = {
  glm: [
    { 
      id: 'glm-4.5', 
      name: 'GLM-4.5', 
      inputCost: 0.0006, // $0.6 per 1M tokens
      outputCost: 0.0022, // $2.2 per 1M tokens
      avgCost: 0.0014 // Average for pricing display
    },
    { 
      id: 'glm-4.5-air', 
      name: 'GLM-4.5-Air', 
      inputCost: 0.0002, // $0.2 per 1M tokens
      outputCost: 0.0011, // $1.1 per 1M tokens
      avgCost: 0.0007 // Average for pricing display
    }
  ],
  openai: [
    { 
      id: 'gpt-4o-mini', 
      name: 'GPT-4o Mini', 
      inputCost: 0.00015, // $0.15 per 1M tokens
      outputCost: 0.0006, // $0.6 per 1M tokens
      avgCost: 0.0004 // Average for pricing display
    },
    { 
      id: 'gpt-4o', 
      name: 'GPT-4o', 
      inputCost: 0.0025, // $2.5 per 1M tokens
      outputCost: 0.01, // $10 per 1M tokens
      avgCost: 0.006 // Average for pricing display
    },
    { 
      id: 'gpt-4-turbo', 
      name: 'GPT-4 Turbo', 
      inputCost: 0.01, // $10 per 1M tokens
      outputCost: 0.03, // $30 per 1M tokens
      avgCost: 0.02 // Average for pricing display
    }
  ]
};

// Multi-provider AI system based on the other portal's documentation
interface AIProvider {
  name: string;
  enabled: boolean;
  priority: number;
  costPer1000: number;
  status: 'online' | 'offline' | 'error';
  model?: string;
  temperature?: number;
  maxTokens?: number;
  last30Days: {
    totalRequests: number;
    totalCost: number;
    totalTokens: number;
    avgResponseTime: number;
    successRate: number;
    failureReasons: Record<string, number>;
  };
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
      costPer1000: 0.0014, // GLM-4.5 average cost
      status: 'online',
      model: 'glm-4.5',
      temperature: 0.1,
      maxTokens: 1500,
      last30Days: {
        totalRequests: 0,
        totalCost: 0,
        totalTokens: 0,
        avgResponseTime: 0,
        successRate: 0,
        failureReasons: {}
      }
    },
    {
      name: 'openai',
      enabled: true, 
      priority: 2,
      costPer1000: 0.0004, // GPT-4o Mini average cost
      status: 'online',
      model: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 1500,
      last30Days: {
        totalRequests: 0,
        totalCost: 0,
        totalTokens: 0,
        avgResponseTime: 0,
        successRate: 0,
        failureReasons: {}
      }
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
          
          // Atualizar estatísticas em tempo real
          provider.last30Days.totalRequests += 1;
          provider.last30Days.totalCost += result.processingCost || 0;
          provider.last30Days.totalTokens += (result.tokensIn || 0) + (result.tokensOut || 0);
          
          // Calculate rolling average response time
          const currentTotal = provider.last30Days.avgResponseTime * (provider.last30Days.totalRequests - 1);
          provider.last30Days.avgResponseTime = (currentTotal + (result.processingTimeMs || 0)) / provider.last30Days.totalRequests;
          
          // Update success rate
          const currentSuccessCount = Math.floor(provider.last30Days.successRate * (provider.last30Days.totalRequests - 1) / 100);
          provider.last30Days.successRate = ((currentSuccessCount + 1) / provider.last30Days.totalRequests) * 100;
          
          console.log(`📊 Stats atualizadas para ${provider.name}: ${provider.last30Days.totalRequests} requests, ${provider.last30Days.successRate.toFixed(1)}% sucesso`);
          
          // Registrar no banco
          await this.logAiRun(documentId, tenantId, result);
          
          return result;
          
        } catch (validationError) {
          console.warn(`❌ Validação falhou para ${provider.name}:`, validationError);
          provider.status = 'error';
          fallbackReason = 'invalid_response_format';
          lastError = validationError;
          continue;
        }
        
      } catch (error: any) {
        console.warn(`⚠️ Falha com ${provider.name}:`, error);
        
        // Reset status for model code errors to allow retry with corrected model
        if (error.message?.includes('Unknown Model')) {
          provider.status = 'online';
        } else {
          provider.status = 'error';
        }
        
        // Determinar o motivo do fallback
        if (error.message?.includes('timeout') || error.code === 'ECONNRESET') {
          fallbackReason = 'timeout';
        } else if (error.message?.includes('JSON')) {
          fallbackReason = 'invalid_json';
        } else if (error.message?.includes('Unknown Model')) {
          fallbackReason = 'invalid_model';
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
          model: this.getProviderByName('glm')?.model || 'glm-4.5',
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
          stream: false
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`GLM API error ${response.status}:`, errorText);
        throw new Error(`GLM API error: ${response.status} - ${errorText}`);
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
        model: this.getProviderByName('openai')?.model || "gpt-4o-mini",
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
    // Extrair dados do nome do arquivo para validação cruzada
    const fileData = this.extractFileMetadata(fileName);
    
    return `
Você é um especialista em análise de documentos fiscais brasileiros com foco em PRECISÃO MÁXIMA.

ARQUIVO: ${fileName}
TEXTO OCR: "${ocrText}"

METADADOS DO ARQUIVO (para validação cruzada):
${JSON.stringify(fileData, null, 2)}

PRIORIDADES DE ANÁLISE:
1. SEMPRE priorize dados claros do nome do arquivo quando o OCR for incompleto
2. Use o texto OCR para extrair detalhes adicionais (fornecedor, descrição)
3. Valide valores monetários: se OCR difere muito do arquivo, use o arquivo
4. Para datas: priorize datas estruturadas do nome do arquivo

REGRAS DE EXTRAÇÃO:
1. VALOR: Use formato "R$ X.XXX,XX" - priorize dados do arquivo se OCR for inconsistente
2. DATAS: Formato "DD/MM/AAAA" - primeira data do arquivo = vencimento/processamento
3. DESCRIÇÃO: Combine dados do arquivo + detalhes do OCR
4. CATEGORIA: Mapeie baseado na descrição identificada
5. CENTRO_CUSTO: Extraia códigos alfanuméricos do arquivo (ex: SRJ1, SP01)

VALIDAÇÃO CRUZADA:
- Se valor no arquivo = R$ 455,79 mas OCR sugere R$ 120,00 → use R$ 455,79
- Se arquivo tem "Locação De Veículos" → categoria = "Transporte"
- Se arquivo tem "PG" → status documento = "PAGO"

RESPOSTA: JSON puro, sem markdown, sem explicações.

TEMPLATE:
{
  "valor": "R$ [valor_do_arquivo_ou_ocr]",
  "data_pagamento": "DD/MM/AAAA",
  "data_vencimento": "DD/MM/AAAA",
  "fornecedor": "[nome_completo_do_fornecedor]",
  "descricao": "[descrição_arquivo + detalhes_ocr]",
  "categoria": "[categoria_mapeada]",
  "centro_custo": "[código_extraído]",
  "documento": "[cnpj/cpf_se_encontrado]",
  "cliente_fornecedor": "[destinatário_se_identificado]",
  "observacoes": "[informações_relevantes]",
  "confidence": [0-100]
}`;
  }

  private extractFileMetadata(fileName: string): any {
    const metadata: any = {};
    
    // Extrair datas
    const dateMatches = fileName.match(/(\d{2})\.(\d{2})\.(\d{4})/g);
    if (dateMatches) {
      metadata.datas = dateMatches.map(date => {
        const [day, month, year] = date.split('.');
        return `${day}/${month}/${year}`;
      });
    }
    
    // Extrair valor
    const valueMatch = fileName.match(/R\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/);
    if (valueMatch) {
      metadata.valor = `R$ ${valueMatch[1]}`;
    }
    
    // Extrair descrição
    const parts = fileName.split('_').filter(part => 
      !part.match(/^\d{2}\.\d{2}\.\d{4}$/) && 
      !part.match(/^R\$/) && 
      !part.includes('.pdf') &&
      part.length > 1
    );
    
    if (parts.length > 0) {
      metadata.descricao = parts.join(' ').replace(/[_\-]/g, ' ');
    }
    
    // Detectar tipo
    if (fileName.includes('PG')) metadata.tipo = 'PAGO';
    if (fileName.includes('AG')) metadata.tipo = 'AGENDADO';
    
    // Extrair centro de custo
    const costCenterMatch = fileName.match(/([A-Z]{2,4}\d*)/i);
    if (costCenterMatch) {
      metadata.centro_custo = costCenterMatch[1].toUpperCase();
    }
    
    return metadata;
  }

  private estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  // Get available models
  getAvailableModels() {
    return AVAILABLE_MODELS;
  }

  // Update provider model and cost
  updateProviderModel(providerName: string, modelId: string): boolean {
    const provider = this.providers.find(p => p.name === providerName);
    if (!provider) return false;

    const availableModels = AVAILABLE_MODELS[providerName as keyof typeof AVAILABLE_MODELS];
    const selectedModel = availableModels?.find(m => m.id === modelId);
    
    if (!selectedModel) return false;

    provider.model = modelId;
    provider.costPer1000 = selectedModel.avgCost;
    
    console.log(`🔄 Modelo ${providerName} atualizado para ${modelId} (custo: $${selectedModel.avgCost}/1k)`);
    return true;
  }

  // Provider control methods
  getProviders(): AIProvider[] {
    return this.providers;
  }

  getProviderByName(name: string): AIProvider | undefined {
    return this.providers.find(p => p.name === name);
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

  updateProviderConfig(providerName: string, config: { 
    priority?: number; 
    costPer1000?: number; 
    model?: string; 
    temperature?: number; 
    maxTokens?: number; 
  }): boolean {
    const provider = this.providers.find(p => p.name === providerName);
    if (provider) {
      if (config.priority !== undefined) provider.priority = config.priority;
      if (config.costPer1000 !== undefined) provider.costPer1000 = config.costPer1000;
      if (config.model !== undefined) provider.model = config.model;
      if (config.temperature !== undefined) provider.temperature = config.temperature;
      if (config.maxTokens !== undefined) provider.maxTokens = config.maxTokens;
      return true;
    }
    return false;
  }

  // Swap priorities between GLM and OpenAI
  swapPriorities(): void {
    const glm = this.providers.find(p => p.name === 'glm');
    const openai = this.providers.find(p => p.name === 'openai');
    
    if (glm && openai) {
      const tempPriority = glm.priority;
      glm.priority = openai.priority;
      openai.priority = tempPriority;
    }
  }

  // Reset provider status to online for retry
  resetProviderStatus(providerName: string): void {
    const provider = this.providers.find(p => p.name === providerName);
    if (provider) {
      provider.status = 'online';
    }
  }

  // Emergency mode: disable GLM, enable OpenAI only
  enableEmergencyMode(): void {
    const glm = this.providers.find(p => p.name === 'glm');
    const openai = this.providers.find(p => p.name === 'openai');
    
    if (glm) {
      glm.enabled = false;
      glm.status = 'offline';
    }
    if (openai) {
      openai.enabled = true;
      openai.status = 'online';
      openai.priority = 1;
    }
  }

  // Disable emergency mode: restore normal priorities
  disableEmergencyMode(): void {
    const glm = this.providers.find(p => p.name === 'glm');
    const openai = this.providers.find(p => p.name === 'openai');
    
    if (glm) {
      glm.enabled = true;
      glm.status = 'online';
      glm.priority = 1;
    }
    if (openai) {
      openai.enabled = true;
      openai.status = 'online';
      openai.priority = 2;
    }
  }

  // Atualizar estatísticas após processamento
  private updateProviderStats(provider: AIProvider, success: boolean, cost: number, responseTime: number, error?: string) {
    const stats = provider.last30Days;
    stats.totalRequests++;
    stats.totalCost += cost;
    stats.totalTokens += Math.ceil(responseTime / 100); // Aproximação
    
    if (stats.totalRequests === 1) {
      stats.avgResponseTime = responseTime;
    } else {
      stats.avgResponseTime = (stats.avgResponseTime * (stats.totalRequests - 1) + responseTime) / stats.totalRequests;
    }
    
    if (success) {
      const successCount = Math.round((stats.successRate * (stats.totalRequests - 1)) / 100);
      stats.successRate = ((successCount + 1) / stats.totalRequests) * 100;
    } else {
      const successCount = Math.round((stats.successRate * (stats.totalRequests - 1)) / 100);
      stats.successRate = (successCount / stats.totalRequests) * 100;
      if (error) {
        const errorKey = error.length > 50 ? error.substring(0, 50) + '...' : error;
        stats.failureReasons[errorKey] = (stats.failureReasons[errorKey] || 0) + 1;
      }
    }
  }

  getProviderMetrics(): Record<string, any> {
    return this.providers.reduce((acc, provider) => {
      acc[provider.name] = {
        enabled: provider.enabled,
        status: provider.status,
        priority: provider.priority,
        costPer1000: provider.costPer1000,
        performance: provider.last30Days
      };
      return acc;
    }, {} as Record<string, any>);
  }

  // Métrica avançada: comparação de providers
  getProviderComparison() {
    const glm = this.providers.find(p => p.name === 'glm');
    const openai = this.providers.find(p => p.name === 'openai');
    
    return {
      glm: glm ? {
        name: 'GLM',
        requests: glm.last30Days.totalRequests,
        successRate: glm.last30Days.successRate,
        avgCost: glm.last30Days.totalCost / Math.max(glm.last30Days.totalRequests, 1),
        avgTime: glm.last30Days.avgResponseTime,
        status: glm.status
      } : null,
      openai: openai ? {
        name: 'OpenAI', 
        requests: openai.last30Days.totalRequests,
        successRate: openai.last30Days.successRate,
        avgCost: openai.last30Days.totalCost / Math.max(openai.last30Days.totalRequests, 1),
        avgTime: openai.last30Days.avgResponseTime,
        status: openai.status
      } : null,
      recommendations: this.generateRecommendations()
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const glm = this.providers.find(p => p.name === 'glm');
    const openai = this.providers.find(p => p.name === 'openai');
    
    if (glm && openai && glm.last30Days.totalRequests > 0 && openai.last30Days.totalRequests > 0) {
      if (glm.last30Days.successRate < 70) {
        recommendations.push('GLM com baixa taxa de sucesso - revisar configuração');
      }
      if (openai.last30Days.avgResponseTime > 10000) {
        recommendations.push('OpenAI com tempo de resposta alto - considerar upgrade');
      }
      if (glm.last30Days.totalCost < openai.last30Days.totalCost / 10) {
        recommendations.push('GLM é 10x mais barato - priorizar uso');
      }
    }
    
    return recommendations;
  }
}

export const aiMultiProvider = new AIMultiProvider();
export type { AIAnalysisResult, AIProvider };