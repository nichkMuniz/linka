import * as React from "react";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, X } from "lucide-react";
import { ExerciseImage } from "@/components/shared/exercise-image";
import { useLanguage } from "@/lib/language-context";
import { hapticLight, hapticSuccess } from "@/lib/haptics";

/**
 * Uma linha da tela de reordenar. Um exercício comum é uma linha; um **bloco**
 * de bi-set/tri-set é UMA linha só, com todos os membros — eles precisam ficar
 * adjacentes e na ordem A1 → A2 para o bloco continuar existindo, então mover
 * um membro sozinho quebraria a técnica que o usuário montou.
 */
export type ReorderUnit = {
  /** id estável da linha (workout_id do exercício ou a chave do bloco) */
  key: string;
  /** workout_ids na ordem final — é o que vira a ordem da sessão */
  workoutIds: string[];
  title: string;
  /** grupo muscular, rótulo do bloco… (linha secundária) */
  subtitle: string | null;
  photo: string | null;
  muscleGroup: string | null;
  /** séries concluídas / total — mostra o que já foi feito sem sair da tela */
  doneSets: number;
  totalSets: number;
};

interface WorkoutReorderOverlayProps {
  open: boolean;
  units: ReorderUnit[];
  onClose: () => void;
  /** ordem final, na sequência das linhas (chaves de {@link ReorderUnit}) */
  onSave: (orderedKeys: string[]) => void;
}

const FG = "#fff";
const MUTED_FG = "rgba(255,255,255,0.55)";
const BORDER = "rgba(255,255,255,0.12)";
const SURFACE = "rgba(255,255,255,0.10)";
const PRIMARY = "#5b8cff";
const GLASS_ROOT_BG = "linear-gradient(165deg,#1b1828 0%,#100e18 55%,#0a0910 100%)";
const GLASS_GRADIENT = "linear-gradient(135deg,#5b8cff,#9d6bff)";

/**
 * Tela de reordenar os exercícios do treino (aberta com um **toque longo** em
 * qualquer card da sessão, ou pelo menu ⋯).
 *
 * O arraste só começa pela **alça à esquerda** (`dragListener={false}` +
 * `useDragControls`): a linha inteira arrastável tomaria conta do gesto de
 * rolagem no iOS, e uma lista de 8 exercícios não cabe na tela. A alça leva
 * `touch-action: none` para o WebView não rolar a página junto do arraste.
 */
