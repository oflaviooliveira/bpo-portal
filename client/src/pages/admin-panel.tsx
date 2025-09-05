import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  BarChart3, 
  Settings, 
  Users2, 
  Shield,
  AlertTriangle,
  Home
} from 'lucide-react';
import { Link } from 'wouter';
import { AdvancedDashboard } from '@/components/admin/advanced-dashboard';
import { ClientManagement } from '@/components/admin/client-management';

interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  isActive: boolean;
}

export default function AdminPanel() {
  const [selectedTab, setSelectedTab] = useState('dashboard');

  // Verificar se o usuário atual é admin global
  const { data: currentUser, isLoading: isLoadingUser } = useQuery({
    queryKey: ['/api/user'],
    queryFn: async () => {
      const response = await fetch('/api/user');
      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }
      return await response.json() as User;
    }
  });

  // Verificar se é admin global (tenant especial 00000000-0000-0000-0000-000000000001)
  const isGlobalAdmin = currentUser?.tenantId === '00000000-0000-0000-0000-000000000001' && 
                       currentUser?.role === 'ADMIN';

  if (isLoadingUser) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-gquicks-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!isGlobalAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-6 w-6 text-red-500" />
              <CardTitle>Acesso Negado</CardTitle>
            </div>
            <CardDescription>
              Você não tem permissão para acessar o painel administrativo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                Esta área é restrita para administradores globais do sistema.
                Entre em contato com o administrador se você acredita que deveria ter acesso.
              </AlertDescription>
            </Alert>
            
            <div className="mt-6">
              <Link href="/">
                <Button className="w-full">
                  <Home className="w-4 h-4 mr-2" />
                  Voltar ao Início
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-white dark:bg-gray-900">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gquicks-primary rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-gilroy font-bold text-xl">Portal Administrativo</h1>
                  <p className="text-sm text-muted-foreground">Gerenciamento Global do Sistema</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-gquicks-primary/10 text-gquicks-primary">
                Administrador Global
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-muted-foreground">
                Conectado como: <span className="font-medium">{currentUser?.firstName} {currentUser?.lastName}</span>
              </div>
              <Link href="/">
                <Button variant="outline" size="sm">
                  <Home className="w-4 h-4 mr-2" />
                  Portal Principal
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="dashboard" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="tenants" className="flex items-center space-x-2">
              <Building2 className="w-4 h-4" />
              <span>Clientes</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center space-x-2">
              <Users2 className="w-4 h-4" />
              <span>Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Configurações</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <AdvancedDashboard />
          </TabsContent>

          <TabsContent value="tenants">
            <ClientManagement />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gerenciamento de Usuários</CardTitle>
                <CardDescription>
                  Gerencie usuários globalmente através dos clientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <Users2 className="h-4 w-4" />
                  <AlertDescription>
                    O gerenciamento de usuários está disponível na aba "Clientes". 
                    Selecione um cliente para ver e gerenciar seus usuários.
                  </AlertDescription>
                </Alert>
                
                <div className="mt-4">
                  <Button 
                    onClick={() => setSelectedTab('tenants')}
                    className="bg-gquicks-primary hover:bg-gquicks-primary/90"
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    Ir para Gerenciamento de Clientes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Configurações do Sistema</CardTitle>
                <CardDescription>
                  Configurações globais e administração do sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <Alert>
                    <Settings className="h-4 w-4" />
                    <AlertDescription>
                      Funcionalidades de configuração serão implementadas em versões futuras.
                      Atualmente, todas as configurações são feitas através do código.
                    </AlertDescription>
                  </Alert>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Configuração de IA</CardTitle>
                        <CardDescription>Acesse o centro de controle de IA</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Link href="/ai-control">
                          <Button variant="outline" className="w-full">
                            <Settings className="w-4 h-4 mr-2" />
                            Centro de Controle IA
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Backup e Logs</CardTitle>
                        <CardDescription>Monitoramento e manutenção</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Funcionalidades de backup e visualização de logs serão implementadas em breve.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}