import type { Annotations, Data } from "plotly.js";
import { getTeamColor } from "@/lib/team-colors";
import type { Game, PossessionEvent } from "@/lib/api";

export const EVENT_MARKERS = {
  "Puck Recovery": "diamond",
  Takeaway: "diamond",
  "Faceoff Win": "diamond",
  Pass: "circle",
  "Pass Reception": "circle",
  "Incomplete Pass": "circle",
  "Zone Entry": "circle",
  "Dump In/Out": "circle",
  Shot: "circle",
  Goal: "triangle-up",
  "Penalty Shot Goal": "triangle-up",
  "Penalty Taken": "circle",
} as const;

export const MARKER_LEGEND = [
  { label: "Play / pass / shot", symbol: "circle" },
  { label: "Recovery / takeaway / faceoff", symbol: "diamond" },
] as const;

export const CONNECTION_STYLES = [
  { label: "Movement", dash: "solid" },
  { label: "Pass", dash: "dot" },
] as const;

type Dash = (typeof CONNECTION_STYLES)[number]["dash"];
const POSITION_EVENTS = new Set([
  "Puck Recovery",
  "Takeaway",
  "Faceoff Win",
  "Pass",
  "Pass Reception",
  "Incomplete Pass",
  "Shot",
  "Goal",
  "Dump In/Out",
  "Zone Entry",
]);
const SHOTS = new Set(["Shot", "Goal", "Penalty Shot Goal"]);
export const EMPTY_PLOT = {
  traces: [] as Data[],
  annotations: [] as Partial<Annotations>[],
};

function eventHover(event: PossessionEvent, number: number): string {
  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  const seconds = Math.floor(event.clock_seconds);
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return [
    `<b>${number} - ${escape(event.event)}</b>`,
    escape(event.player_name),
    `Clock: ${clock}`,
    ...[event.detail_1, event.detail_2]
      .filter((value): value is string => Boolean(value))
      .map(escape),
    `Event: ${event.event_id}`,
  ].join("<br>");
}

export function createRinkEventPlot(events: PossessionEvent[], game: Game) {
  const homeTeamId = game.home_team_id;
  const ordered = [...events].sort((a, b) => a.event_id - b.event_id);
  const coordinates = ordered.map((event) => {
    if (event.x === null || event.y === null) return { x: 100, y: 42.5 };
    return event.team_id === homeTeamId
      ? { x: 200 - event.x, y: 85 - event.y }
      : { x: event.x, y: event.y };
  });
  const teamColor = (teamId: number) =>
    getTeamColor(game, teamId === homeTeamId ? "home" : "away");
  const validPosition = (event: PossessionEvent) =>
    event.x !== null && event.y !== null;
  const traces: Data[] = [];
  const annotations: Partial<Annotations>[] = [];
  const segments = new Map<
    string,
    { teamId: number; dash: Dash; x: (number | null)[]; y: (number | null)[] }
  >();

  for (let index = 0; index < ordered.length; index++) {
    const event = ordered[index];
    const point = coordinates[index];
    if (SHOTS.has(event.event) && validPosition(event)) {
      annotations.push({
        xref: "x",
        yref: "y",
        axref: "x",
        ayref: "y",
        x: event.team_id === homeTeamId ? 11 : 189,
        y: 42.5,
        ax: point.x,
        ay: point.y,
        text: "",
        showarrow: true,
        arrowhead: 2,
        arrowsize: 1,
        arrowwidth: 1,
        arrowcolor: teamColor(event.team_id),
        opacity: 0.2,
      });
    }
    const next = ordered[index + 1];
    if (
      !next ||
      !validPosition(event) ||
      !validPosition(next) ||
      event.team_id !== next.team_id ||
      SHOTS.has(event.event)
    )
      continue;
    let dash: Dash | undefined;
    if (event.event === "Pass" && next.event === "Pass Reception") dash = "dot";
    else if (
      event.event === "Incomplete Pass" &&
      next.event === "Incomplete Pass Reception"
    )
      dash = "dot";
    else if (
      event.event !== "Pass" &&
      event.event !== "Incomplete Pass" &&
      POSITION_EVENTS.has(event.event) &&
      POSITION_EVENTS.has(next.event) &&
      event.player_id === next.player_id
    )
      dash = "solid";
    if (!dash) continue;
    const key = `${event.team_id}:${dash}`;
    let segment = segments.get(key);
    if (!segment) {
      segment = { teamId: event.team_id, dash, x: [], y: [] };
      segments.set(key, segment);
    }
    segment.x.push(point.x, coordinates[index + 1].x, null);
    segment.y.push(point.y, coordinates[index + 1].y, null);
  }
  for (const segment of segments.values()) {
    traces.push({
      type: "scatter",
      mode: "lines",
      x: segment.x,
      y: segment.y,
      line: {
        color: teamColor(segment.teamId),
        width: 1.5,
        dash: segment.dash,
      },
      opacity: 0.6,
      hoverinfo: "skip",
      connectgaps: false,
    });
  }
  const groups = new Map<
    string,
    {
      point: { x: number; y: number };
      events: PossessionEvent[];
      numbers: number[];
    }
  >();
  let number = 0;
  ordered.forEach((event, index) => {
    if (event.event === "Incomplete Pass Reception") return;
    number++;
    const point = coordinates[index];
    // Unknown positions use center ice visually, but do not imply a shared location.
    const key = validPosition(event)
      ? `${point.x}:${point.y}:${event.clock_seconds}`
      : `missing:${event.event_id}`;
    let group = groups.get(key);
    if (!group) {
      group = { point, events: [], numbers: [] };
      groups.set(key, group);
    }
    group.events.push(event);
    group.numbers.push(number);
  });
  const markers = [...groups.values()].map((group) => ({
    ...group,
    label: group.numbers.join("·"),
    representative:
      group.events.find((event) => event.event.includes("Goal")) ??
      group.events[group.events.length - 1],
  }));
  // Plotly draws all labels above all symbols within a scatter trace.
  // Separate traces keep each marker and label together in chronological order.
  markers.sort(
    (a, b) =>
      a.events[a.events.length - 1].event_id -
      b.events[b.events.length - 1].event_id,
  );
  for (const group of markers) {
    const { representative } = group;
    const isGoal = representative.event.includes("Goal");
    traces.push({
      type: "scatter",
      mode: "text+markers",
      opacity: 1,
      x: [group.point.x],
      y: [group.point.y],
      text: [group.label],
      textposition: "middle center",
      textfont: {
        size: 12,
        color: isGoal ? "#0f172a" : "white",
      },
      marker: {
        symbol:
          EVENT_MARKERS[representative.event as keyof typeof EVENT_MARKERS] ??
          "circle",
        size:
          group.events.length > 1
            ? Math.max(32, group.label.length * 7 + 10)
            : 22,
        opacity: 1,
        color: isGoal ? "#fbbf24" : teamColor(representative.team_id),
        line: {
          color: isGoal ? "#fbbf24" : "white",
          width: isGoal ? 2 : 1,
        },
      },
      customdata: [
        [
          group.events
            .map((event, index) => eventHover(event, group.numbers[index]))
            .join("<br><br>"),
        ],
      ],
      hovertemplate: "%{customdata[0]}<extra></extra>",
    });
  }
  return { traces, annotations };
}
