# Hockey Pace Explorer — Game Review Specification

## Purpose

Provide a compact, team-agnostic review screen for exploring individual event sequences and comparing both teams' puck-movement pace in a selected game.

The screen combines sequence inspection with whole-game spatial and period-level context. Use existing cleaned events, sequence definitions, and pace calculations rather than implementing a separate analytical pipeline in the frontend.

## Layout

A game selector sits above the panel grid. The desktop layout has four panels arranged in two columns and two rows:

| Position | Component |
| --- | --- |
| Top-left | Selected sequence on a rink |
| Top-right | Sequence selector and navigation |
| Bottom-left | Whole-game pace polygrid |
| Bottom-right | Team pace comparison: full game and periods |

On narrow screens, stack panels in reading order. Keep the desktop interface compact and ensure the sequence list scrolls within its panel.

## Global game selector

- Display each game by date and matchup.
- Selecting a game updates all four panels.
- The overall page has no selected-team filter: sequences from both teams are available.
- Use stable team colours across the page, with team names or a legend wherever needed.
- Initially select the first eligible sequence in chronological order.
- On a game change, reset the sequence-period filter to all periods and select the first eligible sequence for the new game.

## Top-left: sequence rink

### Toolbar

Display:

- Period selector: all periods or a specific period present in the game.
- Selected sequence's period and start clock.
- Score at the start of the selected sequence, labelled with team names.
- Team controlling the sequence and its attacking direction.

The clock and score describe the selected sequence, not the final game result. Derive score from the existing event data and explicitly orient team-relative goals-for/goals-against values to the displayed matchup.

### Rink plot

- Draw all recorded events belonging to the selected sequence.
- Use numbered markers to communicate event order, including events sharing a timestamp.
- Draw directional paths for recorded puck movement.
- Distinguish pass endpoints from subsequent event locations so that the same movement is not drawn twice.
- Make the attacking direction explicit. Use the existing coordinate conventions consistently.
- Render paths between discrete observations as estimated movement; do not imply continuous tracking.
- Hovering an event shows player, period/clock, event type, recorded result, and any relevant event detail available.
- Preserve the source ordering of same-second events.
- Show a clear empty state if the selected game or period contains no eligible sequences.

Animation is optional and is not required for the first version.

## Top-right: sequence selector

Use a compact selectable table, with columns:

| Column | Meaning |
| --- | --- |
| Team | Team controlling the sequence |
| Period / start clock | Location in the game |
| Starting zone | Defensive, neutral, or offensive, relative to the controlling team |
| Duration | Sequence elapsed time in seconds |
| Total pace | Existing sequence-level total pace in ft/s |
| Outcome | Observed result under the project's existing sequence/outcome definitions |

### Behaviour

- Default ordering is chronological.
- Selecting a row updates the top-left rink, clock, score, and sequence information.
- Clearly highlight the selected row.
- Previous/next arrows in the panel toolbar navigate through the currently displayed ordered list.
- Disable previous/next controls at the corresponding list boundaries.
- Changing the period filter updates the list. Keep the selected sequence if it remains visible; otherwise select the first sequence in the filtered list.
- The list includes both teams. Do not automatically filter it when the polygrid's team selection changes.
- Display unavailable pace or unresolved outcomes explicitly instead of substituting zero or an inferred failure.

Outcome names must reflect actual implemented labels. Do not invent new possession-end classifications solely for presentation.

## Bottom-left: whole-game pace polygrid

### Controls

- Team selector: either team in the selected game.
- Pace selector: total, forward, or lateral.
- Suggested initial state: the first team in the matchup and total pace.

### Plot

- Cover the **whole game**, regardless of the sequence-period filter or selected sequence.
- Overlay the existing pace polygrid on a rink.
- Show the selected team, pace measure, attacking direction, and a colour legend in ft/s.
- For each pace measure, use the same colour scale for both teams within the selected game. Switching teams must not rescale the map independently.
- Different pace measures may have different scales, provided they are labelled clearly.
- Mark unavailable or low-coverage cells as missing or visually muted; do not interpret missing cells as zero pace.
- If available, hover shows cell pace and contributing observed time or observation count.
- Label the panel's scope explicitly as "Whole game."

Changing the team or pace selector updates this panel only. Sequence selection and period filtering do not update it.

## Bottom-right: pace by team and period

### Control

An independent pace selector: total, forward, or lateral. Suggested initial state: total pace.

### Chart

Use grouped bars, with two bars per category, one for each team:

1. Full game.
2. Period 1.
3. Period 2.
4. Period 3.

Include additional periods, such as overtime, if present in the selected game. Do not fabricate absent periods or show them as zero.

- Show pace in ft/s and a team legend.
- Use consistent team colours.
- Hover shows the exact pace value and contributing eligible elapsed time, when available.
- Missing measurements are shown explicitly.
- Differences in pace use neutral styling: higher pace is not automatically better performance.
- Label the scope as "Full game and individual periods."

The chart answers: **Did either team's pace change as the game progressed?**

This panel shows both teams regardless of the polygrid's team selection. It remains unchanged when the sequence-period filter or selected sequence changes.

## Interaction scope

| Action | Sequence rink | Sequence list | Polygrid | Team/period chart |
| --- | --- | --- | --- | --- |
| Change game | Update | Update | Update | Update |
| Change sequence period | Update selection if needed | Filter | No change | No change |
| Select sequence / previous / next | Update | Highlight selection | No change | No change |
| Change polygrid team or pace | No change | No change | Update | No change |
| Change comparison pace | No change | No change | No change | Update |

The sequence-period filter is local to the top panels. The lower panels preserve whole-game context.

## Pace definitions and aggregation

- Use the existing Python analytical pipeline as the source of truth.
- Total pace measures overall puck movement; forward pace measures movement toward the opposing goal; lateral pace measures movement across the rink.
- Display units consistently as ft/s.
- Keep the implemented definitions and eligibility rules consistent across the screen. Explain any difference between sequence summaries, polygrid values, and period aggregates.
- For distance-over-time aggregate pace, calculate eligible distance divided by eligible elapsed time. Do not calculate a full-game value by taking an unweighted mean of period or sequence pace values.
- Do not bridge possession changes, period boundaries, or other excluded intervals.
- Preserve existing handling of zero-duration intervals; never invent subsecond timing.
- Provide a compact definitions tooltip or expandable note explaining event-based pace, coverage, and estimated paths.

Strength filtering has not been selected as a visible control for this layout. Label the data scope used by each panel explicitly. If panels use different eligibility or strength restrictions, disclose those differences rather than implying direct comparability.

## Optional integration with Pace & Outcomes

If implemented, selecting a supporting sequence in Pace & Outcomes opens its game and selects that sequence in Game Review. A short label can identify the originating analysis group. This integration must not change the whole-game scope of the lower panels.

## Acceptance criteria

- All four panels show data from the selected game.
- Sequences from both teams can be selected without changing a global team filter.
- Rink markers and hover details correspond to the selected sequence's actual events.
- Period filtering and previous/next navigation follow the displayed sequence list.
- Clock and score correspond to the selected sequence's start.
- The polygrid stays fixed to the whole game when sequence or period selection changes.
- Polygrid team switching retains a comparable scale for the same pace measure.
- The comparison chart shows both teams for the full game and each available period.
- Loading, empty, missing-data, and error states are readable and do not present missing data as zero.
- Chart values agree with the existing Python-derived data.

## First-version boundaries

No separate pace overview cards or game timeline are required in this four-panel layout. Keep the page focused on sequence inspection, spatial pace, and team/period comparison. Animation and cross-page navigation are optional enhancements.
