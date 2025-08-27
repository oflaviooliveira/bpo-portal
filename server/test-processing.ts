// Test script to diagnose document processing issues
import { DocumentProcessor } from "./document-processor";
import { storage } from "./storage";

async function testProcessing() {
  console.log("🧪 Testando processamento de documentos...");
  
  // Get the most recent document
  const documents = await storage.getDocuments("123e4567-e89b-12d3-a456-426614174000", {});
  if (documents.length === 0) {
    console.log("❌ Nenhum documento encontrado");
    return;
  }
  
  const document = documents[0];
  console.log(`📄 Processando documento: ${document.originalName}`);
  console.log(`📂 Caminho do arquivo: ${document.filePath}`);
  console.log(`📊 Status atual: ${document.status}`);
  
  const processor = new DocumentProcessor();
  
  try {
    const result = await processor.processDocument(document.id, document.tenantId);
    console.log("✅ Resultado do processamento:", result);
  } catch (error) {
    console.error("❌ Erro no processamento:", error);
  }
}

// Execute if called directly
testProcessing().catch(console.error);

export { testProcessing };