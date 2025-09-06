import { z } from "zod";

// Schema ultra-flexível para máxima tolerância
export const aiAnalysisResponseSchema = z.object({
  valor: z.string().optional(),
  data_pagamento: z.string().optional(),
  data_vencimento: z.string().optional(),
  competencia: z.string().optional(),
  fornecedor: z.string().optional(),
  descricao: z.string().optional(),
  categoria: z.string().optional(),
  centro_custo: z.string().optional().default("GERAL"),
  documento: z.string().optional(),
  cnpj_emitente: z.string().optional(),
  data_emissao: z.string().optional(),
  data_saida: z.string().optional(),
  chave_acesso: z.string().optional(),
  cliente_fornecedor: z.string().optional(),
  observacoes: z.string().optional(),
  // 🏦 CAMPOS ESPECÍFICOS PARA BOLETOS
  beneficiario: z.string().optional(),
  cedente: z.string().optional(),
  sacado: z.string().optional(),
  cnpj_beneficiario: z.string().optional(),
  codigo_barras: z.string().optional(),
  linha_digitavel: z.string().optional(),
  nosso_numero: z.string().optional(),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  confidence: z.union([
    z.number(),
    z.string().transform(val => {
      if (val === "alta") return 90;
      if (val === "media") return 70;
      if (val === "baixa") return 50;
      return parseFloat(val) || 75;
    })
  ]).optional().default(75),
}).transform(data => {
  // Post-processing para normalizar dados após validação flexível
  const processed = { ...data };
  
  // Normalizar valor monetário
  if (processed.valor && !processed.valor.includes('R$')) {
    const numbers = processed.valor.match(/[\d.,]+/);
    if (numbers) {
      processed.valor = `R$ ${numbers[0]}`;
    }
  }
  
  // Normalizar datas no formato DD/MM/AAAA
  const dateFields = ['data_pagamento', 'data_vencimento', 'data_emissao', 'data_saida'] as const;
  dateFields.forEach(field => {
    const fieldValue = processed[field as keyof typeof processed];
    if (fieldValue && typeof fieldValue === 'string' && fieldValue !== 'null' && fieldValue.length > 5) {
      const dateMatch = fieldValue.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (dateMatch) {
        (processed as any)[field] = `${dateMatch[1].padStart(2, '0')}/${dateMatch[2].padStart(2, '0')}/${dateMatch[3]}`;
      }
    }
  });
  
  return processed;
});

export type AiAnalysisResponse = z.infer<typeof aiAnalysisResponseSchema>;

// Funções de normalização
export function normalizeValue(value: string): string {
  // Remove caracteres não numéricos exceto vírgula e ponto
  const cleaned = value.replace(/[^\d,.-]/g, '');
  
  // Converte para formato padrão R$ X.XXX,XX
  const numbers = cleaned.replace(/[^\d]/g, '');
  if (numbers.length === 0) return "R$ 0,00";
  
  const cents = numbers.slice(-2);
  const reais = numbers.slice(0, -2);
  
  // Adiciona pontos para milhares
  const formattedReais = reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  return `R$ ${formattedReais || '0'},${cents.padStart(2, '0')}`;
}

export function normalizeDate(date: string): string {
  // Tenta diferentes formatos e converte para DD/MM/AAAA
  if (!date || date === "não_identificado") return "";
  
  // Se já está no formato correto
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return date;
  
  // Formato AAAA-MM-DD ou DD-MM-AAAA
  const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  
  // Formato DD-MM-AAAA
  const dashMatch = date.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashMatch) {
    return `${dashMatch[1]}/${dashMatch[2]}/${dashMatch[3]}`;
  }
  
  return date; // Retorna como está se não conseguir normalizar
}

export function valueInCents(value: string): number {
  // Converte valor monetário para centavos
  const numbers = value.replace(/[^\d]/g, '');
  return parseInt(numbers) || 0;
}

// Auto-correção de JSON inválido
export function autoCorrectJsonResponse(response: string): string {
  try {
    // Tenta parsear direto primeiro
    JSON.parse(response);
    return response;
  } catch {
    // Remove markdown code blocks
    let cleaned = response.replace(/```json\s*/, '').replace(/```\s*$/, '');
    cleaned = cleaned.replace(/```\s*/, '').replace(/```\s*$/, '');
    
    // Remove quebras de linha desnecessárias e espaços extras
    cleaned = cleaned.trim();
    
    // Tenta corrigir aspas duplas
    cleaned = cleaned.replace(/'/g, '"');
    
    // Tenta corrigir vírgulas faltantes
    cleaned = cleaned.replace(/"\s*\n\s*"/g, '",\n  "');
    
    // Tenta corrigir chaves finais
    if (!cleaned.endsWith('}')) {
      cleaned += '}';
    }
    
    if (!cleaned.startsWith('{')) {
      cleaned = '{' + cleaned;
    }
    
    return cleaned;
  }
}