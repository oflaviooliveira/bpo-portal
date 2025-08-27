import { storage } from "./storage";

async function debugLastDocument() {
  console.log("🔍 Analisando último documento processado...");
  
  try {
    // Pegar o tenant padrão (admin)
    const tenantId = "default";
    
    // Buscar documentos do tenant ordenados por data
    const documents = await storage.getDocuments(tenantId, { limit: 5 });
    
    if (documents.length === 0) {
      console.log("❌ Nenhum documento encontrado");
      return;
    }
    
    const lastDoc = documents[0];
    console.log(`📄 Último documento: ${lastDoc.originalName}`);
    console.log(`📊 Status: ${lastDoc.status}`);
    console.log(`🎯 Provider IA: ${lastDoc.aiProvider || 'N/A'}`);
    console.log(`📈 Confiança OCR: ${lastDoc.ocrConfidence || 'N/A'}`);
    
    console.log("\n📝 DADOS EXTRAÍDOS PELA IA:");
    console.log("=" .repeat(50));
    if (lastDoc.extractedData) {
      for (const [key, value] of Object.entries(lastDoc.extractedData)) {
        console.log(`${key}: ${value}`);
      }
    } else {
      console.log("❌ Nenhum dado extraído");
    }
    
    console.log("\n📄 TEXTO OCR (primeiros 400 chars):");
    console.log("=" .repeat(50));
    if (lastDoc.ocrText) {
      console.log(lastDoc.ocrText.substring(0, 400) + (lastDoc.ocrText.length > 400 ? '...' : ''));
    } else {
      console.log("❌ Nenhum texto OCR encontrado");
    }
    
    // Buscar análises da IA
    console.log("\n🤖 ANÁLISES IA:");
    console.log("=" .repeat(50));
    const aiRuns = await storage.getDocumentAIRuns(lastDoc.id);
    
    if (aiRuns.length > 0) {
      aiRuns.forEach((run, index) => {
        console.log(`\n${index + 1}. Provider: ${run.provider}`);
        console.log(`   Confiança: ${Math.round((run.confidence || 0) * 100)}%`);
        console.log(`   Tokens: ${run.tokensUsed || 'N/A'}`);
        console.log(`   Custo: $${run.processingCost || 'N/A'}`);
        console.log(`   Data: ${run.createdAt}`);
        if (run.extractedData) {
          console.log(`   Dados:`, JSON.stringify(run.extractedData, null, 2));
        }
      });
    } else {
      console.log("❌ Nenhuma análise IA encontrada");
    }
    
    // Buscar inconsistências
    console.log("\n⚠️ INCONSISTÊNCIAS DETECTADAS:");
    console.log("=" .repeat(50));
    const inconsistencies = await storage.getDocumentInconsistencies(lastDoc.id);
    
    if (inconsistencies.length > 0) {
      inconsistencies.forEach((inc, index) => {
        console.log(`\n${index + 1}. Campo: ${inc.field}`);
        console.log(`   OCR: ${inc.ocrValue}`);
        console.log(`   IA: ${inc.aiValue}`);
        console.log(`   Metadata: ${inc.metadataValue}`);
        console.log(`   Severidade: ${inc.severity}`);
      });
    } else {
      console.log("✅ Nenhuma inconsistência detectada");
    }
    
    // Análise do nome do arquivo
    console.log("\n📂 ANÁLISE DO NOME DO ARQUIVO:");
    console.log("=" .repeat(50));
    const filename = lastDoc.originalName;
    
    // Extrair dados do nome
    const dateMatches = filename.match(/(\d{2})\.(\d{2})\.(\d{4})/g) || [];
    const valueMatches = filename.match(/R\$\s*(\d+(?:[.,]\d+)*(?:[.,]\d{2})?)/g) || [];
    const description = filename.split('_').filter(part => 
      !part.match(/^\d{2}\.\d{2}\.\d{4}$/) && 
      !part.match(/^R\$/) &&
      !part.includes('.pdf') &&
      part.length > 2
    );
    
    console.log(`Datas encontradas: ${dateMatches.join(', ')}`);
    console.log(`Valores encontrados: ${valueMatches.join(', ')}`);
    console.log(`Descrição: ${description.join(' ')}`);
    
    console.log("\n✅ Análise concluída!");
    
  } catch (error) {
    console.error("❌ Erro na análise:", error);
  }
}

// Executar se chamado diretamente
const isMainModule = process.argv[1] && process.argv[1].includes('debug-document');
if (isMainModule) {
  debugLastDocument().then(() => {
    console.log("\n🏁 Debug finalizado");
    process.exit(0);
  }).catch(error => {
    console.error("💥 Falha no debug:", error);
    process.exit(1);
  });
}

export { debugLastDocument };