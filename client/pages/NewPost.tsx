import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  createPostDb,
  type UserGoal,
} from "@/lib/ritmofit-db";
import { ImagePlus, Loader2 } from "lucide-react";

export default function NewPost() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [description, setDescription] = React.useState("");
  const [selectedGoalId, setSelectedGoalId] = React.useState<string>("");
  const [userGoals, setUserGoals] = React.useState<UserGoal[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Load user goals
  React.useEffect(() => {
    if (!user || authLoading) return;

    setIsLoadingGoals(true);
    getUserGoalsDb()
      .then(setUserGoals)
      .catch((err) => {
        console.error("Error loading user goals:", err);
        toast({
          title: "Erro ao carregar metas",
          description: "Não foi possível carregar suas metas.",
          variant: "destructive",
        });
      })
      .finally(() => setIsLoadingGoals(false));
  }, [user, authLoading]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Tipo inválido",
        description: "Selecione apenas arquivos de imagem.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle post submission
  const handleSubmit = React.useCallback(async () => {
    if (!user || !selectedFile) {
      toast({
        title: "Erro",
        description: "Selecione uma imagem para postar.",
        variant: "destructive",
      });
      return;
    }

    if (!hasSupabaseConfig || !supabase) {
      toast({
        title: "Erro",
        description: "Supabase não configurado.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload image to storage
      const timestamp = Date.now();
      const extension = selectedFile.name.split(".").pop() || "jpg";
      const filePath = `${user.id}/${timestamp}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(filePath, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Erro ao fazer upload: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("posts")
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      // Create post in database
      const postId = await createPostDb(
        publicUrl,
        description,
        selectedGoalId || null,
      );

      // If a goal was linked, increment its progress
      if (selectedGoalId) {
        try {
          await incrementGoalProgressDb(selectedGoalId);
        } catch (err) {
          console.error("Error incrementing goal progress:", err);
          // Don't fail the entire post creation if goal update fails
        }
      }

      toast({
        title: "Sucesso!",
        description: "Sua postagem foi publicada com sucesso.",
      });

      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      setDescription("");
      setSelectedGoalId("");

      // Redirect to feed after a short delay
      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err: any) {
      console.error("Error creating post:", err);
      toast({
        title: "Erro ao postar",
        description: err?.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, selectedFile, description, selectedGoalId, navigate]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Acesso Negado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Você precisa estar logado para criar uma postagem.
            </p>
            <Button onClick={() => navigate("/login")} className="w-full">
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Nova Postagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Image Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Imagem</label>

            {previewUrl ? (
              <div className="relative group">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-96 object-cover rounded-lg border border-border/60"
                />
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                  }}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center"
                >
                  <span className="text-white text-sm font-medium">
                    Clique para mudar
                  </span>
                </button>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer rounded-lg"
                />
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border/60 rounded-lg bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    Clique ou arraste uma imagem
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG, WebP ou GIF (máx. 5MB)
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}

            {selectedFile && (
              <p className="text-xs text-muted-foreground">
                {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Legenda</label>
            <Textarea
              placeholder="Conte uma história sobre sua jornada de fitness..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              className="resize-none rounded-lg"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/500 caracteres
            </p>
          </div>

          {/* Goal Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Meta Vinculada (Opcional)</label>
            {isLoadingGoals ? (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                Carregando metas...
              </div>
            ) : userGoals.length > 0 ? (
              <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
                <SelectTrigger className="rounded-lg">
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
                  <SelectItem value="">Nenhuma meta</SelectItem>
                  {userGoals.map((goal) => (
                    <SelectItem key={goal.id} value={goal.id}>
                      <div className="flex flex-col">
                        <span>{goal.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                Nenhuma meta criada. Crie uma meta em Metas.
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate("/")}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={!selectedFile || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Postando...
                </>
              ) : (
                "Postar"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
