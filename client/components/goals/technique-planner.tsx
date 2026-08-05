import * as React from "react";
import { Check, Link2 } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import type { TranslationKey } from "@/lib/i18n";
import {
  blockSize,
  isBlockTechnique,
  type TechniqueAssignment,
  type WorkoutTechnique,
} from "@/lib/ritmofit-db";

/**
 * Planejador de técnicas de uma rotina — a tela onde o usuário diz "este
 * exercício é bi-set com aquele", "este tem drop-set".
 *
 * **Um componente para os dois fluxos** (criar rotina no wizard e editar no
 * detalhe da rotina), como manda a regra de reúso do projeto. Ele é controlado:
 * recebe a lista e o plano atual, devolve o plano novo. Quem persiste é o
 * chamador (`updateRoutineTechniquesDb`).
 *
 * O fluxo de um bloco tem dois toques de propósito: escolher a técnica e depois
 * escolher com QUEM. Pedir as duas coisas numa tela só (uma matriz de
 * pareamento) seria denso demais para um bottom sheet no celular.
 */

export type TechniquePlanItem = {
  /** `user_workouts.id` */
  id: string;
  name: string;
  muscleGroup?: string | null;
};

/** Plano em edição: id do exercício → técnica + bloco. */
export type TechniquePlan = Record<string, { technique: WorkoutTechnique; group: string | null }>;

const TECHNIQUES: Array<{
  value: WorkoutTechnique;
  labelKey: TranslationKey;
  descKey: TranslationKey;
}> = [
  { value: "straight", labelKey: "goals_technique_straight", descKey: "goals_technique_straight_desc" },
  { value: "drop", labelKey: "goals_technique_drop", descKey: "goals_technique_drop_desc" },
  { value: "rest_pause", labelKey: "goals_technique_rest_pause", descKey: "goals_technique_rest_pause_desc" },
  { value: "biset", labelKey: "goals_technique_biset", descKey: "goals_technique_biset_desc" },
  { value: "triset", labelKey: "goals_technique_triset", descKey: "goals_technique_triset_desc" },
];

export function emptyPlan(items: TechniquePlanItem[], current?: TechniquePlan): TechniquePlan {
  const plan: TechniquePlan = {};
  for (const it of items) {
    plan[it.id] = current?.[it.id] ?? { technique: "straight", group: null };
  }
  return plan;
}

/**
 * Converte o plano para o formato de gravação. `orderIndex` sai da ordem em que
 * os exercícios aparecem AQUI, com os membros de cada bloco puxados para ficar
 * adjacentes — é isso que garante A1 e A2 lado a lado na sessão de treino.
 */
export function planToAssignments(
  items: TechniquePlanItem[],
  plan: TechniquePlan,
): TechniqueAssignment[] {
  const ordered: TechniquePlanItem[] = [];
  const placed = new Set<string>();

  for (const it of items) {
    if (placed.has(it.id)) continue;
    ordered.push(it);
    placed.add(it.id);
    const group = plan[it.id]?.group;
    if (!group) continue;
    // Puxa os companheiros de bloco para logo depois deste.
    for (const other of items) {
      if (placed.has(other.id)) continue;
      if (plan[other.id]?.group === group) {
        ordered.push(other);
        placed.add(other.id);
      }
    }
  }

  return ordered.map((it, index) => ({
    userWorkoutId: it.id,
    technique: plan[it.id]?.technique ?? "straight",
    techniqueGroup: plan[it.id]?.group ?? null,
    orderIndex: index,
  }));
}

interface TechniquePlannerProps {
  items: TechniquePlanItem[];
  plan: TechniquePlan;
  onChange: (plan: TechniquePlan) => void;
}

