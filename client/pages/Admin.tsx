import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield,
  Flag,
  Trash2,
  CheckCircle,
  Users,
  FileText,
  Video,
  RefreshCw,
  AlertTriangle,
  UserX,
  ExternalLink,
  UserCircle,
  TrendingUp,
  Clock,
  Heart,
  MessageCircle,
  Activity,
  Dumbbell,
  Monitor,
  UserPlus,
  BarChart3,
  Zap,
  BadgeCheck,
  Search,
  X,
  ArrowLeft,
  Ban,
  Repeat,
  Sparkles,
  CalendarDays,
  CalendarRange,
  Target,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner, AdminSkeleton } from "@/components/shared/animated-loading";
import { toast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getAdminComplaintsDb,
  getAdminStatsDb,
  getAdminAnalyticsDb,
  getAdminActiveUsersDb,
  adminDismissComplaintDb,
  adminDeleteContentDb,
  adminBanUserDb,
  setUserVerifiedDb,
  getVerifiedAccountsDb,
  type AdminComplaint,
  type AdminStats,
  type AdminAnalytics,
  type AdminTopScreen,
  type AdminDayCount,
  type AdminActiveUser,
} from "@/lib/ritmofit-db";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { Input } from "@/components/ui/input";

// ─── helpers ──────────────────────────────────────────────────────────────────

function tipoLabel(tipo: AdminComplaint["tipo"]) {
  const map = { post: "Post", shot: "Shot", flow: "Flow", usuario: "Usuário" };
  return map[tipo];
}

