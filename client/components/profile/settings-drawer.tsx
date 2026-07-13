import * as React from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { LoadingSpinner } from "@/components/shared/animated-loading";
import { ImageCropperDrawer } from "@/components/shared/image-cropper-drawer";
import {
  updateUserProfileDb,
  createOrUpdateCommercialProfileDb,
  deleteCommercialProfileDb,
  getCommercialProfileDb,
  getCommercialPlansDb,
  saveCommercialPlansDb,
  getExpiredUserFlowsDb,
  deleteStoryDb,
  createPostDb,
  createShotDb,
  createStoryDb,
  updateUserPersonalDataDb,
  deletePushTokenDb,
  recordAccessSessionDb,
  bufferScreenTime,
  flushScreenTimeDb,
  type UserProfile,
  type UserStats,
  type CommercialProfile,
  type ServicePlan,
  type StoryWithUser,
} from "@/lib/ritmofit-db";
import { supabase, resetSupabaseAuth } from "@/lib/supabase";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { useLanguage } from "@/lib/language-context";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";
import {
  Edit2,
  Upload,
  ArrowLeft,
  Settings,
  LogOut,
  Trash2,
  Bell,
  Globe,
  BarChart3,
  User,
  X,
  Share2,
  ZoomIn,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Lock,
  ScanFace,
  Repeat,
} from "lucide-react";
import {
  isBiometricSupported,
  isBiometricEnabled,
  disableBiometric,
  type BiometricSupport,
} from "@/lib/biometric-auth";

interface SettingsDrawerProps {
  profile: UserProfile;
  /** Auth UUID do usuário (user.id do Supabase Auth — diferente de userId) */
  userId: string;
  userEmail: string;
  stats: UserStats;
  onProfileUpdated: (updated: UserProfile) => void;
  onRequestDeleteAccount: () => void;
  /** Controle externo de abertura (quando o trigger é renderizado fora) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Oculta o botão de trigger padrão (use com open/onOpenChange) */
  hideTrigger?: boolean;
  /** Quando true, abre diretamente no sub-drawer "Meu Perfil" ao invés da lista de settings */
  directToProfileEdit?: boolean;
  /** Quando definido, abre diretamente no Arquivo de Flows com esse flow expandido
   *  (vindo de uma notificação de reação/comentário em flow já expirado) */
  initialArchivedFlow?: StoryWithUser | null;
}

