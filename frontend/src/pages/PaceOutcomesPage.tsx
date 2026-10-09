import { useState } from "react";

import { OutcomeCard } from "@/components-custom/OutcomeCard";
import { PageHeader } from "@/components-custom/PageHeader";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EntryOutcomesChart } from "@/components/charts/EntryOutcomesChart";
import { PassOutcomesChart } from "@/components/charts/PassOutcomesChart";
import { ShotOutcomesChart } from "@/components/charts/ShotOutcomesChart";
import {
  DumpInOutcomesChart,
  EntryTypeOutcomesChart,
  OzRecoveryOutcomesChart,
} from "@/components/charts/RemainingOutcomeCharts";

const outcomeCharts = [
  EntryOutcomesChart,
  EntryTypeOutcomesChart,
  PassOutcomesChart,
  ShotOutcomesChart,
  DumpInOutcomesChart,
  OzRecoveryOutcomesChart,
];

const outcomes = [
  {
    title: "Shot generation after controlled entries",
    question:
      "Does faster forward pace before entry coincide with more shot generation?",
    explanation:
      "Forward-only pace before controlled entries (carried or played).\n\nSuccess is a subsequent shot attempt within 5 seconds of zone entry.",
  },
  {
    title: "Zone entry type by pace",
    question:
      "Does faster pace before zone entry coincide with more controlled entries?",
    explanation:
      "Total possession pace before the zone entry.\n\nControlled entries (carried or played) are compared with dumped entries.",
  },
  {
    title: "Pass completion by pace",
    question: "Does faster pace before a pass coincide with higher completion?",
    explanation:
      "Total possession pace before a pass attempt (direct or indirect).\n\nCompleted passes are compared with incomplete passes.",
  },
  {
    title: "Shot execution by pace",
    question: "Does faster pace before a shot coincide with a better shot?",
    explanation:
      "Total pace during the 5 seconds preceding shot attempts.\n\nOutcomes are on-net percentage and average shot distance.",
  },
  {
    title: "Dump-in recovery by pace",
    question:
      "Does faster pace before a dump-in coincide with puck recovery by the dumping team?",
    explanation:
      "Total possession pace through the dump-in.\n\nSuccess means the dumping team establishes control within five seconds, including recovery after initial opponent control.",
  },
  {
    title: "Shot generation after offensive-zone recoveries",
    question:
      "Does faster movement after an offensive-zone puck recovery coincide with more shot generation?",
    explanation:
      "Total pace after an offensive-zone puck recovery.\n\nThe outcome is whether that possession generates a shot attempt.",
  },
];

export function PaceOutcomesPage() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const outcome = outcomes[selectedIndex];
  const Chart = outcomeCharts[selectedIndex];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8">
      <div className="shrink-0">
        <PageHeader
          title="Pace & outcomes"
          descriptionClassName="mt-3 max-w-none"
          description="Compare outcomes across four pace groups (quartiles), each containing roughly 25% of observations, from lowest to highest pace. Only 5v5 game situations."
        />
      </div>
      <TooltipProvider delayDuration={0}>
        <section
          aria-label="Pace and outcomes analysis"
          className="grid min-h-[400px] flex-1 grid-cols-[340px_minmax(0,1fr)] gap-4 pb-4"
        >
          <nav
            aria-label="Analysis navigation"
            className="flex flex-col items-start gap-1"
          >
            {outcomes.map((item, index) => (
              <Button
                key={item.title}
                type="button"
                variant="ghost"
                aria-pressed={selectedIndex === index}
                aria-controls="selected-outcome"
                onClick={() => setSelectedIndex(index)}
                className={`h-auto w-full cursor-pointer justify-start whitespace-normal px-3 py-3 text-left ${
                  selectedIndex === index
                    ? "bg-zinc-800 text-white hover:bg-zinc-700 hover:text-white"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.title}
              </Button>
            ))}
          </nav>
          <div id="selected-outcome" className="min-h-0 min-w-0">
            <OutcomeCard key={outcome.title} {...outcome}>
              <Chart />
            </OutcomeCard>
          </div>
        </section>
      </TooltipProvider>
    </div>
  );
}
