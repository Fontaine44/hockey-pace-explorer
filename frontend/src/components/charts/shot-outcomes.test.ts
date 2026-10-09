import { expect, it } from "vitest";
import type { ShotOutcome } from "@/lib/api";
import { createShotOutcomePlot } from "./shot-outcomes";

const row: ShotOutcome = {
  quartile: 2,
  attempts: 100,
  on_net_attempts: 44,
  games: 10,
  median_pace_ft_s: 15,
  mean_distance_ft: 36.123,
  distance_attempts: 90,
  on_net_pct: 44,
  lower_pace_ft_s: 10,
  upper_pace_ft_s: 20,
};

it("uses distinct distance and percentage scales with the shared red theme", () => {
  const figure = createShotOutcomePlot([row]);
  expect(figure.traces[0]).toMatchObject({
    name: "Mean shot distance",
    y: [null, 36.123, null, null],
    text: ["", "36.1", "", ""],
    marker: { color: ["#fecaca", "#f87171", "#ef4444", "#b91c1c"] },
    customdata: [[null], [90], [null], [null]],
    hovertemplate:
      "Mean shot distance · %{x}: %{y:.1f} ft<br>%{customdata[0]} observations<extra></extra>",
  });
  expect(figure.traces[1]).toMatchObject({
    y: [null, 44, null, null],
    text: ["", "44.0%", "", ""],
    customdata: [[null], [100], [null], [null]],
    yaxis: "y2",
  });
  expect(figure.layout.yaxis?.rangemode).toBe("tozero");
  expect(figure.layout.yaxis2?.range).toEqual([0, 100]);
  expect(figure.layout.yaxis2?.matches).toBeUndefined();
});

it("retains genuine zeros and handles missing distances independently", () => {
  const figure = createShotOutcomePlot([
    { ...row, quartile: 1, mean_distance_ft: 0, on_net_pct: 0 },
    { ...row, quartile: 2, mean_distance_ft: null },
    { ...row, quartile: 3, distance_attempts: 0, mean_distance_ft: 0 },
  ]);
  expect(figure.traces[0]).toMatchObject({ y: [0, null, null, null] });
  expect(figure.traces[1]).toMatchObject({ y: [0, 44, 44, null] });
});
