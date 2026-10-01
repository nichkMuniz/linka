import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  ChevronRight,
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
  setUserVerifiedTierDb,
  getVerifiedAccountsDb,
  type VerifiedAccount,
  getAdminPremiumUsersDb,
  adminSetPremiumDb,
  adminSearchUsersDb,
  getAdminTodayActivityDb,
  getAdminAnatomyCoverageDb,
  getAdminBannedUsersDb,
  adminResolveUserComplaintsDb,
  type AdminBannedUser,
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
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import type { VerifiedTier } from "@/lib/verified-tier";
import { Input } from "@/components/ui/input";
import { reportHandledError } from "@/lib/monitoring";
import { copyToClipboard } from "@/lib/clipboard";
import { anatomySqlSnippet } from "@/lib/admin";
import { MODERATION_REASONS, type ModerationReason } from "@/lib/notification-copy";

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
        <UserAvatar photo={user.photo} name={user.nickname} size={36} />

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

// Motivo que o autor vê no aviso de remoção (type 22). Mesmas opções do
// ReportDrawer — o painel não é traduzido, o app do autor é.
const REMOVAL_REASON_LABEL: Record<ModerationReason, string> = {
  inappropriate: "Conteúdo inadequado",
  spam: "Spam",
  harassment: "Assédio ou bullying",
  copyright: "Direitos autorais",
  other: "Outro",
};

/**
 * Pré-seleciona o motivo a partir do texto da denúncia. O ReportDrawer grava o
 * rótulo em PT ("Assédio ou bullying"), não um código.
 */
function reasonFromComplaint(text: string | null | undefined): ModerationReason {
  const v = (text ?? "").toLowerCase();
  if (v.includes("inadequad")) return "inappropriate";
  if (v.includes("spam")) return "spam";
  if (v.includes("assédio") || v.includes("bullying")) return "harassment";
  if (v.includes("autora")) return "copyright";
  return "other";
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
    return <EmptyState icon={Activity} text="Nenhum dado de uso disponível hoje" />;
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

          <UserAvatar photo={user.photo} name={user.nickname} />

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

/**
 * Título de seção. `count` vira um selo ao lado — vermelho quando `alert`
 * (fila que pede ação), neutro quando é só uma contagem.
 */
function SectionHeader({
  icon: Icon,
  label,
  count,
  alert = false,
  accent = "text-muted-foreground",
}: {
  icon: React.ElementType;
  label: string;
  count?: number;
  alert?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className={`w-4 h-4 ${accent}`} />
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      {count != null && count > 0 && (
        <Badge variant={alert ? "destructive" : "secondary"} className="text-xs px-1.5 py-0">{count}</Badge>
      )}
    </div>
  );
}

// ─── abas ─────────────────────────────────────────────────────────────────────

type AdminTab = "indicadores" | "atividade" | "denuncias" | "banidos" | "selos" | "cortesia" | "anatomia";

// Ordem = frequência de uso: números do dia primeiro, depois quem usou, a fila
// de moderação e as ferramentas de gestão.
const ADMIN_TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
  { id: "indicadores", label: "Indicadores", icon: BarChart3 },
  { id: "atividade", label: "Atividade", icon: Activity },
  { id: "denuncias", label: "Denúncias", icon: Flag },
  { id: "banidos", label: "Banidos", icon: Ban },
  { id: "selos", label: "Selos", icon: BadgeCheck },
  { id: "cortesia", label: "Cortesia", icon: Crown },
  { id: "anatomia", label: "Anatomia", icon: PersonStanding },
];

function isAdminTab(value: string | null): value is AdminTab {
  return ADMIN_TABS.some((t) => t.id === value);
}

/**
 * Barra de abas rolável (6 abas não cabem em 375px). Mesmo cuidado da barra do
 * Perfil: eixo y travado e a linha de base como sombra interna — senão a barra
 * vira um scroller vertical de 1px e "rouba" o arrasto da página.
 */
