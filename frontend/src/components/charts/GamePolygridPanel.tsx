import { useEffect, useState } from "react";
import { PanelCard } from "@/components-custom/PanelCard";
import { SpatialPolygrid } from "@/components/charts/SpatialPolygrid";
import { PACE_TYPES, type PaceType } from "@/components/charts/polygrid";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getGamePolygrid, type Game, type PolygridCell } from "@/lib/api";

const EMPTY_CELLS: PolygridCell[] = [];

export function GamePolygridPanel({ game }: { game: Game | undefined }) {
  return (
    <PanelCard fill title="Pace spatial polygrid">
      {game ? (
        <GamePolygridContent game={game} />
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          Select a game.
        </p>
      )}
    </PanelCard>
  );
}

function GamePolygridContent({ game }: { game: Game }) {
  const [teamId, setTeamId] = useState(game.away_team_id);
  const [paceType, setPaceType] = useState<PaceType>("speed_total_ft_s");
  const [selectorGameId, setSelectorGameId] = useState(game.game_id);
  if (selectorGameId !== game.game_id) {
    setSelectorGameId(game.game_id);
    setPaceType("speed_total_ft_s");
    setTeamId(game.away_team_id);
  }
  const [loadedResult, setResult] = useState<{
    gameId: number;
    data: PolygridCell[];
    error: string | null;
  } | null>(null);
  const result = loadedResult?.gameId === game.game_id ? loadedResult : null;
  useEffect(() => {
    const controller = new AbortController();
    getGamePolygrid(String(game.game_id), controller.signal)
      .then((data) => {
        if (!controller.signal.aborted)
          setResult({ gameId: game.game_id, data, error: null });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setResult({
            gameId: game.game_id,
            data: [],
            error: "Unable to load spatial pace.",
          });
      });
    return () => controller.abort();
  }, [game.game_id]);
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <ButtonGroup aria-label="Polygrid team">
          {[
            { id: game.away_team_id, name: game.away_team_name },
            { id: game.home_team_id, name: game.home_team_name },
          ].map((team) => (
            <Button
              key={team.id}
              variant={teamId === team.id ? "default" : "outline"}
              aria-pressed={teamId === team.id}
              className="cursor-pointer aria-pressed:bg-slate-900 aria-pressed:text-white aria-pressed:hover:bg-slate-800"
              onClick={() => setTeamId(team.id)}
            >
              {team.name}
            </Button>
          ))}
        </ButtonGroup>
        <div className="flex items-center gap-2">
          <label htmlFor="polygrid-pace-type" className="text-sm font-medium">
            Pace:
          </label>
          <Select
            value={paceType}
            onValueChange={(value) => setPaceType(value as PaceType)}
          >
            <SelectTrigger
              id="polygrid-pace-type"
              aria-label="Pace type"
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
      </div>
      <div className="relative min-h-0 flex-1">
        <SpatialPolygrid
          cells={result?.data ?? EMPTY_CELLS}
          teamId={teamId}
          paceType={paceType}
          className={
            !result || result.error || !result.data.length
              ? "invisible"
              : undefined
          }
        />
        {(!result || result.error || !result.data.length) && (
          <p
            role={result?.error ? "alert" : "status"}
            className="absolute inset-x-0 top-0 text-sm text-muted-foreground"
          >
            {!result
              ? "Loading spatial pace..."
              : (result.error ?? "No spatial pace for this game.")}
          </p>
        )}
      </div>
    </div>
  );
}
