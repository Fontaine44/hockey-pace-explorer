import type { OzRecoveryOutcome } from "@/lib/api";
import {
  percentageLayout,
  percentageTrace,
  quartiles,
} from "../shared/percentage-outcomes";
import { OUTCOME_QUARTILE_COLORS } from "../shared/outcome-style";

export function createOzRecoveryPlot(rows: OzRecoveryOutcome[]) {
  const bars = quartiles(rows);
  return {
    traces: [
      percentageTrace(
        "Shot generation",
        bars.map((row) => (row && row.possessions > 0 ? row.shot_pct : null)),
        bars.map((row) => row?.possessions ?? null),
        OUTCOME_QUARTILE_COLORS,
      ),
    ],
    layout: percentageLayout("Shot-producing possessions (%)"),
  };
}
