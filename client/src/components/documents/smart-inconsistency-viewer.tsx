/**
 * Visualizador Inteligente de Inconsistências
 * Melhoria de Alta Prioridade: Interface compacta com recomendações contextuais
 */

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  CheckCircle2, 
  Brain, 
  FileText, 
  Eye, 
  Lightbulb,
  ArrowRight,
  Info
} from "lucide-react";

interface SmartRecommendation {
  recommendedValue: any;
  recommendedSource: {
    value: any;
    confidence: number;
    source: 'OCR' | 'AI' | 'FILENAME' | 'MANUAL';
    quality: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  reasoning: string;
  confidence: number;
  action: 'AUTO_ACCEPT' | 'SUGGEST_REVIEW' | 'MANUAL_REQUIRED';
}

interface InconsistencyItem {
  field: string;
  ocrValue?: string;
  aiValue?: string;
  filenameValue?: string;
  smartRecommendation?: SmartRecommendation;
  type: string;
  message: string;
  confidence?: number;
}

interface SmartInconsistencyViewerProps {
  inconsistencies: InconsistencyItem[];
  onApplyRecommendation: (field: string, value: any) => void;
  onResolveInconsistency: (field: string, selectedValue: any) => void;
}

export function SmartInconsistencyViewer({ 
  inconsistencies, 
  onApplyRecommendation, 
  onResolveInconsistency 
}: SmartInconsistencyViewerProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [resolvedItems, setResolvedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (field: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(field)) {
      newExpanded.delete(field);
    } else {
      newExpanded.add(field);
    }
    setExpandedItems(newExpanded);
  };

  const handleApplyRecommendation = (field: string, recommendation: SmartRecommendation) => {
    onApplyRecommendation(field, recommendation.recommendedValue);
    setResolvedItems(prev => new Set([...Array.from(prev), field]));
  };

  const handleSelectValue = (field: string, value: any) => {
    onResolveInconsistency(field, value);
    setResolvedItems(prev => new Set([...Array.from(prev), field]));
  };

  const highPriorityInconsistencies = inconsistencies.filter(inc => 
    inc.type.includes('INCONSISTENCIA') && !resolvedItems.has(inc.field)
  );

  const reviewSuggestions = inconsistencies.filter(inc => 
    inc.type.includes('REVISAO') && !resolvedItems.has(inc.field)
  );

  if (inconsistencies.length === 0) {
    return (
      <Alert>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription className="text-green-700">
          Nenhuma inconsistência detectada! Dados validados com sucesso.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      
      {/* Resumo Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Análise Inteligente de Inconsistências
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {highPriorityInconsistencies.length} Críticas
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Info className="h-3 w-3" />
              {reviewSuggestions.length} Para Revisão
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {Array.from(resolvedItems).length} Resolvidas
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Inconsistências Críticas */}
      {highPriorityInconsistencies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Inconsistências Críticas
              <Badge variant="destructive">Ação Necessária</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {highPriorityInconsistencies.map((inconsistency) => (
              <SmartInconsistencyCard
                key={inconsistency.field}
                inconsistency={inconsistency}
                isExpanded={expandedItems.has(inconsistency.field)}
                onToggleExpanded={() => toggleExpanded(inconsistency.field)}
                onApplyRecommendation={handleApplyRecommendation}
                onSelectValue={handleSelectValue}
                priority="high"
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Sugestões de Revisão */}
      {reviewSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <Lightbulb className="h-5 w-5" />
              Sugestões de Melhoria
              <Badge variant="secondary">Opcional</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reviewSuggestions.map((inconsistency) => (
              <SmartInconsistencyCard
                key={inconsistency.field}
                inconsistency={inconsistency}
                isExpanded={expandedItems.has(inconsistency.field)}
                onToggleExpanded={() => toggleExpanded(inconsistency.field)}
                onApplyRecommendation={handleApplyRecommendation}
                onSelectValue={handleSelectValue}
                priority="medium"
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface SmartInconsistencyCardProps {
  inconsistency: InconsistencyItem;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onApplyRecommendation: (field: string, recommendation: SmartRecommendation) => void;
  onSelectValue: (field: string, value: any) => void;
  priority: 'high' | 'medium' | 'low';
}

function SmartInconsistencyCard({ 
  inconsistency, 
  isExpanded, 
  onToggleExpanded, 
  onApplyRecommendation, 
  onSelectValue,
  priority 
}: SmartInconsistencyCardProps) {
  
  const { field, smartRecommendation } = inconsistency;
  const fieldLabel = getFieldLabel(field);
  
  return (
    <div className={`border rounded-lg p-3 ${priority === 'high' ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
      
      {/* Header compacto */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="font-medium">{fieldLabel}</span>
          {smartRecommendation && (
            <Badge variant={getActionBadgeVariant(smartRecommendation.action)}>
              {getActionLabel(smartRecommendation.action)}
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {smartRecommendation && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onApplyRecommendation(field, smartRecommendation)}
              className="flex items-center gap-1"
            >
              <Brain className="h-3 w-3" />
              Aplicar IA
            </Button>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggleExpanded}
          >
            {isExpanded ? <Eye className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {isExpanded ? 'Menos' : 'Mais'}
          </Button>
        </div>
      </div>

      {/* Recomendação rápida */}
      {smartRecommendation && !isExpanded && (
        <div className="mt-2 text-sm text-gray-600 flex items-center gap-1">
          <ArrowRight className="h-3 w-3" />
          <strong>Recomendado:</strong> {smartRecommendation.recommendedValue}
          <span className="text-gray-500">({smartRecommendation.confidence}% confiança)</span>
        </div>
      )}

      {/* Detalhes expandidos */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          
          {/* Explicação da IA */}
          {smartRecommendation && (
            <Alert>
              <Brain className="h-4 w-4" />
              <AlertDescription>
                <strong>Análise IA:</strong> {smartRecommendation.reasoning}
              </AlertDescription>
            </Alert>
          )}

          {/* Comparação de valores */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {inconsistency.ocrValue && (
              <ValueOption
                label="OCR"
                value={inconsistency.ocrValue}
                confidence={inconsistency.confidence}
                onSelect={() => onSelectValue(field, inconsistency.ocrValue)}
                isRecommended={smartRecommendation?.recommendedSource.source === 'OCR'}
              />
            )}
            
            {inconsistency.aiValue && (
              <ValueOption
                label="IA"
                value={inconsistency.aiValue}
                confidence={smartRecommendation?.confidence}
                onSelect={() => onSelectValue(field, inconsistency.aiValue)}
                isRecommended={smartRecommendation?.recommendedSource.source === 'AI'}
              />
            )}
            
            {inconsistency.filenameValue && (
              <ValueOption
                label="Arquivo"
                value={inconsistency.filenameValue}
                confidence={60}
                onSelect={() => onSelectValue(field, inconsistency.filenameValue)}
                isRecommended={smartRecommendation?.recommendedSource.source === 'FILENAME'}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ValueOption({ 
  label, 
  value, 
  confidence, 
  onSelect, 
  isRecommended 
}: {
  label: string;
  value: any;
  confidence?: number;
  onSelect: () => void;
  isRecommended: boolean;
}) {
  return (
    <div className={`border rounded p-2 ${isRecommended ? 'border-green-300 bg-green-50' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium">{label}</span>
        {isRecommended && <Badge variant="secondary" className="text-xs">Recomendado</Badge>}
      </div>
      
      <div className="text-sm font-mono mb-2">{value}</div>
      
      {confidence && (
        <div className="text-xs text-gray-500 mb-2">
          Confiança: {Math.round(confidence)}%
        </div>
      )}
      
      <Button
        size="sm"
        variant={isRecommended ? "default" : "outline"}
        className="w-full text-xs"
        onClick={onSelect}
      >
        Usar este valor
      </Button>
    </div>
  );
}

// Utilitários
function getFieldLabel(field: string): string {
  const labels: { [key: string]: string } = {
    'amount': 'Valor',
    'supplier': 'Fornecedor',
    'description': 'Descrição',
    'dueDate': 'Data Vencimento',
    'paymentDate': 'Data Pagamento'
  };
  
  return labels[field] || field;
}

function getActionLabel(action: string): string {
  const labels: { [key: string]: string } = {
    'AUTO_ACCEPT': 'Auto-aceitar',
    'SUGGEST_REVIEW': 'Revisar',
    'MANUAL_REQUIRED': 'Manual'
  };
  
  return labels[action] || action;
}

function getActionBadgeVariant(action: string) {
  switch (action) {
    case 'AUTO_ACCEPT': return 'default';
    case 'SUGGEST_REVIEW': return 'secondary';
    case 'MANUAL_REQUIRED': return 'destructive';
    default: return 'outline';
  }
}