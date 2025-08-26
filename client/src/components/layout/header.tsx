import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Bell } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  activeSection: string;
}

const sectionTitles: Record<string, string> = {
  dashboard: "Dashboard",
  inbox: "Inbox de Documentos",
  upload: "Upload de Documentos",
  scheduled: "Documentos Agendados",
  reconciliation: "Conciliação",
  emission: "Emissão",
  archived: "Arquivados",
  clients: "Clientes",
  users: "Usuários",
  settings: "Configurações",
};

export function Header({ activeSection }: HeaderProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  
  const title = sectionTitles[activeSection] || "Dashboard";

  return (
    <header className="bg-white border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-gilroy font-bold text-2xl text-foreground">
            {title}
          </h1>
          <p className="text-muted-foreground text-sm">
            Olá, {user?.firstName} {user?.lastName}, bem-vindo de volta!
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
