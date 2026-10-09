import { expect, it } from "vitest";
import { createOzRecoveryPlot } from "./oz-recovery-outcomes";

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
