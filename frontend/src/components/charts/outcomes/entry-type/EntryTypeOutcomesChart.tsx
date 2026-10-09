import { getEntryTypeOutcomes, type EntryTypeOutcome } from "@/lib/api";
import { OutcomeDataChart } from "../shared/OutcomeDataChart";
import { createEntryTypePlot } from "./entry-type-outcomes";

const hasEntryTypeData = (row: EntryTypeOutcome) =>
  row.entries > 0 &&
  (row.controlled_entry_pct !== null || row.dumped_entry_pct !== null);

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
