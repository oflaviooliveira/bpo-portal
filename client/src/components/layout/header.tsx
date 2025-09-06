import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Bell, Crown } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  activeSection: string;
}

const sectionTitles: Record<string, string> = {
  dashboard: "Visão Geral da Plataforma",
  inbox: "Inbox de Documentos",
  upload: "Upload de Documentos",
  scheduled: "Documentos Agendados",
  reconciliation: "Conciliação",
  emission: "Emissão",
  archived: "Arquivados",
  clients: "Portfólio de Clientes BPO",
  "team-management": "Minha Equipe Operacional",
  settings: "Configurações",
  "admin-dashboard": "Analytics Executivo",
  "admin-stats": "Relatórios da Plataforma",
  "ai-control": "Centro de Controle IA",
};

export function Header({ activeSection }: HeaderProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  
  const title = sectionTitles[activeSection] || "Dashboard";
  const isGlobalAdmin = user?.tenantId === '00000000-0000-0000-0000-000000000001' && user?.role === 'ADMIN';

  return (
    <header className="bg-white border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="font-gilroy font-bold text-2xl text-foreground">
              {title}
            </h1>
            {isGlobalAdmin && (
              <div className="flex items-center space-x-2 bg-gradient-to-r from-gquicks-primary/10 to-purple-600/10 px-3 py-1 rounded-full border border-gquicks-primary/20">
                <Crown className="w-4 h-4 text-gquicks-primary" />
                <span className="text-xs font-semibold text-gquicks-primary">CEO</span>
              </div>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            {isGlobalAdmin ? 
              `Gestão executiva da plataforma Gquicks • ${user?.firstName} ${user?.lastName}` :
              `Olá, ${user?.firstName} ${user?.lastName}, bem-vindo de volta!`
            }
          </p>
        </div>

        <div className="flex items-center space-x-4">
          {/* Search */}
          <div className="relative">
            <Input
              type="text"
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-80 pl-4 pr-10"
              data-testid="input-search"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          </div>


          {/* Notifications */}
          <Button
            variant="ghost"
            size="sm"
            className="relative"
            data-testid="button-notifications"
          >
            <Bell className="w-5 h-5 text-gray-400" />
            <span className="absolute -top-1 -right-1 bg-gquicks-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              3
            </span>
          </Button>
        </div>
      </div>
    </header>
  );
}
