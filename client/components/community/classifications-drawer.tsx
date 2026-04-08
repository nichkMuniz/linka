import * as React from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { type GroupCheckIn } from "@/lib/ritmofit-db";

interface ClassificationsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupCheckIns: GroupCheckIn[];
}

export function ClassificationsDrawer({
  open,
  onOpenChange,
  groupCheckIns,
}: ClassificationsDrawerProps) {
  const rankingEntries = React.useMemo(() => {
    const counts = groupCheckIns.reduce((acc: Record<string, { userName: string; count: number }>, checkIn) => {
      if (!acc[checkIn.userId]) {
        acc[checkIn.userId] = { userName: checkIn.userName, count: 0 };
      }
      acc[checkIn.userId].count++;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1].count - a[1].count);
  }, [groupCheckIns]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh] flex flex-col z-[100]">
        <DrawerHeader className="shrink-0">
          <DrawerTitle>Classificações</DrawerTitle>
          <DrawerDescription className="sr-only">Ranking de membros do grupo</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <div className="space-y-2">
            {rankingEntries.length > 0 ? (
              rankingEntries.map(([userId, data], index) => (
                <div key={userId} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40">
                  <div className="text-lg font-bold text-brand w-8 text-center">
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{data.userName}</p>
                    <p className="text-xs text-muted-foreground">{data.count} check-ins</p>
                  </div>
                  <div className="text-lg font-bold text-brand">{data.count}</div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum check-in ainda</p>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
