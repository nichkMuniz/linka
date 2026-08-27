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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/language-context";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  addNetworkStatusListener,
  checkSupabaseReachability,
  getNetworkStatus,
  withNetworkRetry,
} from "@/lib/network-status";
import { getKeyboardHeight, subscribeKeyboardHeight } from "@/lib/keyboard";
import { Upload, X, Check, ArrowLeft, Eye, EyeOff, Plus, Trash2, ScanFace } from "lucide-react";
import { createOrUpdateCommercialProfileDb, saveCommercialPlansDb, type ServicePlan, checkEmailExistsDb, checkHandleExistsDb, invalidateProfileCache } from "@/lib/ritmofit-db";
import { ImageCropperDrawer, AVATAR_MAX_EXPORT } from "@/components/shared/image-cropper-drawer";
import { LoginSplashOriginal } from "@/components/shared/login-splash-original";
import { Browser } from "@capacitor/browser";
import { TERMS_URL, PRIVACY_URL } from "@/lib/share-url";
import { FEATURES } from "@/lib/feature-flags";
import {
  isBiometricSupported,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  authenticateWithBiometric,
  type BiometricSupport,
} from "@/lib/biometric-auth";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

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
  return (
    <div className="flex items-center justify-center">
      <img src="/logo-horizontal-icone-branco.png" alt="LinKa" className="h-28 w-auto" />
    </div>
  );
}

// `labelKey` em vez do texto: a constante é de módulo e não alcança o `t()`,
// que só existe dentro do componente. A tradução acontece no render.
const FITNESS_SEGMENTS = [
  { id: "fitness", labelKey: "login_seg_fitness" },
  { id: "cardio", labelKey: "login_seg_cardio" },
  { id: "diets", labelKey: "login_seg_diets" },
  { id: "habits", labelKey: "login_seg_habits" },
  { id: "yoga", labelKey: "login_seg_yoga" },
  { id: "sports", labelKey: "login_seg_sports" },
] as const;

