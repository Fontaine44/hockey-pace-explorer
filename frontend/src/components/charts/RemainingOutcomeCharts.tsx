import {
  getDumpInOutcomes,
  getEntryTypeOutcomes,
  getOzRecoveryOutcomes,
  type DumpInOutcome,
  type EntryTypeOutcome,
  type OzRecoveryOutcome,
} from "@/lib/api";
import { OutcomeDataChart } from "./OutcomeDataChart";
import {
  createDumpInPlot,
  createEntryTypePlot,
  createOzRecoveryPlot,
} from "./remaining-outcomes";

const hasRecoveryData = (row: OzRecoveryOutcome) =>
  row.possessions > 0 && row.shot_pct !== null;
const hasEntryTypeData = (row: EntryTypeOutcome) =>
  row.entries > 0 &&
  (row.controlled_entry_pct !== null || row.dumped_entry_pct !== null);
const hasDumpInData = (row: DumpInOutcome) =>
  row.dump_ins > 0 &&
  (row.team_recovery_pct !== null || row.no_team_recovery_pct !== null);

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

export function EntryTypeOutcomesChart() {
  return (
    <OutcomeDataChart
      load={getEntryTypeOutcomes}
      createFigure={createEntryTypePlot}
      hasData={hasEntryTypeData}
      name="entry type outcomes"
      label="Controlled and dumped entries by total pace quartile"
    />
  );
}

export function DumpInOutcomesChart() {
  return (
    <OutcomeDataChart
      load={getDumpInOutcomes}
      createFigure={createDumpInPlot}
      hasData={hasDumpInData}
      name="dump-in outcomes"
      label="Team recovery within five seconds after dump-ins by total pace quartile"
      note="Unresolved attempts remain in the denominator."
    />
  );
}
