import { aiMultiProvider } from "./ai-multi-provider";

async function testAIAccuracy() {
  console.log("🧪 Teste de Precisão da IA com Documento Real");
  console.log("=" .repeat(60));

  // Texto OCR simulado representando um documento de baixa qualidade
  const ocrText = `
DOCUMENTO FISCAL
ALUGUEL DE VEICULOS
DATA 07/2025
Documento Auxiliar da Nota Fiscal Eletrônica
AV MARIA DO CARMO, 1571
POSTO LAVA TUCUNS 
CRUZ / CE
62595-000
(88) 9729-5739

Nº 645
Série 1

NATUREZA DA OPERAÇÃO
Revenda de mercadorias com ST
INSCRIÇÃO ESTADUAL CNPJ
072368276 58.950.018/0001-34

DESTINATÁRIO / REMETENTE
NOME / RAZÃO SOCIAL CNPJ / CPF DATA DE EMISSÃO
ECO EXPRESS SERVICOS SUSTENTAVEIS LTDA 24.824.109/0001-01 19/07/2025

ENDEREÇO BAIRRO / DISTRITO CEP DATA SAÍDA / ENTRADA
ST SRTVS, 110 QUADRA701 BLOCO O SALA 521 - PARTE ASA SUL 70340-000 19/07/2025

MUNICÍPIO FONE / FAX UF INSCRIÇÃO ESTADUAL HORA SAÍDA / ENTRADA
BRASÍLIA (61) 8123-4535 DF 0776914000149 10:56:28

FATURA
0 - A VISTA
21/07/2025
1 - A PRAZO 0 1.450,00
PIX

VALOR TOTAL DOS PRODUTOS
1.450,00

VALOR: R$ 120,00
VENCIMENTO: 24/07/2025
FORNECEDOR: Empresa de Locação XYZ
`;

  // Teste com o arquivo que teve problema
  const fileName = "06.08.2025_PG_09.07.2025_26.07.2025_Locação De Veiculos_Aluguel De Veiculos_Srj1_R$ 455,79.pdf";

  console.log(`📄 Arquivo: ${fileName}`);
  console.log(`📝 Texto OCR (${ocrText.length} caracteres)`);
  console.log("\n🤖 Testando análise IA...");

  try {
    // Testar com GLM primeiro
    console.log("\n1️⃣ Testando GLM...");
    const glmResult = await aiMultiProvider.analyzeWithGLM(ocrText, fileName);
    console.log("✅ GLM Response:");
    console.log("Provider:", glmResult.provider);
    console.log("Confidence:", glmResult.confidence);
    console.log("Cost:", glmResult.processingCost);
    console.log("Extracted Data:", JSON.stringify(glmResult.extractedData, null, 2));

  } catch (error) {
    console.error("❌ Erro GLM:", error);
    
    // Testar fallback para OpenAI
    try {
      console.log("\n2️⃣ Testando OpenAI (fallback)...");
      const openaiResult = await aiMultiProvider.analyzeWithOpenAI(ocrText, fileName);
      console.log("✅ OpenAI Response:");
      console.log("Provider:", openaiResult.provider);
      console.log("Confidence:", openaiResult.confidence);
      console.log("Cost:", openaiResult.processingCost);
      console.log("Extracted Data:", JSON.stringify(openaiResult.extractedData, null, 2));
      
    } catch (openaiError) {
      console.error("❌ Erro OpenAI:", openaiError);
    }
  }

  console.log("\n📊 DADOS ESPERADOS (baseados no nome do arquivo):");
  console.log({
    valor: "R$ 455,79", // Deve priorizar o valor do nome do arquivo
    data_pagamento: "06/08/2025", // Primeira data do arquivo
    data_vencimento: "09/07/2025", // Segunda data do arquivo
    descricao: "Locação De Veiculos Aluguel De Veiculos", 
    categoria: "Transporte",
    centro_custo: "SRJ1",
    tipo: "PAGO" // Por causa do "PG" no nome
  });

  console.log("\n⚠️ TESTE DE VALIDAÇÃO CRUZADA:");
  console.log("OCR sugere R$ 120,00 vs Arquivo tem R$ 455,79");
  console.log("IA deve priorizar o valor do arquivo!");
  console.log("OCR sugere 24/07/2025 vs Arquivo tem múltiplas datas");
  console.log("IA deve usar as datas estruturadas do arquivo!");

  console.log("\n✅ Teste de precisão concluído!");
}

// Executar teste
const isMainModule = process.argv[1] && process.argv[1].includes('test-ai-accuracy');
if (isMainModule) {
  testAIAccuracy().then(() => {
    console.log("\n✅ Script finalizado");
    process.exit(0);
  }).catch(error => {
    console.error("❌ Falha no teste:", error);
    process.exit(1);
  });
}

export { testAIAccuracy };