import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Plus, Building2, Users, Settings, Eye, UserPlus, Calendar, TrendingUp, Activity } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    users: number;
    documents: number;
    contrapartes: number;
  };
}

interface TenantUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  tenantId?: string;
  tenantName?: string;
}

interface CreateTenantForm {
  name: string;
  slug: string;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminUsername: string;
  adminPassword: string;
}

interface CreateUserForm {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
  role: string;
}

export function ClientManagement() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [createForm, setCreateForm] = useState<CreateTenantForm>({
    name: '',
    slug: '',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminUsername: '',
    adminPassword: ''
  });
  const [createUserForm, setCreateUserForm] = useState<CreateUserForm>({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    role: 'OPERADOR'
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query para listar todos os usuários globalmente
  const { data: globalUsers, isLoading: isLoadingGlobalUsers } = useQuery({
    queryKey: ['/api/admin/users/global'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users/global');
      if (!response.ok) {
        throw new Error('Failed to fetch global users');
      }
      return await response.json() as TenantUser[];
    }
  });

  // Query para listar tenants
  const { data: tenants, isLoading: isLoadingTenants } = useQuery({
    queryKey: ['/api/admin/tenants'],
    queryFn: async () => {
      const response = await fetch('/api/admin/tenants');
      if (!response.ok) {
        throw new Error('Failed to fetch tenants');
      }
      return await response.json() as Tenant[];
    }
  });

  // Query para listar usuários do tenant selecionado
  const { data: tenantUsers, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['/api/admin/tenants', selectedTenant?.id, 'users'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/tenants/${selectedTenant?.id}/users`);
      if (!response.ok) {
        throw new Error('Failed to fetch tenant users');
      }
      return await response.json() as TenantUser[];
    },
    enabled: !!selectedTenant?.id
  });

  // Mutation para criar tenant
  const createTenantMutation = useMutation({
    mutationFn: async (data: CreateTenantForm) => 
      await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json()),
    onSuccess: () => {
      toast({
        title: "Cliente criado com sucesso",
        description: "O novo cliente foi criado e configurado automaticamente.",
      });
      setIsCreateModalOpen(false);
      setCreateForm({
        name: '',
        slug: '',
        adminFirstName: '',
        adminLastName: '',
        adminEmail: '',
        adminUsername: '',
        adminPassword: ''
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar cliente",
        description: error.message || "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    }
  });

  // Mutation para criar usuário
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => 
      await fetch(`/api/admin/tenants/${selectedTenant?.id}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      }).then(res => res.json()),
    onSuccess: () => {
      toast({
        title: "Usuário criado com sucesso",
        description: "O novo usuário foi adicionado ao cliente.",
      });
      setIsCreateUserModalOpen(false);
      setCreateUserForm({
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        password: '',
        role: 'OPERADOR'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants', selectedTenant?.id, 'users'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar usuário",
        description: error.message || "Verifique os dados e tente novamente",
        variant: "destructive",
      });
    }
  });

  // Mutation para ativar/desativar tenant
  const toggleTenantMutation = useMutation({
    mutationFn: async (data: { tenantId: string; isActive: boolean }) => 
      await fetch(`/api/admin/tenants/${data.tenantId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: data.isActive })
      }).then(res => res.json()),
    onSuccess: () => {
      toast({
        title: "Status atualizado",
        description: "O status do cliente foi alterado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/tenants'] });
    }
  });

  const handleCreateTenant = () => {
    createTenantMutation.mutate(createForm);
  };

  const handleCreateUser = () => {
    createUserMutation.mutate(createUserForm);
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .replace(/\s+/g, '-') // Espaços para hífens
      .replace(/-+/g, '-') // Múltiplos hífens para um
      .trim();
  };

  const handleNameChange = (name: string) => {
    setCreateForm(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }));
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-500 hover:bg-red-600';
      case 'GERENTE': return 'bg-blue-500 hover:bg-blue-600';
      case 'OPERADOR': return 'bg-green-500 hover:bg-green-600';
      case 'CLIENTE': return 'bg-purple-500 hover:bg-purple-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  if (isLoadingTenants) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-gquicks-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando clientes...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-gilroy font-bold text-2xl text-foreground">Gerenciamento de Clientes</h2>
          <p className="text-muted-foreground">Gerencie os clientes do BPO e seus usuários</p>
        </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gquicks-primary hover:bg-gquicks-primary/90" data-testid="button-create-client">
              <Plus className="w-4 h-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Novo Cliente</DialogTitle>
              <DialogDescription>
                Adicione um novo cliente BPO com configuração automática
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Empresa</Label>
                <Input
                  id="name"
                  value={createForm.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: ACME Logística Ltda"
                  data-testid="input-tenant-name"
                />
              </div>
              
              <div>
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={createForm.slug}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, slug: e.target.value }))}
                  placeholder="acme-logistica"
                  data-testid="input-tenant-slug"
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Administrador do Cliente</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="adminFirstName">Nome</Label>
                    <Input
                      id="adminFirstName"
                      value={createForm.adminFirstName}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, adminFirstName: e.target.value }))}
                      placeholder="João"
                      data-testid="input-admin-firstname"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="adminLastName">Sobrenome</Label>
                    <Input
                      id="adminLastName"
                      value={createForm.adminLastName}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, adminLastName: e.target.value }))}
                      placeholder="Silva"
                      data-testid="input-admin-lastname"
                    />
                  </div>
                </div>

                <div className="space-y-3 mt-3">
                  <div>
                    <Label htmlFor="adminEmail">Email</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      value={createForm.adminEmail}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, adminEmail: e.target.value }))}
                      placeholder="admin@acme.com.br"
                      data-testid="input-admin-email"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="adminUsername">Usuário</Label>
                    <Input
                      id="adminUsername"
                      value={createForm.adminUsername}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, adminUsername: e.target.value }))}
                      placeholder="admin.acme"
                      data-testid="input-admin-username"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="adminPassword">Senha</Label>
                    <Input
                      id="adminPassword"
                      type="password"
                      value={createForm.adminPassword}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, adminPassword: e.target.value }))}
                      placeholder="••••••••"
                      data-testid="input-admin-password"
                    />
                  </div>
                </div>
              </div>
              
              <Button 
                onClick={handleCreateTenant}
                disabled={createTenantMutation.isPending}
                className="w-full bg-gquicks-primary hover:bg-gquicks-primary/90"
                data-testid="button-confirm-create-client"
              >
                {createTenantMutation.isPending ? 'Criando...' : 'Criar Cliente'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-gquicks-primary" />
              <div>
                <p className="text-sm font-medium">Total de Clientes</p>
                <p className="text-2xl font-bold">{tenants?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Usuários Ativos</p>
                <p className="text-2xl font-bold">
                  {tenants?.reduce((total: number, tenant: Tenant) => total + (tenant._count?.users || 0), 0) || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Documentos Processados</p>
                <p className="text-2xl font-bold">
                  {tenants?.reduce((total: number, tenant: Tenant) => total + (tenant._count?.documents || 0), 0) || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Clientes Ativos</p>
                <p className="text-2xl font-bold">
                  {tenants?.filter((tenant: Tenant) => tenant.isActive).length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tenants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tenants">Clientes</TabsTrigger>
          <TabsTrigger value="users" disabled={!selectedTenant}>
            {selectedTenant ? `Usuários - ${selectedTenant.name}` : 'Usuários do Cliente'}
          </TabsTrigger>
          <TabsTrigger value="global-users">Usuários Globais</TabsTrigger>
          <TabsTrigger value="user-management">Gestão de Perfis</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lista de Clientes</CardTitle>
              <CardDescription>
                Gerencie todos os clientes do BPO
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usuários</TableHead>
                    <TableHead>Documentos</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants?.map((tenant: Tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{tenant.slug}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={tenant.isActive}
                            onCheckedChange={(checked) => 
                              toggleTenantMutation.mutate({ tenantId: tenant.id, isActive: checked })
                            }
                            data-testid={`switch-tenant-${tenant.id}`}
                          />
                          <span className={`text-sm ${tenant.isActive ? 'text-green-600' : 'text-red-600'}`}>
                            {tenant.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{tenant._count?.users || 0}</TableCell>
                      <TableCell>{tenant._count?.documents || 0}</TableCell>
                      <TableCell>{new Date(tenant.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedTenant(tenant);
                              // Automaticamente trocar para aba de usuários quando selecionar
                              const tabsElement = document.querySelector('[data-state="active"][value="tenants"]')?.closest('[role="tablist"]');
                              if (tabsElement) {
                                const usersTab = tabsElement.querySelector('[value="users"]') as HTMLElement;
                                usersTab?.click();
                              }
                            }}
                            data-testid={`button-view-users-${tenant.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Ver Usuários
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {selectedTenant && (
            <>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-gilroy font-bold text-xl">Usuários - {selectedTenant.name}</h3>
                  <p className="text-muted-foreground">Gerencie os usuários deste cliente</p>
                </div>
                
                <Dialog open={isCreateUserModalOpen} onOpenChange={setIsCreateUserModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gquicks-primary hover:bg-gquicks-primary/90" data-testid="button-create-user">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Novo Usuário
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Criar Novo Usuário</DialogTitle>
                      <DialogDescription>
                        Adicione um novo usuário para {selectedTenant.name}
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor="userFirstName">Nome</Label>
                          <Input
                            id="userFirstName"
                            value={createUserForm.firstName}
                            onChange={(e) => setCreateUserForm(prev => ({ ...prev, firstName: e.target.value }))}
                            placeholder="João"
                            data-testid="input-user-firstname"
                          />
                        </div>
                        
                        <div>
                          <Label htmlFor="userLastName">Sobrenome</Label>
                          <Input
                            id="userLastName"
                            value={createUserForm.lastName}
                            onChange={(e) => setCreateUserForm(prev => ({ ...prev, lastName: e.target.value }))}
                            placeholder="Silva"
                            data-testid="input-user-lastname"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="userEmail">Email</Label>
                        <Input
                          id="userEmail"
                          type="email"
                          value={createUserForm.email}
                          onChange={(e) => setCreateUserForm(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="joao@empresa.com"
                          data-testid="input-user-email"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="userUsername">Usuário</Label>
                        <Input
                          id="userUsername"
                          value={createUserForm.username}
                          onChange={(e) => setCreateUserForm(prev => ({ ...prev, username: e.target.value }))}
                          placeholder="joao.silva"
                          data-testid="input-user-username"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="userPassword">Senha</Label>
                        <Input
                          id="userPassword"
                          type="password"
                          value={createUserForm.password}
                          onChange={(e) => setCreateUserForm(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="••••••••"
                          data-testid="input-user-password"
                        />
                      </div>

                      <div>
                        <Label htmlFor="userRole">Função</Label>
                        <Select 
                          value={createUserForm.role} 
                          onValueChange={(value) => setCreateUserForm(prev => ({ ...prev, role: value }))}
                        >
                          <SelectTrigger data-testid="select-user-role">
                            <SelectValue placeholder="Selecione a função" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ADMIN">Administrador</SelectItem>
                            <SelectItem value="GERENTE">Gerente</SelectItem>
                            <SelectItem value="OPERADOR">Operador</SelectItem>
                            <SelectItem value="CLIENTE">Cliente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <Button 
                        onClick={handleCreateUser}
                        disabled={createUserMutation.isPending}
                        className="w-full bg-gquicks-primary hover:bg-gquicks-primary/90"
                        data-testid="button-confirm-create-user"
                      >
                        {createUserMutation.isPending ? 'Criando...' : 'Criar Usuário'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardContent className="p-0">
                  {isLoadingUsers ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <div className="animate-spin w-6 h-6 border-4 border-gquicks-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                        <p className="text-sm text-muted-foreground">Carregando usuários...</p>
                      </div>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Função</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Criado em</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tenantUsers?.map((user: TenantUser) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.firstName} {user.lastName}
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.username}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`text-white ${getRoleBadgeColor(user.role)}`}>
                                {user.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className={`text-sm ${user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                                {user.isActive ? 'Ativo' : 'Inativo'}
                              </span>
                            </TableCell>
                            <TableCell>
                              {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Aba de Usuários Globais */}
        <TabsContent value="global-users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Usuários Globais</CardTitle>
              <CardDescription>
                Visualize todos os usuários do sistema, independente do cliente
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingGlobalUsers ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="animate-spin w-6 h-6 border-4 border-gquicks-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-muted-foreground text-sm">Carregando usuários...</p>
                  </div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {globalUsers?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.firstName} {user.lastName}
                          <div className="text-sm text-muted-foreground">@{user.username}</div>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.tenantName || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-white ${getRoleBadgeColor(user.role)}`}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={`text-sm ${user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                            {user.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                        </TableCell>
                        <TableCell>{new Date(user.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => console.log('Editar usuário:', user.id)}
                              data-testid={`button-edit-user-${user.id}`}
                            >
                              <Settings className="w-4 h-4 mr-1" />
                              Editar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba de Gestão de Perfis */}
        <TabsContent value="user-management" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestão de Perfis de Usuários</CardTitle>
              <CardDescription>
                Funcionalidades avançadas para gerenciar usuários do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Reset de Senhas</h3>
                      <p className="text-sm text-muted-foreground">Redefinir senhas de usuários</p>
                      <Button size="sm" className="mt-2" variant="outline">
                        Gerenciar
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Settings className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Permissões</h3>
                      <p className="text-sm text-muted-foreground">Gerenciar papéis e acessos</p>
                      <Button size="sm" className="mt-2" variant="outline">
                        Configurar
                      </Button>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Activity className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Auditoria</h3>
                      <p className="text-sm text-muted-foreground">Logs de atividade dos usuários</p>
                      <Button size="sm" className="mt-2" variant="outline">
                        Visualizar
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-semibold text-sm text-muted-foreground mb-2">FUNCIONALIDADES EM DESENVOLVIMENTO</h4>
                <p className="text-sm text-muted-foreground">
                  As funcionalidades avançadas de gestão de usuários estão sendo implementadas. 
                  Em breve você terá acesso completo a reset de senhas, auditoria detalhada e controle granular de permissões.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}