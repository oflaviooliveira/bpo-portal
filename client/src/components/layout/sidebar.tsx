import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Inbox, 
  Upload, 
  Calendar, 
  Scale, 
  FileText, 
  Archive, 
  Building, 
  Users, 
  Settings, 
  LogOut,
  Cpu,
  BarChart3
} from "lucide-react";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: any) => void;
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const { user, logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const menuItems = [
    {
      section: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      category: 'PRINCIPAL',
    },
    {
      section: 'inbox',
      label: 'Inbox',
      icon: Inbox,
      badge: '12',
      category: 'PRINCIPAL',
    },
    {
      section: 'upload',
      label: 'Upload Documentos',
      icon: Upload,
      category: 'PRINCIPAL',
    },
    {
      section: 'scheduled',
      label: 'Agendados',
      icon: Calendar,
      badge: '5',
      badgeColor: 'bg-orange-500',
      category: 'OPERAÇÕES',
    },
    {
      section: 'reconciliation',
      label: 'Conciliação',
      icon: Scale,
      category: 'OPERAÇÕES',
    },
    {
      section: 'emission',
      label: 'Emissão',
      icon: FileText,
      category: 'OPERAÇÕES',
    },
    {
      section: 'archived',
      label: 'Arquivados',
      icon: Archive,
      category: 'OPERAÇÕES',
    },
    {
      section: 'clients',
      label: 'Clientes',
      icon: Building,
      category: 'ADMINISTRAÇÃO',
    },
    {
      section: 'users',
      label: 'Usuários',
      icon: Users,
      category: 'ADMINISTRAÇÃO',
    },
    {
      section: 'ai-control',
      label: 'Centro de Controle IA',
      icon: Cpu,
      category: 'ADMINISTRAÇÃO',
    },

  ];

  const categories = ['PRINCIPAL', 'OPERAÇÕES', 'ADMINISTRAÇÃO'];

  return (
    <div className="bg-gquicks-secondary w-64 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gquicks-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-gilroy font-bold text-lg">G</span>
          </div>
          <span className="text-white font-gilroy font-bold text-xl">gquicks</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {categories.map((category) => (
          <div key={category}>
            <div className="text-gray-400 text-xs font-medium uppercase tracking-wide mb-4 mt-6 first:mt-0">
              {category}
            </div>
            
            {menuItems
              .filter((item) => item.category === category)
              .map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.section;
                
                return (
                  <button
                    key={item.section}
                    onClick={() => onSectionChange(item.section)}
                    className={cn(
                      "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-r from-gquicks-primary to-gquicks-primary/80 text-white shadow-lg shadow-gquicks-primary/30"
                        : "text-gray-300 hover:bg-gray-700 hover:text-white"
                    )}
                    data-testid={`sidebar-${item.section}`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className={cn(
                        "text-white text-xs rounded-full px-2 py-1 ml-auto",
                        item.badgeColor || "bg-gquicks-primary"
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        ))}

        {/* Settings */}
        <div className="pt-4 border-t border-gray-700 mt-6">
          <button
            onClick={() => onSectionChange('settings')}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span>Configurações</span>
          </button>
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gquicks-primary rounded-full flex items-center justify-center">
            <span className="text-white font-medium text-sm">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-gray-400 text-xs truncate capitalize">
              {user?.role?.toLowerCase()}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="text-gray-400 hover:text-white p-1 rounded transition-colors"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
