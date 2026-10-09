import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { GameReviewPage } from "@/pages/GameReviewPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PaceOutcomesPage } from "@/pages/PaceOutcomesPage";
import { ResearchOverviewPage } from "@/pages/ResearchOverviewPage";

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
