import * as React from "react";
import { CheckCircle, ChevronDown, Dumbbell, EyeOff, Link2, Sparkles, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageWithFallback } from "@/components/shared/image-with-fallback";
import { toast } from "@/components/ui/use-toast";
import { reportHandledError } from "@/lib/monitoring";
import {
  adminPromoteCustomWorkoutsDb,
  adminSetCustomWorkoutIgnoredDb,
  normalizeExerciseName,
  type AdminCatalogWorkout,
  type AdminCustomWorkoutGroup,
  type AdminCustomWorkouts,
} from "@/lib/ritmofit-db";

/**
 * Aba "Exercícios" do Admin (2026-10-05) — exercícios criados pelos usuários,
 * agrupados por nome, para decidir o que vira catálogo. Ver docs/18-admin.md.
 * Ferramenta interna: textos em PT direto (o painel não é traduzido).
 */

type View = "pending" | "ignored" | "resolved";

function formatDay(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** "supino com HALTER" → "Supino com Halter" (preposições ficam minúsculas). */
function titleCase(name: string): string {
  const small = new Set(["com", "de", "da", "do", "das", "dos", "na", "no", "em", "e", "a", "o"]);
  return name
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function MergeCheckbox({
  checked,
  onChange,
  group,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  group: AdminCustomWorkoutGroup;
}) {
  return (
    <label className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
      />
      <span>
        Trocar a cópia de {group.userCount} {group.userCount === 1 ? "usuário" : "usuários"} pela oficial
        <span className="block text-xs text-muted-foreground mt-0.5">
          Rotinas e histórico passam a usar o exercício do catálogo (recordes e gráficos continuam) e a cópia
          pessoal é apagada. Desmarcado, cada um mantém a sua.
        </span>
      </span>
    </label>
  );
}

function GroupCard({
  group,
  view,
  busy,
  onPromote,
  onLink,
  onIgnore,
  onUnignore,
  onMergeIntoResolved,
}: {
  group: AdminCustomWorkoutGroup;
  view: View;
  busy: boolean;
  onPromote: () => void;
  onLink: () => void;
  onIgnore: () => void;
  onUnignore: () => void;
  onMergeIntoResolved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const photo = group.items.find((i) => i.photo)?.photo ?? null;

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
          {photo ? (
            <ImageWithFallback src={photo} alt={group.name} thumbSize={48} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Dumbbell className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{group.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant={group.userCount > 1 ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
              {group.userCount} {group.userCount === 1 ? "usuário" : "usuários"}
            </Badge>
            <span>{group.muscleGroup || "sem grupo"}</span>
            <span>· último em {formatDay(group.latestAt)}</span>
          </div>
        </div>
      </div>

      {view === "pending" && group.matches.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs">
          <p className="font-medium text-amber-300">Parecido no catálogo:</p>
          <ul className="mt-1 space-y-0.5 text-foreground/85">
            {group.matches.map((m) => (
              <li key={m.id}>
                {m.name}
                {m.nameEng ? <span className="text-muted-foreground"> · {m.nameEng}</span> : null}
                <span className="text-muted-foreground"> ({Math.round(m.score * 100)}%)</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {view === "resolved" && group.review && (
        <p className="text-xs text-muted-foreground">
          {group.review.decision === "promoted" ? "Tornado oficial" : "Vinculado ao catálogo"} em{" "}
          {formatDay(group.review.reviewedAt)} — estas cópias foram criadas depois ou ficaram de fora.
        </p>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[36px] items-center gap-1 text-xs font-medium text-muted-foreground"
        aria-expanded={open}
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Esconder" : "Ver"} {group.items.length === 1 ? "a criação" : `as ${group.items.length} criações`}
      </button>
      {open && (
        <ul className="space-y-2">
          {group.items.map((i) => (
            <li key={i.id} className="rounded-lg bg-muted/30 px-3 py-2 text-xs">
              <p>
                <span className="font-medium text-foreground">{i.nickname}</span>
                <span className="text-muted-foreground"> · “{i.name}” · {i.muscleGroup || "sem grupo"} · {formatDay(i.createdAt)}</span>
              </p>
              {i.description && <p className="mt-1 text-muted-foreground line-clamp-3">{i.description}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {view === "pending" && (
          <>
            <Button size="sm" className="h-10" disabled={busy} onClick={onPromote}>
              <Sparkles className="mr-1.5 h-4 w-4" />
              Tornar oficial
            </Button>
            <Button size="sm" variant="outline" className="h-10" disabled={busy} onClick={onLink}>
              <Link2 className="mr-1.5 h-4 w-4" />
              Já existe
            </Button>
            <Button size="sm" variant="ghost" className="h-10 text-muted-foreground" disabled={busy} onClick={onIgnore}>
              <EyeOff className="mr-1.5 h-4 w-4" />
              Ignorar
            </Button>
          </>
        )}
        {view === "ignored" && (
          <Button size="sm" variant="outline" className="h-10" disabled={busy} onClick={onUnignore}>
            <Undo2 className="mr-1.5 h-4 w-4" />
            Voltar para a fila
          </Button>
        )}
        {view === "resolved" && group.review?.workoutId && (
          <Button size="sm" variant="outline" className="h-10" disabled={busy} onClick={onMergeIntoResolved}>
            <Link2 className="mr-1.5 h-4 w-4" />
            Trocar estas cópias pela oficial
          </Button>
        )}
      </div>
    </div>
  );
}

export function CustomExercisesPanel({
  data,
  onChanged,
}: {
  data: AdminCustomWorkouts | null;
  onChanged: () => Promise<void> | void;
}) {
  const [view, setView] = React.useState<View>("pending");
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  // Formulário "Tornar oficial"
  const [promoteGroup, setPromoteGroup] = React.useState<AdminCustomWorkoutGroup | null>(null);
  const [form, setForm] = React.useState({ name: "", nameEng: "", muscleGroup: "", description: "", descriptionEng: "" });
  const [merge, setMerge] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Diálogo "Já existe"
  const [linkGroup, setLinkGroup] = React.useState<AdminCustomWorkoutGroup | null>(null);
  const [linkTarget, setLinkTarget] = React.useState<string | null>(null);
  const [linkQuery, setLinkQuery] = React.useState("");

  if (!data) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Não foi possível carregar os exercícios criados pelos usuários
      </div>
    );
  }

  const pending = data.groups.filter((g) => !g.review);
  const ignored = data.groups.filter((g) => g.review?.decision === "ignored");
  const resolved = data.groups.filter((g) => g.review && g.review.decision !== "ignored");
  const visible = view === "pending" ? pending : view === "ignored" ? ignored : resolved;

  const openPromote = (g: AdminCustomWorkoutGroup) => {
    setPromoteGroup(g);
    setForm({
      name: titleCase(g.name),
      nameEng: "",
      muscleGroup: g.muscleGroup ?? "",
      description: g.description,
      descriptionEng: "",
    });
    setMerge(true);
  };

  const openLink = (g: AdminCustomWorkoutGroup) => {
    setLinkGroup(g);
    setLinkTarget(g.matches[0]?.id ?? null);
    setLinkQuery("");
    setMerge(true);
  };

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await fn();
      await onChanged();
    } finally {
      setBusyKey(null);
    }
  };

  const handlePromote = async () => {
    if (!promoteGroup || saving || !form.name.trim()) return;
    setSaving(true);
    try {
      const res = await adminPromoteCustomWorkoutsDb({
        customIds: promoteGroup.items.map((i) => i.id),
        nameKey: promoteGroup.key,
        name: form.name.trim(),
        nameEng: form.nameEng.trim(),
        description: form.description.trim(),
        descriptionEng: form.descriptionEng.trim(),
        muscleGroup: form.muscleGroup || null,
        merge,
      });
      toast({
        title: `"${form.name.trim()}" entrou no catálogo`,
        description: `${merge ? `${res.merged} cópia(s) trocada(s), ${res.remapped} registro(s) atualizados. ` : ""}Falta a anatomia e a imagem — veja as abas Anatomia e Imagens.`,
      });
      setPromoteGroup(null);
      await onChanged();
    } catch (err: any) {
      reportHandledError(err, "admin:promote-custom-workout");
      toast({ title: "Erro ao tornar oficial", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLink = async () => {
    if (!linkGroup || !linkTarget || saving) return;
    setSaving(true);
    try {
      const res = await adminPromoteCustomWorkoutsDb({
        customIds: linkGroup.items.map((i) => i.id),
        nameKey: linkGroup.key,
        targetId: linkTarget,
        merge,
      });
      const target = data.catalog.find((w) => w.id === linkTarget);
      toast({
        title: `Vinculado a "${target?.name ?? "exercício do catálogo"}"`,
        description: merge ? `${res.merged} cópia(s) trocada(s), ${res.remapped} registro(s) atualizados.` : "As cópias dos usuários foram mantidas.",
      });
      setLinkGroup(null);
      await onChanged();
    } catch (err: any) {
      reportHandledError(err, "admin:link-custom-workout");
      toast({ title: "Erro ao vincular", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleIgnore = (g: AdminCustomWorkoutGroup, ignoredNow: boolean) =>
    run(g.key, async () => {
      try {
        await adminSetCustomWorkoutIgnoredDb(g.key, ignoredNow);
        toast({ title: ignoredNow ? `"${g.name}" ignorado` : `"${g.name}" voltou para a fila` });
      } catch (err: any) {
        reportHandledError(err, "admin:ignore-custom-workout");
        toast({ title: "Erro", description: err.message, variant: "destructive" });
      }
    });

  const handleMergeIntoResolved = (g: AdminCustomWorkoutGroup) =>
    run(g.key, async () => {
      try {
        const res = await adminPromoteCustomWorkoutsDb({
          customIds: g.items.map((i) => i.id),
          nameKey: g.key,
          targetId: g.review!.workoutId,
          merge: true,
        });
        toast({ title: "Cópias trocadas pela oficial", description: `${res.merged} cópia(s), ${res.remapped} registro(s).` });
      } catch (err: any) {
        reportHandledError(err, "admin:merge-custom-workout");
        toast({ title: "Erro", description: err.message, variant: "destructive" });
      }
    });

  // Catálogo filtrado do diálogo "Já existe": sugestões primeiro, depois a busca.
  const linkOptions: AdminCatalogWorkout[] = (() => {
    if (!linkGroup) return [];
    const q = normalizeExerciseName(linkQuery);
    if (!q) {
      return linkGroup.matches
        .map((m) => data.catalog.find((w) => w.id === m.id))
        .filter((w): w is AdminCatalogWorkout => !!w);
    }
    return data.catalog
      .filter((w) => normalizeExerciseName(`${w.name} ${w.nameEng ?? ""}`).includes(q))
      .slice(0, 12);
  })();

  const viewChips: Array<{ id: View; label: string; count: number }> = [
    { id: "pending", label: "Pendentes", count: pending.length },
    { id: "ignored", label: "Ignorados", count: ignored.length },
    { id: "resolved", label: "Resolvidos", count: resolved.length },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Dumbbell className="h-4 w-4 text-violet-400" />
        <h2 className="text-sm font-semibold text-foreground">Exercícios criados pelos usuários</h2>
        {pending.length > 0 && <Badge variant="destructive" className="text-xs px-1.5 py-0">{pending.length}</Badge>}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Agrupados pelo nome (sem acento e maiúsculas). Quanto mais usuários criaram o mesmo exercício, mais forte o
        sinal de que faltou no catálogo. <b>Tornar oficial</b> cria o exercício para todos; <b>Já existe</b> liga ao
        exercício do catálogo com outro nome; <b>Ignorar</b> = é específico de quem criou.
      </p>

      {!data.reviewsAvailable && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
          Rode a migração <span className="font-mono">20261005-admin-custom-workouts.sql</span> no Supabase — sem ela as
          ações desta aba falham.
        </div>
      )}

      <div className="flex gap-2" role="tablist" aria-label="Filtro">
        {viewChips.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={view === c.id}
            onClick={() => setView(c.id)}
            className={`h-9 rounded-full border px-3 text-xs font-medium transition-colors ${
              view === c.id ? "border-foreground bg-foreground text-background" : "border-border bg-muted/30 text-muted-foreground"
            }`}
          >
            {c.label} {c.count > 0 ? `· ${c.count}` : ""}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
          <p className="text-sm text-muted-foreground">
            {view === "pending" ? "Nenhum exercício novo para revisar" : view === "ignored" ? "Nenhum exercício ignorado" : "Nada resolvido com cópias pendentes"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((g) => (
            <GroupCard
              key={g.key}
              group={g}
              view={view}
              busy={busyKey === g.key}
              onPromote={() => openPromote(g)}
              onLink={() => openLink(g)}
              onIgnore={() => void handleIgnore(g, true)}
              onUnignore={() => void handleIgnore(g, false)}
              onMergeIntoResolved={() => void handleMergeIntoResolved(g)}
            />
          ))}
        </div>
      )}

      {/* ── Tornar oficial ── */}
      <Dialog open={!!promoteGroup} onOpenChange={(o) => { if (!o && !saving) setPromoteGroup(null); }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tornar oficial</DialogTitle>
            <DialogDescription>
              Entra no catálogo e aparece para todos os usuários. Revise o nome como ele deve aparecer no app.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Nome (PT) *</span>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Nome (EN)</span>
              <Input
                value={form.nameEng}
                placeholder="Ex.: Incline Dumbbell Press"
                onChange={(e) => setForm((f) => ({ ...f, nameEng: e.target.value }))}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Grupo muscular</span>
              <select
                value={form.muscleGroup}
                onChange={(e) => setForm((f) => ({ ...f, muscleGroup: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Sem grupo</option>
                {data.muscleGroups.map((g) => <option key={g} value={g}>{g}</option>)}
                {form.muscleGroup && !data.muscleGroups.includes(form.muscleGroup) && (
                  <option value={form.muscleGroup}>{form.muscleGroup}</option>
                )}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Como executar (PT)</span>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Como executar (EN)</span>
              <Textarea rows={3} value={form.descriptionEng} onChange={(e) => setForm((f) => ({ ...f, descriptionEng: e.target.value }))} />
            </label>
            {promoteGroup && <MergeCheckbox checked={merge} onChange={setMerge} group={promoteGroup} />}
            <p className="text-[11px] text-muted-foreground">
              A foto dos usuários não é copiada: o exercício entra na fila da aba Imagens para ganhar o render no
              padrão do catálogo, e na aba Anatomia para mapear os músculos.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" disabled={saving} onClick={() => setPromoteGroup(null)}>Cancelar</Button>
            <Button disabled={saving || !form.name.trim()} onClick={handlePromote}>
              {saving ? "Salvando…" : "Tornar oficial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Já existe no catálogo ── */}
      <Dialog open={!!linkGroup} onOpenChange={(o) => { if (!o && !saving) setLinkGroup(null); }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Já existe no catálogo</DialogTitle>
            <DialogDescription>
              Escolha o exercício do catálogo que é o mesmo que “{linkGroup?.name}”.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={linkQuery} placeholder="Buscar no catálogo" onChange={(e) => setLinkQuery(e.target.value)} />
            <div className="max-h-64 space-y-1.5 overflow-y-auto" role="radiogroup" aria-label="Exercício do catálogo">
              {linkOptions.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  {linkQuery ? "Nada encontrado" : "Sem sugestões — busque pelo nome"}
                </p>
              ) : (
                linkOptions.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    role="radio"
                    aria-checked={linkTarget === w.id}
                    onClick={() => setLinkTarget(w.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      linkTarget === w.id ? "border-primary bg-primary/10" : "border-border bg-muted/20"
                    }`}
                  >
                    <span className="font-medium">{w.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[w.nameEng, w.muscleGroup].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                ))
              )}
            </div>
            {linkGroup && <MergeCheckbox checked={merge} onChange={setMerge} group={linkGroup} />}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" disabled={saving} onClick={() => setLinkGroup(null)}>Cancelar</Button>
            <Button disabled={saving || !linkTarget} onClick={handleLink}>
              {saving ? "Salvando…" : "Vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
