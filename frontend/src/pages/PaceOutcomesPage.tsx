import { ChartCard } from "@/components/charts/ChartCard";
import { PageHeader } from "@/components-custom/PageHeader";

export function PaceOutcomesPage() {
  return (
    <>
      <PageHeader
        title="Pace & outcomes"
        description="Explore how puck-movement pace relates to observed outcomes."
      />
      <ChartCard
        title="Pace and outcomes analysis"
        empty
        emptyTitle="Analysis coming soon"
        emptyDescription="Pace comparisons and supporting sequences will appear here when the analysis is connected."
      />
    </>
  );
}
