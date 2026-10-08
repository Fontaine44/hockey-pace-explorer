import { PanelCard } from "@/components-custom/PanelCard";
import { PageHeader } from "@/components-custom/PageHeader";

export function PaceOutcomesPage() {
  return (
    <>
      <PageHeader
        title="Pace & outcomes"
        description="Explore how puck-movement pace relates to observed outcomes."
      />
      <PanelCard
        title="Pace and outcomes analysis"
        empty
        emptyTitle="Analysis coming soon"
        emptyDescription="Pace comparisons and supporting sequences will appear here when the analysis is connected."
      />
    </>
  );
}
