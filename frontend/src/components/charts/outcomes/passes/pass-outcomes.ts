import type { PassOutcome } from "@/lib/api";
import { createQuartileOutcomePlot } from "../shared/quartile-outcomes";

export function createPassOutcomePlot(rows: PassOutcome[]) {
  return createQuartileOutcomePlot(
    rows.map((row) => ({
      ...row,
      group: row.pass_type,
      observations: row.attempts,
      successes: row.completed,
      percentage: row.completion_pct,
    })),
    ["Direct", "Indirect"],
    "Total pace quartile",
    "Pass completion (%)",
  );
}
