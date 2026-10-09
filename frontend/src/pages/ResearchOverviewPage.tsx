import { Link } from "react-router-dom";

import paceDiagram from "@/assets/pace.png";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const measures = [
  { name: "Total", definition: "Movement in any direction." },
  {
    name: "Forward (North-only)",
    definition:
      "Movement toward the opponent's goal; backward movement contributes zero.",
  },
  {
    name: "Lateral (East-west)",
    definition: "Movement across the width of the rink.",
  },
  {
    name: "Longitudinal (North-south)",
    definition: "Movement along the length of the rink, forward or backward.",
  },
];

export function ResearchOverviewPage() {
  return (
    <div className="flex flex-col gap-4 pb-4 [&_dd]:text-justify [&_p]:text-justify">
      <section aria-labelledby="research-question" className="w-full space-y-3">
        <h1
          id="research-question"
          className="py-4 text-center text-2xl font-bold leading-snug tracking-tight lg:text-3xl"
        >
          “When is faster puck movement associated with more successful plays?”
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Playing faster does not always mean playing more effectively. This
          project examines how pace relates to passing, zone entries, shots, and
          puck recovery, then provides a game-review tool to explore the
          possessions behind those patterns.
        </p>
      </section>
      <section
        aria-labelledby="research-background"
        className="w-full space-y-3"
      >
        <h2 id="research-background" className="text-lg font-semibold">
          Background
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The project adapts the framework introduced by Yu et al. (2019) in{" "}
          <a
            href="https://arxiv.org/abs/1902.02020"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <cite>Playing Fast Not Loose</cite>
          </a>
          . Their research examined how puck movement pace varies across the ice
          and relates to play outcomes. This project adapts their approach to
          examine the relationship between puck movement pace and success across
          a broader range of play situations.
        </p>
      </section>
      <section aria-labelledby="data-preparation" className="w-full space-y-3">
        <h2 id="data-preparation" className="text-lg font-semibold">
          Data and preparation
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The project uses Stathletes event data published in the{" "}
          <a
            href="https://github.com/bigdatacup/Big-Data-Cup-2021"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Big Data Cup repository
          </a>
          . Game Review covers the six supplied games from the 2022 women's
          Olympic tournament. Pace &amp; Outcomes combines these games with the
          extended datasets provided in the repository, covering 34 games across
          three event datasets. Raw records are standardized into events and
          grouped into possessions, from which pace and play outcomes are
          calculated.
        </p>
      </section>
      <section aria-labelledby="pace-measures">
        <div className="grid items-start gap-8 lg:grid-cols-2">
          <div className="min-w-0 space-y-4 text-sm leading-relaxed">
            <h2 id="pace-measures" className="text-lg font-semibold">
              What is pace?
            </h2>
            <p className="text-muted-foreground">
              Pace measures how quickly a team moves the puck during possession,
              through both carries and passes. It is calculated from the
              distance and elapsed time between successive puck events.
            </p>
            <p>
              <strong className="font-medium">
                Pace = reconstructed puck movement distance ÷ elapsed time
              </strong>
              , expressed in feet per second (ft/s).
            </p>
            <Table aria-label="Pace components">
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead>What it measures</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {measures.map((measure) => (
                  <TableRow key={measure.name}>
                    <TableCell className="align-top font-medium">
                      {measure.name}
                    </TableCell>
                    <TableCell className="align-top text-muted-foreground">
                      {measure.definition}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-muted-foreground">
              Event locations and timing describe the puck's progression through
              a possession. The resulting pace combines movement across events,
              rather than measuring a player's skating speed or the flight speed
              of a single pass.
            </p>
            <p className="text-muted-foreground">
              The figure on the right follows a puck recovery through carries
              and passes to a shot; the backward pass to P3 contributes to total
              pace but not forward pace.
            </p>
          </div>
          <figure className="min-w-0 w-full max-w-3xl place-self-center space-y-2">
            <img
              src={paceDiagram}
              alt="Rink diagram showing the direction of attack, total puck movement, east–west movement across the rink, north–south movement along the rink, and north-only movement toward the attacking goal."
              className="h-auto w-full"
            />
            <figcaption className="text-xs leading-relaxed text-muted-foreground">
              Image: Figure 1 from{" "}
              <a
                href="https://arxiv.org/abs/1902.02020"
                target="_blank"
                rel="noopener noreferrer"
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
      <section
        aria-labelledby="analytical-approach"
        className="w-full space-y-3"
      >
        <h2 id="analytical-approach" className="text-lg font-semibold">
          Analytical approach
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          5v5 observations are divided into four roughly equal-sized pace groups
          (quartiles), from slowest (Q1) to fastest (Q4). The analyses compare:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Shot generation after controlled entries.</li>
          <li>Carried, played, and dumped entry choices.</li>
          <li>Pass completion and shots reaching the net.</li>
          <li>Puck recovery after dump-ins.</li>
          <li>Shot generation following offensive-zone recoveries.</li>
        </ul>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Most analyses measure pace before an event. The offensive-zone
          recovery analysis instead measures pace after recovery, through the
          first shot or possession end. Each analysis’s measurement window and
          outcome definition accompany its results on the{" "}
          <Link
            to="/pace-outcomes"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Pace &amp; Outcomes
          </Link>{" "}
          page.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The{" "}
          <Link
            to="/game-review"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Game Review
          </Link>{" "}
          tool connects these measures to individual games. The spatial polygrid
          shows where puck movement is faster or slower; the team-and-period
          chart compares pace across teams and periods; the possession table
          lets users select a possession; and the rink plot shows its events and
          puck movement.
        </p>
      </section>
      <section
        aria-labelledby="pace-interpretation"
        className="w-full space-y-3"
      >
        <h2 id="pace-interpretation" className="text-lg font-semibold">
          Interpretation and limitations
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The results do not establish that faster puck movement leads to more
          successful plays, but they provide insight into how pace and outcomes
          vary across different play situations. These associations require
          careful interpretation: faster movement may help create an
          opportunity, but it may also arise because an opportunity already
          exists, for example, when open space allows a team to advance quickly.
          Player ability, defensive pressure, and game state can influence both
          pace and execution, so differences between pace groups cannot be
          attributed to pace alone. The following limitations should therefore
          be considered when interpreting the results.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-justify text-sm leading-relaxed text-muted-foreground">
          <li>
            <strong className="font-medium text-foreground">
              Event-based measurement:
            </strong>{" "}
            Movement is reconstructed between recorded locations rather than
            measured through continuous puck tracking.
          </li>
          <li>
            <strong className="font-medium text-foreground">
              Timing resolution:
            </strong>{" "}
            Timestamps have one-second resolution. Events sharing a timestamp
            are ordered using modeled timing, but their precise spacing within
            that second is unknown, which can affect pace over short intervals.
          </li>
          <li>
            <strong className="font-medium text-foreground">
              Play context:
            </strong>{" "}
            Comparisons do not adjust for factors such as defensive pressure,
            player ability, or game state. Restricting outcomes to 5v5 controls
            manpower, but does not make the play situations otherwise
            equivalent.
          </li>
        </ul>
      </section>
      <section aria-labelledby="future-work" className="w-full space-y-3">
        <h2 id="future-work" className="text-lg font-semibold">
          Future work
        </h2>
        <ul className="list-disc space-y-1 pl-5 text-justify text-sm leading-relaxed text-muted-foreground">
          <li>
            <em className="text-foreground">
              How does pace relate to momentum throughout a game?
            </em>{" "}
            Examine whether changes in puck movement pace precede or follow
            shifts in territorial control and scoring opportunities.
          </li>
          <li>
            <em className="text-foreground">
              How do defenses respond to faster puck movement?
            </em>{" "}
            Investigate changes in defensive positioning, pressure, and the
            ability to regain control.
          </li>
          <li>
            <em className="text-foreground">
              Which player combinations generate and sustain pace?
            </em>{" "}
            Extend the player-level pace framework proposed by{" "}
            <a
              href="https://arxiv.org/abs/1902.02020"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Yu et al. (2019)
            </a>{" "}
            to lines and combinations, exploring how players together influence
            attacking and defending pace.
          </li>
        </ul>
      </section>
      <section aria-labelledby="references" className="w-full space-y-3">
        <h2 id="references" className="text-lg font-semibold">
          References
        </h2>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-foreground">
          <li>
            Yu, D., Boucher, C., Bornn, L., &amp; Javan, M. (2019).{" "}
            <cite>
              Playing Fast Not Loose: Evaluating team-level pace of play in ice
              hockey using spatio-temporal possession data
            </cite>
            .{" "}
            <a
              href="https://arxiv.org/abs/1902.02020"
              target="_blank"
              rel="noopener noreferrer"
            >
              arXiv:1902.02020
            </a>
            .
          </li>
          <li>
            Silva, R. M., Davis, J., &amp; Swartz, T. B. (2018).{" "}
            <cite>The evaluation of pace of play in hockey</cite>. Journal of
            Sports Analytics, 4(2), 145–151.{" "}
            <a
              href="https://doi.org/10.3233/JSA-170192"
              target="_blank"
              rel="noopener noreferrer"
            >
              doi:10.3233/JSA-170192
            </a>
            .
          </li>
          <li>
            Shen, E., Santo, S., &amp; Akande, O. (2022).{" "}
            <cite>
              Analyzing pace-of-play in soccer using spatio-temporal event data
            </cite>
            . Journal of Sports Analytics, 8(2), 127–139.{" "}
            <a
              href="https://doi.org/10.3233/JSA-200581"
              target="_blank"
              rel="noopener noreferrer"
            >
              doi:10.3233/JSA-200581
            </a>
            .
          </li>
          <li>
            Stathletes. <cite>Big Data Cup: Event data and documentation</cite>.{" "}
            <a
              href="https://github.com/bigdatacup/Big-Data-Cup-2021"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub repository
            </a>
            .
          </li>
        </ul>
      </section>
    </div>
  );
}
