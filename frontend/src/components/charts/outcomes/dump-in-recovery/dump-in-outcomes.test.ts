import { expect, it } from "vitest";
import { createDumpInPlot } from "./dump-in-outcomes";

const context = {
  quartile: 1,
  games: 10,
  median_pace_ft_s: 12,
  lower_pace_ft_s: 0,
  upper_pace_ft_s: 16,
};

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
