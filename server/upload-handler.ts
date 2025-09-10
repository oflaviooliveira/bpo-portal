import { z } from "zod";
import { storage } from "./storage";
import { parseFileName, validateBusinessRules, performCrossValidation } from "./validation";
import { ContraparteService } from "./services/contraparte-service";
import { detectDocumentType, formatDocument, validateDocument } from "../shared/document-utils";
import { documentUploadSchema } from "./validation/schemas";

type UploadData = z.infer<typeof documentUploadSchema>;

export class DocumentUploadHandler {
  async processUpload(file: Express.Multer.File | null, formData: any, user: any): Promise<{
    success: boolean;
    documentId?: string;
    message: string;
    errors?: string[];
    warnings?: string[];
  }> {
    try {
      // Verificar se é documento virtual (parsing robusto)
      const isVirtualDocument = formData.isVirtualDocument === 'true' || formData.isVirtualDocument === true;
      
      if (file) {
        console.log(`📁 Processando upload: ${file.originalname} (${Math.round(file.size/1024)}KB)`);
      } else if (isVirtualDocument) {
        console.log(`🔮 Processando documento virtual: ${formData.documentType}`);
      } else {
        throw new Error("Nenhum arquivo foi enviado");
      }

      // 1. Validar dados do formulário
      console.log(`📋 Dados recebidos no formulário:`, JSON.stringify(formData, null, 2));
      const validatedData = documentUploadSchema.parse(formData);
      console.log(`✅ Dados do formulário validados: ${validatedData.documentType}`);

      // 2. Analisar nome do arquivo (apenas para documentos com arquivo)
      let filenameAnalysis = null;
      const warnings: string[] = [];
      
      if (file) {
        filenameAnalysis = parseFileName(file.originalname);
        console.log(`🔍 Nome do arquivo analisado:`, filenameAnalysis);
        
        // Coletar warnings do nome do arquivo
        if (!filenameAnalysis.isValid && filenameAnalysis.errors) {
          warnings.push(...filenameAnalysis.errors.map(error => `Aviso do nome do arquivo: ${error}`));
        }
      } else {
        console.log(`📄 Documento virtual - análise de arquivo pulada`);
      }

      // 3. Validar regras de negócio
      console.log(`🔍 Iniciando validação de regras de negócio para tipo: ${validatedData.documentType}`);
      const businessValidation = validateBusinessRules(validatedData.documentType, validatedData);
      console.log(`📊 Resultado da validação: isValid=${businessValidation.isValid}, errors=${businessValidation.errors.length}, warnings=${businessValidation.warnings.length}`);
      
      if (!businessValidation.isValid) {
        console.log(`❌ Validação de negócio falhou:`, businessValidation.errors);
        return {
          success: false,
          message: "Dados inválidos",
          errors: businessValidation.errors,
          warnings: [...warnings, ...(businessValidation.warnings || [])]
        };
      }
      
      // Adicionar warnings de validação de negócio
      if (businessValidation.warnings) {
        warnings.push(...businessValidation.warnings);
      }

      // 4. Preparar dados do tomador para boletos/NF/AGENDADO
      let issuerData = null;
      if (['EMITIR_BOLETO', 'EMITIR_NF', 'AGENDADO'].includes(validatedData.documentType)) {
        issuerData = {
          document: validatedData.payerDocument,
          name: validatedData.payerName,
          address: validatedData.payerAddress,
          email: validatedData.payerEmail,
          phone: validatedData.payerPhone,
          contactName: validatedData.payerContactName,
          stateRegistration: validatedData.payerStateRegistration,
          street: validatedData.payerStreet,
          number: validatedData.payerNumber,
          complement: validatedData.payerComplement,
          neighborhood: validatedData.payerNeighborhood,
          city: validatedData.payerCity,
          state: validatedData.payerState,
          zipCode: validatedData.payerZipCode,
          instructions: validatedData.instructions
        };
        
        if (validatedData.documentType === 'EMITIR_NF') {
          issuerData = {
            ...issuerData,
            serviceCode: validatedData.serviceCode,
            serviceDescription: validatedData.serviceDescription
          };
        }
        
        if (validatedData.documentType === 'AGENDADO') {
          issuerData = {
            ...issuerData,
            scheduledDate: validatedData.dueDate
          };
        }
      }

      // 5. Processar contraparte (nova lógica unificada)
      let contraparteId = validatedData.contraparteId;
      let relationshipType = ContraparteService.calculateRelationshipType(validatedData.documentType);
      
      // Se não tem contraparteId mas tem nome (supplier ou contraparteName)
      if (!contraparteId && (validatedData.contraparteName || validatedData.supplier)) {
        const contraparteName = validatedData.contraparteName || validatedData.supplier!;
        console.log(`🔍 Buscando/criando contraparte: ${contraparteName} como ${relationshipType}`);
        
        // Processar documento se fornecido
        let documentData: any = {};
        if (validatedData.contraparteDocument) {
          const documentType = detectDocumentType(validatedData.contraparteDocument);
          if (documentType && validateDocument(validatedData.contraparteDocument)) {
            documentData = {
              document: formatDocument(validatedData.contraparteDocument, documentType),
              documentType
            };
            console.log(`📄 Documento processado: ${documentData.document} (${documentData.documentType})`);
          }
        }
        
        const contraparte = await storage.findOrCreateContraparte(contraparteName, user.tenantId, {
          canBeClient: relationshipType === 'CLIENT',
          canBeSupplier: relationshipType === 'SUPPLIER',
          ...documentData
        });
        
        contraparteId = contraparte.id;
        console.log(`✅ Contraparte processada: ${contraparte.name} (${contraparte.id})`);
      }

      // 6. Criar documento no banco com nova estrutura
      const document = await storage.createDocument({
        tenantId: user.tenantId,
        contraparteId,
        relationshipType,
        clientId: validatedData.clientId, // Legacy compatibility
        bankId: validatedData.bankId,
        categoryId: validatedData.categoryId,
        costCenterId: validatedData.costCenterId,
        // File metadata (nullable para documentos virtuais)
        fileName: file?.filename || null,
        originalName: file?.originalname || null,
        fileSize: file?.size || null,
        mimeType: file?.mimetype || null,
        filePath: file?.path || null,
        documentType: validatedData.documentType,
        amount: this.parseAmount(validatedData.amount || '') || '0',
        supplier: validatedData.supplier || validatedData.contraparteName,
        description: validatedData.description,
        dueDate: this.parseDate(validatedData.dueDate || validatedData.scheduledDate || ''),
        paidDate: this.parseDate(validatedData.paidDate || validatedData.realPaidDate || validatedData.paymentDate || ''),
        issuerData,
        instructions: validatedData.instructions,
        notes: validatedData.notes,
        createdBy: user.id,
        // Status inicial baseado no tipo
        status: isVirtualDocument && ['EMITIR_BOLETO', 'EMITIR_NF'].includes(validatedData.documentType) 
          ? "PENDENTE_EMISSAO" 
          : "RECEBIDO"
      });

      // 7. Log da criação
      await storage.createDocumentLog({
        documentId: document.id,
        action: "UPLOAD",
        status: "SUCCESS", 
        details: {
          fileName: file?.originalname || 'VIRTUAL_DOCUMENT',
          fileSize: file?.size || 0,
          documentType: validatedData.documentType,
          filenameAnalysis: filenameAnalysis?.parsed || null
        },
        userId: user.id,
      });

      // 8. Iniciar processamento assíncrono
      this.scheduleProcessing(document.id, user.tenantId);

      return {
        success: true,
        documentId: document.id,
        message: "Documento enviado com sucesso",
        warnings: warnings
      };

    } catch (error) {
      console.error("❌ Erro no processamento de upload:", error);
      
      if (error instanceof z.ZodError) {
        return {
          success: false,
          message: "Dados do formulário inválidos",
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }

      return {
        success: false,
        message: "Erro interno do servidor",
        errors: [error instanceof Error ? error.message : 'Erro desconhecido']
      };
    }
  }

  private parseAmount(amount: string): string | null {
    if (!amount) return null;
    // Ordem correta: Remove R$/espaços → Remove pontos de milhares → Converte vírgula decimal
    const cleaned = amount.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? null : parsed.toString();
  }

  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    if (dateStr.includes('-')) {
      return new Date(dateStr);
    }
    
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = dateStr.match(dateRegex);
    if (match) {
      const [, day, month, year] = match;
      return new Date(`${year}-${month}-${day}`);
    }
    
    return null;
  }

  private scheduleProcessing(documentId: string, tenantId: string): void {
    setTimeout(async () => {
      try {
        // Importação dinâmica para evitar dependências circulares
        const { processDocumentSync } = await import("./document-processor");
        await processDocumentSync(documentId, tenantId);
      } catch (error) {
        console.error(`❌ Erro no processamento do documento ${documentId}:`, error);
      }
    }, 500);
  }
}

export const uploadHandler = new DocumentUploadHandler();