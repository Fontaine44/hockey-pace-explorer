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
