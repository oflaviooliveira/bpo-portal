import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { UploadBpo } from "@/components/documents/upload-bpo";
import { ClientDashboard } from "@/components/client/client-dashboard";
import { ClientDocuments } from "@/components/client/client-documents"; 
import { ClientReports } from "@/components/client/client-reports";
import { ClientSettings } from "@/components/client/client-settings";

// Componentes temporários para substituir os que faltam
const ClientFornecedores = () => (
  <div className="p-6">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-foreground mb-4">Fornecedores</h1>
      <p className="text-muted-foreground">Gestão de fornecedores em desenvolvimento...</p>
    </div>
  </div>
);

const ClientCategorias = () => (
  <div className="p-6">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-foreground mb-4">Categorias</h1>
      <p className="text-muted-foreground">Gestão de categorias em desenvolvimento...</p>
    </div>
  </div>
);

const ClientCentrosCusto = () => (
  <div className="p-6">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-foreground mb-4">Centros de Custo</h1>
      <p className="text-muted-foreground">Gestão de centros de custo em desenvolvimento...</p>
    </div>
  </div>
);

type ClientSection = 'dashboard' | 'upload' | 'documents' | 'fornecedores' | 'categorias' | 'centros-custo' | 'reports' | 'settings';

export function ClientLayout() {
  const [activeSection, setActiveSection] = useState<ClientSection>('dashboard');

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <ClientDashboard />;
      case 'upload':
        return (
          <div className="p-6">
            <UploadBpo />
          </div>
        );
      case 'documents':
        return <ClientDocuments />;
      case 'fornecedores':
        return <ClientFornecedores />;
      case 'categorias':
        return <ClientCategorias />;
      case 'centros-custo':
        return <ClientCentrosCusto />;
      case 'reports':
        return <ClientReports />;
      case 'settings':
        return <ClientSettings />;
      default:
        return <ClientDashboard />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background font-poppins">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header activeSection={activeSection} />
        
        <main className="flex-1 overflow-y-auto bg-muted">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}