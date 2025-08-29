import OpenAI from "openai";
import { storage } from "./storage";
import { aiAnalysisResponseSchema, autoCorrectJsonResponse, normalizeValue, normalizeDate, type AiAnalysisResponse } from "./ai-validation-schema";

// Available models configuration
const AVAILABLE_MODELS = {
  glm: [
    { 
      id: 'glm-4.5', 
      name: 'GLM-4.5', 
      inputCost: 0.6, // $0.6 per 1M tokens
      outputCost: 2.2, // $2.2 per 1M tokens
      avgCost: 1.4 // Average for pricing display
    },
    { 
      id: 'glm-4.5-air', 
      name: 'GLM-4.5-Air', 
      inputCost: 0.2, // $0.2 per 1M tokens
      outputCost: 1.1, // $1.1 per 1M tokens
      avgCost: 0.65 // Average for pricing display
    },
    { 
      id: 'glm-4.5-x', 
      name: 'GLM-4.5-X', 
      inputCost: 2.2, // $2.2 per 1M tokens
      outputCost: 8.9, // $8.9 per 1M tokens
      avgCost: 5.55 // Average for pricing display
    },
    { 
      id: 'glm-4.5-flash', 
      name: 'GLM-4.5-Flash', 
      inputCost: 0, // Free
      outputCost: 0, // Free
      avgCost: 0 // Free
    }
  ],
  openai: [
    { 
      id: 'gpt-4o-mini', 
      name: 'GPT-4o Mini', 
      inputCost: 0.15, // $0.15 per 1M tokens (Standard)
      outputCost: 0.60, // $0.60 per 1M tokens (Standard)
      avgCost: 0.375 // Average for pricing display
    },
    { 
      id: 'gpt-4o', 
      name: 'GPT-4o', 
      inputCost: 2.50, // $2.50 per 1M tokens (Standard)
      outputCost: 10.00, // $10.00 per 1M tokens (Standard)
      avgCost: 6.25 // Average for pricing display
    },
    { 
      id: 'gpt-4-turbo', 
      name: 'GPT-4 Turbo', 
      inputCost: 10.00, // $10.00 per 1M tokens (Standard)
      outputCost: 30.00, // $30.00 per 1M tokens (Standard)
      avgCost: 20.00 // Average for pricing display
    },
    { 
      id: 'gpt-5', 
      name: 'GPT-5', 
      inputCost: 1.25, // $1.25 per 1M tokens (Standard)
      outputCost: 10.00, // $10.00 per 1M tokens (Standard)
      avgCost: 5.625 // Average for pricing display
    },
    { 
      id: 'gpt-5-mini', 
      name: 'GPT-5 Mini', 
      inputCost: 0.25, // $0.25 per 1M tokens (Standard)
      outputCost: 2.00, // $2.00 per 1M tokens (Standard)
      avgCost: 1.125 // Average for pricing display
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
      costPer1000: 1.4, // GLM-4.5: $1.4 avg per 1M tokens
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
      costPer1000: 0.375, // GPT-4o Mini: $0.375 avg per 1k tokens
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
    let enabledProviders = this.providers
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority);

    // ESTRATÉGIA 4: Seleção inteligente de provider
    const shouldTryGLMFirst = this.shouldUseGLMForContent(ocrText, fileName);
    if (!shouldTryGLMFirst) {
      console.log(`📋 Documento complexo detectado - priorizando OpenAI`);
      // Temporariamente inverter prioridades para documentos complexos
      const glmProvider = enabledProviders.find(p => p.name === 'glm');
      const openaiProvider = enabledProviders.find(p => p.name === 'openai');
      if (glmProvider && openaiProvider) {
        enabledProviders.splice(enabledProviders.indexOf(glmProvider), 1);
        enabledProviders.push(glmProvider); // GLM por último para docs complexos
      }
    }

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
          // ESTRATÉGIA 3: Usar retry inteligente para GLM
          result = await this.analyzeWithGLMRetry(ocrText, fileName);
        } else if (provider.name === 'openai') {
          result = await this.analyzeWithOpenAI(ocrText, fileName);
        } else {
          throw new Error(`Provider desconhecido: ${provider.name}`);
        }
        
        result.processingTimeMs = Date.now() - startTime;
        if (isSecondaryProvider) {
          result.fallbackReason = fallbackReason;
        }
        
        // Validar a resposta com schema flexível - correção da over-validation
        try {
          // Primeira tentativa: validação padrão
          const validatedData = aiAnalysisResponseSchema.parse(result.extractedData);
          result.extractedData = validatedData;
        } catch (validationError) {
          console.warn(`⚠️ Schema validation strict failed for ${provider.name}, trying flexible validation...`);
          
          // Segunda tentativa: auto-correção de problemas comuns do GLM
          try {
            const correctedData = this.autoCorrectGlmResponse(result.extractedData);
            const validatedData = aiAnalysisResponseSchema.parse(correctedData);
            result.extractedData = validatedData;
            console.log(`✅ Provider ${provider.name} response auto-corrected successfully`);
          } catch (secondValidationError) {
            console.error(`❌ Both validation attempts failed for ${provider.name}:`, secondValidationError);
            
            // Categorizar erro: se é um problema de formato vs problema de dados
            const isFormatError = this.isFormatError(validationError);
            
            if (isFormatError) {
              // Erro de formato: marcar como temporário, permitir auto-recovery
              provider.status = 'online'; // Manter online para permitir retry
              console.log(`⚠️ Provider ${provider.name} kept ONLINE (format error, recoverable)`);
              
              fallbackReason = 'format_error_recoverable';
              lastError = validationError;
              continue;
            } else {
              // Erro de dados: marcar como erro real
              provider.status = 'error';
              console.log(`🚨 Provider ${provider.name} marked as ERROR (data validation failed)`);
              
              // Atualizar estatísticas de falha
              provider.last30Days.totalRequests += 1;
              const currentSuccessCount = Math.floor(provider.last30Days.successRate * (provider.last30Days.totalRequests - 1) / 100);
              provider.last30Days.successRate = (currentSuccessCount / provider.last30Days.totalRequests) * 100;
              
              fallbackReason = 'invalid_response_format';
              lastError = validationError;
              continue;
            }
          }
        }
        
        // Normalizar valores
        result.extractedData.valor = normalizeValue(result.extractedData.valor);
        if (result.extractedData.data_pagamento) {
          result.extractedData.data_pagamento = normalizeDate(result.extractedData.data_pagamento);
        }
        if (result.extractedData.data_vencimento) {
          result.extractedData.data_vencimento = normalizeDate(result.extractedData.data_vencimento);
        }
        
        // Marcar provider como online após sucesso completo
        provider.status = 'online';
        console.log(`✅ Provider ${provider.name} marked as ONLINE after successful analysis`);
        
        // Reset GLM timeout attempts on success
        if (provider.name === 'glm') {
          this.glmTimeoutAttempts = 0;
        }
        
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
        
      } catch (error: any) {
        console.warn(`⚠️ Provider ${provider.name} failed:`, error.message);
        
        // Atualizar estatísticas de falha
        provider.last30Days.totalRequests += 1;
        const currentSuccessCount = Math.floor(provider.last30Days.successRate * (provider.last30Days.totalRequests - 1) / 100);
        provider.last30Days.successRate = (currentSuccessCount / provider.last30Days.totalRequests) * 100;
        
        // Categorização inteligente de erros aprimorada
        const errorCategory = this.categorizeError(error);
        
        if (errorCategory.isRecoverable) {
          provider.status = 'online'; // Manter online para erros recuperáveis
          console.log(`⚠️ Provider ${provider.name} kept ONLINE (${errorCategory.type}, recoverable)`);
          
          // Programar auto-recovery se necessário
          if (errorCategory.needsRetry) {
            this.scheduleProviderRetry(provider.name, 30000); // 30s retry
          }
        } else {
          provider.status = 'error';
          console.log(`🚨 Provider ${provider.name} marked as ERROR (${errorCategory.type}, not recoverable)`);
        }
        
        // Log específico para debugging
        if (provider.name === 'glm') {
          console.log(`🔍 GLM Error Details - Type: ${errorCategory.type}, Recoverable: ${errorCategory.isRecoverable}, Message: ${error.message}`);
        }
        
        // Determinar o motivo do fallback baseado na categoria
        fallbackReason = errorCategory.fallbackReason;
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

    // ESTRATÉGIA 2: Prompt adaptado para GLM
    const prompt = this.shouldUseSimplifiedPrompt(ocrText) 
      ? this.createSimplifiedGLMPrompt(ocrText, fileName)
      : this.buildAnalysisPrompt(ocrText, fileName);
    
    try {
      console.log(`🔗 GLM API Request - Model: ${this.getProviderByName('glm')?.model || 'glm-4.5'}`);
      console.log(`📝 GLM Full prompt length: ${prompt.length} chars`);
      console.log(`📝 GLM Prompt preview: ${prompt.substring(0, 300)}...`);
      console.log(`📝 GLM Request payload size: ${JSON.stringify({ prompt: prompt.substring(0, 200) + '...' }).length} chars`);
      
      // ESTRATÉGIA 1: Timeout progressivo (15s → 30s → 45s)
      const timeoutDuration = this.getGLMTimeoutDuration();
      console.log(`⏰ Starting GLM request with ${timeoutDuration/1000}s timeout...`);
      const startTime = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`🕐 GLM timeout triggered after ${timeoutDuration/1000}s`);
        controller.abort();
      }, timeoutDuration);
      
      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: this.getProviderByName('glm')?.model || 'glm-4.5',
          messages: [
            {
              role: 'system',
              content: 'Você é um especialista em análise de documentos financeiros brasileiros. Responda sempre em JSON válido, sem markdown, sem explicações adicionais.'
            },
            {
              role: 'user', 
              content: this.adaptPromptForGLM(prompt, ocrText, fileName)
            }
          ],
          temperature: 0.1,
          max_tokens: 3000, // ESTRATÉGIA 2: Mais tokens
          stream: false,
          top_p: 0.8, // ESTRATÉGIA 3: Parâmetros ajustados
          presence_penalty: 0.1,
          frequency_penalty: 0.1
        }),
      });
      
      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;
      
      console.log(`🔍 GLM Response status: ${response.status} (${responseTime}ms)`);
      console.log(`📊 GLM Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`🚨 GLM API error ${response.status}:`, errorText);
        
        // Categorizar erro HTTP para melhor tratamento
        if (response.status === 429) {
          throw new Error(`GLM rate limit exceeded: ${errorText}`);
        } else if (response.status >= 500) {
          throw new Error(`GLM server error: ${response.status} - ${errorText}`);
        } else if (response.status === 401) {
          throw new Error(`GLM authentication error: Invalid API key`);
        } else {
          throw new Error(`GLM API error: ${response.status} - ${errorText}`);
        }
      }

      const data = await response.json();
      console.log(`📦 GLM Raw response structure:`, Object.keys(data));
      
      // Validar estrutura da resposta GLM
      if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error(`🚨 GLM Invalid response structure:`, JSON.stringify(data, null, 2));
        throw new Error(`GLM invalid response: missing choices array`);
      }
      
      if (!data.choices[0].message || !data.choices[0].message.content) {
        console.error(`🚨 GLM Invalid message structure:`, JSON.stringify(data.choices[0], null, 2));
        throw new Error(`GLM invalid response: missing message content`);
      }
      
      let aiResponse = data.choices[0].message.content;
      console.log("🤖 GLM Response:", aiResponse);
      console.log(`📏 GLM Response length: ${aiResponse ? aiResponse.length : 0} chars`);
      
      // Validar se resposta não está vazia
      if (!aiResponse || aiResponse.trim().length === 0) {
        console.error(`🚨 GLM returned empty response`);
        throw new Error(`GLM returned empty response`);
      }

      // Clean markdown formatting from GLM response - melhorado
      aiResponse = this.cleanMarkdownFromResponse(aiResponse);
      
      let extractedData;
      try {
        extractedData = JSON.parse(aiResponse.trim());
      } catch (jsonError: any) {
        console.error(`❌ GLM JSON parse error:`, jsonError.message);
        console.error(`📝 Response to parse:`, JSON.stringify(aiResponse.trim()));
        throw new Error(`GLM returned invalid JSON: ${jsonError.message}`);
      }
      
      const tokenCount = this.estimateTokenCount(prompt + aiResponse);
      
      return {
        provider: 'glm',
        extractedData,
        rawResponse: aiResponse,
        confidence: extractedData.confidence || 85,
        processingCost: (tokenCount / 1000) * 1.4, // GLM custo: $1.4 avg per 1M tokens
        tokensIn: Math.floor(tokenCount * 0.7),
        tokensOut: Math.floor(tokenCount * 0.3),
        processingTimeMs: 0,
      };
    } catch (error: any) {
      // Logging detalhado para debugging
      if (error.name === 'AbortError') {
        console.error('🕐 GLM request timeout after 15s');
        throw new Error('GLM timeout: Request took too long');
      } else if (error.message?.includes('fetch')) {
        console.error('🌐 GLM network error:', error.message);
        throw new Error(`GLM network error: ${error.message}`);
      } else {
        console.error('🚨 GLM analysis error:', error.message);
        console.error('📍 GLM error stack:', error.stack);
        throw error;
      }
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

      let extractedData;
      try {
        extractedData = JSON.parse(content);
      } catch (jsonError: any) {
        console.error(`❌ OpenAI JSON parse error:`, jsonError.message);
        console.error(`📝 Response to parse:`, JSON.stringify(content));
        throw new Error(`OpenAI returned invalid JSON: ${jsonError.message}`);
      }
      
      const tokenCount = response.usage?.total_tokens || this.estimateTokenCount(prompt + content);
      
      return {
        provider: 'openai',
        extractedData,
        rawResponse: content,
        confidence: extractedData.confidence || 80,
        processingCost: (tokenCount / 1000) * 0.375, // OpenAI custo: $0.375 avg per 1k tokens
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
Analise este documento fiscal brasileiro e extraia os dados em formato JSON.

DOCUMENTO: ${fileName}
TEXTO OCR: "${ocrText.substring(0, 1500)}${ocrText.length > 1500 ? '...' : ''}"

DADOS DO ARQUIVO: ${JSON.stringify(fileData, null, 2)}

INSTRUÇÕES:
- Extraia valor, fornecedor, datas, CNPJ, descrição
- Use dados do arquivo para validar informações
- Responda APENAS com JSON, sem explicações
- Formato de data: DD/MM/AAAA
- Formato de valor: R$ 0.000,00

RESPOSTA JSON:
{
  "valor": "R$ 0,00",
  "data_pagamento": "DD/MM/AAAA",
  "data_vencimento": "DD/MM/AAAA", 
  "fornecedor": "Nome do Fornecedor",
  "descricao": "Descrição do produto/serviço",
  "categoria": "Categoria",
  "centro_custo": "Código",
  "documento": "CNPJ ou CPF",
  "cliente_fornecedor": "Nome do cliente",
  "observacoes": "Informações adicionais",
  "confidence": 95
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

  // ESTRATÉGIA 1: Timeout progressivo baseado em tentativas
  private glmTimeoutAttempts = 0;
  private getGLMTimeoutDuration(): number {
    const timeouts = [15000, 30000, 45000]; // 15s, 30s, 45s
    const timeout = timeouts[Math.min(this.glmTimeoutAttempts, timeouts.length - 1)];
    this.glmTimeoutAttempts++;
    
    // Reset após sucesso ou 3 falhas
    if (this.glmTimeoutAttempts >= 3) {
      this.glmTimeoutAttempts = 0;
    }
    
    return timeout;
  }

  // ESTRATÉGIA 2: Prompt adaptado especificamente para GLM
  private adaptPromptForGLM(originalPrompt: string, ocrText: string, fileName: string): string {
    // Se o prompt for muito complexo, usar versão simplificada para GLM
    if (originalPrompt.length > 1000) {
      const fileData = this.extractFileMetadata(fileName);
      
      return `Extraia dados deste documento brasileiro em JSON:

ARQUIVO: ${fileName}
TEXTO: ${ocrText.substring(0, 800)}
METADADOS: ${JSON.stringify(fileData)}

Retorne JSON com: valor, fornecedor, data_pagamento, data_vencimento, descricao, categoria, centro_custo, documento, confidence

Exemplo: {"valor": "R$ 100,00", "fornecedor": "Empresa", "data_pagamento": "01/01/2025", "confidence": 90}`;
    }
    
    return originalPrompt;
  }

  // ESTRATÉGIA 3: Retry inteligente com backoff
  private async analyzeWithGLMRetry(ocrText: string, fileName: string, attempt = 1): Promise<AIAnalysisResult> {
    try {
      return await this.analyzeWithGLM(ocrText, fileName);
    } catch (error: any) {
      if (attempt < 3 && (error.message?.includes('timeout') || error.message?.includes('network'))) {
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`🔄 GLM retry attempt ${attempt + 1} in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.analyzeWithGLMRetry(ocrText, fileName, attempt + 1);
      }
      throw error;
    }
  }

  // ESTRATÉGIA 4: Fallback inteligente baseado em conteúdo
  private shouldUseGLMForContent(ocrText: string, fileName: string): boolean {
    // GLM funciona melhor com documentos mais simples
    const isSimpleDocument = ocrText.length < 1000 && fileName.includes('PG');
    const hasComplexTables = ocrText.includes('DANFE') || ocrText.includes('Tabela');
    
    return isSimpleDocument && !hasComplexTables;
  }

  // ESTRATÉGIA 2: Verificar se deve usar prompt simplificado para GLM
  private shouldUseSimplifiedPrompt(ocrText: string): boolean {
    return ocrText.length > 1000 || ocrText.includes('DANFE') || ocrText.includes('Tabela');
  }

  // ESTRATÉGIA 2: Prompt simplificado específico para GLM
  private createSimplifiedGLMPrompt(ocrText: string, fileName: string): string {
    // Truncar texto OCR para 800 chars max para GLM
    const truncatedText = ocrText.substring(0, 800);
    
    return `Extrair dados deste documento brasileiro em JSON:

ARQUIVO: ${fileName}
TEXTO: "${truncatedText}${ocrText.length > 800 ? '...' : ''}"

JSON obrigatório:
{
  "valor": "R$ 0,00",
  "fornecedor": "Nome",  
  "data_pagamento": "DD/MM/AAAA",
  "data_vencimento": "DD/MM/AAAA",
  "descricao": "Texto",
  "categoria": "Tipo",
  "centro_custo": "OK",
  "documento": "CNPJ/CPF",
  "confidence": 85
}

Resposta apenas JSON, sem texto extra.`;
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

  // Auto-correção específica para respostas do GLM
  private autoCorrectGlmResponse(data: any): any {
    const corrected = { ...data };
    
    // Corrigir campos nulos para undefined (GLM às vezes retorna null)
    Object.keys(corrected).forEach(key => {
      if (corrected[key] === null || corrected[key] === "null") {
        delete corrected[key];
      }
    });
    
    // CORREÇÃO CRÍTICA: Tratar strings vazias em campos de data como null
    if (corrected.data_vencimento === "" || corrected.data_vencimento === "null" || corrected.data_vencimento === null) {
      delete corrected.data_vencimento; // Remove campo vazio para passar validação
    }
    
    if (corrected.data_pagamento === "" || corrected.data_pagamento === "null" || corrected.data_pagamento === null) {
      delete corrected.data_pagamento; // Remove campo vazio para passar validação
    }
    
    // Garantir que confidence é número
    if (typeof corrected.confidence === 'string') {
      corrected.confidence = parseInt(corrected.confidence) || 85;
    }
    if (!corrected.confidence) {
      corrected.confidence = 85;
    }
    
    // Corrigir formato de valor se necessário
    if (corrected.valor && !corrected.valor.startsWith('R$')) {
      corrected.valor = `R$ ${corrected.valor}`;
    }
    
    // Normalizar campos obrigatórios se estão vazios
    if (!corrected.fornecedor || corrected.fornecedor === "") {
      corrected.fornecedor = "Não identificado";
    }
    if (!corrected.descricao || corrected.descricao === "") {
      corrected.descricao = "Descrição não identificada";
    }
    if (!corrected.categoria || corrected.categoria === "") {
      corrected.categoria = "Outros";
    }
    if (!corrected.centro_custo || corrected.centro_custo === "") {
      corrected.centro_custo = "GERAL";
    }
    
    console.log(`🔧 GLM response auto-corrected:`, corrected);
    return corrected;
  }
  
  // Verificar se é um erro de formato vs erro de dados
  private isFormatError(error: any): boolean {
    const errorMessage = error?.message || error?.toString() || "";
    
    // Erros de formato que podem ser recuperáveis
    const formatErrorPatterns = [
      /invalid_type/i,
      /expected.*received/i,
      /formato.*inválido/i,
      /must be/i,
      /should be/i
    ];
    
    return formatErrorPatterns.some(pattern => pattern.test(errorMessage));
  }
  
  // Categorização inteligente de erros
  private categorizeError(error: any): {
    type: string;
    isRecoverable: boolean;
    needsRetry: boolean;
    fallbackReason: string;
  } {
    const errorMessage = error?.message || error?.toString() || "";
    const errorCode = error?.code || "";
    
    // Erros de conectividade - temporários e recuperáveis
    if (errorCode === 'ECONNRESET' || errorCode === 'ETIMEOUT' || 
        errorMessage.includes('timeout') || errorMessage.includes('network')) {
      return {
        type: 'connectivity',
        isRecoverable: true,
        needsRetry: true,
        fallbackReason: 'network_timeout'
      };
    }
    
    // Erros de rate limiting - temporários
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return {
        type: 'rate_limit',
        isRecoverable: true,
        needsRetry: true,
        fallbackReason: 'rate_limited'
      };
    }
    
    // Erros de JSON/parsing - potencialmente recuperáveis
    if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
      return {
        type: 'json_parse',
        isRecoverable: true,
        needsRetry: false,
        fallbackReason: 'invalid_json'
      };
    }
    
    // Erros específicos do GLM - timeouts e respostas vazias  
    if (errorMessage.includes('GLM timeout') || errorMessage.includes('empty response') || 
        errorMessage.includes('Request took too long')) {
      return {
        type: 'glm_timeout',
        isRecoverable: false,  // GLM timeout = marcar como erro para usar fallback
        needsRetry: true,
        fallbackReason: 'glm_timeout'
      };
    }

    // Erros de autenticação - não recuperáveis
    if (errorMessage.includes('authentication') || errorMessage.includes('Invalid API key') ||
        errorMessage.includes('Unauthorized')) {
      return {
        type: 'authentication',
        isRecoverable: false,
        needsRetry: false,
        fallbackReason: 'invalid_api_key'
      };
    }

    // Erros de modelo - recuperáveis com retry
    if (errorMessage.includes('Unknown Model') || errorMessage.includes('model')) {
      return {
        type: 'model_error',
        isRecoverable: true,
        needsRetry: false,
        fallbackReason: 'invalid_model'
      };
    }
    
    // Erros de API key - não recuperáveis
    if (errorMessage.includes('api key') || errorMessage.includes('unauthorized') || 
        errorMessage.includes('authentication')) {
      return {
        type: 'auth_error',
        isRecoverable: false,
        needsRetry: false,
        fallbackReason: 'auth_failed'
      };
    }
    
    // Outros erros - assumir não recuperáveis por segurança
    return {
      type: 'unknown_error',
      isRecoverable: false,
      needsRetry: false,
      fallbackReason: 'provider_error'
    };
  }
  
  // Sistema de retry automático para providers
  private retryTimers = new Map<string, NodeJS.Timeout>();
  
  private scheduleProviderRetry(providerName: string, delayMs: number): void {
    // Limpar retry anterior se existir
    if (this.retryTimers.has(providerName)) {
      clearTimeout(this.retryTimers.get(providerName)!);
    }
    
    // Programar novo retry
    const timer = setTimeout(() => {
      const provider = this.providers.find(p => p.name === providerName);
      if (provider && provider.status !== 'online') {
        console.log(`🔄 Auto-recovery: resetting ${providerName} status to ONLINE`);
        provider.status = 'online';
      }
      this.retryTimers.delete(providerName);
    }, delayMs);
    
    this.retryTimers.set(providerName, timer);
    console.log(`⏰ Scheduled auto-recovery for ${providerName} in ${delayMs/1000}s`);
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

  // Método para limpar formatação markdown das respostas
  private cleanMarkdownFromResponse(response: string): string {
    let cleaned = response;
    
    // Remove blocos de código JSON
    if (cleaned.includes('```json')) {
      cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*$/gi, '');
    }
    if (cleaned.includes('```')) {
      cleaned = cleaned.replace(/```\s*/gi, '').replace(/```\s*$/gi, '');
    }
    
    // Remove leading/trailing whitespace
    cleaned = cleaned.trim();
    
    // Try to find JSON content between braces if response has extra text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }
    
    // Remove common GLM response prefixes/suffixes
    cleaned = cleaned.replace(/^.*?(?=\{)/, ''); // Remove everything before first {
    cleaned = cleaned.replace(/\}.*$/, '}'); // Remove everything after last }
    
    return cleaned;
  }

  // Método para resetar status de um provider para diagnóstico
  resetProviderStatus(providerName: string): void {
    const provider = this.providers.find(p => p.name === providerName);
    if (provider) {
      provider.status = 'online';
      console.log(`🔄 Provider ${providerName} status reset to ONLINE`);
    }
  }

  // Método para obter status detalhado de todos os providers
  getDetailedStatus(): any {
    return this.providers.map(p => ({
      name: p.name,
      enabled: p.enabled,
      status: p.status,
      priority: p.priority,
      model: p.model,
      stats: {
        requests: p.last30Days.totalRequests,
        successRate: p.last30Days.successRate,
        avgResponseTime: p.last30Days.avgResponseTime,
        totalCost: p.last30Days.totalCost
      }
    }));
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