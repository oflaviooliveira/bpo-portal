import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || ""
});

interface AIAnalysisResult {
  provider: string;
  documentType: string;
  amount?: string;
  dueDate?: string;
  paidDate?: string;
  bankName?: string;
  clientInfo?: string;
  confidence: number;
  extractedData: any;
}

export async function analyzeDocumentWithAI(ocrText: string, fileName: string): Promise<AIAnalysisResult> {
  // Try GLM-4-Plus first (primary), fallback to GPT-5
  try {
    return await analyzeWithGLM(ocrText, fileName);
  } catch (error: any) {
    console.log('GLM analysis failed, falling back to GPT-5:', error?.message || error);
    return await analyzeWithGPT(ocrText, fileName);
  }
}

async function analyzeWithGLM(ocrText: string, fileName: string): Promise<AIAnalysisResult> {
  // GLM-4-Plus integration would go here
  // For now, we'll simulate the API call and fallback to GPT
  throw new Error('GLM-4-Plus service not available');
}

async function analyzeWithGPT(ocrText: string, fileName: string): Promise<AIAnalysisResult> {
  const prompt = `
Você é um especialista em análise de documentos financeiros brasileiros. Analise o texto OCR extraído e o nome do arquivo para classificar e extrair informações estruturadas.

TEXTO OCR:
${ocrText}

NOME DO ARQUIVO:
${fileName}

Retorne um JSON com as seguintes informações:
- documentType: "PAGO", "AGENDADO", "BOLETO" ou "NF"
- amount: valor monetário no formato "1234.56" (sem R$ ou pontos de milhares)
- dueDate: data de vencimento no formato "YYYY-MM-DD" 
- paidDate: data de pagamento no formato "YYYY-MM-DD" (se aplicável)
- bankName: nome do banco identificado
- clientInfo: informações do cliente/empresa
- confidence: nível de confiança de 0 a 100
- extractedData: objeto com dados adicionais extraídos

REGRAS DE CLASSIFICAÇÃO:
- PAGO: Comprovantes de pagamento, extratos bancários mostrando débito
- AGENDADO: Agendamentos de pagamento, transferências futuras  
- BOLETO: Boletos bancários para pagamento
- NF: Notas fiscais, faturas de serviços

Responda APENAS com o JSON válido:`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em análise de documentos financeiros. Responda sempre em JSON válido."
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
      throw new Error('No content in response');
    }
    const result = JSON.parse(content);

    return {
      provider: "GPT-5",
      documentType: result.documentType || "PAGO",
      amount: result.amount,
      dueDate: result.dueDate,
      paidDate: result.paidDate,
      bankName: result.bankName,
      clientInfo: result.clientInfo,
      confidence: Math.min(100, Math.max(0, result.confidence || 70)),
      extractedData: result.extractedData || {},
    };

  } catch (error: any) {
    console.error('GPT analysis error:', error);
    
    // Return basic analysis based on filename patterns
    return {
      provider: "GPT-5-FALLBACK",
      documentType: inferDocumentTypeFromFilename(fileName),
      confidence: 50,
      extractedData: { fallback: true, error: error?.message || 'Unknown error' },
    };
  }
}

function inferDocumentTypeFromFilename(fileName: string): string {
  const name = fileName.toLowerCase();
  
  if (name.includes('pag') || name.includes('comprovante') || name.includes('extrato')) {
    return 'PAGO';
  } else if (name.includes('agenda') || name.includes('programado')) {
    return 'AGENDADO';
  } else if (name.includes('boleto') || name.includes('cobranca')) {
    return 'BOLETO';
  } else if (name.includes('nf') || name.includes('nota') || name.includes('fatura')) {
    return 'NF';
  }
  
  return 'PAGO'; // Default
}

// Helper function for amount validation
export function validateBrazilianCurrency(amount: string): boolean {
  const pattern = /^\d+(\.\d{2})?$/;
  return pattern.test(amount);
}

// Helper function for date validation  
export function validateBrazilianDate(date: string): boolean {
  const dateObj = new Date(date);
  return !isNaN(dateObj.getTime()) && dateObj > new Date('2020-01-01');
}
