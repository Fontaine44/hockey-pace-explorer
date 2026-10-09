import { getOzRecoveryOutcomes, type OzRecoveryOutcome } from "@/lib/api";
import { OutcomeDataChart } from "../shared/OutcomeDataChart";
import { createOzRecoveryPlot } from "./oz-recovery-outcomes";

const hasRecoveryData = (row: OzRecoveryOutcome) =>
  row.possessions > 0 && row.shot_pct !== null;

export function OzRecoveryOutcomesChart() {
  return (
    <OutcomeDataChart
      load={getOzRecoveryOutcomes}
      createFigure={createOzRecoveryPlot}
      hasData={hasRecoveryData}
      name="offensive-zone recovery outcomes"
      label="Shot generation after offensive-zone recovery by total pace quartile"
    />
  );
}
