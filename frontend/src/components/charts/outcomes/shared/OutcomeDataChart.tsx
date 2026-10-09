import { useEffect, useMemo, useState } from "react";
import type { Data, Layout } from "plotly.js";
import { EmptyState } from "@/components-custom/EmptyState";
import { ErrorState } from "@/components-custom/ErrorState";
import { LoadingState } from "@/components-custom/LoadingState";
import { OutcomePlot } from "./OutcomePlot";

interface OutcomeDataChartProps<T> {
  load: (signal?: AbortSignal) => Promise<T[]>;
  createFigure: (rows: T[]) => { traces: Data[]; layout: Partial<Layout> };
  hasData: (row: T) => boolean;
  name: string;
  label: string;
  note?: string;
}

export function OutcomeDataChart<T extends { quartile: number }>({
  load,
  createFigure,
  hasData,
  name,
  label,
  note,
}: OutcomeDataChartProps<T>) {
  const [result, setResult] = useState<{ rows: T[]; error?: string } | null>(
    null,
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((rows) => {
        if (!controller.signal.aborted) setResult({ rows });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ rows: [], error: `Could not load ${name}.` });
      });
    return () => controller.abort();
  }, [load, name]);
  const figure = useMemo(
    () => createFigure(result?.rows ?? []),
    [createFigure, result],
  );
  if (!result) return <LoadingState message={`Loading ${name}…`} />;
  if (result.error) return <ErrorState message={result.error} />;
  if (!result.rows.some(hasData))
    return (
      <EmptyState
        title={`No ${name}`}
        description="No measurable observations are available."
      />
    );
  const bands = new Set(result.rows.map((row) => row.quartile)).size;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <OutcomePlot figure={figure} label={label} />
      </div>
      {bands < 4 && (
        <p className="shrink-0 text-center text-xs text-muted-foreground">
          Only {bands} pace groups available; tied values prevent four
          quartiles.
        </p>
      )}
      {note && (
        <p className="shrink-0 text-center text-xs text-muted-foreground">
          {note}
        </p>
      )}
    </div>
  );
}
