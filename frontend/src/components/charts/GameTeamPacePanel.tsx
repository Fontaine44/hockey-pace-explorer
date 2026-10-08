import { useEffect, useMemo, useState } from "react";
import { ChartCard } from "./ChartCard";
import { TeamPaceChart } from "./TeamPaceChart";
import { createTeamPaceTraces } from "./team-pace";
import { PACE_TYPES, type PaceType } from "./polygrid";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getGamePace, type Game, type TeamPace } from "@/lib/api";

export function GameTeamPacePanel({ game }: { game: Game | undefined }) {
  return (
    <ChartCard fill title="Pace by team and period">
      {game ? (
        <GameTeamPaceContent key={game.game_id} game={game} />
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          Select a game.
        </p>
      )}
    </ChartCard>
  );
}

function GameTeamPaceContent({ game }: { game: Game }) {
  const [paceType, setPaceType] = useState<PaceType>("speed_total_ft_s");
  const [result, setResult] = useState<{
    data: TeamPace[];
    error: string | null;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getGamePace(String(game.game_id), controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ data, error: null });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({ data: [], error: "Unable to load team pace." });
      });
    return () => controller.abort();
  }, [game.game_id]);
  const chart = useMemo(
    () => createTeamPaceTraces(result?.data ?? [], game, paceType),
    [result, game, paceType],
  );
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 items-center justify-end gap-2">
        <label htmlFor="team-pace-type" className="text-sm font-medium">
          Pace:
        </label>
        <Select
          value={paceType}
          onValueChange={(value) => setPaceType(value as PaceType)}
        >
          <SelectTrigger
            id="team-pace-type"
            aria-label="Team pace type"
            className="w-40 bg-white"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PACE_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!result || result.error || !result.data.length ? (
        <p
          role={result?.error ? "alert" : "status"}
          className="text-sm text-muted-foreground"
        >
          {!result
            ? "Loading team pace..."
            : (result.error ?? "No team pace for this game.")}
        </p>
      ) : (
        <>
          <div className="min-h-0 flex-1">
            <TeamPaceChart traces={chart.traces} />
          </div>
          {chart.missing.length > 0 && (
            <p role="status" className="shrink-0 text-xs text-muted-foreground">
              No modeled exposure: {chart.missing.join("; ")}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
