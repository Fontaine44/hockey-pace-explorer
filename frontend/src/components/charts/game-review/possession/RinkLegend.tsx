import { CONNECTION_STYLES, MARKER_LEGEND } from "./rink-events";

const MARKER_PATHS: Record<string, string> = {
  diamond: "M8 1L15 8L8 15L1 8Z",
  "triangle-up": "M8 1L15 14H1Z",
};
const LINE_DASHES = {
  solid: undefined,
  dot: "1 3",
};

export function RinkLegend() {
  return (
    <div
      aria-label="Rink event legend"
      className="mx-auto flex w-fit max-w-full shrink-0 items-center gap-4 overflow-x-auto pb-2 text-xs text-muted-foreground"
    >
      Legend:
      {MARKER_LEGEND.map(({ label, symbol }) => {
        const shape = symbol;
        return (
          <span
            key={symbol}
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-3.5 shrink-0"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              {shape === "circle" ? (
                <circle cx="8" cy="8" r="5.5" />
              ) : (
                <path d={MARKER_PATHS[shape]} />
              )}
            </svg>
            {label}
          </span>
        );
      })}
      {CONNECTION_STYLES.map(({ label, dash }) => (
        <span
          key={dash}
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 28 12"
            className="h-3 w-7 shrink-0"
          >
            <path
              d="M1 6H27"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray={LINE_DASHES[dash]}
            />
          </svg>
          {label}
        </span>
      ))}
      <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <svg
          aria-hidden="true"
          viewBox="0 0 28 12"
          className="h-3 w-7 shrink-0 opacity-40"
        >
          <path d="M1 6H26M22 2L26 6L22 10" fill="none" stroke="currentColor" />
        </svg>
        Shot
      </span>
    </div>
  );
}
