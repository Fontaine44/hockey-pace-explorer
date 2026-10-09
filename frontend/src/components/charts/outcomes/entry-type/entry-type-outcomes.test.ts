import { expect, it } from "vitest";
import { createEntryTypePlot } from "./entry-type-outcomes";

const context = {
  quartile: 1,
  games: 10,
  median_pace_ft_s: 12,
  lower_pace_ft_s: 0,
  upper_pace_ft_s: 16,
};

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
