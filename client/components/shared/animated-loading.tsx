
export function LoadingSpinner({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <div className={`animate-spin ${className}`}>
      <svg
        className="h-full w-full text-brand"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    </div>
  );
}

export function SkeletonLoader({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gradient-to-r from-muted via-muted/50 to-muted rounded-md animate-pulse"
          style={{
            width: `${Math.random() * 30 + 70}%`,
            animationDelay: `${i * 100}ms`,
          }}
        ></div>
      ))}
    </div>
  );
}

/** Skeleton row for a list item with avatar + 2 lines */
function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-11 w-11 rounded-full bg-muted animate-pulse flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 bg-muted animate-pulse rounded w-2/5" />
        <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
      </div>
    </div>
  );
}

/** Skeleton mimicking the Community screen (tabs + list of group/conversation cards) */
export function CommunitySkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full max-w-2xl mx-auto px-4 pt-4 ${className}`}>
      {/* Header */}
      <div className="mb-4 space-y-2">
        <div className="h-6 w-40 bg-muted animate-pulse rounded" />
        <div className="h-3 w-64 bg-muted animate-pulse rounded" />
      </div>
      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <div className="h-9 w-24 rounded-full bg-muted animate-pulse" />
        <div className="h-9 w-24 rounded-full bg-muted animate-pulse" />
      </div>
      {/* List */}
      <div className="divide-y divide-border/40">
        {Array.from({ length: 6 }).map((_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** Skeleton mimicking the Goals screen (tabs + goal cards with progress) */
export function GoalsSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full max-w-2xl mx-auto px-4 pt-4 ${className}`}>
      <div className="mb-4 space-y-2">
        <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        <div className="h-3 w-56 bg-muted animate-pulse rounded" />
      </div>
      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <div className="h-9 w-24 rounded-full bg-muted animate-pulse" />
        <div className="h-9 w-24 rounded-full bg-muted animate-pulse" />
        <div className="h-9 w-24 rounded-full bg-muted animate-pulse" />
      </div>
      {/* Cards */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/40 bg-card p-4 space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
              </div>
            </div>
            <div className="h-2 w-full bg-muted animate-pulse rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton mimicking the Profile screen (avatar, stats, posts grid) */
export function ProfileSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full max-w-2xl mx-auto px-4 pt-4 ${className}`}>
      {/* Header: avatar + name */}
      <div className="flex flex-col items-center gap-3 mb-5">
        <div className="h-24 w-24 rounded-full bg-muted animate-pulse" />
        <div className="h-4 w-40 bg-muted animate-pulse rounded" />
        <div className="h-3 w-56 bg-muted animate-pulse rounded" />
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/40 bg-card p-3 flex flex-col items-center gap-2"
          >
            <div className="h-5 w-10 bg-muted animate-pulse rounded" />
            <div className="h-3 w-16 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </div>
      {/* Action buttons */}
      <div className="flex gap-2 mb-5">
        <div className="h-10 flex-1 rounded-full bg-muted animate-pulse" />
        <div className="h-10 flex-1 rounded-full bg-muted animate-pulse" />
      </div>
      {/* Posts grid */}
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-square bg-gradient-to-br from-muted via-muted/60 to-muted animate-pulse rounded-sm"
          />
        ))}
      </div>
    </div>
  );
}

/** Skeleton mimicking the Notifications screen (list of activity rows) */
export function NotificationsSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full max-w-2xl mx-auto px-4 pt-4 ${className}`}>
      <div className="mb-5 space-y-2">
        <div className="h-6 w-44 bg-muted animate-pulse rounded" />
        <div className="h-3 w-72 bg-muted animate-pulse rounded" />
      </div>
      <div className="divide-y divide-border/40">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted animate-pulse rounded w-5/6" />
              <div className="h-3 bg-muted animate-pulse rounded w-1/4" />
            </div>
            <div className="h-10 w-10 rounded-md bg-muted animate-pulse flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton mimicking the Messages screen (list of conversations) */

/** Skeleton mimicking the PostDetail screen (single post card with comments) */
export function PostDetailSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full max-w-2xl mx-auto px-4 pt-4 ${className}`}>
      {/* Author row */}
      <div className="flex items-center gap-3 mb-3">
        <div className="h-10 w-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-32 bg-muted animate-pulse rounded" />
          <div className="h-3 w-20 bg-muted animate-pulse rounded" />
        </div>
      </div>
      {/* Media */}
      <div className="w-full aspect-square rounded-lg bg-gradient-to-br from-muted via-muted/60 to-muted animate-pulse mb-3" />
      {/* Actions */}
      <div className="flex gap-3 mb-3">
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
      </div>
      {/* Description */}
      <div className="space-y-2 mb-5">
        <div className="h-3 bg-muted animate-pulse rounded w-full" />
        <div className="h-3 bg-muted animate-pulse rounded w-4/5" />
      </div>
      {/* Comments */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-muted animate-pulse rounded w-1/4" />
              <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton mimicking the Store screen (grid of product/professional cards) */
export function StoreSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full grid grid-cols-2 gap-3 auto-rows-fr ${className}`}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border/40 bg-card overflow-hidden"
        >
          <div className="w-full aspect-square bg-gradient-to-br from-muted via-muted/60 to-muted animate-pulse" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-3/4 bg-muted animate-pulse rounded" />
            <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton mimicking the Admin dashboard (stats cards + table) */
export function AdminSkeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full max-w-5xl mx-auto px-4 pt-4 ${className}`}>
      <div className="mb-5 space-y-2">
        <div className="h-6 w-36 bg-muted animate-pulse rounded" />
        <div className="h-3 w-64 bg-muted animate-pulse rounded" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/40 bg-card p-4 space-y-2"
          >
            <div className="h-3 w-20 bg-muted animate-pulse rounded" />
            <div className="h-6 w-16 bg-muted animate-pulse rounded" />
            <div className="h-3 w-12 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="rounded-xl border border-border/40 bg-card divide-y divide-border/40">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
              <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-8 w-20 rounded-md bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Skeleton that mimics a social feed post card */
export function PostSkeleton({ className = "", tall = false }: { className?: string; tall?: boolean }) {
  return (
    <div className={`rounded-lg border border-border/40 bg-card overflow-hidden ${className}`}>
      {/* Image placeholder */}
      <div
        className={`w-full bg-gradient-to-br from-muted via-muted/60 to-muted animate-pulse ${tall ? "" : "aspect-square"}`}
        style={tall ? { height: "calc(100dvh - max(14px, env(safe-area-inset-top) + 6px) - 314px - env(safe-area-inset-bottom))", maxHeight: "500px" } : undefined}
      />
      <div className="p-3 space-y-2">
        {/* User row */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-muted animate-pulse flex-shrink-0" />
          <div className="h-3 bg-muted animate-pulse rounded w-24" />
        </div>
        {/* Description lines */}
        <div className="h-3 bg-muted animate-pulse rounded w-full" />
        <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
      </div>
    </div>
  );
}
