import { ChartCard } from "@/components/charts/ChartCard";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getGames, type Game } from "@/lib/api";
import { useEffect, useState } from "react";

export function GameReviewPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getGames("Olympics 2022", controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setGames(data);
        setSelectedGameId(data.length ? String(data[0].game_id) : "");
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Unable to load games.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center gap-3">
        <label htmlFor="game-selector" className="text-sm font-medium">
          Game:
        </label>
        <Select
          value={selectedGameId}
          onValueChange={setSelectedGameId}
          disabled={loading || games.length === 0}
        >
          <SelectTrigger
            id="game-selector"
            aria-label="Select game"
            className="w-[480px] bg-white"
          >
            <SelectValue
              placeholder={
                loading
                  ? "Loading games..."
                  : error
                    ? "Unavailable"
                    : "No games found"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {games.map((game) => (
                <SelectItem key={game.game_id} value={String(game.game_id)}>
                  {game.game_date} · {game.away_team_name} @{" "}
                  {game.home_team_name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <section
        aria-label="Game review panels"
        className="items-stretch gap-4"

        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gridTemplateRows: "repeat(2, minmax(0, 1fr))",
          flex: 1,
          minHeight: 0,
        }}
      >
        <ChartCard fill title="Sequence review" className="col-span-2">
          <div className="grid h-full grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium">Selected sequence on rink</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Placeholder for the selected sequence, period, start clock,
                score, controlling team, and rink events.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium">Sequence selector</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Placeholder for the sequence list, period filter, and
                previous/next navigation.
              </p>
            </div>
          </div>
        </ChartCard>
        <ChartCard fill title="Whole-game pace polygrid">
          <p className="text-sm text-muted-foreground">
            Placeholder for whole-game team and pace selectors, rink map, and
            ft/s legend.
          </p>
        </ChartCard>
        <ChartCard fill title="Pace by team and period">
          <p className="text-sm text-muted-foreground">
            Placeholder for the independent pace selector and team comparison
            across the full game and available periods.
          </p>
        </ChartCard>
      </section>
    </div>
  );
}
