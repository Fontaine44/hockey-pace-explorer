import { useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components-custom/EmptyState";
import { ErrorState } from "@/components-custom/ErrorState";
import { LoadingState } from "@/components-custom/LoadingState";
import { getEntryOutcomes, type EntryOutcome } from "@/lib/api";
import { createEntryOutcomePlot } from "./entry-outcomes";
import { OutcomePlot } from "../shared/OutcomePlot";

export function EntryOutcomesChart() {
  const [result, setResult] = useState<{
    rows: EntryOutcome[];
    error?: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getEntryOutcomes(controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setResult({ rows });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ rows: [], error: "Could not load zone-entry outcomes." });
      });
    return () => controller.abort();
  }, []);
  const figure = useMemo(
    () => createEntryOutcomePlot(result?.rows ?? []),
    [result],
  );
  if (!result) return <LoadingState message="Loading zone-entry outcomes…" />;
  if (result.error) return <ErrorState message={result.error} />;
  if (!result.rows.some((row) => row.entries > 0 && row.shot_pct !== null))
    return (
      <EmptyState
        title="No zone-entry outcomes"
        description="No measurable entries are available."
      />
    );
  const bands = new Set(result.rows.map((row) => row.quartile)).size;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <OutcomePlot
          figure={figure}
          label="Shot-producing carried and played entries by forward pace quartile"
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
