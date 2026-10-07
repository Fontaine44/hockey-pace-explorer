import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title = "Nothing to show yet",
  description = "Content will appear here when it is available.",
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-36 flex-col items-center justify-center rounded-md border border-dashed p-6 text-center",
        className,
      )}
    >
      <Inbox className="mb-3 size-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
