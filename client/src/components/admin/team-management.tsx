import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { UserPlus, Users, Crown, Shield, Settings, Activity } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { NotificationDialog } from '@/components/ui/notification-dialog';

interface GquicksUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: 'ADMIN' | 'GERENTE' | 'OPERADOR';
  isActive: boolean;
  createdAt: string;
}

interface CreateUserForm {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  password: string;
  role: 'GERENTE' | 'OPERADOR';
}

export function TeamManagement() {
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<GquicksUser | null>(null);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [notificationData, setNotificationData] = useState({
    title: '',
    description: '',
    type: 'success' as 'success' | 'error' | 'warning' | 'info'
  });

  const [createForm, setCreateForm] = useState<CreateUserForm>({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    role: 'OPERADOR'
  });

  const queryClient = useQueryClient();

  const showNotification = (title: string, description: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setNotificationData({ title, description, type });
    setIsNotificationOpen(true);
  };

  // Query para listar usuários da equipe Gquicks
  const { data: gquicksUsers, isLoading } = useQuery({
    queryKey: ['/api/admin/users/global'],
    queryFn: async () => {
      const response = await fetch('/api/admin/users/global');
      if (!response.ok) throw new Error('Failed to fetch team');
      return await response.json() as GquicksUser[];
    }
  });

  // Mutation para criar usuário da equipe
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const response = await fetch('/api/admin/users/gquicks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create user');
      return response.json();
    },
    onSuccess: () => {
      showNotification(
        'Membro Adicionado!',
        'Novo colaborador foi adicionado à equipe operacional Gquicks.',
        'success'
      );
      setIsCreateUserOpen(false);
      setCreateForm({
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        password: '',
        role: 'OPERADOR'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/global'] });
    },
    onError: (error: any) => {
      showNotification(
        'Erro ao Criar Usuário',
        error.message || 'Não foi possível adicionar o membro à equipe.',
        'error'
      );
    }
  });

  // Mutation para toggle status
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const response = await fetch(`/api/admin/users/${userId}/toggle-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive })
      });
      if (!response.ok) throw new Error('Failed to toggle user status');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/global'] });
    }
  });

  const handleToggleUserStatus = (user: GquicksUser) => {
    const newStatus = !user.isActive;
    const action = newStatus ? 'ativar' : 'desativar';
    
    setSelectedUser(user);
    setConfirmAction(() => () => {
      toggleUserStatusMutation.mutate({
        userId: user.id,
        isActive: newStatus
      });
      setIsConfirmDialogOpen(false);
    });
    setIsConfirmDialogOpen(true);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-gquicks-primary hover:bg-gquicks-primary/80 text-white';
      case 'GERENTE': return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'OPERADOR': return 'bg-green-500 hover:bg-green-600 text-white';
      default: return 'bg-gray-500 hover:bg-gray-600 text-white';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN': return Crown;
      case 'GERENTE': return Shield;
      case 'OPERADOR': return Settings;
      default: return Users;
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-gquicks-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando equipe...</p>
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
          <h2 className="font-gilroy font-bold text-2xl text-foreground">Minha Equipe Operacional</h2>
          <p className="text-muted-foreground">Gerencie os colaboradores da Gquicks que operam a plataforma</p>
        </div>
        
        <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gquicks-primary hover:bg-gquicks-primary/90">
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Colaborador
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar à Equipe Gquicks</DialogTitle>
              <DialogDescription>
                Adicione um novo colaborador à equipe operacional
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="firstName">Nome</Label>
                  <Input
                    id="firstName"
                    value={createForm.firstName}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="João"
                  />
                </div>
                
                <div>
                  <Label htmlFor="lastName">Sobrenome</Label>
                  <Input
                    id="lastName"
                    value={createForm.lastName}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Silva"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="joao@gquicks.com"
                />
              </div>
              
              <div>
                <Label htmlFor="username">Usuário</Label>
                <Input
                  id="username"
                  value={createForm.username}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, username: e.target.value }))}
                  placeholder="joao.silva"
                />
              </div>
              
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
              
              <div>
                <Label htmlFor="role">Função</Label>
                <Select value={createForm.role} onValueChange={(value) => setCreateForm(prev => ({ ...prev, role: value as 'GERENTE' | 'OPERADOR' }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GERENTE">Gerente</SelectItem>
                    <SelectItem value="OPERADOR">Operador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={() => createUserMutation.mutate(createForm)}
                disabled={createUserMutation.isPending}
                className="w-full bg-gquicks-primary hover:bg-gquicks-primary/90"
              >
                {createUserMutation.isPending ? 'Adicionando...' : 'Adicionar à Equipe'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-gquicks-primary" />
              <div>
                <p className="text-sm font-medium">Total da Equipe</p>
                <p className="text-2xl font-bold">{gquicksUsers?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium">Admins</p>
                <p className="text-2xl font-bold">
                  {gquicksUsers?.filter(user => user.role === 'ADMIN').length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Gerentes</p>
                <p className="text-2xl font-bold">
                  {gquicksUsers?.filter(user => user.role === 'GERENTE').length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Operadores</p>
                <p className="text-2xl font-bold">
                  {gquicksUsers?.filter(user => user.role === 'OPERADOR').length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Table */}
      <Card>
        <CardHeader>
          <CardTitle>Equipe Operacional Gquicks</CardTitle>
          <CardDescription>
            Colaboradores internos responsáveis pela operação da plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gquicksUsers?.map((user) => {
                const RoleIcon = getRoleIcon(user.role);
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${user.role === 'ADMIN' ? 'bg-gquicks-primary/10' : 'bg-gray-100'}`}>
                          <RoleIcon className={`w-4 h-4 ${user.role === 'ADMIN' ? 'text-gquicks-primary' : 'text-gray-600'}`} />
                        </div>
                        <div>
                          <p className="font-medium">{user.firstName} {user.lastName}</p>
                          <p className="text-sm text-muted-foreground">@{user.username}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={user.isActive}
                          onCheckedChange={() => handleToggleUserStatus(user)}
                          disabled={user.role === 'ADMIN'} // CEO não pode ser desativado
                        />
                        <span className={`text-sm ${user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                          {user.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {user.role === 'ADMIN' && (
                          <Badge variant="outline" className="text-gquicks-primary border-gquicks-primary">
                            CEO & Fundador
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Confirmação */}
      <ConfirmDialog
        isOpen={isConfirmDialogOpen}
        onClose={() => setIsConfirmDialogOpen(false)}
        onConfirm={confirmAction}
        title={`${selectedUser?.isActive ? 'Desativar' : 'Ativar'} Colaborador`}
        description={`Tem certeza que deseja ${selectedUser?.isActive ? 'desativar' : 'ativar'} o colaborador ${selectedUser?.firstName} ${selectedUser?.lastName}?`}
        confirmText={selectedUser?.isActive ? 'Desativar' : 'Ativar'}
        variant={selectedUser?.isActive ? 'destructive' : 'default'}
        loading={toggleUserStatusMutation.isPending}
      />

      {/* Modal de Notificação */}
      <NotificationDialog
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        title={notificationData.title}
        description={notificationData.description}
        type={notificationData.type}
      />
    </div>
  );
}