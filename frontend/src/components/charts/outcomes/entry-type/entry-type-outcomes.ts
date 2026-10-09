import type { EntryTypeOutcome } from "@/lib/api";
import {
  percentageLayout,
  percentageTrace,
  quartiles,
} from "../shared/percentage-outcomes";

export function createEntryTypePlot(rows: EntryTypeOutcome[]) {
  const bars = quartiles(rows);
  const counts = bars.map((row) => row?.entries ?? null);
  const layout = percentageLayout("Entries (%)", true);
  return {
    traces: [
      percentageTrace(
        "Controlled",
        bars.map((row) =>
          row && row.entries > 0 ? row.controlled_entry_pct : null,
        ),
        counts,
        "#b91c1c",
        true,
      ),
      percentageTrace(
        "Dumped",
        bars.map((row) =>
          row && row.entries > 0 ? row.dumped_entry_pct : null,
        ),
        counts,
        "#cbd5e1",
        true,
      ),
    ],
    layout: {
      ...layout,
      margin: { ...layout.margin, t: 50 },
      legend: { ...layout.legend, y: 1.02 },
    },
  };
}
