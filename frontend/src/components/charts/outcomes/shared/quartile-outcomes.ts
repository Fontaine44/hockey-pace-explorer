import type { Data, Layout } from "plotly.js";
import { OUTCOME_QUARTILE_COLORS } from "./outcome-style";

interface QuartileOutcome {
  group: string;
  quartile: number;
  observations: number;
  successes: number;
  games: number;
  percentage: number | null;
  median_pace_ft_s: number | null;
  lower_pace_ft_s: number;
  upper_pace_ft_s: number;
}

export function createQuartileOutcomePlot(
  rows: QuartileOutcome[],
  groups: [string, string],
  xTitle: string,
  yTitle: string,
  groupTitles: [string, string] = groups,
) {
  const annotations: Partial<Layout>["annotations"] = [];
  const traces: Data[] = groups.map((type, index) => {
    const bars = [1, 2, 3, 4].map((quartile) =>
      rows.find((row) => row.group === type && row.quartile === quartile),
    );
    annotations.push({
      text: groupTitles[index],
      x: index === 0 ? 0.22 : 0.78,
      y: 1,
      yanchor: "bottom",
      yshift: 8,
      xref: "paper",
      yref: "paper",
      showarrow: false,
      font: { size: 16 },
    });
    if (
      !bars.some(
        (row) => row && row.observations > 0 && row.percentage !== null,
      )
    ) {
      annotations.push({
        text: "No data",
        x: index === 0 ? 0.22 : 0.78,
        y: 0.5,
        xref: "paper",
        yref: "paper",
        showarrow: false,
      });
    }
    return {
      type: "bar",
      name: type,
      xaxis: index === 0 ? "x" : "x2",
      yaxis: index === 0 ? "y" : "y2",
      x: ["Q1", "Q2", "Q3", "Q4"],
      y: bars.map((row) =>
        row && row.observations > 0 ? row.percentage : null,
      ),
      marker: { color: OUTCOME_QUARTILE_COLORS },
      text: bars.map((row) =>
        row && row.observations > 0 && row.percentage !== null
          ? `${row.percentage.toFixed(1)}%`
          : "",
      ),
      textposition: "outside",
      textfont: { size: 11 },
      cliponaxis: false,
      customdata: bars.map((row) =>
        row
          ? [
              row.observations,
              row.successes,
              row.games,
              row.lower_pace_ft_s,
              row.upper_pace_ft_s,
              row.median_pace_ft_s,
            ]
          : [null, null, null, null, null, null],
      ),
      hovertemplate:
        `${type} · %{x}: %{y:.1f}%` +
        "<br>%{customdata[0]} observations<extra></extra>",
    } as Data;
  });
  const axis = {
    fixedrange: true,
    categoryorder: "array" as const,
    categoryarray: ["Q1", "Q2", "Q3", "Q4"],
    title: { text: xTitle, font: { size: 14 } },
  };
  const yaxis = {
    range: [0, 100],
    fixedrange: true,
    gridcolor: "#e2e8f0",
    ticksuffix: "%",
    dtick: 25,
  };
  const layout: Partial<Layout> = {
    margin: { l: 52, r: 12, t: 40, b: 44 },
    showlegend: false,
    bargap: 0.25,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    dragmode: false,
    annotations,
    xaxis: { ...axis, domain: [0, 0.44], anchor: "y" },
    xaxis2: { ...axis, domain: [0.56, 1], anchor: "y2" },
    yaxis: {
      ...yaxis,
      anchor: "x",
      title: { text: yTitle, font: { size: 14 } },
    },
    yaxis2: { ...yaxis, anchor: "x2", matches: "y", showticklabels: false },
  };
  return { traces, layout };
}
