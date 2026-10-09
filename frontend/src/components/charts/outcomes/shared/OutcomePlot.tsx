import { useEffect, useRef } from "react";
import Plotly from "plotly.js-cartesian-dist-min";
import type { Data, Layout } from "plotly.js";
import { getPlotlyFontFamily } from "../../shared/plotly-style";

export function OutcomePlot({
  figure,
  label,
}: {
  figure: { traces: Data[]; layout: Partial<Layout> };
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const plot = document.createElement("div");
    container.appendChild(plot);
    let disposed = false;
    let initialized = false;
    let frame = 0;
    let pending = Promise.resolve();
    function scheduleRender() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        pending = pending
          .then(async () => {
            if (disposed) return;
            const { width, height } = container!.getBoundingClientRect();
            if (width <= 0 || height <= 0) return;
            const layout = {
              ...figure.layout,
              width,
              height,
              font: {
                family: getPlotlyFontFamily(container!),
                size: 11,
                color: "#0f172a",
              },
            };
            const config = { displayModeBar: false, scrollZoom: false };
            if (initialized)
              await Plotly.react(plot, figure.traces, layout, config);
            else {
              await Plotly.newPlot(plot, figure.traces, layout, config);
              initialized = true;
            }
          })
          .catch((error: unknown) => {
            if (!disposed)
              console.error("Unable to render outcome plot:", error);
          });
      });
    }
    const observer = new ResizeObserver(scheduleRender);
    observer.observe(container);
    scheduleRender();
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      plot.remove();
      void pending.finally(() => Plotly.purge(plot));
    };
  }, [figure]);
  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label}
      className="h-full min-h-0 w-full min-w-0 overflow-hidden"
    />
  );
}
