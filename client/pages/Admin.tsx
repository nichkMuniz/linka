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
  Crown,
  Plus,
  ChevronDown,
  Utensils,
  Send,
  ThumbsUp,
  PersonStanding,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AdminSkeleton } from "@/components/shared/animated-loading";
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
  getAdminPremiumUsersDb,
  adminSetPremiumDb,
  adminSearchUsersDb,
  getAdminTodayActivityDb,
  getAdminAnatomyCoverageDb,
  type AnatomyCoverage,
  type AnatomyGapItem,
  type AdminTodayUser,
  type AdminPremiumUser,
  type AdminUserSearchResult,
  type AdminComplaint,
  type AdminStats,
  type AdminAnalytics,
  type AdminTopScreen,
  type AdminDayCount,
  type AdminActiveUser,
} from "@/lib/ritmofit-db";
import { VerifiedBadge } from "@/components/shared/VerifiedBadge";
import { Input } from "@/components/ui/input";
import { reportHandledError } from "@/lib/monitoring";
import { copyToClipboard } from "@/lib/clipboard";
import { anatomySqlSnippet } from "@/lib/admin";

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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// Rótulo/ícone de cada ação devolvida por get_admin_today_activity.
const ACTION_META: Record<string, { label: string; icon: React.ElementType; accent: string }> = {
  post: { label: "Posts", icon: FileText, accent: "text-blue-400" },
  shot: { label: "Shots", icon: Video, accent: "text-purple-400" },
  flow: { label: "Flows", icon: Zap, accent: "text-amber-400" },
  comentario: { label: "Comentários", icon: MessageCircle, accent: "text-sky-400" },
  comentario_shot: { label: "Comentários em shots", icon: MessageCircle, accent: "text-purple-400" },
  curtida: { label: "Curtidas", icon: Heart, accent: "text-rose-400" },
  curtida_shot: { label: "Curtidas em shots", icon: ThumbsUp, accent: "text-rose-400" },
  check_in: { label: "Check-ins", icon: Dumbbell, accent: "text-emerald-400" },
  check_in_duelo: { label: "Check-ins de duelo", icon: Target, accent: "text-emerald-400" },
  mensagem: { label: "Mensagens enviadas", icon: Send, accent: "text-sky-400" },
  refeicao: { label: "Registros no diário", icon: Utensils, accent: "text-lime-400" },
  treino: { label: "Treinos concluídos", icon: Dumbbell, accent: "text-emerald-400" },
};

function actionMeta(acao: string) {
  return ACTION_META[acao] ?? { label: acao, icon: Activity, accent: "text-muted-foreground" };
}

// ─── atividade de hoje: um card expansível por usuário ────────────────────────

