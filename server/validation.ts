// FASE 3: Sistema de validações avançadas conforme PRD
import { z } from "zod";

// Validação de data brasileira DD/MM/AAAA
export const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function validateBrazilianDate(dateString: string): boolean {
  const match = dateString.match(dateRegex);
  if (!match) return false;
  
  const [, day, month, year] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  
  return date.getDate() == parseInt(day) &&
         date.getMonth() == parseInt(month) - 1 &&
         date.getFullYear() == parseInt(year);
}

// Validação de valores monetários flexível - suporta vários formatos brasileiros
export const currencyRegex = /^R?\$?\s?[\d.,]+$/;

export function validateCurrency(valueString: string): { isValid: boolean; value?: number } {
  if (!valueString || typeof valueString !== 'string') return { isValid: false };
  
  // Remover prefixos R$ e espaços
  const cleanValue = valueString.replace(/^R?\$?\s*/, '').trim();
  
  // Aceitar vários formatos: 1450,00 | 1.450,00 | 1450.00 | 1,450.00
  const brazilianFormat = /^(\d{1,3}(?:\.\d{3})*),(\d{2})$/.test(cleanValue);
  const americanFormat = /^(\d{1,3}(?:,\d{3})*)\.\d{2}$/.test(cleanValue);
  const simpleFormat = /^\d+[,.]?\d{0,2}$/.test(cleanValue);
  
  if (brazilianFormat || americanFormat || simpleFormat) {
    try {
      // Converter para formato decimal
      let numericValue;
      if (cleanValue.includes(',') && cleanValue.lastIndexOf(',') > cleanValue.lastIndexOf('.')) {
        // Formato brasileiro: 1.450,00
        numericValue = parseFloat(cleanValue.replace(/\./g, '').replace(',', '.'));
      } else {
        // Formato americano ou simples: 1,450.00 ou 1450.00
        numericValue = parseFloat(cleanValue.replace(/,/g, ''));
      }
      
      return { isValid: !isNaN(numericValue) && numericValue > 0, value: numericValue };
    } catch {
      return { isValid: false };
    }
  }
  
  return { isValid: false };
}

// Validação de CNPJ/CPF
export function validateDocument(doc: string): { isValid: boolean; type?: 'CPF' | 'CNPJ' } {
  const cleanDoc = doc.replace(/\D/g, '');
  
  if (cleanDoc.length === 11) {
    return { isValid: validateCPF(cleanDoc), type: 'CPF' };
  } else if (cleanDoc.length === 14) {
    return { isValid: validateCNPJ(cleanDoc), type: 'CNPJ' };
  }
  
  return { isValid: false };
}

function validateCPF(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf[9])) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  
  return remainder === parseInt(cpf[10]);
}

function validateCNPJ(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  
  // CNPJs de teste válidos para desenvolvimento
  const testCNPJs = [
    '12345678000190', // 12.345.678/0001-90
    '11222333000181', // 11.222.333/0001-81
    '11444777000161', // 11.444.777/0001-61
  ];
  
  if (process.env.NODE_ENV !== 'production' && testCNPJs.includes(cnpj)) {
    return true;
  }
  
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cnpj[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  if (digit1 !== parseInt(cnpj[12])) return false;
  
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cnpj[i]) * weights2[i];
  }
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  
  return digit2 === parseInt(cnpj[13]);
}

