import { storage } from "./storage";

async function debugLastDocument() {
  console.log("🔍 Analisando último documento processado...");
  
  try {
    // Pegar o tenant padrão (admin)
    const tenantId = "default";
    
    // Buscar documentos do tenant ordenados por data
    const documents = await storage.getDocuments(tenantId);
    
    if (documents.length === 0) {
      console.log("❌ Nenhum documento encontrado");
      return;
    }
    
    const lastDoc = documents[0];
    console.log('\n=== DOCUMENT DATA ===');
    console.log(`ID: ${lastDoc.id}`);
    console.log(`Filename: ${lastDoc.fileName || 'N/A'}`);
    console.log(`Status: ${lastDoc.status}`);
    console.log(`Amount: ${lastDoc.amount}`);
    console.log(`AI Analysis: ${JSON.stringify(lastDoc.aiAnalysis, null, 2)}`);
    console.log(`OCR Text Length: ${lastDoc.ocrText?.length || 0} chars`);
    console.log(`OCR Confidence: ${lastDoc.ocrConfidence}%`);
    console.log(`AI Provider: ${lastDoc.aiProvider}`);
    console.log(`Created: ${lastDoc.createdAt}`);
    console.log(`Updated: ${lastDoc.updatedAt}`);
    
    console.log("\n📄 TEXTO OCR (primeiros 400 chars):");
    console.log("=" .repeat(50));
    if (lastDoc.ocrText) {
      console.log(lastDoc.ocrText.substring(0, 400) + (lastDoc.ocrText.length > 400 ? '...' : ''));
    } else {
      console.log("❌ Nenhum texto OCR encontrado");
    }
    
    console.log('\n=== AI RUNS ===');
    const aiRuns = await storage.getAiRunsByDocument(lastDoc.id);
    aiRuns.forEach((run, index) => {
      console.log(`\nAI Run ${index + 1}:`);
      console.log(`  Provider: ${run.providerUsed}`);
      console.log(`  OCR Strategy: ${run.ocrStrategy}`);
      console.log(`  Processing Time: ${run.processingTimeMs}ms`);
      console.log(`  Tokens In: ${run.tokensIn}`);
      console.log(`  Tokens Out: ${run.tokensOut}`);
      console.log(`  Cost: $${run.costUsd}`);
      console.log(`  Confidence: ${run.confidence}%`);
      if (run.fallbackReason) {
        console.log(`  Fallback Reason: ${run.fallbackReason}`);
      }
    });
    
    // Buscar inconsistências
    console.log("\n⚠️ INCONSISTÊNCIAS DETECTADAS:");
    console.log("=" .repeat(50));
    const inconsistencies = await storage.getDocumentInconsistencies(lastDoc.id);
    
    if (inconsistencies.length > 0) {
      inconsistencies.forEach((inc, index) => {
      console.log(`\n${index + 1}. Campo: ${inc.field}`);
      console.log(`   OCR: ${inc.ocrValue || 'N/A'}`);
      console.log(`   Filename: ${inc.filenameValue || 'N/A'}`);
      console.log(`   Form: ${inc.formValue || 'N/A'}`);
    });
    } else {
      console.log("✅ Nenhuma inconsistência detectada");
    }
    
    // Análise do filename
    console.log("\n📁 ANÁLISE DO FILENAME:");
    console.log("=" .repeat(50));
    const filename = lastDoc.fileName;
    if (filename) {
      console.log(`Filename original: ${filename}`);
      console.log(`Extensão: ${filename.split('.').pop()}`);
      console.log(`Tamanho do nome: ${filename.length} caracteres`);
    } else {
      console.log('Filename não disponível');
    }
    
    // Extrair dados do nome
    if (filename) {
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
    }

    
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