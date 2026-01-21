import * as React from "react";

import * as React from "react";

import { Link, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const canSubmit =
    !busy && isValidEmail(email) && password.trim().length >= 6 && hasSupabaseConfig;

  const submit = async (mode: "login" | "signup") => {
    if (!hasSupabaseConfig || !supabase) {
      toast({
        title: "Supabase não configurado",
        description:
          "Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para habilitar login.",
      });
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!isValidEmail(trimmedEmail)) {
      toast({
        title: "Email inválido",
        description: "Digite um email válido para continuar.",
      });
      return;
    }

    if (trimmedPassword.length < 6) {
      toast({
        title: "Senha fraca",
        description: "Use uma senha com pelo menos 6 caracteres.",
      });
      return;
    }

    setBusy(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: trimmedPassword,
        });

        if (error) {
          toast({
            title: "Não foi possível entrar",
            description: error.message,
          });
          return;
        }

        toast({
          title: "Login feito",
          description: "Bem-vindo de volta.",
        });
        navigate("/", { replace: true });
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (error) {
        toast({
          title: "Não foi possível criar a conta",
          description: error.message,
        });
        return;
      }

      if (data.user && data.session) {
        toast({
          title: "Conta criada",
          description: "Você já está logado.",
        });
        navigate("/", { replace: true });
        return;
      }

      toast({
        title: "Conta criada",
        description: "Verifique seu email para confirmar a conta.",
      });
    } catch {
      toast({
        title: "Falha de conexão",
        description:
          "Não foi possível conectar ao Supabase. Confira a URL e tente novamente.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-md gap-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Login / Cadastro</h1>
        <p className="text-sm text-muted-foreground">
          Entre para sincronizar seus dados e usar recursos conectados.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader className="space-y-2">
          <CardTitle className="text-base">Acessar conta</CardTitle>
          <CardDescription>
            {hasSupabaseConfig
              ? "Use email e senha."
              : "Supabase ainda não foi configurado neste projeto."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {!hasSupabaseConfig ? (
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              Para habilitar login, defina as variáveis:
              <div className="mt-2 grid gap-1 font-mono text-[12px]">
                <div>VITE_SUPABASE_URL</div>
                <div>VITE_SUPABASE_ANON_KEY</div>
              </div>
            </div>
          ) : null}

          {authLoading ? (
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              Verificando sessão...
            </div>
          ) : user ? (
            <div className="grid gap-3">
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                <div className="text-sm font-semibold">Você já está logado</div>
                <div className="mt-1 text-xs text-muted-foreground">{user.email}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="rounded-full"
                  onClick={() => navigate("/", { replace: true })}
                >
                  Ir para o app
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={busy || !supabase}
                  onClick={async () => {
                    if (!supabase) return;
                    setBusy(true);
                    try {
                      const { error } = await supabase.auth.signOut();
                      if (error) {
                        toast({
                          title: "Não foi possível sair",
                          description: error.message,
                        });
                        return;
                      }
                      toast({ title: "Você saiu" });
                    } catch {
                      toast({
                        title: "Falha de conexão",
                        description:
                          "Não foi possível conectar ao Supabase. Confira a URL e tente novamente.",
                      });
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Sair
                </Button>
              </div>
            </div>
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/40 p-1 shadow-sm ring-1 ring-border/60">
                <TabsTrigger
                  value="login"
                  className="rounded-full data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-brand/30"
                >
                  Entrar
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-full data-[state=active]:bg-brand data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-brand/30"
                >
                  Criar conta
                </TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-4">
                <form
                  className="grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit("login");
                  }}
                >
                  <div className="grid gap-2">
                    <Label htmlFor="login_email">Email</Label>
                    <Input
                      id="login_email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                      autoComplete="email"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="login_password">Senha</Label>
                    <Input
                      id="login_password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="mt-1 rounded-full"
                    disabled={!canSubmit}
                  >
                    {busy ? "Entrando..." : "Entrar"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-4">
                <form
                  className="grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit("signup");
                  }}
                >
                  <div className="grid gap-2">
                    <Label htmlFor="signup_email">Email</Label>
                    <Input
                      id="signup_email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                      autoComplete="email"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="signup_password">Senha</Label>
                    <Input
                      id="signup_password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="mt-1 rounded-full"
                    disabled={!canSubmit}
                  >
                    {busy ? "Criando..." : "Criar conta"}
                  </Button>

                  <div className="text-xs text-muted-foreground">
                    Ao criar uma conta, pode ser necessário confirmar por email (depende
                    das configurações do seu Supabase).
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          )}

          <Separator />

          <div className="flex items-center justify-between gap-2 text-sm">
            <Button asChild variant="ghost" className="rounded-full px-3">
              <Link to="/">Voltar ao feed</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
