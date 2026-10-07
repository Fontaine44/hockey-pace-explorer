import { ChartCard } from "@/components/charts/ChartCard";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

const mockGames = [
  {
    id: "game-1",
    date: "2025-10-08",
    away: "Toronto Maple Leafs",
    home: "Montreal Canadiens",
  },
  {
    id: "game-2",
    date: "2025-10-11",
    away: "Edmonton Oilers",
    home: "Vancouver Canucks",
  },
  {
    id: "game-3",
    date: "2025-10-14",
    away: "Boston Bruins",
    home: "Detroit Red Wings",
  },
];

export function GameReviewPage() {
  const [selectedGameId, setSelectedGameId] = useState(mockGames[0].id);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 items-center gap-3">
        <label htmlFor="game-selector" className="text-sm font-medium">
          Game:
        </label>
        <Select value={selectedGameId} onValueChange={setSelectedGameId}>
          <SelectTrigger
            id="game-selector"
            aria-label="Select game"
            className="w-96 bg-white"
          >
            <SelectValue placeholder="Choose a game" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {mockGames.map((game) => (
                <SelectItem key={game.id} value={game.id}>
                  {game.date} · {game.away} @ {game.home}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
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
