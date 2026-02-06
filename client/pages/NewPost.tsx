import * as React from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { getUserGoalsDb, type UserGoal } from "@/lib/ritmofit-db";

export default function NewPost() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [file, setFile] = React.useState<File | null>(null);
  const [caption, setCaption] = React.useState("");
  const [selectedGoalId, setSelectedGoalId] = React.useState<string>("");
  const [userGoals, setUserGoals] = React.useState<UserGoal[]>([]);
  const [goalsLoading, setGoalsLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;

    setGoalsLoading(true);
    getUserGoalsDb()
      .then((data) => {
        setUserGoals(data);
      })
      .catch((err) => {
        console.error("Error loading user goals:", err);
      })
      .finally(() => setGoalsLoading(false));
  }, [user]);

  const canSubmit = Boolean(file && !busy && hasSupabaseConfig && user);

  async function handlePost() {
    if (!hasSupabaseConfig || !supabase) return;
    if (loading) return;

    if (!user) {
      toast({
        title: "Faça login",
        description: "Você precisa estar logado para publicar.",
      });
      navigate("/login");
      return;
    }

    if (!file) return;

    setBusy(true);
    try {
      const filePath = `${user.id}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from("posts").getPublicUrl(filePath)
        .data.publicUrl;

      const { error: insertError } = await supabase.from("posts").insert({
        user_id: user.id,
        description: caption.trim(),
        photo: publicUrl,
        user_goal_id: selectedGoalId ? parseInt(selectedGoalId) : null,
      });

      if (insertError) throw insertError;

      toast({
        title: "Post publicado!",
        description: "Sua foto já foi enviada.",
      });

      setFile(null);
      setCaption("");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast({
        title: "Erro ao publicar",
        description: err.message || "Erro inesperado",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-md gap-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Nova postagem</h1>
        <p className="text-sm text-muted-foreground">
          Envie uma foto para o bucket <span className="font-mono">posts</span>{" "}
          e salve a referência no banco.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Postar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasSupabaseConfig ? (
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              Para publicar via Supabase, configure:
              <div className="mt-2 grid gap-1 font-mono text-[12px]">
                <div>VITE_SUPABASE_URL</div>
                <div>VITE_SUPABASE_ANON_KEY</div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-2">
            <div className="text-sm font-medium">Foto</div>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <div className="text-xs text-muted-foreground">
              {file
                ? `${file.name} (${Math.round(file.size / 1024)} KB)`
                : "Selecione uma imagem"}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-medium">Legenda</div>
            <Textarea
              placeholder="Legenda..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="min-h-24"
            />
          </div>

          <div className="grid gap-2">
            <div className="text-sm font-medium">Meta (Opcional)</div>
            {goalsLoading ? (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                Carregando metas...
              </div>
            ) : userGoals.length > 0 ? (
              <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedGoalId
                        ? userGoals.find((g) => g.id === selectedGoalId)
                          ?.description
                        : "Selecione uma meta"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {userGoals.map((goal) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">
                          {goal.description}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {goal.duration}d · {goal.quantity}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex h-10 items-center rounded-md border border-border/50 bg-muted/30 px-3 text-sm text-muted-foreground">
                Nenhuma meta disponível
              </div>
            )}
          </div>

          <Button
            type="button"
            className="w-full rounded-full"
            disabled={!canSubmit}
            onClick={handlePost}
          >
            {busy
              ? "Publicando..."
              : user
                ? "Publicar"
                : "Faça login para publicar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
