import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
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
  BarChart3,
  TrendingUp,
  Activity,
  Zap,
  Clock,
  RefreshCw
} from "lucide-react";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: any) => void;
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  const { user, logoutMutation } = useAuth();
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Verificar papel do usuário
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isClientUser = user?.role === 'CLIENT_USER';

  // Carregar logo da empresa das configurações
  useEffect(() => {
    const savedLogo = localStorage.getItem('company-logo');
    if (savedLogo) {
      setCompanyLogo(savedLogo);
    }
  }, []);

  // Escutar mudanças no localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'company-logo') {
        const newLogo = e.newValue;
        setCompanyLogo(newLogo);
      }
    };

    const handleLogoUpdate = () => {
      const savedLogo = localStorage.getItem('company-logo');
      if (savedLogo) {
        setCompanyLogo(savedLogo);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('logo-updated', handleLogoUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('logo-updated', handleLogoUpdate);
    };
  }, []);

  // Menus específicos por papel
  const superAdminMenuItems = [
    {
      section: 'dashboard',
      label: 'Visão Geral da Plataforma',
      icon: LayoutDashboard,
      category: 'PAINEL EXECUTIVO',
    },
    {
      section: 'clients',
      label: 'Portfólio de Clientes BPO',
      icon: Building,
      category: 'PAINEL EXECUTIVO',
    },
    {
      section: 'team-management',
      label: 'Minha Equipe Operacional',
      icon: Users,
      category: 'PAINEL EXECUTIVO',
    },
    {
      section: 'admin-dashboard',
      label: 'Analytics Executivo',
      icon: BarChart3,
      category: 'ANALYTICS',
    },
    {
      section: 'admin-stats',
      label: 'Relatórios da Plataforma',
      icon: TrendingUp,
      category: 'ANALYTICS',
    },
    {
      section: 'inbox',
      label: 'Inbox Operacional',
      icon: Inbox,
      category: 'OPERAÇÕES',
    },
    {
      section: 'scheduled',
      label: 'Agendamentos',
      icon: Calendar,
      category: 'OPERAÇÕES',
    },
    {
      section: 'reconciliation',
      label: 'Conciliação',
      icon: Scale,
      category: 'OPERAÇÕES',
    },
    {
      section: 'archived',
      label: 'Arquivados',
      icon: Archive,
      category: 'OPERAÇÕES',
    },
    {
      section: 'ocr-performance',
      label: 'Performance OCR',
      icon: Activity,
      category: 'MONITORAMENTO',
    },
    {
      section: 'ai-analytics',
      label: 'AI Analytics',
      icon: Zap,
      category: 'MONITORAMENTO',
    },
    {
      section: 'ai-control',
      label: 'Centro de Controle IA',
      icon: Cpu,
      category: 'CONFIGURAÇÕES',
    },
    {
      section: 'settings',
      label: 'Configurações',
      icon: Settings,
      category: 'CONFIGURAÇÕES',
    },
  ];

  const clientUserMenuItems = [
    {
      section: 'dashboard',
      label: 'Meu Painel',
      icon: LayoutDashboard,
      category: 'PRINCIPAL',
    },
    {
      section: 'upload',
      label: 'Enviar Documentos',
      icon: Upload,
      category: 'PRINCIPAL',
    },
    {
      section: 'documents',
      label: 'Meus Documentos',
      icon: FileText,
      category: 'PRINCIPAL',
    },
    {
      section: 'fornecedores',
      label: 'Fornecedores',
      icon: Building,
      category: 'CADASTROS',
    },
    {
      section: 'categorias',
      label: 'Categorias',
      icon: BarChart3,
      category: 'CADASTROS',
    },
    {
      section: 'centros-custo',
      label: 'Centros de Custo',
      icon: TrendingUp,
      category: 'CADASTROS',
    },
    {
      section: 'reports',
      label: 'Relatórios',
      icon: BarChart3,
      category: 'RELATÓRIOS',
    },
    {
      section: 'settings',
      label: 'Configurações',
      icon: Settings,
      category: 'CONFIGURAÇÕES',
    },
  ];

  const menuItems = isSuperAdmin ? superAdminMenuItems : clientUserMenuItems;

  const categories = isSuperAdmin 
    ? ['PAINEL EXECUTIVO', 'ANALYTICS', 'OPERAÇÕES', 'MONITORAMENTO', 'CONFIGURAÇÕES']
    : ['PRINCIPAL', 'CADASTROS', 'RELATÓRIOS', 'CONFIGURAÇÕES'];

  return (
    <div className="bg-gquicks-secondary w-64 flex flex-col">
      {/* Logo & CEO Status */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center mb-3">
          {companyLogo ? (
            <div className="flex items-center">
              <img 
                src={companyLogo} 
                alt="Logo Gquicks" 
                className="h-8 w-auto object-contain"
                style={{ maxWidth: '200px' }}
              />
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gquicks-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-gilroy font-bold text-lg">G</span>
              </div>
              <span className="text-white font-gilroy font-bold text-xl">gquicks</span>
            </div>
          )}
        </div>
        {isSuperAdmin && (
          <div className="bg-gradient-to-r from-gquicks-primary/20 to-purple-600/20 p-2 rounded-lg border border-gquicks-primary/30">
            <p className="text-xs text-gray-300 font-medium">CEO & Fundador</p>
            <p className="text-sm text-white font-semibold">Painel Executivo</p>
          </div>
        )}
        {isClientUser && (
          <div className="bg-gradient-to-r from-blue-500/20 to-green-600/20 p-2 rounded-lg border border-blue-500/30">
            <p className="text-xs text-gray-300 font-medium">Cliente BPO</p>
            <p className="text-sm text-white font-semibold">Painel Simplificado</p>
          </div>
        )}
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
                    {(item as any).badge && (
                      <span className={cn(
                        "text-white text-xs rounded-full px-2 py-1 ml-auto",
                        (item as any).badgeColor || "bg-gquicks-primary"
                      )}>
                        {(item as any).badge}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        ))}

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