function AdminTabBar({
  tab,
  onChange,
  counts,
}: {
  tab: AdminTab;
  onChange: (tab: AdminTab) => void;
  counts: Partial<Record<AdminTab, { value: number; alert?: boolean }>>;
}) {
  const activeRef = React.useRef<HTMLButtonElement | null>(null);

  // Aba aberta por link (?aba=anatomia) ou trocada pelo "Precisa de atenção"
  // pode estar fora da área visível da barra.
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab]);

  return (
    <div
      role="tablist"
      aria-label="Seções do painel"
      className="mt-3 -mx-4 px-4 flex gap-5 overflow-x-auto overflow-y-hidden no-scrollbar shadow-[inset_0_-1px_0_hsl(var(--border))]"
    >
      {ADMIN_TABS.map(({ id, label, icon: Icon }) => {
        const active = id === tab;
        const count = counts[id];
        return (
          <button
            key={id}
            ref={active ? activeRef : undefined}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 min-h-[44px] pb-1 border-b-2 text-sm font-semibold transition-colors ${
              active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {count && count.value > 0 && (
              <span
                className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold leading-[18px] text-center ${
                  count.alert ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {count.value > 99 ? "99+" : count.value}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Linha do card "Precisa de atenção": leva direto para a aba com a fila. */
function AttentionRow({
  icon: Icon,
  accent,
  label,
  onClick,
}: {
  icon: React.ElementType;
  accent: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 min-h-[48px] text-left active:bg-muted/40 transition-colors"
    >
      <Icon className={`w-4 h-4 shrink-0 ${accent}`} />
      <span className="flex-1 text-sm font-medium text-foreground">{label}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function EmptyState({
  icon: Icon,
  text,
  hint,
  accent = "text-muted-foreground",
}: {
  icon: React.ElementType;
  text: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <Icon className={`w-8 h-8 mx-auto mb-2 ${accent}`} />
      <p className="text-sm text-muted-foreground">{text}</p>
      {hint && <p className="text-xs text-muted-foreground/70 mt-1">{hint}</p>}
    </div>
  );
}

function UserAvatar({ photo, name, size = 32 }: { photo?: string | null; name: string; size?: number }) {
  return (
    <div className="rounded-full bg-muted overflow-hidden shrink-0" style={{ width: size, height: size }}>
      {photo ? (
        <ImageWithFallback src={photo} alt={name} thumbSize={size} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <UserCircle className="w-5 h-5 text-muted-foreground" />
        </div>
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
            className="flex-1 text-xs h-10 gap-1.5"
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
            className="flex-1 text-xs h-10 gap-1.5"
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
          className="w-full text-xs h-10 gap-1.5"
          onClick={() => onAction({ type: "dismiss", complaint })}
        >
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          Ignorar denúncia
        </Button>

        {!isUserReport && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs h-10 gap-1.5 border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
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
            className="w-full text-xs h-10 gap-1.5 border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
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
            className="w-full text-xs h-10 gap-1.5"
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
      return { title: "Banir usuário?", desc: "O usuário é desconectado na hora e não consegue mais entrar no app. As denúncias de perfil contra ele saem da fila. Dá para desfazer na aba Banidos.", label: "Banir" };
    case "delete_and_ban":
      return { title: "Remover conteúdo e banir usuário?", desc: `O ${tipo} será removido permanentemente (isso não tem volta) e o autor será banido do app — o ban dá para desfazer na aba Banidos.`, label: "Remover e banir" };
  }
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function Admin() {
  const navigate = useNavigate();
  // Aba na URL (?aba=): "Ver post"/"Ver perfil" saem do painel, e ao voltar a
  // pessoa cai na mesma aba em vez de recomeçar nos indicadores.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("aba");
  const tab: AdminTab = isAdminTab(tabParam) ? tabParam : "indicadores";
  const changeTab = React.useCallback(
    (next: AdminTab) => {
      setSearchParams(next === "indicadores" ? {} : { aba: next }, { replace: true });
      window.scrollTo({ top: 0 });
    },
    [setSearchParams],
  );
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);
  const [complaints, setComplaints] = React.useState<AdminComplaint[]>([]);
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [analytics, setAnalytics] = React.useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);
  const [acting, setActing] = React.useState(false);
  const [removalReason, setRemovalReason] = React.useState<ModerationReason>("other");

  const openAction = React.useCallback((action: PendingAction) => {
    setRemovalReason(reasonFromComplaint(action.complaint.reason));
    setPendingAction(action);
  }, []);

  // ── Verified accounts ──────────────────────────────────────────────────────
  const [activeUsers, setActiveUsers] = React.useState<AdminActiveUser[]>([]);
  const [todayActivity, setTodayActivity] = React.useState<AdminTodayUser[]>([]);
  // ── Banidos ────────────────────────────────────────────────────────────────
  const [bannedUsers, setBannedUsers] = React.useState<AdminBannedUser[]>([]);
  // Erro próprio: a lista depende de uma migração nova e não pode derrubar a
  // carga do painel inteiro enquanto ela não roda.
  const [bannedError, setBannedError] = React.useState<string | null>(null);
  const [unbanTarget, setUnbanTarget] = React.useState<AdminBannedUser | null>(null);
  const [unbanning, setUnbanning] = React.useState(false);

  const loadBanned = React.useCallback(async () => {
    try {
      setBannedUsers(await getAdminBannedUsersDb());
      setBannedError(null);
    } catch (err: any) {
      reportHandledError(err, "admin:list-banned");
      setBannedError(err?.message ?? "Erro ao carregar");
    }
  }, []);

  async function handleUnban() {
    if (!unbanTarget || unbanning) return;
    setUnbanning(true);
    const target = unbanTarget;
    try {
      await adminBanUserDb(target.userId, false);
      toast({
        title: `${target.nickname || "Usuário"} desbanido`,
        description: "A conta volta a entrar no app no próximo login.",
      });
      setBannedUsers((prev) => prev.filter((u) => u.userId !== target.userId));
      setAnalytics((prev) =>
        prev ? { ...prev, usuarios_banidos: Math.max(0, prev.usuarios_banidos - 1) } : prev,
      );
      setUnbanTarget(null);
    } catch (err: any) {
      reportHandledError(err, "admin:unban");
      toast({ title: "Erro ao desbanir", description: err.message, variant: "destructive" });
    } finally {
      setUnbanning(false);
    }
  }
  const [verifiedAccounts, setVerifiedAccounts] = React.useState<VerifiedAccount[]>([]);
  const [verifyHandle, setVerifyHandle] = React.useState("");
  const [verifyingHandle, setVerifyingHandle] = React.useState(false);
  // Nível aplicado pelo botão "Verificar": notable (azul) é o padrão — oficial
  // (dourado) é só para contas da equipe LinKa.
  const [verifyTier, setVerifyTier] = React.useState<VerifiedTier>("notable");

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
      const ok = await setUserVerifiedTierDb(String(data.user_id), verifyTier);
      if (ok) {
        toast({
          title: verifyTier === "official"
            ? `@${data.handle} agora é conta oficial`
            : `@${data.handle} verificado com sucesso`,
        });
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
    const ok = await setUserVerifiedTierDb(userId, null);
    if (ok) {
      toast({ title: `Verificação de ${nickname} removida` });
      setVerifiedAccounts((prev) => prev.filter((a) => a.userId !== userId));
    } else {
      toast({ title: "Erro ao remover verificação", variant: "destructive" });
    }
  }

  async function handleToggleVerifiedTier(acc: VerifiedAccount) {
    const next: VerifiedTier = acc.tier === "official" ? "notable" : "official";
    const ok = await setUserVerifiedTierDb(acc.userId, next);
    if (ok) {
      toast({
        title: next === "official"
          ? `${acc.nickname} agora é conta oficial`
          : `${acc.nickname} agora é conta verificada`,
      });
      setVerifiedAccounts((prev) => prev.map((a) => (a.userId === acc.userId ? { ...a, tier: next } : a)));
    } else {
      toast({ title: "Erro ao trocar o nível da verificação", variant: "destructive" });
    }
  }

  // ── Acesso cortesia (concessão manual) ─────────────────────────────────────
  //
  // Substitui o INSERT na mão no SQL Editor: escreve em `subscriptions` pela RPC
  // admin_set_premium (SECURITY DEFINER, checa app_admins no servidor).
  //
  // NÃO é assinatura: o app não vende nada, não tem plano mensal nem anual e
  // não cobra. Isto só marca contas com acesso concedido pela equipe. Os nomes
  // de tabela/RPC continuam `premium` por serem contrato com o banco.
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
          ? `Acesso concedido para ${user.nickname || "usuário"}`
          : `Acesso removido de ${user.nickname || "usuário"}`,
        description: active
          ? `${label} · o app do usuário reflete em até 1 minuto (cache do status).`
          : "O acesso cai em até 1 minuto (cache do status).",
      });
      setPremiumUsers(await getAdminPremiumUsersDb());
      if (active) setPremiumQuery("");
    } catch (err: any) {
      reportHandledError(err, "admin:set-premium");
      toast({ title: "Erro ao alterar o acesso", description: err.message, variant: "destructive" });
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
      await loadBanned();
      setLastUpdated(new Date().toISOString());
    } catch (err: any) {
      reportHandledError(err, "admin:load");
      toast({ title: "Erro ao carregar dados", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadBanned]);

  React.useEffect(() => { load(); }, [load]);

  async function handleConfirm() {
    if (!pendingAction || acting) return;
    setActing(true);
    const { complaint } = pendingAction;
    let bannedUserId: string | null = null;

    try {
      switch (pendingAction.type) {
        case "dismiss":
          await adminDismissComplaintDb(complaint.tipo, complaint.id);
          toast({ title: "Denúncia ignorada" });
          break;
        case "delete": {
          const { deleted, notified } = await adminDeleteContentDb(
            complaint.tipo,
            complaint.conteudo_id,
            removalReason,
          );
          await adminDismissComplaintDb(complaint.tipo, complaint.id);
          toast(
            deleted
              ? {
                  title: "Conteúdo removido",
                  description: notified
                    ? "O autor recebeu um aviso nas notificações."
                    : "O autor não foi avisado — confira se a migração 20261001-moderation-removal-notice rodou.",
                }
              : { title: "Conteúdo já não existia", description: "A denúncia foi arquivada." },
          );
          break;
        }
        case "ban":
        case "delete_and_ban": {
          // Sequencial: se o ban falhar, o conteúdo já removido é aceitável —
          // o inverso (banir e deixar o conteúdo no ar) não é.
          if (pendingAction.type === "delete_and_ban") {
            await adminDeleteContentDb(complaint.tipo, complaint.conteudo_id, removalReason);
          }
          const { sessionRevoked } = await adminBanUserDb(pendingAction.userId);
          bannedUserId = pendingAction.userId;
          // Banida a pessoa, as denúncias de PERFIL contra ela estão resolvidas.
          await adminResolveUserComplaintsDb(pendingAction.userId);
          await adminDismissComplaintDb(complaint.tipo, complaint.id);
          toast(
            banToast(
              sessionRevoked,
              pendingAction.type === "ban" ? "Usuário banido" : "Conteúdo removido e usuário banido",
            ),
          );
          break;
        }
      }

      // Chave tipo+id: cada tabela de denúncia tem a própria sequência de id,
      // então só o `id` casaria denúncias diferentes de tabelas diferentes.
      const isResolved = (c: AdminComplaint) =>
        (c.tipo === complaint.tipo && c.id === complaint.id) ||
        (bannedUserId != null && c.tipo === "usuario" && c.conteudo_id === bannedUserId);
      const removedCount = complaints.filter(isResolved).length;
      setComplaints((prev) => prev.filter((c) => !isResolved(c)));
      setStats((prev) =>
        prev ? { ...prev, complaintsTotal: Math.max(0, prev.complaintsTotal - removedCount) } : prev,
      );
      if (bannedUserId) void loadBanned();
    } catch (err: any) {
      // Ban aplicado, mas arquivar a denúncia falhou: dizer só "Erro" faria o
      // admin tentar banir de novo alguém que já está banido.
      if (bannedUserId) void loadBanned();
      reportHandledError(err, "admin:moderation-action", {
        acao: pendingAction.type,
        tipo: complaint.tipo,
        complaint_id: complaint.id,
      });
      toast(
        bannedUserId
          ? { title: "Usuário banido, mas a denúncia continua na fila", description: err.message, variant: "destructive" }
          : { title: "Erro", description: err.message, variant: "destructive" },
      );
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

  // Contagens que viram selo nas abas e no "Precisa de atenção".
  const pendingAnatomy = anatomy ? anatomy.gaps.filter((g) => !g.isStretch).length : 0;
  const activePremiumCount = premiumUsers.filter((u) => u.isActive).length;
  const tabCounts: Partial<Record<AdminTab, { value: number; alert?: boolean }>> = {
    denuncias: { value: complaints.length, alert: true },
    banidos: { value: bannedUsers.length },
    anatomia: { value: pendingAnatomy, alert: true },
    selos: { value: verifiedAccounts.length },
    cortesia: { value: activePremiumCount },
  };

  const newActiveSub = analytics
    ? [
        dauDelta != null ? `${dauDelta >= 0 ? "+" : ""}${dauDelta} vs ontem` : null,
        `${analytics.novos_ativos_hoje} novos`,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Cabeçalho + abas fixos: com 6 áreas, trocar de aba precisa estar a um
          toque de qualquer ponto da rolagem. */}
      <header
        className="sticky top-0 z-20 bg-background"
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
      >
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate("/perfil")}
                className="h-10 w-10 p-0 -ml-2 shrink-0"
                aria-label="Voltar ao perfil"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-foreground leading-tight flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-primary shrink-0" />
                  Painel Admin
                </h1>
                {lastUpdated && (
                  <p className="text-[11px] text-muted-foreground">Atualizado às {formatTime(lastUpdated)}</p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => load(true)}
              disabled={refreshing}
              className="h-10 px-3 text-xs shrink-0"
              aria-label="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>

          <AdminTabBar tab={tab} onChange={changeTab} counts={tabCounts} />
        </div>
      </header>

      <main
        className="max-w-2xl mx-auto px-4 pt-5"
        style={{
          paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
        }}
      >
        {/* ══ Indicadores ═══════════════════════════════════════════════════ */}
        {tab === "indicadores" && (
          <div className="space-y-8">
            {/* O que pede ação vem antes de qualquer número. */}
            {(complaints.length > 0 || pendingAnatomy > 0) && (
              <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 overflow-hidden">
                <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-rose-400">
                  Precisa de atenção
                </p>
                {complaints.length > 0 && (
                  <AttentionRow
                    icon={Flag}
                    accent="text-rose-400"
                    label={`${complaints.length} ${complaints.length === 1 ? "denúncia aguardando" : "denúncias aguardando"} análise`}
                    onClick={() => changeTab("denuncias")}
                  />
                )}
                {pendingAnatomy > 0 && (
                  <AttentionRow
                    icon={PersonStanding}
                    accent="text-orange-500"
                    label={`${pendingAnatomy} ${pendingAnatomy === 1 ? "exercício" : "exercícios"} sem anatomia`}
                    onClick={() => changeTab("anatomia")}
                  />
                )}
              </section>
            )}

            <section>
              <SectionHeader icon={Zap} label="Hoje" />
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Usuários ativos"
                  value={analytics?.dau_hoje ?? 0}
                  sub={newActiveSub}
                  icon={Zap}
                  accent="text-amber-400"
                />
                <StatCard
                  label="Cadastros"
                  value={analytics?.usuarios_hoje ?? 0}
                  icon={UserPlus}
                  accent="text-emerald-400"
                />
                <StatCard label="Sessões" value={analytics?.total_sessoes_hoje ?? 0} icon={Monitor} />
                <StatCard
                  label="Tempo de uso"
                  value={analytics ? `${analytics.total_horas_hoje}h` : "—"}
                  icon={Clock}
                  accent="text-sky-400"
                />
              </div>
              {analytics && analytics.dau_7d.length > 0 && (
                <div className="mt-3 rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground mb-2">Usuários ativos por dia — últimos 7 dias</p>
                  <MiniBar days={analytics.dau_7d} valueKey="usuarios_ativos" />
                </div>
              )}
            </section>

            <section>
              <SectionHeader icon={FileText} label="Conteúdo de hoje" />
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="Posts" value={analytics?.posts_hoje ?? stats?.postsHoje ?? 0} icon={FileText} />
                <StatCard label="Shots" value={analytics?.shots_hoje ?? stats?.shotsHoje ?? 0} icon={Video} />
                <StatCard label="Comentários" value={analytics?.comments_hoje ?? 0} icon={MessageCircle} />
                <StatCard label="Curtidas" value={analytics?.likes_hoje ?? 0} icon={Heart} accent="text-rose-400" />
                <StatCard
                  label="Check-ins"
                  value={analytics?.check_ins_hoje ?? 0}
                  icon={Dumbbell}
                  accent="text-emerald-400"
                  className="col-span-2"
                />
              </div>
            </section>

            <section>
              <SectionHeader icon={Users} label="Base de usuários" />
              <div className="grid grid-cols-2 gap-3">
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
                  label="Banidos"
                  value={analytics?.usuarios_banidos ?? 0}
                  icon={Ban}
                  accent="text-rose-400"
                />
              </div>
              {analytics && analytics.novos_usuarios_7d.length > 0 && (
                <div className="mt-3 rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground mb-2">Novos cadastros — últimos 7 dias</p>
                  <MiniBar days={analytics.novos_usuarios_7d} valueKey="total" />
                </div>
              )}
            </section>

            {analytics && (
              <section>
                <SectionHeader icon={Activity} label="Engajamento e retenção" />
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="WAU (7 dias)" value={analytics.wau} icon={CalendarDays} accent="text-blue-400" />
                  <StatCard label="MAU (30 dias)" value={analytics.mau} icon={CalendarRange} accent="text-purple-400" />
                  <StatCard
                    label="Stickiness"
                    value={`${analytics.stickiness}%`}
                    sub="DAU / MAU"
                    icon={Sparkles}
                    accent="text-amber-400"
                  />
                  <StatCard
                    label="Duração média"
                    value={formatSeconds(analytics.avg_sessao_segundos_7d)}
                    sub="por sessão · 7 dias"
                    icon={Clock}
                    accent="text-sky-400"
                  />
                  <StatCard
                    label="Retenção D1"
                    value={`${analytics.retencao_d1}%`}
                    sub="cohort 14 dias"
                    icon={Target}
                    accent="text-emerald-400"
                  />
                  <StatCard
                    label="Retenção D7"
                    value={`${analytics.retencao_d7}%`}
                    sub="cohort 30 dias"
                    icon={Repeat}
                    accent="text-sky-400"
                  />
                </div>
              </section>
            )}

            {analytics && (
              <section>
                <SectionHeader icon={BarChart3} label="Totais gerais" />
                <div className="grid grid-cols-3 gap-3">
                  <StatCard label="Posts" value={analytics.total_posts} icon={FileText} />
                  <StatCard label="Shots" value={analytics.total_shots} icon={Video} />
                  <StatCard label="Check-ins" value={analytics.total_check_ins} icon={Dumbbell} />
                </div>
              </section>
            )}

            {analytics && (
              <section>
                <SectionHeader icon={Monitor} label="Telas mais acessadas (7 dias)" />
                <div className="rounded-xl border border-border bg-card p-4">
                  <TopScreensList screens={analytics.top_screens} />
                </div>
              </section>
            )}
          </div>
        )}

        {/* ══ Atividade ═════════════════════════════════════════════════════ */}
        {tab === "atividade" && (
          <div className="space-y-8">
            <section>
              <SectionHeader icon={TrendingUp} label="Mais ativos hoje" />
              <ActiveUsersRanking users={activeUsers} />
            </section>

            <section>
              <SectionHeader icon={Activity} label="Quem entrou hoje" count={todayActivity.length} />
              {todayActivity.length === 0 ? (
                <EmptyState icon={Activity} text="Ninguém entrou no app hoje ainda" />
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

            {analytics && analytics.top_seguidos.length > 0 && (
              <section>
                <SectionHeader icon={Star} label="Mais seguidos" />
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  {analytics.top_seguidos.map((u, i) => (
                    <button
                      type="button"
                      key={u.user_id}
                      onClick={() => navigate(`/usuario/${u.user_id}`)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-muted/40 transition-colors ${
                        i < analytics.top_seguidos.length - 1 ? "border-b border-border/50" : ""
                      }`}
                    >
                      <span className="text-xs text-muted-foreground font-mono w-6 text-center shrink-0">
                        {i + 1}
                      </span>
                      <UserAvatar photo={u.photo} name={u.nickname} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{u.nickname}</p>
                        {u.handle && <p className="text-xs text-muted-foreground truncate">@{u.handle}</p>}
                      </div>
                      <span className="text-xs font-semibold text-primary shrink-0">
                        {u.followers} {u.followers === 1 ? "seguidor" : "seguidores"}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ══ Denúncias ═════════════════════════════════════════════════════ */}
        {tab === "denuncias" && (
          <section>
            <SectionHeader icon={Flag} label="Fila de moderação" count={complaints.length} alert />
            {complaints.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                accent="text-emerald-400"
                text="Nenhuma denúncia pendente"
                hint="Denúncias de posts, shots, flows e perfis aparecem aqui."
              />
            ) : (
              <div className="space-y-3">
                {complaints.map((c) => (
                  <ComplaintRow key={`${c.tipo}-${c.id}`} complaint={c} onAction={openAction} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ══ Banidos ═══════════════════════════════════════════════════════ */}
        {tab === "banidos" && (
          <section className="space-y-4">
            <SectionHeader icon={Ban} accent="text-rose-400" label="Usuários banidos" count={bannedUsers.length} />

            {bannedError ? (
              <EmptyState icon={AlertTriangle} accent="text-amber-400" text="Não foi possível carregar a lista" hint={bannedError} />
            ) : bannedUsers.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                accent="text-emerald-400"
                text="Nenhum usuário banido"
                hint="Quem for banido pela fila de denúncias aparece aqui."
              />
            ) : (
              <div className="space-y-2">
                {bannedUsers.map((u) => (
                  <div
                    key={u.userId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/usuario/${u.userId}`)}
                      className="flex items-center gap-2.5 min-w-0 text-left"
                    >
                      <UserAvatar photo={u.photo} name={u.nickname} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{u.nickname || "—"}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {u.handle ? `@${u.handle}` : ""}
                          {u.handle && u.bannedAt ? " · " : ""}
                          {u.bannedAt ? `banido em ${formatDate(u.bannedAt)}` : ""}
                        </p>
                      </div>
                    </button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setUnbanTarget(u)}
                      className="h-9 px-3 text-xs shrink-0 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                    >
                      Desbanir
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Desbanir limpa as duas travas (o flag do perfil e o bloqueio de login no auth). A pessoa
              precisa entrar de novo — a sessão foi encerrada no ban. O conteúdo removido não volta.
            </p>
          </section>
        )}

        {/* ══ Selos ═════════════════════════════════════════════════════════ */}
        {tab === "selos" && (
          <section className="space-y-4">
            <SectionHeader icon={BadgeCheck} accent="text-yellow-500" label="Contas verificadas" count={verifiedAccounts.length} />

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Dar selo</p>
              {/* Nível aplicado ao verificar */}
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Nível do selo">
                {([
                  { tier: "notable" as const, title: "Verificado", hint: "Usuário importante" },
                  { tier: "official" as const, title: "Oficial", hint: "Equipe LinKa · vira admin" },
                ]).map((opt) => (
                  <button
                    key={opt.tier}
                    type="button"
                    role="radio"
                    aria-checked={verifyTier === opt.tier}
                    onClick={() => setVerifyTier(opt.tier)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                      verifyTier === opt.tier ? "border-brand bg-brand/10" : "border-border/40 bg-muted/20"
                    }`}
                  >
                    <VerifiedBadge size="md" tier={opt.tier} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{opt.title}</span>
                      <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>
                    </span>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="@handle do usuário"
                    value={verifyHandle}
                    onChange={(e) => setVerifyHandle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyByHandle()}
                    className="pl-9 h-10 text-sm"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleVerifyByHandle}
                  disabled={verifyingHandle || !verifyHandle.trim()}
                  className="h-10 px-4 text-xs bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
                >
                  {verifyingHandle ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Verificar"}
                </Button>
              </div>
            </div>

            {verifiedAccounts.length === 0 ? (
              <EmptyState icon={BadgeCheck} text="Nenhuma conta verificada ainda" />
            ) : (
              <div className="space-y-2">
                {verifiedAccounts.map((acc) => (
                  <div
                    key={acc.userId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar photo={acc.photo} name={acc.nickname} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-medium truncate">{acc.nickname}</span>
                          <VerifiedBadge size="sm" tier={acc.tier} />
                        </div>
                        {acc.handle && <p className="text-xs text-muted-foreground truncate">@{acc.handle}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleVerifiedTier(acc)}
                        className="h-9 px-2.5 text-[11px]"
                      >
                        {acc.tier === "official" ? "Tornar verificado" : "Tornar oficial"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveVerified(acc.userId, acc.nickname)}
                        className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        aria-label={`Remover selo de ${acc.nickname}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <strong>Verificado</strong> (azul) marca contas importantes. <strong>Oficial</strong> (dourado)
              é da equipe LinKa e também libera este painel.
            </p>
          </section>
        )}

        {/* ══ Cortesia ══════════════════════════════════════════════════════ */}
        {tab === "cortesia" && (
          <section className="space-y-4">
            <SectionHeader icon={Crown} accent="text-amber-500" label="Acesso cortesia" count={activePremiumCount} />

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Conceder acesso</p>
              {/* Duração da concessão */}
              <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Duração">
                {PREMIUM_DURATIONS.map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    role="radio"
                    aria-checked={premiumDays === d.days}
                    onClick={() => setPremiumDays(d.days)}
                    className={`flex-1 h-10 rounded-lg border text-xs font-medium transition-colors ${
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="@handle ou nome do usuário"
                  value={premiumQuery}
                  onChange={(e) => setPremiumQuery(e.target.value)}
                  className="pl-9 pr-10 h-10 text-sm"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                {premiumQuery && (
                  <button
                    type="button"
                    onClick={() => setPremiumQuery("")}
                    className="absolute right-0 top-0 h-10 w-10 flex items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X className="w-4 h-4" />
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
                            <UserAvatar photo={u.photo} name={u.nickname} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{u.nickname}</p>
                              {u.handle && <p className="text-xs text-muted-foreground truncate">@{u.handle}</p>}
                            </div>
                          </div>
                          {alreadyActive ? (
                            <span className="text-xs text-amber-500 font-medium shrink-0 flex items-center gap-1">
                              <Crown className="w-3.5 h-3.5" />
                              Já tem acesso
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleSetPremium(u, true)}
                              disabled={premiumActingId === u.userId}
                              className="h-9 px-3 text-xs bg-amber-500 hover:bg-amber-400 text-black font-semibold shrink-0 gap-1"
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
            </div>

            {/* Contas com acesso concedido */}
            {premiumUsers.length === 0 ? (
              <EmptyState icon={Crown} text="Nenhuma conta com acesso concedido" />
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
                      <UserAvatar photo={u.photo} name={u.nickname} />
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
                        aria-label={`Revogar cortesia de ${u.nickname || "usuário"}`}
                        className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        {premiumActingId === u.userId ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetPremium(u, true)}
                        disabled={premiumActingId === u.userId}
                        className="h-9 px-2.5 text-xs shrink-0 border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
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
        )}

        {/* ══ Anatomia ══════════════════════════════════════════════════════ */}
        {tab === "anatomia" && (
          !anatomy ? (
            <EmptyState icon={PersonStanding} text="Não foi possível carregar a anatomia dos exercícios" />
          ) : (() => {
            // Duas listas com pesos diferentes: alongamento/mobilidade nunca teve
            // anatomia (o seed pula de propósito), então só o outro bloco é fila
            // de trabalho de verdade.
            const pending = anatomy.gaps.filter((g) => !g.isStretch);
            const stretches = anatomy.gaps.filter((g) => g.isStretch);
            const pct = anatomy.total > 0 ? Math.round((anatomy.mapped / anatomy.total) * 100) : 0;

            return (
              <section className="space-y-4">
                <SectionHeader
                  icon={PersonStanding}
                  accent="text-orange-500"
                  label="Anatomia dos exercícios"
                  count={pending.length}
                  alert
                />

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
                  <EmptyState
                    icon={CheckCircle}
                    accent="text-emerald-400"
                    text="Todo exercício de força tem anatomia mapeada"
                  />
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
                      aria-expanded={showStretchGaps}
                      className="flex items-center gap-1.5 min-h-[40px] text-xs text-muted-foreground hover:text-foreground"
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
          })()
        )}
      </main>
      {/* Confirmar desbanir */}
      <AlertDialog
        open={!!unbanTarget}
        onOpenChange={(open) => { if (!open && !unbanning) setUnbanTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              Desbanir {unbanTarget?.nickname || "usuário"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A conta volta a conseguir entrar no app. Posts e flows removidos pela moderação não são restaurados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unbanning}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                // Fica aberto até a RPC responder: fechar antes esconderia o erro.
                e.preventDefault();
                void handleUnban();
              }}
              disabled={unbanning}
            >
              {unbanning ? "Desbanindo…" : "Desbanir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          {/* Remoção avisa o autor (type 22) com o motivo escolhido aqui. */}
          {(pendingAction?.type === "delete" || pendingAction?.type === "delete_and_ban") && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Motivo — o autor recebe um aviso com ele
              </p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Motivo da remoção">
                {MODERATION_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={removalReason === r}
                    disabled={acting}
                    onClick={() => setRemovalReason(r)}
                    className={`h-9 px-3 rounded-full border text-xs font-medium transition-colors ${
                      removalReason === r
                        ? "border-destructive/60 bg-destructive/15 text-destructive"
                        : "border-border bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {REMOVAL_REASON_LABEL[r]}
                  </button>
                ))}
              </div>
            </div>
          )}
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
