import { OutcomeCard } from "@/components-custom/OutcomeCard";
import { PageHeader } from "@/components-custom/PageHeader";
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
  PassOutcomesChart,
  ShotOutcomesChart,
  OzRecoveryOutcomesChart,
  EntryTypeOutcomesChart,
  DumpInOutcomesChart,
];

const outcomes = [
  {
    title: "Controlled zone entry shot generation",
    question:
      "Does faster forward pace before entry coincide with more shot generation?",
    explanation:
      "Forward-only pace before controlled entries (carried or played).\n\nSuccess is a subsequent shot attempt within 5 seconds of zone entry.",
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
    title: "Offensive-zone recoveries pace",
    question:
      "Does faster movement after an offensive-zone puck recovery coincide with more shot generation?",
    explanation:
      "Total pace after an offensive-zone puck recovery.\n\nThe outcome is whether that possession generates a shot attempt.",
  },
  {
    title: "Entry type by pace",
    question:
      "Does faster pace before zone entry coincide with more controlled entries?",
    explanation:
      "Total possession pace before the zone entry.\n\nControlled entries (carried or played) are compared with dumped entries.",
  },
  {
    title: "Dump-in recovery by pace",
    question:
      "Does faster pace before a dump-in coincide with puck recovery by the dumping team?",
    explanation:
      "Total possession pace through the dump-in.\n\nSuccess means the dumping team establishes control within five seconds, including recovery after initial opponent control.",
  },
];

export function PaceOutcomesPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="shrink-0">
        <PageHeader
          title="Pace & outcomes"
          descriptionClassName="max-w-none"
          description="Compare outcomes across four pace groups (quartiles), each containing roughly 25% of observations, from lowest to highest pace. Only 5v5 game situations."
        />
      </div>
      <TooltipProvider delayDuration={0}>
        <section
          aria-label="Pace and outcomes panels"
          className="grid min-h-[1128px] flex-1 grid-cols-2 grid-rows-[repeat(3,minmax(360px,1fr))] gap-4 pb-4"
        >
          {outcomes.map((outcome, index) => {
            const Chart = outcomeCharts[index];
            return (
              <OutcomeCard key={outcome.title} {...outcome}>
                <Chart />
              </OutcomeCard>
            );
          })}
        </section>
      </TooltipProvider>
    </div>
  );
}
