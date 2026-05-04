import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface GoalCompletedDialogProps {
  goalDescription: string;
  onClose: () => void;
}

export function GoalCompletedDialog({ goalDescription, onClose }: GoalCompletedDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-xs text-center"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-center text-lg">
            Meta concluída! 🎉
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-4">
          <span className="text-7xl leading-none select-none" role="img" aria-label="troféu">
            🏆
          </span>
          <p className="text-sm font-semibold px-2">{goalDescription}</p>
          <p className="text-sm text-muted-foreground px-2">
            Parabéns! Você concluiu sua meta com sucesso. Continue assim! 💪
          </p>
        </div>

        <Button className="w-full" onClick={onClose}>
          Incrível! 💪
        </Button>
      </DialogContent>
    </Dialog>
  );
}
