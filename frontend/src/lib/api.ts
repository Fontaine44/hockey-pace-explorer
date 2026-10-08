export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
}

export interface PolygridCell {
  team_id: number;
  cell_id: number;
  grid_row: number;
  grid_column: number;
  modeled_elapsed_seconds: number;
  speed_total_ft_s: number | null;
  speed_ew_ft_s: number | null;
  speed_ns_ft_s: number | null;
  speed_n_ft_s: number | null;
}

export async function getGamePolygrid(
  gameId: string,
  signal?: AbortSignal,
): Promise<PolygridCell[]> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/games/${gameId}/polygrid`,
    { signal },
  );
  if (!response.ok)
    throw new Error(`Polygrid request failed with status ${response.status}`);
  return (await response.json()) as PolygridCell[];
}

export interface Game {
  game_id: number;
  game_date: string;
  home_team_id: number;
  away_team_id: number;
  home_team_name: string;
  away_team_name: string;
  source_dataset: string;
  periods: number[];
}

export interface Possession {
  possession_id: number;
  game_id: number;
  period: number;
  possession_team_id: number;
  team_name: string;
  start_event_id: number;
  end_event_id: number;
  start_clock_seconds: number;
  end_clock_seconds: number;
  event_count: number;
  elapsed_seconds: number;
  modeled_elapsed_seconds: number;
  speed_total_ft_s: number;
  pace_status: string;
  outcome: string;
  home_score: number;
  away_score: number;
  home_skaters: number;
  away_skaters: number;
  contains_goal: boolean;
}

export interface PossessionEvent {
  event_id: number;
  event: string;
  x: number | null;
  y: number | null;
  clock_seconds: number;
  team_id: number;
  player_name: string;
  player_id: number;
  detail_1: string | null;
  detail_2: string | null;
}

export async function getPossessionEvents(
  gameId: string,
  possessionId: number,
  signal?: AbortSignal,
): Promise<PossessionEvent[]> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/games/${gameId}/possessions/${possessionId}/events`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`Events request failed with status ${response.status}`);
  }
  return (await response.json()) as PossessionEvent[];
}

export async function getPossessions(
  gameId: string,
  period: string,
  signal?: AbortSignal,
): Promise<Possession[]> {
  const params = new URLSearchParams();
  if (period !== "all") params.set("period", period);
  const response = await fetch(
    `${getApiBaseUrl()}/api/games/${gameId}/possessions?${params}`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(
      `Possessions request failed with status ${response.status}`,
    );
  }
  return (await response.json()) as Possession[];
}

export async function getGames(
  sourceDataset: string,
  signal?: AbortSignal,
): Promise<Game[]> {
  const params = new URLSearchParams({ source_dataset: sourceDataset });
  const response = await fetch(`${getApiBaseUrl()}/api/games?${params}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Games request failed with status ${response.status}`);
  }
  return (await response.json()) as Game[];
}

function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${getApiBaseUrl()}/api/health`, { signal });

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