export function WorkoutReorderOverlay({
  open, units, onClose, onSave,
}: WorkoutReorderOverlayProps) {
  const { t } = useLanguage();
  const [order, setOrder] = React.useState<string[]>([]);

  // Semeia (e re-semeia) ao abrir: exercício adicionado/removido durante o
  // treino tem que aparecer aqui sem depender de fechar e abrir o app.
  React.useEffect(() => {
    if (open) setOrder(units.map((u) => u.key));
    // `units` fora das deps de propósito — só a abertura semeia, senão o
    // arraste em andamento seria desfeito a cada render do pai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const byKey = React.useMemo(
    () => new Map(units.map((u) => [u.key, u])),
    [units],
  );
  // Chaves que sobreviveram (a lista pode ter mudado enquanto a tela está aberta)
  const rows = order.filter((k) => byKey.has(k));

  if (!open) return null;

  const handleReorder = (next: string[]) => {
    setOrder(next);
    void hapticLight();
  };

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 12,
      background: GLASS_ROOT_BG, display: "flex", flexDirection: "column",
    }}>
      {/* Cabeçalho */}
      <div style={{
        flexShrink: 0,
        paddingTop: "max(48px, env(safe-area-inset-top))",
        paddingLeft: "max(16px, env(safe-area-inset-left))",
        paddingRight: "max(16px, env(safe-area-inset-right))",
        paddingBottom: 12,
        display: "flex", alignItems: "center", gap: 12,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <button
          onClick={onClose}
          aria-label={t("goals_cancel")}
          style={{
            background: SURFACE, border: "none", borderRadius: "50%",
            width: 36, height: 36, cursor: "pointer", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <X className="h-4 w-4" style={{ color: FG }} />
        </button>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 17, color: FG }}>
          {t("goals_reorder_title")}
        </span>
      </div>

      <p style={{
        flexShrink: 0, margin: 0, padding: "12px 16px 4px",
        fontSize: 12.5, lineHeight: 1.45, color: MUTED_FG,
      }}>
        {t("goals_reorder_hint")}
      </p>

      {/* Lista arrastável */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "8px 16px 24px",
      }}>
        <Reorder.Group
          as="div"
          axis="y"
          values={rows}
          onReorder={handleReorder}
          style={{ display: "flex", flexDirection: "column", gap: 8, listStyle: "none", margin: 0, padding: 0 }}
        >
          {rows.map((key, index) => (
            <ReorderRow key={key} value={key} unit={byKey.get(key)!} position={index + 1} />
          ))}
        </Reorder.Group>
      </div>

      {/* Rodapé — confirmar */}
      <div style={{
        flexShrink: 0,
        padding: "12px 16px",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <button
          onClick={() => { void hapticSuccess(); onSave(rows); }}
          style={{
            width: "100%", height: 50, borderRadius: 16, border: "none",
            background: GLASS_GRADIENT, color: "#fff",
            fontSize: 15, fontWeight: 700, cursor: "pointer",
            fontFamily: "'Inter', system-ui",
          }}
        >
          {t("goals_reorder_save")}
        </button>
      </div>
    </div>
  );
}

function ReorderRow({
  value, unit, position,
}: {
  value: string;
  unit: ReorderUnit;
  position: number;
}) {
  const { t } = useLanguage();
  const controls = useDragControls();

  return (
    <Reorder.Item
      as="div"
      value={value}
      dragListener={false}
      dragControls={controls}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 10px", borderRadius: 16,
        border: `1px solid ${BORDER}`, background: "rgba(255,255,255,.05)",
        listStyle: "none",
      }}
      whileDrag={{
        scale: 1.02,
        background: "rgba(91,140,255,.16)",
        boxShadow: "0 14px 32px rgba(0,0,0,.45)",
      }}
    >
      {/* Alça — único ponto que inicia o arraste (ver comentário do overlay) */}
      <div
        onPointerDown={(e) => { void hapticLight(); controls.start(e); }}
        aria-label={t("goals_reorder_handle")}
        style={{
          flexShrink: 0, padding: "8px 4px", cursor: "grab",
          touchAction: "none", color: "rgba(255,255,255,.45)",
          display: "flex", alignItems: "center",
        }}
      >
        <GripVertical className="h-5 w-5" />
      </div>

      <span style={{
        flexShrink: 0, width: 20, textAlign: "center",
        fontSize: 12, fontWeight: 800, color: MUTED_FG,
        fontVariantNumeric: "tabular-nums",
      }}>
        {position}
      </span>

      <ExerciseImage
        photo={unit.photo}
        name={unit.title}
        muscleGroup={unit.muscleGroup}
        className="h-10 w-10 rounded-xl"
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: FG,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {unit.title}
        </div>
        {unit.subtitle && (
          <div style={{
            fontSize: 11.5, color: MUTED_FG, marginTop: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {unit.subtitle}
          </div>
        )}
      </div>

      {/* Progresso do exercício: reordenar no meio do treino é comum, e mover
          para cima algo que já foi feito costuma ser engano. */}
      {unit.totalSets > 0 && (
        <span style={{
          flexShrink: 0, fontSize: 11, fontWeight: 700,
          color: unit.doneSets > 0 ? PRIMARY : MUTED_FG,
          background: unit.doneSets > 0 ? "rgba(91,140,255,.14)" : SURFACE,
          borderRadius: 20, padding: "3px 9px",
          fontVariantNumeric: "tabular-nums",
        }}>
          {`${unit.doneSets}/${unit.totalSets}`}
        </span>
      )}
    </Reorder.Item>
  );
}
