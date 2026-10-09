import { PanelCard } from "@/components-custom/PanelCard";
import { GamePolygridPanel } from "@/components/charts/GamePolygridPanel";
import { GameTeamPacePanel } from "@/components/charts/GameTeamPacePanel";
import { RinkPlot } from "@/components/charts/RinkPlot";
import {
  createRinkEventPlot,
  EMPTY_PLOT,
} from "@/components/charts/rink-events";
import { RinkLegend } from "@/components/charts/RinkLegend";
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
import { getTeamColor } from "@/lib/team-colors";
import { cn } from "@/lib/utils";
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
  getPossessionEvents,
  getPossessions,
  type Game,
  type Possession,
  type PossessionEvent,
} from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";

const EMPTY_POSSESSIONS: Possession[] = [];

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
  const possessions = currentResult?.data ?? EMPTY_POSSESSIONS;
  const selectedIndex =
    selection?.key === possessionKey
      ? possessions.findIndex(
          (possession) => possession.possession_id === selection.id,
        )
      : -1;
  const selectedPossession = possessions[selectedIndex];
  const selectedPossessionId = selectedPossession?.possession_id;
  const eventsKey =
    selectedPossessionId === undefined
      ? ""
      : `${possessionKey}:${selectedPossessionId}`;
  const [eventsResult, setEventsResult] = useState<{
    key: string;
    data: PossessionEvent[];
    error: string | null;
  } | null>(null);
  const currentEvents = eventsResult?.key === eventsKey ? eventsResult : null;
  const rinkPlot = useMemo(
    () =>
      currentEvents?.data.length && selectedGame
        ? createRinkEventPlot(currentEvents.data, selectedGame)
        : EMPTY_PLOT,
    [currentEvents, selectedGame],
  );

  useEffect(() => {
    if (!selectedGameId || selectedPossessionId === undefined) return;
    const controller = new AbortController();
    getPossessionEvents(selectedGameId, selectedPossessionId, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setEventsResult({ key: eventsKey, data, error: null });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setEventsResult({
            key: eventsKey,
            data: [],
            error: "Unable to load events.",
          });
        }
      });
    return () => controller.abort();
  }, [selectedGameId, selectedPossessionId, eventsKey]);

  function selectPossession(index: number) {
    const possession = possessions[index];
    if (possession)
      setSelection({ key: possessionKey, id: possession.possession_id });
  }

  useEffect(() => {
    function navigatePossessions(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (event.key !== "ArrowLeft" && event.key !== "ArrowRight") ||
        selectedIndex < 0
      )
        return;
      const target = event.target;
      if (target instanceof Element) {
        if (
          target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="combobox"], [role="listbox"], [role="menu"], [role="dialog"], [role="radiogroup"]',
          )
        )
          return;
        // Let controls keep their native arrow behavior, except the possession arrows.
        if (
          target.closest("button, a") &&
          !target.closest('[aria-label="Possession navigation"]')
        )
          return;
      }
      event.preventDefault();
      const next =
        possessions[selectedIndex + (event.key === "ArrowRight" ? 1 : -1)];
      if (next) setSelection({ key: possessionKey, id: next.possession_id });
    }
    window.addEventListener("keydown", navigatePossessions);
    return () => window.removeEventListener("keydown", navigatePossessions);
  }, [possessions, selectedIndex, possessionKey]);

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
        setSelectedGameId(data.length ? String(data[1].game_id) : "");
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
          <GamePolygridPanel game={selectedGame} />
          <GameTeamPacePanel game={selectedGame} />
          <PanelCard fill className="col-span-2 pt-5">
            <div className="grid h-full min-h-0 grid-cols-2 gap-16">
              <div className="flex min-h-0 min-w-0 flex-col gap-3">
                <h3 className="shrink-0 text-sm font-medium">
                  Possession review
                </h3>
                <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
                  <div
                    className="shrink-0 space-y-3"
                    aria-label="Selected possession scoreboard"
                  >
                    <div className="flex items-stretch divide-x divide-white/25 overflow-hidden rounded-sm border border-slate-700 bg-slate-900 text-sm text-white shadow-md">
                      <span
                        className="min-w-0 flex-1 truncate px-3 py-2 text-center font-bold uppercase tracking-wide"
                        style={{
                          backgroundColor: getTeamColor(selectedGame, "away"),
                        }}
                        title={selectedGame?.away_team_name}
                      >
                        {selectedGame?.away_team_name ?? "\u00a0"}
                      </span>
                      <span
                        className={cn(
                          "w-11 shrink-0 px-3 py-2 text-center font-bold tabular-nums",
                          selectedPossession?.contains_goal &&
                            selectedPossession.possession_team_id ===
                              selectedGame?.away_team_id
                            ? "bg-amber-300 text-slate-950"
                            : "bg-slate-800 text-white",
                        )}
                        aria-label={`Away score: ${selectedPossession?.away_score ?? "pending"}${selectedPossession?.contains_goal && selectedPossession.possession_team_id === selectedGame?.away_team_id ? ", goal in this possession" : ""}`}
                      >
                        {selectedPossession?.away_score ?? "\u00a0"}
                      </span>
                      <span className="w-40 shrink-0 whitespace-nowrap bg-slate-950 px-3 py-2 text-center font-bold tabular-nums">
                        {selectedPossession
                          ? `${formatClock(selectedPossession.start_clock_seconds)} - ${formatClock(selectedPossession.end_clock_seconds)}`
                          : "\u00a0"}
                      </span>
                      <span
                        className={cn(
                          "w-11 shrink-0 px-3 py-2 text-center font-bold tabular-nums",
                          selectedPossession?.contains_goal &&
                            selectedPossession.possession_team_id ===
                              selectedGame?.home_team_id
                            ? "bg-amber-300 text-slate-950"
                            : "bg-slate-800 text-white",
                        )}
                        aria-label={`Home score: ${selectedPossession?.home_score ?? "pending"}${selectedPossession?.contains_goal && selectedPossession.possession_team_id === selectedGame?.home_team_id ? ", goal in this possession" : ""}`}
                      >
                        {selectedPossession?.home_score ?? "\u00a0"}
                      </span>
                      <span
                        className="min-w-0 flex-1 truncate px-3 py-2 text-center font-bold uppercase tracking-wide"
                        style={{
                          backgroundColor: getTeamColor(selectedGame, "home"),
                        }}
                        title={selectedGame?.home_team_name}
                      >
                        {selectedGame?.home_team_name ?? "\u00a0"}
                      </span>
                    </div>
                    <div className="flex h-6 items-center">
                      <span className="min-w-0 flex-1 text-center text-s font-medium text-slate-500">
                        {selectedPossession && selectedGame ? (
                          selectedPossession.possession_team_id ===
                          selectedGame.away_team_id ? (
                            <strong className="font-bold">Attacking ⮞</strong>
                          ) : (
                            "Defending"
                          )
                        ) : (
                          "\u00a0"
                        )}
                      </span>
                      <div className="flex w-62 shrink-0 justify-center">
                        <span className="flex h-6 min-w-12 items-center justify-center text-sm font-normal">
                          {selectedPossession
                            ? `${selectedPossession.away_skaters} vs ${selectedPossession.home_skaters}`
                            : "\u00a0"}
                        </span>
                      </div>
                      <span className="min-w-0 flex-1 text-center text-s font-medium text-slate-500">
                        {selectedPossession && selectedGame ? (
                          selectedPossession.possession_team_id ===
                          selectedGame.home_team_id ? (
                            <strong className="font-bold">⮜ Attacking</strong>
                          ) : (
                            "Defending"
                          )
                        ) : (
                          "\u00a0"
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex min-h-0 shrink flex-col gap-4">
                    <RinkPlot
                      traces={rinkPlot.traces}
                      annotations={rinkPlot.annotations}
                      className="aspect-[2010/860] h-auto min-h-0 shrink items-start"
                    />
                    <RinkLegend />
                  </div>
                </div>
              </div>
              <div className="flex min-h-0 flex-col gap-3">
                <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <h3 className="text-sm font-medium">Possessions</h3>
                  <ButtonGroup
                    aria-label="Possession navigation"
                    className="justify-self-center"
                  >
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
                  <div className="flex items-center justify-self-end gap-3">
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
                          className="cursor-pointer data-[state=on]:bg-slate-900 data-[state=on]:text-white data-[state=on]:hover:bg-slate-800"
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
                  <Table
                    aria-label="Possessions for the selected period"
                    className="text-xs"
                  >
                    <TableHeader className="sticky top-0 z-10 bg-accent text-sm [&_th]:text-black">
                      <TableRow>
                        <TableHead>Team</TableHead>
                        <TableHead>Clock</TableHead>
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
                            {`${formatClock(possession.start_clock_seconds)}-${formatClock(possession.end_clock_seconds)}`}
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
                            colSpan={4}
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
          </PanelCard>
        </div>
      </section>
    </div>
  );
}
