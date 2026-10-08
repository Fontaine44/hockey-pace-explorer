import { expect, it } from "vitest";
import type { Game, TeamPace } from "@/lib/api";
import { createTeamPaceTraces } from "./team-pace";
import { PACE_TYPES } from "./polygrid";

const game = {
  away_team_id: 1,
  home_team_id: 2,
  away_team_name: "Away",
  home_team_name: "Home",
} as Game;
it("orders teams and periods, preserves zero, and identifies missing values for all components", () => {
  const data: TeamPace[] = [4, 1, null].flatMap((period) =>
    [1, 2].map((team_id) => ({
      period,
      team_id,
      modeled_elapsed_seconds: 10,
      speed_total_ft_s: 20,
      speed_ew_ft_s: 10,
      speed_ns_ft_s: 5,
      speed_n_ft_s: 0,
    })),
  );
  for (const type of PACE_TYPES) {
    const chart = createTeamPaceTraces(data, game, type.value);
    expect(chart.traces[0]).toMatchObject({
      name: "Away",
      x: ["Full game", "Period 1", "OT 1"],
      y: Array(3).fill(data[0][type.value]),
    });
    expect(chart.traces[1]).toMatchObject({ name: "Home" });
    expect(chart.missing).toEqual([]);
  }
  data[0].speed_total_ft_s = null;
  expect(createTeamPaceTraces(data, game, "speed_total_ft_s").missing).toEqual([
    "Away — OT 1",
  ]);
});
