import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Eye, EyeOff } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Usuário é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Usuário deve ter pelo menos 3 caracteres"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  email: z.string().email("Email inválido"),
  firstName: z.string().min(1, "Nome é obrigatório"),
  lastName: z.string().min(1, "Sobrenome é obrigatório"),
  tenantId: z.string().uuid("Tenant ID inválido"),
});

type LoginData = z.infer<typeof loginSchema>;
type RegisterData = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const loginForm = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      firstName: "",
      lastName: "",
      tenantId: "",
    },
  });

  // Redirect if already logged in
  if (user) {
    return <Redirect to="/" />;
  }

  const handleLogin = (data: LoginData) => {
    loginMutation.mutate(data);
  };

  const handleRegister = (data: RegisterData) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Column - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-gquicks-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-gilroy font-bold text-2xl">G</span>
              </div>
              <span className="text-gquicks-secondary font-gilroy font-bold text-3xl">gquicks</span>
            </div>
            <h1 className="font-gilroy font-bold text-2xl text-gquicks-secondary mb-2">
              Portal BPO Financeiro
            </h1>
            <p className="text-muted-foreground">Acesse sua conta para continuar</p>
          </div>

          <Tabs defaultValue="login" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Cadastro</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle className="font-gilroy text-gquicks-secondary">Entrar</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                    <div>
                      <Label htmlFor="login-username">Usuário</Label>
                      <Input
                        id="login-username"
                        type="text"
                        placeholder="Digite seu usuário"
                        {...loginForm.register("username")}
                        data-testid="input-username"
                      />
                      {loginForm.formState.errors.username && (
                        <p className="text-destructive text-sm mt-1">
                          {loginForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="login-password">Senha</Label>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Digite sua senha"
                          {...loginForm.register("password")}
                          data-testid="input-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      {loginForm.formState.errors.password && (
                        <p className="text-destructive text-sm mt-1">
                          {loginForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-gquicks-primary hover:bg-gquicks-primary/90"
                      disabled={loginMutation.isPending}
                      data-testid="button-login"
                    >
                      {loginMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Entrar
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle className="font-gilroy text-gquicks-secondary">Criar Conta</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">Nome</Label>
                        <Input
                          id="firstName"
                          placeholder="Nome"
                          {...registerForm.register("firstName")}
                          data-testid="input-first-name"
                        />
                        {registerForm.formState.errors.firstName && (
                          <p className="text-destructive text-sm mt-1">
                            {registerForm.formState.errors.firstName.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="lastName">Sobrenome</Label>
                        <Input
                          id="lastName"
                          placeholder="Sobrenome"
                          {...registerForm.register("lastName")}
                          data-testid="input-last-name"
                        />
                        {registerForm.formState.errors.lastName && (
                          <p className="text-destructive text-sm mt-1">
                            {registerForm.formState.errors.lastName.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="register-username">Usuário</Label>
                      <Input
                        id="register-username"
                        placeholder="Nome de usuário"
                        {...registerForm.register("username")}
                        data-testid="input-register-username"
                      />
                      {registerForm.formState.errors.username && (
                        <p className="text-destructive text-sm mt-1">
                          {registerForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        {...registerForm.register("email")}
                        data-testid="input-email"
                      />
                      {registerForm.formState.errors.email && (
                        <p className="text-destructive text-sm mt-1">
                          {registerForm.formState.errors.email.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="tenantId">Tenant ID</Label>
                      <Input
                        id="tenantId"
                        placeholder="UUID do tenant"
                        {...registerForm.register("tenantId")}
                        data-testid="input-tenant-id"
                      />
                      {registerForm.formState.errors.tenantId && (
                        <p className="text-destructive text-sm mt-1">
                          {registerForm.formState.errors.tenantId.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="register-password">Senha</Label>
                      <div className="relative">
                        <Input
                          id="register-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Mínimo 6 caracteres"
                          {...registerForm.register("password")}
                          data-testid="input-register-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      {registerForm.formState.errors.password && (
                        <p className="text-destructive text-sm mt-1">
                          {registerForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-gquicks-primary hover:bg-gquicks-primary/90"
                      disabled={registerMutation.isPending}
                      data-testid="button-register"
                    >
                      {registerMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Criar Conta
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right Column - Hero Section */}
      <div className="flex-1 bg-gradient-to-br from-gquicks-primary to-gquicks-secondary p-8 text-white flex flex-col justify-center">
        <div className="max-w-md">
          <h2 className="font-gilroy font-bold text-4xl mb-6">
            Automatize seu BPO Financeiro
          </h2>
          <div className="space-y-4 text-white/90">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-white rounded-full mt-2 flex-shrink-0" />
              <p>OCR + IA para processamento automático de documentos</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-white rounded-full mt-2 flex-shrink-0" />
              <p>Classificação inteligente: Pago, Agendado, Boleto, NF</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-white rounded-full mt-2 flex-shrink-0" />
              <p>Validação cruzada automática entre OCR, IA e metadados</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-white rounded-full mt-2 flex-shrink-0" />
              <p>Fluxos operacionais: Inbox, Conciliação, Agendamento</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-white rounded-full mt-2 flex-shrink-0" />
              <p>Sistema multi-tenant com controle de acesso</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
