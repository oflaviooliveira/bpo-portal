/**
 * Formulário BPO Inteligente
 * Melhoria de Alta Prioridade #3: Campos condicionais baseados no tipo de documento
 */

import React, { useMemo } from "react";
import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Info, Calendar, DollarSign, FileText, Building } from "lucide-react";

interface SmartBpoFormProps {
  form: UseFormReturn<any>;
  documentType: string;
  categories: any[];
  costCenters: any[];
  banks: any[];
}

interface FieldConfig {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'textarea' | 'select';
  required: boolean;
  placeholder?: string;
  description?: string;
  icon?: React.ReactNode;
  options?: any[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: RegExp;
  };
}

export function SmartBpoForm({ form, documentType, categories, costCenters, banks }: SmartBpoFormProps) {
  
  const fieldConfigs = useMemo(() => getFieldConfigsForDocumentType(documentType), [documentType]);
  const { mandatoryFields, optionalFields, specificFields } = fieldConfigs;

  return (
    <div className="space-y-6">
      
      {/* Contexto do Tipo de Documento */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {getDocumentTypeDescription(documentType)}
        </AlertDescription>
      </Alert>

      {/* Campos Obrigatórios BPO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Campos Obrigatórios BPO
            <Badge variant="destructive">Obrigatório</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mandatoryFields.map((field) => (
              <FormField key={field.name} field={field} form={form} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Campos Específicos por Tipo */}
      {specificFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Campos Específicos - {documentType}
              <Badge variant="secondary">Condicional</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {specificFields.map((field) => (
                <FormField key={field.name} field={field} form={form} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campos Opcionais */}
      {optionalFields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Informações Complementares
              <Badge variant="outline">Opcional</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {optionalFields.map((field) => (
                <FormField key={field.name} field={field} form={form} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dicas e Validações */}
      <ValidationStatus form={form} documentType={documentType} />
    </div>
  );
}

function FormField({ field, form }: { field: FieldConfig; form: UseFormReturn<any> }) {
  const error = form.formState.errors[field.name];
  
  return (
    <div className="space-y-2">
      <Label htmlFor={field.name} className="flex items-center gap-2">
        {field.icon}
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
      </Label>
      
      {field.description && (
        <p className="text-sm text-gray-600">{field.description}</p>
      )}
      
      {renderFieldInput(field, form)}
      
      {error && (
        <p className="text-sm text-red-600">{(error as any)?.message || 'Erro de validação'}</p>
      )}
    </div>
  );
}

function renderFieldInput(field: FieldConfig, form: UseFormReturn<any>) {
  const { register, setValue, watch } = form;
  const value = watch(field.name);

  switch (field.type) {
    case 'select':
      return (
        <Select 
          value={value} 
          onValueChange={(val) => setValue(field.name, val)}
        >
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      
    case 'textarea':
      return (
        <Textarea
          {...register(field.name)}
          placeholder={field.placeholder}
          className="min-h-[80px]"
        />
      );
      
    case 'date':
      return (
        <Input
          {...register(field.name)}
          type="date"
          placeholder={field.placeholder}
        />
      );
      
    case 'number':
      return (
        <Input
          {...register(field.name)}
          type="number"
          step="0.01"
          placeholder={field.placeholder}
        />
      );
      
    default:
      return (
        <Input
          {...register(field.name)}
          placeholder={field.placeholder}
        />
      );
  }
}

function ValidationStatus({ form, documentType }: { form: UseFormReturn<any>; documentType: string }) {
  const errors = form.formState.errors;
  const values = form.watch();
  
  const validations = getValidationsForDocumentType(documentType, values);
  const hasErrors = Object.keys(errors).length > 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Status de Validação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {validations.map((validation, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${validation.isValid ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className={`text-sm ${validation.isValid ? 'text-green-700' : 'text-red-700'}`}>
                {validation.message}
              </span>
            </div>
          ))}
          
          {!hasErrors && validations.every(v => v.isValid) && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-green-700">
                Todos os campos obrigatórios estão preenchidos e validados!
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Configurações por tipo de documento
function getFieldConfigsForDocumentType(documentType: string) {
  const baseFields: FieldConfig[] = [
    {
      name: 'competenceDate',
      label: 'Data de Competência',
      type: 'date' as const,
      required: true,
      description: 'Quando a despesa/receita pertence (competência contábil)',
      icon: <Calendar className="h-4 w-4" />
    },
    {
      name: 'amount',
      label: 'Valor',
      type: 'number' as const,
      required: true,
      placeholder: '0,00',
      icon: <DollarSign className="h-4 w-4" />
    },
    {
      name: 'description',
      label: 'Descrição',
      type: 'text' as const,
      required: true,
      placeholder: 'Descrição detalhada do documento'
    },
    {
      name: 'contraparteName',
      label: 'Contraparte',
      type: 'text' as const,
      required: true,
      placeholder: 'Nome da empresa/pessoa'
    }
  ];

  switch (documentType) {
    case 'PAGO':
      return {
        mandatoryFields: [
          ...baseFields,
          {
            name: 'competenceDate',
            label: 'Data de Competência',
            type: 'date' as const,
            required: true,
            description: 'Quando a despesa/receita pertence',
            icon: <Calendar className="h-4 w-4" />
          },
          {
            name: 'paidDate',
            label: 'Data de Pagamento',
            type: 'date' as const,
            required: true,
            description: 'Quando o pagamento foi efetuado',
            icon: <Calendar className="h-4 w-4" />
          }
        ],
        specificFields: [],
        optionalFields: [
          {
            name: 'notes',
            label: 'Observações',
            type: 'textarea' as const,
            required: false,
            placeholder: 'Informações adicionais sobre o pagamento'
          }
        ]
      };

    case 'AGENDADO':
      return {
        mandatoryFields: [
          ...baseFields,
          {
            name: 'dueDate',
            label: 'Data de Vencimento',
            type: 'date',
            required: true,
            description: 'Quando o pagamento deve ser efetuado'
          }
        ],
        specificFields: [],
        optionalFields: [
          {
            name: 'paymentDate',
            label: 'Data de Pagamento',
            type: 'date',
            required: false,
            description: 'Deixar em branco - será preenchida após pagamento'
          },
          {
            name: 'notes',
            label: 'Observações',
            type: 'textarea',
            required: false,
            placeholder: 'Instruções especiais para pagamento'
          }
        ]
      };

    case 'EMITIR_BOLETO':
      return {
        mandatoryFields: [
          ...baseFields,
          {
            name: 'dueDate',
            label: 'Data de Vencimento',
            type: 'date',
            required: true,
            description: 'Vencimento do boleto a ser emitido'
          }
        ],
        specificFields: [
          {
            name: 'payerName',
            label: 'Nome do Pagador',
            type: 'text',
            required: true,
            placeholder: 'Nome completo do cliente'
          },
          {
            name: 'payerDocument',
            label: 'CPF/CNPJ do Pagador',
            type: 'text',
            required: true,
            placeholder: 'Documento do cliente'
          },
          {
            name: 'payerEmail',
            label: 'Email do Pagador',
            type: 'text',
            required: false,
            placeholder: 'email@cliente.com'
          },
          {
            name: 'instructions',
            label: 'Instruções do Boleto',
            type: 'textarea',
            required: false,
            placeholder: 'Instruções específicas para o boleto'
          }
        ],
        optionalFields: []
      };

    case 'EMITIR_NF':
      return {
        mandatoryFields: [
          ...baseFields,
          {
            name: 'serviceCode',
            label: 'Código do Serviço',
            type: 'text',
            required: true,
            placeholder: 'Código do serviço prestado'
          },
          {
            name: 'serviceDescription',
            label: 'Descrição do Serviço',
            type: 'textarea',
            required: true,
            placeholder: 'Descrição detalhada do serviço para NF'
          }
        ],
        specificFields: [
          {
            name: 'payerName',
            label: 'Nome do Tomador',
            type: 'text',
            required: true,
            placeholder: 'Razão social do tomador do serviço'
          },
          {
            name: 'payerDocument',
            label: 'CNPJ do Tomador',
            type: 'text',
            required: true,
            placeholder: 'CNPJ do tomador'
          },
          {
            name: 'payerAddress',
            label: 'Endereço do Tomador',
            type: 'text',
            required: false,
            placeholder: 'Endereço completo'
          }
        ],
        optionalFields: []
      };

    default:
      return { mandatoryFields: baseFields, specificFields: [], optionalFields: [] };
  }
}

function getDocumentTypeDescription(documentType: string): string {
  const descriptions = {
    'PAGO': 'Documento já pago que precisa ser conciliado no sistema financeiro.',
    'AGENDADO': 'Documento para pagamento futuro que será incluído na agenda financeira.',
    'EMITIR_BOLETO': 'Solicitação para emissão de boleto bancário para cobrança.',
    'EMITIR_NF': 'Solicitação para emissão de nota fiscal de serviços prestados.'
  };
  
  return descriptions[documentType as keyof typeof descriptions] || 'Documento para processamento financeiro.';
}

function getValidationsForDocumentType(documentType: string, values: any) {
  const validations = [
    {
      isValid: !!values.competenceDate,
      message: 'Data de Competência preenchida'
    },
    {
      isValid: !!values.amount && parseFloat(values.amount) > 0,
      message: 'Valor válido informado'
    },
    {
      isValid: !!values.description && values.description.length > 5,
      message: 'Descrição adequada'
    },
    {
      isValid: !!values.contraparteName && values.contraparteName.length > 2,
      message: 'Contraparte identificada'
    }
  ];

  if (documentType === 'PAGO') {
    validations.push({
      isValid: !!values.paidDate,
      message: 'Data de Pagamento obrigatória para documentos pagos'
    });
  }

  if (documentType === 'EMITIR_BOLETO' || documentType === 'EMITIR_NF') {
    validations.push({
      isValid: !!values.payerName,
      message: 'Dados do pagador/tomador preenchidos'
    });
  }

  return validations;
}