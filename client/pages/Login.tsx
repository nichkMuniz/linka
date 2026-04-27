import * as React from "react";

import { NativeBiometric } from "@/lib/biometric-plugin";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { SignInWithApple, type SignInWithAppleResponse } from "@capacitor-community/apple-sign-in";
import { Capacitor } from "@capacitor/core";
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
  checkSupabaseReachability,
  getNetworkStatus,
} from "@/lib/network-status";
import { Fingerprint, Upload, X, Check, ArrowLeft, Eye, EyeOff, Plus, Trash2, Chrome } from "lucide-react";
import { useTheme } from "next-themes";
import { createOrUpdateCommercialProfileDb, saveCommercialPlansDb, type ServicePlan, checkEmailExistsDb } from "@/lib/ritmofit-db";
import { ImageCropperDrawer } from "@/components/shared/image-cropper-drawer";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(url: string) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.includes(".");
  } catch {
    return false;
  }
}

function isStrongPassword(pwd: string) {
  return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[^a-zA-Z0-9]/.test(pwd);
}

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
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === "dark"
    ? "/logo-horizontal-icone-branco.png"
    : "/logo-horizontal-icone-preto.png";
  return (
    <div className="flex items-center justify-center">
      <img src={logoSrc} alt="LinKa" className="h-28 w-auto" />
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
  const { resolvedTheme } = useTheme();

  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 5500);
    return () => clearTimeout(timer);
  }, []);

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
  const [pendingLoginPhotoCropSrc, setPendingLoginPhotoCropSrc] = React.useState<string | null>(null);
  const pendingLoginPhotoFileRef = React.useRef<File | null>(null);
  const [pendingLoginLogoCropSrc, setPendingLoginLogoCropSrc] = React.useState<string | null>(null);
  const pendingLoginLogoFileRef = React.useRef<File | null>(null);
  const [bio, setBio] = React.useState("");
  const [hasCommercialProfile, setHasCommercialProfile] = React.useState(false);
  const [selectedSegments, setSelectedSegments] = React.useState<Set<string>>(new Set());
  const [signupEmailExists, setSignupEmailExists] = React.useState<boolean | null>(null);
  const [checkingSignupEmail, setCheckingSignupEmail] = React.useState(false);
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = React.useState("");
  const [isResettingPassword, setIsResettingPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [newPassword, setNewPassword] = React.useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = React.useState("");
  const [showNewPwd, setShowNewPwd] = React.useState(false);
  const [showNewPwdConfirm, setShowNewPwdConfirm] = React.useState(false);
  const [isSavingNewPassword, setIsSavingNewPassword] = React.useState(false);
  const [commercialData, setCommercialData] = React.useState({
    business_segment: "",
    business_name: "",
    business_description: "",
    business_phone: "",
    business_email: "",
    business_website: "",
  });
  const [username, setUsername] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [age, setAge] = React.useState("");
  const [height, setHeight] = React.useState("");
  const [weight, setWeight] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [commercialWizardStep, setCommercialWizardStep] = React.useState(1);
  const [businessLogoFile, setBusinessLogoFile] = React.useState<File | null>(null);
  const [businessLogoPreview, setBusinessLogoPreview] = React.useState<string>("");
  const [servicePlans, setServicePlans] = React.useState<ServicePlan[]>([{ name: "", price: null, description: "" }]);
  const [isCompletingSignup, setIsCompletingSignup] = React.useState(false);
  // true quando o usuário autenticou via OAuth (Google/Apple) mas ainda não tem perfil completo
  const [isOAuthSignup, setIsOAuthSignup] = React.useState(false);

  const BIOMETRIC_SERVER = "linka.app";

  const canSubmit =
    !busy &&
    email.trim().length > 0 &&
    password.trim().length >= 6 &&
    hasSupabaseConfig &&
    networkStatus.isOnline;

  React.useEffect(() => {
    const unsubscribe = addNetworkStatusListener((status) => {
      setNetworkStatus(status);
    });

    return unsubscribe;
  }, []);

  const biometricAutoTriggeredRef = React.useRef(false);
  // Ref to avoid stale-closure issues when auto-triggering from useEffect
  const biometricAvailableRef = React.useRef(false);

  React.useEffect(() => {
    const checkBiometric = async () => {
      try {
        const result = await NativeBiometric.isAvailable({ useFallback: false });
        setBiometricAvailable(result.isAvailable);
        biometricAvailableRef.current = result.isAvailable;
        if (result.isAvailable) {
          // Check Keychain directly instead of relying on localStorage (survives reinstalls)
          try {
            await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER });
            setHasBiometricRegistered(true);
            localStorage.setItem("biometric_registered", "true");
            // Auto-trigger Face ID on app open if credentials exist
            if (!biometricAutoTriggeredRef.current) {
              biometricAutoTriggeredRef.current = true;
              // Small delay to let the UI render first, then trigger Face ID prompt directly
              setTimeout(() => triggerBiometricLogin(), 600);
            }
          } catch {
            // No credentials in Keychain — reset localStorage flag
            localStorage.removeItem("biometric_registered");
            setHasBiometricRegistered(false);
          }
        }
      } catch {
        setBiometricAvailable(false);
        biometricAvailableRef.current = false;
      }
    };
    checkBiometric();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if signup email already exists — debounced 600ms
  React.useEffect(() => {
    if (tab !== "signup" || signupStep !== 1) return;
    if (!isValidEmail(email)) {
      setSignupEmailExists(null);
      return;
    }
    setCheckingSignupEmail(true);
    const timer = setTimeout(async () => {
      const exists = await checkEmailExistsDb(email);
      setSignupEmailExists(exists);
      setCheckingSignupEmail(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [email, tab, signupStep]);

  // Detect password recovery session via Supabase auth event
  React.useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setShowNewPassword(true);
        window.history.replaceState(null, "", window.location.pathname);
      }
    });
    return () => subscription.unsubscribe();
  }, []);


  React.useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    if (isCompletingSignup) return;
    if (showNewPassword) return;

    const deeplink = sessionStorage.getItem("deeplink_redirect");
    if (deeplink) {
      sessionStorage.removeItem("deeplink_redirect");
      navigate(deeplink, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [authLoading, user, navigate, isCompletingSignup, showNewPassword]);

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
        // On iOS, the network may not be fully ready on app launch. If unreachable,
        // wait up to 3s for the connection to stabilize before attempting login.
        if (!networkStatus.isSupabaseReachable) {
          await checkSupabaseReachability();
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const attemptLogin = () =>
          supabase!.auth.signInWithPassword({
            email: trimmedEmail,
            password: trimmedPassword,
          });

        let { error } = await attemptLogin();

        // Auto-retry once on network/fetch errors (common on iOS cold start)
        if (error && (error.message.toLowerCase().includes("fetch") || error.message.toLowerCase().includes("network") || error.message.toLowerCase().includes("failed"))) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          ({ error } = await attemptLogin());
        }

        if (error) {
          if (isEmailNotConfirmed(error.message)) {
            toast({
              title: "Email não confirmado",
              description:
                "Seu Supabase está exigindo confirmação por email. Para desativar: Supabase Dashboard → Authentication → Providers → Email → desmarque \"Confirm email\".",
            });
            return;
          }

          const isInvalidCredentials =
            error.message.toLowerCase().includes("invalid login credentials") ||
            error.message.toLowerCase().includes("invalid credentials") ||
            error.message.toLowerCase().includes("email not found") ||
            error.message.toLowerCase().includes("wrong password");

          toast({
            title: "Não foi possível entrar",
            description: isInvalidCredentials
              ? "Email ou senha incorretos. Verifique os dados e tente novamente."
              : error.message,
            variant: "destructive",
          });
          return;
        }

        toast({
          title: "Login feito",
          description: "Bem-vindo de volta.",
        });

        // Offer biometric registration if available and not yet registered
        if (biometricAvailable && !hasBiometricRegistered) {
          setShowBiometricSetup(true);
          return;
        }

        navigate("/", { replace: true });
        return;
      }

      // Handle signup step 1: email and password validation
      if (signupStep === 1) {
        if (!isValidEmail(email)) {
          toast({
            title: "Email inválido",
            description: "Informe um endereço de email válido (ex: nome@dominio.com).",
            variant: "destructive",
          });
          setBusy(false);
          return;
        }

        if (!isStrongPassword(password)) {
          toast({
            title: "Senha fraca",
            description: "Sua senha deve ter ao menos 8 caracteres, 1 letra maiúscula e 1 caractere especial.",
            variant: "destructive",
          });
          setBusy(false);
          return;
        }

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

        setSignupStep(2);
        setBusy(false);
        return;
      }

    } catch (err: any) {
      const message = err?.message || err?.error_description || String(err);
      const isNetworkError = !navigator.onLine || message.toLowerCase().includes("fetch") || message.toLowerCase().includes("network");
      toast({
        title: isNetworkError ? "Falha de conexão" : "Erro ao entrar",
        description: isNetworkError
          ? "Verifique sua conexão e tente novamente."
          : message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (file) {
      pendingLoginPhotoFileRef.current = file;
      const reader = new FileReader();
      reader.onloadend = () => setPendingLoginPhotoCropSrc(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBusinessLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (file) {
      pendingLoginLogoFileRef.current = file;
      const reader = new FileReader();
      reader.onloadend = () => setPendingLoginLogoCropSrc(reader.result as string);
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
    if (!username.trim()) {
      toast({
        title: "@usuário obrigatório",
        description: "Por favor, informe seu @.",
      });
      return;
    }
    // If commercial profile, go to commercial data wizard, else go to physical data step
    if (hasCommercialProfile) {
      setCommercialWizardStep(1);
      setSignupStep(2.5);
    } else {
      setSignupStep(2.8);
    }
  };

  const handleCommercialDataComplete = () => {
    if (!commercialData.business_name.trim() || !commercialData.business_segment) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Segmento e Nome da vitrine são obrigatórios.",
        variant: "destructive",
      });
      return;
    }
    setCommercialWizardStep(4);
  };

  const handleCommercialPlansComplete = () => {
    setSignupStep(2.8);
  };

  const handleSignupStep3 = async () => {
    if (!hasSupabaseConfig || !supabase) return;

    setIsCompletingSignup(true);
    setBusy(true);
    try {
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();

      // Create user auth account — all profile fields go into
      // raw_user_meta_data so handle_new_user trigger can read them
      const signUpMeta: Record<string, any> = {
        full_name: displayName.trim(),
      };
      if (username.trim()) signUpMeta.handle = username.trim();
      if (bio.trim()) signUpMeta.bio = bio.trim();
      if (selectedSegments.size > 0) signUpMeta.objectives = [...selectedSegments];
      if (gender) signUpMeta.gender = gender;
      if (age) signUpMeta.age = parseInt(age, 10);
      if (height) signUpMeta.height = parseFloat(height);
      if (weight) signUpMeta.weight = parseFloat(weight);

      if (!isOAuthSignup) {
        // On iOS, network may not be stable on app launch — wait if unreachable
        if (!networkStatus.isSupabaseReachable) {
          await checkSupabaseReachability();
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const attemptSignUp = () =>
          supabase!.auth.signUp({
            email: trimmedEmail,
            password: trimmedPassword,
            options: { data: signUpMeta },
          });

        let { error: signUpError } = await attemptSignUp();

        // Auto-retry once on network errors (common on iOS cold start)
        if (signUpError && (signUpError.message.toLowerCase().includes("fetch") || signUpError.message.toLowerCase().includes("network") || signUpError.message.toLowerCase().includes("failed"))) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          ({ error: signUpError } = await attemptSignUp());
        }

        if (signUpError) {
          const signUpErrMsg = signUpError.message?.toLowerCase() || "";
          if (signUpErrMsg.includes("already registered") || signUpErrMsg.includes("user already registered")) {
            toast({
              title: "Usuário já cadastrado",
              description: "Este email já está sendo usado. Faça login ou use outro email.",
              variant: "destructive",
            });
          } else {
            toast({ title: "Não foi possível criar a conta", description: signUpError.message });
          }
          setIsCompletingSignup(false);
          return;
        }

        // Sign in after signup
        const { error: signInError } = await supabase!.auth.signInWithPassword({
          email: trimmedEmail,
          password: trimmedPassword,
        });

        if (signInError && !isEmailNotConfirmed(signInError.message)) {
          toast({ title: "Conta criada, mas não foi possível entrar", description: signInError.message });
          setIsCompletingSignup(false);
          return;
        }
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

        // Build profile update payload
        const profilePayload: Record<string, any> = {};
        if (authUser.email) profilePayload.email = authUser.email;
        if (photoUrl) profilePayload.photo = photoUrl;
        if (displayName.trim()) profilePayload.nickname = displayName.trim();
        if (bio.trim()) profilePayload.bio = bio.trim();
        if (selectedSegments.size > 0) profilePayload.objectives = [...selectedSegments];
        if (username.trim()) profilePayload.handle = username.trim().toLowerCase();
        if (gender) profilePayload.gender = gender;
        if (age) profilePayload.age = parseInt(age, 10);
        if (height) profilePayload.height = parseFloat(height);
        if (weight) profilePayload.weight = parseFloat(weight);

        if (Object.keys(profilePayload).length > 0) {
          await supabase
            .from("profiles")
            .upsert(
              { user_id: authUser.id, ...profilePayload, updated_at: new Date().toISOString() },
              { onConflict: "user_id" },
            );
        }

        // Save commercial profile if user selected it
        if (hasCommercialProfile && (commercialData.business_name.trim() || commercialData.business_segment)) {
          try {
            // Upload business logo if provided
            let businessLogoUrl: string | undefined;
            if (businessLogoFile) {
              const extension = businessLogoFile.name.split(".").pop() || "jpg";
              const filePath = `${authUser.id}/business-logo-${Date.now()}.${extension}`;
              const { error: logoUploadError } = await supabase.storage
                .from("posts")
                .upload(filePath, businessLogoFile, { contentType: businessLogoFile.type });
              if (!logoUploadError) {
                const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(filePath);
                businessLogoUrl = publicUrl;
              }
            }

            await createOrUpdateCommercialProfileDb(authUser.id, {
              business_segment: commercialData.business_segment,
              business_name: commercialData.business_name,
              business_description: commercialData.business_description,
              business_phone: commercialData.business_phone,
              business_email: commercialData.business_email,
              business_website: commercialData.business_website,
              ...(businessLogoUrl ? { business_logo_url: businessLogoUrl } : {}),
              is_active: true,
            });

            // Save service plans if any were added
            if (servicePlans.length > 0) {
              await saveCommercialPlansDb(authUser.id, servicePlans);
            }
          } catch (commercialErr) {
            console.error("Error saving commercial profile:", commercialErr);
            // Non-fatal: continue signup flow
          }
        }

        // Persist selected segments to localStorage for feed personalization
        if (selectedSegments.size > 0) {
          localStorage.setItem("user_fitness_segments", JSON.stringify([...selectedSegments]));
        }

        // Force reload user profile so photo appears immediately in feed
        await supabase.auth.getSession();
      }

      // After Step 3 (objectives), complete signup directly instead of going to Step 4
      handleSignupComplete();
    } catch (err: any) {
      const message = err?.message || err?.error_description || String(err);
      const isNetworkError = !navigator.onLine || message.toLowerCase().includes("fetch") || message.toLowerCase().includes("network");
      toast({
        title: isNetworkError ? "Falha de conexão" : "Erro ao criar conta",
        description: isNetworkError
          ? "Verifique sua conexão e tente novamente."
          : message,
        variant: "destructive",
      });
      setIsCompletingSignup(false);
    } finally {
      setBusy(false);
    }
  };

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
      const emailExists = await checkEmailExistsDb(forgotPasswordEmail.trim());
      if (!emailExists) {
        toast({
          title: "Email não encontrado",
          description: "Não encontramos nenhuma conta com esse email. Verifique e tente novamente.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(forgotPasswordEmail.trim(), {
        redirectTo: `${window.location.origin}/login`,
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

  const handleSaveNewPassword = async () => {
    if (!supabase) return;
    if (!isStrongPassword(newPassword)) {
      toast({
        title: "Senha fraca",
        description: "Sua senha deve ter ao menos 8 caracteres, 1 letra maiúscula e 1 caractere especial.",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast({
        title: "Senhas não conferem",
        description: "As senhas informadas são diferentes.",
        variant: "destructive",
      });
      return;
    }
    setIsSavingNewPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({
          title: "Erro ao redefinir senha",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      await supabase.auth.signOut();
      toast({
        title: "Senha redefinida!",
        description: "Faça login com sua nova senha.",
      });
      setShowNewPassword(false);
      setNewPassword("");
      setNewPasswordConfirm("");
      setTab("login");
    } catch {
      toast({
        title: "Erro de conexão",
        description: "Não foi possível redefinir a senha. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSavingNewPassword(false);
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

    // Flag: new user should land on Descobrir tab
    localStorage.setItem("new_user_open_discover", "1");
    // Flag: force profile reload in feed (so photo appears immediately)
    localStorage.setItem("force_profile_reload", "1");

    setIsCompletingSignup(false);
    setIsOAuthSignup(false);
    navigate("/", { replace: true });
  };

  const handleRegisterBiometric = async (redirectAfter: boolean = false) => {
    if (!biometricAvailable) {
      toast({ title: "Biometria não disponível", description: "Seu dispositivo não suporta autenticação biométrica." });
      return;
    }
    setBusy(true);
    try {
      // Verify identity with Face ID / Touch ID before storing credentials
      await NativeBiometric.verifyIdentity({
        reason: "Confirme sua identidade para registrar o Face ID",
        title: "Registro biométrico",
        useFallback: true,
      });

      // Store credentials securely in the iOS Keychain
      await NativeBiometric.setCredentials({
        username: email,
        password: password,
        server: BIOMETRIC_SERVER,
      });

      localStorage.setItem("biometric_registered", "true");
      localStorage.setItem("biometric_email", email);

      toast({ title: "Biometria registrada", description: "Você pode usar Face ID para próximos logins." });

      if (redirectAfter) {
        setShowBiometricSetup(false);
        navigate("/", { replace: true });
      }
    } catch (err: any) {
      console.error("Biometric registration error:", err);
      // User cancelled — don't show error toast
      if (err?.code !== 16 && err?.message !== "User cancelled") {
        toast({ title: "Erro ao registrar biometria", description: err?.message || "Tente novamente." });
      }
      if (redirectAfter) {
        setShowBiometricSetup(false);
        navigate("/", { replace: true });
      }
    } finally {
      setBusy(false);
    }
  };

  // Core biometric login logic — called both from button click and auto-trigger on app open.
  // Uses ref for biometricAvailable to avoid stale-closure issues when called from setTimeout.
  const triggerBiometricLogin = async () => {
    if (!biometricAvailableRef.current) return;
    setBusy(true);
    try {
      // Step 1: show Face ID / Touch ID prompt to authenticate the user
      await NativeBiometric.verifyIdentity({
        reason: "Autentique-se para acessar sua conta",
        title: "Face ID",
        useFallback: true,
      });

      // Step 2: retrieve stored credentials from Keychain (only reached if step 1 succeeded)
      const credentials = await NativeBiometric.getCredentials({ server: BIOMETRIC_SERVER });

      if (!supabase) throw new Error("Supabase não configurado");
      const { error } = await supabase.auth.signInWithPassword({
        email: credentials.username,
        password: credentials.password,
      });

      if (error) {
        // Password changed — clear keychain entry so user re-registers
        await NativeBiometric.deleteCredentials({ server: BIOMETRIC_SERVER }).catch(() => {});
        localStorage.removeItem("biometric_registered");
        localStorage.removeItem("biometric_email");
        setHasBiometricRegistered(false);
        toast({
          title: "Falha no login biométrico",
          description: "Sua senha pode ter sido alterada. Faça login com email e senha para reativar o Face ID.",
        });
        return;
      }

      toast({ title: "Bem-vindo!", description: "Login com Face ID realizado com sucesso." });
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Biometric login error:", err);
      // User cancelled (code -2 / LAError.userCancel) — silent
      const code = err?.code ?? err?.errorCode;
      if (code !== -2 && code !== 16 && err?.message !== "User cancelled") {
        toast({ title: "Erro na autenticação biométrica", description: err?.message || "Tente novamente." });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!biometricAvailableRef.current) {
      toast({ title: "Biometria não disponível", description: "Seu dispositivo não suporta autenticação biométrica." });
      return;
    }
    await triggerBiometricLogin();
  };

  // Deep link handler para callback do OAuth (Google)
  React.useEffect(() => {
    if (!supabase) return;

    const listener = CapApp.addListener("appUrlOpen", async ({ url }) => {
      if (!url.includes("login-callback")) return;

      await Browser.close().catch(() => {});

      // PKCE flow — troca o code pela sessão
      const { error } = await supabase!.auth.exchangeCodeForSession(url);
      if (error) {
        toast({
          title: "Erro ao autenticar",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      await checkAndRouteAfterOAuth();
    });

    return () => {
      listener.then((l) => l.remove());
    };
  }, []);

  // Após OAuth bem-sucedido: verifica se já existe conta com esse email
  // 1. Perfil vinculado ao user_id OAuth → usuário já completou cadastro → feed
  // 2. Perfil com mesmo email mas user_id diferente → conta criada via email/senha → avisa e desloga
  // 3. Sem perfil → novo usuário → fluxo de cadastro a partir do step 2
  const checkAndRouteAfterOAuth = async () => {
    if (!supabase) return;

    const { data: { user: oauthUser } } = await supabase.auth.getUser();
    if (!oauthUser) return;

    // 1. Verifica perfil pelo user_id do OAuth
    const { data: profileById } = await supabase
      .from("profiles")
      .select("handle, nickname, email")
      .eq("user_id", oauthUser.id)
      .maybeSingle();

    if (profileById?.handle) {
      navigate("/", { replace: true });
      return;
    }

    // 2. Verifica se existe perfil com o mesmo email (conta criada via email/senha)
    const oauthEmail = oauthUser.email ?? "";
    if (oauthEmail) {
      const { data: profileByEmail } = await supabase
        .from("profiles")
        .select("user_id, handle")
        .eq("email", oauthEmail)
        .maybeSingle();

      if (profileByEmail?.handle) {
        // Conta já existe com outro método — desloga e orienta o usuário
        await supabase.auth.signOut();
        toast({
          title: "Conta já existente",
          description: `Você já tem uma conta com o email ${oauthEmail}. Faça login com email e senha.`,
          variant: "destructive",
        });
        setTab("login");
        setEmail(oauthEmail);
        return;
      }
    }

    // 3. Novo usuário via OAuth — pré-preenche e abre fluxo de perfil
    setEmail(oauthEmail);
    if (oauthUser.user_metadata?.full_name) {
      setDisplayName(String(oauthUser.user_metadata.full_name));
    }
    setIsOAuthSignup(true);
    setIsCompletingSignup(true);
    setTab("signup");
    setSignupStep(2);
    toast({
      title: "Bem-vindo!",
      description: "Complete seu perfil para continuar.",
    });
  };

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: "com.linka.meuapp://login-callback",
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        toast({
          title: "Erro ao iniciar login",
          description: error?.message ?? "URL de autenticação não gerada.",
          variant: "destructive",
        });
        return;
      }

      await Browser.open({ url: data.url, windowName: "_self" });
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err?.message || "Não foi possível abrir o login com Google.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAppleLogin = async () => {
    if (!supabase) return;
    setBusy(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // iOS nativo: usa o plugin — abre a tela nativa do sistema, sem browser
        const rawNonce = Math.random().toString(36).substring(2);
        const encoder = new TextEncoder();
        const data = encoder.encode(rawNonce);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashedNonce = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        const response: SignInWithAppleResponse = await SignInWithApple.authorize({
          clientId: "com.linka.meuapp",
          redirectURI: "https://zymkndqpashqxcvttdlc.supabase.co/auth/v1/callback",
          scopes: "name email",
          nonce: hashedNonce,
        });

        const identityToken = response.response?.identityToken;
        if (!identityToken) throw new Error("Token da Apple não retornado.");

        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: identityToken,
          nonce: rawNonce,
        });

        if (error) {
          toast({
            title: "Erro ao autenticar com Apple",
            description: error.message,
            variant: "destructive",
          });
          return;
        }

        await checkAndRouteAfterOAuth();
      } else {
        // Web / browser: usa o fluxo OAuth do Supabase (igual ao Google)
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "apple",
          options: {
            redirectTo: `${window.location.origin}/login`,
            skipBrowserRedirect: false,
          },
        });

        if (error || !data.url) {
          toast({
            title: "Erro ao iniciar login",
            description: error?.message ?? "URL de autenticação não gerada.",
            variant: "destructive",
          });
        }
      }
    } catch (err: any) {
      // Usuário cancelou — não exibir erro
      if (err?.code === "1001" || err?.message?.includes("cancel")) return;
      toast({
        title: "Erro ao entrar com Apple",
        description: err?.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (showSplash) {
    return (
      <div className="grid min-h-dvh place-items-center" style={{ backgroundColor: "#FCFCFF" }}>
        <img
          src="/logo-animada-v2.gif"
          alt="LinKa"
          className="w-50 h-50 object-contain"
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="mx-auto grid w-full max-w-md gap-6 my-auto">
        <BrandHeader />

        <Card className="border-border/60 relative">
          {!showForgotPassword && !showNewPassword && (
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
            {showNewPassword ? (
              <div className="grid gap-4">
                <div className="grid gap-1">
                  <p className="text-sm font-semibold">Redefinir senha</p>
                  <p className="text-xs text-muted-foreground">Crie uma nova senha para sua conta.</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="new_password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="new_password"
                      type={showNewPwd ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Crie uma senha forte"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {newPassword.length > 0 && (
                    <ul className="grid gap-1 mt-1">
                      {[
                        { ok: newPassword.length >= 8, label: "Mínimo de 8 caracteres" },
                        { ok: /[A-Z]/.test(newPassword), label: "Pelo menos 1 letra maiúscula" },
                        { ok: /[^a-zA-Z0-9]/.test(newPassword), label: "Pelo menos 1 caractere especial (!@#$...)" },
                      ].map(({ ok, label }) => (
                        <li key={label} className={`flex items-center gap-1.5 text-xs ${ok ? "text-green-600" : "text-muted-foreground"}`}>
                          {ok ? <Check className="h-3 w-3 shrink-0" /> : <span className="h-3 w-3 shrink-0 rounded-full border border-current inline-block" />}
                          {label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="new_password_confirm">Confirmar nova senha</Label>
                  <div className="relative">
                    <Input
                      id="new_password_confirm"
                      type={showNewPwdConfirm ? "text" : "password"}
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPwdConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPwdConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {newPasswordConfirm.length > 0 && newPassword !== newPasswordConfirm && (
                    <p className="text-xs text-red-600">❌ As senhas não conferem</p>
                  )}
                  {newPasswordConfirm.length > 0 && newPassword === newPasswordConfirm && isStrongPassword(newPassword) && (
                    <p className="text-xs text-green-600">✓ Senhas conferem</p>
                  )}
                </div>

                <Button
                  className="rounded-full"
                  disabled={!isStrongPassword(newPassword) || newPassword !== newPasswordConfirm || isSavingNewPassword}
                  onClick={handleSaveNewPassword}
                >
                  {isSavingNewPassword ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </div>
            ) : !networkStatus.isOnline ? (
              <div className="rounded-2xl border border-red-200/30 bg-red-50/20 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-200">
                Você parece estar offline. Verifique sua conexão com a internet.
              </div>
            ) : !networkStatus.isSupabaseReachable ? (
              <div className="rounded-2xl border border-yellow-200/30 bg-yellow-50/20 p-4 text-sm text-yellow-700 dark:border-yellow-900/30 dark:bg-yellow-950/20 dark:text-yellow-200">
                Não foi possível alcançar o Supabase. Pode ser um problema de CORS ou conectividade. Tente novamente em alguns momentos.
              </div>
            ) : null}

            {!showNewPassword && <>

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
            ) : user && !isCompletingSignup ? (
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
                    className={forgotPasswordEmail.length > 0 && !isValidEmail(forgotPasswordEmail) ? "border-red-500" : ""}
                  />
                  {forgotPasswordEmail.length > 0 && !isValidEmail(forgotPasswordEmail) && (
                    <p className="text-xs text-red-600">❌ Informe um email válido (ex: nome@dominio.com)</p>
                  )}
                </div>

                <Button
                  type="button"
                  className="rounded-full w-full"
                  onClick={handleResetPassword}
                  disabled={isResettingPassword || !isValidEmail(forgotPasswordEmail)}
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
                    className="rounded-full rounded-full data-[state=active]:bg-brand-gradient data-[state=active]:text-white data-[state=active]:shadow-md"
                  >
                    Entrar
                  </TabsTrigger>
                  <TabsTrigger
                    value="signup"
                    className="rounded-full rounded-full data-[state=active]:bg-brand-gradient data-[state=active]:text-white data-[state=active]:shadow-md"
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
                        onFocus={() => {
                          if (hasBiometricRegistered && !busy) handleBiometricLogin();
                        }}
                        placeholder="voce@exemplo.com"
                        autoComplete="email"
                        className={email.length > 0 && !isValidEmail(email) ? "border-red-500" : ""}
                      />
                      {email.length > 0 && !isValidEmail(email) && (
                        <p className="text-xs text-red-600">❌ Informe um email válido (ex: nome@dominio.com)</p>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="login_password">Senha</Label>
                      <div className="relative">
                        <Input
                          id="login_password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onFocus={() => {
                            if (hasBiometricRegistered && !busy) handleBiometricLogin();
                          }}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
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

                    <div className="relative my-1">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/60" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-card px-2 text-muted-foreground">ou continue com</span>
                      </div>
                    </div>

                    <div className="flex gap-3 justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full flex-1 flex items-center justify-center h-11"
                        disabled={busy}
                        onClick={handleGoogleLogin}
                        aria-label="Continuar com Google"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full flex-1 flex items-center justify-center h-11"
                        disabled={busy}
                        onClick={handleAppleLogin}
                        aria-label="Continuar com Apple"
                      >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                        </svg>
                      </Button>
                    </div>

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
                  {/* Step progress indicator */}
                  {(() => {
                    const totalSteps = 4;
                    const step = signupStep === 2.5 ? 2 : signupStep === 2.8 ? 3 : signupStep === 3 ? 4 : Math.ceil(signupStep as number);
                    return (
                      <div className="mb-4 space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Etapa {step} de {totalSteps}</span>
                          <span>{Math.round((step / totalSteps) * 100)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-brand rounded-full transition-all duration-300"
                            style={{ width: `${(step / totalSteps) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Step 1: Email and Password — oculto no fluxo OAuth (auth já feita) */}
                  {signupStep === 1 && !isOAuthSignup && (
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
                          onChange={(e) => { setEmail(e.target.value); setSignupEmailExists(null); }}
                          placeholder="voce@exemplo.com"
                          autoComplete="email"
                          className={
                            (email.length > 0 && !isValidEmail(email)) || signupEmailExists === true
                              ? "border-red-500"
                              : signupEmailExists === false
                              ? "border-green-500"
                              : ""
                          }
                        />
                        {email.length > 0 && !isValidEmail(email) && (
                          <p className="text-xs text-red-600">❌ Informe um email válido (ex: nome@dominio.com)</p>
                        )}
                        {isValidEmail(email) && checkingSignupEmail && (
                          <p className="text-xs text-muted-foreground">Verificando email...</p>
                        )}
                        {isValidEmail(email) && !checkingSignupEmail && signupEmailExists === true && (
                          <p className="text-xs text-red-600">❌ Este email já está cadastrado. Faça login ou recupere sua senha.</p>
                        )}
                        {isValidEmail(email) && !checkingSignupEmail && signupEmailExists === false && (
                          <p className="text-xs text-green-600">✓ Email disponível</p>
                        )}
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="signup_password">Senha</Label>
                        <div className="relative">
                          <Input
                            id="signup_password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Crie uma senha forte"
                            autoComplete="new-password"
                            className="pr-10 [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {password.length > 0 && (
                          <ul className="grid gap-1 mt-1">
                            {[
                              { ok: password.length >= 8, label: "Mínimo de 8 caracteres" },
                              { ok: /[A-Z]/.test(password), label: "Pelo menos 1 letra maiúscula" },
                              { ok: /[^a-zA-Z0-9]/.test(password), label: "Pelo menos 1 caractere especial (!@#$...)" },
                            ].map(({ ok, label }) => (
                              <li key={label} className={`flex items-center gap-1.5 text-xs ${ok ? "text-green-600" : "text-muted-foreground"}`}>
                                {ok ? <Check className="h-3 w-3 shrink-0" /> : <span className="h-3 w-3 shrink-0 rounded-full border border-current inline-block" />}
                                {label}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="signup_confirm_password">Confirmar Senha</Label>
                        <div className="relative">
                          <Input
                            id="signup_confirm_password"
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirme sua senha"
                            autoComplete="new-password"
                            className={`pr-10 [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden ${confirmPassword && password !== confirmPassword ? "border-red-500" : ""}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showConfirmPassword ? "Ocultar confirmação" : "Mostrar confirmação"}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {confirmPassword && password !== confirmPassword && (
                          <p className="text-xs text-red-600">❌ As senhas não conferem</p>
                        )}
                        {confirmPassword && password === confirmPassword && isStrongPassword(password) && (
                          <p className="text-xs text-green-600">✓ Senhas conferem</p>
                        )}
                      </div>

                      <Button
                        type="submit"
                        className="mt-2 rounded-full"
                        disabled={!isValidEmail(email) || signupEmailExists !== false || checkingSignupEmail || !isStrongPassword(password) || password !== confirmPassword || busy}
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
                        <Label htmlFor="signup_username">@ de usuário</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
                          <Input
                            id="signup_username"
                            type="text"
                            value={username}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^a-zA-Z0-9_.]/g, "").replace(/\s/g, "");
                              setUsername(val);
                            }}
                            placeholder="seunome"
                            autoComplete="off"
                            className="pl-7"
                            maxLength={30}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Apenas letras, números, _ e . Sem espaços.</p>
                      </div>

                      <div className="grid gap-2">
                        <Label>Foto de perfil <span className="text-xs text-muted-foreground font-normal">(opcional)</span></Label>
                        <div className="flex items-center gap-3">
                          {photoPreview ? (
                            <div className="relative w-16 h-16 shrink-0">
                              <img src={photoPreview} alt="Preview" className="w-16 h-16 rounded-full object-cover border-2 border-border/60" />
                              <button
                                type="button"
                                onClick={() => { setPhotoFile(null); setPhotoPreview(""); }}
                                className="absolute -top-1 -right-1 z-10 bg-black/70 text-white p-0.5 rounded-full border border-white/30"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-muted border-2 border-dashed border-border/60 flex items-center justify-center shrink-0">
                              <Upload className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <label className="relative flex-1">
                            <Button type="button" variant="outline" className="rounded-full w-full" asChild>
                              <span>{photoFile ? "Mudar foto" : "Adicionar foto"}</span>
                            </Button>
                            <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                          </label>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="signup_bio">Bio <span className="text-xs text-muted-foreground font-normal">(opcional)</span></Label>
                        <Textarea
                          id="signup_bio"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Conte um pouco sobre você..."
                          className="min-h-16 resize-none"
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
                          disabled={!displayName.trim() || !username.trim()}
                        >
                          Próximo
                        </Button>
                      </div>

                      {/* Skip option */}
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
                        onClick={() => {
                          if (!displayName.trim()) {
                            toast({ title: "Nome obrigatório", description: "Por favor, informe seu nome.", variant: "destructive" });
                            return;
                          }
                          if (!username.trim()) {
                            toast({ title: "@usuário obrigatório", description: "Por favor, informe seu @.", variant: "destructive" });
                            return;
                          }
                          setSignupStep(2.8);
                        }}
                      >
                        Personalizar foto e bio depois →
                      </button>
                    </div>
                  )}

                  {/* Step 2.5: Commercial Data Wizard */}
                  {signupStep === 2.5 && (
                    <div className="grid gap-4">
                      {/* Wizard header */}
                      <div className="text-center space-y-1">
                        <h3 className="font-semibold text-sm">Perfil Comercial</h3>
                        <p className="text-xs text-muted-foreground">
                          {commercialWizardStep === 1 && "Informações principais do seu negócio"}
                          {commercialWizardStep === 2 && "Como seus clientes podem te contatar?"}
                          {commercialWizardStep === 3 && "Presença online (opcional)"}
                          {commercialWizardStep === 4 && "Seus planos e serviços (opcional)"}
                        </p>
                      </div>

                      {/* Wizard progress dots */}
                      <div className="flex items-center justify-center gap-2">
                        {[1, 2, 3, 4].map((s) => (
                          <div
                            key={s}
                            className={`h-2 rounded-full transition-all duration-300 ${s === commercialWizardStep
                              ? "w-6 bg-brand"
                              : s < commercialWizardStep
                                ? "w-2 bg-brand/60"
                                : "w-2 bg-muted"
                              }`}
                          />
                        ))}
                      </div>

                      {/* Sub-step 1: Essentials */}
                      {commercialWizardStep === 1 && (
                        <div className="grid gap-3">
                          <div className="grid gap-2">
                            <Label>Segmento do negócio *</Label>
                            <select
                              value={commercialData.business_segment}
                              onChange={(e) =>
                                setCommercialData({ ...commercialData, business_segment: e.target.value })
                              }
                              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-foreground"
                            >
                              <option value="">Selecione um segmento</option>
                              <option value="academia">Academia / Fitness</option>
                              <option value="personal_trainer">Personal Trainer</option>
                              <option value="nutricionista">Nutricionista</option>
                              <option value="psicologo">Psicólogo</option>
                              <option value="fisioterapeuta">Fisioterapeuta</option>
                              <option value="coach">Coach</option>
                              <option value="outros">Outros</option>
                            </select>
                          </div>

                          <div className="grid gap-2">
                            <Label>Nome do negócio *</Label>
                            <Input
                              value={commercialData.business_name}
                              onChange={(e) =>
                                setCommercialData({ ...commercialData, business_name: e.target.value })
                              }
                              placeholder="Ex: Academia Força Total"
                            />
                          </div>

                          <div className="grid gap-2">
                            <Label>
                              Logo do negócio{" "}
                              <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                            </Label>
                            <div className="flex items-center gap-3">
                              {businessLogoPreview ? (
                                <div className="relative w-16 h-16 shrink-0">
                                  <img src={businessLogoPreview} alt="Logo preview" className="w-16 h-16 rounded-lg object-cover border-2 border-border/60" />
                                  <button
                                    type="button"
                                    onClick={() => { setBusinessLogoFile(null); setBusinessLogoPreview(""); }}
                                    className="absolute -top-1 -right-1 z-10 bg-black/70 text-white p-0.5 rounded-full border border-white/30"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="w-16 h-16 rounded-lg bg-muted border-2 border-dashed border-border/60 flex items-center justify-center shrink-0">
                                  <Upload className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              <label className="relative flex-1">
                                <Button type="button" variant="outline" className="rounded-full w-full" asChild>
                                  <span>{businessLogoFile ? "Mudar logo" : "Adicionar logo"}</span>
                                </Button>
                                <input type="file" accept="image/*" onChange={handleBusinessLogoChange} className="hidden" />
                              </label>
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <Label>
                              Descrição{" "}
                              <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                            </Label>
                            <Textarea
                              value={commercialData.business_description}
                              onChange={(e) =>
                                setCommercialData({ ...commercialData, business_description: e.target.value })
                              }
                              placeholder="Conte sobre seu negócio, diferenciais, etc..."
                              className="min-h-20 resize-none"
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
                              onClick={() => {
                                if (!commercialData.business_name.trim() || !commercialData.business_segment) {
                                  toast({
                                    title: "Preencha os campos obrigatórios",
                                    description: "Segmento e Nome do negócio são obrigatórios.",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                setCommercialWizardStep(2);
                              }}
                              disabled={!commercialData.business_name.trim() || !commercialData.business_segment}
                            >
                              Próximo
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Sub-step 2: Contact */}
                      {commercialWizardStep === 2 && (
                        <div className="grid gap-3">
                          <div className="grid gap-2">
                            <Label>
                              Telefone comercial{" "}
                              <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                            </Label>
                            <Input
                              type="tel"
                              value={formatPhoneDisplay(commercialData.business_phone)}
                              onChange={(e) => {
                                const rawValue = e.target.value.replace(/\D/g, "");
                                setCommercialData({ ...commercialData, business_phone: rawValue });
                              }}
                              placeholder="(11) 9 9999-9999"
                              inputMode="numeric"
                            />
                          </div>

                          <div className="grid gap-2">
                            <Label>
                              Email comercial{" "}
                              <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                            </Label>
                            <Input
                              type="email"
                              value={commercialData.business_email}
                              onChange={(e) =>
                                setCommercialData({ ...commercialData, business_email: e.target.value })
                              }
                              placeholder="contato@seunegocio.com"
                              className={commercialData.business_email && !isValidEmail(commercialData.business_email) ? "border-red-500" : ""}
                            />
                            {commercialData.business_email && !isValidEmail(commercialData.business_email) && (
                              <p className="text-xs text-red-500">Email inválido. Use o formato nome@dominio.com</p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full flex-1"
                              onClick={() => setCommercialWizardStep(1)}
                            >
                              Voltar
                            </Button>
                            <Button
                              type="button"
                              className="rounded-full flex-1"
                              disabled={!!(commercialData.business_email && !isValidEmail(commercialData.business_email))}
                              onClick={() => setCommercialWizardStep(3)}
                            >
                              Próximo
                            </Button>
                          </div>

                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
                            onClick={() => setCommercialWizardStep(3)}
                          >
                            Pular por agora →
                          </button>
                        </div>
                      )}

                      {/* Sub-step 3: Online presence */}
                      {commercialWizardStep === 3 && (
                        <div className="grid gap-3">
                          <div className="grid gap-2">
                            <Label>
                              Site / Portfolio{" "}
                              <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                            </Label>
                            <Input
                              type="url"
                              value={commercialData.business_website}
                              onChange={(e) =>
                                setCommercialData({ ...commercialData, business_website: e.target.value })
                              }
                              placeholder="https://seu-site.com"
                              className={commercialData.business_website && !isValidUrl(commercialData.business_website) ? "border-red-500" : ""}
                            />
                            {commercialData.business_website && !isValidUrl(commercialData.business_website) && (
                              <p className="text-xs text-red-500">URL inválida. Use o formato https://seu-site.com</p>
                            )}
                          </div>

                          <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">Resumo do seu perfil comercial:</p>
                            <p>📌 {commercialData.business_name} · {commercialData.business_segment}</p>
                            {commercialData.business_phone && <p>📞 {formatPhoneDisplay(commercialData.business_phone)}</p>}
                            {commercialData.business_email && <p>✉️ {commercialData.business_email}</p>}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full flex-1"
                              onClick={() => setCommercialWizardStep(2)}
                            >
                              Voltar
                            </Button>
                            <Button
                              type="button"
                              className="rounded-full flex-1"
                              disabled={!!(commercialData.business_website && !isValidUrl(commercialData.business_website))}
                              onClick={handleCommercialDataComplete}
                            >
                              Próximo
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Sub-step 4: Service Plans */}
                      {commercialWizardStep === 4 && (
                        <div className="grid gap-3">

                          {/* Lista de planos */}
                          <div className="space-y-3">
                            {servicePlans.map((plan, idx) => (
                              <div key={idx} className="rounded-lg border border-border/60 bg-card p-3 grid gap-3">
                                {/* Header do card com número e botão remover */}
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Plano {idx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label="Remover plano"
                                    onClick={() => setServicePlans(servicePlans.filter((_, i) => i !== idx))}
                                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>

                                {/* Nome */}
                                <div className="grid gap-1.5">
                                  <Label className="text-xs">Nome do plano *</Label>
                                  <Input
                                    value={plan.name}
                                    onChange={(e) => {
                                      const updated = [...servicePlans];
                                      updated[idx] = { ...updated[idx], name: e.target.value };
                                      setServicePlans(updated);
                                    }}
                                    placeholder="Ex: Mensal, Trimestral, Aula avulsa…"
                                  />
                                </div>

                                {/* Preço */}
                                <div className="grid gap-1.5">
                                  <Label className="text-xs">
                                    Preço{" "}
                                    <span className="text-muted-foreground font-normal">(deixe vazio para "sob consulta")</span>
                                  </Label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">R$</span>
                                    <Input
                                      type="number"
                                      inputMode="decimal"
                                      min={0}
                                      value={plan.price ?? ""}
                                      onChange={(e) => {
                                        const updated = [...servicePlans];
                                        updated[idx] = { ...updated[idx], price: e.target.value === "" ? null : parseFloat(e.target.value) };
                                        setServicePlans(updated);
                                      }}
                                      placeholder="0,00"
                                      className="pl-9"
                                    />
                                  </div>
                                </div>

                                {/* Descrição */}
                                <div className="grid gap-1.5">
                                  <Label className="text-xs">
                                    O que está incluído{" "}
                                    <span className="text-muted-foreground font-normal">(opcional)</span>
                                  </Label>
                                  <Input
                                    value={plan.description ?? ""}
                                    onChange={(e) => {
                                      const updated = [...servicePlans];
                                      updated[idx] = { ...updated[idx], description: e.target.value };
                                      setServicePlans(updated);
                                    }}
                                    placeholder="Ex: 4 aulas/semana + avaliação física"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-full w-full"
                            onClick={() => setServicePlans([...servicePlans, { name: "", price: null, description: "" }])}
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Adicionar plano
                          </Button>

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full flex-1"
                              onClick={() => setCommercialWizardStep(3)}
                            >
                              Voltar
                            </Button>
                            <Button
                              type="button"
                              className="rounded-full flex-1"
                              onClick={handleCommercialPlansComplete}
                            >
                              Concluir
                            </Button>
                          </div>

                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
                            onClick={handleCommercialPlansComplete}
                          >
                            Adicionar planos depois →
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 2.8: Physical Data */}
                  {signupStep === 2.8 && (
                    <div className="grid gap-4">
                      <div className="text-center space-y-1 mb-1">
                        <h3 className="font-semibold text-sm">Dados físicos</h3>
                        <p className="text-xs text-muted-foreground">Ajuda a personalizar sua experiência <span className="font-medium">(opcional)</span></p>
                      </div>

                      <div className="grid gap-2">
                        <Label>Sexo</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: "male", label: "Masculino" },
                            { value: "female", label: "Feminino" },
                            { value: "other", label: "Outro" },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setGender(gender === opt.value ? "" : opt.value)}
                              className={`rounded-lg border-2 py-2 px-1 text-xs font-medium transition-all ${gender === opt.value
                                ? "border-brand bg-brand/10 text-brand"
                                : "border-border/60 hover:border-border"
                                }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {(() => {
                        const ageNum = age === "" ? null : parseInt(age, 10);
                        const heightNum = height === "" ? null : parseInt(height, 10);
                        const weightNum = weight === "" ? null : parseFloat(weight);
                        const ageError = ageNum !== null && (ageNum < 1 || ageNum > 100);
                        const heightError = heightNum !== null && (heightNum < 100 || heightNum > 300);
                        const weightError = weightNum !== null && (weightNum < 20 || weightNum > 200);
                        const hasErrors = ageError || heightError || weightError;

                        return (
                          <>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="grid gap-1">
                                <Label htmlFor="signup_age">Idade</Label>
                                <Input
                                  id="signup_age"
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  max={100}
                                  step={1}
                                  value={age}
                                  onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))}
                                  placeholder="Ex: 25"
                                  className={ageError ? "border-red-500" : ""}
                                />
                                {ageError && (
                                  <p className="text-xs text-red-600">1 a 100 anos</p>
                                )}
                              </div>
                              <div className="grid gap-1">
                                <Label htmlFor="signup_height">Altura (cm)</Label>
                                <Input
                                  id="signup_height"
                                  type="number"
                                  inputMode="numeric"
                                  min={100}
                                  max={300}
                                  step={1}
                                  value={height}
                                  onChange={(e) => setHeight(e.target.value.replace(/[^0-9]/g, ""))}
                                  placeholder="Ex: 175"
                                  className={heightError ? "border-red-500" : ""}
                                />
                                {heightError && (
                                  <p className="text-xs text-red-600">100 a 300 cm</p>
                                )}
                              </div>
                              <div className="grid gap-1">
                                <Label htmlFor="signup_weight">Peso (kg)</Label>
                                <Input
                                  id="signup_weight"
                                  type="number"
                                  inputMode="decimal"
                                  min={20}
                                  max={200}
                                  value={weight}
                                  onChange={(e) => setWeight(e.target.value)}
                                  placeholder="Ex: 70"
                                  className={weightError ? "border-red-500" : ""}
                                />
                                {weightError && (
                                  <p className="text-xs text-red-600">20 a 200 kg</p>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2 mt-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full flex-1"
                                onClick={() => setSignupStep(hasCommercialProfile ? 2.5 : 2)}
                              >
                                Voltar
                              </Button>
                              <Button
                                type="button"
                                className="rounded-full flex-1"
                                disabled={hasErrors}
                                onClick={() => setSignupStep(3)}
                              >
                                Próximo
                              </Button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {/* Step 3: Select Segments */}
                  {signupStep === 3 && (
                    <div className="grid gap-3">

                      <div className="text-center space-y-1 mb-1">
                        <h3 className="font-semibold text-sm">Qual é o seu objetivo?</h3>
                        <p className="text-xs text-muted-foreground">Selecione um ou mais que se encaixam no seu foco atual</p>
                      </div>

                      <div className="grid gap-2">
                        {FITNESS_SEGMENTS.map((segment) => (
                          <button
                            key={segment.id}
                            type="button"
                            onClick={() => toggleSegment(segment.id)}
                            className={`flex items-center gap-3 rounded-lg border-2 p-3 transition-all ${selectedSegments.has(segment.id)
                              ? "border-brand bg-brand/10"
                              : "border-border/60 hover:border-border"
                              }`}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedSegments.has(segment.id)
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
                          onClick={() => setSignupStep(2.8)}
                        >
                          Voltar
                        </Button>
                        <Button
                          type="button"
                          className="rounded-full flex-1"
                          onClick={handleSignupStep3}
                          disabled={busy}
                        >
                          {busy ? "Criando..." : "Próximo"}
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}

            </>}
          </CardContent>
        </Card>
      </div>

      <ImageCropperDrawer
        imageSrc={pendingLoginPhotoCropSrc}
        aspectRatio={1}
        onConfirm={(dataUrl, blob) => {
          const file = pendingLoginPhotoFileRef.current;
          if (!file) return;
          setPhotoFile(new File([blob], file.name, { type: "image/jpeg" }));
          setPhotoPreview(dataUrl);
          setPendingLoginPhotoCropSrc(null);
        }}
        onCancel={() => setPendingLoginPhotoCropSrc(null)}
      />

      <ImageCropperDrawer
        imageSrc={pendingLoginLogoCropSrc}
        aspectRatio={1}
        onConfirm={(dataUrl, blob) => {
          const file = pendingLoginLogoFileRef.current;
          if (!file) return;
          setBusinessLogoFile(new File([blob], file.name, { type: "image/jpeg" }));
          setBusinessLogoPreview(dataUrl);
          setPendingLoginLogoCropSrc(null);
        }}
        onCancel={() => setPendingLoginLogoCropSrc(null)}
      />
    </div>
  );
}
