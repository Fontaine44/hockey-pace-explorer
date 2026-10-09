import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components-custom/EmptyState";
import { ErrorState } from "@/components-custom/ErrorState";
import { LoadingState } from "@/components-custom/LoadingState";
import { getPassOutcomes, type PassOutcome } from "@/lib/api";
import { OutcomePlot } from "./OutcomePlot";
import { createPassOutcomePlot } from "./pass-outcomes";

export function PassOutcomesChart() {
  const [result, setResult] = useState<{
    rows: PassOutcome[];
    error?: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getPassOutcomes(controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setResult({ rows });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ rows: [], error: "Could not load pass outcomes." });
      });
    return () => controller.abort();
  }, []);
  const figure = useMemo(
    () => createPassOutcomePlot(result?.rows ?? []),
    [result],
  );
  if (!result) return <LoadingState message="Loading pass outcomes…" />;
  if (result.error) return <ErrorState message={result.error} />;
  if (
    !result.rows.some((row) => row.attempts > 0 && row.completion_pct !== null)
  )
    return (
      <EmptyState
        title="No pass outcomes"
        description="No measurable pass attempts are available."
      />
    );
  const bands = new Set(result.rows.map((row) => row.quartile)).size;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <OutcomePlot
          figure={figure}
          label="Direct and indirect pass completion by total pace quartile"
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
