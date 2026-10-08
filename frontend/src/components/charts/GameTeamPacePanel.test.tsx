import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import type { Game, TeamPace } from "@/lib/api";
import { getGamePace } from "@/lib/api";
import { GameTeamPacePanel } from "./GameTeamPacePanel";

vi.mock("@/lib/api", () => ({ getGamePace: vi.fn() }));
vi.mock("./TeamPaceChart", () => ({
  TeamPaceChart: ({ traces }: { traces: unknown }) => (
    <div data-testid="chart">{JSON.stringify(traces)}</div>
  ),
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <div>
      <select
        aria-label="Test pace"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
      >
        <option value="speed_total_ft_s">Total</option>
        <option value="speed_ew_ft_s">East-west</option>
      </select>
      {children}
    </div>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: () => null,
  SelectItem: () => null,
}));
const game = {
  game_id: 16,
  away_team_id: 1,
  home_team_id: 2,
  away_team_name: "Away",
  home_team_name: "Home",
  periods: [1, 2, 3],
} as Game;
const data = [
  {
    team_id: 1,
    period: null,
    modeled_elapsed_seconds: 10,
    speed_total_ft_s: 20,
    speed_ew_ft_s: 7,
  },
] as TeamPace[];
beforeEach(() => vi.mocked(getGamePace).mockReset());
it("switches locally, does not refetch on period changes, and resets on game changes", async () => {
  vi.mocked(getGamePace).mockResolvedValue(data);
  const view = render(<GameTeamPacePanel game={game} />);
  await screen.findByTestId("chart");
  fireEvent.change(screen.getByLabelText("Test pace"), {
    target: { value: "speed_ew_ft_s" },
  });
  expect(screen.getByTestId("chart")).toHaveTextContent('"y":[7]');
  view.rerender(<GameTeamPacePanel game={{ ...game, periods: [1] }} />);
  expect(getGamePace).toHaveBeenCalledTimes(1);
  view.rerender(<GameTeamPacePanel game={{ ...game, game_id: 17 }} />);
  await waitFor(() => expect(getGamePace).toHaveBeenCalledTimes(2));
  expect(await screen.findByTestId("chart")).toHaveTextContent('"y":[20]');
});
it("aborts and ignores obsolete results", async () => {
  let resolveOld!: (data: TeamPace[]) => void;
  vi.mocked(getGamePace)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValueOnce(data);
  const view = render(<GameTeamPacePanel game={game} />);
  const signal = vi.mocked(getGamePace).mock.calls[0][1];
  view.rerender(<GameTeamPacePanel game={{ ...game, game_id: 17 }} />);
  expect(signal?.aborted).toBe(true);
  await screen.findByTestId("chart");
  await act(async () => resolveOld([]));
  expect(screen.getByTestId("chart")).toBeInTheDocument();
});
it("shows empty and error states", async () => {
  vi.mocked(getGamePace)
    .mockResolvedValueOnce([])
    .mockRejectedValueOnce(new Error("failed"));
  const view = render(<GameTeamPacePanel game={game} />);
  expect(
    await screen.findByText("No team pace for this game."),
  ).toBeInTheDocument();
  view.rerender(<GameTeamPacePanel game={{ ...game, game_id: 17 }} />);
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Unable to load team pace.",
  );
});
