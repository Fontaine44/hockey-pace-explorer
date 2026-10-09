import { expect, it } from "vitest";
import type { PassOutcome } from "@/lib/api";
import { createPassOutcomePlot } from "./pass-outcomes";

const row: PassOutcome = {
  pass_type: "Direct",
  quartile: 2,
  attempts: 100,
  completed: 72,
  games: 10,
  median_pace_ft_s: 14,
  completion_pct: 72,
  lower_pace_ft_s: 10,
  upper_pace_ft_s: 17,
};

it("uses stored completion, direct/indirect panels, and simple observation hover", () => {
  const figure = createPassOutcomePlot([row]);
  expect(figure.traces[0]).toMatchObject({
    name: "Direct",
    y: [null, 72, null, null],
    text: ["", "72.0%", "", ""],
    marker: { color: ["#fecaca", "#f87171", "#ef4444", "#b91c1c"] },
    hovertemplate:
      "Direct · %{x}: %{y:.1f}%<br>%{customdata[0]} observations<extra></extra>",
  });
  expect(figure.traces[1]).toMatchObject({ name: "Indirect", xaxis: "x2" });
  expect(figure.layout.yaxis?.range).toEqual([0, 100]);
  expect(figure.layout.xaxis?.title).toMatchObject({
    text: "Total pace quartile",
  });
});

it("preserves zero completion rates and leaves missing or empty groups blank", () => {
  const figure = createPassOutcomePlot([
    { ...row, quartile: 1, completion_pct: 0, completed: 0 },
    { ...row, quartile: 2, completion_pct: null },
    { ...row, quartile: 3, attempts: 0, completion_pct: 0 },
  ]);
  expect(figure.traces[0]).toMatchObject({
    y: [0, null, null, null],
    text: ["0.0%", "", "", ""],
  });
});
