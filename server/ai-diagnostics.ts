/**
 * Sistema de diagnóstico e saúde dos provedores de IA
 * Implementa testes de conectividade e validação de API keys
 */

interface ProviderHealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  lastCheck: Date;
  error?: string;
  details?: any;
}

export class AIDiagnostics {
  private static instance: AIDiagnostics;
  private lastHealthCheck: Date = new Date(0);
  private healthCheckInterval = 5 * 60 * 1000; // 5 minutos

  static getInstance(): AIDiagnostics {
    if (!AIDiagnostics.instance) {
      AIDiagnostics.instance = new AIDiagnostics();
    }
    return AIDiagnostics.instance;
  }

  /**
   * Executa health check completo dos provedores
   */
  async performHealthCheck(): Promise<ProviderHealthCheck[]> {
    const now = new Date();
    
    // Rate limiting: só roda health check a cada 5 minutos
    if (now.getTime() - this.lastHealthCheck.getTime() < this.healthCheckInterval) {
      return this.getCachedHealthStatus();
    }

    console.log('🔍 Executando health check dos provedores IA...');
    
    const results: ProviderHealthCheck[] = [];
    
    // Check GLM
    const glmHealth = await this.checkGLMHealth();
    results.push(glmHealth);
    
    // Check OpenAI
    const openaiHealth = await this.checkOpenAIHealth();
    results.push(openaiHealth);
    
    this.lastHealthCheck = now;
    this.cacheHealthStatus(results);
    
    return results;
  }

  /**
   * Testa conectividade específica do GLM
   */
  private async checkGLMHealth(): Promise<ProviderHealthCheck> {
    const startTime = Date.now();
    
    try {
      const apiKey = process.env.GLM_API_KEY;
      if (!apiKey) {
        return {
          name: 'glm',
          status: 'down',
          lastCheck: new Date(),
          error: 'API key not configured'
        };
      }

      // Teste simples de conectividade
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'glm-4.5',
          messages: [
            { role: 'system', content: 'Health check' },
            { role: 'user', content: 'Test connectivity' }
          ],
          temperature: 0.1,
          max_tokens: 10
        }),
      });

      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (response.status === 401) {
        return {
          name: 'glm',
          status: 'down',
          latency,
          lastCheck: new Date(),
          error: 'Authentication failed - Invalid API key'
        };
      }

      if (response.status === 429) {
        return {
          name: 'glm',
          status: 'degraded',
          latency,
          lastCheck: new Date(),
          error: 'Rate limited'
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return {
          name: 'glm',
          status: 'degraded',
          latency,
          lastCheck: new Date(),
          error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`
        };
      }

      // Verificar estrutura da resposta
      const data = await response.json();
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        return {
          name: 'glm',
          status: 'degraded',
          latency,
          lastCheck: new Date(),
          error: 'Invalid response structure'
        };
      }

      return {
        name: 'glm',
        status: 'healthy',
        latency,
        lastCheck: new Date(),
        details: {
          model: 'glm-4.5',
          responseTime: latency + 'ms'
        }
      };

    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      if (error.name === 'AbortError') {
        return {
          name: 'glm',
          status: 'down',
          latency,
          lastCheck: new Date(),
          error: 'Connection timeout (10s)'
        };
      }

      return {
        name: 'glm',
        status: 'down',
        latency,
        lastCheck: new Date(),
        error: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Testa conectividade específica do OpenAI
   */
  private async checkOpenAIHealth(): Promise<ProviderHealthCheck> {
    const startTime = Date.now();
    
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return {
          name: 'openai',
          status: 'down',
          lastCheck: new Date(),
          error: 'API key not configured'
        };
      }

      // Teste simples de conectividade
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Health check' },
            { role: 'user', content: 'Test connectivity' }
          ],
          temperature: 0.1,
          max_tokens: 10
        }),
      });

      const latency = Date.now() - startTime;

      if (response.status === 401) {
        return {
          name: 'openai',
          status: 'down',
          latency,
          lastCheck: new Date(),
          error: 'Authentication failed - Invalid API key'
        };
      }

      if (response.status === 429) {
        return {
          name: 'openai',
          status: 'degraded',
          latency,
          lastCheck: new Date(),
          error: 'Rate limited'
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return {
          name: 'openai',
          status: 'degraded',
          latency,
          lastCheck: new Date(),
          error: `HTTP ${response.status}: ${errorText.substring(0, 100)}`
        };
      }

      return {
        name: 'openai',
        status: 'healthy',
        latency,
        lastCheck: new Date(),
        details: {
          model: 'gpt-4o-mini',
          responseTime: latency + 'ms'
        }
      };

    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      return {
        name: 'openai',
        status: 'down',
        latency,
        lastCheck: new Date(),
        error: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Cache simples em memória para health status
   */
  private healthCache: ProviderHealthCheck[] = [];

  private cacheHealthStatus(results: ProviderHealthCheck[]) {
    this.healthCache = results;
  }

  private getCachedHealthStatus(): ProviderHealthCheck[] {
    return this.healthCache;
  }

  /**
   * Endpoint para health check manual
   */
  async getHealthReport(): Promise<{
    timestamp: string;
    providers: ProviderHealthCheck[];
    summary: {
      totalProviders: number;
      healthyProviders: number;
      degradedProviders: number;
      downProviders: number;
    };
  }> {
    const providers = await this.performHealthCheck();
    
    const summary = {
      totalProviders: providers.length,
      healthyProviders: providers.filter(p => p.status === 'healthy').length,
      degradedProviders: providers.filter(p => p.status === 'degraded').length,
      downProviders: providers.filter(p => p.status === 'down').length,
    };

    return {
      timestamp: new Date().toISOString(),
      providers,
      summary
    };
  }
}