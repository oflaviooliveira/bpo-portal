/**
 * Analisador Específico para Notas Fiscais
 * Correção de Alta Prioridade: Identifica corretamente emitente vs destinatário
 */

export interface NotaFiscalData {
  emitente: {
    razaoSocial: string;
    cnpj: string;
    endereco?: string;
  };
  destinatario: {
    razaoSocial: string;
    cnpj: string;
    endereco?: string;
  };
  produtos: Array<{
    codigo: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorTotal: number;
  }>;
  valores: {
    totalProdutos: number;
    valorTotal: number;
    impostos?: number;
  };
  datas: {
    emissao: string;
    saida?: string;
  };
  numeroNota: string;
  serie?: string;
}

export class NotaFiscalAnalyzer {
  
  /**
   * Analisa nota fiscal e identifica corretamente emitente como fornecedor
   */
  static analyzeNotaFiscal(text: string): {
    fornecedor: string;
    fornecedorCnpj: string;
    cliente: string;
    clienteCnpj: string;
    descricao: string;
    valor: string;
    dataEmissao: string;
    numeroNota: string;
  } | null {
    
    const lines = text.split('\n');
    let emitente = { razao: '', cnpj: '' };
    let destinatario = { razao: '', cnpj: '' };
    let valores = { total: '' };
    let produtos: string[] = [];
    let dataEmissao = '';
    let numeroNota = '';
    
    // Identificar seções da nota fiscal
    let currentSection = '';
    let foundEmitente = false;
    let foundDestinatario = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const upperLine = line.toUpperCase();
      
      // Identificar número da nota
      if (upperLine.includes('Nº ') && !numeroNota) {
        const match = line.match(/Nº\s*(\d+)/);
        if (match) numeroNota = match[1];
      }
      
      // Identificar data de emissão
      if (upperLine.includes('DATA DE EMISSÃO') || upperLine.includes('EMISSÃO')) {
        if (i + 1 < lines.length) {
          const dateMatch = lines[i + 1].match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (dateMatch) dataEmissao = dateMatch[0];
        }
      }
      
      // Seção do emitente (início do documento, antes do destinatário)
      if (!foundDestinatario && !foundEmitente && line.length > 10 && 
          !upperLine.includes('DANFE') && !upperLine.includes('DOCUMENTO') &&
          !upperLine.includes('ENTRADA') && !upperLine.includes('SAÍDA')) {
        
        // Primeira empresa encontrada = emitente
        if (line.includes('/') && (line.includes('LTDA') || line.includes('S/A') || line.includes('ME'))) {
          emitente.razao = line.replace(/\s+/g, ' ').trim();
          foundEmitente = true;
          
          // Procurar CNPJ nas próximas linhas
          for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 10); j++) {
            const cnpjMatch = lines[j].match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
            if (cnpjMatch && !emitente.cnpj) {
              emitente.cnpj = cnpjMatch[1].replace(/[^\d]/g, '');
              break;
            }
          }
        }
      }
      
      // Seção destinatário/remetente
      if (upperLine.includes('DESTINATÁRIO') || upperLine.includes('REMETENTE')) {
        foundDestinatario = true;
        currentSection = 'destinatario';
      }
      
      if (foundDestinatario && currentSection === 'destinatario' && 
          line.length > 5 && 
          (line.includes('LTDA') || line.includes('S/A') || line.includes('ME'))) {
        destinatario.razao = line.replace(/\s+/g, ' ').trim();
        
        // Procurar CNPJ do destinatário nas próximas linhas  
        for (let j = i; j < Math.min(lines.length, i + 5); j++) {
          const cnpjMatch = lines[j].match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
          if (cnpjMatch && !destinatario.cnpj) {
            destinatario.cnpj = cnpjMatch[1].replace(/[^\d]/g, '');
            break;
          }
        }
      }
      
      // Produtos/serviços  
      if (upperLine.includes('DESCRIÇÃO') && upperLine.includes('PRODUTOS')) {
        currentSection = 'produtos';
      }
      
      if (currentSection === 'produtos' && line.length > 20 && 
          !upperLine.includes('CÓDIGO') && !upperLine.includes('DESCRIÇÃO') &&
          !upperLine.includes('TOTAL') && line.match(/\d/)) {
        // Extrair descrição do produto (geralmente após código)
        const produtoMatch = line.match(/\d+\s+(.+?)\s+\d+/);
        if (produtoMatch) {
          produtos.push(produtoMatch[1].trim());
        }
      }
      
      // Valor total da nota
      if (upperLine.includes('VALOR TOTAL DA NOTA') || 
          (upperLine.includes('TOTAL') && line.match(/R?\$?\s*[\d.,]+$/))) {
        const valorMatch = line.match(/R?\$?\s*([\d.,]+)$/);
        if (valorMatch) {
          valores.total = `R$ ${valorMatch[1]}`;
        }
      }
    }
    
    // Se não encontrou dados suficientes, retornar null
    if (!emitente.razao || !valores.total) {
      return null;
    }
    
    return {
      fornecedor: emitente.razao,
      fornecedorCnpj: emitente.cnpj,
      cliente: destinatario.razao,
      clienteCnpj: destinatario.cnpj,
      descricao: produtos.length > 0 ? produtos.join(', ') : 'Produtos/serviços conforme nota fiscal',
      valor: valores.total,
      dataEmissao,
      numeroNota
    };
  }
  
  /**
   * Valida se o texto parece ser uma nota fiscal
   */
  static isNotaFiscal(text: string): boolean {
    const upperText = text.toUpperCase();
    return upperText.includes('DANFE') || 
           upperText.includes('NOTA FISCAL ELETRÔNICA') ||
           (upperText.includes('DESTINATÁRIO') && upperText.includes('EMITENTE')) ||
           upperText.includes('CHAVE DE ACESSO');
  }
}