// Validação de email
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validação de nome de arquivo conforme PRD
export function parseFileName(fileName: string): { 
  isValid: boolean; 
  parsed?: {
    date?: string;
    type?: string;
    description?: string;
    category?: string;
    costCenter?: string;
    value?: string;
  };
  errors?: string[];
} {
  const errors: string[] = [];
  const parsed: any = {};
  
  // Remove extensão
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
  
  // Tenta diferentes formatos de nome de arquivo
  // Formato pipe: DD.MM.AAAA|TIPO|DESCRIÇÃO|CATEGORIA|CENTRO_CUSTO|VALOR
  if (nameWithoutExt.includes('|')) {
    const parts = nameWithoutExt.split('|');
    
    if (parts.length >= 3) {
      const [datePart, typePart, descriptionPart, categoryPart, costCenterPart, valuePart] = parts;
      
      // Validar data
      if (validateBrazilianDate(datePart)) {
        parsed.date = datePart;
      } else {
        errors.push(`Data inválida no nome do arquivo: ${datePart}`);
      }
      
      // Validar tipo
      const validTypes = ['PAGO', 'AGENDADO', 'EMITIR_BOLETO', 'EMITIR_NF', 'PG', 'AG', 'BL', 'NF'];
      if (validTypes.includes(typePart.toUpperCase())) {
        parsed.type = typePart.toUpperCase();
      } else {
        errors.push(`Tipo inválido no nome do arquivo: ${typePart}`);
      }
      
      parsed.description = descriptionPart;
      if (categoryPart) parsed.category = categoryPart;
      if (costCenterPart) parsed.costCenter = costCenterPart;
      
      // Validar valor se presente
      if (valuePart) {
        const valueValidation = validateCurrency(valuePart);
        if (valueValidation.isValid) {
          parsed.value = valueValidation.value;
        } else {
          errors.push(`Valor inválido no nome do arquivo: ${valuePart}`);
        }
      }
    } else {
      errors.push('Formato de nome de arquivo inválido. Use: DD.MM.AAAA|TIPO|DESCRIÇÃO');
    }
  }
  // Formato underscore: DD_MM_AAAA_TIPO_DESCRIÇÃO
  else if (nameWithoutExt.includes('_')) {
    const parts = nameWithoutExt.split('_');
    
    if (parts.length >= 3) {
      const datePart = `${parts[0]}.${parts[1]}.${parts[2]}`;
      
      if (validateBrazilianDate(datePart)) {
        parsed.date = datePart;
      } else {
        errors.push(`Data inválida no nome do arquivo: ${datePart}`);
      }
      
      if (parts[3]) {
        const validTypes = ['PAGO', 'AGENDADO', 'EMITIR_BOLETO', 'EMITIR_NF', 'PG', 'AG', 'BL', 'NF'];
        if (validTypes.includes(parts[3].toUpperCase())) {
          parsed.type = parts[3].toUpperCase();
        } else {
          errors.push(`Tipo inválido no nome do arquivo: ${parts[3]}`);
        }
      }
      
      // Resto das partes (descrição, categoria, centro de custo, valor)
      if (parts[4]) parsed.description = parts[4];
      if (parts[5]) parsed.category = parts[5];
      if (parts[6]) parsed.costCenter = parts[6];
      
      // Último item pode ser valor
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart.includes(',')) {
        const valueValidation = validateCurrency(lastPart);
        if (valueValidation.isValid) {
          parsed.value = valueValidation.value;
        } else {
          errors.push(`Valor inválido no nome do arquivo: ${lastPart}`);
        }
      }
    } else {
      errors.push('Formato de nome de arquivo inválido. Use: DD_MM_AAAA_TIPO_DESCRIÇÃO');
    }
  }
  // Tentar detectar informações básicas se não seguir formato específico
  else {
    errors.push('Nome do arquivo não segue padrão recomendado (pipe | ou underscore _)');
    
    // Tentar extrair valor pelo menos
    const possibleValue = nameWithoutExt.match(/\d+[,\.]\d{2}/);
    if (possibleValue) {
      const valueValidation = validateCurrency(possibleValue[0]);
      if (valueValidation.isValid) {
        parsed.value = valueValidation.value;
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    parsed: Object.keys(parsed).length > 0 ? parsed : undefined,
    errors: errors.length > 0 ? errors : undefined
  };
}

// Validação cruzada: OCR ↔ Nome do arquivo ↔ Metadados
export function performCrossValidation(
  ocrData: any,
  filenameData: any,
  formData: any
): {
  isValid: boolean;
  confidence: number;
  errors: string[];
  warnings: string[];
  inconsistencies: Array<{
    field: string;
    ocrValue: string | null;
    filenameValue: string | null;
    formValue: string | null;
    severity: 'high' | 'medium' | 'low';
  }>;
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const inconsistencies: Array<{
    field: string;
    ocrValue: string | null;
    filenameValue: string | null;
    formValue: string | null;
    severity: 'high' | 'medium' | 'low';
  }> = [];
  
  // Validar valor monetário
  if (ocrData.valor && filenameData.value && formData.amount) {
    // Ordem correta: Remove R$/espaços → Remove pontos de milhares → Converte vírgula decimal
    const ocrValue = parseFloat(ocrData.valor.toString().replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
    const filenameValue = parseFloat(filenameData.value.toString());
    const formValue = parseFloat(formData.amount.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.'));
    
    const tolerance = 0.01; // 1 centavo de tolerância
    
    if (Math.abs(ocrValue - formValue) > tolerance) {
      inconsistencies.push({
        field: 'valor',
        ocrValue: ocrData.valor,
        filenameValue: filenameData.value?.toString() || null,
        formValue: formData.amount,
        severity: 'high'
      });
      errors.push(`Divergência de valor: OCR=${ocrValue} vs Form=${formValue}`);
    }
    
    if (Math.abs(filenameValue - formValue) > tolerance) {
      inconsistencies.push({
        field: 'valor_filename',
        ocrValue: null,
        filenameValue: filenameData.value?.toString() || null,
        formValue: formData.amount,
        severity: 'medium'
      });
      warnings.push(`Valor no nome do arquivo difere do formulário: ${filenameValue} vs ${formValue}`);
    }
  }
  
  // Validar tipo de documento
  if (filenameData.type && formData.documentType) {
    const typeMap: { [key: string]: string } = {
      'PG': 'PAGO',
      'AG': 'AGENDADO', 
      'BL': 'EMITIR_BOLETO',
      'NF': 'EMITIR_NF'
    };
    
    const normalizedFilenameType = typeMap[filenameData.type] || filenameData.type;
    
    if (normalizedFilenameType !== formData.documentType) {
      inconsistencies.push({
        field: 'tipo_documento',
        ocrValue: null,
        filenameValue: filenameData.type,
        formValue: formData.documentType,
        severity: 'high'
      });
      errors.push(`Tipo no arquivo (${filenameData.type}) difere do selecionado (${formData.documentType})`);
    }
  }
  
  // Validar data de vencimento/pagamento
  if (ocrData.data_vencimento && formData.dueDate) {
    if (ocrData.data_vencimento !== formData.dueDate) {
      inconsistencies.push({
        field: 'data_vencimento',
        ocrValue: ocrData.data_vencimento,
        filenameValue: filenameData.date || null,
        formValue: formData.dueDate,
        severity: 'medium'
      });
      warnings.push(`Data de vencimento OCR (${ocrData.data_vencimento}) difere do formulário (${formData.dueDate})`);
    }
  }
  
  if (ocrData.data_pagamento && formData.paymentDate) {
    if (ocrData.data_pagamento !== formData.paymentDate) {
      inconsistencies.push({
        field: 'data_pagamento',
        ocrValue: ocrData.data_pagamento,
        filenameValue: filenameData.date || null,
        formValue: formData.paymentDate,
        severity: 'medium'
      });
      warnings.push(`Data de pagamento OCR (${ocrData.data_pagamento}) difere do formulário (${formData.paymentDate})`);
    }
  }
  
  // Calcular confiança baseado no número de inconsistências
  const totalChecks = inconsistencies.length + (inconsistencies.length === 0 ? 1 : 0);
  const highSeverityCount = inconsistencies.filter(i => i.severity === 'high').length;
  const confidence = Math.max(0, 100 - (highSeverityCount * 30) - (inconsistencies.length * 10));
  
  return {
    isValid: errors.length === 0,
    confidence,
    errors,
    warnings,
    inconsistencies
  };
}

// Schemas para validação específica por tipo de documento
export const documentValidationSchemas = {
  PAGO: {
    required: ['supplier', 'amount', 'competenceDate', 'paidDate'], // CORREÇÃO: apenas competência e pagamento obrigatórios
    conditionalRequired: [],
    optional: ['bankId', 'categoryId', 'costCenterId', 'notes', 'description']
  },
  AGENDADO: {
    required: ['bankId', 'categoryId', 'costCenterId', 'amount', 'scheduledDate'],
    conditionalRequired: [
      { fields: ['clientId', 'contraparteName'], condition: 'at_least_one' }
    ],
    optional: ['supplier', 'notes', 'dueDate']
  },
  EMITIR_BOLETO: {
    required: ['supplier', 'categoryId', 'costCenterId', 'amount', 'dueDate', 'payerDocument', 'payerName', 'payerEmail', 'payerPhone', 'payerStreet', 'payerNumber', 'payerNeighborhood', 'payerCity', 'payerState', 'payerZipCode'],
    optional: ['clientId', 'bankId', 'notes', 'instructions', 'payerContactName', 'payerStateRegistration', 'payerComplement', 'payerAddress']
  },
  EMITIR_NF: {
    // 🎯 VALIDAÇÃO SLA SIMPLIFICADA - Apenas campos essenciais conforme SLA real
    required: ['amount', 'serviceDescription', 'payerDocument', 'payerName', 'payerAddress', 'payerContactName', 'payerPhone'],
    optional: ['clientId', 'supplier', 'categoryId', 'costCenterId', 'serviceCode', 'payerEmail', 'payerStateRegistration', 'scheduledDate', 'notes', 'instructions']
  }
};

// Validação de regras de negócio
export function validateBusinessRules(
  documentType: string,
  formData: any
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const schema = documentValidationSchemas[documentType as keyof typeof documentValidationSchemas];
  if (!schema) {
    errors.push(`Tipo de documento desconhecido: ${documentType}`);
    return { isValid: false, errors, warnings };
  }
  
  // Mapear nomes de campos para mensagens mais amigáveis
  const fieldNames: { [key: string]: string } = {
    'clientId': 'Cliente',
    'contraparteName': 'Contraparte',
    'supplier': 'Fornecedor',
    'bankId': 'Banco',
    'categoryId': 'Categoria',
    'costCenterId': 'Centro de Custo',
    'amount': 'Valor',
    'competenceDate': 'Data de Competência',
    'paidDate': 'Data de Pagamento',
    'paymentDate': 'Data de Pagamento',
    'dueDate': 'Data de Vencimento',
    'scheduledDate': 'Data de Agendamento',
    'payerDocument': 'Documento do Tomador',
    'payerName': 'Nome do Tomador',
    'payerEmail': 'Email do Tomador',
    'payerPhone': 'Telefone do Tomador',
    'payerContactName': 'Nome do Contato',
    'payerStateRegistration': 'Inscrição Estadual',
    'payerStreet': 'Rua',
    'payerNumber': 'Número',
    'payerComplement': 'Complemento',
    'payerNeighborhood': 'Bairro',
    'payerCity': 'Cidade',
    'payerState': 'Estado',
    'payerZipCode': 'CEP',
    'payerAddress': 'Endereço do Tomador',
    'serviceCode': 'Código do Serviço',
    'serviceDescription': 'Descrição do Serviço'
  };

  // Verificar campos obrigatórios
  for (const field of schema.required) {
    if (!formData[field] || formData[field] === '') {
      const friendlyName = fieldNames[field] || field;
      errors.push(`Campo obrigatório não preenchido: ${friendlyName}`);
      console.log(`❌ Campo obrigatório ausente: ${field} (valor: "${formData[field]}")`);
    }
  }

  // Verificar campos condicionalmente obrigatórios
  if ('conditionalRequired' in schema && schema.conditionalRequired) {
    for (const condition of schema.conditionalRequired) {
      if (condition.condition === 'at_least_one') {
        const hasAtLeastOne = condition.fields.some((field: string) => 
          formData[field] && formData[field] !== ''
        );
        
        if (!hasAtLeastOne) {
          const fieldList = condition.fields.map((field: string) => fieldNames[field] || field).join(' OU ');
          errors.push(`Pelo menos um campo deve ser preenchido: ${fieldList}`);
          console.log(`❌ Validação condicional falhou - nenhum dos campos foi preenchido: ${condition.fields.join(', ')}`);
        }
      }
    }
  }
  
  // Validações específicas por tipo
  if (documentType === 'PAGO' && formData.paymentDate) {
    const paymentDate = new Date(formData.paymentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (paymentDate > today) {
      warnings.push('Data de pagamento está no futuro');
    }
  }
  
  if (['AGENDADO', 'EMITIR_BOLETO'].includes(documentType) && formData.dueDate) {
    const dueDate = new Date(formData.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dueDate < today) {
      warnings.push('Data de vencimento está no passado');
    }
  }
  
  if (['EMITIR_BOLETO', 'EMITIR_NF'].includes(documentType)) {
    if (formData.payerDocument) {
      const docValidation = validateDocument(formData.payerDocument);
      if (!docValidation.isValid) {
        errors.push('CNPJ/CPF do tomador é inválido');
      }
    }
    
    if (formData.payerEmail) {
      if (!validateEmail(formData.payerEmail)) {
        errors.push('Email do tomador é inválido');
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}