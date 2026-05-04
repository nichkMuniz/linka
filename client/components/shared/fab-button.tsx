import * as React from "react";
import { Plus } from "lucide-react";

interface FabButtonProps {
  onClick: () => void;
  title?: string;
  className?: string;
}

export function FabButton({ onClick, title, className = "" }: FabButtonProps) {
  return (
    <div className={`flex-shrink-0 flex justify-end px-4 py-3 ${className}`}>
      <button
        onClick={onClick}
        className="h-14 w-14 rounded-full bg-brand text-white flex items-center justify-center hover:bg-brand/90 active:scale-95 transition-all shadow-lg"
        title={title}
        aria-label={title}
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}
