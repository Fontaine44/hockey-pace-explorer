import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components-custom/EmptyState";
import { ErrorState } from "@/components-custom/ErrorState";
import { LoadingState } from "@/components-custom/LoadingState";
import { getShotOutcomes, type ShotOutcome } from "@/lib/api";
import { OutcomePlot } from "./OutcomePlot";
import { createShotOutcomePlot } from "./shot-outcomes";

export function ShotOutcomesChart() {
  const [result, setResult] = useState<{
    rows: ShotOutcome[];
    error?: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getShotOutcomes(controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setResult({ rows });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ rows: [], error: "Could not load shot outcomes." });
      });
    return () => controller.abort();
  }, []);
  const figure = useMemo(
    () => createShotOutcomePlot(result?.rows ?? []),
    [result],
  );
  if (!result) return <LoadingState message="Loading shot outcomes…" />;
  if (result.error) return <ErrorState message={result.error} />;
  if (
    !result.rows.some(
      (row) =>
        (row.attempts > 0 && row.on_net_pct !== null) ||
        (row.distance_attempts > 0 && row.mean_distance_ft !== null),
    )
  )
    return (
      <EmptyState
        title="No shot outcomes"
        description="No measurable shot attempts are available."
      />
    );
  const bands = new Set(result.rows.map((row) => row.quartile)).size;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <OutcomePlot
          figure={figure}
          label="Mean shot distance and on-net percentage by total pace quartile"
        />
      </div>
      {bands < 4 && (
        <p className="shrink-0 text-center text-xs text-muted-foreground">
          Only {bands} pace groups available; tied values prevent four
          quartiles.
        </p>
      )}
    </div>
  );
}
