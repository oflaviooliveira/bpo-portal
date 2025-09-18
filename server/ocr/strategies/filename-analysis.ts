import { OcrStrategy, OcrResult } from '../interfaces';
import * as path from 'path';

export class FilenameAnalysisStrategy implements OcrStrategy {
  name = 'FILENAME_ANALYSIS';
  priority = 99; // Última estratégia de fallback
  description = 'Análise inteligente do nome do arquivo para extrair metadados';

  async execute(filePath: string): Promise<OcrResult> {
    const startTime = Date.now();
    
    try {
      const filename = path.basename(filePath, path.extname(filePath));
      const extractedData = this.extractDataFromFilename(filename);
      
      const processingTime = Date.now() - startTime;
      
      // Gerar texto estruturado a partir dos dados extraídos
      const text = this.generateStructuredText(extractedData);
      
      return {
        text,
        confidence: extractedData.confidence,
        strategy: this.name,
        processingTime,
        characterCount: text.length,
        metadata: {
          extractedData,
          originalFilename: filename,
          patternsFound: extractedData.patternsFound
        }
      };
    } catch (error) {
      console.error(`FILENAME_ANALYSIS failed:`, error);
      return {
        text: '',
        confidence: 0,
        strategy: this.name,
        processingTime: Date.now() - startTime,
        characterCount: 0,
        metadata: {
          error: error instanceof Error ? error.message : 'Filename analysis failed'
        }
      };
    }
  }

  private extractDataFromFilename(filename: string): any {
    const extractedData: any = {
      patternsFound: [],
      confidence: 0
    };

    // Regex patterns para diferentes tipos de dados
    const patterns = {
      // Datas em formato DD.MM.AAAA
      date: /(\d{2})\.(\d{2})\.(\d{4})/g,
      // Valores monetários R$ X.XXX,XX
      currency: /R\$?\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/g,
      // CNPJ/CPF
      document: /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/g,
      // Códigos/Números de documento
      docNumber: /(\d{6,})/g,
      // Palavras-chave para categorias
      categories: /(transporte|uber|taxi|combustivel|gasolina|manutencao|pneu|pecas|aluguel|locacao|energia|agua|telefone|internet|material|escritorio)/gi
    };

    // Extrair datas
    let match;
    const dates = [];
    while ((match = patterns.date.exec(filename)) !== null) {
      dates.push({
        day: match[1],
        month: match[2],
        year: match[3],
        formatted: `${match[1]}/${match[2]}/${match[3]}`
      });
      extractedData.patternsFound.push('date');
    }
    if (dates.length > 0) {
      extractedData.dates = dates;
      extractedData.confidence += 30;
    }

    // Extrair valores
    const values = [];
    patterns.currency.lastIndex = 0; // Reset regex
    while ((match = patterns.currency.exec(filename)) !== null) {
      values.push({
        raw: match[1],
        formatted: `R$ ${match[1]}`,
        numeric: parseFloat(match[1].replace(/\./g, '').replace(',', '.'))
      });
      extractedData.patternsFound.push('currency');
    }
    if (values.length > 0) {
      extractedData.values = values;
      extractedData.confidence += 25;
    }

    // Extrair documentos (CNPJ/CPF)
    const documents = [];
    patterns.document.lastIndex = 0;
    while ((match = patterns.document.exec(filename)) !== null) {
      documents.push({
        value: match[1],
        type: match[1].includes('/') ? 'CNPJ' : 'CPF'
      });
      extractedData.patternsFound.push('document');
    }
    if (documents.length > 0) {
      extractedData.documents = documents;
      extractedData.confidence += 20;
    }

    // Extrair categorias/palavras-chave
    const categories = [];
    patterns.categories.lastIndex = 0;
    while ((match = patterns.categories.exec(filename)) !== null) {
      categories.push(match[1].toLowerCase());
      extractedData.patternsFound.push('category');
    }
    if (categories.length > 0) {
      extractedData.categories = Array.from(new Set(categories as string[])); // Remove duplicatas
      extractedData.confidence += 15;
    }

    // Extrair descrição do contexto
    const cleanFilename = filename
      .replace(/[\d\.\/\-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleanFilename.length > 5) {
      extractedData.description = cleanFilename;
      extractedData.confidence += 10;
    }

    return extractedData;
  }

  private generateStructuredText(extractedData: any): string {
    const parts = [];

    if (extractedData.values && extractedData.values.length > 0) {
      parts.push(`Valor: ${extractedData.values[0].formatted}`);
    }

    if (extractedData.dates && extractedData.dates.length > 0) {
      parts.push(`Data: ${extractedData.dates[0].formatted}`);
    }

    if (extractedData.categories && extractedData.categories.length > 0) {
      parts.push(`Categoria: ${extractedData.categories.join(', ')}`);
    }

    if (extractedData.description) {
      parts.push(`Descrição: ${extractedData.description}`);
    }

    if (extractedData.documents && extractedData.documents.length > 0) {
      parts.push(`Documento: ${extractedData.documents[0].value}`);
    }

    return parts.join('\n') || 'Nenhum dado estruturado encontrado no nome do arquivo';
  }

  validate(result: OcrResult): boolean {
    // Filename analysis sempre "sucede" como fallback final
    return true;
  }

  getSuccessCriteria() {
    return {
      minCharacters: 0,
      minConfidence: 0
    };
  }
}