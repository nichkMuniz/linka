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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/shared/animated-loading";
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
  adminDismissComplaintDb,
  adminDeleteContentDb,
  adminBanUserDb,
  type AdminComplaint,
  type AdminStats,
} from "@/lib/ritmofit-db";

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

/** Retorna a rota interna para visualizar o conteúdo denunciado, ou null se não houver rota direta. */
function contentRoute(complaint: AdminComplaint): string | null {
  if (complaint.tipo === "post") return `/post/${complaint.conteudo_id}`;
  if (complaint.tipo === "shot") return `/shots`; // sem deep-link por shot
  if (complaint.tipo === "flow") return `/`;       // flows aparecem no feed
  if (complaint.tipo === "usuario") return `/usuario/${complaint.conteudo_id}`;
  return null;
}

/** Retorna o user_id do autor do conteúdo (ou do usuário denunciado). */
function authorId(complaint: AdminComplaint): string | null {
  // para denúncias de usuário o autor é o próprio conteudo_id
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
  icon: Icon,
  className = "",
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
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
      {/* Header: tipo + data */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tipoBadgeClass(complaint.tipo)}`}
        >
          {tipoLabel(complaint.tipo)}
        </span>
        <span className="text-xs text-muted-foreground">{formatDate(complaint.created_at)}</span>
      </div>

      {/* Motivo */}
      {complaint.reason ? (
        <p className="text-sm text-foreground bg-muted/40 rounded-lg px-3 py-2 border border-border">
          "{complaint.reason}"
        </p>
      ) : (
        <p className="text-xs text-muted-foreground italic">Sem motivo informado</p>
      )}

      {/* IDs */}
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

      {/* Navegação: ver conteúdo + ver perfil do autor */}
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

      {/* Separador */}
      <div className="border-t border-border" />

      {/* Ações de moderação */}
      <div className="flex flex-col gap-2">
        {/* Ignorar — sempre disponível */}
        <Button
          size="sm"
          variant="outline"
          className="w-full text-xs h-8 gap-1.5"
          onClick={() => onAction({ type: "dismiss", complaint })}
        >
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          Ignorar denúncia
        </Button>

        {/* Remover conteúdo — só para post / shot / flow */}
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

        {/* Banir autor — disponível para qualquer tipo */}
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

        {/* Remover conteúdo + banir — ação combinada para post/shot/flow */}
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

// ─── confirm dialog content ───────────────────────────────────────────────────

function confirmTexts(action: PendingAction | null) {
  if (!action) return { title: "", desc: "", label: "" };
  const tipo = tipoLabel(action.complaint.tipo).toLowerCase();
  switch (action.type) {
    case "dismiss":
      return {
        title: "Ignorar denúncia?",
        desc: "A denúncia será descartada sem nenhuma ação sobre o conteúdo.",
        label: "Ignorar",
      };
    case "delete":
      return {
        title: `Remover ${tipo}?`,
        desc: `O ${tipo} será permanentemente removido do app. Esta ação não pode ser desfeita.`,
        label: "Remover",
      };
    case "ban":
      return {
        title: "Banir usuário?",
        desc: "O usuário será marcado como banido e não poderá mais usar o app.",
        label: "Banir",
      };
    case "delete_and_ban":
      return {
        title: "Remover conteúdo e banir usuário?",
        desc: `O ${tipo} será removido permanentemente e o autor será banido do app. Esta ação não pode ser desfeita.`,
        label: "Remover e banir",
      };
  }
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function Admin() {
  const [complaints, setComplaints] = React.useState<AdminComplaint[]>([]);
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);
  const [acting, setActing] = React.useState(false);

  const load = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [c, s] = await Promise.all([getAdminComplaintsDb(), getAdminStatsDb()]);
      setComplaints(c);
      setStats(s);
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
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Usuários total" value={stats.totalUsers} icon={Users} />
          <StatCard
            label="Denúncias abertas"
            value={stats.complaintsTotal}
            icon={Flag}
            className={stats.complaintsTotal > 0 ? "border-rose-500/40" : ""}
          />
          <StatCard label="Posts hoje" value={stats.postsHoje} icon={FileText} />
          <StatCard label="Shots hoje" value={stats.shotsHoje} icon={Video} />
        </div>
      )}

      {/* Moderation queue */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Flag className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Fila de Moderação</h2>
          {complaints.length > 0 && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0">
              {complaints.length}
            </Badge>
          )}
        </div>

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
      </div>

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
              className={
                isDestructive ? "bg-destructive hover:bg-destructive/90" : ""
              }
            >
              {acting ? "Processando…" : label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
