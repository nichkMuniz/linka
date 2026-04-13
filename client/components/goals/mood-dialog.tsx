import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { saveTodayMoodDb, type MoodValue } from "@/lib/ritmofit-db";

const MOODS = [
  { value: "muito_triste" as const, emoji: "😢", label: "Muito triste" },
  { value: "triste" as const, emoji: "😕", label: "Triste" },
  { value: "neutro" as const, emoji: "😐", label: "Neutro" },
  { value: "feliz" as const, emoji: "😊", label: "Feliz" },
  { value: "muito_feliz" as const, emoji: "😄", label: "Muito feliz" },
] as const;

interface MoodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  todayMood: MoodValue | null;
  onMoodSaved: (mood: MoodValue) => void;
}

export function MoodDialog({
  open,
  onOpenChange,
  userId,
  todayMood,
  onMoodSaved,
}: MoodDialogProps) {
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSelect = async (value: MoodValue, emoji: string) => {
    setIsSaving(true);
    try {
      await saveTodayMoodDb(userId, value);
      onMoodSaved(value);
      onOpenChange(false);
      toast({ title: "Humor registrado!", description: `Humor salvo! ${emoji}` });
    } catch {
      toast({ title: "Erro ao salvar humor", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => { if (!open) onOpenChange(false); }}>
      <DialogContent className="max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-center text-lg">Como você está se sentindo? 😊</DialogTitle>
        </DialogHeader>
        <p className="text-center text-sm text-muted-foreground -mt-2">
          Você completou suas rotinas hoje! Registre seu humor do dia.
        </p>
        <div className="flex justify-center gap-3 py-4">
          {MOODS.map(({ value, emoji, label }) => (
            <button
              key={value}
              disabled={isSaving}
              onClick={() => handleSelect(value, emoji)}
              title={label}
              className={[
                "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                "hover:bg-muted/60 active:scale-95",
                todayMood === value ? "bg-muted ring-2 ring-primary" : "",
              ].join(" ")}
            >
              <span className="text-3xl leading-none">{emoji}</span>
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
