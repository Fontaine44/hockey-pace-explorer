import { ChartCard } from "@/components/charts/ChartCard";
import { PageHeader } from "@/components-custom/PageHeader";

export function WhatIsPacePage() {
  return (
    <>
      <PageHeader
        title="What is pace?"
        description="Understand the measures used to describe puck movement."
      />
      <ChartCard title="Puck-movement pace">
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>
            Pace describes how quickly the puck moves, measured in feet per
            second (ft/s).
          </p>
          <dl className="space-y-3">
            <div>
              <dt className="font-medium text-foreground">Total pace</dt>
              <dd>Overall puck movement.</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Forward pace</dt>
              <dd>Movement toward the opposing goal.</dd>
            </div>
            <div>
              <dt className="font-medium text-foreground">Lateral pace</dt>
              <dd>Movement across the rink.</dd>
            </div>
          </dl>
          <p>
            These measures use recorded events. Paths between observations are
            estimates of movement. Higher pace does not automatically mean
            better performance, and missing measurements do not mean zero pace.
          </p>
        </div>
      </ChartCard>
    </>
  );
}
