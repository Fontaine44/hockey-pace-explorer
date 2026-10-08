import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Game, PolygridCell } from "@/lib/api";
import { getGamePolygrid } from "@/lib/api";
import { GamePolygridPanel } from "./GamePolygridPanel";

vi.mock("@/lib/api", () => ({ getGamePolygrid: vi.fn() }));
vi.mock("./SpatialPolygrid", () => ({
  SpatialPolygrid: ({
    teamId,
    paceType,
  }: {
    teamId: number;
    paceType: string;
  }) => (
    <div data-testid="map">
      {teamId}:{paceType}
    </div>
  ),
}));
const game: Game = {
  game_id: 16,
  game_date: "2022-02-03",
  home_team_id: 2,
  away_team_id: 1,
  home_team_name: "Home",
  away_team_name: "Away",
  source_dataset: "Olympics 2022",
  periods: [1, 2, 3],
};
const cells = [{ team_id: 1 }] as PolygridCell[];
beforeEach(() => vi.mocked(getGamePolygrid).mockReset());

it("loads once per game, switches teams locally and resets on game change", async () => {
  vi.mocked(getGamePolygrid).mockResolvedValue(cells);
  const view = render(<GamePolygridPanel game={game} />);
  expect(await screen.findByTestId("map")).toHaveTextContent(
    "1:speed_total_ft_s",
  );
  fireEvent.click(screen.getByRole("button", { name: "Home" }));
  expect(screen.getByTestId("map")).toHaveTextContent("2:speed_total_ft_s");
  view.rerender(<GamePolygridPanel game={{ ...game }} />);
  expect(getGamePolygrid).toHaveBeenCalledTimes(1);
  view.rerender(<GamePolygridPanel game={{ ...game, game_id: 17 }} />);
  await waitFor(() => expect(getGamePolygrid).toHaveBeenCalledTimes(2));
  expect(await screen.findByTestId("map")).toHaveTextContent(
    "1:speed_total_ft_s",
  );
});

it("aborts old requests and ignores their late results", async () => {
  let resolveOld!: (cells: PolygridCell[]) => void;
  vi.mocked(getGamePolygrid)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValueOnce(cells);
  const view = render(<GamePolygridPanel game={game} />);
  const signal = vi.mocked(getGamePolygrid).mock.calls[0][1];
  view.rerender(<GamePolygridPanel game={{ ...game, game_id: 17 }} />);
  expect(signal?.aborted).toBe(true);
  await screen.findByTestId("map");
  await act(async () => resolveOld([]));
  expect(screen.getByTestId("map")).toBeInTheDocument();
});

it("displays empty and error states", async () => {
  vi.mocked(getGamePolygrid)
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(new Error("failed"));
  const view = render(<GamePolygridPanel game={game} />);
  expect(
    await screen.findByText("No spatial pace for this game."),
  ).toBeInTheDocument();
  view.rerender(<GamePolygridPanel game={{ ...game, game_id: 17 }} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to load spatial pace.",
  );
});
