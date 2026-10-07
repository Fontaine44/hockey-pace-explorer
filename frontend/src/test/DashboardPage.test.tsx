import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardPage } from "@/pages/DashboardPage";

describe("DashboardPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("reports a successful backend connection", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "ok",
          service: "analytics-accelerator-api",
          version: "0.1.0",
        }),
        { status: 200 },
      ),
    );
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Connected")).toBeInTheDocument();
    expect(screen.getByText(/analytics-accelerator-api/)).toBeInTheDocument();
  });

  it("reports a backend error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 503 }),
    );
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText(/status 503/)).toBeInTheDocument();
  });
});
