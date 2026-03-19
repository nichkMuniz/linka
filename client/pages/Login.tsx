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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  addNetworkStatusListener,
  getNetworkStatus,
  checkSupabaseReachability,
} from "@/lib/network-status";
import { Fingerprint, Upload, X, Search, Check, ArrowLeft } from "lucide-react";
import { getAllUsersDb, searchUsersDb, type SearchUser, followUserDb } from "@/lib/ritmofit-db";

function isEmailNotConfirmed(message: string | undefined) {
  const m = (message ?? "").toLowerCase();
  return m.includes("email not confirmed") || m.includes("not confirmed");
}

function formatPhoneDisplay(value: string): string {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 2) return cleaned;
  if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  const areaCode = cleaned.slice(0, 2);
  const firstPart = cleaned.slice(2, 7);
  const secondPart = cleaned.slice(7, 11);
  return `(${areaCode}) ${firstPart}-${secondPart}`.trim();
}

function BrandHeader() {
  return (
    <div className="flex items-center justify-center">
      <img src="/logo-horizontal.png" alt="LinKa" className="h-16" />
    </div>
  );
}

const FITNESS_SEGMENTS = [
  { id: "fitness", label: "🏋️ Fitness & Musculação" },
  { id: "cardio", label: "🏃 Cardio & Corrida" },
  { id: "diets", label: "🥗 Dietas & Nutrição" },
  { id: "habits", label: "🎯 Hábitos & Mindfulness" },
  { id: "yoga", label: "🧘 Yoga & Flexibilidade" },
  { id: "sports", label: "⚽ Esportes" },
];

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [tab, setTab] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [networkStatus, setNetworkStatus] = React.useState(getNetworkStatus());
  const [biometricAvailable, setBiometricAvailable] = React.useState(false);
  const [hasBiometricRegistered, setHasBiometricRegistered] = React.useState(false);
  const [showBiometricSetup, setShowBiometricSetup] = React.useState(false);

  // Multi-step signup states
  const [signupStep, setSignupStep] = React.useState(1);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = React.useState<string>("");
  const [bio, setBio] = React.useState("");
  const [hasCommercialProfile, setHasCommercialProfile] = React.useState(false);
  const [selectedSegments, setSelectedSegments] = React.useState<Set<string>>(new Set());
  const [userEmail, setUserEmail] = React.useState("");
  const [emailCheckStatus, setEmailCheckStatus] = React.useState<"idle" | "checking" | "valid" | "exists">("idle");
  const [emailCheckMessage, setEmailCheckMessage] = React.useState("");
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = React.useState("");
  const [isResettingPassword, setIsResettingPassword] = React.useState(false);
  const [commercialData, setCommercialData] = React.useState({
    business_segment: "",
    business_name: "",
    business_description: "",
    business_phone: "",
    business_email: "",
    business_website: "",
  });
  const [availableUsers, setAvailableUsers] = React.useState<SearchUser[]>([]);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [loadingUsers, setLoadingUsers] = React.useState(false);
  const [step4SearchResults, setStep4SearchResults] = React.useState<SearchUser[]>([]);

  const canSubmit =
    !busy &&
    email.trim().length > 0 &&
    password.trim().length >= 6 &&
    hasSupabaseConfig &&
    networkStatus.isOnline &&
    networkStatus.isSupabaseReachable;

  React.useEffect(() => {
    const unsubscribe = addNetworkStatusListener((status) => {
      setNetworkStatus(status);
    });

    return unsubscribe;
  }, []);

  React.useEffect(() => {
    // Check if WebAuthn is available
    const checkBiometric = async () => {
      if (window.PublicKeyCredential) {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setBiometricAvailable(available);

        // Check if user has registered biometric
        const registered = localStorage.getItem("biometric_registered");
        setHasBiometricRegistered(!!registered);
      }
    };

    checkBiometric();
  }, []);

  // Load available users for step 4
  React.useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const users = await getAllUsersDb();
        setAvailableUsers(users);
        setStep4SearchResults(users);
      } catch {
        setAvailableUsers([]);
        setStep4SearchResults([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    if (tab === "signup" && signupStep === 4) {
      loadUsers();
    }
  }, [tab, signupStep]);

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
                "Seu Supabase está exigindo confirmação por email. Para desativar: Supabase Dashboard → Authentication → Providers → Email → desmarque \"Confirm email\".",
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

      // Handle signup step 1: email and password validation
      if (signupStep === 1) {
        // Check password confirmation
        if (password !== confirmPassword) {
          toast({
            title: "Senhas não conferem",
            description: "As senhas informadas são diferentes.",
            variant: "destructive",
          });
          setBusy(false);
          return;
        }

        // Validate email exists
        const emailExists = await validateEmailExists(trimmedEmail);

        if (emailExists) {
          toast({
            title: "Usuário já cadastrado",
            description: "Este email já está sendo usado. Faça login ou use outro email.",
            variant: "destructive",
          });
          setBusy(false);
          return;
        }

        setUserEmail(trimmedEmail);
        setSignupStep(2);
        setBusy(false);
        return;
      }
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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignupStep2 = () => {
    if (!displayName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe seu nome.",
      });
      return;
    }
    // If commercial profile, go to commercial data step, else go to segments
    if (hasCommercialProfile) {
      setSignupStep(2.5);
    } else {
      setSignupStep(3);
    }
  };

  const handleCommercialDataComplete = () => {
    if (!commercialData.business_name.trim() || !commercialData.business_segment) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Segmento e Nome da Loja são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    setSignupStep(3);
  };

  const handleSignupStep3 = async () => {
    if (selectedSegments.size === 0) {
      toast({
        title: "Selecione pelo menos um segmento",
        description: "Escolha os tópicos que mais te interessam.",
      });
      return;
    }

    if (!hasSupabaseConfig || !supabase) return;

    setBusy(true);
    try {
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();

      // Create user auth account
      const { error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
        options: { data: { full_name: displayName } },
      });

      if (signUpError) {
        toast({ title: "Não foi possível criar a conta", description: signUpError.message });
        return;
      }

      // Sign in after signup
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (signInError && !isEmailNotConfirmed(signInError.message)) {
        toast({ title: "Conta criada, mas não foi possível entrar", description: signInError.message });
        return;
      }

      // Upload photo and save bio if provided
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        let photoUrl: string | undefined;
        if (photoFile) {
          const extension = photoFile.name.split(".").pop() || "jpg";
          const filePath = `${authUser.id}/profile-${Date.now()}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from("posts")
            .upload(filePath, photoFile, { contentType: photoFile.type });
          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(filePath);
            photoUrl = publicUrl;
          }
        }

        if (photoUrl || bio.trim()) {
          await supabase
            .from("profiles")
            .update({ ...(photoUrl ? { photo: photoUrl } : {}), ...(bio.trim() ? { bio: bio.trim() } : {}) })
            .eq("user_id", authUser.id);
        }
      }

      setSignupStep(4);
    } catch {
      toast({ title: "Falha de conexão", description: "Não foi possível criar sua conta." });
    } finally {
      setBusy(false);
    }
  };

  const validateEmailExists = React.useCallback(async (emailToCheck: string): Promise<boolean> => {
    if (!emailToCheck.trim() || !supabase) {
      return false;
    }

    try {
      // Try to sign in with a dummy password to check if email exists
      // If email doesn't exist, we get "Invalid login credentials" error
      // If email exists, we get "Invalid password" or similar error
      const { error } = await supabase.auth.signInWithPassword({
        email: emailToCheck.trim(),
        password: "dummypassword123",
      });

      if (!error) {
        // This shouldn't happen with dummy password
        return true;
      }

      const errorMsg = error.message?.toLowerCase() || "";

      // If we get "invalid login credentials" it means email doesn't exist
      // If we get other errors like "invalid password" or "wrong password", email exists
      if (errorMsg.includes("invalid login credentials") || errorMsg.includes("email not confirmed")) {
        return false;
      }

      // Email exists (got password error or other auth errors)
      return true;
    } catch {
      // If there's an error, assume email doesn't exist to not block signup
      return false;
    }
  }, [supabase]);

  const handleResetPassword = async () => {
    if (!hasSupabaseConfig || !supabase || !forgotPasswordEmail.trim()) {
      toast({
        title: "Email obrigatório",
        description: "Por favor, informe seu email.",
        variant: "destructive",
      });
      return;
    }

    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail.trim(), {
        redirectTo: `${window.location.origin}/`,
      });

      if (error) {
        toast({
          title: "Erro ao resetar senha",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Email enviado!",
        description: "Verifique seu email para redefinir sua senha.",
      });

      setForgotPasswordEmail("");
      setShowForgotPassword(false);
    } catch (err: any) {
      toast({
        title: "Erro de conexão",
        description: "Não foi possível enviar o email. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const toggleSegment = (segmentId: string) => {
    const newSegments = new Set(selectedSegments);
    if (newSegments.has(segmentId)) {
      newSegments.delete(segmentId);
    } else {
      newSegments.add(segmentId);
    }
    setSelectedSegments(newSegments);
  };

  const handleSignupComplete = () => {
    toast({
      title: "Conta criada com sucesso!",
      description: "Bem-vindo ao LinKa!",
    });

    if (biometricAvailable) {
      setShowBiometricSetup(true);
    }
  };

  const handleRegisterBiometric = async (redirectAfter: boolean = false) => {
    if (!biometricAvailable) {
      toast({
        title: "Biometria não disponível",
        description: "Seu dispositivo não suporta autenticação biométrica.",
      });
      return;
    }

    setBusy(true);

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: "LinKa",
            id: window.location.hostname,
          },
          user: {
            id: new Uint8Array(16),
            name: email,
            displayName: displayName,
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          timeout: 60000,
          attestation: "none",
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "preferred",
            residentKey: "preferred",
          },
        },
      });

      if (!credential) {
        toast({
          title: "Registro cancelado",
          description: "Você cancelou o registro biométrico.",
        });
        if (redirectAfter) {
          setShowBiometricSetup(false);
          navigate("/", { replace: true });
        }
        return;
      }

      // Store credential info in localStorage
      localStorage.setItem("biometric_registered", "true");
      localStorage.setItem("biometric_email", email);
      localStorage.setItem(
        "biometric_credential_id",
        btoa(String.fromCharCode(...new Uint8Array(credential.id)))
      );

      toast({
        title: "Biometria registrada",
        description: "Você pode usar sua face ou digital para próximos logins.",
      });

      if (redirectAfter) {
        setShowBiometricSetup(false);
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      console.error("Biometric registration error:", err);
      toast({
        title: "Erro ao registrar biometria",
        description:
          err.message ||
          "Não foi possível registrar sua biometria. Tente novamente.",
      });
      if (redirectAfter) {
        setShowBiometricSetup(false);
        navigate("/", { replace: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!biometricAvailable) {
      toast({
        title: "Biometria não disponível",
        description: "Seu dispositivo não suporta autenticação biométrica.",
      });
      return;
    }

    setBusy(true);

    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const storedCredentialId = localStorage.getItem("biometric_credential_id");
      if (!storedCredentialId) {
        toast({
          title: "Biometria não registrada",
          description: "Registre sua biometria primeiro.",
        });
        return;
      }

      const credentialId = Uint8Array.from(atob(storedCredentialId), (c) =>
        c.charCodeAt(0)
      );

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [
            {
              id: credentialId,
              type: "public-key",
              transports: ["internal"],
            },
          ],
          userVerification: "preferred",
          timeout: 60000,
        },
      });

      if (!assertion) {
        toast({
          title: "Autenticação cancelada",
          description: "Você cancelou a autenticação biométrica.",
        });
        return;
      }

      // Get stored email and login with it
      const storedEmail = localStorage.getItem("biometric_email");
      if (!storedEmail) {
        toast({
          title: "Erro de autenticação",
          description:
            "Não foi possível recuperar suas informações de login.",
        });
        return;
      }

      toast({
        title: "Autenticação biométrica concluída",
        description:
          "Entrando com sua biometria. Use email e senha para login inicial.",
      });

      // Set email for login
      setEmail(storedEmail);
      setTab("login");
    } catch (err: any) {
      console.error("Biometric login error:", err);

      // Handle specific errors
      if (err.name === "NotAllowedError") {
        toast({
          title: "Autenticação recusada",
          description:
            "A autenticação foi recusada. Tente novamente ou use email e senha.",
        });
      } else if (err.name === "NotSupportedError") {
        toast({
          title: "Biometria não suportada",
          description: "Seu navegador não suporta autenticação biométrica.",
        });
      } else {
        toast({
          title: "Erro na autenticação biométrica",
          description:
            err.message || "Não foi possível autenticar. Tente novamente.",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="mx-auto grid w-full max-w-md gap-6">
        <BrandHeader />

        <Card className="border-border/60 relative">
          {!showForgotPassword && (
            <CardHeader className="space-y-2">
              <CardTitle className="text-base">Acessar conta</CardTitle>
              <CardDescription>
                {hasSupabaseConfig
                  ? biometricAvailable
                    ? "Use email e biometria."
                    : "Use email e senha."
                  : "Supabase ainda não foi configurado neste projeto."}
              </CardDescription>
            </CardHeader>
          )}

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
            ) : showForgotPassword ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setForgotPasswordEmail("");
                    }}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    disabled={isResettingPassword}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h2 className="text-lg font-semibold">Redefinir Senha</h2>
                    <p className="text-xs text-muted-foreground">
                      Informe seu email para receber um link
                    </p>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="forgot_email">Email</Label>
                  <Input
                    id="forgot_email"
                    type="email"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    autoComplete="email"
                  />
                </div>

                <Button
                  type="button"
                  className="rounded-full w-full"
                  onClick={handleResetPassword}
                  disabled={isResettingPassword || !forgotPasswordEmail.trim()}
                >
                  {isResettingPassword ? "Enviando..." : "Enviar Email"}
                </Button>
              </div>
            ) : showBiometricSetup && biometricAvailable ? (
              <div className="grid gap-4">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-6 text-center space-y-4">
                  <Fingerprint className="h-12 w-12 mx-auto text-brand" />
                  <div>
                    <h3 className="text-lg font-semibold">
                      Registrar Biometria?
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Você pode usar sua face ou impressão digital para fazer login de forma mais rápida e segura.
                    </p>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Button
                    type="button"
                    className="rounded-full"
                    onClick={() => handleRegisterBiometric(true)}
                    disabled={busy}
                  >
                    <Fingerprint className="h-4 w-4 mr-2" />
                    Registrar Biometria
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      setShowBiometricSetup(false);
                      navigate("/", { replace: true });
                    }}
                    disabled={busy}
                  >
                    Pular
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
                      <button
                        type="button"
                        className="text-xs font-semibold text-brand hover:underline text-left"
                        onClick={() => setShowForgotPassword(true)}
                      >
                        Esqueci a senha
                      </button>
                    </div>

                    <Button
                      type="submit"
                      className="mt-1 rounded-full"
                      disabled={!canSubmit}
                    >
                      <Fingerprint className="h-4 w-4 mr-2" />
                      {busy ? "Entrando..." : "Entrar"}
                    </Button>

                    {hasBiometricRegistered && (
                      <Button
                        type="button"
                        variant="secondary"
                        className="rounded-full"
                        disabled={busy}
                        onClick={handleBiometricLogin}
                      >
                        <Fingerprint className="h-4 w-4 mr-2" />
                        Entrar com Biometria
                      </Button>
                    )}

                    <button
                      type="button"
                      className="text-left text-sm font-semibold text-brand hover:underline"
                      onClick={() => {
                        setTab("signup");
                        setSignupStep(1);
                      }}
                    >
                      Ainda não tem conta? Cadastre-se
                    </button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-4">
                  {/* Step 1: Email and Password */}
                  {signupStep === 1 && (
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

                      <div className="grid gap-2">
                        <Label htmlFor="signup_confirm_password">Confirmar Senha</Label>
                        <Input
                          id="signup_confirm_password"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirme sua senha"
                          autoComplete="new-password"
                          className={confirmPassword && password !== confirmPassword ? "border-red-500" : ""}
                        />
                        {confirmPassword && password !== confirmPassword && (
                          <p className="text-xs text-red-600">❌ As senhas não conferem</p>
                        )}
                        {confirmPassword && password === confirmPassword && password.length >= 6 && (
                          <p className="text-xs text-green-600">✓ Senhas conferem</p>
                        )}
                      </div>

                      <Button
                        type="submit"
                        className="mt-2 rounded-full"
                        disabled={!email.trim() || password.length < 6 || password !== confirmPassword || busy}
                      >
                        {busy ? "Validando..." : "Próximo"}
                      </Button>
                    </form>
                  )}

                  {/* Step 2: Name, Photo, Bio, Commercial Profile */}
                  {signupStep === 2 && (
                    <div className="grid gap-3">

                      <div className="grid gap-2">
                        <Label htmlFor="signup_name">Nome completo</Label>
                        <Input
                          id="signup_name"
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Seu nome completo"
                          autoComplete="name"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Foto de perfil</Label>
                        <div className="grid gap-2">
                          {photoPreview && (
                            <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border/60">
                              <img
                                src={photoPreview}
                                alt="Preview"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setPhotoFile(null);
                                  setPhotoPreview("");
                                }}
                                className="absolute top-1 right-1 bg-black/40 hover:bg-black/60 text-white p-1 rounded"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                          <label className="relative">
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full w-full"
                              asChild
                            >
                              <span>
                                <Upload className="h-4 w-4 mr-2" />
                                {photoFile ? "Mudar foto" : "Adicionar foto"}
                              </span>
                            </Button>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoChange}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="signup_bio">Bio (opcional)</Label>
                        <Textarea
                          id="signup_bio"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Conte um pouco sobre você..."
                          className="min-h-20"
                        />
                      </div>

                      <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                        <input
                          type="checkbox"
                          id="commercial_profile"
                          checked={hasCommercialProfile}
                          onChange={(e) => setHasCommercialProfile(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <Label htmlFor="commercial_profile" className="font-medium cursor-pointer">
                            Tenho perfil comercial
                          </Label>
                          <p className="text-xs text-muted-foreground">Academias, nutricionistas, personal trainers, etc</p>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full flex-1"
                          onClick={() => setSignupStep(1)}
                        >
                          Voltar
                        </Button>
                        <Button
                          type="button"
                          className="rounded-full flex-1"
                          onClick={handleSignupStep2}
                          disabled={!displayName.trim()}
                        >
                          Próximo
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 2.5: Commercial Data */}
                  {signupStep === 2.5 && (
                    <div className="grid gap-3">

                      <div className="grid gap-2">
                        <Label>Segmento *</Label>
                        <select
                          value={commercialData.business_segment}
                          onChange={(e) =>
                            setCommercialData({
                              ...commercialData,
                              business_segment: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-foreground"
                        >
                          <option value="">Selecione um segmento</option>
                          <option value="academia">Academia / Fitness</option>
                          <option value="personal_trainer">Personal Trainer</option>
                          <option value="nutricao">Nutrição / Nutricionista</option>
                          <option value="psicologia">Psicologia / Coaching</option>
                          <option value="outros">Outros</option>
                        </select>
                      </div>

                      <div className="grid gap-2">
                        <Label>Nome da Loja / Negócio *</Label>
                        <Input
                          value={commercialData.business_name}
                          onChange={(e) =>
                            setCommercialData({
                              ...commercialData,
                              business_name: e.target.value,
                            })
                          }
                          placeholder="Ex: Academia Força Total"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Descrição</Label>
                        <Textarea
                          value={commercialData.business_description}
                          onChange={(e) =>
                            setCommercialData({
                              ...commercialData,
                              business_description: e.target.value,
                            })
                          }
                          placeholder="Descreva seu negócio..."
                          className="min-h-20"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Telefone</Label>
                        <Input
                          type="tel"
                          value={formatPhoneDisplay(commercialData.business_phone)}
                          onChange={(e) => {
                            const rawValue = e.target.value.replace(/\D/g, "");
                            setCommercialData({
                              ...commercialData,
                              business_phone: rawValue,
                            });
                          }}
                          placeholder="(11) 9 9999-9999"
                          inputMode="numeric"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Email</Label>
                        <Input
                          type="email"
                          value={commercialData.business_email}
                          onChange={(e) =>
                            setCommercialData({
                              ...commercialData,
                              business_email: e.target.value,
                            })
                          }
                          placeholder="contato@negocio.com"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label>Site / Portfolio</Label>
                        <Input
                          type="url"
                          value={commercialData.business_website}
                          onChange={(e) =>
                            setCommercialData({
                              ...commercialData,
                              business_website: e.target.value,
                            })
                          }
                          placeholder="https://seu-site.com"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full flex-1"
                          onClick={() => setSignupStep(2)}
                        >
                          Voltar
                        </Button>
                        <Button
                          type="button"
                          className="rounded-full flex-1"
                          onClick={handleCommercialDataComplete}
                          disabled={!commercialData.business_name.trim() || !commercialData.business_segment}
                        >
                          Próximo
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Select Segments */}
                  {signupStep === 3 && (
                    <div className="grid gap-3">

                      <div className="grid gap-2">
                        {FITNESS_SEGMENTS.map((segment) => (
                          <button
                            key={segment.id}
                            type="button"
                            onClick={() => toggleSegment(segment.id)}
                            className={`flex items-center gap-3 rounded-lg border-2 p-3 transition-all ${
                              selectedSegments.has(segment.id)
                                ? "border-brand bg-brand/10"
                                : "border-border/60 hover:border-border"
                            }`}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                              selectedSegments.has(segment.id)
                                ? "border-brand bg-brand"
                                : "border-border/60"
                            }`}>
                              {selectedSegments.has(segment.id) && (
                                <Check className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <span className="text-sm font-medium">{segment.label}</span>
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full flex-1"
                          onClick={() => setSignupStep(2)}
                        >
                          Voltar
                        </Button>
                        <Button
                          type="button"
                          className="rounded-full flex-1"
                          onClick={handleSignupStep3}
                          disabled={selectedSegments.size === 0 || busy}
                        >
                          {busy ? "Criando..." : "Próximo"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Follow Users */}
                  {signupStep === 4 && (
                    <div className="grid gap-3">
                      <div className="text-center space-y-1 mb-2">
                        <h3 className="font-semibold text-sm">Encontre pessoas para seguir</h3>
                        <p className="text-xs text-muted-foreground">Busque por pessoas de interesse</p>
                      </div>

                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          type="text"
                          placeholder="Buscar pessoas..."
                          value={searchQuery}
                          onChange={(e) => {
                            const query = e.target.value;
                            setSearchQuery(query);
                            if (query.trim()) {
                              const filtered = availableUsers.filter(user =>
                                user.nickname.toLowerCase().includes(query.toLowerCase()) ||
                                (user.bio && user.bio.toLowerCase().includes(query.toLowerCase()))
                              );
                              setStep4SearchResults(filtered);
                            } else {
                              setStep4SearchResults(availableUsers);
                            }
                          }}
                          className="pl-10"
                        />
                      </div>

                      {loadingUsers ? (
                        <div className="flex justify-center py-8">
                          <div className="text-sm text-muted-foreground">Carregando pessoas...</div>
                        </div>
                      ) : step4SearchResults.length > 0 ? (
                        <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                          {step4SearchResults.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={async () => {
                                try {
                                  await followUserDb(user.id);
                                  toast({
                                    title: "Seguindo!",
                                    description: `Você agora segue ${user.nickname}`,
                                  });
                                } catch (err) {
                                  toast({
                                    title: "Erro ao seguir",
                                    description: "Não foi possível seguir este usuário",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              className="relative group rounded-lg overflow-hidden aspect-square bg-gradient-to-br from-brand/20 to-brand/10 border border-border/60 hover:border-brand transition-all"
                            >
                              {user.photo ? (
                                <img
                                  src={user.photo}
                                  alt={user.nickname}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-2">
                                  <div className="text-2xl font-bold text-brand">
                                    {user.nickname.charAt(0).toUpperCase()}
                                  </div>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2">
                                <p className="text-white text-xs font-semibold text-center line-clamp-2">
                                  {user.nickname}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 text-center">
                          <p className="text-sm text-muted-foreground">
                            Nenhuma pessoa encontrada
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full flex-1"
                          onClick={() => setSignupStep(3)}
                        >
                          Voltar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full flex-1"
                          onClick={handleSignupComplete}
                        >
                          Pular
                        </Button>
                        <Button
                          type="button"
                          className="rounded-full flex-1"
                          onClick={handleSignupComplete}
                        >
                          Finalizar
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
