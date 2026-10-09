import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components-custom/EmptyState";
import { ErrorState } from "@/components-custom/ErrorState";
import { LoadingState } from "@/components-custom/LoadingState";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PanelCardProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  error?: string | null;
  children?: ReactNode;
  fill?: boolean;
  className?: string;
  headerClassName?: string;
}

export function PanelCard({
  title = "",
  description,
  actions,
  loading = false,
  empty = false,
  emptyTitle,
  emptyDescription,
  error,
  children,
  fill = false,
  className,
  headerClassName,
}: PanelCardProps) {
  let content = children;
  if (loading)
    content = <LoadingState message={`Loading ${title.toLowerCase()}…`} />;
  else if (error) content = <ErrorState message={error} />;
  else if (empty)
    content = <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <Card className={cn(fill && "flex h-full min-h-0 flex-col", className)}>
      {(title || description || actions) && (
        <CardHeader
          className={cn(
            "flex-row items-start justify-between gap-4",
            headerClassName,
          )}
        >
          <div>
            <CardTitle>{title}</CardTitle>
            {description ? (
              <CardDescription className="mt-1">{description}</CardDescription>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </CardHeader>
      )}
      <CardContent className={fill ? "min-h-0 flex-1" : undefined}>
        {content}
      </CardContent>
    </Card>
  );
}
