import * as React from "react";

import { useNavigate } from "react-router-dom";

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
import {
  addNetworkStatusListener,
  getNetworkStatus,
  checkSupabaseReachability,
} from "@/lib/network-status";

function isEmailNotConfirmed(message: string | undefined) {
  const m = (message ?? "").toLowerCase();
  return m.includes("email not confirmed") || m.includes("not confirmed");
}

function BrandHeader() {
  return (
    <div className="flex items-center justify-center gap-4">
      <div className="relative grid h-16 w-16 place-items-center rounded-3xl bg-brand shadow-sm ring-1 ring-brand/30">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-foreground">
          <span className="text-lg font-extrabold tracking-tight text-white">
            RF
          </span>
        </div>
        <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-brand-2 ring-2 ring-background" />
      </div>
      <div className="leading-tight">
        <div className="text-2xl font-extrabold tracking-tight text-foreground">
          Ritmo<span className="text-brand">Fit</span>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [networkStatus, setNetworkStatus] = React.useState(getNetworkStatus());

  const canSubmit =
    !busy &&
    email.trim().length > 0 &&
    password.trim().length >= 6 &&
    hasSupabaseConfig;

  React.useEffect(() => {
    const unsubscribe = addNetworkStatusListener((status) => {
      setNetworkStatus(status);
    });

    return unsubscribe;
  }, []);

  React.useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    // Always go to feed after login
    navigate("/", { replace: true });
  }, [authLoading, user, navigate]);

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
          if (isEmailNotConfirmed(error.message)) {
            toast({
              title: "Email não confirmado",
              description:
                "Seu Supabase está exigindo confirmação por email. Para desativar: Supabase Dashboard → Authentication → Providers → Email → desmarque “Confirm email”.",
            });
            return;
          }

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

      const { error } = await supabase.auth.signUp({
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

      // Tentamos logar imediatamente após o cadastro.
      // OBS: se o seu projeto Supabase estiver com confirmação por email ligada,
      // o sign-in pode falhar com "Email not confirmed".
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (signInError) {
        if (isEmailNotConfirmed(signInError.message)) {
          toast({
            title: "Conta criada, mas o email não foi confirmado",
            description:
              "Para entrar sem confirmar email, desative no Supabase: Authentication → Providers → Email → “Confirm email”.",
          });
          return;
        }

        toast({
          title: "Conta criada, mas não foi possível entrar",
          description:
            signInError.message ||
            "Verifique as configurações de autenticação do Supabase.",
        });
        return;
      }

      toast({
        title: "Conta criada",
        description: "Bem-vindo ao RitmoFit!",
      });
      // User will be redirected to feed by useEffect above
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
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <BrandHeader />

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
            {!networkStatus.isOnline ? (
              <div className="rounded-2xl border border-red-200/30 bg-red-50/20 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-200">
                Você parece estar offline. Verifique sua conexão com a internet.
              </div>
            ) : !networkStatus.isSupabaseReachable ? (
              <div className="rounded-2xl border border-yellow-200/30 bg-yellow-50/20 p-4 text-sm text-yellow-700 dark:border-yellow-900/30 dark:bg-yellow-950/20 dark:text-yellow-200">
                Não foi possível alcançar o Supabase. Pode ser um problema de CORS ou conectividade. Tente novamente em alguns momentos.
              </div>
            ) : null}

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
                  <div className="text-sm font-semibold">
                    Você já está logado
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {user.email}
                  </div>
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
                        type="text"
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

                    <button
                      type="button"
                      className="text-left text-sm font-semibold text-brand hover:underline"
                      onClick={() => setTab("signup")}
                    >
                      Ainda não tem conta? Cadastre-se
                    </button>
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
                        type="text"
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
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
