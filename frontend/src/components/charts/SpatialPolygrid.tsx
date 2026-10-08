import { useMemo } from "react";
import { RinkPlot } from "@/components/charts/RinkPlot";
import {
  createPolygridTrace,
  type PaceType,
} from "@/components/charts/polygrid";
import type { PolygridCell } from "@/lib/api";
import { cn } from "@/lib/utils";

interface SpatialPolygridProps {
  cells: PolygridCell[];
  teamId: number;
  paceType: PaceType;
  className?: string;
}

export function SpatialPolygrid({
  cells,
  teamId,
  paceType,
  className,
}: SpatialPolygridProps) {
  const plot = useMemo(
    () => createPolygridTrace(cells, teamId, paceType),
    [cells, teamId, paceType],
  );
  const traces = useMemo(() => [plot.trace], [plot]);
  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-3", className)}>
      {plot.hasData ? (
        <RinkPlot traces={traces} className="flex-1" />
      ) : (
        <div
          role="status"
          className="flex flex-1 items-center justify-center text-sm text-muted-foreground"
        >
          No pace data for this team.
        </div>
      )}
      <div className="shrink-0 text-center text-sm font-medium text-slate-500">
        Attacking ⮞
      </div>
      <div
        aria-label={`Pace color scale: 0 to ${plot.max.toFixed(2)} feet per second`}
        className="mx-auto w-full max-w-sm shrink-0 space-y-1 text-xs text-muted-foreground"
      >
        <div
          className="h-3 rounded-sm"
          style={{
            background:
              "linear-gradient(to right, #440154, #482878, #3e4989, #31688e, #26828e, #1f9e89, #35b779, #6ece58, #b5de2b, #fde725)",
            opacity: 0.7,
          }}
        />
        <div className="flex justify-between">
          <span>0</span>
          <span>Pace (ft/s)</span>
          <span>{plot.max.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}
