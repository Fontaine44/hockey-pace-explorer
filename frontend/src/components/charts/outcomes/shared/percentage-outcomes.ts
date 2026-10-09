import type { Data, Layout } from "plotly.js";

export function percentageLayout(
  yTitle: string,
  stacked = false,
): Partial<Layout> {
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
      y: 1,
      yanchor: "bottom",
      font: { size: 14 },
    },
    xaxis: {
      fixedrange: true,
      categoryorder: "array",
      categoryarray: ["Q1", "Q2", "Q3", "Q4"],
      title: { text: "Total pace quartile", font: { size: 14 } },
    },
    yaxis: {
      fixedrange: true,
      range: [0, 100],
      dtick: 25,
      ticksuffix: "%",
      gridcolor: "#e2e8f0",
      title: { text: yTitle, font: { size: 14 } },
    },
  };
}

export function percentageTrace(
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

export function quartiles<T extends { quartile: number }>(rows: T[]) {
  return [1, 2, 3, 4].map((q) => rows.find((row) => row.quartile === q));
}
