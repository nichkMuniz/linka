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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import {
  getUserGoalsDb,
  createPostDb,
  createShotDb,
  type UserGoal,
  incrementGoalProgressDb,
} from "@/lib/ritmofit-db";
import { ImagePlus, Loader2, ChevronLeft, ChevronRight, X, Video } from "lucide-react";

// Module-level draft store — persists across navigation within the same SPA session
// (survives React unmount/remount; cleared on page reload or explicit reset)
const imageDraft: { files: File[]; previews: string[] } = { files: [], previews: [] };
const videoDraft: { file: File | null; preview: string | null } = { file: null, preview: null };

export default function NewPost() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Image/Post state — initialised from module-level draft (survives navigation)
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>(() => imageDraft.files);
  const [previewUrls, setPreviewUrls] = React.useState<string[]>(() => imageDraft.previews);
  const [currentPreviewIndex, setCurrentPreviewIndex] = React.useState(0);
  const [description, setDescription] = React.useState(() => sessionStorage.getItem("newpost_description") || "");
  const [selectedGoalId, setSelectedGoalId] = React.useState<string>(() => sessionStorage.getItem("newpost_goal_id") || "");

  // Video/Shot state — initialised from module-level draft (survives navigation)
  const [selectedVideoFile, setSelectedVideoFile] = React.useState<File | null>(() => videoDraft.file);
  const [videoPreview, setVideoPreview] = React.useState<string | null>(() => videoDraft.preview);
  const [videoDescription, setVideoDescription] = React.useState(() => sessionStorage.getItem("newpost_video_description") || "");
  const [videoSelectedGoalId, setVideoSelectedGoalId] = React.useState<string>(() => sessionStorage.getItem("newpost_video_goal_id") || "");

  // Shared state
  const [userGoals, setUserGoals] = React.useState<UserGoal[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(() => sessionStorage.getItem("newpost_tab") || "images");

  // Persist text state to sessionStorage
  React.useEffect(() => { sessionStorage.setItem("newpost_description", description); }, [description]);
  React.useEffect(() => { sessionStorage.setItem("newpost_goal_id", selectedGoalId); }, [selectedGoalId]);
  React.useEffect(() => { sessionStorage.setItem("newpost_video_description", videoDescription); }, [videoDescription]);
  React.useEffect(() => { sessionStorage.setItem("newpost_video_goal_id", videoSelectedGoalId); }, [videoSelectedGoalId]);
  React.useEffect(() => { sessionStorage.setItem("newpost_tab", activeTab); }, [activeTab]);

  // Keep module-level image draft in sync with state
  React.useEffect(() => {
    imageDraft.files = selectedFiles;
    imageDraft.previews = previewUrls;
  }, [selectedFiles, previewUrls]);

  // Keep module-level video draft in sync with state
  React.useEffect(() => {
    videoDraft.file = selectedVideoFile;
    videoDraft.preview = videoPreview;
  }, [selectedVideoFile, videoPreview]);

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

  // Handle image file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Tipo inválido",
          description: `${file.name} não é uma imagem válida.`,
          variant: "destructive",
        });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} deve ter no máximo 10MB.`,
          variant: "destructive",
        });
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Read all files in parallel and preserve order via index
    const readFile = (file: File): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
        reader.readAsDataURL(file);
      });

    Promise.all(validFiles.map(readFile))
      .then((previews) => {
        setSelectedFiles((prev) => [...prev, ...validFiles]);
        setPreviewUrls((prev) => [...prev, ...previews]);
      })
      .catch((err) => {
        console.error("Error reading image files:", err);
        toast({
          title: "Erro ao carregar imagem",
          description: err?.message || "Não foi possível ler o arquivo. Tente novamente.",
          variant: "destructive",
        });
      });
  };

  // Handle video file selection
  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("video/")) {
      toast({
        title: "Tipo inválido",
        description: "Selecione um arquivo de vídeo válido (MP4, WebM, etc).",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 100MB for videos)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O vídeo deve ter no máximo 100MB.",
        variant: "destructive",
      });
      return;
    }

    setSelectedVideoFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setVideoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));

    // Adjust currentPreviewIndex if necessary
    if (currentPreviewIndex >= previewUrls.length - 1 && currentPreviewIndex > 0) {
      setCurrentPreviewIndex(currentPreviewIndex - 1);
    }
  };

  const navigatePreview = (direction: "next" | "prev") => {
    let newIndex = currentPreviewIndex;

    if (direction === "next") {
      newIndex = (currentPreviewIndex + 1) % previewUrls.length;
    } else {
      newIndex = (currentPreviewIndex - 1 + previewUrls.length) % previewUrls.length;
    }

    setCurrentPreviewIndex(newIndex);
  };

  // Handle image post submission
  const handleImageSubmit = React.useCallback(async () => {
    if (!user || selectedFiles.length === 0) {
      toast({
        title: "Erro",
        description: "Selecione pelo menos uma imagem para postar.",
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
      const uploadedUrls: string[] = [];

      // Upload all images
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const timestamp = Date.now();
        const extension = file.name.split(".").pop() || "jpg";
        const filePath = `${user.id}/${timestamp}-${i}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Erro ao fazer upload de ${file.name}: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("posts")
          .getPublicUrl(filePath);

        uploadedUrls.push(urlData.publicUrl);
      }

      // Create post in database with all photo URLs
      const postId = await createPostDb(
        uploadedUrls,
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
        description: "Sua postagem foi publicada no feed.",
      });

      // Reset form
      imageDraft.files = [];
      imageDraft.previews = [];
      setSelectedFiles([]);
      setPreviewUrls([]);
      setCurrentPreviewIndex(0);
      setDescription("");
      setSelectedGoalId("");
      sessionStorage.removeItem("newpost_description");
      sessionStorage.removeItem("newpost_goal_id");

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
  }, [user, selectedFiles, description, selectedGoalId, navigate]);

  // Handle video shot submission
  const handleVideoSubmit = React.useCallback(async () => {
    if (!user || !selectedVideoFile) {
      toast({
        title: "Erro",
        description: "Selecione um vídeo para publicar.",
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
      // Upload video
      const timestamp = Date.now();
      const extension = selectedVideoFile.name.split(".").pop() || "mp4";
      const filePath = `${user.id}/shots/${timestamp}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("posts")
        .upload(filePath, selectedVideoFile, {
          contentType: selectedVideoFile.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Erro ao fazer upload do vídeo: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("posts")
        .getPublicUrl(filePath);

      // Create shot in database
      const shot = await createShotDb(
        urlData.publicUrl,
        videoDescription,
        videoSelectedGoalId || null,
      );

      // If a goal was linked, increment its progress
      if (videoSelectedGoalId) {
        try {
          await incrementGoalProgressDb(videoSelectedGoalId);
        } catch (err) {
          console.error("Error incrementing goal progress:", err);
          // Don't fail the entire shot creation if goal update fails
        }
      }

      toast({
        title: "Sucesso!",
        description: "Seu Shots foi publicado.",
      });

      // Reset form
      videoDraft.file = null;
      videoDraft.preview = null;
      setSelectedVideoFile(null);
      setVideoPreview(null);
      setVideoDescription("");
      setVideoSelectedGoalId("");
      sessionStorage.removeItem("newpost_video_description");
      sessionStorage.removeItem("newpost_video_goal_id");

      // Redirect to shots after a short delay
      setTimeout(() => {
        navigate("/shots");
      }, 1500);
    } catch (err: any) {
      console.error("Error creating shot:", err);
      toast({
        title: "Erro ao publicar vídeo",
        description: err?.message || "Tente novamente mais tarde.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, selectedVideoFile, videoDescription, videoSelectedGoalId, navigate]);

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
          <CardTitle>Criar Conteúdo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="images" className="flex items-center gap-2">
                <ImagePlus className="h-4 w-4" />
                Postagem
              </TabsTrigger>
              <TabsTrigger value="video" className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                Shots
              </TabsTrigger>
            </TabsList>

            {/* IMAGES TAB */}
            <TabsContent value="images" className="space-y-6 mt-6">
              {/* Image Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Imagens ({selectedFiles.length})
                </label>

                {previewUrls.length > 0 ? (
                  <div className="space-y-3">
                    {/* Carousel Display */}
                    <div className="relative group">
                      <img
                        src={previewUrls[currentPreviewIndex]}
                        alt={`Preview ${currentPreviewIndex + 1}`}
                        className="w-full h-96 object-cover rounded-lg border border-border/60"
                      />

                      {/* Navigation Buttons */}
                      {previewUrls.length > 1 && (
                        <>
                          <button
                            onClick={() => navigatePreview("prev")}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 p-2 rounded-full transition-colors"
                          >
                            <ChevronLeft className="h-5 w-5 text-white" />
                          </button>
                          <button
                            onClick={() => navigatePreview("next")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 p-2 rounded-full transition-colors"
                          >
                            <ChevronRight className="h-5 w-5 text-white" />
                          </button>

                          {/* Photo Counter */}
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 pointer-events-none">
                            <div className="flex gap-1">
                              {previewUrls.map((_, index) => (
                                <div
                                  key={index}
                                  className={`h-1.5 rounded-full transition-all ${currentPreviewIndex === index
                                      ? "w-4 bg-white"
                                      : "w-1.5 bg-white/50"
                                    }`}
                                />
                              ))}
                            </div>
                            <p className="text-white text-xs font-medium bg-black/40 px-2 py-0.5 rounded-full">
                              {currentPreviewIndex + 1}/{previewUrls.length}
                            </p>
                          </div>
                        </>
                      )}

                      {/* Change Photos Overlay */}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          Clique para adicionar mais
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer rounded-lg"
                      />
                    </div>

                    {/* Photo Thumbnails Strip */}
                    {previewUrls.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-2">
                        {previewUrls.map((url, index) => (
                          <div
                            key={index}
                            className={`relative flex-shrink-0 cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${currentPreviewIndex === index
                                ? "border-primary"
                                : "border-border/40 hover:border-border"
                              }`}
                          >
                            <img
                              src={url}
                              alt={`Thumbnail ${index + 1}`}
                              className="h-16 w-16 object-cover"
                              onClick={() => setCurrentPreviewIndex(index)}
                            />
                            <button
                              onClick={() => removePhoto(index)}
                              className="absolute top-0 right-0 bg-red-500/80 hover:bg-red-600 p-1 rounded-bl-lg transition-colors"
                            >
                              <X className="h-3 w-3 text-white" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Selected Files Info */}
                    <div className="text-xs text-muted-foreground space-y-1">
                      {selectedFiles.map((file, index) => (
                        <p key={index}>
                          {file.name} ({Math.round(file.size / 1024)} KB)
                        </p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border/60 rounded-lg bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium text-foreground">
                        Clique ou arraste imagens
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG, WebP ou GIF (máx. 10MB cada)
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
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
                  <div
                    className="flex h-10 cursor-pointer items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground hover:bg-muted transition-colors"
                    onClick={() => navigate("/metas?tab=metas")}
                  >
                    Nenhuma meta criada.{" "}
                    <span className="ml-1 text-primary underline">Criar meta</span>
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
                  onClick={handleImageSubmit}
                  disabled={selectedFiles.length === 0 || isSubmitting}
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
            </TabsContent>

            {/* VIDEO TAB */}
            <TabsContent value="video" className="space-y-6 mt-6">
              {/* Video Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Vídeo</label>

                {videoPreview ? (
                  <div className="space-y-3">
                    {/* Video Preview */}
                    <div className="relative group">
                      <video
                        src={videoPreview}
                        controls
                        className="w-full h-96 object-cover rounded-lg border border-border/60 bg-black"
                      />
                      <button
                        onClick={() => {
                          setVideoPreview(null);
                          setSelectedVideoFile(null);
                        }}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Video File Info */}
                    {selectedVideoFile && (
                      <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted rounded-lg">
                        <p>
                          <strong>Arquivo:</strong> {selectedVideoFile.name}
                        </p>
                        <p>
                          <strong>Tamanho:</strong>{" "}
                          {Math.round(selectedVideoFile.size / (1024 * 1024))} MB
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border/60 rounded-lg bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Video className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium text-foreground">
                        Clique para selecionar vídeo
                      </p>
                      <p className="text-xs text-muted-foreground">
                        MP4, WebM ou MOV (máx. 100MB)
                      </p>
                    </div>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Descrição</label>
                <Textarea
                  placeholder="Descreva seu vídeo..."
                  value={videoDescription}
                  onChange={(e) => setVideoDescription(e.target.value)}
                  maxLength={500}
                  className="resize-none rounded-lg"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  {videoDescription.length}/500 caracteres
                </p>
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
                  onClick={handleVideoSubmit}
                  disabled={!selectedVideoFile || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Publicando...
                    </>
                  ) : (
                    "Publicar Shots"
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
