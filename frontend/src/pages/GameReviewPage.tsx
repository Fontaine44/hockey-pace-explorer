import { ChartCard } from "@/components/charts/ChartCard";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getGames,
  getPossessions,
  type Game,
  type Possession,
} from "@/lib/api";
import { useEffect, useState } from "react";

function formatClock(seconds: number): string {
  const clock = Math.floor(seconds);
  return `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, "0")}`;
}

export function GameReviewPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState("1");
  const [possessionResult, setPossessionResult] = useState<{
    key: string;
    data: Possession[];
    error: string | null;
  } | null>(null);
  const possessionKey = `${selectedGameId}:${period}`;
  const currentResult =
    possessionResult?.key === possessionKey ? possessionResult : null;
  const selectedGame = games.find(
    (game) => String(game.game_id) === selectedGameId,
  );

  useEffect(() => {
    if (!selectedGameId) return;
    const controller = new AbortController();
    getPossessions(selectedGameId, period, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setPossessionResult({ key: possessionKey, data, error: null });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPossessionResult({
            key: possessionKey,
            data: [],
            error: "Unable to load possessions.",
          });
        }
      });
    return () => controller.abort();
  }, [selectedGameId, period, possessionKey]);

  useEffect(() => {
    const controller = new AbortController();
    getGames("Olympics 2022", controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setGames(data);
        setSelectedGameId(data.length ? String(data[0].game_id) : "");
        setPeriod(String(data[0]?.periods[0] ?? 1));
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
    <div className="flex h-full min-h-0 shrink-0 flex-col gap-4">
      <div className="flex shrink-0 items-center gap-3">
        <label htmlFor="game-selector" className="text-sm font-medium">
          Game:
        </label>
        <Select
          value={selectedGameId}
          onValueChange={(value) => {
            setSelectedGameId(value);
            setPeriod(
              String(
                games.find((game) => String(game.game_id) === value)
                  ?.periods[0] ?? 1,
              ),
            );
          }}
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

      <section aria-label="Game review panels" className="min-h-0 flex-1">
        <div
          className="items-stretch gap-4 pb-4"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gridTemplateRows: "repeat(2, minmax(0, 1fr))",
            height: "calc(200% + 2rem)",
          }}
        >
          <ChartCard fill title="Sequence review" className="col-span-2">
            <div className="grid h-full min-h-0 grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium">
                  Selected sequence on rink
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Placeholder for the selected sequence, period, start clock,
                  score, controlling team, and rink events.
                </p>
              </div>
              <div className="flex min-h-0 flex-col gap-3">
                <div className="flex shrink-0 items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">Possessions</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">Period:</span>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={period}
                      onValueChange={(value) => {
                        if (value) setPeriod(value);
                      }}
                      aria-label="Possession period"
                      disabled={!selectedGameId}
                    >
                      {selectedGame?.periods.map((value) => (
                        <ToggleGroupItem
                          key={value}
                          value={String(value)}
                          aria-label={`Period ${value}`}
                          className="cursor-pointer"
                        >
                          {value}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                  <Table aria-label="Possessions for the selected period">
                    <TableHeader className="sticky top-0 z-10 bg-card">
                      <TableRow>
                        <TableHead>Team</TableHead>
                        <TableHead>Clock</TableHead>
                        <TableHead className="text-right">
                          Duration (s)
                        </TableHead>
                        <TableHead className="text-right">
                          Pace (ft/s)
                        </TableHead>
                        <TableHead>Outcome</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentResult?.data.map((possession) => (
                        <TableRow key={possession.possession_id}>
                          <TableCell>{possession.team_name}</TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">
                            {formatClock(possession.start_clock_seconds)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(possession.elapsed_seconds ?? 0).toFixed(1)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(possession.speed_total_ft_s ?? 0).toFixed(1)}
                          </TableCell>
                          <TableCell title="Outcome labels have not been calculated">
                            0
                          </TableCell>
                        </TableRow>
                      ))}
                      {(!currentResult ||
                        currentResult.error ||
                        !currentResult.data.length) && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="py-6 text-center text-muted-foreground"
                          >
                            <span
                              role={currentResult?.error ? "alert" : "status"}
                            >
                              {!selectedGameId
                                ? "Select a game."
                                : !currentResult
                                  ? "Loading possessions..."
                                  : (currentResult.error ??
                                    "No possessions in this period.")}
                            </span>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
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
        </div>
      </section>
    </div>
  );
}
