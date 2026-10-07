import { Activity, CircleCheck, CircleX } from "lucide-react";
import { useEffect, useState } from "react";

import { ChartCard } from "@/components/charts/ChartCard";
import { MetricCard } from "@/components-custom/MetricCard";
import { PageHeader } from "@/components-custom/PageHeader";
import { getHealth, type HealthResponse } from "@/lib/api";

interface HealthState {
  loading: boolean;
  data?: HealthResponse;
  error?: string;
}

export function DashboardPage() {
  const [health, setHealth] = useState<HealthState>({ loading: true });

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then((data) => setHealth({ loading: false, data }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setHealth({
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Unable to reach the API",
          });
        }
      });
    return () => controller.abort();
  }, []);

  const status = health.data
    ? "Connected"
    : health.error
      ? "Unavailable"
      : "Checking";
  const StatusIcon = health.data
    ? CircleCheck
    : health.error
      ? CircleX
      : Activity;

  return (
    <>
      <PageHeader
        title="Overview"
        description="The workspace is ready for assignment-specific exploration, modeling, and presentation."
      />
      <section
        aria-label="Workspace status"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        <MetricCard
          label="Backend API"
          value={status}
          helperText={
            health.data
              ? `${health.data.service} · v${health.data.version}`
              : (health.error ?? "Requesting /api/health")
          }
          icon={StatusIcon}
          loading={health.loading}
        />
      </section>
      <ChartCard
        title="Analysis workspace"
        description="Reusable visualizations can be added here once the assignment and data are known."
        empty
        emptyTitle="Ready for analysis"
        emptyDescription="Explore the source data in notebooks, move reusable logic into the shared package, and expose only the results the presentation needs."
      />
    </>
  );
}
