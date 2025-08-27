import { advancedOCR } from "./advanced-ocr";

async function testAdvancedOCR() {
  console.log("🚀 Teste do Sistema Avançado de OCR");
  console.log("=" .repeat(60));

  const testFile = "attached_assets/22.07.2025_PG_19.07.2025_02.08.2025_COMPRA DE 2 PNEUS_Manutenção de Veiculos_SRJ1_R$1.450,00_1756314812575.pdf";
  
  console.log(`📄 Arquivo de teste: ${testFile}`);
  console.log(`⏱️ Iniciando processamento...`);
  
  const startTime = Date.now();
  
  try {
    const result = await advancedOCR.processDocument(testFile);
    
    const totalTime = Date.now() - startTime;
    
    console.log("\n✅ RESULTADO DO OCR AVANÇADO:");
    console.log("=" .repeat(50));
    console.log(`📊 Estratégia utilizada: ${result.strategy}`);
    console.log(`📏 Caracteres extraídos: ${result.charCount}`);
    console.log(`🎯 Confiança: ${Math.round(result.confidence * 100)}%`);
    console.log(`⏱️ Tempo total: ${totalTime}ms`);
    
    console.log("\n📄 TEXTO EXTRAÍDO:");
    console.log("-" .repeat(50));
    console.log(result.text.substring(0, 500) + (result.text.length > 500 ? '...' : ''));
    
    console.log("\n🔍 ANÁLISE DE QUALIDADE:");
    console.log("-" .repeat(50));
    
    // Verificar presença de dados importantes
    const hasValue = result.text.includes('1.450') || result.text.includes('1450');
    const hasDate = result.text.includes('19/07/2025') || result.text.includes('19/07');
    const hasSupplier = result.text.includes('ROBSON') || result.text.includes('PNEUS');
    const hasCNPJ = result.text.includes('58.950.018') || result.text.includes('58950018');
    
    console.log(`💰 Valor encontrado: ${hasValue ? '✅' : '❌'} (R$ 1.450,00)`);
    console.log(`📅 Data encontrada: ${hasDate ? '✅' : '❌'} (19/07/2025)`);
    console.log(`🏢 Fornecedor encontrado: ${hasSupplier ? '✅' : '❌'} (ROBSON PNEUS)`);
    console.log(`📋 CNPJ encontrado: ${hasCNPJ ? '✅' : '❌'} (58.950.018/0001-34)`);
    
    const score = [hasValue, hasDate, hasSupplier, hasCNPJ].filter(Boolean).length;
    console.log(`\n🎯 Score de qualidade: ${score}/4 (${Math.round(score/4*100)}%)`);
    
    if (score >= 3) {
      console.log("🌟 EXCELENTE: OCR extraiu dados suficientes para análise IA!");
    } else if (score >= 2) {
      console.log("⚠️ BOM: OCR funcional, mas pode precisar de fallback");
    } else {
      console.log("❌ RUIM: OCR precisa de melhorias ou fallback obrigatório");
    }
    
  } catch (error) {
    console.error("❌ ERRO no OCR avançado:", error);
  }
  
  console.log("\n✅ Teste concluído!");
}

// Executar se chamado diretamente
const isMainModule = process.argv[1] && process.argv[1].includes('test-advanced-ocr');
if (isMainModule) {
  testAdvancedOCR().then(() => {
    console.log("\n🏁 Script finalizado");
    process.exit(0);
  }).catch(error => {
    console.error("💥 Falha no teste:", error);
    process.exit(1);
  });
}

export { testAdvancedOCR };