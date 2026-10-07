export interface HealthResponse {
  status: "ok";
  service: string;
  version: string;
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
  speed_total_ft_s: number;
  pace_status: string;
  outcome: string;
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
