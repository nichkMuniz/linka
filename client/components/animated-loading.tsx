import * as React from "react";

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

export function LoadingDots({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-1 ${className}`}>
      <div className="h-2 w-2 rounded-full bg-brand animate-bounce" style={{ animationDelay: "0ms" }}></div>
      <div className="h-2 w-2 rounded-full bg-brand animate-bounce" style={{ animationDelay: "150ms" }}></div>
      <div className="h-2 w-2 rounded-full bg-brand animate-bounce" style={{ animationDelay: "300ms" }}></div>
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

export function LoadingCard({ className = "" }: { className?: string }) {
  return (
    <div className={`p-4 rounded-lg border border-border/40 bg-muted/20 ${className}`}>
      <div className="space-y-3">
        <div className="h-4 bg-gradient-to-r from-muted via-muted/50 to-muted rounded-md animate-pulse w-3/4"></div>
        <div className="h-3 bg-gradient-to-r from-muted via-muted/50 to-muted rounded-md animate-pulse w-full"></div>
        <div className="h-3 bg-gradient-to-r from-muted via-muted/50 to-muted rounded-md animate-pulse w-5/6"></div>
      </div>
    </div>
  );
}
