import type { EntryOutcome } from "@/lib/api";
import { createQuartileOutcomePlot } from "../shared/quartile-outcomes";

export function createEntryOutcomePlot(rows: EntryOutcome[]) {
  return createQuartileOutcomePlot(
    rows.map((row) => ({
      ...row,
      group: row.entry_type,
      observations: row.entries,
      percentage: row.shot_pct,
    })),
    ["Carried", "Played"],
    "Forward pace quartile",
    "Shot-producing entries (%)",
    ["Carried", "Played (Pass)"],
  );
}
