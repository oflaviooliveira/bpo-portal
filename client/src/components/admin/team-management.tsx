import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { UserPlus, Users, Crown, Shield, Settings, Activity, Edit, Key, Search, Filter } from 'lucide-react';
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
  updatedAt?: string;
}

interface EditUserForm {
  firstName: string;
  lastName: string;
  email: string;
  role: 'GERENTE' | 'OPERADOR';
}

interface ResetPasswordForm {
  newPassword: string;
  confirmPassword: string;
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
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<GquicksUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
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

  const [editForm, setEditForm] = useState<EditUserForm>({
    firstName: '',
    lastName: '',
    email: '',
    role: 'OPERADOR'
  });

  const [resetPasswordForm, setResetPasswordForm] = useState<ResetPasswordForm>({
    newPassword: '',
    confirmPassword: ''
  });

  const queryClient = useQueryClient();

  const showNotification = (title: string, description: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setNotificationData({ title, description, type });
    setIsNotificationOpen(true);
  };

  // Função para processar erros de validação do backend
  const parseValidationError = (error: any): string => {
    // Se o erro tem uma estrutura de validação do Zod
    if (error.message && error.message.includes('{"error":"Dados inválidos"')) {
      try {
        // Extrair o JSON do erro
        const errorMatch = error.message.match(/\{.*\}/);
        if (errorMatch) {
          const errorData = JSON.parse(errorMatch[0]);
          if (errorData.details && Array.isArray(errorData.details)) {
            // Mapear os erros para mensagens amigáveis
            const messages = errorData.details.map((detail: any) => {
              const field = detail.path?.[0] || 'campo';
              const fieldNameMap: { [key: string]: string } = {
                firstName: 'Nome',
                lastName: 'Sobrenome', 
                email: 'E-mail',
                username: 'Nome de usuário',
                password: 'Senha',
                role: 'Função',
                newPassword: 'Nova senha'
              };
              const fieldName = fieldNameMap[field] || field;
              
              return `${fieldName}: ${detail.message}`;
            });
            return messages.join('\n');
          }
        }
      } catch (e) {
        // Se não conseguir fazer o parse, usar a mensagem original
      }
    }
    
    // Fallback para outros tipos de erro
    return error.message || 'Erro desconhecido';
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
      const response = await apiRequest('POST', '/api/admin/users/gquicks', data);
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
      const errorMessage = parseValidationError(error);
      showNotification(
        'Erro ao Criar Usuário',
        errorMessage,
        'error'
      );
    }
  });

  // Mutation para toggle status
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: string; isActive: boolean }) => {
      const response = await apiRequest('PATCH', `/api/admin/users/${userId}/toggle-status`, { isActive });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/global'] });
    }
  });

  // Mutation para editar usuário
  const editUserMutation = useMutation({
    mutationFn: async (data: EditUserForm & { userId: string }) => {
      const { userId, ...updateData } = data;
      const response = await apiRequest('PUT', `/api/admin/users/${userId}`, updateData);
      return response.json();
    },
    onSuccess: () => {
      showNotification(
        'Colaborador Atualizado!',
        'As informações do colaborador foram atualizadas com sucesso.',
        'success'
      );
      setIsEditUserOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/global'] });
    },
    onError: (error: any) => {
      const errorMessage = parseValidationError(error);
      showNotification(
        'Erro ao Atualizar',
        errorMessage,
        'error'
      );
    }
  });

  // Mutation para reset de senha
  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { userId: string; newPassword: string }) => {
      const response = await apiRequest('POST', `/api/admin/users/${data.userId}/reset-password`, { newPassword: data.newPassword });
      return response.json();
    },
    onSuccess: () => {
      showNotification(
        'Senha Resetada!',
        'A nova senha foi definida com sucesso.',
        'success'
      );
      setIsResetPasswordOpen(false);
      setResetPasswordForm({ newPassword: '', confirmPassword: '' });
    },
    onError: (error: any) => {
      const errorMessage = parseValidationError(error);
      showNotification(
        'Erro ao Resetar Senha',
        errorMessage,
        'error'
      );
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

  const handleEditUser = (user: GquicksUser) => {
    setSelectedUser(user);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role as 'GERENTE' | 'OPERADOR'
    });
    setIsEditUserOpen(true);
  };

  const handleResetPassword = (user: GquicksUser) => {
    setSelectedUser(user);
    setResetPasswordForm({ newPassword: '', confirmPassword: '' });
    setIsResetPasswordOpen(true);
  };

  const handleEditSubmit = () => {
    if (selectedUser) {
      editUserMutation.mutate({
        userId: selectedUser.id,
        ...editForm
      });
    }
  };

  const handleResetPasswordSubmit = () => {
    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      showNotification('Erro', 'As senhas não coincidem', 'error');
      return;
    }

    if (resetPasswordForm.newPassword.length < 6) {
      showNotification('Erro', 'A senha deve ter pelo menos 6 caracteres', 'error');
      return;
    }

    if (selectedUser) {
      resetPasswordMutation.mutate({
        userId: selectedUser.id,
        newPassword: resetPasswordForm.newPassword
      });
    }
  };

  // Filtrar usuários por busca e função
  const filteredUsers = gquicksUsers?.filter(user => {
    const matchesSearch = 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  }) || [];

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

      {/* Controles de Busca e Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nome, email ou usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as Funções</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="GERENTE">Gerente</SelectItem>
                  <SelectItem value="OPERADOR">Operador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {filteredUsers.length !== gquicksUsers?.length && (
            <div className="mt-3 text-sm text-gray-600">
              Mostrando {filteredUsers.length} de {gquicksUsers?.length || 0} colaboradores
            </div>
          )}
        </CardContent>
      </Card>

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
              {filteredUsers.map((user) => {
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
                        {user.role === 'ADMIN' ? (
                          <Badge variant="outline" className="text-gquicks-primary border-gquicks-primary">
                            CEO & Fundador
                          </Badge>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditUser(user)}
                              className="h-8"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleResetPassword(user)}
                              className="h-8 text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white"
                            >
                              <Key className="w-3 h-3 mr-1" />
                              Reset
                            </Button>
                          </>
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

      {/* Modal de Edição de Usuário */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Colaborador</DialogTitle>
            <DialogDescription>
              Atualize as informações do colaborador {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="editFirstName">Nome</Label>
                <Input
                  id="editFirstName"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="João"
                />
              </div>
              
              <div>
                <Label htmlFor="editLastName">Sobrenome</Label>
                <Input
                  id="editLastName"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Silva"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="editEmail">E-mail</Label>
              <Input
                id="editEmail"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="joao@gquicks.com"
              />
            </div>
            
            <div>
              <Label htmlFor="editRole">Função</Label>
              <Select value={editForm.role} onValueChange={(value) => setEditForm(prev => ({ ...prev, role: value as 'GERENTE' | 'OPERADOR' }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GERENTE">Gerente</SelectItem>
                  <SelectItem value="OPERADOR">Operador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsEditUserOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleEditSubmit}
                disabled={editUserMutation.isPending}
                className="flex-1 bg-gquicks-primary hover:bg-gquicks-primary/90"
              >
                {editUserMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Reset de Senha */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resetar Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={resetPasswordForm.newPassword}
                onChange={(e) => setResetPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            
            <div>
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={resetPasswordForm.confirmPassword}
                onChange={(e) => setResetPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="••••••••"
              />
            </div>
            
            {resetPasswordForm.newPassword && resetPasswordForm.confirmPassword && 
             resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword && (
              <p className="text-sm text-red-600">As senhas não coincidem</p>
            )}
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setIsResetPasswordOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleResetPasswordSubmit}
                disabled={resetPasswordMutation.isPending || resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                {resetPasswordMutation.isPending ? 'Resetando...' : 'Resetar Senha'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}