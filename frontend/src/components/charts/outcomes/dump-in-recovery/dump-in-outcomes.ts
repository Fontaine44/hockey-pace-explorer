import type { DumpInOutcome } from "@/lib/api";
import {
  percentageLayout,
  percentageTrace,
  quartiles,
} from "../shared/percentage-outcomes";

export function createDumpInPlot(rows: DumpInOutcome[]) {
  const bars = quartiles(rows);
  const counts = bars.map((row) => row?.dump_ins ?? null);
  return {
    traces: [
      percentageTrace(
        "Team recovery within 5 s",
        bars.map((row) =>
          row && row.dump_ins > 0 ? row.team_recovery_pct : null,
        ),
        counts,
        "#b91c1c",
        true,
      ),
      percentageTrace(
        "No team recovery within 5 s",
        bars.map((row) =>
          row && row.dump_ins > 0 ? row.no_team_recovery_pct : null,
        ),
        counts,
        "#cbd5e1",
        true,
      ),
    ],
    layout: percentageLayout("Dump-ins (%)", true),
  };
}