function tipoBadgeClass(tipo: AdminComplaint["tipo"]) {
  const map = {
    post: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    shot: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    flow: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    usuario: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };
  return map[tipo];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSeconds(s: number) {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

function screenLabel(screen: string) {
  const map: Record<string, string> = {
    "/": "Feed",
    "/shots": "Shots",
    "/metas": "Metas",
    "/comunidade": "Comunidade",
    "/perfil": "Perfil",
    "/buscar": "Buscar",
    "/notificacoes": "Notificações",
    "/vitrine": "Vitrine",
    "/novo-post": "Novo Post",
  };
  return map[screen] ?? screen;
}

function contentRoute(complaint: AdminComplaint): string | null {
  if (complaint.tipo === "post") return `/post/${complaint.conteudo_id}`;
  if (complaint.tipo === "shot") return `/shots`;
  if (complaint.tipo === "flow") return `/`;
  if (complaint.tipo === "usuario") return `/usuario/${complaint.conteudo_id}`;
  return null;
}

function authorId(complaint: AdminComplaint): string | null {
  if (complaint.tipo === "usuario") return complaint.conteudo_id;
  return complaint.autor_id ?? null;
}

type PendingAction =
  | { type: "dismiss"; complaint: AdminComplaint }
  | { type: "delete"; complaint: AdminComplaint }
  | { type: "ban"; complaint: AdminComplaint; userId: string }
  | { type: "delete_and_ban"; complaint: AdminComplaint; userId: string };

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  className = "",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${accent ?? "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── mini bar chart ────────────────────────────────────────────────────────────

function MiniBar({ days, valueKey }: { days: AdminDayCount[]; valueKey: "total" | "usuarios_ativos" }) {
  if (!days.length) return null;
  const values = days.map((d) => (valueKey === "total" ? d.total ?? 0 : d.usuarios_ativos ?? 0));
  const max = Math.max(...values, 1);
  const BAR_MAX_H = 72;
  const dayLabels = days.map((d) => {
    const dateStr = d.dia ?? d.session_date ?? "";
    if (!dateStr) return "";
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  });

  return (
    <div className="flex items-end gap-1.5 w-full" style={{ height: `${BAR_MAX_H + 36}px` }}>
      {values.map((v, i) => {
        const barH = Math.max(4, (v / max) * BAR_MAX_H);
        const isToday = i === values.length - 1;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1" style={{ height: "100%", justifyContent: "flex-end" }}>
            <span className="text-[10px] font-medium text-foreground/70 leading-none">{v > 0 ? v : ""}</span>
            <div
              className={`w-full rounded-t-sm transition-all ${isToday ? "bg-primary" : "bg-primary/40"}`}
              style={{ height: `${barH}px` }}
            />
            <span className={`text-[10px] leading-none mt-0.5 ${isToday ? "text-primary font-semibold" : "text-muted-foreground"}`}>{dayLabels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── active users ranking ─────────────────────────────────────────────────────

function ActiveUsersRanking({ users }: { users: AdminActiveUser[] }) {
  if (!users.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum dado de uso disponível hoje</p>
      </div>
    );
  }
  const maxSec = Math.max(...users.map((u) => u.total_seconds), 1);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {users.map((user, i) => (
        <div
          key={user.user_id}
          className={`flex items-center gap-3 px-4 py-3 ${i < users.length - 1 ? "border-b border-border/50" : ""}`}
        >
          <span className="text-base w-6 text-center shrink-0">
            {medals[i] ?? <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>}
          </span>

          <div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0">
            {user.photo ? (
              <img src={user.photo} alt={user.nickname} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <UserCircle className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user.nickname}</p>
            {user.handle ? (
              <div className="w-full h-1 bg-muted rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-primary/60 rounded-full transition-all"
                  style={{ width: `${(user.total_seconds / maxSec) * 100}%` }}
                />
              </div>
            ) : null}
          </div>

          <span className="text-xs font-semibold text-primary shrink-0">
            {formatSeconds(user.total_seconds)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── top screens ──────────────────────────────────────────────────────────────

function TopScreensList({ screens }: { screens: AdminTopScreen[] }) {
  if (!screens.length) {
    return <p className="text-xs text-muted-foreground italic">Sem dados de navegação ainda</p>;
  }
  const max = Math.max(...screens.map((s) => s.total_seconds), 1);

  return (
    <div className="space-y-2">
      {screens.map((s) => (
        <div key={s.screen}>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-xs font-medium text-foreground">{screenLabel(s.screen)}</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatSeconds(s.total_seconds)}</span>
              <span>·</span>
              <span>{s.usuarios_unicos} usuários</span>
            </div>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/70 rounded-full transition-all"
              style={{ width: `${(s.total_seconds / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label, badge }: { icon: React.ElementType; label: string; badge?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      {badge != null && badge > 0 && (
        <Badge variant="destructive" className="text-xs px-1.5 py-0">{badge}</Badge>
      )}
    </div>
  );
}

// ─── complaint row ────────────────────────────────────────────────────────────

function ComplaintRow({
  complaint,
  onAction,
}: {
  complaint: AdminComplaint;
  onAction: (action: PendingAction) => void;
}) {
  const navigate = useNavigate();
  const contRoute = contentRoute(complaint);
  const authorUserId = authorId(complaint);
  const isUserReport = complaint.tipo === "usuario";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tipoBadgeClass(complaint.tipo)}`}
        >
          {tipoLabel(complaint.tipo)}
        </span>
        <span className="text-xs text-muted-foreground">{formatDate(complaint.created_at)}</span>
      </div>

      {complaint.reason ? (
        <p className="text-sm text-foreground bg-muted/40 rounded-lg px-3 py-2 border border-border">
          "{complaint.reason}"
        </p>
      ) : (
        <p className="text-xs text-muted-foreground italic">Sem motivo informado</p>
      )}

      <div className="grid grid-cols-1 gap-0.5 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground/60">Denunciante:</span>{" "}
          <span className="font-mono">{complaint.denunciante_id.slice(0, 12)}…</span>
        </span>
        <span>
          <span className="font-medium text-foreground/60">
            {isUserReport ? "Usuário denunciado:" : "Conteúdo ID:"}
          </span>{" "}
          <span className="font-mono">{complaint.conteudo_id.slice(0, 12)}…</span>
        </span>
        {!isUserReport && authorUserId && (
          <span>
            <span className="font-medium text-foreground/60">Autor ID:</span>{" "}
            <span className="font-mono">{authorUserId.slice(0, 12)}…</span>
          </span>
        )}
      </div>

      <div className="flex gap-2">
        {contRoute && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs h-8 gap-1.5"
            onClick={() => navigate(contRoute)}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {isUserReport ? "Ver perfil" : `Ver ${tipoLabel(complaint.tipo).toLowerCase()}`}
          </Button>
        )}
        {!isUserReport && authorUserId && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs h-8 gap-1.5"
            onClick={() => navigate(`/usuario/${authorUserId}`)}
          >
            <UserCircle className="w-3.5 h-3.5" />
            Ver autor
          </Button>
        )}
      </div>

      <div className="border-t border-border" />

      <div className="flex flex-col gap-2">
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs h-8 gap-1.5"
          onClick={() => onAction({ type: "dismiss", complaint })}
        >
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          Ignorar denúncia
        </Button>

        {!isUserReport && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs h-8 gap-1.5 border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
            onClick={() => onAction({ type: "delete", complaint })}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remover {tipoLabel(complaint.tipo).toLowerCase()}
          </Button>
        )}

        {authorUserId && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs h-8 gap-1.5 border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
            onClick={() => onAction({ type: "ban", complaint, userId: authorUserId })}
          >
            <UserX className="w-3.5 h-3.5" />
            Banir usuário
          </Button>
        )}

        {!isUserReport && authorUserId && (
          <Button
            size="sm"
            variant="destructive"
            className="w-full text-xs h-8 gap-1.5"
            onClick={() =>
              onAction({ type: "delete_and_ban", complaint, userId: authorUserId })
            }
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Remover conteúdo + banir usuário
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── confirm dialog ───────────────────────────────────────────────────────────

function confirmTexts(action: PendingAction | null) {
  if (!action) return { title: "", desc: "", label: "" };
  const tipo = tipoLabel(action.complaint.tipo).toLowerCase();
  switch (action.type) {
    case "dismiss":
      return { title: "Ignorar denúncia?", desc: "A denúncia será descartada sem nenhuma ação sobre o conteúdo.", label: "Ignorar" };
    case "delete":
      return { title: `Remover ${tipo}?`, desc: `O ${tipo} será permanentemente removido do app. Esta ação não pode ser desfeita.`, label: "Remover" };
    case "ban":
      return { title: "Banir usuário?", desc: "O usuário será marcado como banido e não poderá mais usar o app.", label: "Banir" };
    case "delete_and_ban":
      return { title: "Remover conteúdo e banir usuário?", desc: `O ${tipo} será removido permanentemente e o autor será banido do app. Esta ação não pode ser desfeita.`, label: "Remover e banir" };
  }
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function Admin() {
  const navigate = useNavigate();
  const [complaints, setComplaints] = React.useState<AdminComplaint[]>([]);
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [analytics, setAnalytics] = React.useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);
  const [acting, setActing] = React.useState(false);

  // ── Verified accounts ──────────────────────────────────────────────────────
  const [activeUsers, setActiveUsers] = React.useState<AdminActiveUser[]>([]);
  const [verifiedAccounts, setVerifiedAccounts] = React.useState<{ userId: string; nickname: string; handle: string; photo: string | null }[]>([]);
  const [verifyHandle, setVerifyHandle] = React.useState("");
  const [verifyingHandle, setVerifyingHandle] = React.useState(false);

  async function handleVerifyByHandle() {
    const raw = verifyHandle.trim().replace(/^@/, "");
    if (!raw) return;
    setVerifyingHandle(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      if (!supabase) throw new Error("Supabase não configurado");
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nickname, handle, photo")
        .ilike("handle", raw)
        .maybeSingle();
      if (error || !data) { toast({ title: "Usuário não encontrado", variant: "destructive" }); return; }
      const ok = await setUserVerifiedDb(String(data.user_id), true);
      if (ok) {
        toast({ title: `@${data.handle} verificado com sucesso` });
        setVerifyHandle("");
        setVerifiedAccounts(await getVerifiedAccountsDb());
      } else {
        toast({ title: "Erro ao verificar conta", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setVerifyingHandle(false);
    }
  }

  async function handleRemoveVerified(userId: string, nickname: string) {
    const ok = await setUserVerifiedDb(userId, false);
    if (ok) {
      toast({ title: `Verificação de ${nickname} removida` });
      setVerifiedAccounts((prev) => prev.filter((a) => a.userId !== userId));
    } else {
      toast({ title: "Erro ao remover verificação", variant: "destructive" });
    }
  }

  const load = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [c, s, a, v, au] = await Promise.all([
        getAdminComplaintsDb(),
        getAdminStatsDb(),
        getAdminAnalyticsDb(),
        getVerifiedAccountsDb(),
        getAdminActiveUsersDb(),
      ]);
      setComplaints(c);
      setStats(s);
      setAnalytics(a);
      setVerifiedAccounts(v);
      setActiveUsers(au);
    } catch (err: any) {
      toast({ title: "Erro ao carregar dados", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  async function handleConfirm() {
    if (!pendingAction || acting) return;
    setActing(true);
    const { complaint } = pendingAction;

    try {
      switch (pendingAction.type) {
        case "dismiss":
          await adminDismissComplaintDb(complaint.tipo, complaint.id);
          toast({ title: "Denúncia ignorada" });
          break;
        case "delete":
          await adminDeleteContentDb(complaint.tipo, complaint.conteudo_id);
          await adminDismissComplaintDb(complaint.tipo, complaint.id);
          toast({ title: "Conteúdo removido" });
          break;
        case "ban":
          await adminBanUserDb(pendingAction.userId);
          await adminDismissComplaintDb(complaint.tipo, complaint.id);
          toast({ title: "Usuário banido" });
          break;
        case "delete_and_ban":
          await Promise.all([
            adminDeleteContentDb(complaint.tipo, complaint.conteudo_id),
            adminBanUserDb(pendingAction.userId),
          ]);
          await adminDismissComplaintDb(complaint.tipo, complaint.id);
          toast({ title: "Conteúdo removido e usuário banido" });
          break;
      }

      setComplaints((prev) => prev.filter((c) => c.id !== complaint.id));
      setStats((prev) =>
        prev ? { ...prev, complaintsTotal: Math.max(0, prev.complaintsTotal - 1) } : prev,
      );
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActing(false);
      setPendingAction(null);
    }
  }

  const { title, desc, label } = confirmTexts(pendingAction);
  const isDestructive =
    pendingAction?.type === "delete" ||
    pendingAction?.type === "ban" ||
    pendingAction?.type === "delete_and_ban";

  if (loading) {
    return <AdminSkeleton />;
  }

  const dauDelta = analytics
    ? analytics.dau_hoje - analytics.dau_ontem
    : null;

  return (
    <div
      className="max-w-2xl mx-auto px-4 space-y-8"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate("/perfil")}
            className="h-8 w-8 p-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Painel Admin</h1>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => load(true)}
          disabled={refreshing}
          className="h-8 px-3 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* ── Usuários ───────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={Users} label="Usuários" />
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Cadastros hoje"
            value={analytics?.usuarios_hoje ?? 0}
            icon={UserPlus}
            accent="text-emerald-400"
          />
          <StatCard
            label="Total de usuários"
            value={analytics?.total_usuarios ?? stats?.totalUsers ?? 0}
            icon={Users}
          />
          <StatCard
            label="Novos esta semana"
            value={analytics?.usuarios_semana ?? 0}
            icon={TrendingUp}
            accent="text-blue-400"
          />
          <StatCard
            label="Novos este mês"
            value={analytics?.usuarios_mes ?? 0}
            icon={BarChart3}
            accent="text-purple-400"
          />
          <StatCard
            label="Usuários banidos"
            value={analytics?.usuarios_banidos ?? 0}
            icon={Ban}
            accent="text-rose-400"
            className="col-span-2"
          />
        </div>

        {analytics && analytics.novos_usuarios_7d.length > 0 && (
          <div className="mt-3 rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-2">Novos cadastros — últimos 7 dias</p>
            <MiniBar days={analytics.novos_usuarios_7d} valueKey="total" />
          </div>
        )}
      </section>

      {/* ── Engajamento / Sessões ──────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={Activity} label="Engajamento" />
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Usuários ativos hoje"
            value={analytics?.dau_hoje ?? 0}
            sub={
              dauDelta != null
                ? dauDelta >= 0
                  ? `+${dauDelta} vs ontem`
                  : `${dauDelta} vs ontem`
                : undefined
            }
            icon={Zap}
            accent="text-amber-400"
          />
          <StatCard
            label="Sessões hoje"
            value={analytics?.total_sessoes_hoje ?? 0}
            icon={Monitor}
          />
          <StatCard
            label="Duração média de sessão"
            value={analytics ? formatSeconds(analytics.avg_sessao_segundos_7d) : "—"}
            sub="últimos 7 dias"
            icon={Clock}
            accent="text-sky-400"
          />
          <StatCard
            label="Total de horas hoje"
            value={analytics ? `${analytics.total_horas_hoje}h` : "—"}
            icon={Clock}
          />
          <StatCard
            label="WAU (7 dias)"
            value={analytics?.wau ?? 0}
            icon={CalendarDays}
            accent="text-blue-400"
          />
          <StatCard
            label="MAU (30 dias)"
            value={analytics?.mau ?? 0}
            icon={CalendarRange}
            accent="text-purple-400"
          />
          <StatCard
            label="Stickiness"
            value={analytics ? `${analytics.stickiness}%` : "—"}
            sub="DAU / MAU"
            icon={Sparkles}
            accent="text-amber-400"
          />
          <StatCard
            label="Novos ativos hoje"
            value={analytics?.novos_ativos_hoje ?? 0}
            sub={
              analytics
                ? `${analytics.recorrentes_hoje} recorrentes`
                : undefined
            }
            icon={Repeat}
            accent="text-emerald-400"
          />
        </div>

        {analytics && analytics.dau_7d.length > 0 && (
          <div className="mt-3 rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-2">Usuários ativos por dia — últimos 7 dias</p>
            <MiniBar days={analytics.dau_7d} valueKey="usuarios_ativos" />
          </div>
        )}
      </section>

      {/* ── Retenção ───────────────────────────────────────────────────────── */}
      {analytics && (
        <section>
          <SectionHeader icon={Target} label="Retenção" />
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Retenção D1"
              value={`${analytics.retencao_d1}%`}
              sub="cohort 14 dias"
              icon={CalendarDays}
              accent="text-emerald-400"
            />
            <StatCard
              label="Retenção D7"
              value={`${analytics.retencao_d7}%`}
              sub="cohort 30 dias"
              icon={CalendarRange}
              accent="text-sky-400"
            />
          </div>
        </section>
      )}

      {/* ── Top usuários mais seguidos ─────────────────────────────────────── */}
      {analytics && analytics.top_seguidos.length > 0 && (
        <section>
          <SectionHeader icon={Star} label="Usuários mais seguidos" />
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {analytics.top_seguidos.map((u, i) => (
              <div
                key={u.user_id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i < analytics.top_seguidos.length - 1 ? "border-b border-border/50" : ""
                }`}
              >
                <span className="text-xs text-muted-foreground font-mono w-6 text-center shrink-0">
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0">
                  {u.photo ? (
                    <img src={u.photo} alt={u.nickname} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UserCircle className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.nickname}</p>
                  {u.handle && (
                    <p className="text-xs text-muted-foreground truncate">@{u.handle}</p>
                  )}
                </div>
                <span className="text-xs font-semibold text-primary shrink-0">
                  {u.followers} {u.followers === 1 ? "seguidor" : "seguidores"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Ranking usuários mais ativos hoje ─────────────────────────────── */}
      <section>
        <SectionHeader icon={TrendingUp} label="Usuários mais ativos hoje" />
        <ActiveUsersRanking users={activeUsers} />
      </section>

      {/* ── Telas mais acessadas ───────────────────────────────────────────── */}
      {analytics && (
        <section>
          <SectionHeader icon={Monitor} label="Telas mais acessadas (7 dias)" />
          <div className="rounded-xl border border-border bg-card p-4">
            <TopScreensList screens={analytics.top_screens} />
          </div>
        </section>
      )}

      {/* ── Conteúdo de hoje ───────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={FileText} label="Conteúdo de hoje" />
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Posts hoje" value={analytics?.posts_hoje ?? stats?.postsHoje ?? 0} icon={FileText} />
          <StatCard label="Shots hoje" value={analytics?.shots_hoje ?? stats?.shotsHoje ?? 0} icon={Video} />
          <StatCard label="Comentários hoje" value={analytics?.comments_hoje ?? 0} icon={MessageCircle} />
          <StatCard label="Curtidas hoje" value={analytics?.likes_hoje ?? 0} icon={Heart} accent="text-rose-400" />
          <StatCard label="Check-ins hoje" value={analytics?.check_ins_hoje ?? 0} icon={Dumbbell} accent="text-emerald-400" />
          <StatCard
            label="Denúncias abertas"
            value={stats?.complaintsTotal ?? 0}
            icon={Flag}
            accent={stats && stats.complaintsTotal > 0 ? "text-rose-400" : undefined}
            className={stats && stats.complaintsTotal > 0 ? "border-rose-500/40" : ""}
          />
        </div>
      </section>

      {/* ── Totais gerais ──────────────────────────────────────────────────── */}
      {analytics && (
        <section>
          <SectionHeader icon={BarChart3} label="Totais gerais" />
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Total posts" value={analytics.total_posts} icon={FileText} />
            <StatCard label="Total shots" value={analytics.total_shots} icon={Video} />
            <StatCard label="Total check-ins" value={analytics.total_check_ins} icon={Dumbbell} />
          </div>
        </section>
      )}

      {/* ── Fila de moderação ─────────────────────────────────────────────── */}
      <section>
        <SectionHeader icon={Flag} label="Fila de Moderação" badge={complaints.length} />

        {complaints.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma denúncia pendente</p>
          </div>
        ) : (
          <div className="space-y-3">
            {complaints.map((c) => (
              <ComplaintRow
                key={`${c.tipo}-${c.id}`}
                complaint={c}
                onAction={setPendingAction}
              />
            ))}
          </div>
        )}
      </section>

      {/* Contas Verificadas */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <BadgeCheck className="w-4 h-4 text-yellow-500" />
          <h2 className="text-base font-semibold">Contas Verificadas</h2>
        </div>

        {/* Adicionar verificação */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="@handle ou nome do usuário"
              value={verifyHandle}
              onChange={(e) => setVerifyHandle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyByHandle()}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <Button
            size="sm"
            onClick={handleVerifyByHandle}
            disabled={verifyingHandle || !verifyHandle.trim()}
            className="h-9 px-3 text-xs bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
          >
            {verifyingHandle ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "Verificar"}
          </Button>
        </div>

        {/* Lista de contas verificadas */}
        {verifiedAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conta verificada ainda.</p>
        ) : (
          <div className="space-y-2">
            {verifiedAccounts.map((acc) => (
              <div key={acc.userId} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0">
                    {acc.photo ? (
                      <img src={acc.photo} alt={acc.nickname} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UserCircle className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium truncate">{acc.nickname}</span>
                      <VerifiedBadge size="sm" />
                    </div>
                    {acc.handle && <p className="text-xs text-muted-foreground truncate">@{acc.handle}</p>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleRemoveVerified(acc.userId, acc.nickname)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Confirm dialog */}
      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(open) => { if (!open && !acting) setPendingAction(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {isDestructive ? (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              ) : (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              )}
              {title}
            </AlertDialogTitle>
            <AlertDialogDescription>{desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={acting}
              className={isDestructive ? "bg-destructive hover:bg-destructive/90" : ""}
            >
              {acting ? "Processando…" : label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
