import type { Game } from "./api";

export function getTeamColor(
  game: Game | undefined,
  side: "home" | "away",
): string {
  return side === "home"
    ? (game?.home_team_color ?? "#b91c1c")
    : (game?.away_team_color ?? "#047857");
}
