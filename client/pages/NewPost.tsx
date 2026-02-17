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
    if (loading || !user) return;

    if (!file) {
      toast({ title: "Selecione uma imagem" });
      return;
    }

    setBusy(true);

    try {
      // GARANTIR QUE É UM FILE REAL
      let uploadFile: File;

      if (file instanceof File) {
        uploadFile = file;
      } else {
        // Caso venha como blob/base64/json, converter
        const blob = new Blob([file], { type: "image/jpeg" });
        uploadFile = new File([blob], `photo.jpg`, { type: "image/jpeg" });
      }

      const extension = uploadFile.type.split("/")[1] || "jpg";

      const filePath = `${user.id}/${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(filePath, uploadFile, {
          contentType: uploadFile.type,
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

      toast({ title: "Post publicado!" });

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

      <Card>

        <CardHeader>
          <CardTitle>Nova postagem</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">

          {/* FILE INPUT */}
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const selectedFile = e.target.files?.[0];

              if (!selectedFile) return;

              console.log("Tipo real:", selectedFile.type);
              console.log("Instanceof File:", selectedFile instanceof File);

              setFile(selectedFile);
            }}
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
