// Utilitários para validação e formatação de documentos (CPF/CNPJ)

export type DocumentType = 'CPF' | 'CNPJ' | null;

/**
 * Remove formatação de um documento (mantém apenas dígitos)
 */
export function cleanDocument(document: string): string {
  return document.replace(/\D/g, '');
}

/**
 * Detecta automaticamente se um documento é CPF ou CNPJ
 */
export function detectDocumentType(document: string): DocumentType {
  const cleaned = cleanDocument(document);
  
  if (cleaned.length === 11) {
    return 'CPF';
  } else if (cleaned.length === 14) {
    return 'CNPJ';
  }
  
  return null;
}

/**
 * Formata um documento CPF ou CNPJ
 */
export function formatDocument(document: string, type?: DocumentType): string {
  const cleaned = cleanDocument(document);
  const detectedType = type || detectDocumentType(document);
  
  if (detectedType === 'CPF' && cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (detectedType === 'CNPJ' && cleaned.length === 14) {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  return document; // Retorna original se não conseguir formatar
}

/**
 * Valida CPF usando algoritmo da Receita Federal
 */
export function validateCPF(cpf: string): boolean {
  const cleaned = cleanDocument(cpf);
  
  if (cleaned.length !== 11) return false;
  
  // Elimina CPFs conhecidos como inválidos
  if (/^(\d)\1{10}$/.test(cleaned)) return false;
  
  // Valida primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i)) * (10 - i);
  }
  let remainder = sum % 11;
  let firstDigit = remainder < 2 ? 0 : 11 - remainder;
  
  if (parseInt(cleaned.charAt(9)) !== firstDigit) return false;
  
  // Valida segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i)) * (11 - i);
  }
  remainder = sum % 11;
  let secondDigit = remainder < 2 ? 0 : 11 - remainder;
  
  return parseInt(cleaned.charAt(10)) === secondDigit;
}

/**
 * Valida CNPJ usando algoritmo da Receita Federal
 */
export function validateCNPJ(cnpj: string): boolean {
  const cleaned = cleanDocument(cnpj);
  
  if (cleaned.length !== 14) return false;
  
  // Elimina CNPJs conhecidos como inválidos
  if (/^(\d)\1{13}$/.test(cleaned)) return false;
  
  // Valida primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i)) * weights1[i];
  }
  let remainder = sum % 11;
  let firstDigit = remainder < 2 ? 0 : 11 - remainder;
  
  if (parseInt(cleaned.charAt(12)) !== firstDigit) return false;
  
  // Valida segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned.charAt(i)) * weights2[i];
  }
  remainder = sum % 11;
  let secondDigit = remainder < 2 ? 0 : 11 - remainder;
  
  return parseInt(cleaned.charAt(13)) === secondDigit;
}

/**
 * Valida um documento (CPF ou CNPJ)
 */
export function validateDocument(document: string): boolean {
  const type = detectDocumentType(document);
  
  if (type === 'CPF') {
    return validateCPF(document);
  } else if (type === 'CNPJ') {
    return validateCNPJ(document);
  }
  
  return false;
}

/**
 * Extrai documentos de um texto usando regex
 */
export function extractDocumentsFromText(text: string): Array<{document: string, type: DocumentType, formatted: string}> {
  const documents: Array<{document: string, type: DocumentType, formatted: string}> = [];
  
  // Regex para CPF (com ou sem formatação)
  const cpfRegex = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
  const cpfMatches = text.match(cpfRegex) || [];
  
  // Regex para CNPJ (com ou sem formatação)
  const cnpjRegex = /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g;
  const cnpjMatches = text.match(cnpjRegex) || [];
  
  // Processar CPFs encontrados
  cpfMatches.forEach(match => {
    const cleaned = cleanDocument(match);
    if (cleaned.length === 11 && validateCPF(cleaned)) {
      documents.push({
        document: cleaned,
        type: 'CPF',
        formatted: formatDocument(cleaned, 'CPF')
      });
    }
  });
  
  // Processar CNPJs encontrados
  cnpjMatches.forEach(match => {
    const cleaned = cleanDocument(match);
    if (cleaned.length === 14 && validateCNPJ(cleaned)) {
      documents.push({
        document: cleaned,
        type: 'CNPJ',
        formatted: formatDocument(cleaned, 'CNPJ')
      });
    }
  });
  
  return documents;
}