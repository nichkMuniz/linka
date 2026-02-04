import * as React from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";

export default function NewPost() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const [file, setFile] = React.useState<File | null>(null);
  const [caption, setCaption] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const canSubmit = Boolean(file && !busy && hasSupabaseConfig && user);

  async function handlePost() {
    const { data: sessionData } = await supabase.auth.getSession();
console.log("SESSION:", sessionData);

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

      const publicUrl = supabase.storage
        .from("posts")
        .getPublicUrl(filePath).data.publicUrl;

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        description: caption.trim(),
        photo: publicUrl,
        user_goal_id: 1,
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
          Envie uma foto para o bucket <span className="font-mono">posts</span> e
          salve a referência no banco.
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
