import { useEffect, useRef } from "react";
import Plotly from "plotly.js-cartesian-dist-min";
import type { Data, Layout } from "plotly.js";

export function TeamPaceChart({ traces }: { traces: Data[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const updateRef = useRef<((data: Data[]) => void) | null>(null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const plot = document.createElement("div");
    container.appendChild(plot);
    let disposed = false;
    let initialized = false;
    let frame = 0;
    let data: Data[] = [];
    let pending = Promise.resolve();
    function scheduleRender() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        pending = pending
          .then(async () => {
            if (disposed) return;
            const { width, height } = container!.getBoundingClientRect();
            if (width <= 0 || height <= 0) return;
            const layout: Partial<Layout> = {
              width,
              height,
              barmode: "group",
              bargap: 0.25,
              margin: { l: 55, r: 15, t: 25, b: 90 },
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              font: { family: "Arial, sans-serif", size: 12, color: "#0f172a" },
              legend: {
                orientation: "h",
                x: 0.5,
                xanchor: "center",
                y: -0.2,
                yanchor: "top",
              },
              xaxis: { fixedrange: true, automargin: true },
              yaxis: {
                title: { text: "Pace (ft/s)" },
                rangemode: "tozero",
                fixedrange: true,
                gridcolor: "#e2e8f0",
                automargin: true,
              },
              dragmode: false,
            };
            const config = { displayModeBar: false, scrollZoom: false };
            if (initialized) await Plotly.react(plot, data, layout, config);
            else {
              await Plotly.newPlot(plot, data, layout, config);
              initialized = true;
            }
          })
          .catch((error: unknown) => {
            if (!disposed) console.error("Unable to render team pace:", error);
          });
      });
    }
    updateRef.current = (next) => {
      data = next;
      scheduleRender();
    };
    const observer = new ResizeObserver(scheduleRender);
    observer.observe(container);
    return () => {
      disposed = true;
      updateRef.current = null;
      observer.disconnect();
      cancelAnimationFrame(frame);
      plot.remove();
      void pending.finally(() => Plotly.purge(plot));
    };
  }, []);
  useEffect(() => {
    updateRef.current?.(traces);
  }, [traces]);
  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Team pace by full game and period"
      className="h-full w-full min-h-0 min-w-0 overflow-hidden"
    />
  );
}