function TodayActivityCard({ user }: { user: AdminTodayUser }) {
  const navigate = useNavigate();
  const [open, setOpen] = React.useState(false);
  const maxScreen = Math.max(...user.telas.map((t) => t.seconds), 1);
  // O tempo de sessão é a fonte "oficial" (mesma do DAU); se ela ainda não
  // chegou (app aberto agora), o tempo por tela é o melhor que temos.
  const displaySeconds = user.total_seconds || user.screen_seconds;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-muted overflow-hidden shrink-0">
          {user.photo ? (
            <img src={user.photo} alt={user.nickname} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <UserCircle className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-foreground truncate">{user.nickname}</p>
            {user.novo_hoje && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 shrink-0">
                novo
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {user.handle ? `@${user.handle} · ` : ""}
            {user.telas.length} {user.telas.length === 1 ? "tela" : "telas"} · {user.acoes_total}{" "}
            {user.acoes_total === 1 ? "ação" : "ações"}
            {user.ultimo_acesso ? ` · último acesso ${formatTime(user.ultimo_acesso)}` : ""}
          </p>
        </div>

        <span className="text-xs font-semibold text-primary shrink-0">
          {formatSeconds(displaySeconds)}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border/50">
          {/* Telas */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Telas
            </p>
            {user.telas.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Sem tempo por tela registrado (o app envia ao ir para segundo plano).
              </p>
            ) : (
              <div className="space-y-2">
                {user.telas.map((t) => (
                  <div key={t.screen}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-medium text-foreground">{screenLabel(t.screen)}</span>
                      <span className="text-xs text-muted-foreground">{formatSeconds(t.seconds)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/70 rounded-full transition-all"
                        style={{ width: `${(t.seconds / maxScreen) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ações */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Ações
            </p>
            {user.acoes.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Só navegou — nenhuma ação hoje.</p>
            ) : (
              <div className="grid grid-cols-1 gap-1.5">
                {user.acoes.map((a) => {
                  const meta = actionMeta(a.acao);
                  const Icon = meta.icon;
                  return (
                    <div key={a.acao} className="flex items-center gap-2 text-xs">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${meta.accent}`} />
                      <span className="text-foreground flex-1 truncate">{meta.label}</span>
                      {a.ultima && (
                        <span className="text-muted-foreground">últ. {formatTime(a.ultima)}</span>
                      )}
                      <span className="font-semibold text-foreground w-6 text-right">{a.total}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sessões */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1 border-t border-border/50">
            <span>
              {user.sessoes} {user.sessoes === 1 ? "sessão" : "sessões"}
            </span>
            {user.primeiro_acesso && <span>1º acesso {formatTime(user.primeiro_acesso)}</span>}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px] ml-auto"
              onClick={() => navigate(`/usuario/${user.user_id}`)}
            >
              Ver perfil
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function contentRoute(complaint: AdminComplaint): string | null {
  if (complaint.tipo === "post") return `/post/${complaint.conteudo_id}`;
  if (complaint.tipo === "shot") return `/shots`;
  if (complaint.tipo === "flow") return `/flows/${complaint.conteudo_id}`;
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

// ─── anatomia: linha de exercício sem músculos mapeados ───────────────────────

function AnatomyGapRow({ gap }: { gap: AnatomyGapItem }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{gap.name}</span>
          {gap.isCustom && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">custom</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {gap.muscleGroup ?? "sem grupo"} · <span className="font-mono">{gap.id.slice(0, 8)}…</span>
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        title="Copiar SQL do INSERT"
        onClick={() => {
          copyToClipboard(anatomySqlSnippet(gap.id, gap.name, gap.muscleGroup));
          toast({
            title: "SQL copiado",
            description: "Cole no SQL Editor do Supabase e troque SLUG_DO_MUSCULO.",
          });
        }}
        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
      >
        <Copy className="w-3.5 h-3.5" />
      </Button>
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

/**
 * O ban grava o flag e manda o GoTrue revogar a sessão. Quando a segunda parte
 * não passa (o dono da função sem grant em `auth`), a conta fica marcada mas o
 * usuário continua entrando — dizer só "banido" aí seria mentira.
 */
function banToast(sessionRevoked: boolean, successTitle: string) {
  if (sessionRevoked) return { title: successTitle };
  return {
    title: "Banido, mas a sessão não caiu",
    description:
      "A conta foi marcada como banida, porém o acesso não pôde ser revogado no auth. O usuário continua conseguindo entrar — ver docs/18-admin.md.",
    variant: "destructive" as const,
  };
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
  const [todayActivity, setTodayActivity] = React.useState<AdminTodayUser[]>([]);
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
      reportHandledError(err, "admin:set-verified");
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

  // ── LinKa Premium (ativação manual) ────────────────────────────────────────
  //
  // Substitui o INSERT na mão no SQL Editor: escreve em `subscriptions` pela RPC
  // admin_set_premium (SECURITY DEFINER, checa app_admins no servidor).
  const PREMIUM_DURATIONS: { label: string; days: number | null }[] = [
    { label: "Permanente", days: null },
    { label: "7 dias", days: 7 },
    { label: "30 dias", days: 30 },
  ];
  const [premiumUsers, setPremiumUsers] = React.useState<AdminPremiumUser[]>([]);
  const [premiumQuery, setPremiumQuery] = React.useState("");
  const [premiumResults, setPremiumResults] = React.useState<AdminUserSearchResult[]>([]);
  const [premiumSearching, setPremiumSearching] = React.useState(false);
  const [premiumDays, setPremiumDays] = React.useState<number | null>(null);
  const [premiumActingId, setPremiumActingId] = React.useState<string | null>(null);

  // ── Anatomia (curadoria de workout_muscles) ────────────────────────────────
  const [anatomy, setAnatomy] = React.useState<AnatomyCoverage | null>(null);
  const [showStretchGaps, setShowStretchGaps] = React.useState(false);

  // Busca com debounce — cada tecla dispararia um round-trip por letra.
  React.useEffect(() => {
    const raw = premiumQuery.trim().replace(/^@/, "");
    if (raw.length < 2) {
      setPremiumResults([]);
      setPremiumSearching(false);
      return;
    }
    setPremiumSearching(true);
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const res = await adminSearchUsersDb(raw);
      if (cancelled) return;
      setPremiumResults(res);
      setPremiumSearching(false);
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [premiumQuery]);

  async function handleSetPremium(user: { userId: string; nickname: string }, active: boolean) {
    if (premiumActingId) return;
    setPremiumActingId(user.userId);
    try {
      await adminSetPremiumDb(user.userId, active, active ? premiumDays : null);
      const label = PREMIUM_DURATIONS.find((d) => d.days === premiumDays)?.label ?? "";
      toast({
        title: active
          ? `Premium ativado para ${user.nickname || "usuário"}`
          : `Premium removido de ${user.nickname || "usuário"}`,
        description: active
          ? `${label} · o app do usuário reflete em até 1 minuto (cache do status).`
          : "O acesso cai em até 1 minuto (cache do status).",
      });
      setPremiumUsers(await getAdminPremiumUsersDb());
      if (active) setPremiumQuery("");
    } catch (err: any) {
      reportHandledError(err, "admin:set-premium");
      toast({ title: "Erro ao alterar premium", description: err.message, variant: "destructive" });
    } finally {
      setPremiumActingId(null);
    }
  }

  const load = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [c, s, a, v, au, pu, ta, an] = await Promise.all([
        getAdminComplaintsDb(),
        getAdminStatsDb(),
        getAdminAnalyticsDb(),
        getVerifiedAccountsDb(),
        getAdminActiveUsersDb(),
        getAdminPremiumUsersDb(),
        getAdminTodayActivityDb(),
        getAdminAnatomyCoverageDb(),
      ]);
      setComplaints(c);
      setStats(s);
      setAnalytics(a);
      setVerifiedAccounts(v);
      setActiveUsers(au);
      setPremiumUsers(pu);
      setTodayActivity(ta);
      setAnatomy(an);
    } catch (err: any) {
      reportHandledError(err, "admin:load");
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
        case "delete": {
          const { deleted } = await adminDeleteContentDb(complaint.tipo, complaint.conteudo_id);
          await adminDismissComplaintDb(complaint.tipo, complaint.id);
          toast(
            deleted
              ? { title: "Conteúdo removido" }
              : { title: "Conteúdo já não existia", description: "A denúncia foi arquivada." },
          );
          break;
        }
        case "ban": {
          const { sessionRevoked } = await adminBanUserDb(pendingAction.userId);
          await adminDismissComplaintDb(complaint.tipo, complaint.id);
          toast(banToast(sessionRevoked, "Usuário banido"));
          break;
        }
        case "delete_and_ban": {
          // Sequencial: se o ban falhar, o conteúdo já removido é aceitável —
          // o inverso (banir e deixar o conteúdo no ar) não é.
          await adminDeleteContentDb(complaint.tipo, complaint.conteudo_id);
          const { sessionRevoked } = await adminBanUserDb(pendingAction.userId);
          await adminDismissComplaintDb(complaint.tipo, complaint.id);
          toast(banToast(sessionRevoked, "Conteúdo removido e usuário banido"));
          break;
        }
      }

      setComplaints((prev) => prev.filter((c) => c.id !== complaint.id));
      setStats((prev) =>
        prev ? { ...prev, complaintsTotal: Math.max(0, prev.complaintsTotal - 1) } : prev,
      );
    } catch (err: any) {
      reportHandledError(err, "admin:moderation-action", {
        acao: pendingAction.type,
        tipo: complaint.tipo,
        complaint_id: complaint.id,
      });
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

      {/* ── Atividade de hoje por usuário ──────────────────────────────────── */}
      <section>
        <SectionHeader
          icon={Activity}
          label="Atividade de hoje (por usuário)"
          badge={todayActivity.length}
        />
        {todayActivity.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Ninguém entrou no app hoje ainda</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {todayActivity.map((u) => (
                <TodayActivityCard key={u.user_id} user={u} />
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
              Toque em alguém para ver as telas (com o tempo em cada uma) e as ações do dia. A
              telemetria é enviada quando o app vai para segundo plano — quem está com o app aberto
              agora aparece com o tempo da última vez que saiu.
            </p>
          </>
        )}
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

      {/* ── Anatomia dos exercícios ────────────────────────────────────────── */}
      {anatomy && (() => {
        // Duas listas com pesos diferentes: alongamento/mobilidade nunca teve
        // anatomia (o seed pula de propósito), então só o outro bloco é fila
        // de trabalho de verdade.
        const pending = anatomy.gaps.filter((g) => !g.isStretch);
        const stretches = anatomy.gaps.filter((g) => g.isStretch);
        const pct = anatomy.total > 0 ? Math.round((anatomy.mapped / anatomy.total) * 100) : 0;

        return (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <PersonStanding className="w-4 h-4 text-orange-500" />
              <h2 className="text-base font-semibold">Anatomia dos exercícios</h2>
              {pending.length > 0 && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0">{pending.length}</Badge>
              )}
            </div>

            {/* Cobertura: a leitura de uma olhada só. */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Com músculos mapeados</span>
                <span className="text-sm font-semibold">
                  {anatomy.mapped} / {anatomy.total}
                  <span className="text-muted-foreground font-normal"> · {pct}%</span>
                </span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-orange-500/80 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {pending.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <CheckCircle className="w-7 h-7 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Todo exercício de força tem anatomia mapeada.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Sem a ficha de "músculos trabalhados" no detalhe do exercício:
                </p>
                {pending.map((g) => <AnatomyGapRow key={g.id} gap={g} />)}
              </div>
            )}

            {/* Alongamento/mobilidade: colapsado porque é lacuna esperada. */}
            {stretches.length > 0 && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowStretchGaps((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showStretchGaps ? "" : "-rotate-90"}`} />
                  {stretches.length} de alongamento/mobilidade (lacuna esperada)
                </button>
                {showStretchGaps && stretches.map((g) => <AnatomyGapRow key={g.id} gap={g} />)}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              A ficha vem de <span className="font-mono">workout_muscles</span> (workout_id, muscle_id,
              role: primary/secondary/stabilizer, emphasis 0–100). O botão de copiar traz o INSERT
              pronto — os slugs de músculo saem de{" "}
              <span className="font-mono">select id, name from muscles</span>. Exercícios marcados como
              custom foram criados por usuários; mapear é opcional.
            </p>
          </section>
        );
      })()}

      {/* ── LinKa Premium ──────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500" />
          <h2 className="text-base font-semibold">LinKa Premium</h2>
          {premiumUsers.filter((u) => u.isActive).length > 0 && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {premiumUsers.filter((u) => u.isActive).length} ativos
            </Badge>
          )}
        </div>

        {/* Duração da concessão */}
        <div className="flex items-center gap-1.5">
          {PREMIUM_DURATIONS.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => setPremiumDays(d.days)}
              className={`flex-1 h-8 rounded-lg border text-xs font-medium transition-colors ${
                premiumDays === d.days
                  ? "border-amber-500/60 bg-amber-500/15 text-amber-500"
                  : "border-border bg-card text-muted-foreground hover:bg-muted/40"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Busca de usuário */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="@handle ou nome do usuário"
            value={premiumQuery}
            onChange={(e) => setPremiumQuery(e.target.value)}
            className="pl-9 pr-9 h-9 text-sm"
          />
          {premiumQuery && (
            <button
              type="button"
              onClick={() => setPremiumQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Resultados da busca */}
        {premiumQuery.trim().replace(/^@/, "").length >= 2 && (
          <div className="space-y-2">
            {premiumSearching ? (
              <p className="text-xs text-muted-foreground text-center py-2">Buscando…</p>
            ) : premiumResults.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhum usuário encontrado.</p>
            ) : (
              premiumResults.map((u) => {
                const alreadyActive = premiumUsers.some((p) => p.userId === u.userId && p.isActive);
                return (
                  <div
                    key={u.userId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0">
                        {u.photo ? (
                          <img src={u.photo} alt={u.nickname} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <UserCircle className="w-5 h-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.nickname}</p>
                        {u.handle && <p className="text-xs text-muted-foreground truncate">@{u.handle}</p>}
                      </div>
                    </div>
                    {alreadyActive ? (
                      <span className="text-xs text-amber-500 font-medium shrink-0 flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5" />
                        Já é premium
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleSetPremium(u, true)}
                        disabled={premiumActingId === u.userId}
                        className="h-8 px-3 text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold shrink-0 gap-1"
                      >
                        {premiumActingId === u.userId ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            Ativar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Assinantes */}
        {premiumUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum assinante ainda.</p>
        ) : (
          <div className="space-y-2">
            {premiumUsers.map((u) => (
              <div
                key={u.userId}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
                  u.isActive ? "border-amber-500/30 bg-amber-500/5" : "border-border/40 bg-muted/20"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0">
                    {u.photo ? (
                      <img src={u.photo} alt={u.nickname} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <UserCircle className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium truncate">{u.nickname || "—"}</span>
                      {u.isActive && <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    </div>
                    {/* Assinatura paga e cortesia são independentes: um usuário
                        pode ter as duas, e o X só revoga a cortesia. Deixar
                        isso explícito evita o admin achar que "removeu" uma
                        assinatura da App Store (que só a Apple cancela). */}
                    <p className="text-xs text-muted-foreground truncate">
                      {u.handle ? `@${u.handle} · ` : ""}
                      {u.paidActive
                        ? `App Store${u.currentPeriodEnd ? ` até ${formatDate(u.currentPeriodEnd)}` : ""}`
                        : u.manualActive
                          ? null
                          : u.status === "expired" || u.status === "active"
                            ? "assinatura expirada"
                            : "inativo"}
                      {u.manualActive && (
                        <span className="text-amber-500">
                          {u.paidActive ? " · " : ""}
                          cortesia
                          {u.manualUntil ? ` até ${formatDate(u.manualUntil)}` : " permanente"}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {/* O X revoga a CORTESIA — só aparece quando existe uma.
                    Numa assinatura paga ele não teria efeito nenhum
                    (admin_set_premium não toca nas colunas de pagamento). */}
                {u.manualActive ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleSetPremium(u, false)}
                    disabled={premiumActingId === u.userId}
                    title="Revogar cortesia"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                  >
                    {premiumActingId === u.userId ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSetPremium(u, true)}
                    disabled={premiumActingId === u.userId}
                    className="h-7 px-2.5 text-xs shrink-0 border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
                  >
                    {premiumActingId === u.userId ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Dar cortesia"
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          A concessão aqui é <strong>cortesia</strong>: libera os recursos sem cobrança e é
          independente de assinaturas pagas pela App Store — dar ou revogar cortesia nunca altera
          (nem cancela) a assinatura de quem paga. O status é lido com cache de 60s, então o app do
          usuário libera os recursos em até 1 minuto.
        </p>
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
