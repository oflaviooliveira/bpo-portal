import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain, TrendingUp, Lightbulb, ChevronRight, Target, Tag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Suggestion {
  id: string;
  type: 'category' | 'costCenter';
  value: string;
  confidence: number;
  reason: string;
  usageCount: number;
  lastUsed: string;
}

interface IntelligentSuggestionsProps {
  supplierName?: string;
  description?: string;
  amount?: string;
  onSuggestionSelect: (suggestion: Suggestion) => void;
  currentCategoryId?: string;
  currentCostCenterId?: string;
}

export function IntelligentSuggestions({ 
  supplierName, 
  description, 
  amount,
  onSuggestionSelect,
  currentCategoryId,
  currentCostCenterId
}: IntelligentSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Mock learning system - In production, this would call an API endpoint
  const generateSuggestions = () => {
    if (!supplierName && !description) return [];

    const mockSuggestions: Suggestion[] = [];

    // Category suggestions based on supplier/description patterns
    if (supplierName?.toLowerCase().includes('energia') || description?.toLowerCase().includes('energia')) {
      mockSuggestions.push({
        id: 'cat-energia',
        type: 'category',
        value: 'Energia Elétrica',
        confidence: 95,
        reason: 'Padrão histórico: 12 documentos similares categorizados como Energia Elétrica',
        usageCount: 12,
        lastUsed: '2024-01-15'
      });
    }

    if (supplierName?.toLowerCase().includes('tecnologia') || description?.toLowerCase().includes('software')) {
      mockSuggestions.push({
        id: 'cat-tech',
        type: 'category',
        value: 'Tecnologia da Informação',
        confidence: 88,
        reason: 'Fornecedor de TI: 8 compras anteriores categorizadas como TI',
        usageCount: 8,
        lastUsed: '2024-01-10'
      });
    }

    if (description?.toLowerCase().includes('limpeza') || supplierName?.toLowerCase().includes('limpeza')) {
      mockSuggestions.push({
        id: 'cat-limpeza',
        type: 'category',
        value: 'Serviços de Limpeza',
        confidence: 92,
        reason: 'Descrição indica serviços de limpeza: padrão em 15 documentos',
        usageCount: 15,
        lastUsed: '2024-01-12'
      });
    }

    // Cost center suggestions based on amount patterns
    if (amount) {
      const numAmount = parseFloat(amount.replace(/[^\d,.-]/g, '').replace(',', '.'));
      
      if (numAmount > 10000) {
        mockSuggestions.push({
          id: 'cc-diretoria',
          type: 'costCenter',
          value: 'Diretoria',
          confidence: 85,
          reason: 'Valor alto (>R$10k): histórico mostra aprovação pela Diretoria',
          usageCount: 6,
          lastUsed: '2024-01-08'
        });
      } else if (numAmount > 1000) {
        mockSuggestions.push({
          id: 'cc-operacional',
          type: 'costCenter',
          value: 'Operacional',
          confidence: 78,
          reason: 'Faixa de valor (R$1k-10k): geralmente alocado no Operacional',
          usageCount: 23,
          lastUsed: '2024-01-14'
        });
      }
    }

    // Generic suggestions for common patterns
    if (supplierName && !mockSuggestions.some(s => s.type === 'category')) {
      mockSuggestions.push({
        id: 'cat-generic',
        type: 'category',
        value: 'Despesas Gerais',
        confidence: 65,
        reason: 'Categoria mais utilizada para fornecedores similares',
        usageCount: 45,
        lastUsed: '2024-01-13'
      });
    }

    return mockSuggestions;
  };

  useEffect(() => {
    if (supplierName || description || amount) {
      setIsLoading(true);
      setTimeout(() => {
        setSuggestions(generateSuggestions());
        setIsLoading(false);
      }, 800); // Simulate API delay
    } else {
      setSuggestions([]);
    }
  }, [supplierName, description, amount]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "bg-green-100 text-green-800 border-green-200";
    if (confidence >= 75) return "bg-blue-100 text-blue-800 border-blue-200";
    if (confidence >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-gray-100 text-gray-800 border-gray-200";
  };

  const categorySuggestions = suggestions.filter(s => s.type === 'category');
  const costCenterSuggestions = suggestions.filter(s => s.type === 'costCenter');

  if (!suggestions.length && !isLoading) {
    return null;
  }

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-blue-900">
          <Brain className="h-5 w-5" />
          Sugestões Inteligentes
        </CardTitle>
        <CardDescription>
          Baseado nos seus padrões históricos de classificação
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            Analisando padrões...
          </div>
        )}

        {/* Category Suggestions */}
        {categorySuggestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Tag className="h-4 w-4" />
              Categorias sugeridas:
            </div>
            <div className="space-y-2">
              {categorySuggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className={cn(
                    "p-3 rounded-lg border bg-white transition-all cursor-pointer hover:shadow-sm",
                    currentCategoryId === suggestion.id ? "ring-2 ring-blue-500" : ""
                  )}
                  onClick={() => onSuggestionSelect(suggestion)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{suggestion.value}</span>
                        <Badge className={getConfidenceColor(suggestion.confidence)}>
                          {suggestion.confidence}%
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{suggestion.reason}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {suggestion.usageCount} usos
                    </div>
                    <div>
                      Último uso: {new Date(suggestion.lastUsed).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cost Center Suggestions */}
        {costCenterSuggestions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Target className="h-4 w-4" />
              Centros de custo sugeridos:
            </div>
            <div className="space-y-2">
              {costCenterSuggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className={cn(
                    "p-3 rounded-lg border bg-white transition-all cursor-pointer hover:shadow-sm",
                    currentCostCenterId === suggestion.id ? "ring-2 ring-blue-500" : ""
                  )}
                  onClick={() => onSuggestionSelect(suggestion)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{suggestion.value}</span>
                        <Badge className={getConfidenceColor(suggestion.confidence)}>
                          {suggestion.confidence}%
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{suggestion.reason}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>
                  
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {suggestion.usageCount} usos
                    </div>
                    <div>
                      Último uso: {new Date(suggestion.lastUsed).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Learning Info */}
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Sistema de Aprendizado:</strong> As sugestões melhoram conforme você classifica mais documentos. 
            O sistema aprende com seus padrões específicos de negócio.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}