import type { ReactNode } from "react";

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

interface ChartCardProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  error?: string | null;
  children?: ReactNode;
}

export function ChartCard({
  title,
  description,
  actions,
  loading = false,
  empty = false,
  emptyTitle,
  emptyDescription,
  error,
  children,
}: ChartCardProps) {
  let content = children;
  if (loading)
    content = <LoadingState message={`Loading ${title.toLowerCase()}…`} />;
  else if (error) content = <ErrorState message={error} />;
  else if (empty)
    content = <EmptyState title={emptyTitle} description={emptyDescription} />;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? (
            <CardDescription className="mt-1">{description}</CardDescription>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
