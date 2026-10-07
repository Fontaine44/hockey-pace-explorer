import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { GameReviewPage } from "@/pages/GameReviewPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { PaceOutcomesPage } from "@/pages/PaceOutcomesPage";
import { WhatIsPacePage } from "@/pages/WhatIsPacePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<GameReviewPage />} />
          <Route path="pace-outcomes" element={<PaceOutcomesPage />} />
          <Route path="what-is-pace" element={<WhatIsPacePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
