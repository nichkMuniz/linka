import * as React from "react";
import { getFeedPosts, togglePostLike } from "../services/post.service";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PostIncentiveButton } from "@/components/post-incentive-button";
import { PostCommentsDialog } from "@/components/post-comments-dialog";
import { toast } from "@/components/ui/use-toast";
import {
  incrementGoalProgressDb,
  getRoutinesByGoalIdDb,
  getActiveStoriesDb,
  createStoryDb,
  deleteOldStoriesDb,
  type PostIncentiveType,
  type StoryWithUser,
} from "@/lib/ritmofit-db";
import { Check, ChevronDown, MoreVertical, Flag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { PostWithStats } from "../services/post.service";
import { StoriesCarousel } from "@/components/stories-carousel";
import { StoryCreationDialog } from "@/components/story-creation-dialog";
import { StoryViewerModal } from "@/components/story-viewer-modal";
import { useAuth } from "@/hooks/useAuth";

export default function Index() {
  const { user } = useAuth();
  const [posts, setPosts] = React.useState<PostWithStats[]>([]);
  const [stories, setStories] = React.useState<StoryWithUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [togglingPostId, setTogglingPostId] = React.useState<string | null>(
    null,
  );
  const [goalModalOpen, setGoalModalOpen] = React.useState(false);
  const [selectedGoalPost, setSelectedGoalPost] =
    React.useState<PostWithStats | null>(null);
  const [linkedRoutines, setLinkedRoutines] = React.useState<any[]>([]);
  const [isUpdatingGoal, setIsUpdatingGoal] = React.useState(false);
  const [expandedRoutines, setExpandedRoutines] = React.useState(false);
  const [storyCreationOpen, setStoryCreationOpen] = React.useState(false);
  const [selectedStory, setSelectedStory] =
    React.useState<StoryWithUser | null>(null);
  const [storyViewerOpen, setStoryViewerOpen] = React.useState(false);
  const [isCreatingStory, setIsCreatingStory] = React.useState(false);
  const [reportDialogOpen, setReportDialogOpen] = React.useState(false);
  const [reportType, setReportType] = React.useState<"user" | "post" | null>(null);
  const [reportedPost, setReportedPost] = React.useState<PostWithStats | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const [postsData, storiesData] = await Promise.all([
          getFeedPosts(),
          getActiveStoriesDb(),
        ]);
        setPosts(postsData);
        setStories(storiesData);

        // Clean up old stories in background
        deleteOldStoriesDb().catch((err) =>
          console.error("Error cleaning old stories:", err),
        );
      } catch (err: any) {
        console.error("Erro ao carregar feed:", err?.message || err);
        toast({
          title: "Erro ao carregar feed",
          description: err?.message || "Tente novamente.",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCreateStory = React.useCallback(
    async (mediaUrl: string, description: string) => {
      setIsCreatingStory(true);
      try {
        const newStory = await createStoryDb(description, mediaUrl);
        if (newStory && user) {
          // Add the new story to the list
          const enrichedStory: StoryWithUser = {
            ...newStory,
            userNickname: user.email?.split("@")[0] || "Você",
            userPhoto: null,
          };
          setStories((prev) => [enrichedStory, ...prev]);
        }
      } catch (err: any) {
        console.error("Error creating story:", err);
        throw err;
      } finally {
        setIsCreatingStory(false);
      }
    },
    [user],
  );

  const handleStoryClick = React.useCallback((story: StoryWithUser) => {
    setSelectedStory(story);
    setStoryViewerOpen(true);
  }, []);

  const handleAddStoryClick = React.useCallback(() => {
    setStoryCreationOpen(true);
  }, []);

  const openGoalModal = React.useCallback(async (post: PostWithStats) => {
    setSelectedGoalPost(post);
    setGoalModalOpen(true);
    setExpandedRoutines(false);

    // Fetch routines linked to this goal
    if (post.userGoal) {
      try {
        const routines = await getRoutinesByGoalIdDb(post.userGoal.goal_id);
        setLinkedRoutines(routines);
      } catch (err) {
        console.error("Error fetching routines:", err);
        setLinkedRoutines([]);
      }
    }
  }, []);

  const handleIncrementGoalProgress = React.useCallback(async () => {
    if (!selectedGoalPost?.userGoal) return;

    setIsUpdatingGoal(true);
    try {
      await incrementGoalProgressDb(selectedGoalPost.userGoal.id);

      // Update the post in the list
      setPosts((prev) =>
        prev.map((post) => {
          if (post.id !== selectedGoalPost.id) return post;
          if (!post.userGoal) return post;

          return {
            ...post,
            userGoal: {
              ...post.userGoal,
              perc: Math.min(post.userGoal.perc + 1, 100),
            },
          };
        }),
      );

      toast({
        title: "Progresso atualizado!",
        description: "Você avançou 1% na sua meta.",
      });
    } catch (err: any) {
      console.error("Error updating goal progress:", err);
      toast({
        title: "Erro ao atualizar progresso",
        description: err?.message || "Tente novamente.",
      });
    } finally {
      setIsUpdatingGoal(false);
    }
  }, [selectedGoalPost?.userGoal?.id, selectedGoalPost?.id]);

  const handleToggleLike = React.useCallback(
    async (postId: string, incentiveType: PostIncentiveType) => {
      try {
        setTogglingPostId(postId);

        // Update UI optimistically
        setPosts((prev) =>
          prev.map((post) => {
            if (post.id !== postId) return post;

            const wasActive = post.userLikes.includes(incentiveType);
            const newUserLikes = wasActive
              ? post.userLikes.filter((t) => t !== incentiveType)
              : [...post.userLikes, incentiveType];

            const likesMap = {
              apoio: post.likes.apoio,
              continua: post.likes.continua,
              ganhador: post.likes.ganhador,
            };
            if (incentiveType === 1) likesMap.apoio += wasActive ? -1 : 1;
            else if (incentiveType === 2)
              likesMap.continua += wasActive ? -1 : 1;
            else if (incentiveType === 3)
              likesMap.ganhador += wasActive ? -1 : 1;

            return {
              ...post,
              likes: likesMap,
              userLikes: newUserLikes,
            };
          }),
        );

        await togglePostLike(postId, incentiveType);
      } catch (err: any) {
        console.error("Erro ao toggle like:", err);
        toast({
          title: "Erro ao reagir",
          description: err?.message || "Tente novamente.",
        });
        // Refetch to restore correct state
        const data = await getFeedPosts();
        setPosts(data);
      } finally {
        setTogglingPostId(null);
      }
    },
    [],
  );

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      {/* Stories Carousel */}
      <div className="bg-background border-b border-border/60">
        <StoriesCarousel
          stories={stories}
          onAddStoryClick={handleAddStoryClick}
          onStoryClick={handleStoryClick}
          currentUserId={user?.id || ""}
        />
      </div>

      {posts.length ? (
        posts.map((post) => (
          <Card key={post.id} className="border-border/60 relative overflow-hidden">
            <CardContent className="space-y-3 p-0">
              {/* Image Container with User Info Overlay */}
              <div className="relative">
                <img
                  src={post.photo}
                  alt="Post"
                  className="w-full object-cover"
                />
                {/* User Info Overlay - Inside Image */}
                <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-3 p-3 bg-gradient-to-t from-black/60 via-black/30 to-transparent">
                  <div className="flex items-center gap-2">
                    {post.userPhoto ? (
                      <img
                        src={post.userPhoto}
                        alt={post.userNickname}
                        className="h-8 w-8 rounded-full object-cover border border-white/30"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-white/30" />
                    )}
                    <span className="text-xs font-medium text-white drop-shadow-sm">
                      {post.userNickname}
                    </span>
                  </div>
                </div>
              </div>

              {/* Post Content */}
              <div className="p-4 space-y-3">
                {post.description && (
                  <p className="text-sm leading-relaxed">{post.description}</p>
                )}

                {/* Incentives and Comments Row */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-3">
                    {([1, 2, 3] as PostIncentiveType[]).map((type) => (
                      <PostIncentiveButton
                        key={type}
                        type={type}
                        count={
                          post.likes[
                            type === 1
                              ? "apoio"
                              : type === 2
                                ? "continua"
                                : "ganhador"
                          ]
                        }
                        isActive={post.userLikes.includes(type)}
                        onClick={() => handleToggleLike(post.id, type)}
                        loading={togglingPostId === post.id}
                        hasActivity={post.hasActivity}
                      />
                    ))}
                  </div>
                  <PostCommentsDialog
                    postId={post.id}
                    commentCount={post.commentCount}
                    hasActivity={post.hasActivity}
                  />
                </div>

                {/* Goal Progress Bar */}
                {post.userGoal && (
                  <button
                    onClick={() => openGoalModal(post)}
                    className="w-full space-y-2 pt-2 text-left hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">
                        {post.userGoal.description}
                      </span>
                      <span className="text-xs font-semibold text-brand">
                        {post.userGoal.perc}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-brand h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${post.userGoal.perc}%`,
                        }}
                      />
                    </div>
                  </button>
                )}

                <p className="text-xs text-muted-foreground pt-1">
                  {new Date(post.created_at).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <div className="rounded-lg border border-border/60 bg-muted/30 p-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Comece agora a acompanhar as rotinas de seus amigos
          </p>
          <a href="/buscar">
            <Button className="rounded-full">Buscar</Button>
          </a>
        </div>
      )}

      {/* Story Creation Dialog */}
      <StoryCreationDialog
        open={storyCreationOpen}
        onOpenChange={setStoryCreationOpen}
        onCreateStory={handleCreateStory}
        isLoading={isCreatingStory}
      />

      {/* Story Viewer Modal */}
      <StoryViewerModal
        story={selectedStory}
        open={storyViewerOpen}
        onOpenChange={setStoryViewerOpen}
      />

      {/* Goal Progress Modal */}
      <Dialog open={goalModalOpen} onOpenChange={setGoalModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Progresso da Meta</DialogTitle>
          </DialogHeader>

          {selectedGoalPost?.userGoal && (
            <div className="space-y-4">
              {/* Goal Info */}
              <div className="p-4 border border-border/60 rounded-lg bg-muted/30">
                <p className="text-sm font-medium mb-3">
                  {selectedGoalPost.userGoal.description}
                </p>

                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Progresso</span>
                    <span className="font-medium">
                      {selectedGoalPost.userGoal.perc}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-brand h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${selectedGoalPost.userGoal.perc}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Check Button */}
              <Button
                onClick={handleIncrementGoalProgress}
                disabled={
                  isUpdatingGoal || selectedGoalPost.userGoal.perc >= 100
                }
                className="w-full rounded-full gap-2"
              >
                <Check className="h-4 w-4" />
                {isUpdatingGoal
                  ? "Atualizando..."
                  : selectedGoalPost.userGoal.perc >= 100
                    ? "Meta Completa!"
                    : "Incrementar Progresso (+1%)"}
              </Button>

              {/* Linked Routines Dropdown */}
              {linkedRoutines.length > 0 && (
                <div className="border border-border/60 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedRoutines(!expandedRoutines)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <h3 className="text-sm font-medium">
                      Rotinas Vinculadas ({linkedRoutines.length})
                    </h3>
                    <ChevronDown
                      className={`h-5 w-5 transform transition-transform ${
                        expandedRoutines ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {expandedRoutines && (
                    <div className="border-t border-border/60 bg-muted/20 p-4 space-y-3">
                      {linkedRoutines.map((routine) => (
                        <div
                          key={routine.id}
                          className="p-3 border border-border/60 rounded-lg bg-background"
                        >
                          <p className="font-medium text-sm">
                            {routine.type === 1
                              ? "🏋️ Exercicios"
                              : routine.type === 2
                                ? "🍽️ Dietas"
                                : "✅ Habitos"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
