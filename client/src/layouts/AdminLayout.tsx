import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Inbox } from "@/components/documents/inbox";
import { Scheduled } from "@/components/documents/scheduled";
import { Reconciliation } from "@/components/documents/reconciliation";
import { Archived } from "@/components/documents/archived";
import AIControlCenter from "@/pages/ai-control-center";
import { ClientManagement } from "@/components/admin/client-management";
import { TeamManagement } from "@/components/admin/team-management";
import { AdminDashboardSidebar } from "@/components/admin/admin-dashboard-sidebar";
import { AdminStatsSidebar } from "@/components/admin/admin-stats-sidebar";
import { Settings } from "@/components/settings/settings";

type AdminSection = 'dashboard' | 'inbox' | 'scheduled' | 'reconciliation' | 'archived' | 'clients' | 'team-management' | 'ai-control' | 'admin-dashboard' | 'admin-stats' | 'settings' | 'ocr-performance' | 'ai-analytics';

export function AdminLayout() {
  const [activeSection, setActiveSection] = useState<AdminSection>('dashboard');

  const renderContent = () => {
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
      case 'inbox':
        return <Inbox />;
      case 'scheduled':
        return <Scheduled />;
      case 'reconciliation':
        return <Reconciliation />;
      case 'archived':
        return <Archived />;
      case 'ocr-performance':
        return (
          <div className="p-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground mb-4">Performance OCR</h1>
              <p className="text-muted-foreground">Métricas e análise de performance do sistema OCR em desenvolvimento...</p>
            </div>
          </div>
        );
      case 'ai-analytics':
        return (
          <div className="p-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground mb-4">AI Analytics</h1>
              <p className="text-muted-foreground">Dashboard de analytics de IA em desenvolvimento...</p>
            </div>
          </div>
        );
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