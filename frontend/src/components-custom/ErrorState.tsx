import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-36 flex-col items-center justify-center rounded-md border border-destructive/30 p-6 text-center",
        className,
      )}
      role="alert"
    >
      <CircleAlert
        className="mb-3 size-5 text-destructive"
        aria-hidden="true"
      />
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
