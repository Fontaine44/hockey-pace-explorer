import type { Data, Layout } from "plotly.js";
import type { ShotOutcome } from "@/lib/api";
import { OUTCOME_QUARTILE_COLORS } from "../shared/outcome-style";

export function createShotOutcomePlot(rows: ShotOutcome[]) {
  const bars = [1, 2, 3, 4].map((quartile) =>
    rows.find((row) => row.quartile === quartile),
  );
  const panels = [
    {
      name: "Mean shot distance",
      metric: "mean_distance_ft",
      count: "distance_attempts",
      suffix: " ft",
    },
    {
      name: "On-net attempts",
      metric: "on_net_pct",
      count: "attempts",
      suffix: "%",
    },
  ] as const;
  const annotations: Partial<Layout>["annotations"] = [];
  const traces: Data[] = panels.map((panel, index) => {
    const values = bars.map((row) =>
      row && row[panel.count] > 0 ? row[panel.metric] : null,
    );
    const center = index === 0 ? 0.2 : 0.8;
    annotations.push({
      text: panel.name,
      x: center,
      y: 1,
      yanchor: "bottom",
      yshift: 8,
      xref: "paper",
      yref: "paper",
      showarrow: false,
      font: { size: 16 },
    });
    if (values.every((value) => value === null))
      annotations.push({
        text: "No data",
        x: center,
        y: 0.5,
        xref: "paper",
        yref: "paper",
        showarrow: false,
      });
    return {
      type: "bar",
      name: panel.name,
      xaxis: index === 0 ? "x" : "x2",
      yaxis: index === 0 ? "y" : "y2",
      x: ["Q1", "Q2", "Q3", "Q4"],
      y: values,
      marker: { color: OUTCOME_QUARTILE_COLORS },
      text: values.map((value) =>
        value === null ? "" : `${value.toFixed(1)}${index === 1 ? "%" : ""}`,
      ),
      textposition: "outside",
      textfont: { size: 11 },
      cliponaxis: false,
      customdata: bars.map((row) => [row?.[panel.count] ?? null]),
      hovertemplate:
        `${panel.name} · %{x}: %{y:.1f}${panel.suffix}` +
        "<br>%{customdata[0]} observations<extra></extra>",
    } as Data;
  });
  const xaxis = {
    fixedrange: true,
    categoryorder: "array" as const,
    categoryarray: ["Q1", "Q2", "Q3", "Q4"],
    title: { text: "Total pace quartile", font: { size: 14 } },
  };
  const yaxis = { fixedrange: true, gridcolor: "#e2e8f0" };
  const layout: Partial<Layout> = {
    margin: { l: 52, r: 12, t: 40, b: 44 },
    showlegend: false,
    bargap: 0.25,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    dragmode: false,
    annotations,
    xaxis: { ...xaxis, domain: [0, 0.4], anchor: "y" },
    xaxis2: { ...xaxis, domain: [0.6, 1], anchor: "y2" },
    yaxis: {
      ...yaxis,
      anchor: "x",
      rangemode: "tozero",
      title: { text: "Distance (ft)", font: { size: 14 } },
    },
    yaxis2: {
      ...yaxis,
      anchor: "x2",
      range: [0, 100],
      dtick: 25,
      ticksuffix: "%",
      title: { text: "On-net attempts (%)", font: { size: 14 } },
    },
  };
  return { traces, layout };
}
