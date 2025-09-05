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
import { AdminDashboardSidebar } from "@/components/admin/admin-dashboard-sidebar";
import { AdminStatsSidebar } from "@/components/admin/admin-stats-sidebar";

type Section = 'dashboard' | 'inbox' | 'upload' | 'scheduled' | 'reconciliation' | 'emission' | 'archived' | 'clients' | 'users' | 'ai-control' | 'admin-dashboard' | 'admin-stats';

export default function HomePage() {
  const [activeSection, setActiveSection] = useState<Section>('dashboard');

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return <Dashboard />;
      case 'inbox':
        return <Inbox />;
      case 'upload':
        return (
          <div className="p-6">
            <UploadBpo />
          </div>
        );
      case 'scheduled':
        return <Scheduled />;
      case 'reconciliation':
        return <Reconciliation />;
      case 'emission':
        return <Emission />;
      case 'archived':
        return <Archived />;
      case 'clients':
        return <ClientManagement />;
      case 'users':
        return (
          <div className="p-6">
            <h2 className="font-gilroy font-bold text-2xl text-foreground mb-4">Usuários</h2>
            <p className="text-muted-foreground">Funcionalidade em desenvolvimento</p>
          </div>
        );
      case 'ai-control':
        return (
          <div className="p-6">
            <AIControlCenter />
          </div>
        );
      case 'admin-dashboard':
        return <AdminDashboardSidebar />;
      case 'admin-stats':
        return <AdminStatsSidebar />;
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
