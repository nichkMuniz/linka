import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  updateUserPersonalDataDb,
  type UserProfile,
  type UserStats,
  type CommercialProfile,
  type ServicePlan,
  type StoryWithUser,
} from "@/lib/ritmofit-db";
import { supabase, resetSupabaseAuth } from "@/lib/supabase";
import { useLayoutMode } from "@/hooks/useLayoutMode";
import { useLanguage } from "@/lib/language-context";
import {
  Edit2,
  Upload,
  ArrowLeft,
  Settings,
  LogOut,
  Moon,
  Sun,
  Trash2,
  Bell,
  Globe,
  BarChart3,
  ChevronDown,
  User,
  X,
} from "lucide-react";

interface SettingsDrawerProps {
  profile: UserProfile;
  /** Auth UUID do usuário (user.id do Supabase Auth — diferente de userId) */
  userId: string;
  userEmail: string;
  stats: UserStats;
  onProfileUpdated: (updated: UserProfile) => void;
  onRequestDeleteAccount: () => void;
}

export function SettingsDrawer({
  profile,
  userId,
  userEmail,
  onProfileUpdated,
  stats,
  onRequestDeleteAccount,
}: SettingsDrawerProps) {
  const navigate = useNavigate();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme ?? theme) === "dark";
  const { layoutMode, toggleLayoutMode } = useLayoutMode();
  const { language, setLanguage, t } = useLanguage();

  const [isOpen, setIsOpen] = React.useState(false);

  // --- My Profile (unified drawer with tabs) ---
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [profileTab, setProfileTab] = React.useState<"public" | "personal">("public");

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
    const reader = new FileReader();
    reader.onload = (ev) => setPendingPhotoCropSrc(ev.target?.result as string);
    reader.readAsDataURL(file);
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
  const [notifications, setNotifications] = React.useState({
    workoutReminders: true,
    achievementAlerts: true,
    friendActivity: true,
    messages: true,
    sound: true,
  });

  // --- Time Management ---
  const [isTimeManagementOpen, setIsTimeManagementOpen] = React.useState(false);
  const [dailyUsageLimit, setDailyUsageLimit] = React.useState(() => {
    const stored = localStorage.getItem("ritmofit_daily_limit_minutes");
    return stored ? parseInt(stored, 10) : 0;
  });

  // --- Personalization ---
  const [isPersonalizationOpen, setIsPersonalizationOpen] = React.useState(false);

  // --- Flow History ---
  const [isFlowHistoryOpen, setIsFlowHistoryOpen] = React.useState(false);
  const [expiredFlows, setExpiredFlows] = React.useState<StoryWithUser[]>([]);
  const [isLoadingFlowHistory, setIsLoadingFlowHistory] = React.useState(false);

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

  // --- Personal Data ---
  const [personalDataForm, setPersonalDataForm] = React.useState({
    gender: profile.gender ?? "",
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
      await resetSupabaseAuth();
      setIsOpen(false);
      navigate("/");
      toast({ title: t("settings_toast_logout_success") });
    } catch (err: any) {
      toast({ title: t("settings_toast_logout_error"), description: err?.message || t("retry"), variant: "destructive" });
    }
  };

  const subDrawerBack = (setter: (v: boolean) => void) => (
    <button onClick={() => setter(false)} className="p-1 rounded-full hover:bg-muted transition-colors">
      <ArrowLeft className="h-5 w-5" />
    </button>
  );

  return (
    <>
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <Button
          onClick={() => setIsOpen(true)}
          variant="outline"
          size="sm"
          className="shrink-0 rounded-full"
        >
          <Settings className="h-4 w-4" />
        </Button>

        <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DrawerHeader className="shrink-0">
            <DrawerTitle>{t("settings_title")}</DrawerTitle>
          </DrawerHeader>

          <div className="flex flex-col flex-1 gap-2 overflow-y-auto px-4 pb-4">

            {/* ── Perfil ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-1 pb-0.5">{t("settings_section_profile")}</p>

            {/* My Profile (unified) */}
            <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
              <Button onClick={() => openEditProfile("public")} variant="outline" className="gap-2 justify-between">
                <span>{t("settings_my_profile")}</span>
                <User className="h-4 w-4" />
              </Button>
              <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DrawerHeader className="shrink-0 flex items-center gap-2">
                  {subDrawerBack(setIsEditOpen)}
                  <DrawerTitle>Meu Perfil</DrawerTitle>
                </DrawerHeader>

                {/* Tabs */}
                <div className="shrink-0 px-4 pb-2">
                  <div className="flex rounded-lg bg-muted p-1 gap-1">
                    <button
                      onClick={() => setProfileTab("public")}
                      className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${profileTab === "public" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      Público
                    </button>
                    <button
                      onClick={() => setProfileTab("personal")}
                      className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${profileTab === "personal" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
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
                        <label className="text-sm font-medium">Foto do Perfil</label>
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
                        <label className="text-sm font-medium">{t("settings_name_label")}</label>
                        <Input value={editNickname} onChange={(e) => setEditNickname(e.target.value)} placeholder={t("settings_name_placeholder")} />
                      </div>
                      {/* Bio */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("profile_bio")}</label>
                        <Textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder={t("settings_bio_placeholder")} className="min-h-24" />
                      </div>
                      {/* Handle */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("settings_handle_label")}</label>
                        <div className="flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-0 overflow-hidden">
                          <span className="px-3 py-2 text-sm text-muted-foreground bg-muted border-r border-input select-none">@</span>
                          <Input
                            value={editHandle}
                            onChange={(e) => setEditHandle(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ""))}
                            placeholder="seu_usuario"
                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{t("settings_handle_hint")}</p>
                      </div>
                      <Button onClick={handleSaveProfile} disabled={isSaving} className="w-full rounded-full">
                        {isSaving ? t("saving") : t("settings_save_changes")}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("settings_gender_label")}</label>
                        <Select value={personalDataForm.gender} onValueChange={(v) => setPersonalDataForm((prev) => ({ ...prev, gender: v }))}>
                          <SelectTrigger><SelectValue placeholder={t("settings_gender_select")} /></SelectTrigger>
                          <SelectContent position="popper" className="z-[200]">
                            <SelectItem value="male">{t("settings_gender_male")}</SelectItem>
                            <SelectItem value="female">{t("settings_gender_female")}</SelectItem>
                            <SelectItem value="other">{t("settings_gender_other")}</SelectItem>
                            <SelectItem value="prefer_not_to_say">{t("settings_gender_prefer_not")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("settings_height_label")}</label>
                        <Input type="number" min={100} max={250} step={1} value={personalDataForm.height} onChange={(e) => setPersonalDataForm((prev) => ({ ...prev, height: String(Math.trunc(Number(e.target.value))) }))} placeholder="Ex: 175" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("settings_weight_label")}</label>
                        <Input type="number" min={30} max={300} step="0.1" value={personalDataForm.weight} onChange={(e) => setPersonalDataForm((prev) => ({ ...prev, weight: e.target.value }))} placeholder="Ex: 70.5" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("settings_age_label")}</label>
                        <Input type="number" min={10} max={120} step={1} value={personalDataForm.age} onChange={(e) => setPersonalDataForm((prev) => ({ ...prev, age: String(Math.trunc(Number(e.target.value))) }))} placeholder="Ex: 28" />
                      </div>
                      {/* Objectives */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t("settings_objectives_label")}</label>
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
                                className={`text-left text-xs px-3 py-2 rounded-lg border transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border hover:bg-muted/80"}`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <Button onClick={handleSavePersonalData} disabled={isSavingPersonalData} className="w-full rounded-full">
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
              <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DrawerHeader className="shrink-0 flex items-center gap-2">
                  {subDrawerBack(setIsAccountOpen)}
                  <DrawerTitle>{t("settings_account_security")}</DrawerTitle>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-4">
                    {/* Email */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("settings_email_label")}</label>
                      <Input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="seu@email.com"
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
                          >
                            {isChangingEmail ? t("sending") : t("settings_change_email")}
                          </Button>
                          <p className="text-xs text-muted-foreground">{t("settings_change_email_hint")}</p>
                        </>
                      )}
                    </div>
                    {/* Password Reset */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("settings_reset_password")}</label>
                      <Button
                        onClick={async () => {
                          setIsResettingPassword(true);
                          try {
                            await supabase.auth.resetPasswordForEmail(userEmail, {
                              redirectTo: `${window.location.origin}/reset-password`,
                            });
                            toast({ title: t("settings_reset_email_sent"), description: t("settings_reset_email_desc") });
                          } catch {
                            toast({ title: t("error"), description: t("settings_reset_email_error"), variant: "destructive" });
                          } finally {
                            setIsResettingPassword(false);
                          }
                        }}
                        disabled={isResettingPassword}
                        variant="outline"
                        className="w-full rounded-full"
                      >
                        {isResettingPassword ? t("sending") : t("settings_reset_password")}
                      </Button>
                      <p className="text-xs text-muted-foreground">{t("settings_reset_password_hint")}</p>
                    </div>
                    {/* Danger Zone */}
                    <div className="border-t pt-4 space-y-3">
                      <h3 className="text-sm font-semibold text-destructive">{t("settings_danger_zone")}</h3>
                      <Button
                        onClick={() => { setIsAccountOpen(false); onRequestDeleteAccount(); }}
                        variant="destructive"
                        className="w-full rounded-full gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        {t("settings_close_account")}
                      </Button>
                      <p className="text-xs text-muted-foreground">{t("settings_close_account_hint")}</p>
                    </div>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            {/* ── Negócio ── */}
            {(commercialProfile) && (
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2 pb-0.5">{t("settings_section_business")}</p>
            )}

            {/* Commercial Profile Dashboard */}
            {commercialProfile && (
              <>
                <Button onClick={() => setIsCommercialDashboardOpen(true)} variant="outline" className="gap-2 justify-between">
                  <span>{t("settings_manage_commercial")}</span>
                  <BarChart3 className="h-4 w-4" />
                </Button>
                <Drawer open={isCommercialDashboardOpen} onOpenChange={setIsCommercialDashboardOpen}>
                  <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
                    <DrawerHeader className="shrink-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {subDrawerBack(setIsCommercialDashboardOpen)}
                          <DrawerTitle>🏪 {commercialProfile.business_name || t("settings_commercial_profile_fallback")}</DrawerTitle>
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
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex flex-col items-center gap-1">
                          <p className="text-2xl font-bold">{stats.followersCount}</p>
                          <p className="text-xs text-muted-foreground text-center">{t("profile_followers")}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex flex-col items-center gap-1">
                          <p className="text-2xl font-bold">{stats.postsCount}</p>
                          <p className="text-xs text-muted-foreground text-center">{t("profile_posts")}</p>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex flex-col items-center gap-1">
                          <p className="text-2xl font-bold">{stats.followingCount}</p>
                          <p className="text-xs text-muted-foreground text-center">{t("profile_following")}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-2">{t("settings_commercial_engagement")}</p>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                            <span className="text-sm text-muted-foreground">{t("settings_commercial_account_level")}</span>
                            <span className="text-sm font-medium">{t("ranking_level")} {stats.level}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                            <span className="text-sm text-muted-foreground">{t("settings_commercial_total_points")}</span>
                            <span className="text-sm font-medium">{stats.points} pts</span>
                          </div>
                        </div>
                      </div>
                      {(commercialProfile.business_phone || commercialProfile.business_email || commercialProfile.business_website) && (
                        <div>
                          <p className="text-sm font-semibold mb-2">{t("settings_commercial_contact")}</p>
                          <div className="space-y-2">
                            {commercialProfile.business_phone && (
                              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                                <span className="text-sm text-muted-foreground">{t("settings_commercial_phone_label")}</span>
                                <span className="text-sm font-medium">{commercialProfile.business_phone}</span>
                              </div>
                            )}
                            {commercialProfile.business_email && (
                              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                                <span className="text-sm text-muted-foreground">{t("settings_commercial_email_label")}</span>
                                <span className="text-sm font-medium">{commercialProfile.business_email}</span>
                              </div>
                            )}
                            {commercialProfile.business_website && (
                              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
                                <span className="text-sm text-muted-foreground">{t("settings_commercial_website_label")}</span>
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
                          <p className="text-sm text-muted-foreground leading-relaxed">{commercialProfile.business_description}</p>
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
              <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DrawerHeader className="shrink-0">
                  <div className="flex items-center gap-2">
                    {subDrawerBack(setIsCommercialOpen)}
                    <DrawerTitle>{t("settings_commercial_title")}</DrawerTitle>
                  </div>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("settings_commercial_segment")}</label>
                      <Select value={commercialFormData.business_segment} onValueChange={(v) => setCommercialFormData({ ...commercialFormData, business_segment: v })}>
                        <SelectTrigger><SelectValue placeholder={t("settings_commercial_segment_placeholder")} /></SelectTrigger>
                        <SelectContent position="popper" className="z-[200]">
                          <SelectItem value="academia">{t("seg_academia")}</SelectItem>
                          <SelectItem value="personal_trainer">{t("seg_personal_trainer")}</SelectItem>
                          <SelectItem value="nutricionista">{t("seg_nutricionista")}</SelectItem>
                          <SelectItem value="psicologo">{t("seg_psicologo")}</SelectItem>
                          <SelectItem value="fisioterapeuta">{t("seg_fisioterapeuta")}</SelectItem>
                          <SelectItem value="coach">{t("seg_coach")}</SelectItem>
                          <SelectItem value="outros">{t("seg_outros")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("settings_commercial_name")}</label>
                      <Input value={commercialFormData.business_name} onChange={(e) => setCommercialFormData({ ...commercialFormData, business_name: e.target.value })} placeholder="Ex: Academia Força Total" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("settings_commercial_desc")}</label>
                      <Textarea value={commercialFormData.business_description} onChange={(e) => setCommercialFormData({ ...commercialFormData, business_description: e.target.value })} placeholder={t("settings_commercial_desc_placeholder")} className="min-h-24" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("settings_commercial_phone")}</label>
                      <Input type="tel" value={commercialFormData.business_phone} onChange={(e) => setCommercialFormData({ ...commercialFormData, business_phone: formatPhone(e.target.value) })} placeholder="(11) 99999-9999" maxLength={15} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("settings_commercial_email")}</label>
                      <Input type="email" value={commercialFormData.business_email} onChange={(e) => setCommercialFormData({ ...commercialFormData, business_email: e.target.value })} placeholder="contato@negocio.com" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("settings_commercial_website")}</label>
                      <Input type="url" value={commercialFormData.business_website} onChange={(e) => setCommercialFormData({ ...commercialFormData, business_website: e.target.value })} placeholder="https://seu-site.com" />
                    </div>
                    {/* Logo */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("settings_commercial_logo")}</label>
                      <div className="flex items-center gap-3">
                        {commercialLogoPreview ? (
                          <img src={commercialLogoPreview} alt="Logo" className="h-20 w-20 rounded-lg object-cover border border-border" />
                        ) : (
                          <div className="h-16 w-16 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted text-muted-foreground text-xs text-center">{t("settings_commercial_logo_none")}</div>
                        )}
                        <label className="cursor-pointer">
                          <span className="inline-flex items-center gap-1 text-sm text-brand font-medium hover:underline">
                            {commercialLogoPreview ? t("settings_commercial_logo_change") : t("settings_commercial_logo_add")}
                          </span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file) return;
                            pendingLogoFileRef.current = file;
                            const reader = new FileReader();
                            reader.onload = (ev) => setPendingLogoCropSrc(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }} />
                        </label>
                        {commercialLogoPreview && (
                          <button type="button" className="text-xs text-destructive hover:underline" onClick={() => { setCommercialLogoFile(null); setCommercialLogoPreview(null); }}>
                            {t("remove")}
                          </button>
                        )}
                      </div>
                    </div>
                    {/* Service Plans */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">{t("settings_commercial_plans")}</label>
                        <span className="text-xs text-muted-foreground">{servicePlans.length}/5</span>
                      </div>
                      {servicePlans.length > 0 && (
                        <div className="space-y-2">
                          {servicePlans.map((plan, idx) => (
                            editingPlanIdx === idx ? (
                              <div key={idx} className="space-y-2 rounded-lg border border-brand/40 bg-brand/5 p-3">
                                <p className="text-xs font-medium text-brand">{t("settings_commercial_new_plan")}</p>
                                <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand" placeholder={t("settings_commercial_plan_name")} value={editPlanName} onChange={(e) => setEditPlanName(e.target.value)} maxLength={60} />
                                <input type="number" min="0" step="0.01" className="w-full rounded-md border border-border bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand" placeholder={t("settings_commercial_plan_price")} value={editPlanPrice} onChange={(e) => setEditPlanPrice(e.target.value)} />
                                <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand" placeholder={t("settings_commercial_plan_desc")} value={editPlanDescription} onChange={(e) => setEditPlanDescription(e.target.value)} maxLength={100} />
                                <div className="flex gap-2">
                                  <button type="button" disabled={!editPlanName.trim()} onClick={() => {
                                    if (!editPlanName.trim()) return;
                                    setServicePlans((prev) => prev.map((p, i) => i === idx ? { name: editPlanName.trim(), price: editPlanPrice ? parseFloat(editPlanPrice) : null, description: editPlanDescription.trim() || undefined } : p));
                                    setEditingPlanIdx(null); setEditPlanName(""); setEditPlanPrice(""); setEditPlanDescription("");
                                  }} className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-brand text-white text-sm font-medium py-2 hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    {t("settings_commercial_plan_confirm")}
                                  </button>
                                  <button type="button" onClick={() => { setEditingPlanIdx(null); setEditPlanName(""); setEditPlanPrice(""); setEditPlanDescription(""); }} className="px-3 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">{t("cancel")}</button>
                                </div>
                              </div>
                            ) : (
                              <div key={idx} className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{plan.name}</p>
                                  {plan.price != null && <p className="text-xs text-brand font-semibold">R$ {plan.price.toFixed(2).replace(".", ",")}</p>}
                                  {plan.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{plan.description}</p>}
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
                          <div className="space-y-2 rounded-lg border border-brand/40 bg-brand/5 p-3">
                            <p className="text-xs font-medium text-brand">{t("settings_commercial_new_plan")}</p>
                            <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand" placeholder={t("settings_commercial_plan_name")} value={newPlanName} onChange={(e) => setNewPlanName(e.target.value)} maxLength={60} />
                            <input type="number" min="0" step="0.01" className="w-full rounded-md border border-border bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand" placeholder={t("settings_commercial_plan_price")} value={newPlanPrice} onChange={(e) => setNewPlanPrice(e.target.value)} />
                            <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand" placeholder={t("settings_commercial_plan_desc")} value={newPlanDescription} onChange={(e) => setNewPlanDescription(e.target.value)} maxLength={100} />
                            <div className="flex gap-2">
                              <button type="button" disabled={!newPlanName.trim()} onClick={() => {
                                if (!newPlanName.trim()) return;
                                setServicePlans((prev) => [...prev, { name: newPlanName.trim(), price: newPlanPrice ? parseFloat(newPlanPrice) : null, description: newPlanDescription.trim() || undefined }]);
                                setNewPlanName(""); setNewPlanPrice(""); setNewPlanDescription(""); setIsAddingPlan(false);
                              }} className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-brand text-white text-sm font-medium py-2 hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                {t("settings_commercial_plan_confirm")}
                              </button>
                              <button type="button" onClick={() => { setIsAddingPlan(false); setNewPlanName(""); setNewPlanPrice(""); setNewPlanDescription(""); }} className="px-3 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground transition-colors">{t("cancel")}</button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => { setIsAddingPlan(true); setEditingPlanIdx(null); setEditPlanName(""); setEditPlanPrice(""); setEditPlanDescription(""); }} className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-brand/50 transition-colors">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            {t("settings_commercial_add_plan")}
                          </button>
                        )
                      )}
                      {servicePlans.length >= 5 && <p className="text-xs text-muted-foreground text-center">{t("settings_commercial_plan_limit")}</p>}
                    </div>
                    <Button onClick={handleSaveCommercial} disabled={isSavingCommercial || !commercialFormData.business_name} className="w-full rounded-full">
                      {isSavingCommercial ? t("saving") : t("settings_commercial_save")}
                    </Button>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            {/* ── Preferências ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2 pb-0.5">{t("settings_section_preferences")}</p>

            {/* Language */}
            <Drawer open={isLanguageOpen} onOpenChange={setIsLanguageOpen}>
              <Button onClick={() => setIsLanguageOpen(true)} variant="outline" className="gap-2 justify-between">
                <span>{t("settings_language")}</span>
                <Globe className="h-4 w-4" />
              </Button>
              <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DrawerHeader className="shrink-0">
                  <div className="flex items-center gap-2">
                    {subDrawerBack(setIsLanguageOpen)}
                    <DrawerTitle>{t("settings_language_select")}</DrawerTitle>
                  </div>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-2">
                    {(["pt", "en"] as const).map((lang) => (
                      <button key={lang} onClick={() => { setLanguage(lang); setIsLanguageOpen(false); }} className={`w-full p-3 rounded-lg border text-left transition-colors ${language === lang ? "border-brand bg-brand/10" : "border-border hover:border-brand/50"}`}>
                        <div className="font-medium">{lang === "pt" ? "Português (Brasil)" : "English"}</div>
                        <div className="text-xs text-muted-foreground">{lang === "pt" ? "pt-BR" : "en-US"}</div>
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
              <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DrawerHeader className="shrink-0">
                  <div className="flex items-center gap-2">
                    {subDrawerBack(setIsNotificationsOpen)}
                    <DrawerTitle>{t("settings_notif_configure")}</DrawerTitle>
                  </div>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-3">
                    {([
                      { key: "workoutReminders", labelKey: "settings_notif_workout", descKey: "settings_notif_workout_desc" },
                      { key: "achievementAlerts", labelKey: "settings_notif_achievements", descKey: "settings_notif_achievements_desc" },
                      { key: "friendActivity", labelKey: "settings_notif_friends", descKey: "settings_notif_friends_desc" },
                      { key: "messages", labelKey: "settings_notif_messages", descKey: "settings_notif_messages_desc" },
                    ] as { key: keyof typeof notifications; labelKey: import("../../lib/i18n").TranslationKey; descKey: import("../../lib/i18n").TranslationKey }[]).map(({ key, labelKey, descKey }) => (
                      <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
                        <div>
                          <div className="text-sm font-medium">{t(labelKey)}</div>
                          <div className="text-xs text-muted-foreground">{t(descKey)}</div>
                        </div>
                        <button onClick={() => setNotifications({ ...notifications, [key]: !notifications[key] })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifications[key] ? "bg-brand" : "bg-muted"}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifications[key] ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </div>
                    ))}
                    <div className="border-t pt-4 mt-4">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:border-border transition-colors">
                        <div>
                          <div className="text-sm font-medium">{t("settings_notif_sounds")}</div>
                          <div className="text-xs text-muted-foreground">{t("settings_notif_sounds_desc")}</div>
                        </div>
                        <button onClick={() => setNotifications({ ...notifications, sound: !notifications.sound })} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notifications.sound ? "bg-brand" : "bg-muted"}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notifications.sound ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                      </div>
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
              <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DrawerHeader className="shrink-0">
                  <div className="flex items-center gap-2">
                    {subDrawerBack(setIsTimeManagementOpen)}
                    <DrawerTitle>{t("settings_time_management")}</DrawerTitle>
                  </div>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t("settings_time_limit_label")}</label>
                      <div className="flex gap-2">
                        <Input type="number" min="0" value={dailyUsageLimit} onChange={(e) => setDailyUsageLimit(parseInt(e.target.value) || 0)} placeholder={t("settings_time_limit_placeholder")} className="flex-1" />
                        <span className="text-sm text-muted-foreground py-2">min</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{dailyUsageLimit === 0 ? t("settings_time_no_limit") : t("settings_time_limit_active").replace("{n}", String(dailyUsageLimit))}</p>
                    </div>
                    <Button onClick={() => {
                      if (dailyUsageLimit > 0) {
                        localStorage.setItem("ritmofit_daily_limit_minutes", String(dailyUsageLimit));
                        localStorage.setItem("ritmofit_daily_limit_date", new Date().toDateString());
                      } else {
                        localStorage.removeItem("ritmofit_daily_limit_minutes");
                        localStorage.removeItem("ritmofit_daily_limit_date");
                      }
                      toast({ title: t("settings_time_saved"), description: dailyUsageLimit > 0 ? t("settings_time_limit_set").replace("{n}", String(dailyUsageLimit)) : t("settings_time_limit_removed") });
                      setIsTimeManagementOpen(false);
                    }} className="w-full rounded-full">
                      {t("settings_time_save")}
                    </Button>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            {/* Personalization */}
            <Drawer open={isPersonalizationOpen} onOpenChange={setIsPersonalizationOpen}>
              <Button onClick={() => setIsPersonalizationOpen(true)} variant="outline" className="gap-2 justify-between">
                <span>{t("settings_personalization")}</span>
                <span>🎨</span>
              </Button>
              <DrawerContent className="max-h-[80dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DrawerHeader className="shrink-0">
                  <div className="flex items-center gap-2">
                    {subDrawerBack(setIsPersonalizationOpen)}
                    <DrawerTitle>{t("settings_personalization")}</DrawerTitle>
                  </div>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  <div className="space-y-2">
                    {window.innerWidth < 768 && (
                      <Button onClick={() => { toggleLayoutMode(); window.location.reload(); }} variant="outline" className="w-full rounded-full gap-2">
                        <span>📐</span>
                        {layoutMode === "novo" ? t("settings_layout_old") : t("settings_layout_new")}
                      </Button>
                    )}
                    <Button onClick={() => setTheme(isDark ? "light" : "dark")} variant="outline" className="w-full rounded-full gap-2">
                      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                      {isDark ? t("settings_theme_light2") : t("settings_theme_night")}
                    </Button>
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            {/* ── Outros ── */}
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2 pb-0.5">{t("settings_section_other")}</p>

            {/* Flow History */}
            <Drawer open={isFlowHistoryOpen} onOpenChange={setIsFlowHistoryOpen}>
              <Button onClick={openFlowHistory} variant="outline" className="gap-2 justify-between">
                <span>{t("settings_flow_archive")}</span>
                <span>🕐</span>
              </Button>
              <DrawerContent className="max-h-[85dvh] flex flex-col modal-enter" onOpenAutoFocus={(e) => e.preventDefault()}>
                <DrawerHeader className="shrink-0">
                  <div className="flex items-center gap-2">
                    {subDrawerBack(setIsFlowHistoryOpen)}
                    <DrawerTitle>{t("settings_flow_archive")}</DrawerTitle>
                  </div>
                </DrawerHeader>
                <div className="flex-1 overflow-y-auto px-4 pb-4">
                  {isLoadingFlowHistory ? (
                    <div className="flex justify-center py-8"><LoadingSpinner /></div>
                  ) : expiredFlows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
                      <span className="text-4xl">📂</span>
                      <p className="text-sm text-muted-foreground">{t("settings_flow_empty")}</p>
                      <p className="text-xs text-muted-foreground">{t("settings_flow_empty_desc")}</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1">
                      {expiredFlows.map((flow) => (
                        <div key={flow.id} className="relative aspect-[9/16] rounded-lg overflow-hidden bg-muted border border-border/40">
                          {flow.media_url ? (
                            flow.media_url.match(/\.(mp4|mov|webm)/) ? (
                              <video src={flow.media_url} className="w-full h-full object-cover" muted playsInline />
                            ) : (
                              <img src={flow.media_url} alt="flow" className="w-full h-full object-cover" />
                            )
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-muted/50"><span className="text-2xl">🌊</span></div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                            <p className="text-[10px] text-white/80 truncate">{new Date(flow.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
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
          const original = pendingPhotoFileRef.current;
          const croppedFile = new File([blob], original?.name ?? "photo.jpg", { type: "image/jpeg" });
          setEditPhotoFile(croppedFile);
          setEditPhotoPreview(dataUrl);
          setPendingPhotoCropSrc(null);
        }}
        onCancel={() => setPendingPhotoCropSrc(null)}
      />

      {/* Cropper — commercial logo */}
      <ImageCropperDrawer
        imageSrc={pendingLogoCropSrc}
        aspectRatio={1}
        onConfirm={(dataUrl, blob) => {
          const original = pendingLogoFileRef.current;
          const croppedFile = new File([blob], original?.name ?? "logo.jpg", { type: "image/jpeg" });
          setCommercialLogoFile(croppedFile);
          setCommercialLogoPreview(dataUrl);
          setPendingLogoCropSrc(null);
        }}
        onCancel={() => setPendingLogoCropSrc(null)}
      />
    </>
  );
}
