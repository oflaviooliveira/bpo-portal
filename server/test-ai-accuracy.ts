import { aiMultiProvider } from "./ai-multi-provider";

async function testAIAccuracy() {
  console.log("🧪 Teste de Precisão da IA com Documento Real");
  console.log("=" .repeat(60));

  // Texto OCR simulado baseado no documento enviado pelo usuário
  const ocrText = `
ROBSON PNEUS E AUTOPECAS LTDA DANFE
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

VALOR TOTAL DA NOTA
1.450,00

DADOS DOS PRODUTOS / SERVIÇOS
CÓDIGO DESCRIÇÃO DOS PRODUTOS / SERVIÇOS NCM CST CFOP UN QTDE V. UNITÁRIO V. TOTAL
0001010000007 PNEU WANLI 225/75R16LT 120/116S 225/75R16 40119090 060 6.403 UN 2 725,00 1.450,00

RECEBEMOS DE ROBSON PNEUS E AUTOPECAS LTDA OS PRODUTOS CONSTANTES DA NOTA FISCAL
ECO EXPRESS SERVICOS SUSTENTAVEIS LTDA
Nº 645 Série 1
`;

  const fileName = "22.07.2025_PG_19.07.2025_02.08.2025_COMPRA DE 2 PNEUS_Manutenção de Veiculos_SRJ1_R$1.450,00.pdf";

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

  console.log("\n📊 DADOS ESPERADOS (para comparação):");
  console.log({
    valor: "R$ 1.450,00",
    data_pagamento: "19/07/2025",
    fornecedor: "ROBSON PNEUS E AUTOPECAS LTDA",
    descricao: "COMPRA DE 2 PNEUS",
    categoria: "Manutenção de Veículos",
    centro_custo: "SRJ1",
    documento: "58.950.018/0001-34",
    cliente_fornecedor: "ECO EXPRESS SERVICOS SUSTENTAVEIS LTDA"
  });

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