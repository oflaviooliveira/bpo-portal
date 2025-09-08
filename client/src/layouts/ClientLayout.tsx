import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { UploadBpo } from "@/components/documents/upload-bpo";
import { ClientDashboard } from "@/components/client/client-dashboard";
import { ClientDocuments } from "@/components/client/client-documents"; 
import { ClientReports } from "@/components/client/client-reports";
import { ClientSettings } from "@/components/client/client-settings";

import { ClientFornecedores } from "@/components/client/client-fornecedores";
import { ClientCategorias } from "@/components/client/client-categorias";
import { ClientCentrosCusto } from "@/components/client/client-centros-custo";
import ClientsPage from "@/pages/clients";

type ClientSection = 'dashboard' | 'upload' | 'documents' | 'clients' | 'fornecedores' | 'categorias' | 'centros-custo' | 'reports' | 'settings';

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
      case 'clients':
        return <ClientsPage />;
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