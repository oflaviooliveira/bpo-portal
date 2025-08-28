import { useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Inbox } from "@/components/documents/inbox";
import { UploadEnhanced } from "@/components/documents/upload-enhanced";
import { Scheduled } from "@/components/documents/scheduled";
import { Reconciliation } from "@/components/documents/reconciliation";
import { Emission } from "@/components/documents/emission";
import { Archived } from "@/components/documents/archived";
import AIControlUnified from "@/pages/ai-control-unified";
import { AIDashboard } from "@/pages/ai-dashboard";

type Section = 'dashboard' | 'inbox' | 'upload' | 'scheduled' | 'reconciliation' | 'emission' | 'archived' | 'clients' | 'users' | 'ai-control' | 'ai-dashboard';

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
            <UploadEnhanced />
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
        return (
          <div className="p-6">
            <h2 className="font-gilroy font-bold text-2xl text-foreground mb-4">Clientes</h2>
            <p className="text-muted-foreground">Funcionalidade em desenvolvimento</p>
          </div>
        );
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
            <AIControlUnified />
          </div>
        );
      case 'ai-dashboard':
        return (
          <div className="p-6">
            <AIDashboard />
          </div>
        );
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
