import type { Data, Layout } from "plotly.js";
import type {
  DumpInOutcome,
  EntryTypeOutcome,
  OzRecoveryOutcome,
} from "@/lib/api";
import { OUTCOME_QUARTILE_COLORS } from "./outcome-style";

function percentageLayout(yTitle: string, stacked = false): Partial<Layout> {
  return {
    margin: { l: 55, r: 15, t: stacked ? 40 : 15, b: 44 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    dragmode: false,
    showlegend: stacked,
    barmode: stacked ? "stack" : "group",
    bargap: 0.3,
    legend: {
      orientation: "h",
      x: 0.5,
      xanchor: "center",
      y: 1.12,
      yanchor: "bottom",
      font: { size: 10 },
    },
    xaxis: {
      fixedrange: true,
      categoryorder: "array",
      categoryarray: ["Q1", "Q2", "Q3", "Q4"],
      title: { text: "Total pace quartile", font: { size: 11 } },
    },
    yaxis: {
      fixedrange: true,
      range: [0, 100],
      dtick: 25,
      ticksuffix: "%",
      gridcolor: "#e2e8f0",
      title: { text: yTitle, font: { size: 11 } },
    },
  };
}

function percentageTrace(
  name: string,
  values: (number | null)[],
  counts: (number | null)[],
  color: string | string[],
  stacked = false,
): Data {
  return {
    type: "bar",
    name,
    x: ["Q1", "Q2", "Q3", "Q4"],
    y: values,
    marker: { color },
    text: values.map((value) =>
      value === null || (stacked && value === 0) ? "" : `${value.toFixed(1)}%`,
    ),
    textposition: stacked ? "inside" : "outside",
    insidetextanchor: "middle",
    textfont: {
      size: 11,
      color: stacked && color === "#b91c1c" ? "#ffffff" : "#0f172a",
    },
    cliponaxis: false,
    customdata: counts.map((count) => [count]),
    hovertemplate: `${name} · %{x}: %{y:.1f}%<br>%{customdata[0]} observations<extra></extra>`,
  };
}

function quartiles<T extends { quartile: number }>(rows: T[]) {
  return [1, 2, 3, 4].map((q) => rows.find((row) => row.quartile === q));
}

export function createOzRecoveryPlot(rows: OzRecoveryOutcome[]) {
  const bars = quartiles(rows);
  return {
    traces: [
      percentageTrace(
        "Shot generation",
        bars.map((row) => (row && row.possessions > 0 ? row.shot_pct : null)),
        bars.map((row) => row?.possessions ?? null),
        OUTCOME_QUARTILE_COLORS,
      ),
    ],
    layout: percentageLayout("Shot-producing possessions (%)"),
  };
}

export function createEntryTypePlot(rows: EntryTypeOutcome[]) {
  const bars = quartiles(rows);
  const counts = bars.map((row) => row?.entries ?? null);
  return {
    traces: [
      percentageTrace(
        "Controlled",
        bars.map((row) =>
          row && row.entries > 0 ? row.controlled_entry_pct : null,
        ),
        counts,
        "#b91c1c",
        true,
      ),
      percentageTrace(
        "Dumped",
        bars.map((row) =>
          row && row.entries > 0 ? row.dumped_entry_pct : null,
        ),
        counts,
        "#cbd5e1",
        true,
      ),
    ],
    layout: percentageLayout("Entries (%)", true),
  };
}

export function createDumpInPlot(rows: DumpInOutcome[]) {
  const bars = quartiles(rows);
  const counts = bars.map((row) => row?.dump_ins ?? null);
  return {
    traces: [
      percentageTrace(
        "Team recovery within 5 s",
        bars.map((row) =>
          row && row.dump_ins > 0 ? row.team_recovery_pct : null,
        ),
        counts,
        "#b91c1c",
        true,
      ),
      percentageTrace(
        "No team recovery within 5 s",
        bars.map((row) =>
          row && row.dump_ins > 0 ? row.no_team_recovery_pct : null,
        ),
        counts,
        "#cbd5e1",
        true,
      ),
    ],
    layout: percentageLayout("Dump-ins (%)", true),
  };
}
