import * as React from "react";
import { Check, Search, UserPlus, Users } from "lucide-react";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/shared/user-avatar";
import { useLanguage } from "@/lib/language-context";
import { useKeyboardAwareHeight } from "@/hooks/use-keyboard-aware-height";
import {
  GLASS_SHEET_STYLE,
  GLASS_SHEET_PROPS,
  GLASS_FIELD_STYLE,
  GLASS_FIELD_CLASS,
  GLASS_PRIMARY_BTN_STYLE,
} from "@/lib/glass-styles";
import { getFollowersDb, searchUsersDb, type SearchUser } from "@/lib/ritmofit-db";

interface WorkoutPartyDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Nome da rotina que será treinada — cabeçalho do drawer. */
  routineName: string;
  /** Quantidade de exercícios, para o subtítulo. */
  exerciseCount: number;
  /**
   * `start` = ainda não começou (CTA "Convidar e iniciar", e fechar sem
   * selecionar ninguém inicia o treino sozinho).
   * `add` = sessão em andamento, chamando mais gente (CTA "Convidar").
   */
  mode: "start" | "add";
  /** Ids já na party — ficam marcados e travados (não dá para reconvidar). */
  alreadyInvitedIds?: string[];
  /** Recebe TODOS os selecionados de uma vez. Sem limite de quantos. */
  onConfirm: (userIds: string[]) => Promise<void> | void;
  /** Só no modo `start`: seguir sem convidar ninguém. */
  onSkip?: () => void;
  /**
   * Classe do **lift wrapper** do portal — o único jeito de elevar o drawer
   * acima de um overlay de z alto (ver `DrawerContent` em `ui/drawer.tsx`). É o
   * que a sessão de treino usa (`position:fixed; zIndex 9999`): sem isso o
   * drawer abre no `z-[310]` do wrapper, ou seja, **atrás** da tela de treino —
   * e só o scrim invisível continua capturando os toques, o que parece a tela
   * travando.
   */
  wrapperClassName?: string;
}

/**
 * Drawer **Treinar junto** — escolhe quem vai fazer o mesmo treino agora.
 *
 * Seleção múltipla **sem teto**: treinar em grupo de 4 é tão comum quanto em
 * dupla, e um limite artificial só criaria a pergunta "por que 2?". A lista
 * padrão são os seguidores; a busca alcança qualquer pessoa do app.
 */
export function WorkoutPartyDrawer({
  open,
  onClose,
  routineName,
  exerciseCount,
  mode,
  alreadyInvitedIds = [],
  onConfirm,
  onSkip,
  wrapperClassName,
}: WorkoutPartyDrawerProps) {
  const { t } = useLanguage();
  const viewportHeight = useKeyboardAwareHeight();

  const [followers, setFollowers] = React.useState<SearchUser[]>([]);
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<SearchUser[]>([]);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const alreadyInvited = React.useMemo(
    () => new Set(alreadyInvitedIds),
    [alreadyInvitedIds],
  );

  React.useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      setSelected([]);
      return;
    }
    setLoading(true);
    getFollowersDb()
      .then(setFollowers)
      .catch(() => setFollowers([]))
      .finally(() => setLoading(false));
  }, [open]);

  // Busca fora da lista de seguidores — quem treina junto nem sempre segue de
  // volta, e obrigar a seguir antes de convidar seria uma etapa a mais na
  // porta da academia.
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = search.trim();
    if (!term) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchUsersDb(term)
        .then(setResults)
        .catch(() => setResults([]));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  /**
   * Lista exibida: durante a busca, o resultado do servidor UNIDO aos
   * seguidores que casam com o termo (o servidor pode demorar; o filtro local
   * responde na hora). Sem busca, só os seguidores.
   */
  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return followers;
    const localMatches = followers.filter((f) =>
      f.nickname.toLowerCase().includes(term),
    );
    const seen = new Set(localMatches.map((f) => f.id));
    return [...localMatches, ...results.filter((r) => !seen.has(r.id))];
  }, [search, followers, results]);

  const toggle = (id: string) => {
    if (alreadyInvited.has(id)) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleConfirm = async () => {
    if (selected.length === 0 || sending) return;
    setSending(true);
    try {
      await onConfirm(selected);
    } finally {
      setSending(false);
    }
  };

  const ctaLabel =
    mode === "start" ? t("goals_party_start_cta") : t("goals_party_add_cta");

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      noBodyStyles
      shouldScaleBackground={false}
    >
      <DrawerContent
        {...GLASS_SHEET_PROPS}
        wrapperClassName={wrapperClassName}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{ ...GLASS_SHEET_STYLE, maxHeight: `min(85dvh, ${viewportHeight - 8}px)` }}
      >
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-base font-semibold text-white flex items-center gap-2">
            <Users className="h-4 w-4 text-white/70" />
            {t("goals_party_title")}
          </DrawerTitle>
          <p className="text-[13px] text-white/50 text-left">
            {routineName ? `${routineName} · ` : ""}
            {t("goals_party_exercise_count").replace("{n}", String(exerciseCount))}
          </p>
        </DrawerHeader>

        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("goals_party_search_placeholder")}
              className={`${GLASS_FIELD_CLASS} pl-9 rounded-full h-11`}
              style={GLASS_FIELD_STYLE}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2">
          {loading && visible.length === 0 && (
            <p className="text-center text-sm text-white/40 py-8">
              {t("goals_party_loading")}
            </p>
          )}

          {!loading && visible.length === 0 && (
            <p className="text-center text-sm text-white/40 py-8">
              {search.trim()
                ? t("goals_party_no_results")
                : t("goals_party_empty")}
            </p>
          )}

          <div className="space-y-1.5">
            {visible.map((person) => {
              const isSelected = selected.includes(person.id);
              const isLocked = alreadyInvited.has(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => toggle(person.id)}
                  disabled={isLocked}
                  className="w-full flex items-center gap-3 p-2.5 rounded-2xl text-left transition-colors disabled:opacity-45"
                  style={{
                    background: isSelected
                      ? "rgba(91,140,255,.18)"
                      : "rgba(255,255,255,.05)",
                    border: `1px solid ${isSelected ? "rgba(91,140,255,.45)" : "rgba(255,255,255,.08)"}`,
                  }}
                >
                  <UserAvatar photo={person.photo} nickname={person.nickname} size="md" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-white truncate">
                      {person.nickname}
                    </span>
                    {isLocked && (
                      <span className="block text-[11px] text-white/45">
                        {t("goals_party_already_in")}
                      </span>
                    )}
                  </span>
                  <span
                    className="h-6 w-6 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      background: isSelected || isLocked
                        ? "linear-gradient(135deg,#5b8cff,#9d6bff)"
                        : "rgba(255,255,255,.08)",
                      border: isSelected || isLocked
                        ? "none"
                        : "1px solid rgba(255,255,255,.18)",
                    }}
                  >
                    {(isSelected || isLocked) && (
                      <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="px-4 pt-2 space-y-2 shrink-0"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <Button
            className="w-full rounded-full h-12 font-semibold"
            style={GLASS_PRIMARY_BTN_STYLE}
            disabled={selected.length === 0 || sending}
            onClick={handleConfirm}
          >
            <UserPlus className="h-4 w-4 mr-1.5" />
            {sending
              ? t("goals_party_sending")
              : selected.length > 0
                ? `${ctaLabel} (${selected.length})`
                : ctaLabel}
          </Button>
          {mode === "start" && onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="w-full h-10 text-[13px] font-medium text-white/55"
            >
              {t("goals_party_skip")}
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
