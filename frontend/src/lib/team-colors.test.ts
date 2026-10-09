import { describe, expect, it } from "vitest";
import type { Game, PossessionEvent, TeamPace } from "./api";
import { getTeamColor } from "./team-colors";
import { createRinkEventPlot } from "@/components/charts/game-review/possession/rink-events";
import { createTeamPaceTraces } from "@/components/charts/game-review/team-pace/team-pace";

const game: Game = {
  game_id: 16,
  game_date: "2022-02-03",
  away_team_id: 8,
  home_team_id: 9,
  away_team_name: "Finland",
  home_team_name: "Olympic Athletes from Russia",
  away_team_color: "#0077B6",
  home_team_color: "#7B3294",
  source_dataset: "Olympics 2022",
  periods: [1, 2, 3],
};

function event(
  id: number,
  name: string,
  teamId = game.away_team_id,
): PossessionEvent {
  return {
    event_id: id,
    event: name,
    team_id: teamId,
    x: 20 + id * 10,
    y: 40,
    clock_seconds: 1200 - id,
    player_name: "Player",
    player_id: 1,
    detail_1: null,
    detail_2: null,
  };
}

describe("team colors", () => {
  it("uses database colors and keeps existing fallbacks for null colors", () => {
    expect(getTeamColor(game, "away")).toBe("#0077B6");
    expect(getTeamColor(game, "home")).toBe("#7B3294");
    const uncolored = { ...game, home_team_color: null, away_team_color: null };
    expect(getTeamColor(uncolored, "away")).toBe("#047857");
    expect(getTeamColor(uncolored, "home")).toBe("#b91c1c");
    expect(getTeamColor(undefined, "away")).toBe("#047857");
  });

  it("colors movement, markers and shot arrows without changing home rotation or gold goals", () => {
    const plot = createRinkEventPlot(
      [
        event(1, "Puck Recovery"),
        event(2, "Shot"),
        event(3, "Shot", game.home_team_id),
        event(4, "Goal", game.home_team_id),
      ],
      game,
    );
    const lines = plot.traces.filter(
      (trace) => "mode" in trace && trace.mode === "lines",
    );
    expect(lines[0]).toMatchObject({ line: { color: game.away_team_color } });
    const markers = plot.traces.filter(
      (trace) => "mode" in trace && trace.mode === "text+markers",
    );
    expect(markers[0]).toMatchObject({
      marker: { color: game.away_team_color },
      textfont: { color: "white" },
    });
    expect(markers[2]).toMatchObject({
      marker: { color: game.home_team_color },
      x: [150],
      y: [45],
    });
    expect(markers[3]).toMatchObject({
      marker: { color: "#fbbf24", symbol: "triangle-up" },
    });
    expect(plot.annotations[0].arrowcolor).toBe(game.away_team_color);
    expect(plot.annotations[1].arrowcolor).toBe(game.home_team_color);
    const switched = createRinkEventPlot([event(1, "Shot")], {
      ...game,
      away_team_color: "#C8102E",
    });
    expect(switched.annotations[0].arrowcolor).toBe("#C8102E");
  });

  it("uses the same colors for away-first team pace bars", () => {
    const data: TeamPace[] = [game.away_team_id, game.home_team_id].map(
      (team_id) => ({
        team_id,
        period: null,
        modeled_elapsed_seconds: 10,
        speed_total_ft_s: 2,
        speed_ew_ft_s: 1,
        speed_ns_ft_s: 1,
        speed_n_ft_s: 1,
      }),
    );
    const { traces } = createTeamPaceTraces(data, game, "speed_total_ft_s");
    expect(traces[0]).toMatchObject({
      name: "Finland",
      marker: { color: game.away_team_color },
    });
    expect(traces[1]).toMatchObject({
      name: game.home_team_name,
      marker: { color: game.home_team_color },
    });
  });
});
