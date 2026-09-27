import * as React from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  getFollowingDb,
  searchMentionUsersDb,
  type SearchUser,
} from "@/lib/ritmofit-db";

const MAX_SUGGESTIONS = 5;

/** "@termo" imediatamente antes do cursor, no início do texto ou depois de espaço. */
const ACTIVE_MENTION_RE = /(^|\s)@([a-z0-9._-]{0,30})$/i;

interface MentionSuggestionsProps {
  /** Campo onde o usuário digita — o cursor é lido dele. */
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  /**
   * Chamado ao escolher alguém. Onde a marcação existe (legenda do post, flow),
   * o pai usa isto para incluir a pessoa na lista de marcados — e é a
   * marcação que dispara a notificação (types 9/16).
   */
  onPick?: (user: SearchUser) => void;
  /** Lista acima do campo (docas presas no rodapé) ou abaixo (campos no topo). */
  placement?: "above" | "below";
  className?: string;
}

/**
 * Autocomplete de menção: ao digitar "@", sugere pessoas (quem o usuário segue
 * primeiro, depois a busca global) e troca o "@termo" por "@handle ".
 *
 * O pai precisa ser `relative` — a lista é posicionada em relação a ele.
 * O campo NÃO perde o foco ao tocar numa sugestão (touchend/mousedown com
 * preventDefault): no iOS perder o foco fecharia o teclado no meio da frase.
 */
export function MentionSuggestions({
  inputRef,
  value,
  onChange,
  onPick,
  placement = "above",
  className,
}: MentionSuggestionsProps) {
  const [caret, setCaret] = React.useState<number | null>(null);
  const [dismissedAt, setDismissedAt] = React.useState<number | null>(null);
  const [following, setFollowing] = React.useState<SearchUser[] | null>(null);
  const [remote, setRemote] = React.useState<SearchUser[]>([]);

  // Cursor acompanha digitação, toque e setas — `value` sozinho não diz onde ele está.
  React.useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const sync = () => setCaret(document.activeElement === el ? el.selectionStart : null);
    const clear = () => setCaret(null);
    const events = ["input", "keyup", "click", "select", "focus"] as const;
    events.forEach((ev) => el.addEventListener(ev, sync));
    el.addEventListener("blur", clear);
    return () => {
      events.forEach((ev) => el.removeEventListener(ev, sync));
      el.removeEventListener("blur", clear);
    };
  }, [inputRef]);

  React.useEffect(() => {
    const el = inputRef.current;
    if (el && document.activeElement === el) setCaret(el.selectionStart);
  }, [value, inputRef]);

  const active = React.useMemo(() => {
    if (caret == null) return null;
    const m = value.slice(0, caret).match(ACTIVE_MENTION_RE);
    if (!m) return null;
    const term = m[2];
    const start = caret - term.length - 1;
    return start === dismissedAt ? null : { start, term: term.toLowerCase() };
  }, [value, caret, dismissedAt]);

  // Quem o usuário segue: carregado na 1ª vez que o "@" aparece (cacheado no db).
  React.useEffect(() => {
    if (!active || following) return;
    getFollowingDb().then(setFollowing).catch(() => setFollowing([]));
  }, [active, following]);

  // Busca global com debounce — alcança quem ele não segue.
  const term = active?.term ?? "";
  React.useEffect(() => {
    if (!active || !term) {
      setRemote([]);
      return;
    }
    let cancelled = false;
    const id = setTimeout(() => {
      searchMentionUsersDb(term)
        .then((r) => { if (!cancelled) setRemote(r); })
        .catch(() => { if (!cancelled) setRemote([]); });
    }, 250);
    return () => { cancelled = true; clearTimeout(id); };
  }, [term, !!active]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = React.useMemo(() => {
    if (!active) return [];
    const fromFollowing = (following ?? []).filter((u) => {
      if (!u.handle) return false;
      if (!term) return true;
      return u.handle.toLowerCase().startsWith(term) || u.nickname.toLowerCase().includes(term);
    });
    const seen = new Set<string>();
    return [...fromFollowing, ...remote]
      .filter((u) => u.handle && !seen.has(u.id) && seen.add(u.id))
      .slice(0, MAX_SUGGESTIONS);
  }, [active, following, remote, term]);

  const pick = (u: SearchUser) => {
    if (!active || caret == null || !u.handle) return;
    const insert = `@${u.handle} `;
    const next = value.slice(0, active.start) + insert + value.slice(caret);
    const pos = active.start + insert.length;
    onChange(next);
    onPick?.(u);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      try { el.setSelectionRange(pos, pos); } catch { /* tipos de input sem seleção */ }
      setCaret(pos);
    });
  };

  // Esc fecha a lista para este "@" (volta a abrir num "@" novo).
  React.useEffect(() => {
    const el = inputRef.current;
    if (!el || !active) return;
    const onKey = (e: Event) => {
      if ((e as KeyboardEvent).key === "Escape") setDismissedAt(active.start);
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [inputRef, active]);

  if (!active || suggestions.length === 0) return null;

  return (
    <div
      data-vaul-no-drag
      // Toques na lista não podem vazar para o que está atrás: no editor de texto
      // do flow um toque "fora" confirma o texto; nos viewers, avança o flow.
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={`absolute left-0 right-0 z-[80] pointer-events-auto overflow-hidden rounded-2xl ${
        placement === "above" ? "bottom-full mb-2" : "top-full mt-2"
      } ${className ?? ""}`}
      style={{
        background: "rgba(22,22,30,.97)",
        border: "1px solid rgba(255,255,255,.12)",
        boxShadow: "0 16px 36px -12px rgba(0,0,0,.7)",
      }}
    >
      {suggestions.map((u) => (
        <button
          key={u.id}
          type="button"
          className="w-full flex items-center gap-3 px-3 py-2 text-left active:bg-white/10"
          onMouseDown={(e) => e.preventDefault()}
          onTouchEnd={(e) => { e.preventDefault(); pick(u); }}
          onClick={() => pick(u)}
        >
          <UserAvatar photo={u.photo} nickname={u.nickname} className="h-8 w-8 shrink-0" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white truncate">{u.nickname}</span>
            <span className="block text-xs text-white/50 truncate">@{u.handle}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Menção escolhida numa legenda que aceita marcação → entra na lista de
 * marcados (sem duplicar e respeitando o limite do TagPeopleDrawer). Acima do
 * limite, a menção fica só no texto.
 */
export function addMentionToTagged(prev: SearchUser[], u: SearchUser, max: number): SearchUser[] {
  if (prev.some((p) => p.id === u.id) || prev.length >= max) return prev;
  return [...prev, u];
}