export default function Login() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();

  const [showSplash, setShowSplash] = React.useState(true);

  // Contêiner rolável da tela — usado para erguer o campo focado acima do teclado iOS.
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    // Reveal animation: aura/símbolo entram em ~1.5s, wordmark emerge até ~2.9s.
    // Mantemos o lockup respirando por mais um instante antes de revelar o form.
    const timer = setTimeout(() => setShowSplash(false), 3200);
    return () => clearTimeout(timer);
  }, []);

  const [tab, setTab] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [networkStatus, setNetworkStatus] = React.useState(getNetworkStatus());

  // Multi-step signup states
  const [signupStep, setSignupStep] = React.useState(1);
  // Aceite dos Termos/Privacidade — obrigatório para avançar do step 1.
  const [termsAccepted, setTermsAccepted] = React.useState(false);
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
  const [signupHandleExists, setSignupHandleExists] = React.useState<boolean | null>(null);
  const [checkingSignupHandle, setCheckingSignupHandle] = React.useState(false);
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = React.useState("");
  const [isResettingPassword, setIsResettingPassword] = React.useState(false);
  const [forgotStep, setForgotStep] = React.useState<"email" | "otp">("email");
  const [forgotOtp, setForgotOtp] = React.useState("");
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

  // Biometric login (Face ID / Touch ID)
  const [biometricSupport, setBiometricSupport] = React.useState<BiometricSupport>({ available: false, label: "Biometria" });
  const [biometricEnabled, setBiometricEnabled] = React.useState(false);
  const [pendingBiometricCreds, setPendingBiometricCreds] = React.useState<{ email: string; password: string } | null>(null);
  const [showEnableBiometricPrompt, setShowEnableBiometricPrompt] = React.useState(false);
  const [biometricBusy, setBiometricBusy] = React.useState(false);
  const biometricAutoAttempted = React.useRef(false);

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

  // iOS: com resize 'none' o webview não encolhe quando o teclado abre, então o
  // campo focado pode ficar atrás do teclado. O padding-bottom (var --keyboard-height)
  // recentraliza o formulário acima do teclado; aqui rolamos o próprio contêiner
  // (window.scrollBy é no-op num contêiner com overflow próprio) para revelar campos
  // mais abaixo, como os de senha nos passos de cadastro. Correção local — não mexer
  // em keyboard.ts (ver docs/13-layouts-e-componentes.md).
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const revealActiveInput = () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return;
      const isField =
        el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
      if (!isField) return;
      // Inputs dentro de drawers/dialogs (cropper, etc.) cuidam de si mesmos.
      if (el.closest('[role="dialog"]')) return;
      const keyboardHeight = getKeyboardHeight();
      if (keyboardHeight <= 0) return;
      const rect = el.getBoundingClientRect();
      const visibleBottom = window.innerHeight - keyboardHeight - 16;
      if (rect.bottom > visibleBottom) {
        container.scrollBy({ top: rect.bottom - visibleBottom, behavior: "smooth" });
      }
    };

    // Aguarda o layout reagir ao novo padding-bottom antes de medir o campo.
    const scheduleReveal = () =>
      requestAnimationFrame(() => requestAnimationFrame(revealActiveInput));

    // Teclado abrindo (ou mudando de altura): revela o campo já focado.
    const unsubscribe = subscribeKeyboardHeight((height) => {
      if (height > 0) scheduleReveal();
    });

    // Trocar o foco entre campos com o teclado aberto.
    const handleFocusIn = () => {
      if (getKeyboardHeight() > 0) scheduleReveal();
    };
    container.addEventListener("focusin", handleFocusIn);

    return () => {
      unsubscribe();
      container.removeEventListener("focusin", handleFocusIn);
    };
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

  // Check if the chosen @handle is already taken — debounced 500ms (Step 2).
  React.useEffect(() => {
    if (tab !== "signup" || signupStep !== 2) return;
    const normalized = username.trim().toLowerCase();
    if (normalized.length < 3) {
      setSignupHandleExists(null);
      setCheckingSignupHandle(false);
      return;
    }
    setCheckingSignupHandle(true);
    const timer = setTimeout(async () => {
      const exists = await checkHandleExistsDb(normalized);
      setSignupHandleExists(exists);
      setCheckingSignupHandle(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [username, tab, signupStep]);

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
    // Keep the user on the login screen until they answer the "enable biometric?" prompt.
    if (showEnableBiometricPrompt) return;

    const deeplink = sessionStorage.getItem("deeplink_redirect");
    if (deeplink) {
      sessionStorage.removeItem("deeplink_redirect");
      navigate(deeplink, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [authLoading, user, navigate, isCompletingSignup, showNewPassword, showEnableBiometricPrompt]);

  // Detect biometric hardware + opt-in status once on mount.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // Login por biometria guardado para um update futuro
      // (FEATURES.biometricLogin). Zerar o suporte na origem desliga TODAS as
      // ramificações de uma vez — o prompt de ativar, a tentativa automática e
      // o botão de Face ID —, sem precisar caçar cada uma.
      const support = FEATURES.biometricLogin
        ? await isBiometricSupported()
        : { available: false, label: "Biometria" };
      if (cancelled) return;
      setBiometricSupport(support);
      setBiometricEnabled(support.available && isBiometricEnabled());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Biometric sign-in: gate with Face ID/Touch ID, then sign in with stored credentials.
  const handleBiometricLogin = React.useCallback(async () => {
    if (!supabase) return;
    setBiometricBusy(true);
    try {
      const creds = await authenticateWithBiometric();

      if (!networkStatus.isSupabaseReachable) {
        await checkSupabaseReachability();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const { error } = await withNetworkRetry(() =>
        supabase!.auth.signInWithPassword({ email: creds.email, password: creds.password }),
      );

      if (error) {
        const msg = error.message.toLowerCase();
        const invalidCredentials =
          msg.includes("invalid login credentials") || msg.includes("invalid credentials");
        if (invalidCredentials) {
          // Stored password is stale (changed elsewhere) — drop biometric and ask for manual login.
          await disableBiometric();
          setBiometricEnabled(false);
          toast({
            title: t("login_biometric_disabled_title"),
            description: t("login_biometric_disabled_desc"),
            variant: "destructive",
          });
        }
        return;
      }

      navigate("/", { replace: true });
    } catch {
      // User cancelled / failed the biometric prompt — silently fall back to manual login.
    } finally {
      setBiometricBusy(false);
    }
  }, [networkStatus.isSupabaseReachable, navigate]);

  // Auto-trigger biometric login once when the login screen is shown and biometrics are enabled.
  React.useEffect(() => {
    if (showSplash || authLoading || user) return;
    if (isCompletingSignup || showNewPassword || showForgotPassword) return;
    if (tab !== "login") return;
    if (!biometricEnabled || !biometricSupport.available) return;
    if (biometricAutoAttempted.current) return;
    biometricAutoAttempted.current = true;
    handleBiometricLogin();
  }, [
    showSplash,
    authLoading,
    user,
    isCompletingSignup,
    showNewPassword,
    showForgotPassword,
    tab,
    biometricEnabled,
    biometricSupport.available,
    handleBiometricLogin,
  ]);

  const confirmEnableBiometric = async () => {
    if (!pendingBiometricCreds) return;
    setBiometricBusy(true);
    try {
      const ok = await enableBiometric(pendingBiometricCreds.email, pendingBiometricCreds.password);
      if (ok) {
        setBiometricEnabled(true);
        toast({
          title: `${biometricSupport.label} ativado`,
          description: `Da próxima vez, entre com ${biometricSupport.label}.`,
        });
      }
    } catch {
      // User cancelled the biometric confirmation — continue without enabling.
    } finally {
      setBiometricBusy(false);
      setShowEnableBiometricPrompt(false);
      setPendingBiometricCreds(null);
      navigate("/", { replace: true });
    }
  };

  const dismissEnableBiometric = () => {
    setShowEnableBiometricPrompt(false);
    setPendingBiometricCreds(null);
    navigate("/", { replace: true });
  };

  const submit = async (mode: "login" | "signup") => {
    if (!hasSupabaseConfig || !supabase) {
      toast({
        title: t("login_toast_no_supabase_title"),
        description: t("login_toast_no_supabase_desc"),
      });
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (trimmedPassword.length < 6) {
      toast({
        title: t("login_toast_weak_pwd_title"),
        description: t("login_toast_weak_pwd_min6"),
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

        const { error } = await withNetworkRetry(() =>
          supabase!.auth.signInWithPassword({
            email: trimmedEmail,
            password: trimmedPassword,
          }),
        );

        if (error) {
          if (isEmailNotConfirmed(error.message)) {
            toast({
              title: t("login_toast_email_unconfirmed_title"),
              description: t("login_toast_email_unconfirmed_desc"),
            });
            return;
          }

          const isInvalidCredentials =
            error.message.toLowerCase().includes("invalid login credentials") ||
            error.message.toLowerCase().includes("invalid credentials") ||
            error.message.toLowerCase().includes("email not found") ||
            error.message.toLowerCase().includes("wrong password");

          toast({
            title: t("login_toast_signin_failed_title"),
            description: isInvalidCredentials
              ? t("login_toast_bad_credentials")
              : error.message,
            variant: "destructive",
          });
          return;
        }

        // First successful login on this device with biometrics available but not yet
        // enabled → offer to turn on Face ID/Touch ID before entering the app.
        if (biometricSupport.available && !biometricEnabled) {
          setPendingBiometricCreds({ email: trimmedEmail, password: trimmedPassword });
          setShowEnableBiometricPrompt(true);
          setBusy(false);
          return;
        }

        toast({
          title: t("login_toast_signed_in_title"),
          description: t("login_toast_signed_in_desc"),
        });

        navigate("/", { replace: true });
        return;
      }

      // Handle signup step 1: email and password validation
      if (signupStep === 1) {
        // Backstop do checkbox: o botão já fica desabilitado sem o aceite, mas
        // o form também submete no Enter do teclado do iOS.
        if (!termsAccepted) {
          toast({
            title: t("signup_terms_required_title"),
            description: t("signup_terms_required_desc"),
            variant: "destructive",
          });
          setBusy(false);
          return;
        }

        if (!isValidEmail(email)) {
          toast({
            title: t("login_toast_invalid_email_title"),
            description: t("login_toast_invalid_email_desc"),
            variant: "destructive",
          });
          setBusy(false);
          return;
        }

        if (!isStrongPassword(password)) {
          toast({
            title: t("login_toast_weak_pwd_title"),
            description: t("login_toast_weak_pwd_desc"),
            variant: "destructive",
          });
          setBusy(false);
          return;
        }

        // Check password confirmation
        if (password !== confirmPassword) {
          toast({
            title: t("login_toast_pwd_mismatch_title"),
            description: t("login_toast_pwd_mismatch_desc"),
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
        title: isNetworkError ? t("login_connection_failed") : t("login_toast_signin_error"),
        description: isNetworkError
          ? t("login_toast_check_connection")
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
        title: t("login_toast_name_required_title"),
        description: t("login_toast_name_required_desc"),
      });
      return;
    }
    if (!username.trim()) {
      toast({
        title: t("login_toast_handle_required_title"),
        description: t("login_toast_handle_required_desc"),
      });
      return;
    }
    if (username.trim().length < 3) {
      toast({
        title: t("login_toast_handle_short_title"),
        description: t("login_toast_handle_short_desc"),
        variant: "destructive",
      });
      return;
    }
    if (signupHandleExists === true) {
      toast({
        title: t("login_toast_handle_taken_title"),
        description: t("login_toast_handle_taken_desc"),
        variant: "destructive",
      });
      return;
    }
    // If commercial profile, go to commercial data wizard, else go to physical data step
    if (FEATURES.store && hasCommercialProfile) {
      setCommercialWizardStep(1);
      setSignupStep(2.5);
    } else {
      setSignupStep(2.8);
    }
  };

  const handleCommercialDataComplete = () => {
    if (!commercialData.business_name.trim() || !commercialData.business_segment) {
      toast({
        title: t("login_toast_required_fields_title"),
        description: t("login_toast_required_store_desc"),
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

      // On iOS, network may not be stable on app launch — wait if unreachable
      if (!networkStatus.isSupabaseReachable) {
        await checkSupabaseReachability();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      const { error: signUpError } = await withNetworkRetry(() =>
        supabase!.auth.signUp({
          email: trimmedEmail,
          password: trimmedPassword,
          options: { data: signUpMeta },
        }),
      );

      if (signUpError) {
        const signUpErrMsg = signUpError.message?.toLowerCase() || "";
        if (signUpErrMsg.includes("already registered") || signUpErrMsg.includes("user already registered")) {
          toast({
            title: t("login_toast_user_exists_title"),
            description: t("login_toast_user_exists_desc"),
            variant: "destructive",
          });
        } else {
          toast({ title: t("login_toast_signup_failed"), description: signUpError.message });
        }
        setIsCompletingSignup(false);
        return;
      }

      // Sign in after signup
      const { error: signInError } = await withNetworkRetry(() =>
        supabase!.auth.signInWithPassword({
          email: trimmedEmail,
          password: trimmedPassword,
        }),
      );

      if (signInError && !isEmailNotConfirmed(signInError.message)) {
        toast({ title: t("login_toast_created_no_signin"), description: signInError.message });
        setIsCompletingSignup(false);
        return;
      }

      // Upload photo and save bio if provided.
      // A sessão recém-criada nem sempre está pronta no primeiro getUser() (iOS):
      // antes, se viesse null, TODO o bloco abaixo era pulado em silêncio e o
      // usuário caía no feed sem foto e sem os dados do cadastro.
      let resolvedUser = (await supabase.auth.getUser()).data.user;
      if (!resolvedUser) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        resolvedUser = (await supabase.auth.getUser()).data.user;
      }
      if (!resolvedUser) {
        console.error("Cadastro: sessão indisponível — perfil não foi gravado.");
        toast({
          title: t("login_toast_account_created"),
          description: t("login_toast_profile_not_saved"),
          variant: "destructive",
        });
      }
      const authUser = resolvedUser;

      if (authUser) {
        let photoUrl: string | undefined;
        if (photoFile) {
          // O cropper SEMPRE exporta JPEG. Usar a extensão do arquivo original
          // (no iOS costuma ser .heic) gravava uma key que não batia com o
          // conteúdo, e a imagem podia ser servida com content-type errado —
          // o feed então caía no avatar padrão do ImageWithFallback.
          const filePath = `${authUser.id}/profile-${Date.now()}.jpg`;
          // upsert:true para que uma retentativa sobrescreva em vez de falhar
          // com "duplicate" caso a 1ª tentativa tenha subido mas perdido a resposta.
          const { error: uploadError } = await withNetworkRetry(
            () =>
              supabase!.storage
                .from("posts")
                .upload(filePath, photoFile, { contentType: "image/jpeg", upsert: true }),
            { retries: 2, delayMs: 1200 },
          );

          if (uploadError) {
            // Antes esse erro era engolido (`if (!uploadError)`) e não sobrava
            // nenhuma pista de por que a foto não aparecia.
            console.error("Erro ao enviar a foto de perfil no cadastro:", uploadError);
            toast({
              title: t("login_toast_photo_failed_title"),
              description: t("login_toast_photo_failed_desc"),
              variant: "destructive",
            });
          } else {
            const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(filePath);
            photoUrl = publicUrl;

            // Espelha a foto no metadata do auth. Se a linha de `profiles` ainda
            // não existir, quem cria o perfil é o ensureProfile() do feed — e ele
            // tira a foto de `user_metadata.avatar_url`, que o cadastro nunca
            // preenchia; era por isso que o usuário caía no feed sem avatar.
            const { error: metaError } = await supabase.auth.updateUser({
              data: { avatar_url: publicUrl },
            });
            if (metaError) console.error("Erro ao gravar avatar_url no metadata:", metaError);
          }
        }

        // Build profile update payload.
        // ATENÇÃO: `profiles` NÃO tem coluna `email` (o email vive em auth.users).
        // Incluir `email` aqui fazia o PostgREST rejeitar o UPDATE INTEIRO
        // (PGRST204 "column not found") — então foto/handle/nickname não gravavam.
        // Era a causa real de a foto não subir para profiles.photo.
        const profilePayload: Record<string, any> = {};
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
          // A linha do profile já existe (criada pelo trigger handle_new_user).
          // Usamos UPDATE (policy profiles_update_own) em vez de UPSERT: o braço de
          // INSERT do upsert era barrado pelo RLS e falhava em silêncio, então a foto
          // e o handle escolhidos no cadastro nunca eram gravados.
          // O .select() devolve as linhas afetadas: um UPDATE barrado por RLS
          // afeta 0 linhas SEM retornar erro (mesmo no-op silencioso do DELETE),
          // então sem isso não há como distinguir "gravou" de "não gravou".
          const { data: savedRows, error: profileError } = await withNetworkRetry(
            async () =>
              await supabase!
                .from("profiles")
                .update({ ...profilePayload, updated_at: new Date().toISOString() })
                .eq("user_id", authUser.id)
                .select("photo, handle"),
            { retries: 2, delayMs: 1200 },
          );

          if (profileError) {
            console.error("Erro ao salvar perfil no cadastro:", profileError);
            // Corrida rara: o handle foi ocupado entre a validação e o envio.
            if (profileError.code === "23505" && String(profileError.message).toLowerCase().includes("handle")) {
              toast({
                title: t("login_toast_handle_taken_title"),
                description: t("login_toast_handle_taken_late"),
                variant: "destructive",
              });
            } else {
              toast({
                title: t("login_toast_profile_failed_title"),
                description: t("login_toast_profile_failed_desc"),
                variant: "destructive",
              });
            }
          } else if (!savedRows || savedRows.length === 0) {
            // 0 linhas sem erro = a linha ainda não existe (trigger handle_new_user
            // ausente/atrasado). Cria o perfil em vez de perder foto e dados.
            // Requer a policy `profiles_insert_own` (migração 20260720).
            console.error("Cadastro: UPDATE não afetou linhas — criando o perfil.");
            const { error: insertError } = await withNetworkRetry(
              async () =>
                await supabase!.from("profiles").upsert(
                  {
                    user_id: authUser.id,
                    ...profilePayload,
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "user_id" },
                ),
              { retries: 2, delayMs: 1200 },
            );
            if (insertError) {
              console.error("Erro ao criar perfil no cadastro:", insertError);
              toast({
                title: t("login_toast_profile_failed_title"),
                description: t("login_toast_profile_failed_desc2"),
                variant: "destructive",
              });
            }
          }
          // Garante que o feed leia foto/handle atualizados, não o cache do trigger.
          invalidateProfileCache(authUser.id);
        }

        // Save commercial profile if user selected it
        if (FEATURES.store && hasCommercialProfile && (commercialData.business_name.trim() || commercialData.business_segment)) {
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
        title: isNetworkError ? t("login_connection_failed") : t("login_toast_signup_error"),
        description: isNetworkError
          ? t("login_toast_check_connection")
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
        title: t("login_toast_email_required_title"),
        description: t("login_toast_email_required_desc"),
        variant: "destructive",
      });
      return;
    }

    setIsResettingPassword(true);
    try {
      const emailExists = await checkEmailExistsDb(forgotPasswordEmail.trim());
      if (!emailExists) {
        toast({
          title: t("login_toast_email_notfound_title"),
          description: t("login_toast_email_notfound_desc"),
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: forgotPasswordEmail.trim(),
        options: { shouldCreateUser: false },
      });

      if (error) {
        toast({
          title: t("login_toast_send_code_error"),
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setForgotStep("otp");
      setForgotOtp("");
      toast({
        title: t("login_toast_code_sent_title"),
        description: t("login_toast_code_sent_desc"),
      });
    } catch (err: any) {
      toast({
        title: t("login_toast_connection_error"),
        description: t("login_toast_send_code_retry"),
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!supabase || !forgotOtp.trim()) return;
    setIsResettingPassword(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: forgotPasswordEmail.trim(),
        token: forgotOtp.trim(),
        type: "email",
      });
      if (error) {
        toast({
          title: t("login_toast_invalid_code_title"),
          description: t("login_toast_invalid_code_desc"),
          variant: "destructive",
        });
        return;
      }
      // OTP verified → session active → show "set new password" form
      setShowForgotPassword(false);
      setForgotStep("email");
      setForgotOtp("");
      setShowNewPassword(true);
    } catch {
      toast({ title: t("login_toast_connection_error"), description: t("login_toast_retry"), variant: "destructive" });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSaveNewPassword = async () => {
    if (!supabase) return;
    if (!isStrongPassword(newPassword)) {
      toast({
        title: t("login_toast_weak_pwd_title"),
        description: t("login_toast_weak_pwd_desc"),
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast({
        title: t("login_toast_pwd_mismatch_title"),
        description: t("login_toast_pwd_mismatch_desc"),
        variant: "destructive",
      });
      return;
    }
    setIsSavingNewPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({
          title: t("login_toast_reset_error"),
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      await supabase.auth.signOut();
      toast({
        title: t("login_toast_reset_done_title"),
        description: t("login_toast_reset_done_desc"),
      });
      setShowNewPassword(false);
      setNewPassword("");
      setNewPasswordConfirm("");
      setTab("login");
    } catch {
      toast({
        title: t("login_toast_connection_error"),
        description: t("login_toast_reset_retry"),
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
      title: t("login_toast_signup_success_title"),
      description: t("login_toast_signup_success_desc"),
    });

    // Flag: new user should land on Descobrir tab
    localStorage.setItem("new_user_open_discover", "1");
    // Flag: force profile reload in feed (so photo appears immediately)
    localStorage.setItem("force_profile_reload", "1");

    setIsCompletingSignup(false);
    navigate("/", { replace: true });
  };

  if (showSplash) {
    return <LoginSplashOriginal />;
  }

  return (
    <div
      ref={scrollContainerRef}
      className="flex min-h-dvh items-center justify-center bg-background p-6 overflow-y-auto"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        // Reserva a altura do teclado iOS (var publicada por keyboard.ts): com o
        // formulário centralizado (my-auto), isso o ergue acima do teclado e cria
        // espaço para rolar os campos mais abaixo para a área visível.
        paddingBottom:
          "calc(max(1.5rem, env(safe-area-inset-bottom)) + var(--keyboard-height, 0px))",
        transition: "padding-bottom 0.25s ease",
      }}
    >
      <div className="mx-auto grid w-full max-w-md gap-6 my-auto">
        <BrandHeader />

        <Card className="border-border/60 relative">
          {!showForgotPassword && !showNewPassword && (
            <CardHeader className="space-y-2">
              <CardTitle className="text-base">{t("login_card_title")}</CardTitle>
              <CardDescription>
                {hasSupabaseConfig
                  ? t("login_card_desc")
                  : t("login_no_supabase_desc")}
              </CardDescription>
            </CardHeader>
          )}

          <CardContent className="space-y-4">
            {showNewPassword ? (
              <div className="grid gap-4">
                <div className="grid gap-1">
                  <p className="text-sm font-semibold">{t("login_reset_title")}</p>
                  <p className="text-xs text-muted-foreground">{t("login_reset_desc")}</p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="new_password">{t("login_new_password")}</Label>
                  <div className="relative">
                    <Input
                      id="new_password"
                      type={showNewPwd ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t("login_password_placeholder")}
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
                        { ok: newPassword.length >= 8, label: t("login_pwd_rule_min") },
                        { ok: /[A-Z]/.test(newPassword), label: t("login_pwd_rule_upper") },
                        { ok: /[^a-zA-Z0-9]/.test(newPassword), label: t("login_pwd_rule_special") },
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
                  <Label htmlFor="new_password_confirm">{t("login_confirm_new_password")}</Label>
                  <div className="relative">
                    <Input
                      id="new_password_confirm"
                      type={showNewPwdConfirm ? "text" : "password"}
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      placeholder={t("login_repeat_new_password")}
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
                    <p className="text-xs text-red-600">{t("login_passwords_mismatch")}</p>
                  )}
                  {newPasswordConfirm.length > 0 && newPassword === newPasswordConfirm && isStrongPassword(newPassword) && (
                    <p className="text-xs text-green-600">{t("login_passwords_match")}</p>
                  )}
                </div>

                <Button
                  className="rounded-full"
                  disabled={!isStrongPassword(newPassword) || newPassword !== newPasswordConfirm || isSavingNewPassword}
                  onClick={handleSaveNewPassword}
                >
                  {isSavingNewPassword ? t("login_saving") : t("login_save_new_password")}
                </Button>
              </div>
            ) : !networkStatus.isOnline ? (
              <div className="rounded-2xl border border-red-200/30 bg-red-50/20 p-4 text-sm text-red-700 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-200">
                {t("login_offline_banner")}
              </div>
            ) : !networkStatus.isSupabaseReachable ? (
              <div className="rounded-2xl border border-yellow-200/30 bg-yellow-50/20 p-4 text-sm text-yellow-700 dark:border-yellow-900/30 dark:bg-yellow-950/20 dark:text-yellow-200">
                {t("login_supabase_unreachable")}
              </div>
            ) : null}

            {!showNewPassword && <>

            {!hasSupabaseConfig ? (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                {t("login_env_hint")}
                <div className="mt-2 grid gap-1 font-mono text-[12px]">
                  <div>VITE_SUPABASE_URL</div>
                  <div>VITE_SUPABASE_ANON_KEY</div>
                </div>
              </div>
            ) : null}

            {authLoading ? (
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
                {t("login_checking_session")}
              </div>
            ) : user && !isCompletingSignup ? (
              <div className="grid gap-3">
                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <div className="text-sm font-semibold">
                    {t("login_already_signed_in")}
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
                    {t("login_go_to_app")}
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
                            title: t("login_signout_error"),
                            description: error.message,
                          });
                          return;
                        }
                        toast({ title: t("login_signed_out") });
                      } catch {
                        toast({
                          title: t("login_connection_failed"),
                          description: t("login_supabase_connect_error"),
                        });
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {t("login_sign_out")}
                  </Button>
                </div>
              </div>
            ) : showForgotPassword ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (forgotStep === "otp") {
                        setForgotStep("email");
                        setForgotOtp("");
                      } else {
                        setShowForgotPassword(false);
                        setForgotPasswordEmail("");
                        setForgotStep("email");
                      }
                    }}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    disabled={isResettingPassword}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h2 className="text-lg font-semibold">{t("login_forgot_title")}</h2>
                    <p className="text-xs text-muted-foreground">
                      {forgotStep === "email"
                        ? t("login_forgot_email_hint")
                        : t("login_forgot_code_sent_to").replace("{email}", forgotPasswordEmail)}
                    </p>
                  </div>
                </div>

                {forgotStep === "email" ? (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="forgot_email">{t("login_email")}</Label>
                      <Input
                        id="forgot_email"
                        type="email"
                        value={forgotPasswordEmail}
                        onChange={(e) => setForgotPasswordEmail(e.target.value)}
                        placeholder={t("login_email_placeholder")}
                        autoComplete="email"
                        className={forgotPasswordEmail.length > 0 && !isValidEmail(forgotPasswordEmail) ? "border-red-500" : ""}
                      />
                      {forgotPasswordEmail.length > 0 && !isValidEmail(forgotPasswordEmail) && (
                        <p className="text-xs text-red-600">{t("login_invalid_email_inline")}</p>
                      )}
                    </div>
                    <Button
                      type="button"
                      className="rounded-full w-full"
                      onClick={handleResetPassword}
                      disabled={isResettingPassword || !isValidEmail(forgotPasswordEmail)}
                    >
                      {isResettingPassword ? t("login_sending") : t("login_send_code")}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="forgot_otp">{t("login_otp_label")}</Label>
                      <Input
                        id="forgot_otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={8}
                        value={forgotOtp}
                        onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                        placeholder="00000000"
                        className="text-center tracking-widest text-lg"
                        autoComplete="one-time-code"
                      />
                    </div>
                    <Button
                      type="button"
                      className="rounded-full w-full"
                      onClick={handleVerifyOtp}
                      disabled={isResettingPassword || forgotOtp.length < 6 || forgotOtp.length > 8}
                    >
                      {isResettingPassword ? t("login_verifying") : t("login_verify_code")}
                    </Button>
                    <button
                      type="button"
                      className="text-xs text-muted-foreground underline w-full text-center"
                      onClick={() => { setForgotStep("email"); setForgotOtp(""); }}
                    >
                      {t("login_resend_code")}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted/40 p-1 shadow-sm ring-1 ring-border/60">
                  <TabsTrigger
                    value="login"
                    className="rounded-full rounded-full data-[state=active]:bg-brand-gradient data-[state=active]:text-white data-[state=active]:shadow-md"
                  >
                    {t("login_tab_signin")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="signup"
                    className="rounded-full rounded-full data-[state=active]:bg-brand-gradient data-[state=active]:text-white data-[state=active]:shadow-md"
                  >
                    {t("login_tab_signup")}
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
                      <Label htmlFor="login_email">{t("login_email")}</Label>
                      <Input
                        id="login_email"
                        type="text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t("login_email_placeholder")}
                        autoComplete="email"
                        className={email.length > 0 && !isValidEmail(email) ? "border-red-500" : ""}
                      />
                      {email.length > 0 && !isValidEmail(email) && (
                        <p className="text-xs text-red-600">{t("login_invalid_email_inline")}</p>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="login_password">{t("login_password")}</Label>
                      <div className="relative">
                        <Input
                          id="login_password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showPassword ? t("login_hide_password") : t("login_show_password")}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-brand hover:underline text-left"
                        onClick={() => setShowForgotPassword(true)}
                      >
                        {t("login_forgot_link")}
                      </button>
                    </div>

                    <Button
                      type="submit"
                      className="mt-1 rounded-full"
                      disabled={!canSubmit}
                    >
                      {busy ? t("login_signing_in") : t("login_tab_signin")}
                    </Button>

                    {biometricSupport.available && biometricEnabled && (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full gap-2"
                        disabled={biometricBusy || busy}
                        onClick={handleBiometricLogin}
                      >
                        <ScanFace className="h-4 w-4" />
                        {biometricBusy
                          ? t("login_authenticating")
                          : t("login_signin_with").replace("{method}", biometricSupport.label)}
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
                      {t("login_no_account_cta")}
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
                          <span>{t("login_step_of").replace("{step}", String(step)).replace("{total}", String(totalSteps))}</span>
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
                  {signupStep === 1 && (
                    <form
                      className="grid gap-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        submit("signup");
                      }}
                    >
                      <div className="grid gap-2">
                        <Label htmlFor="signup_email">{t("login_email")}</Label>
                        <Input
                          id="signup_email"
                          type="text"
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setSignupEmailExists(null); }}
                          placeholder={t("login_email_placeholder")}
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
                          <p className="text-xs text-red-600">{t("login_invalid_email_inline")}</p>
                        )}
                        {isValidEmail(email) && checkingSignupEmail && (
                          <p className="text-xs text-muted-foreground">{t("login_checking_email")}</p>
                        )}
                        {isValidEmail(email) && !checkingSignupEmail && signupEmailExists === true && (
                          <p className="text-xs text-red-600">{t("login_email_taken_inline")}</p>
                        )}
                        {isValidEmail(email) && !checkingSignupEmail && signupEmailExists === false && (
                          <p className="text-xs text-green-600">{t("login_email_available")}</p>
                        )}
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="signup_password">{t("login_password")}</Label>
                        <div className="relative">
                          <Input
                            id="signup_password"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={t("login_password_placeholder")}
                            autoComplete="new-password"
                            className="pr-10 [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showPassword ? t("login_hide_password") : t("login_show_password")}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {password.length > 0 && (
                          <ul className="grid gap-1 mt-1">
                            {[
                              { ok: password.length >= 8, label: t("login_pwd_rule_min") },
                              { ok: /[A-Z]/.test(password), label: t("login_pwd_rule_upper") },
                              { ok: /[^a-zA-Z0-9]/.test(password), label: t("login_pwd_rule_special") },
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
                        <Label htmlFor="signup_confirm_password">{t("login_confirm_password")}</Label>
                        <div className="relative">
                          <Input
                            id="signup_confirm_password"
                            type={showConfirmPassword ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder={t("login_confirm_password_placeholder")}
                            autoComplete="new-password"
                            className={`pr-10 [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden ${confirmPassword && password !== confirmPassword ? "border-red-500" : ""}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={showConfirmPassword ? t("login_hide_confirm") : t("login_show_confirm")}
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {confirmPassword && password !== confirmPassword && (
                          <p className="text-xs text-red-600">{t("login_passwords_mismatch")}</p>
                        )}
                        {confirmPassword && password === confirmPassword && isStrongPassword(password) && (
                          <p className="text-xs text-green-600">{t("login_passwords_match")}</p>
                        )}
                      </div>

                      {/* Aceite explícito — App Store Guideline 1.2.
                          A Apple exige que todo app com conteúdo de usuário
                          tenha um EULA aceito na criação da conta, com política
                          de tolerância zero a conteúdo abusivo declarada. Um
                          rodapé informativo ("ao continuar você concorda") já
                          foi motivo de rejeição em apps sociais; a caixa
                          marcável não deixa margem para interpretação. */}
                      <label className="mt-1 flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded accent-primary"
                        />
                        <span className="text-xs leading-relaxed text-muted-foreground">
                          {(() => {
                            // A frase muda de ordem entre PT e EN, então os
                            // links são montados a partir dos placeholders em
                            // vez de concatenados na mão.
                            const parts = t("signup_terms_accept").split(/(\{terms\}|\{privacy\})/);
                            return parts.map((part, i) => {
                              if (part === "{terms}")
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    className="underline font-medium text-foreground"
                                    onClick={(e) => { e.preventDefault(); void Browser.open({ url: TERMS_URL }); }}
                                  >
                                    {t("signup_terms_link")}
                                  </button>
                                );
                              if (part === "{privacy}")
                                return (
                                  <button
                                    key={i}
                                    type="button"
                                    className="underline font-medium text-foreground"
                                    onClick={(e) => { e.preventDefault(); void Browser.open({ url: PRIVACY_URL }); }}
                                  >
                                    {t("signup_privacy_link")}
                                  </button>
                                );
                              return <span key={i}>{part}</span>;
                            });
                          })()}{" "}
                          {t("signup_terms_zero_tolerance")}
                        </span>
                      </label>

                      <Button
                        type="submit"
                        className="mt-2 rounded-full"
                        disabled={!termsAccepted || !isValidEmail(email) || signupEmailExists !== false || checkingSignupEmail || !isStrongPassword(password) || password !== confirmPassword || busy}
                      >
                        {busy ? t("login_validating") : t("login_next")}
                      </Button>
                    </form>
                  )}

                  {/* Step 2: Name, Photo, Bio, Commercial Profile */}
                  {signupStep === 2 && (
                    <div className="grid gap-3">

                      <div className="grid gap-2">
                        <Label htmlFor="signup_name">{t("login_full_name")}</Label>
                        <Input
                          id="signup_name"
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder={t("login_full_name_placeholder")}
                          autoComplete="name"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="signup_username">{t("login_username_label")}</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">@</span>
                          <Input
                            id="signup_username"
                            type="text"
                            value={username}
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^a-zA-Z0-9_.]/g, "").replace(/\s/g, "");
                              setUsername(val);
                              setSignupHandleExists(null);
                            }}
                            placeholder={t("login_username_placeholder")}
                            autoComplete="off"
                            className={`pl-7 ${
                              signupHandleExists === true
                                ? "border-red-500"
                                : signupHandleExists === false
                                ? "border-green-500"
                                : ""
                            }`}
                            maxLength={30}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{t("login_username_hint")}</p>
                        {username.trim().length > 0 && username.trim().length < 3 && (
                          <p className="text-xs text-muted-foreground">{t("login_username_too_short_hint")}</p>
                        )}
                        {username.trim().length >= 3 && checkingSignupHandle && (
                          <p className="text-xs text-muted-foreground">{t("login_checking_availability")}</p>
                        )}
                        {username.trim().length >= 3 && !checkingSignupHandle && signupHandleExists === true && (
                          <p className="text-xs text-red-600">{t("login_username_taken_inline")}</p>
                        )}
                        {username.trim().length >= 3 && !checkingSignupHandle && signupHandleExists === false && (
                          <p className="text-xs text-green-600">{t("login_username_available")}</p>
                        )}
                      </div>

                      <div className="grid gap-2">
                        <Label>{t("login_profile_photo")} <span className="text-xs text-muted-foreground font-normal">{t("login_optional")}</span></Label>
                        <div className="flex items-center gap-3">
                          {photoPreview ? (
                            <div className="relative w-16 h-16 shrink-0">
                              <img src={photoPreview} alt={t("login_photo_preview_alt")} className="w-16 h-16 rounded-full object-cover border-2 border-border/60" />
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
                              <span>{photoFile ? t("login_change_photo") : t("login_add_photo")}</span>
                            </Button>
                            <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                          </label>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="signup_bio">{t("login_bio")} <span className="text-xs text-muted-foreground font-normal">{t("login_optional")}</span></Label>
                        <Textarea
                          id="signup_bio"
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder={t("login_bio_placeholder")}
                          className="min-h-16 resize-none"
                        />
                      </div>

                      {/* Perfil comercial = Vitrine. Com FEATURES.store
                          desligada não existe onde esses dados apareçam: o
                          usuário se declararia profissional, preencheria um
                          wizard de 3 passos e não seria listado em lugar
                          nenhum. Esconder o checkbox desvia o cadastro do
                          step 2.5 inteiro, porque a bifurcação lê
                          `hasCommercialProfile`, que fica em `false`. */}
                      {FEATURES.store && (
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
                            {t("login_has_commercial")}
                          </Label>
                          <p className="text-xs text-muted-foreground">{t("login_commercial_hint")}</p>
                        </div>
                      </div>
                      )}

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-full flex-1"
                          onClick={() => setSignupStep(1)}
                        >
                          {t("login_back")}
                        </Button>
                        <Button
                          type="button"
                          className="rounded-full flex-1"
                          onClick={handleSignupStep2}
                          disabled={
                            !displayName.trim() ||
                            username.trim().length < 3 ||
                            checkingSignupHandle ||
                            signupHandleExists !== false
                          }
                        >
                          {t("login_next")}
                        </Button>
                      </div>

                      {/* Skip option */}
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
                        onClick={() => {
                          if (!displayName.trim()) {
                            toast({ title: t("login_toast_name_required_title"), description: t("login_toast_name_required_desc"), variant: "destructive" });
                            return;
                          }
                          if (!username.trim()) {
                            toast({ title: t("login_toast_handle_required_title"), description: t("login_toast_handle_required_desc"), variant: "destructive" });
                            return;
                          }
                          if (username.trim().length < 3) {
                            toast({ title: t("login_toast_handle_short_title"), description: t("login_toast_handle_short_desc"), variant: "destructive" });
                            return;
                          }
                          if (signupHandleExists === true) {
                            toast({ title: t("login_toast_handle_taken_title"), description: t("login_toast_handle_taken_desc"), variant: "destructive" });
                            return;
                          }
                          setSignupStep(2.8);
                        }}
                      >
                        {t("login_skip_photo_bio")}
                      </button>
                    </div>
                  )}

                  {/* Step 2.5: Commercial Data Wizard */}
                  {signupStep === 2.5 && (
                    <div className="grid gap-4">
                      {/* Wizard header */}
                      <div className="text-center space-y-1">
                        <h3 className="font-semibold text-sm">{t("login_commercial_title")}</h3>
                        <p className="text-xs text-muted-foreground">
                          {commercialWizardStep === 1 && t("login_commercial_step1")}
                          {commercialWizardStep === 2 && t("login_commercial_step2")}
                          {commercialWizardStep === 3 && t("login_commercial_step3")}
                          {commercialWizardStep === 4 && t("login_commercial_step4")}
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
                            <Label>{t("login_business_segment")}</Label>
                            <select
                              value={commercialData.business_segment}
                              onChange={(e) =>
                                setCommercialData({ ...commercialData, business_segment: e.target.value })
                              }
                              className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-foreground"
                            >
                              <option value="">{t("login_select_segment")}</option>
                              <option value="academia">{t("login_seg_gym")}</option>
                              <option value="personal_trainer">{t("login_seg_personal")}</option>
                              <option value="nutricionista">{t("login_seg_nutritionist")}</option>
                              <option value="psicologo">{t("login_seg_psychologist")}</option>
                              <option value="fisioterapeuta">{t("login_seg_physio")}</option>
                              <option value="coach">{t("login_seg_coach")}</option>
                              <option value="outros">{t("login_seg_other")}</option>
                            </select>
                          </div>

                          <div className="grid gap-2">
                            <Label>{t("login_business_name")}</Label>
                            <Input
                              value={commercialData.business_name}
                              onChange={(e) =>
                                setCommercialData({ ...commercialData, business_name: e.target.value })
                              }
                              placeholder={t("login_business_name_placeholder")}
                            />
                          </div>

                          <div className="grid gap-2">
                            <Label>
                              {t("login_business_logo")}{" "}
                              <span className="text-xs text-muted-foreground font-normal">{t("login_optional")}</span>
                            </Label>
                            <div className="flex items-center gap-3">
                              {businessLogoPreview ? (
                                <div className="relative w-16 h-16 shrink-0">
                                  <img src={businessLogoPreview} alt={t("login_logo_preview_alt")} className="w-16 h-16 rounded-lg object-cover border-2 border-border/60" />
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
                                  <span>{businessLogoFile ? t("login_change_logo") : t("login_add_logo")}</span>
                                </Button>
                                <input type="file" accept="image/*" onChange={handleBusinessLogoChange} className="hidden" />
                              </label>
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <Label>
                              {t("login_description")}{" "}
                              <span className="text-xs text-muted-foreground font-normal">{t("login_optional")}</span>
                            </Label>
                            <Textarea
                              value={commercialData.business_description}
                              onChange={(e) =>
                                setCommercialData({ ...commercialData, business_description: e.target.value })
                              }
                              placeholder={t("login_business_desc_placeholder")}
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
                              {t("login_back")}
                            </Button>
                            <Button
                              type="button"
                              className="rounded-full flex-1"
                              onClick={() => {
                                if (!commercialData.business_name.trim() || !commercialData.business_segment) {
                                  toast({
                                    title: t("login_toast_required_fields_title"),
                                    description: t("login_toast_required_business_desc"),
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                setCommercialWizardStep(2);
                              }}
                              disabled={!commercialData.business_name.trim() || !commercialData.business_segment}
                            >
                              {t("login_next")}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Sub-step 2: Contact */}
                      {commercialWizardStep === 2 && (
                        <div className="grid gap-3">
                          <div className="grid gap-2">
                            <Label>
                              {t("login_business_phone")}{" "}
                              <span className="text-xs text-muted-foreground font-normal">{t("login_optional")}</span>
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
                              {t("login_business_email")}{" "}
                              <span className="text-xs text-muted-foreground font-normal">{t("login_optional")}</span>
                            </Label>
                            <Input
                              type="email"
                              value={commercialData.business_email}
                              onChange={(e) =>
                                setCommercialData({ ...commercialData, business_email: e.target.value })
                              }
                              placeholder={t("login_business_email_placeholder")}
                              className={commercialData.business_email && !isValidEmail(commercialData.business_email) ? "border-red-500" : ""}
                            />
                            {commercialData.business_email && !isValidEmail(commercialData.business_email) && (
                              <p className="text-xs text-red-500">{t("login_business_email_invalid")}</p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full flex-1"
                              onClick={() => setCommercialWizardStep(1)}
                            >
                              {t("login_back")}
                            </Button>
                            <Button
                              type="button"
                              className="rounded-full flex-1"
                              disabled={!!(commercialData.business_email && !isValidEmail(commercialData.business_email))}
                              onClick={() => setCommercialWizardStep(3)}
                            >
                              {t("login_next")}
                            </Button>
                          </div>

                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
                            onClick={() => setCommercialWizardStep(3)}
                          >
                            {t("login_skip_for_now")}
                          </button>
                        </div>
                      )}

                      {/* Sub-step 3: Online presence */}
                      {commercialWizardStep === 3 && (
                        <div className="grid gap-3">
                          <div className="grid gap-2">
                            <Label>
                              {t("login_business_website")}{" "}
                              <span className="text-xs text-muted-foreground font-normal">{t("login_optional")}</span>
                            </Label>
                            <Input
                              type="url"
                              value={commercialData.business_website}
                              onChange={(e) =>
                                setCommercialData({ ...commercialData, business_website: e.target.value })
                              }
                              placeholder={t("login_business_website_placeholder")}
                              className={commercialData.business_website && !isValidUrl(commercialData.business_website) ? "border-red-500" : ""}
                            />
                            {commercialData.business_website && !isValidUrl(commercialData.business_website) && (
                              <p className="text-xs text-red-500">{t("login_business_url_invalid")}</p>
                            )}
                          </div>

                          <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">{t("login_commercial_summary")}</p>
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
                              {t("login_back")}
                            </Button>
                            <Button
                              type="button"
                              className="rounded-full flex-1"
                              disabled={!!(commercialData.business_website && !isValidUrl(commercialData.business_website))}
                              onClick={handleCommercialDataComplete}
                            >
                              {t("login_next")}
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
                                    {t("login_plan_n").replace("{n}", String(idx + 1))}
                                  </span>
                                  <button
                                    type="button"
                                    aria-label={t("login_remove_plan")}
                                    onClick={() => setServicePlans(servicePlans.filter((_, i) => i !== idx))}
                                    className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>

                                {/* Nome */}
                                <div className="grid gap-1.5">
                                  <Label className="text-xs">{t("login_plan_name")}</Label>
                                  <Input
                                    value={plan.name}
                                    onChange={(e) => {
                                      const updated = [...servicePlans];
                                      updated[idx] = { ...updated[idx], name: e.target.value };
                                      setServicePlans(updated);
                                    }}
                                    placeholder={t("login_plan_name_placeholder")}
                                  />
                                </div>

                                {/* Preço */}
                                <div className="grid gap-1.5">
                                  <Label className="text-xs">
                                    {t("login_price")}{" "}
                                    <span className="text-muted-foreground font-normal">{t("login_price_hint")}</span>
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
                                    {t("login_plan_includes")}{" "}
                                    <span className="text-muted-foreground font-normal">{t("login_optional")}</span>
                                  </Label>
                                  <Input
                                    value={plan.description ?? ""}
                                    onChange={(e) => {
                                      const updated = [...servicePlans];
                                      updated[idx] = { ...updated[idx], description: e.target.value };
                                      setServicePlans(updated);
                                    }}
                                    placeholder={t("login_plan_includes_placeholder")}
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
                            {t("login_add_plan")}
                          </Button>

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-full flex-1"
                              onClick={() => setCommercialWizardStep(3)}
                            >
                              {t("login_back")}
                            </Button>
                            <Button
                              type="button"
                              className="rounded-full flex-1"
                              onClick={handleCommercialPlansComplete}
                            >
                              {t("login_finish")}
                            </Button>
                          </div>

                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-foreground text-center transition-colors"
                            onClick={handleCommercialPlansComplete}
                          >
                            {t("login_add_plans_later")}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 2.8: Physical Data */}
                  {signupStep === 2.8 && (
                    <div className="grid gap-4">
                      <div className="text-center space-y-1 mb-1">
                        <h3 className="font-semibold text-sm">{t("login_physical_title")}</h3>
                        <p className="text-xs text-muted-foreground">{t("login_physical_desc")} <span className="font-medium">{t("login_optional")}</span></p>
                      </div>

                      <div className="grid gap-2">
                        <Label>{t("login_gender")}</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: "male", label: t("login_gender_male") },
                            { value: "female", label: t("login_gender_female") },
                            { value: "other", label: t("login_gender_other") },
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
                                <Label htmlFor="signup_age">{t("login_age")}</Label>
                                <Input
                                  id="signup_age"
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  max={100}
                                  step={1}
                                  value={age}
                                  onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))}
                                  placeholder={t("login_eg_age")}
                                  className={ageError ? "border-red-500" : ""}
                                />
                                {ageError && (
                                  <p className="text-xs text-red-600">{t("login_age_range")}</p>
                                )}
                              </div>
                              <div className="grid gap-1">
                                <Label htmlFor="signup_height">{t("login_height")}</Label>
                                <Input
                                  id="signup_height"
                                  type="number"
                                  inputMode="numeric"
                                  min={100}
                                  max={300}
                                  step={1}
                                  value={height}
                                  onChange={(e) => setHeight(e.target.value.replace(/[^0-9]/g, ""))}
                                  placeholder={t("login_eg_height")}
                                  className={heightError ? "border-red-500" : ""}
                                />
                                {heightError && (
                                  <p className="text-xs text-red-600">{t("login_height_range")}</p>
                                )}
                              </div>
                              <div className="grid gap-1">
                                <Label htmlFor="signup_weight">{t("login_weight")}</Label>
                                <Input
                                  id="signup_weight"
                                  type="number"
                                  inputMode="decimal"
                                  min={20}
                                  max={200}
                                  value={weight}
                                  onChange={(e) => setWeight(e.target.value)}
                                  placeholder={t("login_eg_weight")}
                                  className={weightError ? "border-red-500" : ""}
                                />
                                {weightError && (
                                  <p className="text-xs text-red-600">{t("login_weight_range")}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2 mt-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full flex-1"
                                onClick={() => setSignupStep(FEATURES.store && hasCommercialProfile ? 2.5 : 2)}
                              >
                                {t("login_back")}
                              </Button>
                              <Button
                                type="button"
                                className="rounded-full flex-1"
                                disabled={hasErrors}
                                onClick={() => setSignupStep(3)}
                              >
                                {t("login_next")}
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
                        <h3 className="font-semibold text-sm">{t("login_goal_title")}</h3>
                        <p className="text-xs text-muted-foreground">{t("login_goal_desc")}</p>
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
                            <span className="text-sm font-medium">{t(segment.labelKey)}</span>
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
                          {t("login_back")}
                        </Button>
                        <Button
                          type="button"
                          className="rounded-full flex-1"
                          onClick={handleSignupStep3}
                          disabled={busy}
                        >
                          {busy ? t("login_creating") : t("login_next")}
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
        maxExport={AVATAR_MAX_EXPORT}
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
        maxExport={AVATAR_MAX_EXPORT}
        onConfirm={(dataUrl, blob) => {
          const file = pendingLoginLogoFileRef.current;
          if (!file) return;
          setBusinessLogoFile(new File([blob], file.name, { type: "image/jpeg" }));
          setBusinessLogoPreview(dataUrl);
          setPendingLoginLogoCropSrc(null);
        }}
        onCancel={() => setPendingLoginLogoCropSrc(null)}
      />

      <AlertDialog open={showEnableBiometricPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
              <ScanFace className="h-6 w-6" />
            </div>
            <AlertDialogTitle className="text-center">
              {t("login_biometric_enable_title").replace("{method}", biometricSupport.label)}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {t("login_biometric_enable_desc").replace("{method}", biometricSupport.label)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={biometricBusy} onClick={dismissEnableBiometric}>
              {t("login_not_now")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={biometricBusy}
              onClick={(e) => {
                e.preventDefault();
                confirmEnableBiometric();
              }}
            >
              {biometricBusy
                ? t("login_activating")
                : t("login_biometric_enable_action").replace("{method}", biometricSupport.label)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
