import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import type { Document } from '@shared/schema';

interface SharedDataContextType {
  // Dados compartilhados entre painéis
  documents: Document[];
  isLoadingDocuments: boolean;
  refreshDocuments: () => void;
  
  // Métrica compartilhadas
  totalDocuments: number;
  pendingDocuments: number;
  processedToday: number;
}

const SharedDataContext = createContext<SharedDataContextType | undefined>(undefined);

interface SharedDataProviderProps {
  children: ReactNode;
}

export function SharedDataProvider({ children }: SharedDataProviderProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query para documentos - se adapta ao role
  const { data: documents = [], isLoading: isLoadingDocuments } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    enabled: !!user,
    refetchInterval: 30000, // Refresh automático a cada 30s para manter sincronia
  });

  const refreshDocuments = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
  };

  // Métricas calculadas
  const totalDocuments = documents.length;
  const pendingDocuments = documents.filter(doc => 
    ['RECEBIDO', 'VALIDANDO', 'PENDENTE_REVISAO'].includes(doc.status)
  ).length;
  const processedToday = documents.filter(doc => {
    const today = new Date().toDateString();
    const docDate = new Date(doc.updatedAt || doc.createdAt).toDateString();
    return docDate === today && ['ARQUIVADO', 'PROCESSADO'].includes(doc.status);
  }).length;

  const value: SharedDataContextType = {
    documents,
    isLoadingDocuments,
    refreshDocuments,
    totalDocuments,
    pendingDocuments,
    processedToday,
  };

  return (
    <SharedDataContext.Provider value={value}>
      {children}
    </SharedDataContext.Provider>
  );
}

export function useSharedData() {
  const context = useContext(SharedDataContext);
  if (context === undefined) {
    throw new Error('useSharedData deve ser usado dentro de um SharedDataProvider');
  }
  return context;
}