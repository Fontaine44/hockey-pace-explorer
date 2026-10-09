import { Link } from "react-router-dom";

import paceDiagram from "@/assets/pace.png";
import { PageHeader } from "@/components-custom/PageHeader";
import { Button } from "@/components/ui/button";

const measures = [
  { name: "Total pace", definition: "Puck movement in any direction." },
  {
    name: "East–west pace",
    definition: "Movement across the width of the rink.",
  },
  {
    name: "North–south pace",
    definition: "Movement along the length of the rink, forward or backward.",
  },
  {
    name: "North-only pace",
    definition:
      "Forward movement toward the opponent’s goal; backward movement contributes no distance.",
  },
];

export function ResearchOverviewPage() {
  return (
    <div className="flex flex-col gap-8 pb-4">
      <PageHeader
        title="Research overview"
        descriptionClassName="mt-3"
        description="Understand the measures used to describe puck movement."
      />
      <section
        aria-labelledby="pace-definition"
        className="max-w-3xl space-y-3"
      >
        <h2 id="pace-definition" className="text-lg font-semibold">
          What is pace?
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Pace measures how quickly the puck moves across the ice during
          possession, expressed in feet per second (ft/s). It describes puck
          movement rather than skating speed.
        </p>
        <p className="text-sm font-medium">
          Pace = distance travelled ÷ elapsed time
        </p>
      </section>
      <section aria-labelledby="pace-measures" className="space-y-4">
        <h2 id="pace-measures" className="text-lg font-semibold">
          Four ways to measure it
        </h2>
        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="max-w-xl space-y-4 text-sm leading-relaxed">
            <dl className="space-y-4">
              {measures.map((measure) => (
                <div key={measure.name}>
                  <dt className="font-medium">{measure.name}</dt>
                  <dd className="text-muted-foreground">
                    {measure.definition}
                  </dd>
                </div>
              ))}
            </dl>
            <p>In this project, forward pace means North-only pace.</p>
            <p className="text-muted-foreground">
              This project adapts the paper’s approach using recorded puck
              events and estimated movement timing.
            </p>
          </div>
          <figure className="min-w-0 max-w-3xl space-y-2">
            <img
              src={paceDiagram}
              alt="Rink diagram showing the direction of attack, total puck movement, east–west movement across the rink, north–south movement along the rink, and north-only movement toward the attacking goal."
              className="h-auto w-full"
            />
            <figcaption className="text-xs leading-relaxed text-muted-foreground">
              Image: Figure 1 from{" "}
              <a
                href="https://arxiv.org/abs/1902.02020"
                className="underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <cite>Playing Fast, Not Loose</cite>
              </a>{" "}
              by David Yu, Christopher Boucher, Luke Bornn, and Mehrsan Javan
              (2019).
            </figcaption>
          </figure>
        </div>
      </section>
      <section aria-labelledby="pace-explore" className="max-w-3xl space-y-3">
        <h2 id="pace-explore" className="text-lg font-semibold">
          Does playing faster help?
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Explore how pace relates to entry choices, shot generation, passing
          success, and puck recovery.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/pace-outcomes">Explore Pace &amp; Outcomes</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/game-review">Review a Game</Link>
          </Button>
        </div>
      </section>
      <section
        aria-labelledby="pace-interpretation"
        className="max-w-3xl space-y-3"
      >
        <h2 id="pace-interpretation" className="text-lg font-semibold">
          How to interpret this project
        </h2>
        <dl className="space-y-3 text-sm leading-relaxed">
          <div>
            <dt className="font-medium">Event-based estimates</dt>
            <dd className="text-muted-foreground">
              Movement between recorded events and its timing are estimated.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Limited evidence</dt>
            <dd className="text-muted-foreground">
              The sample is small. Results describe associations, not causal
              effects.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Dataset coverage</dt>
            <dd className="text-muted-foreground">
              Game Review covers six Olympic games across all game situations.
              Research results combine 34 games and use 5v5 observations.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
