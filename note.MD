# Notebook notes

## 00 — Exploratory data analysis

[00_eda.ipynb](notebooks/00_eda.ipynb) explores three women's hockey event datasets:

- `hackathon_nwhl.csv` — NWHL.
- `hackathon_womens.csv` — the Womens dataset, including 2018 Olympic games.
- `pxp_womens_oly_2022_v2.csv` — 2022 Olympics.

The notebook examines dataset sizes, columns, game and team coverage, duplicate records, missing values by event, numeric ranges, event frequencies, and rink locations for shots, passes, faceoffs, and zone entries.

Key findings:

- NWHL and Womens share a column structure; Olympics uses different names and representations.
- Olympics records goals as successful `Shot` events and unsuccessful passes as `Play` events with a false outcome.
- Olympics `event_type` corresponds to legacy `Detail 1`. Its three additional detail columns correspond to `detail_2` through `detail_4`.
- Repeated records can be legitimate, including a double minor; they should not be removed indiscriminately.
- Zone-entry locations differ across sources, which limits direct spatial comparisons.

The final schema defines teams, players, games, and events, with scores and skater counts expressed from the credited event team's perspective. A separate event-types table is added in the processing notebook.

## 01 — Event processing

[01_event_processing.ipynb](notebooks/01_event_processing.ipynb) standardizes the source datasets and builds five related tables.

### Field and team mappings

- Rename source columns to a common vocabulary.
- Convert legacy `MM:SS` clocks to seconds remaining.
- Map legacy home/away scores and skater counts to team/opponent fields.
- Split Olympics `situation_type`; the first count belongs to `team_name`.
- Derive `is_home` and retain both game participants.
- Remove the `Olympic (Women) -` prefix and add a year suffix, such as `Canada (O18)` or `Canada (O22)`.
- Swap Olympics Zone Entry score fields to correct their reversed team perspective.

### Event normalization

- Convert Olympics `t`/`f` outcomes to nullable Booleans during processing.
- Expand successful passes into `Pass` and `Pass Reception`.
- Expand unsuccessful passes into `Incomplete Pass` and `Incomplete Pass Reception`; the reception represents the intended target.
- Reception rows use the secondary player and target coordinates. Drop secondary coordinates after expansion.
- Relabel successful Olympics shots as `Goal`.
- Map Olympics dump outcomes to `detail_1`: successful means `Retained` (101 rows), unsuccessful means `Lost` (743 rows).
- Insert the confirmed missing `Penalty Shot Goal` by Marie-Philip Poulin in Canada–United States on February 8, 2022, at 2:35 remaining in period 2, before the faceoff. Keep pre-goal scores and leave unverified coordinates and shot details missing. Carry surrounding manpower context in Canada's perspective.
- Replace Shot/Goal traffic flags with `Traffic` / `No traffic` and one-timer flags with `One timer` / `Not a one timer`.
- Preserve recorded clocks, including ties. The artificial timestamp splitter was removed because its fractions could create invented movement speeds; `event_id` preserves event order.
- Drop `event_successful` before combining datasets; the final event schema does not retain this field.

### Types and table construction

Parse dates with explicit source formats and use pandas nullable integer, floating-point, Boolean, and string types. Align column names, order, and types before concatenating the datasets.

Build teams first, then players and games, followed by event types and events. Teams are scoped by source dataset; players are scoped by source, team, and name. Games use source, date, and home/away matchup, assuming no repeated matchup on the same date within a source.

Include `opponent_team_id` in the final events schema as a required integer foreign key to the other game participant.

Include both primary and secondary players. Pass targets belong to the event team; Zone Entry defenders, faceoff losers, and players drawing penalties belong to the opponent. Use these rules to resolve secondary-player IDs without adding a secondary-team column to the final events table.

### Validation and export

Section 1.6 checks primary keys, required values, logical types, unique records, foreign keys, source consistency, player/team attribution, event labels, expansion counts, coordinate bounds, score ranges, clock ordering, and opponent-team relationships. Tied timestamps are permitted. A separate Olympics check compares corrected scores with cumulative `Goal` and `Penalty Shot Goal` counts, allowing pre-goal or post-goal scores on goal rows.

The run after adding opponent-team validation passed 109 general checks and the Olympics score check, with no remaining Olympics score mismatches or decreases.

| Table | Rows | Export |
|---|---:|---|
| Teams | 20 | `data/processed/teams.parquet` |
| Players | 435 | `data/processed/players.parquet` |
| Games | 34 | `data/processed/games.parquet` |
| Event types | 13 | `data/processed/event_types.parquet` |
| Events | 86,670 | `data/processed/events.parquet` |

