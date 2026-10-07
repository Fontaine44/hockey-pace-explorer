import { render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import App from "@/App";

afterEach(() => window.history.pushState({}, "", "/"));

it("renders the not-found route", () => {
  window.history.pushState({}, "", "/missing");
  render(<App />);
  expect(
    screen.getByRole("heading", { name: "Page not found" }),
  ).toBeInTheDocument();
});
