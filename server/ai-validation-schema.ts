import { z } from "zod";

// Schema stricto para validação da resposta da IA
export const aiAnalysisResponseSchema = z.object({
  valor: z.string().regex(/^R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?$/, "Formato de valor inválido. Use: R$ X.XXX,XX"),
  data_pagamento: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Data deve estar no formato DD/MM/AAAA").optional(),
  data_vencimento: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Data deve estar no formato DD/MM/AAAA").optional(),
  competencia: z.string().regex(/^\d{2}\/\d{4}$/, "Competência deve estar no formato MM/AAAA").optional(),
  fornecedor: z.string().min(1, "Fornecedor é obrigatório"),
  descricao: z.string().min(3, "Descrição muito curta"),
  categoria: z.string().min(1, "Categoria é obrigatória"),
  centro_custo: z.string().min(1, "Centro de custo é obrigatório"),
  documento: z.string().optional(), // CNPJ/CPF
  cliente_fornecedor: z.string().optional(),
  observacoes: z.string().optional(),
  confidence: z.number().int().min(0).max(100, "Confiança deve estar entre 0 e 100"),
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