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
import {
  getUserGoalsDb,
  incrementGoalProgressDb,
  type UserGoal,
} from "@/lib/ritmofit-db";

export default function NewPost() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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
      .then(setUserGoals)
      .catch(console.error)
      .finally(() => setGoalsLoading(false));
  }, [user]);

  const canSubmit = Boolean(file && !busy && hasSupabaseConfig && user);

  async function handlePost() {
    if (!hasSupabaseConfig || !supabase) return;
    if (!user || !file || loading) return;

    setBusy(true);

    try {
      // Garantir tipo correto
      const mimeType =
        file.type && file.type.startsWith("image/")
          ? file.type
          : "image/jpeg";

      // Converter para blob correto
      const arrayBuffer = await file.arrayBuffer();

      const blob = new Blob([arrayBuffer], {
        type: mimeType,
      });

      const extension = mimeType.split("/")[1] || "jpg";

      const filePath = `${user.id}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(filePath, blob, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage
        .from("posts")
        .getPublicUrl(filePath).data.publicUrl;

      const { error: insertError } = await supabase.from("posts").insert({
        user_id: user.id,
        description: caption.trim(),
        photo: publicUrl,
        user_goal_id: selectedGoalId ? Number(selectedGoalId) : null,
      });

      if (insertError) throw insertError;

      // Atualizar meta
      if (selectedGoalId) {
        incrementGoalProgressDb(selectedGoalId).catch(console.error);
      }

      toast({
        title: "Post publicado com sucesso!",
      });

      // Reset correto
      setFile(null);
      setCaption("");

      if (fileInputRef.current)
        fileInputRef.current.value = "";

      navigate("/", { replace: true });
    } catch (err: any) {
      console.error(err);

      toast({
        title: "Erro ao publicar",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-md gap-6">

      <Card>

        <CardHeader>
          <CardTitle>Nova postagem</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* FILE INPUT */}
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) =>
              setFile(e.target.files?.[0] || null)
            }
          />

          {/* CAPTION */}
          <Textarea
            placeholder="Legenda..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />

          {/* GOALS */}
          {goalsLoading ? (
            <p>Carregando metas...</p>
          ) : (
            <Select
              value={selectedGoalId}
              onValueChange={setSelectedGoalId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Meta (opcional)" />
              </SelectTrigger>

              <SelectContent>
                {userGoals.map((goal) => (
                  <SelectItem
                    key={goal.id}
                    value={goal.id}
                  >
                    {goal.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            onClick={handlePost}
            disabled={!canSubmit}
            className="w-full"
          >
            {busy ? "Publicando..." : "Publicar"}
          </Button>

        </CardContent>
      </Card>
    </div>
  );
}
