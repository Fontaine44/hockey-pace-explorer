import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  helperText?: string;
  secondaryValue?: ReactNode;
  icon?: LucideIcon;
  loading?: boolean;
  formatter?: (value: ReactNode) => ReactNode;
}

export function MetricCard({
  label,
  value,
  helperText,
  secondaryValue,
  icon: Icon,
  loading = false,
  formatter = (metricValue) => metricValue,
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon ? (
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-7 w-28" aria-label={`Loading ${label}`} />
        ) : (
          <p className="text-2xl font-semibold">{formatter(value)}</p>
        )}
        {!loading && secondaryValue ? (
          <div className="mt-1 text-sm font-medium text-primary">
            {secondaryValue}
          </div>
        ) : null}
        {helperText ? (
          <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
