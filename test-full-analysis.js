import OpenAI from 'openai';
import { z } from 'zod';

// Schema de validação idêntico ao sistema
const aiAnalysisResponseSchema = z.object({
  valor: z.string().regex(/^R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?$/, "Formato de valor inválido. Use: R$ X.XXX,XX"),
  data_pagamento: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Data deve estar no formato DD/MM/AAAA").optional(),
  data_vencimento: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Data deve estar no formato DD/MM/AAAA").optional(),
  competencia: z.string().regex(/^\d{2}\/\d{4}$/, "Competência deve estar no formato MM/AAAA").optional(),
  fornecedor: z.string().min(1, "Fornecedor é obrigatório"),
  descricao: z.string().min(3, "Descrição muito curta"),
  categoria: z.string().min(1, "Categoria é obrigatória"),
  centro_custo: z.string().min(1, "Centro de custo é obrigatório"),
  documento: z.string().optional(),
  cliente_fornecedor: z.string().optional(),
  observacoes: z.string().optional(),
  confidence: z.number().int().min(0).max(100, "Confiança deve estar entre 0 e 100"),
});

// Prompt builder idêntico ao sistema
function buildAnalysisPrompt(ocrText, fileName) {
  const fileData = { fileName, extractedValue: "R$ 49,02" }; // Simulando extração de arquivo
  
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
  "centro_custo": "[código_centro_custo]",
  "documento": "[cnpj_ou_cpf_se_disponivel]",
  "confidence": 85
}
`;
}

// Teste GLM com análise completa
async function testGLMFullAnalysis() {
  const apiKey = process.env.GLM_API_KEY;
  const ocrText = "COMPRA DE AGUA E DESCARTAVEL PARA GALPAO - AGUA LINCONS E COPOS DESCARTÁVEIS Fontinele Coimbra R$ 49,02 12/08/2025";
  const fileName = "12.08.2025-PG-COMPRA DE AGUA E DESCARTAVEL PARA GALPAIÌ_O-SMN1-R$49,02.jpeg";
  
  try {
    console.log('🧪 Testing GLM Full Analysis...');
    console.log('📄 OCR Text:', ocrText);
    console.log('📁 File Name:', fileName);
    
    const prompt = buildAnalysisPrompt(ocrText, fileName);
    
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'glm-4.5',
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
      console.log('❌ GLM API Error:', errorText);
      return false;
    }

    const data = await response.json();
    let aiResponse = data.choices[0].message.content;
    
    console.log("🤖 GLM Raw Response:", aiResponse);

    // Clean markdown formatting (igual ao sistema)
    if (aiResponse.includes('```json')) {
      aiResponse = aiResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
    }
    if (aiResponse.includes('```')) {
      aiResponse = aiResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
    }
    
    console.log("🧹 GLM Cleaned Response:", aiResponse);
    
    try {
      const extractedData = JSON.parse(aiResponse.trim());
      console.log("✅ JSON Parse Success:", extractedData);
      
      // Tentar validação com schema rigoroso
      try {
        const validatedData = aiAnalysisResponseSchema.parse(extractedData);
        console.log("✅ Schema Validation Success:", validatedData);
        return true;
      } catch (validationError) {
        console.log("❌ Schema Validation Failed:", validationError.message);
        console.log("🔍 Validation Details:", validationError.issues);
        return false;
      }
      
    } catch (parseError) {
      console.log("❌ JSON Parse Failed:", parseError.message);
      console.log("📝 Trying to parse:", JSON.stringify(aiResponse.trim()));
      return false;
    }
    
  } catch (error) {
    console.log('❌ GLM Test Failed:', error.message);
    return false;
  }
}

// Teste OpenAI com análise completa
async function testOpenAIFullAnalysis() {
  const ocrText = "COMPRA DE AGUA E DESCARTAVEL PARA GALPAO - AGUA LINCONS E COPOS DESCARTÁVEIS Fontinele Coimbra R$ 49,02 12/08/2025";
  const fileName = "12.08.2025-PG-COMPRA DE AGUA E DESCARTAVEL PARA GALPAIÌ_O-SMN1-R$49,02.jpeg";
  
  try {
    console.log('🧪 Testing OpenAI Full Analysis...');
    
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = buildAnalysisPrompt(ocrText, fileName);
    
    const response = await openai.chat.completions.create({
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
      console.log('❌ OpenAI No content in response');
      return false;
    }

    console.log("🤖 OpenAI Response:", content);

    try {
      const extractedData = JSON.parse(content);
      console.log("✅ JSON Parse Success:", extractedData);
      
      // Tentar validação com schema rigoroso
      try {
        const validatedData = aiAnalysisResponseSchema.parse(extractedData);
        console.log("✅ Schema Validation Success:", validatedData);
        return true;
      } catch (validationError) {
        console.log("❌ Schema Validation Failed:", validationError.message);
        console.log("🔍 Validation Details:", validationError.issues);
        return false;
      }
      
    } catch (parseError) {
      console.log("❌ JSON Parse Failed:", parseError.message);
      return false;
    }
    
  } catch (error) {
    console.log('❌ OpenAI Test Failed:', error.message);
    return false;
  }
}

// Executar testes completos
async function runFullTests() {
  console.log('🚀 Starting Full Analysis Tests...\n');
  
  console.log('=== GLM FULL ANALYSIS TEST ===');
  const glmResult = await testGLMFullAnalysis();
  
  console.log('\n=== OPENAI FULL ANALYSIS TEST ===');
  const openaiResult = await testOpenAIFullAnalysis();
  
  console.log('\n=== FINAL RESULTS ===');
  console.log('GLM Full Analysis:', glmResult ? '✅' : '❌');
  console.log('OpenAI Full Analysis:', openaiResult ? '✅' : '❌');
}

runFullTests().catch(console.error);