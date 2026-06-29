import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ExerciseImage } from "@/components/shared/exercise-image";
import { DietImage } from "@/components/shared/diet-image";
import { useLanguage } from "@/lib/language-context";
import { GLASS_SHEET_STYLE, GLASS_SHEET_PROPS } from "@/lib/glass-styles";

export interface ItemDetailData {
  /** 1 = exercício, 2 = dieta */
  type: 1 | 2;
  name: string;
  photo: string | null;
  description?: string | null;
  /** linha de meta: grupo muscular / categoria · kcal */
  meta?: string | null;
}

interface ItemDetailDrawerProps {
  item: ItemDetailData | null;
  onClose: () => void;
}

/**
 * Drawer glass que mostra a imagem ampliada de um exercício/dieta + descrição
 * de como executar/preparar. Reutilizável a partir de qualquer lista de itens.
 */
export function ItemDetailDrawer({ item, onClose }: ItemDetailDrawerProps) {
  const { t } = useLanguage();

  return (
    <Drawer
      open={!!item}
      onOpenChange={(v) => { if (!v) onClose(); }}
      noBodyStyles
      shouldScaleBackground={false}
    >
      <DrawerContent
        {...GLASS_SHEET_PROPS}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={GLASS_SHEET_STYLE}
      >
        {item && (
          <>
            <DrawerHeader className="pb-2">
              <DrawerTitle className="text-base font-semibold leading-snug pr-4 text-white">
                {item.name}
              </DrawerTitle>
            </DrawerHeader>

            <div
              className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 space-y-4"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <div
                className="w-full aspect-square rounded-2xl overflow-hidden"
                style={{ background: "rgba(255,255,255,.04)" }}
              >
                {item.type === 1 ? (
                  <ExerciseImage photo={item.photo} name={item.name} className="w-full h-full" />
                ) : (
                  <DietImage photo={item.photo} name={item.name} className="w-full h-full" />
                )}
              </div>

              {item.meta && (
                <p className="text-sm" style={{ color: "rgba(255,255,255,.6)" }}>{item.meta}</p>
              )}

              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-white">
                  {item.type === 1 ? t("goals_item_how_exercise") : t("goals_item_how_diet")}
                </h3>
                <p
                  className="text-sm leading-relaxed whitespace-pre-line"
                  style={{ color: "rgba(255,255,255,.7)" }}
                >
                  {item.description?.trim() || t("goals_item_no_desc")}
                </p>
              </div>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