export function SettingsDrawer({
  profile,
  userId,
  userEmail,
  onProfileUpdated,
  stats,
  onRequestDeleteAccount,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger,
  directToProfileEdit,
  initialArchivedFlow,
}: SettingsDrawerProps) {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const viewportHeight = useKeyboardAwareHeight();

  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = controlledOnOpenChange ?? setInternalOpen;

  // --- My Profile (unified drawer with tabs) ---
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [profileTab, setProfileTab] = React.useState<"public" | "personal">("public");

  // Quando directToProfileEdit=true, pula a lista e vai direto para "Meu Perfil"
  const directToProfileEditRef = React.useRef(false);
  directToProfileEditRef.current = !!directToProfileEdit;
  React.useEffect(() => {
    if (isOpen && directToProfileEditRef.current) {
      openEditProfile("public");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // --- Account & Security ---
  const [isAccountOpen, setIsAccountOpen] = React.useState(false);
  const [editEmail, setEditEmail] = React.useState("");
  const [isChangingEmail, setIsChangingEmail] = React.useState(false);
  const [editNickname, setEditNickname] = React.useState("");
  const [editBio, setEditBio] = React.useState("");
  const [editHandle, setEditHandle] = React.useState("");
  const [editObjectives, setEditObjectives] = React.useState<string[]>([]);
  const [editPhotoFile, setEditPhotoFile] = React.useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = React.useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = React.useState(false);
  const [pendingPhotoCropSrc, setPendingPhotoCropSrc] = React.useState<string | null>(null);
  const pendingPhotoFileRef = React.useRef<File | null>(null);
  const [pendingLogoCropSrc, setPendingLogoCropSrc] = React.useState<string | null>(null);
  const pendingLogoFileRef = React.useRef<File | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isResettingPassword, setIsResettingPassword] = React.useState(false);
  const [showPasswordForm, setShowPasswordForm] = React.useState(false);
  const [newPwd, setNewPwd] = React.useState("");
  const [confirmPwd, setConfirmPwd] = React.useState("");
  const [showNewPwdInput, setShowNewPwdInput] = React.useState(false);
  const [showConfirmPwdInput, setShowConfirmPwdInput] = React.useState(false);
  // --- Biometric login (Face ID / Touch ID) ---
  const [biometricSupport, setBiometricSupport] = React.useState<BiometricSupport>({ available: false, label: "Biometria" });
  const [biometricEnabled, setBiometricEnabled] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const support = await isBiometricSupported();
      if (cancelled) return;
      setBiometricSupport(support);
      setBiometricEnabled(support.available && isBiometricEnabled());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openEditProfile = (tab: "public" | "personal" = "public") => {
    setEditNickname(profile.nickname);
    setEditBio(profile.bio ?? "");
    setEditHandle((profile.handle ?? "").replace(/^@/, ""));
    setEditObjectives(profile.objectives ?? []);
    setEditPhotoPreview(profile.photo ?? null);
    setEditPhotoFile(null);
    setRemovePhoto(false);
    setProfileTab(tab);
    setIsEditOpen(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    pendingPhotoFileRef.current = file;
    setRemovePhoto(false);
    setPendingPhotoCropSrc(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
    setRemovePhoto(true);
  };

  const handleSaveProfile = async () => {
    if (!editNickname.trim()) {
      toast({ title: t("settings_toast_name_required"), description: t("settings_toast_name_required_desc"), variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      let photoUrl: string | null = removePhoto ? null : (profile.photo ?? null);
      if (editPhotoFile) {
        const extension = editPhotoFile.name.split(".").pop() || "jpg";
        const filePath = `${userId}/profile-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(filePath, editPhotoFile, { contentType: editPhotoFile.type });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(filePath);
        photoUrl = publicUrl;
      }
      const updated = await updateUserProfileDb(userId, {
        nickname: editNickname,
        bio: editBio,
        photo: photoUrl,
        handle: editHandle.trim() || undefined,
        objectives: editObjectives.length > 0 ? editObjectives : null,
      });
      if (updated) {
        onProfileUpdated(updated);
        toast({ title: t("settings_toast_profile_updated"), description: t("settings_toast_profile_updated_desc") });
        setIsEditOpen(false);
      }
    } catch (err: any) {
      toast({ title: t("settings_toast_profile_error"), description: err?.message || t("retry"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- Commercial Profile ---
  const [isCommercialOpen, setIsCommercialOpen] = React.useState(false);
  const [isCommercialDashboardOpen, setIsCommercialDashboardOpen] = React.useState(false);
  const [commercialProfile, setCommercialProfile] = React.useState<CommercialProfile | null>(null);
  const [commercialFormData, setCommercialFormData] = React.useState({
    business_segment: "",
    business_name: "",
    business_description: "",
    business_phone: "",
    business_email: "",
    business_website: "",
  });
  const [isSavingCommercial, setIsSavingCommercial] = React.useState(false);
  const [commercialLogoFile, setCommercialLogoFile] = React.useState<File | null>(null);
  const [commercialLogoPreview, setCommercialLogoPreview] = React.useState<string | null>(null);
  const [logoZoomOpen, setLogoZoomOpen] = React.useState(false);
  const [servicePlans, setServicePlans] = React.useState<ServicePlan[]>([]);
  const [isAddingPlan, setIsAddingPlan] = React.useState(false);
  const [newPlanName, setNewPlanName] = React.useState("");
  const [newPlanPrice, setNewPlanPrice] = React.useState("");
  const [newPlanDescription, setNewPlanDescription] = React.useState("");
  const [editingPlanIdx, setEditingPlanIdx] = React.useState<number | null>(null);
  const [editPlanName, setEditPlanName] = React.useState("");
  const [editPlanPrice, setEditPlanPrice] = React.useState("");
  const [editPlanDescription, setEditPlanDescription] = React.useState("");

  const loadCommercialProfile = React.useCallback(async () => {
    try {
      const [cp, plans] = await Promise.all([
        getCommercialProfileDb(userId),
        getCommercialPlansDb(userId),
      ]);
      if (cp) {
        setCommercialProfile(cp);
        setCommercialFormData({
          business_segment: cp.business_segment || "",
          business_name: cp.business_name || "",
          business_description: cp.business_description || "",
          business_phone: cp.business_phone || "",
          business_email: cp.business_email || "",
          business_website: cp.business_website || "",
        });
        setCommercialLogoPreview(cp.business_logo_url || null);
      }
      if (plans) setServicePlans(plans);
    } catch (err) {
      console.error("Error loading commercial profile:", err);
    }
  }, [userId]);

  // Carrega o perfil comercial ao abrir as configurações
  React.useEffect(() => {
    if (isOpen) {
      loadCommercialProfile();
    }
  }, [isOpen, loadCommercialProfile]);

  const openCommercialProfile = () => {
    setIsAddingPlan(false);
    setNewPlanName(""); setNewPlanPrice(""); setNewPlanDescription("");
    setEditingPlanIdx(null); setEditPlanName(""); setEditPlanPrice(""); setEditPlanDescription("");
    setIsCommercialOpen(true);
    loadCommercialProfile();
  };

  const formatPhone = (value: string): string => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    if (cleaned.length <= 2) return cleaned.length > 0 ? `(${cleaned}` : "";
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  };

  const handleSaveCommercial = async () => {
    setIsSavingCommercial(true);
    try {
      let logoUrl: string | null | undefined = commercialLogoPreview === null ? null : commercialProfile?.business_logo_url;
      if (commercialLogoFile) {
        const ext = commercialLogoFile.name.split(".").pop() || "jpg";
        const filePath = `${userId}/business-logo-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("posts").upload(filePath, commercialLogoFile, { contentType: commercialLogoFile.type });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from("posts").getPublicUrl(filePath);
        logoUrl = publicUrl;
        setCommercialLogoFile(null);
      }
      const [updated] = await Promise.all([
        createOrUpdateCommercialProfileDb(userId, { ...commercialFormData, business_logo_url: logoUrl }),
        saveCommercialPlansDb(userId, servicePlans),
      ]);
      setCommercialProfile(updated);
      toast({ title: t("settings_toast_commercial_success"), description: t("settings_toast_commercial_success_desc") });
      setIsCommercialOpen(false);
    } catch (err: any) {
      toast({ title: t("settings_toast_commercial_error"), description: err?.message || t("retry"), variant: "destructive" });
    } finally {
      setIsSavingCommercial(false);
    }
  };

  // --- Language ---
  const [isLanguageOpen, setIsLanguageOpen] = React.useState(false);

  // --- Notifications ---
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);

  const NOTIF_PREFS_KEY = "linka_notif_prefs";
  const defaultNotifPrefs = {
    workoutReminders: true,
    achievementAlerts: true,
    friendActivity: true,
    messages: true,
    sound: true,
  };

  const [notifications, setNotifications] = React.useState<typeof defaultNotifPrefs>(() => {
    try {
      const stored = localStorage.getItem(NOTIF_PREFS_KEY);
      if (stored) return { ...defaultNotifPrefs, ...(JSON.parse(stored) as Partial<typeof defaultNotifPrefs>) };
    } catch {}
    return defaultNotifPrefs;
  });

  const handleToggleNotification = React.useCallback(
    async (key: keyof typeof defaultNotifPrefs) => {
      const newValue = !notifications[key];
      const newPrefs = { ...notifications, [key]: newValue };
      setNotifications(newPrefs);
      try {
        localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(newPrefs));
      } catch {}

      if (key === "workoutReminders") {
        if (!newValue) {
          // Cancelar todas as notificações locais de rotina
          try {
            const pending = await LocalNotifications.getPending();
            if (pending.notifications.length > 0) {
              await LocalNotifications.cancel({ notifications: pending.notifications });
            }
          } catch {}
        } else {
          // Re-agendar disparando o evento que o hook escuta
          window.dispatchEvent(new Event("ritmofit-routines-changed"));
        }
      }

      if (key === "messages" || key === "achievementAlerts" || key === "friendActivity") {
        if (!Capacitor.isNativePlatform()) return;
        const wasAnyEnabled =
          notifications.messages || notifications.achievementAlerts || notifications.friendActivity;
        const isAnyEnabled =
          newPrefs.messages || newPrefs.achievementAlerts || newPrefs.friendActivity;

        if (wasAnyEnabled && !isAnyEnabled) {
          // Todas as push desativadas → remover token do servidor e cancelar registro no APNs
          try {
            const token = localStorage.getItem("linka_push_token");
            if (token) {
              await deletePushTokenDb(token);
              localStorage.removeItem("linka_push_token");
            }
            await PushNotifications.unregister();
          } catch {}
        } else if (!wasAnyEnabled && isAnyEnabled) {
          // Pelo menos uma push ativada → re-registrar com APNs
          try {
            let permStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive === "prompt") {
              permStatus = await PushNotifications.requestPermissions();
            }
            if (permStatus.receive === "granted") {
              await PushNotifications.register();
            }
          } catch {}
        }
      }
    },
    [notifications]
  );

  // --- Privacy ---
  const [isPrivacyOpen, setIsPrivacyOpen] = React.useState(false);
  const [hideFollowLists, setHideFollowLists] = React.useState(profile.hide_follow_lists ?? false);
  const [hidePostsFromNonFollowers, setHidePostsFromNonFollowers] = React.useState(profile.hide_posts_from_non_followers ?? false);
  const [isSavingPrivacy, setIsSavingPrivacy] = React.useState(false);

  // Mantém os toggles sincronizados quando o perfil é recarregado
  React.useEffect(() => {
    setHideFollowLists(profile.hide_follow_lists ?? false);
    setHidePostsFromNonFollowers(profile.hide_posts_from_non_followers ?? false);
  }, [profile.hide_follow_lists, profile.hide_posts_from_non_followers]);

  const handleSavePrivacy = async (next: { hideFollowLists?: boolean; hidePostsFromNonFollowers?: boolean }) => {
    const newHideFollows = next.hideFollowLists ?? hideFollowLists;
    const newHidePosts = next.hidePostsFromNonFollowers ?? hidePostsFromNonFollowers;
    // Atualização otimista
    setHideFollowLists(newHideFollows);
    setHidePostsFromNonFollowers(newHidePosts);
    setIsSavingPrivacy(true);
    try {
      const updated = await updateUserProfileDb(userId, {
        nickname: profile.nickname,
        bio: profile.bio ?? undefined,
        photo: profile.photo ?? null,
        handle: profile.handle ?? undefined,
        objectives: profile.objectives ?? null,
        hide_follow_lists: newHideFollows,
        hide_posts_from_non_followers: newHidePosts,
      });
      if (updated) {
        onProfileUpdated(updated);
        toast({ title: t("settings_privacy_saved"), description: t("settings_privacy_saved_desc") });
      }
    } catch (err: any) {
      // Reverte em caso de erro
      setHideFollowLists(profile.hide_follow_lists ?? false);
      setHidePostsFromNonFollowers(profile.hide_posts_from_non_followers ?? false);
      toast({ title: t("settings_privacy_error"), description: err?.message || t("retry"), variant: "destructive" });
    } finally {
      setIsSavingPrivacy(false);
    }
  };

  // --- Time Management ---
  const [isTimeManagementOpen, setIsTimeManagementOpen] = React.useState(false);
  const [dailyUsageLimit, setDailyUsageLimit] = React.useState(() => {
    const stored = localStorage.getItem("ritmofit_daily_limit_minutes");
    return stored ? parseInt(stored, 10) : 0;
  });

  // --- Flow History ---
  const [isFlowHistoryOpen, setIsFlowHistoryOpen] = React.useState(false);
  const [expiredFlows, setExpiredFlows] = React.useState<StoryWithUser[]>([]);
  const [isLoadingFlowHistory, setIsLoadingFlowHistory] = React.useState(false);
  const [expandedFlow, setExpandedFlow] = React.useState<StoryWithUser | null>(null);
  const [repostingFlowId, setRepostingFlowId] = React.useState<string | null>(null);
  const [deletingFlowId, setDeletingFlowId] = React.useState<string | null>(null);
  const [flowToDelete, setFlowToDelete] = React.useState<StoryWithUser | null>(null);
  const [flowToShare, setFlowToShare] = React.useState<StoryWithUser | null>(null);

  // Quando initialArchivedFlow está definido (vindo de notificação de flow expirado),
  // pula a lista e abre direto o flow em tela cheia — mesmo padrão de directToProfileEdit.
  const initialArchivedFlowRef = React.useRef<StoryWithUser | null>(null);
  initialArchivedFlowRef.current = initialArchivedFlow ?? null;
  React.useEffect(() => {
    if (isOpen && initialArchivedFlowRef.current) {
      setExpandedFlow(initialArchivedFlowRef.current);
      openFlowHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const openFlowHistory = async () => {
    setIsFlowHistoryOpen(true);
    setIsLoadingFlowHistory(true);
    try {
      const flows = await getExpiredUserFlowsDb();
      setExpiredFlows(flows);
    } catch (err) {
      console.error("Error loading flow history:", err);
    } finally {
      setIsLoadingFlowHistory(false);
    }
  };

  const handleDeleteFlow = async (flow: StoryWithUser) => {
    setDeletingFlowId(flow.id);
    try {
      const ok = await deleteStoryDb(flow.id);
      if (ok) {
        setExpiredFlows((prev) => prev.filter((f) => f.id !== flow.id));
        if (expandedFlow?.id === flow.id) setExpandedFlow(null);
        toast({ title: t("settings_flow_deleted") });
      } else {
        toast({ title: t("settings_flow_delete_error"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("settings_flow_delete_error"), variant: "destructive" });
    } finally {
      setDeletingFlowId(null);
    }
  };

  const confirmDeleteFlow = async () => {
    if (!flowToDelete) return;
    const flow = flowToDelete;
    setFlowToDelete(null);
    await handleDeleteFlow(flow);
  };

  const handleRepostFlow = async (flow: StoryWithUser) => {
    if (!flow.media_url) return;
    setFlowToShare(null);
    setRepostingFlowId(flow.id);
    try {
      // Feed posts só suportam imagem (photo) — flows em vídeo viram Shot,
      // senão a URL do vídeo cai no campo photo do post e quebra no feed.
      const isVideo = /\.(mp4|mov|webm)/i.test(flow.media_url);
      if (isVideo) {
        await createShotDb(flow.media_url, flow.description || "");
        toast({ title: t("settings_flow_reposted_shots") });
      } else {
        await createPostDb(flow.media_url, flow.description || "");
        toast({ title: t("settings_flow_reposted_feed") });
      }
      if (expandedFlow?.id === flow.id) setExpandedFlow(null);
    } catch {
      toast({ title: t("settings_flow_repost_error"), variant: "destructive" });
    } finally {
      setRepostingFlowId(null);
    }
  };

  const handleRepostToNewFlow = async (flow: StoryWithUser) => {
    if (!flow.media_url) return;
    setFlowToShare(null);
    setRepostingFlowId(flow.id);
    try {
      const created = await createStoryDb(
        flow.description || "",
        flow.media_url,
        flow.background_color ?? null,
        flow.text_position ?? null,
        flow.text_elements ?? null,
        flow.media_transform ?? null,
      );
      if (created) {
        toast({ title: t("settings_flow_reposted_flow") });
        if (expandedFlow?.id === flow.id) setExpandedFlow(null);
      } else {
        toast({ title: t("settings_flow_repost_error"), variant: "destructive" });
      }
    } catch {
      toast({ title: t("settings_flow_repost_error"), variant: "destructive" });
    } finally {
      setRepostingFlowId(null);
    }
  };

  // --- Personal Data ---
  const [personalDataForm, setPersonalDataForm] = React.useState({
    height: profile.height ?? "",
    weight: profile.weight ?? "",
    age: profile.age ?? "",
  });
  const [isSavingPersonalData, setIsSavingPersonalData] = React.useState(false);

  const handleSavePersonalData = async () => {
    setIsSavingPersonalData(true);
    try {
      await Promise.all([
        updateUserPersonalDataDb(userId, personalDataForm),
        updateUserProfileDb(userId, {
          nickname: profile.nickname,
          bio: profile.bio ?? undefined,
          photo: profile.photo ?? null,
          handle: profile.handle ?? undefined,
          objectives: editObjectives.length > 0 ? editObjectives : null,
        }).then((updated) => { if (updated) onProfileUpdated(updated); }),
      ]);
      toast({ title: t("settings_toast_personal_saved"), description: t("settings_toast_personal_saved_desc") });
    } catch (err: any) {
      toast({ title: t("error"), description: err?.message || t("settings_toast_personal_error"), variant: "destructive" });
    } finally {
      setIsSavingPersonalData(false);
    }
  };

  // --- Logout ---
  const handleLogout = async () => {
    try {
      // Record session duration before signing out
      const sessionStartRaw = sessionStorage.getItem("ritmofit_session_start");
      if (sessionStartRaw && userId) {
        const sessionSeconds = Math.floor((Date.now() - parseInt(sessionStartRaw, 10)) / 1000);
        if (sessionSeconds >= 10) {
          await recordAccessSessionDb(userId, sessionSeconds).catch(() => {});
        }
      }

      // Contabiliza a tela atual e despeja o buffer acumulado num único insert.
      // Precisa rodar ANTES do signOut — depois a sessão cai e o RLS barra a escrita.
      const screenStartRaw = sessionStorage.getItem("ritmofit_screen_start");
      const currentScreen = sessionStorage.getItem("ritmofit_current_screen");
      if (screenStartRaw && currentScreen && userId) {
        const screenSeconds = Math.floor((Date.now() - parseInt(screenStartRaw, 10)) / 1000);
        bufferScreenTime(currentScreen, screenSeconds);
      }
      if (userId) {
        await flushScreenTimeDb(userId).catch(() => {});
      }

      // Remove device token before signing out so this device stops receiving
      // push notifications for the current account
      if (Capacitor.isNativePlatform()) {
        const token = localStorage.getItem("linka_push_token");
        if (token) {
          await deletePushTokenDb(token);
          localStorage.removeItem("linka_push_token");
        }
        await PushNotifications.unregister();
      }
      await resetSupabaseAuth();
      setIsOpen(false);
      navigate("/");
      toast({ title: t("settings_toast_logout_success") });
    } catch (err: any) {
      toast({ title: t("settings_toast_logout_error"), description: err?.message || t("retry"), variant: "destructive" });
    }
  };

  const subDrawerBack = (setter: (v: boolean) => void) => (
    <button onClick={() => setter(false)} className="p-1 rounded-full transition-colors" style={{ color: "rgba(255,255,255,.7)" }}>
      <ArrowLeft className="h-5 w-5" />
    </button>
  );

  return (
    <>
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        {!hideTrigger && (
          <Button
            onClick={() => setIsOpen(true)}
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}

        <DrawerContent
          handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
          className="flex flex-col modal-enter !rounded-t-[32px] !border-0"
          style={{
            maxHeight: `min(80dvh, ${viewportHeight - 8}px)`,
            background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            borderTop: "1px solid rgba(255,255,255,.14)",
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerHeader className="shrink-0">
            <DrawerTitle style={{ color: "#fff" }}>{t("settings_title")}</DrawerTitle>
          </DrawerHeader>

          <div className="flex flex-col flex-1 gap-2 overflow-y-auto px-4 pb-4">

            {/* ── Perfil ── */}
            <p className="text-xs font-semibold uppercase tracking-wider pt-1 pb-0.5" style={{ color: "rgba(255,255,255,.5)" }}>{t("settings_section_profile")}</p>

            {/* My Profile (unified) */}
            <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
              <Button onClick={() => openEditProfile("public")} variant="outline" className="gap-2 justify-between">
                <span>{t("settings_my_profile")}</span>
                <User className="h-4 w-4" />
              </Button>
              <DrawerContent
                handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
                className="flex flex-col modal-enter !rounded-t-[32px] !border-0"
                style={{
                  maxHeight: `min(80dvh, ${viewportHeight - 8}px)`,
                  background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
                  backdropFilter: "blur(40px) saturate(180%)",
                  WebkitBackdropFilter: "blur(40px) saturate(180%)",
                  borderTop: "1px solid rgba(255,255,255,.14)",
                }}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DrawerHeader className="shrink-0 flex items-center gap-2">
                  {subDrawerBack(setIsEditOpen)}
                  <DrawerTitle style={{ color: "#fff" }}>Meu Perfil</DrawerTitle>
                </DrawerHeader>

                {/* Tabs */}
                <div className="shrink-0 px-4 pb-2">
                  <div className="flex rounded-lg p-1 gap-1" style={{ background: "rgba(255,255,255,.08)" }}>
                    <button
                      onClick={() => setProfileTab("public")}
                      className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors`}
                      style={profileTab === "public" ? { background: "rgba(255,255,255,.15)", color: "#fff" } : { color: "rgba(255,255,255,.5)" }}
                    >
                      Público
                    </button>
                    <button
                      onClick={() => setProfileTab("personal")}
                      className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors`}
                      style={profileTab === "personal" ? { background: "rgba(255,255,255,.15)", color: "#fff" } : { color: "rgba(255,255,255,.5)" }}
                    >
                      Pessoal
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  {profileTab === "public" ? (
                    <div className="space-y-4">
                      {/* Photo */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium" style={{ color: "#fff" }}>Foto do Perfil</label>
                        <div className="flex items-center gap-4">
                          <div className="relative h-16 w-16 shrink-0">
                            <div className="h-16 w-16 rounded-full overflow-hidden bg-muted">
                              {editPhotoPreview ? (
                                <img src={editPhotoPreview} alt="preview" className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full bg-muted" />
                              )}
                            </div>
                            {editPhotoPreview && (
                              <button
                                type="button"
                                onClick={handleRemovePhoto}
                                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive flex items-center justify-center shadow-md ring-2 ring-background"
                                aria-label={t("settings_remove_photo")}
                              >
                                <X className="h-3 w-3 text-white" />
                              </button>
                            )}
                          </div>
                          <label>
                            <Button type="button" variant="outline" size="sm" asChild>
                              <span><Upload className="h-4 w-4 mr-2" />{t("settings_change_photo")}</span>
                            </Button>
                            <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                          </label>
                        </div>
                      </div>
                      {/* Name */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_name_label")}</label>
                        <Input value={editNickname} onChange={(e) => setEditNickname(e.target.value)} placeholder={t("settings_name_placeholder")} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
                      </div>
                      {/* Bio */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("profile_bio")}</label>
                        <Textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder={t("settings_bio_placeholder")} className="min-h-24" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
                      </div>
                      {/* Handle */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_handle_label")}</label>
                        <div className="flex items-center rounded-md overflow-hidden" style={{ border: "1px solid rgba(255,255,255,.12)" }}>
                          <span className="px-3 py-2 text-sm select-none" style={{ background: "rgba(255,255,255,.1)", borderRight: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.5)" }}>@</span>
                          <Input
                            value={editHandle}
                            onChange={(e) => setEditHandle(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ""))}
                            placeholder="seu_usuario"
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
                            style={{ background: "rgba(255,255,255,.07)", color: "#fff" }}
                          />
                        </div>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,.4)" }}>{t("settings_handle_hint")}</p>
                      </div>
                      <Button onClick={handleSaveProfile} disabled={isSaving} className="w-full rounded-full" style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}>
                        {isSaving ? t("saving") : t("settings_save_changes")}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_height_label")}</label>
                        <Input type="number" min={100} max={250} step={1} value={personalDataForm.height} onChange={(e) => setPersonalDataForm((prev) => ({ ...prev, height: String(Math.trunc(Number(e.target.value))) }))} placeholder="Ex: 175" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_weight_label")}</label>
                        <Input type="number" min={30} max={300} step="0.1" value={personalDataForm.weight} onChange={(e) => setPersonalDataForm((prev) => ({ ...prev, weight: e.target.value }))} placeholder="Ex: 70.5" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_age_label")}</label>
                        <Input type="number" min={10} max={120} step={1} value={personalDataForm.age} onChange={(e) => setPersonalDataForm((prev) => ({ ...prev, age: String(Math.trunc(Number(e.target.value))) }))} placeholder="Ex: 28" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
                      </div>
                      {/* Objectives */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_objectives_label")}</label>
                        <div className="grid grid-cols-2 gap-2">
                          {([
                            { id: "fitness", key: "obj_fitness" },
                            { id: "cardio", key: "obj_cardio" },
                            { id: "diets", key: "obj_diets" },
                            { id: "habits", key: "obj_habits" },
                            { id: "yoga", key: "obj_yoga" },
                            { id: "sports", key: "obj_sports" },
                          ] as { id: string; key: import("../../lib/i18n").TranslationKey }[]).map((obj) => {
                            const label = t(obj.key);
                            const selected = editObjectives.includes(obj.id);
                            return (
                              <button
                                key={obj.id}
                                type="button"
                                onClick={() => setEditObjectives((prev) => selected ? prev.filter((o) => o !== obj.id) : [...prev, obj.id])}
                                className="text-left text-xs px-3 py-2 rounded-xl transition-all active:scale-[0.99]"
                                style={selected ? { background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff", border: "1px solid #5b8cff" } : { background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.1)" }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <Button onClick={handleSavePersonalData} disabled={isSavingPersonalData} className="w-full rounded-full" style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}>
                        {isSavingPersonalData ? t("saving") : t("save")}
                      </Button>
                    </div>
                  )}
                </div>
              </DrawerContent>
            </Drawer>

            {/* Account & Security */}
            <Drawer open={isAccountOpen} onOpenChange={setIsAccountOpen}>
              <Button onClick={() => { setEditEmail(userEmail); setIsAccountOpen(true); }} variant="outline" className="gap-2 justify-between">
                <span>{t("settings_account_security")}</span>
                <Settings className="h-4 w-4" />
              </Button>
              <DrawerContent
                handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
                className="flex flex-col modal-enter !rounded-t-[32px] !border-0"
                style={{
                  maxHeight: `min(80dvh, ${viewportHeight - 8}px)`,
                  background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
                  backdropFilter: "blur(40px) saturate(180%)",
                  WebkitBackdropFilter: "blur(40px) saturate(180%)",
                  borderTop: "1px solid rgba(255,255,255,.14)",
                }}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DrawerHeader className="shrink-0 flex items-center gap-2">
                  {subDrawerBack(setIsAccountOpen)}
                  <DrawerTitle style={{ color: "#fff" }}>{t("settings_account_security")}</DrawerTitle>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-4">
                    {/* Email */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_email_label")}</label>
                      <Input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="seu@email.com"
                        style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                      />
                      {editEmail.trim() && editEmail.trim() !== userEmail && (
                        <>
                          <Button
                            onClick={async () => {
                              const trimmed = editEmail.trim();
                              if (!trimmed || trimmed === userEmail) return;
                              setIsChangingEmail(true);
                              try {
                                const { error } = await supabase.auth.updateUser({ email: trimmed });
                                if (error) throw error;
                                toast({ title: t("settings_email_confirm_sent"), description: t("settings_email_confirm_desc") });
                              } catch {
                                toast({ title: t("error"), description: t("settings_email_error"), variant: "destructive" });
                              } finally {
                                setIsChangingEmail(false);
                              }
                            }}
                            disabled={isChangingEmail}
                            variant="outline"
                            className="w-full rounded-full"
                            style={{ background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.7)", border: "1px solid rgba(255,255,255,.12)" }}
                          >
                            {isChangingEmail ? t("sending") : t("settings_change_email")}
                          </Button>
                          <p className="text-xs" style={{ color: "rgba(255,255,255,.4)" }}>{t("settings_change_email_hint")}</p>
                        </>
                      )}
                    </div>
                    {/* Password Reset */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        className="flex items-center justify-between w-full"
                        onClick={() => {
                          setShowPasswordForm((v) => !v);
                          setNewPwd("");
                          setConfirmPwd("");
                        }}
                      >
                        <label className="text-sm font-medium cursor-pointer" style={{ color: "#fff" }}>{t("settings_reset_password")}</label>
                        {showPasswordForm ? <ChevronUp className="h-4 w-4" style={{ color: "rgba(255,255,255,.5)" }} /> : <ChevronDown className="h-4 w-4" style={{ color: "rgba(255,255,255,.5)" }} />}
                      </button>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,.4)" }}>{t("settings_reset_password_hint")}</p>
                      {showPasswordForm && (
                        <div className="space-y-3 pt-1">
                          <div className="relative">
                            <Input
                              type={showNewPwdInput ? "text" : "password"}
                              placeholder={t("settings_new_password")}
                              value={newPwd}
                              onChange={(e) => setNewPwd(e.target.value)}
                              className="pr-10"
                              style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                            />
                            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,.5)" }} onClick={() => setShowNewPwdInput((v) => !v)}>
                              {showNewPwdInput ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <div className="relative">
                            <Input
                              type={showConfirmPwdInput ? "text" : "password"}
                              placeholder={t("settings_confirm_password")}
                              value={confirmPwd}
                              onChange={(e) => setConfirmPwd(e.target.value)}
                              className="pr-10"
                              style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }}
                            />
                            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,.5)" }} onClick={() => setShowConfirmPwdInput((v) => !v)}>
                              {showConfirmPwdInput ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                          <Button
                            onClick={async () => {
                              if (newPwd.length < 6) {
                                toast({ title: t("settings_password_error_short"), variant: "destructive" });
                                return;
                              }
                              if (newPwd !== confirmPwd) {
                                toast({ title: t("settings_password_error_match"), variant: "destructive" });
                                return;
                              }
                              setIsResettingPassword(true);
                              try {
                                const { error } = await supabase.auth.updateUser({ password: newPwd });
                                if (error) throw error;
                                toast({ title: t("settings_password_changed"), description: t("settings_password_changed_desc") });
                                setShowPasswordForm(false);
                                setNewPwd("");
                                setConfirmPwd("");
                              } catch {
                                toast({ title: t("settings_password_error_generic"), variant: "destructive" });
                              } finally {
                                setIsResettingPassword(false);
                              }
                            }}
                            disabled={isResettingPassword || !newPwd || !confirmPwd}
                            className="w-full rounded-full"
                            style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}
                          >
                            {isResettingPassword ? t("sending") : t("settings_save_password")}
                          </Button>
                        </div>
                      )}
                    </div>
                    {/* Biometric login */}
                    {biometricSupport.available && (
                      <div className="flex items-center justify-between p-4 rounded-2xl transition-colors" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                        <div className="flex items-start gap-3 flex-1 pr-3">
                          <ScanFace className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "rgba(255,255,255,.7)" }} />
                          <div>
                            <div className="text-sm font-medium" style={{ color: "#fff" }}>
                              {t("settings_biometric_label").replace("{biometric}", biometricSupport.label)}
                            </div>
                            <div className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                              {biometricEnabled
                                ? t("settings_biometric_desc_on")
                                : t("settings_biometric_desc_off").replace("{biometric}", biometricSupport.label)}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (biometricEnabled) {
                              await disableBiometric();
                              setBiometricEnabled(false);
                              toast({ title: t("settings_biometric_disabled_toast") });
                            } else {
                              toast({ title: t("settings_biometric_enable_hint_title"), description: t("settings_biometric_enable_hint_desc").replace("{biometric}", biometricSupport.label) });
                            }
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${biometricEnabled ? "bg-brand" : "bg-muted"}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${biometricEnabled ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </div>
                    )}
                    {/* Danger Zone */}
                    <div className="pt-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                      <h3 className="text-sm font-semibold" style={{ color: "#f87171" }}>{t("settings_danger_zone")}</h3>
                      <Button
                        onClick={() => { setIsAccountOpen(false); onRequestDeleteAccount(); }}
                        variant="destructive"
                        className="w-full rounded-full gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("settings_close_account")}
                      </Button>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,.4)" }}>{t("settings_close_account_hint")}</p>
                    </div>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            {/* ── Negócio ── */}
            {(commercialProfile) && (
              <p className="text-xs font-semibold uppercase tracking-wider pt-2 pb-0.5" style={{ color: "rgba(255,255,255,.5)" }}>{t("settings_section_business")}</p>
            )}

            {/* Commercial Profile Dashboard */}
            {commercialProfile && (
              <>
                <Button onClick={() => setIsCommercialDashboardOpen(true)} variant="outline" className="gap-2 justify-between">
                  <span>{t("settings_manage_commercial")}</span>
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Drawer open={isCommercialDashboardOpen} onOpenChange={setIsCommercialDashboardOpen}>
                  <DrawerContent
                    handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
                    className="flex flex-col modal-enter !rounded-t-[32px] !border-0"
                    style={{
                      maxHeight: `min(80dvh, ${viewportHeight - 8}px)`,
                      background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
                      backdropFilter: "blur(40px) saturate(180%)",
                      WebkitBackdropFilter: "blur(40px) saturate(180%)",
                      borderTop: "1px solid rgba(255,255,255,.14)",
                    }}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <DrawerHeader className="shrink-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {subDrawerBack(setIsCommercialDashboardOpen)}
                          <DrawerTitle style={{ color: "#fff" }}>🏪 {commercialProfile.business_name || t("settings_commercial_profile_fallback")}</DrawerTitle>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setIsCommercialDashboardOpen(false); setIsCommercialOpen(true); }}
                            className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            aria-label={t("settings_commercial_edit_label")}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(t("settings_commercial_delete_confirm"))) return;
                              try {
                                await deleteCommercialProfileDb(userId);
                                setCommercialProfile(null);
                                setIsCommercialDashboardOpen(false);
                                toast({ title: t("settings_commercial_deleted") });
                              } catch (err: any) {
                                toast({ title: t("settings_commercial_delete_error"), description: err?.message, variant: "destructive" });
                              }
                            }}
                            className="p-1.5 rounded-full hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                            aria-label={t("settings_commercial_delete_label")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </DrawerHeader>
                    <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-5">
                      {commercialProfile.business_segment && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2.5 py-1 rounded-full bg-brand/20 text-brand font-medium">
                            {commercialProfile.business_segment === "academia" && t("seg_academia")}
                            {commercialProfile.business_segment === "personal_trainer" && t("seg_personal_trainer")}
                            {commercialProfile.business_segment === "nutricionista" && t("seg_nutricionista")}
                            {commercialProfile.business_segment === "psicologo" && t("seg_psicologo")}
                            {commercialProfile.business_segment === "fisioterapeuta" && t("seg_fisioterapeuta")}
                            {commercialProfile.business_segment === "coach" && t("seg_coach")}
                            {commercialProfile.business_segment === "outros" && t("seg_outros")}
                          </span>
                        </div>
                      )}
                      {commercialProfile.business_logo_url && (
                        <div className="flex justify-center">
                          <img src={commercialProfile.business_logo_url} alt={t("settings_commercial_logo")} className="h-20 w-50 rounded-xl object-cover border border-border" />
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-2xl p-4 flex flex-col items-center gap-1" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                          <p className="text-2xl font-bold" style={{ color: "#fff" }}>{stats.followersCount}</p>
                          <p className="text-xs text-center" style={{ color: "rgba(255,255,255,.5)" }}>{t("profile_followers")}</p>
                        </div>
                        <div className="rounded-2xl p-4 flex flex-col items-center gap-1" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                          <p className="text-2xl font-bold" style={{ color: "#fff" }}>{stats.postsCount}</p>
                          <p className="text-xs text-center" style={{ color: "rgba(255,255,255,.5)" }}>{t("profile_posts")}</p>
                        </div>
                        <div className="rounded-2xl p-4 flex flex-col items-center gap-1" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                          <p className="text-2xl font-bold" style={{ color: "#fff" }}>{stats.followingCount}</p>
                          <p className="text-xs text-center" style={{ color: "rgba(255,255,255,.5)" }}>{t("profile_following")}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-2" style={{ color: "#fff" }}>{t("settings_commercial_engagement")}</p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                            <span className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>{t("settings_commercial_account_level")}</span>
                            <span className="text-sm font-medium">{t("ranking_level")} {stats.level}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                            <span className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>{t("settings_commercial_total_points")}</span>
                            <span className="text-sm font-medium">{stats.points} pts</span>
                          </div>
                        </div>
                      </div>
                      {(commercialProfile.business_phone || commercialProfile.business_email || commercialProfile.business_website) && (
                        <div>
                          <p className="text-sm font-semibold mb-2">{t("settings_commercial_contact")}</p>
                          <div className="space-y-2">
                            {commercialProfile.business_phone && (
                              <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                                <span className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>{t("settings_commercial_phone_label")}</span>
                                <span className="text-sm font-medium">{commercialProfile.business_phone}</span>
                              </div>
                            )}
                            {commercialProfile.business_email && (
                              <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                                <span className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>{t("settings_commercial_email_label")}</span>
                                <span className="text-sm font-medium">{commercialProfile.business_email}</span>
                              </div>
                            )}
                            {commercialProfile.business_website && (
                              <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                                <span className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>{t("settings_commercial_website_label")}</span>
                                <a href={commercialProfile.business_website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand hover:underline">
                                  {commercialProfile.business_website.replace(/^https?:\/\//, "")}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {commercialProfile.business_description && (
                        <div>
                          <p className="text-sm font-semibold mb-2">{t("settings_commercial_business_desc")}</p>
                          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,.5)" }}>{commercialProfile.business_description}</p>
                        </div>
                      )}
                    </div>
                  </DrawerContent>
                </Drawer>
              </>
            )}
            <Drawer open={isCommercialOpen} onOpenChange={setIsCommercialOpen}>
              {!commercialProfile && (
                <Button onClick={openCommercialProfile} variant="outline" className="gap-2 justify-between">
                  <span>{t("settings_commercial_profile")}</span>
                  <span className="text-lg">🏪</span>
                </Button>
              )}
              <DrawerContent
                handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
                className="flex flex-col modal-enter !rounded-t-[32px] !border-0"
                style={{
                  maxHeight: `min(80dvh, ${viewportHeight - 8}px)`,
                  background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
                  backdropFilter: "blur(40px) saturate(180%)",
                  WebkitBackdropFilter: "blur(40px) saturate(180%)",
                  borderTop: "1px solid rgba(255,255,255,.14)",
                }}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DrawerHeader className="shrink-0">
                  <div className="flex items-center gap-2">
                    {subDrawerBack(setIsCommercialOpen)}
                    <DrawerTitle style={{ color: "#fff" }}>{t("settings_commercial_title")}</DrawerTitle>
                  </div>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_commercial_segment")}</label>
                      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,.12)" }}>
                        {([
                          { value: "academia", labelKey: "seg_academia" },
                          { value: "personal_trainer", labelKey: "seg_personal_trainer" },
                          { value: "nutricionista", labelKey: "seg_nutricionista" },
                          { value: "psicologo", labelKey: "seg_psicologo" },
                          { value: "fisioterapeuta", labelKey: "seg_fisioterapeuta" },
                          { value: "coach", labelKey: "seg_coach" },
                          { value: "outros", labelKey: "seg_outros" },
                        ] as { value: string; labelKey: import("../../lib/i18n").TranslationKey }[]).map((seg, idx) => {
                          const selected = commercialFormData.business_segment === seg.value;
                          return (
                            <button
                              key={seg.value}
                              type="button"
                              onClick={() => setCommercialFormData({ ...commercialFormData, business_segment: seg.value })}
                              className="w-full text-left px-3 py-2.5 text-sm flex items-center justify-between gap-2 transition-colors active:scale-[0.99]"
                              style={{
                                background: selected ? "rgba(91,140,255,.18)" : "rgba(255,255,255,.05)",
                                color: selected ? "#fff" : "rgba(255,255,255,.7)",
                                borderTop: idx > 0 ? "1px solid rgba(255,255,255,.07)" : undefined,
                              }}
                            >
                              <span>{t(seg.labelKey)}</span>
                              {selected && (
                                <svg className="h-4 w-4 shrink-0 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_commercial_name")}</label>
                      <Input value={commercialFormData.business_name} onChange={(e) => setCommercialFormData({ ...commercialFormData, business_name: e.target.value })} placeholder="Ex: Academia Força Total" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_commercial_desc")}</label>
                      <Textarea value={commercialFormData.business_description} onChange={(e) => setCommercialFormData({ ...commercialFormData, business_description: e.target.value })} placeholder={t("settings_commercial_desc_placeholder")} className="min-h-24" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_commercial_phone")}</label>
                      <Input type="tel" value={commercialFormData.business_phone} onChange={(e) => setCommercialFormData({ ...commercialFormData, business_phone: formatPhone(e.target.value) })} placeholder="(11) 99999-9999" maxLength={15} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_commercial_email")}</label>
                      <Input type="email" value={commercialFormData.business_email} onChange={(e) => setCommercialFormData({ ...commercialFormData, business_email: e.target.value })} placeholder="contato@negocio.com" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_commercial_website")}</label>
                      <Input type="url" value={commercialFormData.business_website} onChange={(e) => setCommercialFormData({ ...commercialFormData, business_website: e.target.value })} placeholder="https://seu-site.com" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
                    </div>
                    {/* Logo */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_commercial_logo")}</label>
                      <div className="flex items-center gap-4">
                        {/* Preview */}
                        {commercialLogoPreview ? (
                          <button
                            type="button"
                            onClick={() => setLogoZoomOpen(true)}
                            className="relative h-20 w-20 rounded-2xl shrink-0 overflow-hidden active:scale-95 transition-transform group"
                            style={{ border: "1px solid rgba(255,255,255,.12)" }}
                            aria-label={t("settings_commercial_logo")}
                          >
                            <img src={commercialLogoPreview} alt="Logo" className="h-full w-full object-cover" />
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-active:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,.4)" }}>
                              <ZoomIn className="h-5 w-5 text-white" />
                            </div>
                          </button>
                        ) : (
                          <div className="h-20 w-20 rounded-2xl shrink-0 flex flex-col items-center justify-center gap-1" style={{ border: "1px dashed rgba(255,255,255,.2)", background: "rgba(255,255,255,.05)" }}>
                            <Upload className="h-5 w-5" style={{ color: "rgba(255,255,255,.3)" }} />
                          </div>
                        )}

                        {/* Logo zoom overlay — renderizado inline para evitar conflito com portal do Drawer */}
                        {logoZoomOpen && commercialLogoPreview && (
                          <div
                            className="fixed inset-0 z-[300] flex items-center justify-center"
                            style={{ background: "rgba(0,0,0,.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
                            onClick={() => setLogoZoomOpen(false)}
                          >
                            <button
                              type="button"
                              onClick={() => setLogoZoomOpen(false)}
                              className="absolute top-4 right-4 flex items-center justify-center rounded-full"
                              style={{ width: 40, height: 40, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)", color: "#fff" }}
                              aria-label="Fechar"
                            >
                              <X className="h-5 w-5" />
                            </button>
                            <img
                              src={commercialLogoPreview}
                              alt="Logo"
                              className="max-w-[85vw] max-h-[75vh] rounded-2xl object-contain"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col gap-2 flex-1">
                          <label className="cursor-pointer">
                            <div
                              className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors active:scale-[0.98]"
                              style={{ background: "rgba(91,140,255,.15)", border: "1px solid rgba(91,140,255,.3)", color: "#7eaaff" }}
                            >
                              <Upload className="h-4 w-4" />
                              {commercialLogoPreview ? t("settings_commercial_logo_change") : t("settings_commercial_logo_add")}
                            </div>
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (!file) return;
                              pendingLogoFileRef.current = file;
                              setPendingLogoCropSrc(URL.createObjectURL(file));
                            }} />
                          </label>
                          {commercialLogoPreview && (
                            <button
                              type="button"
                              onClick={() => { setCommercialLogoFile(null); setCommercialLogoPreview(null); }}
                              className="flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors active:scale-[0.98]"
                              style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", color: "#f87171" }}
                            >
                              <Trash2 className="h-4 w-4" />
                              {t("remove")}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Service Plans */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_commercial_plans")}</label>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{servicePlans.length}/5</span>
                      </div>
                      {servicePlans.length > 0 && (
                        <div className="space-y-2">
                          {servicePlans.map((plan, idx) => (
                            editingPlanIdx === idx ? (
                              <div key={idx} className="space-y-2 rounded-lg p-3" style={{ border: "1px solid rgba(91,140,255,.4)", background: "rgba(91,140,255,.08)" }}>
                                <p className="text-xs font-medium text-brand">{t("settings_commercial_new_plan")}</p>
                                <input className="w-full rounded-md px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-brand" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} placeholder={t("settings_commercial_plan_name")} value={editPlanName} onChange={(e) => setEditPlanName(e.target.value)} maxLength={60} />
                                <input type="number" min="0" step="0.01" className="w-full rounded-md px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-brand" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} placeholder={t("settings_commercial_plan_price")} value={editPlanPrice} onChange={(e) => setEditPlanPrice(e.target.value)} />
                                <input className="w-full rounded-md px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-brand" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} placeholder={t("settings_commercial_plan_desc")} value={editPlanDescription} onChange={(e) => setEditPlanDescription(e.target.value)} maxLength={100} />
                                <div className="flex gap-2">
                                  <button type="button" disabled={!editPlanName.trim()} onClick={() => {
                                    if (!editPlanName.trim()) return;
                                    setServicePlans((prev) => prev.map((p, i) => i === idx ? { name: editPlanName.trim(), price: editPlanPrice ? parseFloat(editPlanPrice) : null, description: editPlanDescription.trim() || undefined } : p));
                                    setEditingPlanIdx(null); setEditPlanName(""); setEditPlanPrice(""); setEditPlanDescription("");
                                  }} className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-brand text-white text-sm font-medium py-2 hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    {t("settings_commercial_plan_confirm")}
                                  </button>
                                  <button type="button" onClick={() => { setEditingPlanIdx(null); setEditPlanName(""); setEditPlanPrice(""); setEditPlanDescription(""); }} className="px-3 rounded-md text-sm transition-colors" style={{ border: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.7)" }}>{t("cancel")}</button>
                                </div>
                              </div>
                            ) : (
                              <div key={idx} className="flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.06)" }}>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate" style={{ color: "#fff" }}>{plan.name}</p>
                                  {plan.price != null && <p className="text-xs text-brand font-semibold">R$ {plan.price.toFixed(2).replace(".", ",")}</p>}
                                  {plan.description && <p className="text-xs line-clamp-2 mt-0.5" style={{ color: "rgba(255,255,255,.5)" }}>{plan.description}</p>}
                                </div>
                                <button type="button" onClick={() => { setEditingPlanIdx(idx); setEditPlanName(plan.name); setEditPlanPrice(plan.price != null ? String(plan.price) : ""); setEditPlanDescription(plan.description ?? ""); setIsAddingPlan(false); }} className="p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground flex-shrink-0 mt-0.5" aria-label="Editar plano">
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button type="button" onClick={() => setServicePlans((prev) => prev.filter((_, i) => i !== idx))} className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 mt-0.5" aria-label={t("settings_plan_remove_label")}>
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>
                            )
                          ))}
                        </div>
                      )}
                      {servicePlans.length < 5 && (
                        isAddingPlan ? (
                          <div className="space-y-2 rounded-lg p-3" style={{ border: "1px solid rgba(91,140,255,.4)", background: "rgba(91,140,255,.08)" }}>
                            <p className="text-xs font-medium text-brand">{t("settings_commercial_new_plan")}</p>
                            <input className="w-full rounded-md px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-brand" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} placeholder={t("settings_commercial_plan_name")} value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} maxLength={60} />
                            <input type="number" min="0" step="0.01" className="w-full rounded-md px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-brand" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} placeholder={t("settings_commercial_plan_price")} value={newPlanPrice} onChange={(e) => setNewPlanPrice(e.target.value)} />
                            <input className="w-full rounded-md px-3 py-2 text-base md:text-sm focus:outline-none focus:ring-1 focus:ring-brand" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} placeholder={t("settings_commercial_plan_desc")} value={newPlanDescription} onChange={(e) => setNewPlanDescription(e.target.value)} maxLength={100} />
                            <div className="flex gap-2">
                              <button type="button" disabled={!newPlanName.trim()} onClick={() => {
                                if (!newPlanName.trim()) return;
                                setServicePlans((prev) => [...prev, { name: newPlanName.trim(), price: newPlanPrice ? parseFloat(newPlanPrice) : null, description: newPlanDescription.trim() || undefined }]);
                                setNewPlanName(""); setNewPlanPrice(""); setNewPlanDescription(""); setIsAddingPlan(false);
                              }} className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-brand text-white text-sm font-medium py-2 hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                {t("settings_commercial_plan_confirm")}
                              </button>
                              <button type="button" onClick={() => { setIsAddingPlan(false); setNewPlanName(""); setNewPlanPrice(""); setNewPlanDescription(""); }} className="px-3 rounded-md text-sm transition-colors" style={{ border: "1px solid rgba(255,255,255,.12)", color: "rgba(255,255,255,.7)" }}>{t("cancel")}</button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => { setIsAddingPlan(true); setEditingPlanIdx(null); setEditPlanName(""); setEditPlanPrice(""); setEditPlanDescription(""); }} className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm transition-colors" style={{ border: "1px dashed rgba(255,255,255,.2)", color: "rgba(255,255,255,.5)" }}>
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            {t("settings_commercial_add_plan")}
                          </button>
                        )
                      )}
                      {servicePlans.length >= 5 && <p className="text-xs text-center" style={{ color: "rgba(255,255,255,.5)" }}>{t("settings_commercial_plan_limit")}</p>}
                    </div>
                    <Button onClick={handleSaveCommercial} disabled={isSavingCommercial || !commercialFormData.business_name} className="w-full rounded-full" style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}>
                      {isSavingCommercial ? t("saving") : t("settings_commercial_save")}
                    </Button>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            {/* ── Preferências ── */}
            <p className="text-xs font-semibold uppercase tracking-wider pt-2 pb-0.5" style={{ color: "rgba(255,255,255,.5)" }}>{t("settings_section_preferences")}</p>

            {/* Language */}
            <Drawer open={isLanguageOpen} onOpenChange={setIsLanguageOpen}>
              <Button onClick={() => setIsLanguageOpen(true)} variant="outline" className="gap-2 justify-between">
                <span>{t("settings_language")}</span>
                <Globe className="h-4 w-4" />
              </Button>
              <DrawerContent
                handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
                className="flex flex-col modal-enter !rounded-t-[32px] !border-0"
                style={{
                  maxHeight: `min(80dvh, ${viewportHeight - 8}px)`,
                  background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
                  backdropFilter: "blur(40px) saturate(180%)",
                  WebkitBackdropFilter: "blur(40px) saturate(180%)",
                  borderTop: "1px solid rgba(255,255,255,.14)",
                }}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DrawerHeader className="shrink-0">
                  <div className="flex items-center gap-2">
                    {subDrawerBack(setIsLanguageOpen)}
                    <DrawerTitle style={{ color: "#fff" }}>{t("settings_language_select")}</DrawerTitle>
                  </div>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-2">
                    {(["pt", "en"] as const).map((lang) => (
                      <button key={lang} onClick={() => { setLanguage(lang); setIsLanguageOpen(false); }} className="w-full p-4 rounded-2xl text-left transition-all active:scale-[0.99]" style={language === lang ? { border: "1px solid #5b8cff", background: "rgba(91,140,255,.1)" } : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}>
                        <div className="font-medium" style={{ color: "#fff" }}>{lang === "pt" ? "Português (Brasil)" : "English"}</div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{lang === "pt" ? "pt-BR" : "en-US"}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            {/* Notifications */}
            <Drawer open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
              <Button onClick={() => setIsNotificationsOpen(true)} variant="outline" className="gap-2 justify-between">
                <span>{t("settings_notifications")}</span>
                <Bell className="h-4 w-4" />
              </Button>
              <DrawerContent
                handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
                className="flex flex-col modal-enter !rounded-t-[32px] !border-0"
                style={{
                  maxHeight: `min(80dvh, ${viewportHeight - 8}px)`,
                  background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
                  backdropFilter: "blur(40px) saturate(180%)",
                  WebkitBackdropFilter: "blur(40px) saturate(180%)",
                  borderTop: "1px solid rgba(255,255,255,.14)",
                }}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DrawerHeader className="shrink-0">
                  <div className="flex items-center gap-2">
                    {subDrawerBack(setIsNotificationsOpen)}
                    <DrawerTitle style={{ color: "#fff" }}>{t("settings_notif_configure")}</DrawerTitle>
                  </div>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-3">
                    {([
                      { notifKey: "workoutReminders", labelKey: "settings_notif_workout", descKey: "settings_notif_workout_desc" },
                      { notifKey: "achievementAlerts", labelKey: "settings_notif_achievements", descKey: "settings_notif_achievements_desc" },
                      { notifKey: "friendActivity", labelKey: "settings_notif_friends", descKey: "settings_notif_friends_desc" },
                      { notifKey: "messages", labelKey: "settings_notif_messages", descKey: "settings_notif_messages_desc" },
                    ] as { notifKey: keyof typeof notifications; labelKey: import("../../lib/i18n").TranslationKey; descKey: import("../../lib/i18n").TranslationKey }[]).map(({ notifKey, labelKey, descKey }) => (
                      <div key={notifKey} className="flex items-center justify-between p-4 rounded-2xl transition-colors" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                        <div>
                          <div className="text-sm font-medium" style={{ color: "#fff" }}>{t(labelKey)}</div>
                          <div className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t(descKey)}</div>
                        </div>
                        <button onClick={() => handleToggleNotification(notifKey)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifications[notifKey] ? "bg-brand" : "bg-muted"}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifications[notifKey] ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </div>
                    ))}
                    <div className="pt-4 mt-4" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                      <div className="flex items-center justify-between p-3 rounded-lg transition-colors" style={{ border: "1px solid rgba(255,255,255,.1)" }}>
                        <div>
                          <div className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_notif_sounds")}</div>
                          <div className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t("settings_notif_sounds_desc")}</div>
                        </div>
                        <button onClick={() => handleToggleNotification("sound")} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifications.sound ? "bg-brand" : "bg-muted"}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifications.sound ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            {/* Privacy */}
            <Drawer open={isPrivacyOpen} onOpenChange={setIsPrivacyOpen}>
              <Button onClick={() => setIsPrivacyOpen(true)} variant="outline" className="gap-2 justify-between">
                <span>{t("settings_privacy")}</span>
                <Lock className="h-4 w-4" />
              </Button>
              <DrawerContent
                handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
                className="flex flex-col modal-enter !rounded-t-[32px] !border-0"
                style={{
                  maxHeight: `min(80dvh, ${viewportHeight - 8}px)`,
                  background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
                  backdropFilter: "blur(40px) saturate(180%)",
                  WebkitBackdropFilter: "blur(40px) saturate(180%)",
                  borderTop: "1px solid rgba(255,255,255,.14)",
                }}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DrawerHeader className="shrink-0">
                  <div className="flex items-center gap-2">
                    {subDrawerBack(setIsPrivacyOpen)}
                    <DrawerTitle style={{ color: "#fff" }}>{t("settings_privacy")}</DrawerTitle>
                  </div>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-2xl transition-colors" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                      <div className="flex-1 pr-3">
                        <div className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_privacy_hide_follows_label")}</div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t("settings_privacy_hide_follows_desc")}</div>
                      </div>
                      <button
                        disabled={isSavingPrivacy}
                        onClick={() => handleSavePrivacy({ hideFollowLists: !hideFollowLists })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${hideFollowLists ? "bg-brand" : "bg-muted"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hideFollowLists ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-2xl transition-colors" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                      <div className="flex-1 pr-3">
                        <div className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_privacy_hide_posts_label")}</div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>{t("settings_privacy_hide_posts_desc")}</div>
                      </div>
                      <button
                        disabled={isSavingPrivacy}
                        onClick={() => handleSavePrivacy({ hidePostsFromNonFollowers: !hidePostsFromNonFollowers })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${hidePostsFromNonFollowers ? "bg-brand" : "bg-muted"}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hidePostsFromNonFollowers ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            {/* Time Management */}
            <Drawer open={isTimeManagementOpen} onOpenChange={setIsTimeManagementOpen}>
              <Button onClick={() => setIsTimeManagementOpen(true)} variant="outline" className="gap-2 justify-between">
                <span>{t("settings_time_management")}</span>
                <BarChart3 className="h-4 w-4" />
              </Button>
              <DrawerContent
                handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
                className="flex flex-col modal-enter !rounded-t-[32px] !border-0"
                style={{
                  maxHeight: `min(80dvh, ${viewportHeight - 8}px)`,
                  background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
                  backdropFilter: "blur(40px) saturate(180%)",
                  WebkitBackdropFilter: "blur(40px) saturate(180%)",
                  borderTop: "1px solid rgba(255,255,255,.14)",
                }}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DrawerHeader className="shrink-0">
                  <div className="flex items-center gap-2">
                    {subDrawerBack(setIsTimeManagementOpen)}
                    <DrawerTitle style={{ color: "#fff" }}>{t("settings_time_management")}</DrawerTitle>
                  </div>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" style={{ color: "#fff" }}>{t("settings_time_limit_label")}</label>
                      <div className="flex gap-2">
                        <Input type="number" min="0" value={dailyUsageLimit} onChange={(e) => setDailyUsageLimit(parseInt(e.target.value) || 0)} placeholder={t("settings_time_limit_placeholder")} className="flex-1" style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", color: "#fff" }} />
                        <span className="text-sm py-2" style={{ color: "rgba(255,255,255,.5)" }}>min</span>
                      </div>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,.4)" }}>{dailyUsageLimit === 0 ? t("settings_time_no_limit") : t("settings_time_limit_active").replace("{n}", String(dailyUsageLimit))}</p>
                    </div>
                    <Button onClick={() => {
                      if (dailyUsageLimit > 0) {
                        localStorage.setItem("ritmofit_daily_limit_minutes", String(dailyUsageLimit));
                        localStorage.setItem("ritmofit_daily_limit_date", new Date().toDateString());
                      } else {
                        localStorage.removeItem("ritmofit_daily_limit_minutes");
                        localStorage.removeItem("ritmofit_daily_limit_date");
                      }
                      // Avisa o AppLayout na hora — substitui o antigo polling de 5s.
                      window.dispatchEvent(new Event("lk:daily-limit-changed"));
                      toast({ title: t("settings_time_saved"), description: dailyUsageLimit > 0 ? t("settings_time_limit_set").replace("{n}", String(dailyUsageLimit)) : t("settings_time_limit_removed") });
                      setIsTimeManagementOpen(false);
                    }} className="w-full rounded-full" style={{ background: "linear-gradient(135deg,#5b8cff,#9d6bff)", color: "#fff" }}>
                      {t("settings_time_save")}
                    </Button>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            {/* ── Outros ── */}
            <p className="text-xs font-semibold uppercase tracking-wider pt-2 pb-0.5" style={{ color: "rgba(255,255,255,.5)" }}>{t("settings_section_other")}</p>

            {/* Flow History */}
            <Drawer open={isFlowHistoryOpen} onOpenChange={setIsFlowHistoryOpen}>
              <Button onClick={openFlowHistory} variant="outline" className="gap-2 justify-between">
                <span>{t("settings_flow_archive")}</span>
                <span>🕐</span>
              </Button>
              <DrawerContent
                handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
                className="flex flex-col modal-enter !rounded-t-[32px] !border-0"
                style={{
                  maxHeight: `min(80dvh, ${viewportHeight - 8}px)`,
                  background: "linear-gradient(rgba(30,28,40,.88),rgba(14,13,20,.96))",
                  backdropFilter: "blur(40px) saturate(180%)",
                  WebkitBackdropFilter: "blur(40px) saturate(180%)",
                  borderTop: "1px solid rgba(255,255,255,.14)",
                }}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <DrawerHeader className="shrink-0">
                  <div className="flex items-center gap-2">
                    {subDrawerBack(setIsFlowHistoryOpen)}
                    <DrawerTitle style={{ color: "#fff" }}>{t("settings_flow_archive")}</DrawerTitle>
                  </div>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  {isLoadingFlowHistory ? (
                    <div className="flex justify-center py-8"><LoadingSpinner /></div>
                  ) : expiredFlows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                      <span className="text-4xl">📂</span>
                      <p className="text-sm" style={{ color: "rgba(255,255,255,.5)" }}>{t("settings_flow_empty")}</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,.4)" }}>{t("settings_flow_empty_desc")}</p>
                    </div>
                  ) : (
                    <>
                      {/* Expanded flow viewer — story-style fullscreen.
                          Portal para document.body: o vaul aplica transform no
                          DrawerContent durante o swipe, o que vira containing
                          block de qualquer position:fixed descendente — sem o
                          portal, esse "fullscreen" ficava confinado à altura do
                          drawer (maxHeight 80dvh) e sobrava scroll indevido. */}
                      {expandedFlow && createPortal(
                        <div className="fixed inset-0 z-[9999] bg-black">
                          {/* Media — fullscreen */}
                          {expandedFlow.media_url?.match(/\.(mp4|mov|webm)/) ? (
                            <video
                              src={expandedFlow.media_url}
                              className="absolute inset-0 w-full h-full object-contain"
                              controls
                              playsInline
                              autoPlay
                            />
                          ) : expandedFlow.media_url ? (
                            <img
                              src={expandedFlow.media_url}
                              alt="flow"
                              className="absolute inset-0 w-full h-full object-contain"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-7xl">🌊</span>
                            </div>
                          )}

                          {/* Top scrim + controls */}
                          <div
                            className="absolute top-0 left-0 right-0 flex items-start justify-between px-4 pt-3 pb-16"
                            style={{
                              paddingTop: "max(12px, env(safe-area-inset-top))",
                              background: "linear-gradient(to bottom, rgba(0,0,0,.6) 0%, transparent 100%)",
                            }}
                          >
                            {/* Close */}
                            <button
                              onClick={() => setExpandedFlow(null)}
                              className="flex items-center justify-center rounded-full active:scale-95 transition-transform"
                              style={{ width: 38, height: 38, background: "rgba(0,0,0,.45)", border: "1px solid rgba(255,255,255,.18)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
                              aria-label="Fechar"
                            >
                              <X className="h-4.5 w-4.5 text-white" />
                            </button>

                            {/* Date */}
                            <p className="text-sm font-semibold text-white/90 self-center" style={{ textShadow: "0 1px 4px rgba(0,0,0,.6)" }}>
                              {new Date(expandedFlow.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                            </p>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => setFlowToShare(expandedFlow)}
                                disabled={repostingFlowId === expandedFlow.id}
                                className="flex items-center justify-center rounded-full active:scale-95 transition-transform disabled:opacity-40"
                                style={{ width: 38, height: 38, background: "rgba(91,140,255,.85)", border: "1px solid rgba(255,255,255,.2)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
                                title={t("settings_flow_share_title")}
                                aria-label={t("settings_flow_share_title")}
                              >
                                <Share2 className="h-4 w-4 text-white" />
                              </button>
                              <button
                                onClick={() => setFlowToDelete(expandedFlow)}
                                disabled={deletingFlowId === expandedFlow.id}
                                className="flex items-center justify-center rounded-full active:scale-95 transition-transform disabled:opacity-40"
                                style={{ width: 38, height: 38, background: "rgba(239,68,68,.85)", border: "1px solid rgba(255,255,255,.2)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
                                title={t("settings_flow_delete_title")}
                                aria-label={t("settings_flow_delete_title")}
                              >
                                <Trash2 className="h-4 w-4 text-white" />
                              </button>
                            </div>
                          </div>

                          {/* Bottom scrim + caption */}
                          {expandedFlow.description && (
                            <div
                              className="absolute bottom-0 left-0 right-0 px-5 pt-12 pb-6"
                              style={{
                                paddingBottom: "max(24px, env(safe-area-inset-bottom))",
                                background: "linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 100%)",
                              }}
                            >
                              <p className="text-sm text-white/90 text-center leading-relaxed" style={{ textShadow: "0 1px 4px rgba(0,0,0,.5)" }}>
                                {expandedFlow.description}
                              </p>
                            </div>
                          )}
                        </div>,
                        document.body,
                      )}

                      <div className="grid grid-cols-3 gap-1">
                        {expiredFlows.map((flow) => (
                          <div key={flow.id} className="relative aspect-[9/16] rounded-lg overflow-hidden group" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)" }}>
                            <button
                              className="absolute inset-0 w-full h-full"
                              onClick={() => setExpandedFlow(flow)}
                              aria-label="Ver flow"
                            >
                              {flow.media_url ? (
                                flow.media_url.match(/\.(mp4|mov|webm)/) ? (
                                  <video src={flow.media_url} className="w-full h-full object-cover" muted playsInline />
                                ) : (
                                  <img src={flow.media_url} alt="flow" className="w-full h-full object-cover" />
                                )
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-muted/50"><span className="text-2xl">🌊</span></div>
                              )}
                            </button>

                            {/* Expand hint */}
                            <div className="absolute top-1.5 right-1.5 opacity-0 group-active:opacity-100 transition-opacity pointer-events-none">
                              <div className="bg-black/50 rounded-full p-1">
                                <ZoomIn className="h-3 w-3 text-white" />
                              </div>
                            </div>

                            {/* Bottom bar with date + actions */}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 flex items-end justify-between gap-1">
                              <p className="text-[10px] text-white/80 truncate flex-1">
                                {new Date(flow.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                              </p>
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setFlowToShare(flow); }}
                                  disabled={repostingFlowId === flow.id}
                                  className="p-1 rounded-full bg-brand/70 hover:bg-brand transition-colors disabled:opacity-40"
                                  title={t("settings_flow_share_title")}
                                  aria-label={t("settings_flow_share_title")}
                                >
                                  <Share2 className="h-2.5 w-2.5 text-white" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setFlowToDelete(flow); }}
                                  disabled={deletingFlowId === flow.id}
                                  className="p-1 rounded-full bg-red-500/70 hover:bg-red-500 transition-colors disabled:opacity-40"
                                  title={t("settings_flow_delete_title")}
                                  aria-label={t("settings_flow_delete_title")}
                                >
                                  <Trash2 className="h-2.5 w-2.5 text-white" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Confirmação de exclusão — portal para document.body (mesmo motivo do viewer fullscreen acima) */}
                      {flowToDelete && createPortal(
                        <div
                          className="fixed inset-0 z-[10000] flex items-center justify-center pointer-events-none"
                          style={{
                            paddingTop: "max(1rem, env(safe-area-inset-top))",
                            paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
                            paddingLeft: "max(1rem, env(safe-area-inset-left))",
                            paddingRight: "max(1rem, env(safe-area-inset-right))",
                            background: "rgba(0,0,0,.6)",
                          }}
                        >
                          <div
                            className="pointer-events-auto w-full max-w-[320px] rounded-2xl p-5"
                            style={{
                              background: "linear-gradient(rgba(30,28,40,.96),rgba(14,13,20,.98))",
                              border: "1px solid rgba(255,255,255,.14)",
                              backdropFilter: "blur(20px) saturate(160%)",
                              WebkitBackdropFilter: "blur(20px) saturate(160%)",
                            }}
                          >
                            <p className="text-base font-semibold text-white mb-1.5">
                              {t("settings_flow_delete_title")}
                            </p>
                            <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,.6)" }}>
                              {t("settings_flow_delete_desc")}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setFlowToDelete(null)}
                                disabled={deletingFlowId === flowToDelete.id}
                              >
                                {t("cancel")}
                              </Button>
                              <Button
                                variant="destructive"
                                className="flex-1"
                                onClick={confirmDeleteFlow}
                                disabled={deletingFlowId === flowToDelete.id}
                              >
                                {t("delete")}
                              </Button>
                            </div>
                          </div>
                        </div>,
                        document.body,
                      )}

                      {/* Escolha de destino do compartilhamento — portal para document.body (mesmo motivo do viewer fullscreen acima) */}
                      {flowToShare && createPortal(
                        <div
                          className="fixed inset-0 z-[10000] flex items-end justify-center pointer-events-none"
                          style={{ background: "rgba(0,0,0,.6)" }}
                        >
                          <div
                            className="pointer-events-auto w-full max-w-[480px] rounded-t-[28px] p-4"
                            style={{
                              background: "linear-gradient(rgba(30,28,40,.96),rgba(14,13,20,.98))",
                              border: "1px solid rgba(255,255,255,.14)",
                              borderBottom: "none",
                              backdropFilter: "blur(20px) saturate(160%)",
                              WebkitBackdropFilter: "blur(20px) saturate(160%)",
                              paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
                              paddingLeft: "max(1rem, env(safe-area-inset-left))",
                              paddingRight: "max(1rem, env(safe-area-inset-right))",
                            }}
                          >
                            <div className="mx-auto mb-3 h-1 w-9 rounded-full" style={{ background: "rgba(255,255,255,.25)" }} />
                            <p className="text-sm font-semibold px-1 mb-2" style={{ color: "rgba(255,255,255,.5)" }}>
                              {t("settings_flow_share_title")}
                            </p>

                            <button
                              onClick={() => handleRepostToNewFlow(flowToShare)}
                              disabled={repostingFlowId === flowToShare.id}
                              className="w-full flex items-center gap-3 rounded-xl px-3 py-3 active:scale-[0.98] transition-transform disabled:opacity-40"
                              style={{ background: "rgba(255,255,255,.06)" }}
                            >
                              <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 36, height: 36, background: "rgba(91,140,255,.2)" }}>
                                <Repeat className="h-4 w-4" style={{ color: "#6ea8ff" }} />
                              </div>
                              <span className="text-sm text-white font-medium">{t("settings_flow_reshare_to_flow")}</span>
                            </button>

                            <button
                              onClick={() => handleRepostFlow(flowToShare)}
                              disabled={repostingFlowId === flowToShare.id}
                              className="w-full flex items-center gap-3 rounded-xl px-3 py-3 mt-1.5 active:scale-[0.98] transition-transform disabled:opacity-40"
                              style={{ background: "rgba(255,255,255,.06)" }}
                            >
                              <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 36, height: 36, background: "rgba(91,140,255,.2)" }}>
                                <Share2 className="h-4 w-4" style={{ color: "#6ea8ff" }} />
                              </div>
                              <span className="text-sm text-white font-medium">
                                {/\.(mp4|mov|webm)/i.test(flowToShare.media_url || "") ? t("settings_flow_share_to_shots") : t("settings_flow_share_to_feed")}
                              </span>
                            </button>

                            <Button
                              variant="outline"
                              className="w-full mt-3"
                              onClick={() => setFlowToShare(null)}
                            >
                              {t("cancel")}
                            </Button>
                          </div>
                        </div>,
                        document.body,
                      )}
                    </>
                  )}
                </div>
              </DrawerContent>
            </Drawer>

            {/* Logout */}
            <Button onClick={handleLogout} variant="destructive" className="gap-2">
              <LogOut className="h-4 w-4" />
              {t("settings_logout")}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Cropper — profile photo */}
      <ImageCropperDrawer
        imageSrc={pendingPhotoCropSrc}
        aspectRatio={1}
        onConfirm={(dataUrl, blob) => {
          if (pendingPhotoCropSrc) URL.revokeObjectURL(pendingPhotoCropSrc);
          const original = pendingPhotoFileRef.current;
          const croppedFile = new File([blob], original?.name ?? "photo.jpg", { type: "image/jpeg" });
          setEditPhotoFile(croppedFile);
          setEditPhotoPreview(dataUrl);
          setPendingPhotoCropSrc(null);
        }}
        onCancel={() => {
          if (pendingPhotoCropSrc) URL.revokeObjectURL(pendingPhotoCropSrc);
          setPendingPhotoCropSrc(null);
        }}
      />

      {/* Cropper — commercial logo */}
      <ImageCropperDrawer
        imageSrc={pendingLogoCropSrc}
        aspectRatio={1}
        onConfirm={(dataUrl, blob) => {
          if (pendingLogoCropSrc) URL.revokeObjectURL(pendingLogoCropSrc);
          const original = pendingLogoFileRef.current;
          const croppedFile = new File([blob], original?.name ?? "logo.jpg", { type: "image/jpeg" });
          setCommercialLogoFile(croppedFile);
          setCommercialLogoPreview(dataUrl);
          setPendingLogoCropSrc(null);
        }}
        onCancel={() => {
          if (pendingLogoCropSrc) URL.revokeObjectURL(pendingLogoCropSrc);
          setPendingLogoCropSrc(null);
        }}
      />
    </>
  );
}
