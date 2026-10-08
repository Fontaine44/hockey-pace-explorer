import { describe, expect, it } from "vitest";
import type { PolygridCell } from "@/lib/api";
import { createPolygridTrace, PACE_TYPES } from "./polygrid";

const cells: PolygridCell[] = [
  {
    team_id: 1,
    cell_id: 0,
    grid_row: 2,
    grid_column: 3,
    modeled_elapsed_seconds: 10,
    speed_total_ft_s: 12,
    speed_ew_ft_s: 8,
    speed_ns_ft_s: 6,
    speed_n_ft_s: 4,
  },
  {
    team_id: 2,
    cell_id: 0,
    grid_row: 2,
    grid_column: 3,
    modeled_elapsed_seconds: 20,
    speed_total_ft_s: 24,
    speed_ew_ft_s: 16,
    speed_ns_ft_s: 12,
    speed_n_ft_s: 8,
  },
];

describe("game polygrid", () => {
  it("keeps original coordinates for both teams and fixed scales", () => {
    for (const type of PACE_TYPES) {
      const away = createPolygridTrace(cells, 1, type.value);
      const home = createPolygridTrace(cells, 2, type.value);
      expect(away.max).toBe(home.max);
      expect(home.max).toBe(cells[1][type.value]);
      expect((away.trace as { z: unknown[][] }).z[2][3]).toBe(
        cells[0][type.value],
      );
      expect((home.trace as { z: unknown[][] }).z[2][3]).toBe(
        cells[1][type.value],
      );
      expect(
        (home.trace as { customdata: unknown[][] }).customdata[2][3],
      ).toBe(20);
      expect((home.trace as { z: unknown[][] }).z[14][36]).toBeNull();
    }
  });
  it("displays missing values as zero while keeping excluded cells blank", () => {
    const blank = createPolygridTrace([], 1, "speed_total_ft_s");
    expect(blank.hasData).toBe(false);
    const zero = createPolygridTrace(
      [{ ...cells[0], speed_total_ft_s: null }],
      1,
      "speed_total_ft_s",
    );
    expect(zero.hasData).toBe(true);
    expect((zero.trace as { z: unknown[][] }).z[2][3]).toBe(0);
    expect((zero.trace as { z: unknown[][] }).z[0][0]).toBeNull();
  });
});
