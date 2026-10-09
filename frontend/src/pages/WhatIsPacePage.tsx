import { Activity, CircleCheck, CircleX } from "lucide-react";
import { useEffect, useState } from "react";

import { PanelCard } from "@/components-custom/PanelCard";
import { MetricCard } from "@/components-custom/MetricCard";
import { PageHeader } from "@/components-custom/PageHeader";
import { getHealth, type HealthResponse } from "@/lib/api";

interface HealthState {
  loading: boolean;
  data?: HealthResponse;
  error?: string;
}

export function WhatIsPacePage() {
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
    <div className="flex flex-col gap-8">
      <PageHeader
        title="What is pace?"
        descriptionClassName="mt-3"
        description="Understand the measures used to describe puck movement."
      />
      <section aria-label="Backend API status" className="max-w-sm">
        <MetricCard
          label="Backend API"
          value={status}
          helperText={
            health.data
              ? `${health.data.service} | v${health.data.version}`
              : (health.error ?? "Requesting /api/health")
          }
          icon={StatusIcon}
          loading={health.loading}
        />
      </section>
      <PanelCard title="Puck-movement pace">
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
      </PanelCard>
    </div>
  );
}
