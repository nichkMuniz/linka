import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { UserAvatar } from "@/components/shared/user-avatar";
import { CheckInCalendarGrid, localDateStr } from "@/components/shared/check-in-calendar-grid";
import { GLASS_SHEET_STYLE, GLASS_PANEL_STYLE } from "@/lib/glass-styles";
import { useLanguage } from "@/lib/language-context";
import type { GroupCheckIn } from "@/lib/ritmofit-db";

interface MemberCheckInsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  memberPhoto: string | null;
  /** Check-ins **deste membro neste grupo**, já filtrados por quem chama. */
  checkIns: GroupCheckIn[];
}

/**
 * Calendário de check-ins de um participante dentro de um grupo de duelo.
 * Abre por cima do drawer de Classificações (ao tocar no nome) — sem z-index
 * próprio: o portal aberto por último já pinta acima (docs/13, "Empilhamento").
 */
export function MemberCheckInsDrawer({
  open,
  onOpenChange,
  memberName,
  memberPhoto,
  checkIns,
}: MemberCheckInsDrawerProps) {
  const { t } = useLanguage();

  // Dia LOCAL, igual ao agrupamento Hoje/Ontem do histórico do grupo.
  const checkInDates = React.useMemo(
    () => checkIns.map((c) => localDateStr(new Date(c.createdAt))),
    [checkIns],
  );

  const activeDays = React.useMemo(() => new Set(checkInDates).size, [checkInDates]);

  // Deixa a navegação alcançar o mês do check-in mais antigo do membro.
  const monthsBack = React.useMemo(() => {
    if (checkIns.length === 0) return 0;
    const oldest = checkIns.reduce(
      (min, c) => Math.min(min, new Date(c.createdAt).getTime()),
      Infinity,
    );
    const from = new Date(oldest);
    const today = new Date();
    return Math.max(
      0,
      (today.getFullYear() - from.getFullYear()) * 12 + (today.getMonth() - from.getMonth()),
    );
  }, [checkIns]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent
        handleClassName="mt-[6px] h-1 w-[38px] bg-white/25"
        className="flex flex-col !rounded-t-[32px] !border-0"
        style={{ ...GLASS_SHEET_STYLE, maxHeight: "85dvh" }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DrawerHeader className="shrink-0">
          <div className="flex items-center gap-3">
            <UserAvatar photo={memberPhoto} nickname={memberName} size="lg" />
            <div className="min-w-0 text-left">
              <DrawerTitle className="truncate" style={{ color: "#fff" }}>
                {memberName}
              </DrawerTitle>
              <DrawerDescription className="text-xs" style={{ color: "rgba(255,255,255,.5)" }}>
                {t("duels_member_checkins_desc")}
              </DrawerDescription>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {checkIns.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: "rgba(255,255,255,.5)" }}>
              {t("duels_member_checkins_empty")}
            </p>
          ) : (
            <div className="rounded-2xl p-4" style={GLASS_PANEL_STYLE}>
              <CheckInCalendarGrid
                checkInDates={checkInDates}
                monthsBack={monthsBack}
                footer={(checkInsThisMonth) => (
                  <div
                    className="flex items-center gap-3"
                    style={{
                      marginTop: "16px",
                      paddingTop: "14px",
                      borderTop: "1px solid rgba(255,255,255,.1)",
                    }}
                  >
                    <span style={{ fontSize: "20px" }}>📅</span>
                    <div>
                      <div style={{ fontSize: "13px", color: "rgba(255,255,255,.85)", fontWeight: 600 }}>
                        {t("duels_member_checkins_active_days").replace("{n}", String(activeDays))}
                      </div>
                      <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,.45)", marginTop: "1px" }}>
                        {t("goals_checkin_modal_month").replace("{n}", String(checkInsThisMonth))}
                      </div>
                    </div>
                  </div>
                )}
              />
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