Section 1.7 exports compressed Parquet files and reloads each one to verify values, column order, and datatypes. Exported clocks are rounded to six decimal places, matching the intended SQL `DECIMAL(10,6)` precision.

### Interpretation limits

- Expanded receptions increase event counts; they are derived player actions rather than additional recorded plays.
- Recorded timestamps have limited precision; event order does not measure elapsed time between same-second events.
- Player IDs identify source/team/name combinations, not verified identities across datasets.
- Dropping outcome flags removes explicit success information for events whose labels do not encode it, such as zone entries.
- Notebooks 00 and 01 prepare event tables. Possession inference and spatial context are added in notebook 02; pace calculations remain separate.


## 02 ? Data augmentation

[02_data_augmentation.ipynb](notebooks/02_data_augmentation.ipynb) loads the five processed tables and augments an event copy. The reference is [Playing Fast Not Loose](media/Playing%20Fast%20Not%20Loose.pdf), particularly methods sections 2.1?2.3. Our possession labels are inferred; the paper uses supplied possession states and precise timestamps.

### Spatial and game context

Coordinates are always from the event team's perspective, attacking toward increasing x. Assign `event_team_zone`: `DZ` below 75, `NZ` from 75 through 125, and `OZ` above 125. Blue-line locations belong to the neutral zone by convention. Missing or out-of-range x remains unclassified.

Add `is_5v5` and `score_differential`, both from the event team's perspective. Slot/house location context remains a TODO.

### Possession sequences ? section 2.4

Keep only `possession_team_id` and `possession_id` as possession outputs.

- Recoveries, takeaways, faceoff wins, passes/receptions, incomplete-pass releases, shots/goals, dumps, and all zone-entry subtypes establish ownership for the event team.
- Penalties and generated incomplete-pass receptions retain the previous owner; neither establishes control.
- Shots and unsuccessful releases do not immediately transfer ownership. The next control event determines the owner.
- Start a new sequence at an ownership change, manpower change, faceoff restart, post-goal restart, or game/period change. Isolate penalty-shot goals. Compare skaters from a fixed home/away perspective.
- Manpower changes preserve the owner but split the sequence. Zone changes and long clock gaps do not automatically split base sequences.
- Before control evidence, use the initial event team provisionally. This is an inference, not confirmed puck control.

Validation remains in a separate assessment cell. It checks preserved events, sequence consistency, control attribution, restarts, and ordering. The verified run produces 16,046 sequences. Median sequence size is four rows and median recorded span is three to four seconds; these spans are not measured continuous possession durations.

### Event transitions ? section 2.5

Build a separate `transitions_df` rather than adding transition columns to the event table. Link consecutive eligible positions within each sequence, using positions credited to the sequence owner.

Include recoveries, takeaways, faceoff wins, pass releases/receptions, incomplete-pass releases, shots/goals, dumps, and all zone entries. Exclude incomplete-pass reception targets, penalties, and the special-play penalty-shot goal. Keep missing endpoints visible rather than bridging across them.

Each transition stores source, game, period, possession identifiers, start/end event IDs, recorded clocks, and coordinates. Event IDs link back to the augmented events. Keep final positions and tied timestamps; do not calculate distances or speeds here.

The verified run produces 63,298 transitions: 35,057 with positive recorded elapsed time and 28,241 within the same recorded second. No transition crosses a sequence boundary. The current transition endpoints have no missing coordinates.

### Export and next steps

Skip section 2.6; use the checks in 2.4 and 2.5. Section 2.7 exports both tables to `data/processed`, preserving notebook 01's filenames:

| Output | Rows | File |
|---|---:|---|
| Augmented events | 86,670 | `data/processed/events_augmented.parquet` |
| Event transitions | 63,298 | `data/processed/event_transitions.parquet` |

Restart and rerun from 2.1 after removing derived columns, then export again. Existing dataframe state can otherwise retain obsolete fields. At this documentation update, the augmented export still contains six retired fields: `possession_evidence`, `possession_uncertain`, `boundary_reason`, `is_possession_event`, `is_terminal_event`, and `terminal_reason`. A fresh run should produce 26 event columns rather than the currently exported 32.

The pace notebook will calculate elapsed time, displacement, distance, and directional speeds, and decide how to handle same-second transitions. Preserve the last observed movement within each sequence; do not drop a position merely because it is last. The paper's terminal-event wording does not fully resolve its dataset-specific handling, so document our interpretation rather than assuming an exact replication. No movement may cross a sequence boundary.
