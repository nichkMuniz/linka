import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Hash } from "lucide-react";
import { useLanguage } from "@/lib/language-context";
import { searchPostsByHashtagDb, type HashtagPost } from "@/lib/ritmofit-db";
import { getPostGradient } from "@/lib/post-visuals";
import { LoadingSpinner } from "@/components/shared/animated-loading";

/**
 * Página de uma hashtag — grade de posts (estilo Instagram) que contêm a #tag na
 * descrição. Aberta ao tocar numa hashtag destacada numa legenda (feed/PostDetail).
 * Cada thumbnail navega para o post isolado (`/post/:id`).
 */
export default function Hashtag() {
  const { tag: rawTag } = useParams<{ tag: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const tag = (rawTag ?? "").replace(/^#/, "");

  const [posts, setPosts] = React.useState<HashtagPost[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchPostsByHashtagDb(tag)
      .then((data) => {
        if (!cancelled) setPosts(data);
      })
      .catch((err) => console.error("Erro ao buscar hashtag:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tag]);

  const countLabel = (
    posts.length === 1 ? t("hashtag_post_count_one") : t("hashtag_posts_count")
  ).replace("{n}", String(posts.length));

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pt-2 pb-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 py-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t("goals_back")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground transition-smooth active:scale-90"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
            style={{ background: "linear-gradient(135deg,#3A8DFF,#7B3FF2)" }}
          >
            <Hash className="h-5 w-5" strokeWidth={2.4} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight">#{tag}</h1>
            {!loading && (
              <p className="text-xs text-muted-foreground">{countLabel}</p>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Hash className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">
            {t("hashtag_empty_title").replace("{tag}", tag)}
          </p>
          <p className="max-w-xs text-xs text-muted-foreground">
            {t("hashtag_empty_desc")}
          </p>
        </div>
      ) : (
        <div className="mt-1 grid grid-cols-3 gap-[5px] sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {posts.map((post) => {
            const thumb = post.photo || post.photos?.[0] || "";
            return (
              <button
                key={post.id}
                onClick={() => navigate(`/post/${post.id}`)}
                className="group relative aspect-square overflow-hidden rounded-[14px] bg-muted transition-all"
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={post.description}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform group-hover:scale-110"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center"
                    style={{ background: getPostGradient(post.id) }}
                  >
                    <Hash className="h-6 w-6 text-white/70" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                {post.photos && post.photos.length > 1 && (
                  <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md bg-white/90 px-1.5 py-0.5">
                    <span className="text-xs font-semibold text-black">📷</span>
                    <span className="text-xs font-semibold text-black">
                      {post.photos.length}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
