import { ChartCard } from "@/components/charts/ChartCard";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
import { useEffect, useRef, useState } from "react";

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
  const [selection, setSelection] = useState<{
    key: string;
    id: number;
  } | null>(null);
  const tableContainer = useRef<HTMLDivElement>(null);
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
  const possessions = currentResult?.data ?? [];
  const selectedIndex =
    selection?.key === possessionKey
      ? possessions.findIndex(
          (possession) => possession.possession_id === selection.id,
        )
      : -1;
  const selectedPossession = possessions[selectedIndex];

  function selectPossession(index: number) {
    const possession = possessions[index];
    if (possession)
      setSelection({ key: possessionKey, id: possession.possession_id });
  }

  useEffect(() => {
    const container = tableContainer.current;
    const row = container?.querySelector<HTMLTableRowElement>(
      'tr[aria-selected="true"]',
    );
    if (!container || !row) return;
    const bounds = container.getBoundingClientRect();
    const rowBounds = row.getBoundingClientRect();
    const headerHeight =
      container.querySelector("thead")?.getBoundingClientRect().height ?? 0;
    if (rowBounds.top < bounds.top + headerHeight) {
      container.scrollTop += rowBounds.top - bounds.top - headerHeight;
    } else if (rowBounds.bottom > bounds.top + container.clientHeight) {
      container.scrollTop +=
        rowBounds.bottom - bounds.top - container.clientHeight;
    }
  }, [selectedPossession?.possession_id, possessionKey]);

  useEffect(() => {
    if (!selectedGameId) return;
    const controller = new AbortController();
    getPossessions(selectedGameId, period, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setPossessionResult({ key: possessionKey, data, error: null });
          setSelection(
            data.length
              ? { key: possessionKey, id: data[0].possession_id }
              : null,
          );
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
          <ChartCard fill className="col-span-2 pt-5">
            <div className="grid h-full min-h-0 grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium">
                  Selected sequence on rink
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {selectedPossession
                    ? `${selectedPossession.team_name} · Period ${selectedPossession.period} · ${formatClock(selectedPossession.start_clock_seconds)}`
                    : "Select a possession to review."}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Placeholder for rink events.
                </p>
              </div>
              <div className="flex min-h-0 flex-col gap-3">
                <div className="flex shrink-0 items-center justify-between gap-3">
                  <h3 className="text-sm font-medium">Possessions</h3>
                  <div className="flex items-center gap-3">
                    <ButtonGroup aria-label="Possession navigation">
                      <Button
                        variant="outline"
                        size="icon"
                        className="cursor-pointer"
                        aria-label="First possession"
                        disabled={selectedIndex <= 0}
                        onClick={() => selectPossession(0)}
                      >
                        <ChevronFirst aria-hidden="true" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="cursor-pointer"
                        aria-label="Previous possession"
                        disabled={selectedIndex <= 0}
                        onClick={() => selectPossession(selectedIndex - 1)}
                      >
                        <ChevronLeft aria-hidden="true" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="cursor-pointer"
                        aria-label="Next possession"
                        disabled={
                          selectedIndex < 0 ||
                          selectedIndex >= possessions.length - 1
                        }
                        onClick={() => selectPossession(selectedIndex + 1)}
                      >
                        <ChevronRight aria-hidden="true" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="cursor-pointer"
                        aria-label="Last possession"
                        disabled={
                          selectedIndex < 0 ||
                          selectedIndex >= possessions.length - 1
                        }
                        onClick={() => selectPossession(possessions.length - 1)}
                      >
                        <ChevronLast aria-hidden="true" />
                      </Button>
                    </ButtonGroup>
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
                <div
                  ref={tableContainer}
                  className="min-h-0 flex-1 overflow-auto rounded-md border"
                >
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
                      {possessions.map((possession, index) => (
                        <TableRow
                          key={possession.possession_id}
                          aria-selected={
                            selectedPossession?.possession_id ===
                            possession.possession_id
                          }
                          tabIndex={0}
                          className="cursor-pointer aria-selected:bg-primary/20 aria-selected:hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          onClick={() => selectPossession(index)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              selectPossession(index);
                            }
                          }}
                        >
                          <TableCell>{possession.team_name}</TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">
                            {formatClock(possession.start_clock_seconds)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(possession.elapsed_seconds ?? 0).toFixed(0)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(possession.speed_total_ft_s ?? 0).toFixed(1)}
                          </TableCell>
                          <TableCell>{possession.outcome}</TableCell>
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
