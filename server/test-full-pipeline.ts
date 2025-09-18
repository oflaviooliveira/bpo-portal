import { storage } from "./storage";
import { DocumentProcessor } from "./document-processor";
import fs from "fs/promises";
import path from "path";

async function testFullPipeline() {
  try {
    console.log("🧪 Teste do Pipeline Completo OCR + IA + Validação");
    console.log("=" .repeat(60));

    // Verificar se há documentos para testar
    const documents = await storage.getDocuments("550e8400-e29b-41d4-a716-446655440000", {});
    
    if (documents.length === 0) {
      console.log("❌ Nenhum documento encontrado para teste");
      return;
    }

    const testDocument = documents[0];
    console.log(`📄 Testando documento: ${testDocument.originalName}`);
    console.log(`   Status atual: ${testDocument.status}`);
    console.log(`   ID: ${testDocument.id}`);

    // Verificar se arquivo existe
    if (!testDocument.filePath) {
      console.log(`❌ Caminho do arquivo não definido para documento: ${testDocument.originalName}`);
      return;
    }
    
    try {
      await fs.access(testDocument.filePath);
      console.log(`✅ Arquivo encontrado: ${testDocument.filePath}`);
    } catch (error) {
      console.log(`❌ Arquivo não encontrado: ${testDocument.filePath}`);
      return;
    }

    console.log("\n🚀 Iniciando processamento...");
    
    const processor = new DocumentProcessor();
    const startTime = Date.now();
    
    const result = await processor.processDocument(testDocument.id, testDocument.tenantId);
    
    const endTime = Date.now();
    const processingTime = endTime - startTime;

    console.log("\n📊 Resultados do Processamento:");
    console.log("=" .repeat(40));
    console.log(`✅ Sucesso: ${result.success}`);
    console.log(`📋 Status final: ${result.status}`);
    console.log(`⏱️  Tempo total: ${processingTime}ms`);
    console.log(`🔍 Campos atualizados: ${Object.keys(result.updates).join(", ")}`);
    
    if (result.errors && result.errors.length > 0) {
      console.log(`⚠️  Erros/Inconsistências encontradas:`);
      result.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    // Verificar inconsistências registradas
    console.log("\n🔍 Verificando inconsistências registradas...");
    const inconsistencies = await storage.getDocumentInconsistencies(testDocument.id);
    if (inconsistencies.length > 0) {
      console.log(`❗ ${inconsistencies.length} inconsistência(s) detectada(s):`);
      inconsistencies.forEach((inc, index) => {
        console.log(`   ${index + 1}. Campo: ${inc.field}`);
        console.log(`      OCR: "${inc.ocrValue || 'N/A'}"`);
        console.log(`      IA: "${inc.formValue || 'N/A'}"`);
        console.log(`      Arquivo: "${inc.filenameValue || 'N/A'}"`);
      });
    } else {
      console.log("✅ Nenhuma inconsistência detectada");
    }

    // Verificar métricas de IA
    console.log("\n🤖 Verificando métricas de IA...");
    const aiRuns = await storage.getAiRunsByDocument(testDocument.id);
    if (aiRuns.length > 0) {
      const latestRun = aiRuns[aiRuns.length - 1];
      console.log(`🎯 Provider usado: ${latestRun.providerUsed}`);
      console.log(`⏱️  Tempo de processamento: ${latestRun.processingTimeMs}ms`);
      console.log(`🪙 Tokens entrada: ${latestRun.tokensIn}`);
      console.log(`🪙 Tokens saída: ${latestRun.tokensOut}`);
      console.log(`💰 Custo: $${latestRun.costUsd}`);
      console.log(`📊 Confiança: ${latestRun.confidence}%`);
      if (latestRun.fallbackReason) {
        console.log(`🔄 Motivo do fallback: ${latestRun.fallbackReason}`);
      }
    } else {
      console.log("❌ Nenhuma métrica de IA encontrada");
    }

    // Verificar documento final
    console.log("\n📄 Estado final do documento:");
    const updatedDocument = await storage.getDocument(testDocument.id, testDocument.tenantId);
    if (updatedDocument) {
      console.log(`   Status: ${updatedDocument.status}`);
      console.log(`   Valor: R$ ${updatedDocument.amount || "N/A"}`);
      console.log(`   Vencimento: ${updatedDocument.dueDate || "N/A"}`);
      console.log(`   Fornecedor: ${updatedDocument.supplier || "N/A"}`);
      console.log(`   Provider IA: ${updatedDocument.aiProvider || "N/A"}`);
      console.log(`   Confiança OCR: ${updatedDocument.ocrConfidence || "N/A"}%`);
    }

    console.log("\n🎉 Teste concluído com sucesso!");
    console.log(`📈 Performance: ${processingTime}ms para processamento completo`);

  } catch (error) {
    console.error("❌ Erro no teste:", error);
    if (error instanceof Error) {
      console.error("Stack:", error.stack);
    }
  }
}

// Executar teste se chamado diretamente
const isMainModule = process.argv[1] && process.argv[1].includes('test-full-pipeline');
if (isMainModule) {
  testFullPipeline().then(() => {
    console.log("\n✅ Script de teste finalizado");
    process.exit(0);
  }).catch(error => {
    console.error("❌ Falha no teste:", error);
    process.exit(1);
  });
}

export { testFullPipeline };