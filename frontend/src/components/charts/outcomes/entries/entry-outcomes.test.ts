import { describe, expect, it } from "vitest";
import type { EntryOutcome } from "@/lib/api";
import { createEntryOutcomePlot } from "./entry-outcomes";

const row: EntryOutcome = {
  entry_type: "Carried",
  quartile: 2,
  entries: 100,
  successes: 42,
  games: 12,
  median_pace_ft_s: 14,
  shot_pct: 42,
  lower_pace_ft_s: 10,
  upper_pace_ft_s: 17,
};

describe("entry outcome plot", () => {
  it("preserves percentages, quartile order, colors, and hover context", () => {
    const plot = createEntryOutcomePlot([row]);
    expect(plot.traces[0]).toMatchObject({
      name: "Carried",
      x: ["Q1", "Q2", "Q3", "Q4"],
      y: [null, 42, null, null],
      text: ["", "42.0%", "", ""],
      marker: { color: ["#fecaca", "#f87171", "#ef4444", "#b91c1c"] },
      customdata: [
        [null, null, null, null, null, null],
        [100, 42, 12, 10, 17, 14],
        [null, null, null, null, null, null],
        [null, null, null, null, null, null],
      ],
    });
    expect(plot.layout.yaxis?.range).toEqual([0, 100]);
    expect(plot.layout.yaxis2?.range).toEqual([0, 100]);
    expect(plot.traces[1]).toMatchObject({ name: "Played", xaxis: "x2" });
  });

  it("retains genuine zero rates and leaves undefined or empty groups blank", () => {
    const plot = createEntryOutcomePlot([
      { ...row, quartile: 1, shot_pct: 0, successes: 0 },
      { ...row, quartile: 2, shot_pct: null },
      { ...row, quartile: 3, entries: 0, shot_pct: 0 },
    ]);
    expect(plot.traces[0]).toMatchObject({
      y: [0, null, null, null],
      text: ["0.0%", "", "", ""],
    });
  });
});
