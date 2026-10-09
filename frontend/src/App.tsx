import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { ResearchOverviewPage } from "@/pages/ResearchOverviewPage";

const GameReviewPage = lazy(() =>
  import("@/pages/GameReviewPage").then((module) => ({
    default: module.GameReviewPage,
  })),
);

const PaceOutcomesPage = lazy(() =>
  import("@/pages/PaceOutcomesPage").then((module) => ({
    default: module.PaceOutcomesPage,
  })),
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<ResearchOverviewPage />} />
          <Route path="pace-outcomes" element={<PaceOutcomesPage />} />
          <Route path="game-review" element={<GameReviewPage />} />
          <Route path="what-is-pace" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
