import { expect, it } from "vitest";
import {
  createDumpInPlot,
  createEntryTypePlot,
  createOzRecoveryPlot,
} from "./remaining-outcomes";

const context = {
  quartile: 1,
  games: 10,
  median_pace_ft_s: 12,
  lower_pace_ft_s: 0,
  upper_pace_ft_s: 16,
};

it("plots stored offensive recovery percentages with observation counts", () => {
  const figure = createOzRecoveryPlot([
    {
      ...context,
      possessions: 100,
      shot_possessions: 43,
      shot_pct: 43,
      median_time_to_shot_seconds: 2,
    },
  ]);
  expect(figure.traces[0]).toMatchObject({
    y: [43, null, null, null],
    text: ["43.0%", "", "", ""],
    marker: { color: ["#fecaca", "#f87171", "#ef4444", "#b91c1c"] },
    customdata: [[100], [null], [null], [null]],
    hovertemplate:
      "Shot generation · %{x}: %{y:.1f}%<br>%{customdata[0]} observations<extra></extra>",
  });
});

it("stacks controlled and dumped entries on a 0–100% scale", () => {
  const figure = createEntryTypePlot([
    {
      ...context,
      entries: 100,
      controlled_entries: 70,
      dumped_entries: 30,
      controlled_entry_pct: 70,
      dumped_entry_pct: 30,
    },
  ]);
  expect(figure.layout.barmode).toBe("stack");
  expect(figure.layout.yaxis?.range).toEqual([0, 100]);
  expect(figure.traces[0]).toMatchObject({
    name: "Controlled",
    y: [70, null, null, null],
    marker: { color: "#b91c1c" },
  });
  expect(figure.traces[1]).toMatchObject({
    name: "Dumped",
    y: [30, null, null, null],
  });
});

it("keeps unresolved dump-ins in the denominator without rendering a segment", () => {
  const figure = createDumpInPlot([
    {
      ...context,
      dump_ins: 100,
      team_recoveries: 25,
      no_team_recovery: 70,
      unresolved: 5,
      team_recovery_pct: 25,
      no_team_recovery_pct: 70,
      unresolved_pct: 5,
    },
  ]);
  expect(figure.traces).toHaveLength(2);
  expect(figure.traces[0]).toMatchObject({
    y: [25, null, null, null],
    customdata: [[100], [null], [null], [null]],
  });
  expect(figure.traces[1]).toMatchObject({ y: [70, null, null, null] });
  expect(figure.layout.barmode).toBe("stack");
});

it("preserves genuine zeros and leaves missing or unobserved groups blank", () => {
  const figure = createOzRecoveryPlot([
    {
      ...context,
      possessions: 100,
      shot_possessions: 0,
      shot_pct: 0,
      median_time_to_shot_seconds: null,
    },
    {
      ...context,
      quartile: 2,
      possessions: 0,
      shot_possessions: 0,
      shot_pct: 0,
      median_time_to_shot_seconds: null,
    },
  ]);
  expect(figure.traces[0]).toMatchObject({
    y: [0, null, null, null],
    text: ["0.0%", "", "", ""],
  });
});
