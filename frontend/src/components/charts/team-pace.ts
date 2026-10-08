import { getTeamColor } from "@/lib/team-colors";
import type { Data } from "plotly.js";
import type { Game, TeamPace } from "@/lib/api";
import type { PaceType } from "./polygrid";

export function createTeamPaceTraces(
  data: TeamPace[],
  game: Game,
  paceType: PaceType,
) {
  const periods = [
    ...new Set(
      data.flatMap((row) => (row.period === null ? [] : [row.period])),
    ),
  ].sort((a, b) => a - b);
  const categories: (number | null)[] = [null, ...periods];
  const labels = categories.map((period) =>
    period === null
      ? "Full game"
      : period <= 3
        ? `Period ${period}`
        : `OT ${period - 3}`,
  );
  const missing: string[] = [];
  const traces: Data[] = [
    {
      id: game.away_team_id,
      name: game.away_team_name,
      color: getTeamColor(game, "away"),
    },
    {
      id: game.home_team_id,
      name: game.home_team_name,
      color: getTeamColor(game, "home"),
    },
  ].map((team) => {
    const rows = categories.map((period) =>
      data.find((row) => row.team_id === team.id && row.period === period),
    );
    rows.forEach((row, index) => {
      if (row?.[paceType] == null)
        missing.push(`${team.name} — ${labels[index]}`);
    });
    return {
      type: "bar",
      name: team.name,
      x: labels,
      y: rows.map((row) => row?.[paceType] ?? null),
      customdata: rows.map((row) => row?.modeled_elapsed_seconds ?? 0),
      marker: { color: team.color },
      text: rows.map((row) => row?.[paceType]?.toFixed(1) ?? ""),
      textposition: "outside",
      cliponaxis: false,
      hovertemplate:
        "%{fullData.name}<br>%{x}<br>Pace: %{y:.1f} ft/s<extra></extra>",
    };
  });
  return { traces, missing };
}
