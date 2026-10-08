import type { Data } from "plotly.js";
import type { PolygridCell } from "@/lib/api";

export const PACE_TYPES = [
  { value: "speed_total_ft_s", label: "Total" },
  { value: "speed_ew_ft_s", label: "East-west" },
  { value: "speed_ns_ft_s", label: "North-south" },
  { value: "speed_n_ft_s", label: "North-only" },
] as const;
export type PaceType = (typeof PACE_TYPES)[number]["value"];

export function createPolygridTrace(
  cells: PolygridCell[],
  teamId: number,
  paceType: PaceType,
): { trace: Data; max: number; hasData: boolean } {
  const max = Math.max(0, ...cells.map((cell) => cell[paceType] ?? 0)) || 1;
  const z: (number | null)[][] = Array.from({ length: 17 }, () =>
    Array(40).fill(null),
  );
  const exposure: (number | null)[][] = Array.from({ length: 17 }, () =>
    Array(40).fill(null),
  );
  let hasData = false;
  for (const cell of cells) {
    if (cell.team_id !== teamId) continue;
    const row = cell.grid_row;
    const col = cell.grid_column;
    z[row][col] = cell[paceType];
    exposure[row][col] = cell.modeled_elapsed_seconds;
    if (cell[paceType] !== null) hasData = true;
  }
  // Fill missing valid cells from original neighbors only, without cascading.
  // Cells absent from the geometry (removed corners) remain transparent.
  const original = z.map((row) => [...row]);
  for (const cell of cells) {
    if (cell.team_id !== teamId || cell[paceType] !== null) continue;
    const neighbors: number[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dy === 0 && dx === 0) continue;
        const value = original[cell.grid_row + dy]?.[cell.grid_column + dx];
        if (value != null) neighbors.push(value);
      }
    }
    if (neighbors.length) {
      z[cell.grid_row][cell.grid_column] = Math.min(...neighbors);
    }
  }
  return {
    max,
    hasData,
    trace: {
      type: "heatmap",
      x: Array.from({ length: 40 }, (_, i) => i * 5 + 2.5),
      y: Array.from({ length: 17 }, (_, i) => i * 5 + 2.5),
      z,
      customdata: exposure,
      zmin: 0,
      zmax: max,
      colorscale: "Viridis",
      opacity: 0.7,
      showscale: false,
      zsmooth: false,
      hoverongaps: false,
      hovertemplate:
        "Pace: %{z:.2f} ft/s<extra></extra>",
    },
  };
}
