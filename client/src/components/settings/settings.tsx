import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  Globe, 
  Bell, 
  Shield, 
  Zap, 
  Upload, 
  Clock,
  Eye,
  Key,
  Webhook,
  MapPin,
  Phone,
  Mail,
  FileText,
  Calendar,
  DollarSign,
  AlertTriangle
} from "lucide-react";

export function Settings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("company");
  const [isLoading, setIsLoading] = useState(false);

  // Estados dos formulários
  const [companyData, setCompanyData] = useState({
    name: "Gquicks BPO",
    cnpj: "",
    ie: "",
    im: "",
    email: "contato@gquicks.com.br",
    phone: "",
    cep: "",
    address: "",
    city: "",
    state: "",
    logo: null as File | null
  });

  // Carregar logo salva quando componente montar
  useEffect(() => {
    const savedLogo = localStorage.getItem('company-logo');
    if (savedLogo) {
      // Simplesmente marcar que existe uma logo (sem tentar recriar o File)
      // O preview será mostrado usando a URL do localStorage
      setCompanyData(prev => ({ ...prev, logo: new File([], 'logo-loaded') }));
    }
  }, []);

  const [systemPrefs, setSystemPrefs] = useState({
    timezone: "America/Sao_Paulo",
    dateFormat: "DD/MM/YYYY",
    currency: "BRL",
    language: "pt-BR"
  });

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    reportFrequency: "weekly",
    dueAlerts: "3days",
    reminderHours: "09:00"
  });

  const [security, setSecurity] = useState({
    autoBackup: true,
    autoLogout: "30",
    auditLogs: true,
    sessionTimeout: "2h"
  });

  const [integrations, setIntegrations] = useState({
    webhookUrl: "",
    apiKey: "",
    notificationEndpoint: ""
  });

  const handleSave = async (section: string) => {
    setIsLoading(true);
    try {
      // Simular salvamento (implementar API real depois)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      toast({
        title: "Configurações salvas",
        description: `Seção ${section} atualizada com sucesso!`,
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "Arquivo muito grande",
          description: "O logo deve ter no máximo 5MB.",
          variant: "destructive",
        });
        return;
      }
      
      // Converter para base64 para persistir permanentemente
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Logo = e.target?.result as string;
        localStorage.setItem('company-logo', base64Logo);
        
        setCompanyData({ ...companyData, logo: file });
        
        // Forçar atualização da sidebar
        window.dispatchEvent(new Event('logo-updated'));
        
        toast({
          title: "Logo carregada",
          description: "Logo salva permanentemente! Verifique a sidebar.",
        });
      };
      
      reader.readAsDataURL(file);
    }
  };

  const generateApiKey = () => {
    const newKey = `gq_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    setIntegrations({ ...integrations, apiKey: newKey });
    toast({
      title: "Chave API gerada",
      description: "Nova chave de API criada com sucesso!",
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground mb-2">Configurações da Plataforma</h1>
        <p className="text-muted-foreground">
          Gerencie as configurações exclusivas do sistema Gquicks BPO
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Empresa
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Sistema
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Segurança
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Integrações
          </TabsTrigger>
        </TabsList>

        {/* 1. EMPRESA */}
        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-gquicks-primary" />
                Perfil da Empresa
              </CardTitle>
              <CardDescription>
                Informações institucionais da Gquicks BPO
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Logo Upload */}
              <div className="space-y-2">
                <Label htmlFor="logo">Logo da Empresa</Label>
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 border-2 border-dashed border-muted-foreground rounded-lg flex items-center justify-center bg-muted">
                    {companyData.logo ? (
                      companyData.logo.size > 0 ? (
                        <img 
                          src={URL.createObjectURL(companyData.logo)} 
                          alt="Logo" 
                          className="w-full h-full object-contain rounded"
                        />
                      ) : (
                        <img 
                          src={localStorage.getItem('company-logo') || ''} 
                          alt="Logo" 
                          className="w-full h-full object-contain rounded"
                        />
                      )
                    ) : (
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="mb-2"
                    />
                    <p className="text-sm text-muted-foreground">
                      PNG, JPG ou SVG. Máximo 5MB.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Dados Básicos */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company-name">Nome da Empresa</Label>
                  <Input
                    id="company-name"
                    value={companyData.name}
                    onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                    placeholder="Gquicks BPO"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={companyData.cnpj}
                    onChange={(e) => setCompanyData({ ...companyData, cnpj: e.target.value })}
                    placeholder="00.000.000/0001-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ie">Inscrição Estadual</Label>
                  <Input
                    id="ie"
                    value={companyData.ie}
                    onChange={(e) => setCompanyData({ ...companyData, ie: e.target.value })}
                    placeholder="000.000.000.000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="im">Inscrição Municipal</Label>
                  <Input
                    id="im"
                    value={companyData.im}
                    onChange={(e) => setCompanyData({ ...companyData, im: e.target.value })}
                    placeholder="000000000"
                  />
                </div>
              </div>

              <Separator />

              {/* Contato */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email Institucional
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={companyData.email}
                    onChange={(e) => setCompanyData({ ...companyData, email: e.target.value })}
                    placeholder="contato@gquicks.com.br"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Telefone
                  </Label>
                  <Input
                    id="phone"
                    value={companyData.phone}
                    onChange={(e) => setCompanyData({ ...companyData, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Endereço Completo
                </Label>
                <div className="grid grid-cols-3 gap-4">
                  <Input
                    placeholder="CEP"
                    value={companyData.cep}
                    onChange={(e) => setCompanyData({ ...companyData, cep: e.target.value })}
                  />
                  <Input
                    placeholder="Cidade"
                    value={companyData.city}
                    onChange={(e) => setCompanyData({ ...companyData, city: e.target.value })}
                  />
                  <Input
                    placeholder="Estado"
                    value={companyData.state}
                    onChange={(e) => setCompanyData({ ...companyData, state: e.target.value })}
                  />
                </div>
                <Textarea
                  placeholder="Endereço completo (rua, número, complemento, bairro)"
                  value={companyData.address}
                  onChange={(e) => setCompanyData({ ...companyData, address: e.target.value })}
                  rows={3}
                />
              </div>

              <Button 
                onClick={() => handleSave("empresa")} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Salvando..." : "Salvar Dados da Empresa"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. SISTEMA */}
        <TabsContent value="system" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-gquicks-primary" />
                Preferências do Sistema
              </CardTitle>
              <CardDescription>
                Configurações regionais e de formato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="timezone" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Fuso Horário
                  </Label>
                  <Select value={systemPrefs.timezone} onValueChange={(value) => 
                    setSystemPrefs({ ...systemPrefs, timezone: value })
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Sao_Paulo">São Paulo (GMT-3)</SelectItem>
                      <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
                      <SelectItem value="America/Rio_Branco">Rio Branco (GMT-5)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language" className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Idioma
                  </Label>
                  <Select value={systemPrefs.language} onValueChange={(value) => 
                    setSystemPrefs({ ...systemPrefs, language: value })
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                      <SelectItem value="en-US">English (US)</SelectItem>
                      <SelectItem value="es-ES">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateFormat" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Formato de Data
                  </Label>
                  <Select value={systemPrefs.dateFormat} onValueChange={(value) => 
                    setSystemPrefs({ ...systemPrefs, dateFormat: value })
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DD/MM/YYYY">DD/MM/AAAA (BR)</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/AAAA (US)</SelectItem>
                      <SelectItem value="YYYY-MM-DD">AAAA-MM-DD (ISO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency" className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Moeda
                  </Label>
                  <Select value={systemPrefs.currency} onValueChange={(value) => 
                    setSystemPrefs({ ...systemPrefs, currency: value })
                  }>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BRL">Real (R$ 1.234,56)</SelectItem>
                      <SelectItem value="USD">Dólar ($ 1,234.56)</SelectItem>
                      <SelectItem value="EUR">Euro (€ 1.234,56)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">
                      Configurações Regionais
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Essas configurações afetam como datas, números e moedas são exibidos em toda a plataforma.
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => handleSave("sistema")} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Salvando..." : "Salvar Preferências"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. NOTIFICAÇÕES */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-gquicks-primary" />
                Notificações e Alertas
              </CardTitle>
              <CardDescription>
                Configure quando e como receber alertas do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Alertas por Email
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Receber notificações de documentos pendentes e status
                    </p>
                  </div>
                  <Switch
                    checked={notifications.emailAlerts}
                    onCheckedChange={(checked) => 
                      setNotifications({ ...notifications, emailAlerts: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reportFrequency" className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Frequência de Relatórios
                    </Label>
                    <Select value={notifications.reportFrequency} onValueChange={(value) => 
                      setNotifications({ ...notifications, reportFrequency: value })
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diário</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="disabled">Desabilitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dueAlerts" className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Alertas de Vencimento
                    </Label>
                    <Select value={notifications.dueAlerts} onValueChange={(value) => 
                      setNotifications({ ...notifications, dueAlerts: value })
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1day">1 dia antes</SelectItem>
                        <SelectItem value="3days">3 dias antes</SelectItem>
                        <SelectItem value="7days">7 dias antes</SelectItem>
                        <SelectItem value="disabled">Desabilitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reminderHours" className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Horário dos Lembretes
                  </Label>
                  <Input
                    id="reminderHours"
                    type="time"
                    value={notifications.reminderHours}
                    onChange={(e) => setNotifications({ ...notifications, reminderHours: e.target.value })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Horário para envio de lembretes diários
                  </p>
                </div>
              </div>

              <Button 
                onClick={() => handleSave("notificações")} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Salvando..." : "Salvar Notificações"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. SEGURANÇA */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-gquicks-primary" />
                Backup e Segurança
              </CardTitle>
              <CardDescription>
                Configurações de proteção e backup do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Backup Automático
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Criar backups diários dos dados da plataforma
                    </p>
                  </div>
                  <Switch
                    checked={security.autoBackup}
                    onCheckedChange={(checked) => 
                      setSecurity({ ...security, autoBackup: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      Logs de Auditoria
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Registrar todas as ações dos usuários para auditoria
                    </p>
                  </div>
                  <Switch
                    checked={security.auditLogs}
                    onCheckedChange={(checked) => 
                      setSecurity({ ...security, auditLogs: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="autoLogout" className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Logout Automático
                    </Label>
                    <Select value={security.autoLogout} onValueChange={(value) => 
                      setSecurity({ ...security, autoLogout: value })
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutos</SelectItem>
                        <SelectItem value="30">30 minutos</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                        <SelectItem value="120">2 horas</SelectItem>
                        <SelectItem value="disabled">Desabilitado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sessionTimeout" className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Timeout de Sessão
                    </Label>
                    <Select value={security.sessionTimeout} onValueChange={(value) => 
                      setSecurity({ ...security, sessionTimeout: value })
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1h">1 hora</SelectItem>
                        <SelectItem value="2h">2 horas</SelectItem>
                        <SelectItem value="4h">4 horas</SelectItem>
                        <SelectItem value="8h">8 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-900 dark:text-amber-100">
                      Configurações de Segurança
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Estas configurações afetam a segurança de toda a plataforma. Alterações podem afetar todos os usuários.
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => handleSave("segurança")} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Salvando..." : "Salvar Configurações de Segurança"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. INTEGRAÇÕES */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-gquicks-primary" />
                Integrações e APIs
              </CardTitle>
              <CardDescription>
                Configure webhooks e chaves de API para integrações externas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl" className="flex items-center gap-2">
                    <Webhook className="w-4 h-4" />
                    URL do Webhook
                  </Label>
                  <Input
                    id="webhookUrl"
                    type="url"
                    value={integrations.webhookUrl}
                    onChange={(e) => setIntegrations({ ...integrations, webhookUrl: e.target.value })}
                    placeholder="https://sua-aplicacao.com/webhook"
                  />
                  <p className="text-sm text-muted-foreground">
                    URL para receber notificações de eventos da plataforma
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notificationEndpoint" className="flex items-center gap-2">
                    <Bell className="w-4 h-4" />
                    Endpoint de Notificações
                  </Label>
                  <Input
                    id="notificationEndpoint"
                    type="url"
                    value={integrations.notificationEndpoint}
                    onChange={(e) => setIntegrations({ ...integrations, notificationEndpoint: e.target.value })}
                    placeholder="https://sua-aplicacao.com/notifications"
                  />
                  <p className="text-sm text-muted-foreground">
                    Endpoint específico para alertas e notificações
                  </p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label className="flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    Chave de API
                  </Label>
                  <div className="flex space-x-2">
                    <Input
                      value={integrations.apiKey}
                      readOnly
                      placeholder="Nenhuma chave gerada"
                      className="font-mono"
                    />
                    <Button 
                      onClick={generateApiKey}
                      variant="outline"
                      className="shrink-0"
                    >
                      Gerar Nova
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Use esta chave para autenticar integrações com a API da Gquicks
                  </p>
                  
                  {integrations.apiKey && (
                    <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-green-700 border-green-300">
                          Ativa
                        </Badge>
                        <span className="text-sm text-green-700 dark:text-green-300">
                          Chave gerada e pronta para uso
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">
                      Integrações Futuras
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Em breve: Integração com ERPs (SAP, TOTVS), bancos e sistemas contábeis.
                    </p>
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => handleSave("integrações")} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Salvando..." : "Salvar Integrações"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}