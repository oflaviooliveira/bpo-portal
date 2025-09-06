import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Inbox } from "@/components/documents/inbox";
import { UploadBpo } from "@/components/documents/upload-bpo";
import { Scheduled } from "@/components/documents/scheduled";
import { Reconciliation } from "@/components/documents/reconciliation";
import { Emission } from "@/components/documents/emission";
import { Archived } from "@/components/documents/archived";
import AIControlCenter from "@/pages/ai-control-center";
import { ClientManagement } from "@/components/admin/client-management";
import { TeamManagement } from "@/components/admin/team-management";
import { AdminDashboardSidebar } from "@/components/admin/admin-dashboard-sidebar";
import { AdminStatsSidebar } from "@/components/admin/admin-stats-sidebar";
import { Settings } from "@/components/settings/settings";
import { useAuth } from "@/hooks/use-auth";
import { ClientDashboard } from "@/components/client/client-dashboard";
import { ClientDocuments } from "@/components/client/client-documents"; 
import { ClientReports } from "@/components/client/client-reports";
import { ClientSettings } from "@/components/client/client-settings";
import { ClientFornecedores } from "@/components/client/client-fornecedores";
import { ClientCategorias } from "@/components/client/client-categorias";
import { ClientCentrosCusto } from "@/components/client/client-centros-custo";

type Section = 'dashboard' | 'inbox' | 'upload' | 'scheduled' | 'reconciliation' | 'emission' | 'archived' | 'clients' | 'team-management' | 'ai-control' | 'admin-dashboard' | 'admin-stats' | 'settings' | 'documents' | 'reports' | 'fornecedores' | 'categorias' | 'centros-custo';

export default function HomePage() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>('dashboard');
  
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isClientUser = user?.role === 'CLIENT_USER';

  const renderContent = () => {
    // Para CLIENT_USER - interface simplificada
    if (isClientUser) {
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
    }

    // Para SUPER_ADMIN - interface completa
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard />;
      case 'clients':
        return <ClientManagement />;
      case 'team-management':
        return <TeamManagement />;
      case 'admin-dashboard':
        return <AdminDashboardSidebar />;
      case 'admin-stats':
        return <AdminStatsSidebar />;
      case 'ai-control':
        return (
          <div className="p-6">
            <AIControlCenter />
          </div>
        );
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard />;
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
