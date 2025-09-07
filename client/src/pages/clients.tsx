import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Users, Plus, Search, Building2, Phone, Mail, FileText } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Cliente {
  id: string;
  name: string;
  document?: string;
  documentType?: string;
  email?: string;
  phone?: string;
  contactName?: string;
  stateRegistration?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  isActive: boolean;
  createdAt: string;
}

interface ClientForm {
  name: string;
  document: string;
  documentType: 'CPF' | 'CNPJ';
  email: string;
  phone: string;
  contactName: string;
  stateRegistration: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export default function ClientsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState<ClientForm>({
    name: '',
    document: '',
    documentType: 'CNPJ',
    email: '',
    phone: '',
    contactName: '',
    stateRegistration: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zipCode: ''
  });

  // Query para buscar clientes
  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['/api/clientes'],
    queryFn: async () => {
      const response = await fetch('/api/clientes');
      if (!response.ok) throw new Error('Erro ao carregar clientes');
      return response.json();
    }
  });

  // Mutation para criar cliente
  const createClienteMutation = useMutation({
    mutationFn: async (data: ClientForm) => {
      const response = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          canBeClient: true,
          canBeSupplier: false
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar cliente');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cliente criado",
        description: "Cliente cadastrado com sucesso!",
      });
      setIsCreateModalOpen(false);
      setForm({
        name: '',
        document: '',
        documentType: 'CNPJ',
        email: '',
        phone: '',
        contactName: '',
        stateRegistration: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: '',
        zipCode: ''
      });
      queryClient.invalidateQueries({ queryKey: ['/api/clientes'] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar cliente",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const filteredClientes = clientes.filter((cliente: Cliente) =>
    cliente.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.document?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cliente.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDocument = (document: string, type: string) => {
    if (!document) return '';
    const cleaned = document.replace(/\D/g, '');
    
    if (type === 'CPF' && cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    
    if (type === 'CNPJ' && cleaned.length === 14) {
      return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    
    return document;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.name || !form.document) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e documento são obrigatórios",
        variant: "destructive",
      });
      return;
    }
    
    createClienteMutation.mutate(form);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#E40064]/10 rounded-lg">
            <Users className="h-6 w-6 text-[#E40064]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-[#0B0E30]">Clientes</h1>
            <p className="text-gray-600">Gerencie os clientes do seu BPO financeiro</p>
          </div>
        </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#E40064] hover:bg-[#E40064]/90">
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[#0B0E30]">Cadastrar Novo Cliente</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="new-password" data-lpignore="true">
              {/* Dados Básicos */}
              <div className="space-y-4">
                <h3 className="font-semibold text-[#0B0E30] border-b pb-2">Dados Básicos</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome/Razão Social *</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({...form, name: e.target.value})}
                      placeholder="Nome completo ou razão social"
                      autoComplete="new-password"
                      data-lpignore="true"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Tipo de Documento</Label>
                    <Select value={form.documentType} onValueChange={(value: 'CPF' | 'CNPJ') => setForm({...form, documentType: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CPF">CPF</SelectItem>
                        <SelectItem value="CNPJ">CNPJ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>{form.documentType} *</Label>
                    <Input
                      value={form.document}
                      onChange={(e) => setForm({...form, document: e.target.value})}
                      placeholder={form.documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                      autoComplete="new-password"
                      data-lpignore="true"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Inscrição Estadual</Label>
                    <Input
                      value={form.stateRegistration}
                      onChange={(e) => setForm({...form, stateRegistration: e.target.value})}
                      placeholder="000.000.000.000 (opcional)"
                      autoComplete="new-password"
                      data-lpignore="true"
                      spellCheck="false"
                    />
                  </div>
                </div>
              </div>

              {/* Contato */}
              <div className="space-y-4">
                <h3 className="font-semibold text-[#0B0E30] border-b pb-2">Contato</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({...form, email: e.target.value})}
                      placeholder="email@exemplo.com"
                      autoComplete="new-password"
                      data-lpignore="true"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({...form, phone: e.target.value})}
                      placeholder="(11) 99999-9999"
                      autoComplete="new-password"
                      data-lpignore="true"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Pessoa de Contato</Label>
                    <Input
                      value={form.contactName}
                      onChange={(e) => setForm({...form, contactName: e.target.value})}
                      placeholder="Nome do responsável"
                      autoComplete="new-password"
                      data-lpignore="true"
                      spellCheck="false"
                    />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-4">
                <h3 className="font-semibold text-[#0B0E30] border-b pb-2">Endereço</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <Input
                      value={form.zipCode}
                      onChange={(e) => setForm({...form, zipCode: e.target.value})}
                      placeholder="00000-000"
                      autoComplete="new-password"
                      data-lpignore="true"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="space-y-2 md:col-span-3">
                    <Label>Rua/Avenida</Label>
                    <Input
                      value={form.street}
                      onChange={(e) => setForm({...form, street: e.target.value})}
                      placeholder="Nome da rua/avenida"
                      autoComplete="new-password"
                      data-lpignore="true"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Número</Label>
                    <Input
                      value={form.number}
                      onChange={(e) => setForm({...form, number: e.target.value})}
                      placeholder="123"
                      autoComplete="new-password"
                      data-lpignore="true"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Complemento</Label>
                    <Input
                      value={form.complement}
                      onChange={(e) => setForm({...form, complement: e.target.value})}
                      placeholder="Apto 45, Bloco B..."
                      autoComplete="new-password"
                      data-lpignore="true"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input
                      value={form.neighborhood}
                      onChange={(e) => setForm({...form, neighborhood: e.target.value})}
                      placeholder="Nome do bairro"
                      autoComplete="new-password"
                      data-lpignore="true"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={form.city}
                      onChange={(e) => setForm({...form, city: e.target.value})}
                      placeholder="Nome da cidade"
                      autoComplete="new-password"
                      data-lpignore="true"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input
                      value={form.state}
                      onChange={(e) => setForm({...form, state: e.target.value})}
                      placeholder="SP"
                      maxLength={2}
                      autoComplete="new-password"
                      data-lpignore="true"
                      spellCheck="false"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={createClienteMutation.isPending}
                  className="flex-1 bg-[#E40064] hover:bg-[#E40064]/90"
                >
                  {createClienteMutation.isPending ? 'Criando...' : 'Criar Cliente'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome, documento ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de Clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Clientes Cadastrados ({filteredClientes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Carregando clientes...</div>
          ) : filteredClientes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredClientes.map((cliente: Cliente) => (
                <Card key={cliente.id} className="border-l-4 border-l-[#E40064]">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <h3 className="font-semibold text-[#0B0E30]">{cliente.name}</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
                          {cliente.document && (
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              {formatDocument(cliente.document, cliente.documentType || 'CNPJ')}
                            </div>
                          )}
                          
                          {cliente.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              {cliente.email}
                            </div>
                          )}
                          
                          {cliente.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              {cliente.phone}
                            </div>
                          )}
                        </div>
                        
                        {cliente.street && (
                          <div className="text-sm text-gray-600">
                            📍 {cliente.street}, {cliente.number} - {cliente.neighborhood}, {cliente.city}/{cliente.state}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          cliente.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {cliente.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}