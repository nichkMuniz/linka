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
import { ImagePlus, Loader2, ChevronLeft, ChevronRight, X, Video, Sparkles, Target, Upload, Clapperboard, Crop } from "lucide-react";
import { ImageCropperDrawer } from "@/components/shared/image-cropper-drawer";
import { useLanguage } from "@/lib/language-context";

// Module-level draft store — persists across navigation within the same SPA session
// (survives React unmount/remount; cleared on page reload or explicit reset)
const imageDraft: { files: File[]; previews: string[] } = { files: [], previews: [] };
const videoDraft: { file: File | null; preview: string | null } = { file: null, preview: null };

export default function NewPost() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();

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

  // Shared state
  const [userGoals, setUserGoals] = React.useState<UserGoal[]>([]);
  const [isLoadingGoals, setIsLoadingGoals] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(() => sessionStorage.getItem("newpost_tab") || "images");

  // Crop state — when set, shows the cropper before adding the image
  const [pendingCropSrc, setPendingCropSrc] = React.useState<string | null>(null);
  const pendingFileRef = React.useRef<File | null>(null);
  const pendingFileQueueRef = React.useRef<File[]>([]);
  // Crop state for editing an already-added image
  const [editCropIndex, setEditCropIndex] = React.useState<number | null>(null);
  const redirectTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel any pending redirect on unmount
  React.useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  // Persist text state to sessionStorage
  React.useEffect(() => { sessionStorage.setItem("newpost_description", description); }, [description]);
  React.useEffect(() => { sessionStorage.setItem("newpost_goal_id", selectedGoalId); }, [selectedGoalId]);
  React.useEffect(() => { sessionStorage.setItem("newpost_video_description", videoDescription); }, [videoDescription]);
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
          title: t("newpost_goals_load_error"),
          description: t("newpost_goals_load_error_desc"),
          variant: "destructive",
        });
      })
      .finally(() => setIsLoadingGoals(false));
  }, [user, authLoading]);

  // Opens cropper for the next file in queue
  const processNextInQueue = () => {
    const queue = pendingFileQueueRef.current;
    if (queue.length === 0) {
      pendingFileRef.current = null;
      setPendingCropSrc(null);
      return;
    }
    const file = queue[0];
    pendingFileRef.current = file;
    const reader = new FileReader();
    reader.onloadend = () => setPendingCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = (dataUrl: string, blob: Blob) => {
    const file = pendingFileRef.current;
    if (!file) return;
    // Create a new File from the cropped blob
    const croppedFile = new File([blob], file.name, { type: "image/jpeg" });
    setSelectedFiles((prev) => [...prev, croppedFile]);
    setPreviewUrls((prev) => [...prev, dataUrl]);
    // Remove processed file from queue and go to next
    pendingFileQueueRef.current = pendingFileQueueRef.current.slice(1);
    processNextInQueue();
  };

  const handleCropCancel = () => {
    // Skip this image, go to next
    pendingFileQueueRef.current = pendingFileQueueRef.current.slice(1);
    processNextInQueue();
  };

  // Handle image file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Reset input so same file can be picked again
    e.target.value = "";
    if (files.length === 0) return;

    const validFiles: File[] = [];

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: t("newpost_invalid_type"),
          description: `${file.name} ${t("newpost_invalid_image")}`,
          variant: "destructive",
        });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: t("newpost_file_too_large"),
          description: `${file.name} ${t("newpost_image_max_size")}`,
          variant: "destructive",
        });
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    // Queue all files for cropping one by one
    pendingFileQueueRef.current = [...pendingFileQueueRef.current, ...validFiles];
    // If not already processing, start
    if (!pendingCropSrc) {
      processNextInQueue();
    }
  };

  // Handle video file selection
  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("video/")) {
      toast({
        title: t("newpost_invalid_type"),
        description: t("newpost_invalid_video"),
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 100MB for videos)
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: t("newpost_file_too_large"),
        description: t("newpost_video_max_size"),
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
    imageDraft.files = imageDraft.files.filter((_, i) => i !== index);
    imageDraft.previews = imageDraft.previews.filter((_, i) => i !== index);
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
        title: t("error"),
        description: t("newpost_no_image_selected"),
        variant: "destructive",
      });
      return;
    }

    if (!hasSupabaseConfig || !supabase) {
      toast({
        title: t("error"),
        description: t("newpost_supabase_error"),
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
        title: t("newpost_success"),
        description: t("newpost_post_published"),
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
      redirectTimerRef.current = setTimeout(() => navigate("/"), 1500);
    } catch (err: any) {
      console.error("Error creating post:", err);
      toast({
        title: t("newpost_post_error"),
        description: err?.message || t("newpost_try_later"),
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
        title: t("error"),
        description: t("newpost_no_video"),
        variant: "destructive",
      });
      return;
    }

    if (!hasSupabaseConfig || !supabase) {
      toast({
        title: t("error"),
        description: t("newpost_supabase_error"),
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
      await createShotDb(
        urlData.publicUrl,
        videoDescription,
        null,
      );

      toast({
        title: t("newpost_success"),
        description: t("newpost_shot_published"),
      });

      // Reset form
      videoDraft.file = null;
      videoDraft.preview = null;
      setSelectedVideoFile(null);
      setVideoPreview(null);
      setVideoDescription("");
      sessionStorage.removeItem("newpost_video_description");

      // Redirect to shots after a short delay
      redirectTimerRef.current = setTimeout(() => navigate("/shots"), 1500);
    } catch (err: any) {
      console.error("Error creating shot:", err);
      toast({
        title: t("newpost_shot_error"),
        description: err?.message || t("newpost_try_later"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [user, selectedVideoFile, videoDescription, navigate]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">{t("newpost_loading")}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t("newpost_access_denied")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t("newpost_login_required")}
            </p>
            <Button onClick={() => navigate("/login")} className="w-full">
              {t("newpost_go_login")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-24">
      {/* Header com gradiente da marca */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-xl bg-brand-gradient">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("newpost_title")}</h1>
            <p className="text-sm text-muted-foreground">{t("newpost_subtitle")}</p>
          </div>
        </div>
      </div>

      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Tabs com personalidade */}
            <TabsList className="grid w-full grid-cols-2 h-12 p-1 rounded-xl">
              <TabsTrigger value="images" className="flex items-center gap-2 rounded-lg text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                <ImagePlus className="h-4 w-4" />
                {t("newpost_tab_post")}
              </TabsTrigger>
              <TabsTrigger value="video" className="flex items-center gap-2 rounded-lg text-sm font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                <Clapperboard className="h-4 w-4" />
                {t("newpost_tab_shots")}
              </TabsTrigger>
            </TabsList>

            {/* IMAGES TAB */}
            <TabsContent value="images" className="space-y-5 mt-5">
              {/* Image Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">{t("newpost_photos_label")}</label>
                  {selectedFiles.length > 0 && (
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      {selectedFiles.length} {selectedFiles.length === 1 ? t("newpost_photo_singular") : t("newpost_photo_plural")}
                    </span>
                  )}
                </div>

                {previewUrls.length > 0 ? (
                  <div className="space-y-3">
                    {/* Carousel Display */}
                    <div className="relative group">
                      <img
                        src={previewUrls[currentPreviewIndex]}
                        alt={`Preview ${currentPreviewIndex + 1}`}
                        className="w-full max-h-[32rem] object-contain rounded-lg border border-border/60 bg-black/5"
                      />
                      {/* Edit/crop button */}
                      <button
                        onClick={() => setEditCropIndex(currentPreviewIndex)}
                        className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 hover:bg-black/80 text-white text-xs font-medium px-2.5 py-1.5 rounded-full transition-colors"
                      >
                        <Crop className="h-3.5 w-3.5" />
                        {t("newpost_edit_crop")}
                      </button>

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

                    {/* Add more button */}
                    <label className="flex items-center justify-center gap-2 w-full py-2 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground hover:text-foreground hover:border-border cursor-pointer transition-colors">
                      <ImagePlus className="h-3.5 w-3.5" />
                      {t("newpost_add_more_photos")}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="relative flex flex-col items-center justify-center w-full h-52 border-2 border-dashed border-primary/30 rounded-xl bg-primary/5 cursor-pointer hover:bg-primary/10 hover:border-primary/50 transition-all duration-200 group">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Upload className="h-7 w-7 text-primary" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground">
                          {t("newpost_add_photos")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          PNG, JPG, WebP ou GIF · máx. 10MB cada
                        </p>
                      </div>
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
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">{t("newpost_caption_label")}</label>
                  <span className={`text-xs font-medium transition-colors ${description.length > 450 ? "text-orange-400" : "text-muted-foreground"}`}>
                    {description.length}/500
                  </span>
                </div>
                <Textarea
                  placeholder={t("newpost_caption_placeholder")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  className="resize-none rounded-xl min-h-[100px] text-sm leading-relaxed"
                  rows={4}
                />
              </div>

              {/* Goal Selection */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <label className="text-sm font-semibold">{t("newpost_link_goal")}</label>
                  <span className="text-xs text-muted-foreground">{t("newpost_optional")}</span>
                </div>
                {isLoadingGoals ? (
                  <div className="flex h-10 items-center rounded-xl border border-input bg-muted px-3 text-sm text-muted-foreground">
                    {t("newpost_goals_loading")}
                  </div>
                ) : userGoals.length > 0 ? (
                  <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue
                        placeholder={
                          selectedGoalId
                            ? userGoals.find((g) => g.id === selectedGoalId)
                              ?.description
                            : t("newpost_select_goal")
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
                    className="flex h-10 cursor-pointer items-center rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 text-sm text-muted-foreground hover:bg-primary/10 transition-colors"
                    onClick={() => navigate("/metas?tab=metas")}
                  >
                    {t("newpost_no_goals")}{" "}
                    <span className="ml-1 text-primary font-medium">{t("newpost_create_goal")}</span>
                  </div>
                )}
                {selectedGoalId && (
                  <p className="text-xs text-emerald-400 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {t("newpost_goal_progress_hint")}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={() => navigate("/")}
                  disabled={isSubmitting}
                >
                  {t("newpost_cancel")}
                </Button>
                <Button
                  className="flex-1 rounded-full font-semibold"
                  onClick={handleImageSubmit}
                  disabled={selectedFiles.length === 0 || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("newpost_publishing")}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      {t("newpost_publish")}
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* VIDEO TAB */}
            <TabsContent value="video" className="space-y-5 mt-5">
              {/* Video Selection */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">{t("newpost_video_label")}</label>

                {videoPreview ? (
                  <div className="space-y-3">
                    {/* Video Preview */}
                    <div className="relative rounded-xl overflow-hidden border border-border/60 bg-black">
                      <video
                        src={videoPreview}
                        controls
                        className="w-full max-h-96 object-contain"
                      />
                      <button
                        onClick={() => {
                          setVideoPreview(null);
                          setSelectedVideoFile(null);
                        }}
                        className="absolute top-2 right-2 bg-black/60 hover:bg-red-600 text-white rounded-full p-1.5 transition-colors"
                        aria-label={t("newpost_remove_video_label")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Video File Info */}
                    {selectedVideoFile && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-xl text-xs text-muted-foreground">
                        <Clapperboard className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{selectedVideoFile.name}</span>
                        <span className="shrink-0 ml-auto font-medium">
                          {Math.round(selectedVideoFile.size / (1024 * 1024))} MB
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="relative flex flex-col items-center justify-center w-full h-52 border-2 border-dashed border-orange-400/30 rounded-xl bg-orange-500/5 cursor-pointer hover:bg-orange-500/10 hover:border-orange-400/50 transition-all duration-200 group">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="p-4 rounded-full bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                        <Clapperboard className="h-7 w-7 text-orange-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground">
                          {t("newpost_add_video")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          MP4, WebM ou MOV · máx. 100MB
                        </p>
                      </div>
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
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold">{t("newpost_caption_label")}</label>
                  <span className={`text-xs font-medium transition-colors ${videoDescription.length > 450 ? "text-orange-400" : "text-muted-foreground"}`}>
                    {videoDescription.length}/500
                  </span>
                </div>
                <Textarea
                  placeholder={t("newpost_caption_video_placeholder")}
                  value={videoDescription}
                  onChange={(e) => setVideoDescription(e.target.value)}
                  maxLength={500}
                  className="resize-none rounded-xl min-h-[100px] text-sm leading-relaxed"
                  rows={4}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 rounded-full"
                  onClick={() => navigate("/")}
                  disabled={isSubmitting}
                >
                  {t("newpost_cancel")}
                </Button>
                <Button
                  className="flex-1 rounded-full font-semibold"
                  onClick={handleVideoSubmit}
                  disabled={!selectedVideoFile || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("newpost_publishing")}
                    </>
                  ) : (
                    <>
                      <Clapperboard className="h-4 w-4 mr-2" />
                      {t("newpost_publish_shot")}
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Cropper for new images (queue) */}
      <ImageCropperDrawer
        imageSrc={pendingCropSrc}
        aspectRatio={1}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />

      {/* Cropper for re-editing an existing image */}
      <ImageCropperDrawer
        imageSrc={editCropIndex !== null ? previewUrls[editCropIndex] : null}
        aspectRatio={1}
        onConfirm={(dataUrl, blob) => {
          if (editCropIndex === null) return;
          const original = selectedFiles[editCropIndex];
          const croppedFile = new File([blob], original?.name ?? "photo.jpg", { type: "image/jpeg" });
          setSelectedFiles((prev) => prev.map((f, i) => i === editCropIndex ? croppedFile : f));
          setPreviewUrls((prev) => prev.map((u, i) => i === editCropIndex ? dataUrl : u));
          setEditCropIndex(null);
        }}
        onCancel={() => setEditCropIndex(null)}
      />
    </div>
  );
}