export function TechniquePlanner({ items, plan, onChange }: TechniquePlannerProps) {
  const { t } = useLanguage();
  // Exercício com o seletor de técnica aberto.
  const [openId, setOpenId] = React.useState<string | null>(null);
  // Bloco em montagem: aguardando o usuário escolher os companheiros.
  const [pairing, setPairing] = React.useState<{ anchorId: string; technique: WorkoutTechnique } | null>(null);

  const nameById = React.useMemo(
    () => new Map(items.map((i) => [i.id, i.name])),
    [items],
  );

  /** Companheiros de bloco de um exercício (exclui ele mesmo). */
  const partnersOf = (id: string): string[] => {
    const group = plan[id]?.group;
    if (!group) return [];
    return items.filter((i) => i.id !== id && plan[i.id]?.group === group).map((i) => i.id);
  };

  const setTechnique = (id: string, technique: WorkoutTechnique) => {
    if (isBlockTechnique(technique)) {
      // Entra no modo de pareamento; o grupo só nasce quando houver par.
      setPairing({ anchorId: id, technique });
      setOpenId(null);
      return;
    }
    const next = { ...plan };
    const oldGroup = plan[id]?.group;
    next[id] = { technique, group: null };
    // Saindo de um bloco: quem ficou sozinho volta a série direta — bloco de um
    // membro só não é bloco.
    if (oldGroup) {
      const remaining = items.filter((i) => i.id !== id && next[i.id]?.group === oldGroup);
      if (remaining.length < 2) {
        for (const r of remaining) next[r.id] = { technique: "straight", group: null };
      }
    }
    onChange(next);
    setOpenId(null);
  };

  const togglePartner = (partnerId: string) => {
    if (!pairing) return;
    const { anchorId, technique } = pairing;
    const group = plan[anchorId]?.group ?? `blk_${anchorId}`;
    const next = { ...plan };
    const currentMembers = items.filter((i) => next[i.id]?.group === group).map((i) => i.id);

    if (currentMembers.includes(partnerId)) {
      next[partnerId] = { technique: "straight", group: null };
    } else {
      // Um exercício só pertence a um bloco: entrar num novo o tira do antigo.
      const max = blockSize(technique);
      const memberCount = currentMembers.length === 0 ? 1 : currentMembers.length;
      if (memberCount >= max) return;
      next[partnerId] = { technique, group };
    }
    next[anchorId] = { technique, group };
    onChange(next);

    // Bloco completo → fecha o pareamento sozinho.
    const after = items.filter((i) => next[i.id]?.group === group).length;
    if (after >= blockSize(technique)) setPairing(null);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs" style={{ color: "rgba(255,255,255,.45)" }}>
        {pairing
          ? blockSize(pairing.technique) === 3
            ? t("goals_technique_pick_partners")
            : t("goals_technique_pick_partner")
          : t("goals_technique_hint")}
      </p>

      {items.map((item) => {
        const entry = plan[item.id] ?? { technique: "straight" as WorkoutTechnique, group: null };
        const partners = partnersOf(item.id);
        const isAnchor = pairing?.anchorId === item.id;
        const selectable = !!pairing && !isAnchor;
        const inPairingBlock = !!pairing && entry.group != null && entry.group === plan[pairing.anchorId]?.group;
        const isBlock = isBlockTechnique(entry.technique) && partners.length > 0;
        const incomplete = isBlockTechnique(entry.technique) && partners.length === 0;

        const techLabel = TECHNIQUES.find((x) => x.value === entry.technique);

        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => {
                if (selectable) togglePartner(item.id);
                else if (isAnchor) setPairing(null);
                else setOpenId(openId === item.id ? null : item.id);
              }}
              className="w-full flex items-center gap-3 rounded-2xl p-3 text-left transition-all active:scale-[0.99]"
              style={
                isAnchor
                  ? { border: "1px solid #c084fc", background: "rgba(192,132,252,.14)" }
                  : inPairingBlock
                    ? { border: "1px solid rgba(192,132,252,.6)", background: "rgba(192,132,252,.08)" }
                    : incomplete
                      ? { border: "1px solid rgba(239,68,68,.4)", background: "rgba(239,68,68,.06)" }
                      : { border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }
              }
            >
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-semibold truncate" style={{ color: "#fff" }}>
                  {item.name}
                </p>
                <p className="text-xs truncate" style={{ color: "rgba(255,255,255,.5)" }}>
                  {incomplete
                    ? t("goals_technique_needs_partner")
                    : isBlock
                      ? t("goals_technique_partner_of").replace(
                          "{name}",
                          partners.map((p) => nameById.get(p) ?? "").filter(Boolean).join(" + "),
                        )
                      : techLabel
                        ? t(techLabel.labelKey)
                        : ""}
                </p>
              </div>
              {isBlock && <Link2 className="h-4 w-4 shrink-0" style={{ color: "#c084fc" }} />}
              {inPairingBlock && !isAnchor && <Check className="h-4 w-4 shrink-0" style={{ color: "#c084fc" }} />}
            </button>

            {/* Seletor de técnica do exercício */}
            {openId === item.id && !pairing && (
              <div className="mt-1.5 space-y-1 pl-2">
                {TECHNIQUES.map((tech) => {
                  const active = entry.technique === tech.value;
                  return (
                    <button
                      key={tech.value}
                      type="button"
                      onClick={() => setTechnique(item.id, tech.value)}
                      className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-all active:scale-[0.99]"
                      style={active
                        ? { border: "1px solid #5b8cff", background: "rgba(91,140,255,.12)" }
                        : { border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold" style={{ color: "#fff" }}>
                          {t(tech.labelKey)}
                        </p>
                        <p className="text-[11px]" style={{ color: "rgba(255,255,255,.45)" }}>
                          {t(tech.descKey)}
                        </p>
                      </div>
                      {active && <Check className="h-4 w-4 shrink-0" style={{ color: "#5b8cff" }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
