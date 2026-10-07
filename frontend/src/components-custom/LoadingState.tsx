import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({
  message = "Loading…",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground",
        className,
      )}
      role="status"
    >
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
