import { getDumpInOutcomes, type DumpInOutcome } from "@/lib/api";
import { OutcomeDataChart } from "../shared/OutcomeDataChart";
import { createDumpInPlot } from "./dump-in-outcomes";

const hasDumpInData = (row: DumpInOutcome) =>
  row.dump_ins > 0 &&
  (row.team_recovery_pct !== null || row.no_team_recovery_pct !== null);

export function DumpInOutcomesChart() {
  return (
    <OutcomeDataChart
      load={getDumpInOutcomes}
      createFigure={createDumpInPlot}
      hasData={hasDumpInData}
      name="dump-in outcomes"
      label="Team recovery within five seconds after dump-ins by total pace quartile"
    />
  );
}
