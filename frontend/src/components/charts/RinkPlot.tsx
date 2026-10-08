import { useEffect, useRef } from "react";
import Plotly from "plotly.js-basic-dist-min";
import type { Annotations, Data, Layout } from "plotly.js";

import rinkImage from "@/assets/rink.png";
import { cn } from "@/lib/utils";

interface RinkPlotProps {
  traces?: Data[];
  annotations?: Partial<Annotations>[];
  className?: string;
}

const EMPTY_TRACES: Data[] = [];
const EMPTY_ANNOTATIONS: Partial<Annotations>[] = [];
const ASPECT_RATIO = 2010 / 860;

export function RinkPlot({
  traces = EMPTY_TRACES,
  annotations = EMPTY_ANNOTATIONS,
  className,
}: RinkPlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const updateRef = useRef<
    ((data: Data[], arrows: Partial<Annotations>[]) => void) | null
  >(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Each mount owns a separate node so unfinished Plotly work cannot touch
    // the next instance during Strict Mode cleanup or navigation.
    const plot = document.createElement("div");
    container.appendChild(plot);
    let disposed = false;
    let initialized = false;
    let frame = 0;
    let data = EMPTY_TRACES;
    let arrows = EMPTY_ANNOTATIONS;
    let pending = Promise.resolve();

    function scheduleRender() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        pending = pending
          .then(async () => {
            if (disposed) return;
            const available = container!.getBoundingClientRect();
            if (available.width <= 0 || available.height <= 0) return;
            const buffer = 10;
            const rinkWidth = Math.min(
              Math.max(0, available.width - buffer * 2),
              Math.max(0, available.height - buffer * 2) * ASPECT_RATIO,
            );
            if (rinkWidth <= 0) return;
            const width = rinkWidth + buffer * 2;
            const height = rinkWidth / ASPECT_RATIO + buffer * 2;
            plot.style.width = `${width}px`;
            plot.style.height = `${height}px`;

            const layout: Partial<Layout> = {
              width,
              height,
              margin: { l: 0, r: 0, t: 0, b: 0, pad: 0 },
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              showlegend: false,
              dragmode: false,
              annotations: arrows,
              // Put the buffer inside the axis ranges so rink-edge symbols remain
              // inside Plotly's drawing area, rather than relying on outer margins.
              xaxis: {
                range: [
                  (-buffer * 200) / rinkWidth,
                  200 + (buffer * 200) / rinkWidth,
                ],
                visible: false,
                fixedrange: true,
                layer: "below traces",
              },
              yaxis: {
                range: [
                  (-buffer * 85) / (rinkWidth / ASPECT_RATIO),
                  85 + (buffer * 85) / (rinkWidth / ASPECT_RATIO),
                ],
                visible: false,
                fixedrange: true,
                layer: "below traces",
              },
              images: [
                {
                  source: rinkImage,
                  xref: "x",
                  yref: "y",
                  x: 0,
                  y: 85,
                  sizex: 200,
                  sizey: 85,
                  xanchor: "left",
                  yanchor: "top",
                  sizing: "contain",
                  layer: "below",
                },
              ],
            };
            const plotData = data.map((trace) =>
              trace.type === "scatter"
                ? { ...trace, cliponaxis: false }
                : trace,
            );
            const config = { displayModeBar: false, scrollZoom: false };
            if (initialized) {
              await Plotly.react(plot, plotData, layout, config);
            } else {
              await Plotly.newPlot(plot, plotData, layout, config);
              initialized = true;
            }
          })
          .catch((error: unknown) => {
            if (!disposed) console.error("Unable to render rink plot:", error);
          });
      });
    }

    updateRef.current = (nextData, nextArrows) => {
      data = nextData;
      arrows = nextArrows;
      scheduleRender();
    };
    const observer = new ResizeObserver(scheduleRender);
    observer.observe(container);
    scheduleRender();

    return () => {
      disposed = true;
      updateRef.current = null;
      observer.disconnect();
      cancelAnimationFrame(frame);
      plot.remove();
      // Wait for any in-flight render before releasing Plotly's resources.
      void pending.finally(() => Plotly.purge(plot));
    };
  }, []);

  useEffect(() => {
    updateRef.current?.(traces, annotations);
  }, [traces, annotations]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Hockey rink plot"
      className={cn(
        "flex h-full w-full min-h-0 min-w-0 items-center justify-center overflow-hidden",
        className,
      )}
    />
  );
}
