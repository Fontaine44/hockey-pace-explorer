"""Plotly prototypes built from notebook 03's exported pace tables."""

from pathlib import Path
import json

import numpy as np
import pandas as pd
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from plotly.offline import get_plotlyjs


COMPONENTS = {
    "Total": ("distance_ft", "speed_total_ft_s"),
    "East-west": ("distance_ew_ft", "speed_ew_ft_s"),
    "North-south": ("distance_ns_ft", "speed_ns_ft_s"),
    "North-only": ("distance_n_ft", "speed_n_ft_s"),
}
ZONES = ["DZ", "NZ", "OZ"]
ZONE_COLORS = ["#597aa6", "#cf875e", "#59966f"]


def theme(fig, title, height=500):
    fig.update_layout(
        template="plotly_white", title=title, height=height,
        font=dict(family="Arial", size=13),
        margin=dict(t=155, b=75, l=85, r=75),
        hoverlabel=dict(namelength=-1),
    )
    return fig


def dropdown(buttons, x=0, y=1.22, active=0):
    return dict(buttons=buttons, x=x, y=y, xanchor="left", yanchor="top",
                active=active, direction="down", showactive=True)


def empty_figure(message):
    fig = theme(go.Figure(), message)
    fig.add_annotation(text="No data for this selection", showarrow=False)
    return fig


def pooled_zones(intervals):
    fields = ["modeled_elapsed_seconds", *[v[0] for v in COMPONENTS.values()]]
    table = intervals.groupby("zone")[fields].sum().reindex(ZONES)
    table["transitions"] = intervals.groupby("zone")["end_event_id"].nunique().reindex(ZONES)
    table["sequences"] = intervals.groupby("zone")["possession_id"].nunique().reindex(ZONES)
    table["games"] = intervals.groupby("zone")["game_id"].nunique().reindex(ZONES)
    for distance, speed in COMPONENTS.values():
        table[speed] = table[distance] / table["modeled_elapsed_seconds"].where(
            table["modeled_elapsed_seconds"].gt(0)
        )
    return table


def zone_overview(zone_intervals, teams, sequence_lookup, default_source):
    """Four panels sharing a fixed speed scale, with pooled source/team menus."""
    if zone_intervals.empty:
        return empty_figure("Zonal pace")
    names = teams.set_index("team_id")["team_name"]
    options = []
    for source, source_data in zone_intervals.groupby("source_dataset", sort=True):
        options.append((f"{source} | All teams", pooled_zones(source_data)))
        for team in sorted(source_data["possession_team_id"].unique()):
            for role in ["attacking", "defending"]:
                ids = source_data["possession_team_id"] if role == "attacking" else (
                    source_data["possession_id"].map(sequence_lookup["opponent_team_id"])
                )
                options.append((f"{source} | {names[team]} | {role}",
                                pooled_zones(source_data.loc[ids.eq(team)])))
    fig = make_subplots(rows=1, cols=4, shared_yaxes=True, subplot_titles=list(COMPONENTS))
    buttons = []
    values = []
    for selection, (label, table) in enumerate(options):
        custom = table[["transitions", "sequences", "games", "modeled_elapsed_seconds"]].to_numpy()
        for col, (_, speed) in enumerate(COMPONENTS.values(), start=1):
            values.extend(table[speed].dropna().tolist())
            fig.add_trace(go.Bar(
                x=ZONES, y=table[speed], marker_color=ZONE_COLORS, customdata=custom,
                visible=selection == 0, showlegend=False,
                hovertemplate="%{x}: %{y:.2f} ft/s<br>Transitions: %{customdata[0]}"
                "<br>Sequences: %{customdata[1]}<br>Games: %{customdata[2]}"
                "<br>Modeled exposure: %{customdata[3]:.1f} s<extra></extra>",
            ), row=1, col=col)
        visible = [i // 4 == selection for i in range(len(options) * 4)]
        buttons.append(dict(label=label, method="update", args=[{"visible": visible},
            {"title.text": f"Pace by zone - {label} | 5v5"}]))
    initial = next(i for i, (label, _) in enumerate(options) if label == f"{default_source} | All teams")
    for i, trace in enumerate(fig.data):
        trace.visible = i // 4 == initial
    limit = max(values, default=1) * 1.12
    fig.update_yaxes(range=[0, limit])
    fig.update_yaxes(title_text="Pace (ft/s)", row=1, col=1)
    fig.update_layout(updatemenus=[dropdown(buttons, active=initial)])
    return theme(fig, f"Pace by zone - {options[initial][0]} | 5v5", 470)


def team_rankings(table, default_source):
    """Comparable ranked team dot plots, including all four components."""
    if table.empty:
        return empty_figure("Team pace")
    views = []
    for (source, role, zone), group in table.groupby(["source_dataset", "role", "zone"]):
        for component, (_, speed) in COMPONENTS.items():
            ranked = group.sort_values(speed, kind="stable")
            views.append((f"{source} | {role} | {zone} | {component}", ranked, speed))
    initial = next(i for i, (label, _, _) in enumerate(views)
                   if label == f"{default_source} | attacking | OZ | Total")
    fig = go.Figure()
    buttons = []
    for i, (label, ranked, speed) in enumerate(views):
        fig.add_trace(go.Scatter(
            x=ranked[speed], y=ranked["team_name"], mode="markers", visible=i == initial,
            marker=dict(size=12, color="#597aa6"), showlegend=False,
            customdata=ranked[["transitions", "sequences", "modeled_elapsed_seconds"]].to_numpy(),
            hovertemplate="%{y}: %{x:.2f} ft/s<br>Transitions: %{customdata[0]}"
            "<br>Sequences: %{customdata[1]}<br>Modeled exposure: %{customdata[2]:.1f} s<extra></extra>",
        ))
        buttons.append(dict(label=label, method="update", args=[
            {"visible": [j == i for j in range(len(views))]},
            {"title.text": f"Team pace - {label} | 5v5",
             "yaxis.categoryarray": ranked["team_name"].tolist()},
        ]))
    maximum = table[[v[1] for v in COMPONENTS.values()]].max().max()
    fig.update_xaxes(title="Pace (ft/s)", range=[0, float(maximum) * 1.12])
    fig.update_yaxes(categoryorder="array", categoryarray=views[initial][1]["team_name"].tolist())
    fig.update_layout(updatemenus=[dropdown(buttons, active=initial)])
    return theme(fig, f"Team pace - {views[initial][0]} | 5v5", 650)


def team_game_variation(table, games, teams, default_source):
    if table.empty:
        return empty_figure("Game pace")
    names = teams.set_index("team_id")["team_name"]
    game_lookup = games.set_index("game_id")
    work = table.copy()
    work["date"] = work["game_id"].map(game_lookup["game_date"])
    home = work["game_id"].map(game_lookup["home_team_id"])
    away = work["game_id"].map(game_lookup["away_team_id"])
    work["opponent"] = away.where(work["team_id"].eq(home), home).map(names)
    views = []
    for (source, team, role), group in work.groupby(["source_dataset", "team_id", "role"]):
        for component, (_, speed) in COMPONENTS.items():
            views.append((f"{source} | {names[team]} | {role} | {component}",
                          group.sort_values(["date", "game_id"]), speed))
    initial = next(i for i, (label, _, _) in enumerate(views) if label.startswith(default_source)
                   and "| attacking | Total" in label)
    fig = go.Figure()
    buttons = []
    for i, (label, group, speed) in enumerate(views):
        fig.add_trace(go.Scatter(
            x=group["game_id"].astype(str), y=group[speed], mode="lines+markers", visible=i == initial,
            marker=dict(size=9), showlegend=False,
            customdata=group[["date", "opponent", "sequences", "modeled_elapsed_seconds"]].astype(object).to_numpy(),
            hovertemplate="Game %{x}: %{y:.2f} ft/s<br>Date: %{customdata[0]}"
            "<br>Opponent: %{customdata[1]}<br>Sequences: %{customdata[2]}"
            "<br>Modeled exposure: %{customdata[3]:.1f} s<extra></extra>",
        ))
        buttons.append(dict(label=label, method="update", args=[
            {"visible": [j == i for j in range(len(views))]},
            {"title.text": f"Game variation - {label} | 5v5"}]))
    fig.update_xaxes(type="category", title="Game ID (ordered by date)")
    fig.update_yaxes(title="Pace (ft/s)", range=[0, float(work[[v[1] for v in COMPONENTS.values()]].max().max()) * 1.12])
    fig.update_layout(updatemenus=[dropdown(buttons, active=initial)])
    return theme(fig, f"Game variation - {views[initial][0]} | 5v5")


def grid_image(table, column):
    image = np.full((17, 40), np.nan)
    image[table["grid_row"].to_numpy(int), table["grid_column"].to_numpy(int)] = table[column].to_numpy(float)
    return image


def rink(fig, row=None, col=None):
    """Vector rink markings in the stored increasing-x attacking orientation."""
    kwargs = {} if row is None else dict(row=row, col=col)
    fig.add_shape(type="rect", x0=0, y0=0, x1=200, y1=85,
                  line=dict(color="#555", width=1), **kwargs)
    for x, color in [(75, "#4179b0"), (100, "#cb6b6b"), (125, "#4179b0")]:
        fig.add_shape(type="line", x0=x, x1=x, y0=0, y1=85, line=dict(color=color), **kwargs)
    for x in [11, 189]:
        fig.add_shape(type="line", x0=x, x1=x, y0=0, y1=85, line=dict(color="#cb6b6b", width=1), **kwargs)
    fig.update_xaxes(range=[0, 200], constrain="domain", title="x (ft) - attack toward increasing x", **kwargs)
    fig.update_yaxes(range=[0, 85], constrain="domain", title="y (ft)", **kwargs)


def polygrid_maps(sources, differentials, default_source):
    if sources.empty:
        return empty_figure("Spatial pace")
    maps = [(f"{source} | Source", group, False)
            for source, group in sources.groupby("source_dataset")]
    maps += [(f"{source} | {group['team_name'].iloc[0]} | {role}", group, True)
             for (source, _, role), group in differentials.groupby(["source_dataset", "team_id", "role"])]
    initial = next(i for i, (label, _, _) in enumerate(maps) if label == f"{default_source} | Source")
    fig = go.Figure()
    map_buttons = []
    for i, (label, table, _) in enumerate(maps):
        custom = np.full((17, 40, 3), np.nan)
        for j, column in enumerate(["modeled_elapsed_seconds", "transitions", "cell_id"]):
            custom[table["grid_row"].to_numpy(int), table["grid_column"].to_numpy(int), j] = table[column].to_numpy(float)
        fig.add_trace(go.Heatmap(
            x=np.arange(2.5, 200, 5), y=np.arange(2.5, 85, 5), z=grid_image(table, "speed_total_ft_s"),
            coloraxis="coloraxis", customdata=custom, visible=i == initial, hoverongaps=False,
            hovertemplate="Cell %{customdata[2]:.0f} | x=%{x}, y=%{y}<br>Pace: %{z:.2f} ft/s"
            "<br>Modeled exposure: %{customdata[0]:.2f} s<br>Transitions: %{customdata[1]:.0f}<extra></extra>",
        ))
        map_buttons.append(dict(label=label, method="update", args=[
            {"visible": [j == i for j in range(len(maps))]},
            {"title.text": f"Spatial pace - {label} | 5v5"}]))
    metric_buttons = []
    for component, (_, speed) in COMPONENTS.items():
        for mode in ["Absolute raw", "Absolute smoothed", "Difference raw", "Difference smoothed"]:
            smooth = mode.endswith("smoothed")
            difference = mode.startswith("Difference")
            images = []
            for _, table, is_team in maps:
                if difference:
                    column = f"{speed}_difference" + ("_smoothed" if smooth else "")
                    # Source-minus-itself is zero only where exposure supplies a speed.
                    image = grid_image(table, column) if is_team else np.where(
                        np.isfinite(grid_image(table, speed)), 0., np.nan)
                else:
                    image = grid_image(table, speed + ("_smoothed" if smooth else ""))
                images.append(image)
            finite = np.concatenate([im[np.isfinite(im)] for im in images])
            bound = max(float(np.abs(finite).max()) if finite.size else 1., 1.)
            metric_buttons.append(dict(label=f"{component} | {mode}", method="update", args=[
                {"z": images, "hovertemplate": (
                    "Cell %{customdata[2]:.0f} | x=%{x}, y=%{y}<br>"
                    + ("Difference" if difference else "Pace") + ": %{z:.2f} ft/s"
                    "<br>Modeled exposure: %{customdata[0]:.2f} s"
                    "<br>Transitions: %{customdata[1]:.0f}<extra></extra>"
                )}, {"coloraxis.colorscale": "RdBu_r" if difference else "Viridis",
                               "coloraxis.cmin": -bound if difference else 0,
                               "coloraxis.cmax": bound,
                               "coloraxis.colorbar.title.text": "Difference (ft/s)" if difference else "Pace (ft/s)"}]))
    limit = max(float(group["speed_total_ft_s"].max()) for _, group, _ in maps)
    fig.update_layout(coloraxis=dict(colorscale="Viridis", cmin=0, cmax=limit,
                                     colorbar=dict(title="Pace (ft/s)")),
                      updatemenus=[dropdown(map_buttons), dropdown(metric_buttons, y=1.11)])
    rink(fig)
    fig.update_yaxes(scaleanchor="x", scaleratio=1)
    return theme(fig, f"Spatial pace - {maps[initial][0]} | 5v5", 570)


def player_rankings(table, default_source, min_transitions=10):
    work = table.loc[table["transitions"].ge(min_transitions)]
    if work.empty:
        return empty_figure("No players meet the involvement filter")
    views = []
    for (source, zone), group in work.groupby(["source_dataset", "zone"]):
        for team, subset in [("All teams", group), *list(group.groupby("team_name"))]:
            for component, (_, speed) in COMPONENTS.items():
                ranked = subset.dropna(subset=[speed]).nlargest(20, speed).sort_values(speed)
                views.append((f"{source} | {team} | {zone} | {component}", ranked, speed))
    initial = next(i for i, (label, _, _) in enumerate(views)
                   if label == f"{default_source} | All teams | OZ | Total")
    fig = go.Figure()
    buttons = []
    for i, (label, group, speed) in enumerate(views):
        labels = group["player_name"] + " (" + group["team_name"] + ")"
        fig.add_trace(go.Scatter(
            x=group[speed], y=labels, mode="markers", marker=dict(size=10), visible=i == initial,
            showlegend=False,
            customdata=group[["games", "transitions", "sequences", "modeled_elapsed_seconds"]].to_numpy(),
            hovertemplate="%{y}: %{x:.2f} ft/s<br>Games: %{customdata[0]}"
            "<br>Transitions: %{customdata[1]}<br>Sequences: %{customdata[2]}"
            "<br>Allocated involvement: %{customdata[3]:.1f} s (not ice time)<extra></extra>",
        ))
        buttons.append(dict(label=label, method="update", args=[
            {"visible": [j == i for j in range(len(views))]},
            {"title.text": f"Individual pace - {label} | top 20 | 5v5",
             "yaxis.categoryarray": labels.tolist()}]))
    limit = float(work[[v[1] for v in COMPONENTS.values()]].max().max()) * 1.12
    fig.update_xaxes(title="Pace (ft/s)", range=[0, limit])
    fig.update_yaxes(categoryorder="array", categoryarray=list(fig.data[initial].y))
    fig.update_layout(updatemenus=[dropdown(buttons, active=initial)])
    return theme(fig, f"Individual pace - {views[initial][0]} | top 20 | 5v5", 800)


def player_profiles(table, source, team_id=None):
    work = table.loc[table["source_dataset"].eq(source)]
    if team_id is not None:
        work = work.loc[work["team_id"].eq(team_id)]
    if work.empty:
        return empty_figure("Player profiles")
    players = list(work.groupby("player_id", sort=True))
    fig = make_subplots(rows=1, cols=2, shared_yaxes=True, subplot_titles=["Player A", "Player B"])
    menus = []
    limit = float(work[[v[1] for v in COMPONENTS.values()]].max().max()) * 1.12
    for side in range(2):
        buttons = []
        chosen = min(side, len(players) - 1)
        for player_index, (_, group) in enumerate(players):
            group = group.set_index("zone").reindex(ZONES)
            for component_index, (component, (_, speed)) in enumerate(COMPONENTS.items()):
                name = component + (" - A" if side == 0 else " - B")
                custom = group[["games", "transitions", "modeled_elapsed_seconds"]].to_numpy()
                fig.add_trace(go.Scatter(
                    x=ZONES, y=group[speed], mode="lines+markers", name=name,
                    visible=player_index == chosen, legendgroup=component, showlegend=side == 0,
                    line=dict(color=["#597aa6", "#cf875e", "#59966f", "#9366a1"][component_index]),
                    customdata=custom,
                    hovertemplate=component + ": %{y:.2f} ft/s<br>Zone: %{x}<br>Games: %{customdata[0]}"
                    "<br>Transitions: %{customdata[1]}<br>Allocated involvement: %{customdata[2]:.1f} s<extra></extra>",
                ), row=1, col=side+1)
        # Restyle only this panel, so A and B selectors remain independent.
        trace_ids = list(range(side * len(players) * 4, (side + 1) * len(players) * 4))
        for player_index, (_, group) in enumerate(players):
            label = f"{group['player_name'].iloc[0]} ({group['team_name'].iloc[0]})"
            buttons.append(dict(label=label, method="restyle", args=[
                {"visible": [i // 4 == player_index for i in range(len(players) * 4)]}, trace_ids]))
        menus.append(dropdown(buttons, x=side * 0.55, active=chosen))
    fig.update_yaxes(range=[0, limit], title="Pace (ft/s)")
    fig.update_layout(updatemenus=menus)
    return theme(fig, f"Individual player profiles - {source} | 5v5", 520)


def replay_figure(reference_tables, pace_tables, game_id, period=1,
                  component="Total", step="sequence", team_id=None,
                  role="attacking", coverage="5v5"):
    """Native Plotly replay for notebook editors that cannot run custom iframes.

    Game/period/metric are notebook parameters. Play/pause and the event/sequence
    slider are native Plotly controls; frames include no future contributions.
    """
    if component not in COMPONENTS or step not in {"event", "sequence"}:
        raise ValueError("Choose a listed component and event or sequence stepping.")
    if role not in {"attacking", "defending"} or coverage not in {"5v5", "all"}:
        raise ValueError("Choose attacking/defending and 5v5/all coverage.")
    game = reference_tables["games"].set_index("game_id").loc[game_id]
    if team_id is not None and team_id not in {game.home_team_id, game.away_team_id}:
        raise ValueError("The heat-map team must be one of the selected game's teams.")
    events = reference_tables["events_augmented"]
    timeline = events.loc[events["game_id"].eq(game_id)].sort_values("event_id")
    if period is not None:
        timeline = timeline.loc[timeline["period"].eq(period)]
    if timeline.empty:
        return empty_figure("No replay events for this game/period")
    if step == "sequence":
        timeline = timeline.groupby("possession_id", sort=False).tail(1)
    event_lookup = events.set_index("event_id")
    player_names = reference_tables["players"].set_index("player_id")["player_name"]
    team_names = reference_tables["teams"].set_index("team_id")["team_name"]
    sequences = pace_tables["pace_sequences"]
    eligible = set(sequences.loc[
        sequences["is_5v5"] & sequences["pace_status"].eq("eligible"), "possession_id"
    ])
    grid = pace_tables["pace_polygrid_cells"]
    contributions = pace_tables["pace_polygrid_contributions"]
    contributions = contributions.loc[contributions["game_id"].eq(game_id)]
    if coverage == "5v5":
        contributions = contributions.loc[contributions["possession_id"].isin(eligible)]
    if team_id is not None:
        owner = team_id if role == "attacking" else (
            game.away_team_id if team_id == game.home_team_id else game.home_team_id
        )
        contributions = contributions.loc[contributions["possession_team_id"].eq(owner)]
    distance, speed = COMPONENTS[component]
    # Includes previous periods: the slider selects a view of the game timeline.
    by_end = {
        end: group for end, group in contributions.groupby("end_event_id", sort=True)
    }
    end_ids = sorted(by_end)
    intervals = pace_tables["pace_transitions"]
    intervals = intervals.loc[
        intervals["game_id"].eq(game_id) & intervals["exclusion_reason"].isna()
    ]
    paths = {pos: group.sort_values("end_event_id") for pos, group in intervals.groupby("possession_id")}
    totals = np.zeros((len(grid), 2))
    rows = grid["grid_row"].to_numpy(int)
    cols = grid["grid_column"].to_numpy(int)
    cursor = 0
    frames = []
    color_max = 1.
    for event in timeline.itertuples(index=False):
        while cursor < len(end_ids) and end_ids[cursor] <= event.event_id:
            assigned = by_end[end_ids[cursor]]
            totals[assigned["cell_id"].to_numpy(int)] += assigned[
                ["modeled_elapsed_seconds", distance]
            ].to_numpy(float)
            cursor += 1
        values = np.divide(totals[:, 1], totals[:, 0], out=np.full(len(grid), np.nan),
                           where=totals[:, 0] > 0)
        if np.isfinite(values).any():
            color_max = max(color_max, float(np.nanmax(values)))
        z = np.full((17, 40), np.nan)
        z[rows, cols] = values
        custom = np.full((17, 40, 2), np.nan)
        custom[rows, cols, 0] = totals[:, 0]
        custom[rows, cols, 1] = grid["cell_id"].to_numpy()
        x, y, hover = [], [], []
        show_path = coverage == "all" or event.possession_id in eligible
        if show_path and event.possession_id in paths:
            for interval in paths[event.possession_id].itertuples(index=False):
                if interval.start_event_id > event.event_id:
                    continue
                start = event_lookup.loc[interval.start_event_id]
                end = event_lookup.loc[interval.end_event_id]
                if interval.end_event_id <= event.event_id:
                    details = (
                        f"{start['event']} ({player_names.get(start.player_id, 'Unknown')}) to "
                        f"{end['event']} ({player_names.get(end.player_id, 'Unknown')})<br>"
                        f"Distance: {interval.distance_ft:.2f} ft<br>"
                        f"Recorded duration: {interval.elapsed_seconds:.2f} s<br>"
                        f"Modeled duration: {interval.modeled_elapsed_seconds:.2f} s (estimated)<br>"
                        f"{component} pace: {getattr(interval, speed):.2f} ft/s"
                    )
                    x += [interval.start_x, interval.end_x, None]
                    y += [interval.start_y, interval.end_y, None]
                    hover += [details, details, ""]
                else:
                    x += [interval.start_x, None]
                    y += [interval.start_y, None]
                    hover += [f"{start['event']} - movement not completed", ""]
        own_event = show_path and event.team_id == event.possession_team_id and pd.notna(event.x) and pd.notna(event.y)
        title = (
            f"{component} replay | game {game_id}, period {event.period}, possession {event.possession_id}"
            f"<br><sup>{team_names[event.possession_team_id]} | event {event.event_id}: {event.event} | "
            f"recorded {event.clock_seconds:.2f} s, modeled {event.modeled_clock_seconds:.2f} s remaining</sup>"
        )
        data = [
            go.Scatter(x=x, y=y, text=hover, mode="lines+markers", name="Current possession",
                       line=dict(color="#597aa6", width=3), marker=dict(size=6),
                       hovertemplate="%{text}<extra></extra>"),
            go.Scatter(x=[event.x] if own_event else [], y=[event.y] if own_event else [],
                       mode="markers", name="Current event", marker=dict(size=12, color="#cf875e"),
                       text=[event.event], hovertemplate="%{text}<extra></extra>"),
            go.Heatmap(x=np.arange(2.5, 200, 5), y=np.arange(2.5, 85, 5), z=z, customdata=custom,
                       coloraxis="coloraxis", hoverongaps=False,
                       hovertemplate="Cell %{customdata[1]:.0f}<br>Pace: %{z:.2f} ft/s"
                       "<br>Modeled exposure: %{customdata[0]:.2f} s<extra></extra>"),
        ]
        frames.append(go.Frame(name=str(event.event_id), data=data, traces=[0, 1, 2],
                               layout=dict(title=dict(text=title))))
    fig = make_subplots(rows=1, cols=2, subplot_titles=["Current possession", "Accumulated game pace"])
    for i, trace in enumerate(frames[0].data):
        fig.add_trace(trace, row=1, col=1 if i < 2 else 2)
    fig.frames = frames
    rink(fig, row=1, col=1)
    rink(fig, row=1, col=2)
    fig.update_yaxes(scaleanchor="x", scaleratio=1, row=1, col=1)
    fig.update_yaxes(scaleanchor="x2", scaleratio=1, row=1, col=2)
    fig.update_layout(
        coloraxis=dict(colorscale="Viridis", cmin=0, cmax=color_max, colorbar=dict(title="Pace (ft/s)")),
        updatemenus=[dict(type="buttons", direction="left", x=0, y=-0.13, buttons=[
            dict(label="Play", method="animate", args=[None, dict(
                fromcurrent=True, frame=dict(duration=250, redraw=True), transition=dict(duration=0))]),
            dict(label="Pause", method="animate", args=[[None], dict(
                mode="immediate", frame=dict(duration=0, redraw=False), transition=dict(duration=0))]),
        ])],
        sliders=[dict(x=0, y=-0.02, len=1, currentvalue=dict(prefix="Event ID: "), steps=[
            dict(label=frame.name, method="animate", args=[[frame.name], dict(
                mode="immediate", frame=dict(duration=0, redraw=True), transition=dict(duration=0))])
            for frame in frames
        ])],
        legend=dict(orientation="h", y=1.1),
    )
    theme(fig, frames[0].layout.title.text, 660)
    fig.update_layout(margin=dict(t=115, b=140, l=65, r=70))
    return fig


def write_replay(path, reference_tables, pace_tables, default_game, default_period):
    """Standalone Plotly replay with browser controls; no notebook widget dependency."""
    events = reference_tables["events_augmented"].sort_values("event_id")
    sequences = pace_tables["pace_sequences"]
    contributions = pace_tables["pace_polygrid_contributions"]
    transitions = pace_tables["pace_transitions"]
    frames = {
        "events": events[["event_id", "game_id", "period", "possession_id", "team_id", "player_id",
                          "event", "x", "y", "clock_seconds", "modeled_clock_seconds",
                          "possession_team_id", "opponent_team_id"]],
        "contributions": contributions[["game_id", "possession_id", "possession_team_id", "end_event_id",
                                        "cell_id", "modeled_elapsed_seconds", "distance_ft", "distance_ew_ft",
                                        "distance_ns_ft", "distance_n_ft"]],
        "transitions": transitions.loc[transitions["exclusion_reason"].isna(), [
            "game_id", "possession_id", "start_event_id", "end_event_id", "start_x", "start_y",
            "end_x", "end_y", "elapsed_seconds", "modeled_elapsed_seconds", "distance_ft",
            *[v[1] for v in COMPONENTS.values()],
        ]],
        "games": reference_tables["games"],
        "teams": reference_tables["teams"],
        "players": reference_tables["players"],
        "cells": pace_tables["pace_polygrid_cells"],
    }
    # Array encoding avoids repeating column names on 475k contribution records.
    encoded = {name: json.loads(table.to_json(orient="split", date_format="iso")) for name, table in frames.items()}
    for table in encoded.values():
        table.pop("index")
    encoded["eligible_sequences"] = sequences.loc[
        sequences["is_5v5"] & sequences["pace_status"].eq("eligible"), "possession_id"
    ].astype(int).tolist()
    encoded["default_game"] = int(default_game)
    encoded["default_period"] = int(default_period)
    template = Path(__file__).with_name("pace_replay.html.template").read_text(encoding="utf-8")
    # Escape '<' so player/source text cannot terminate the embedded script.
    data_json = json.dumps(encoded, separators=(",", ":"), ensure_ascii=True).replace("<", "\\u003c")
    html = template.replace("__PLOTLY_JS__", get_plotlyjs()).replace("__REPLAY_DATA__", data_json)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(html, encoding="utf-8")
    return path


def calculate_pace_momentum(reference_tables, pace_tables, game_id,
                            windows=(30, 60, 120), sample_seconds=5,
                            min_exposure_seconds=5, coverage="5v5"):
    """Trailing completed-transition pace differences, resetting each period.

    Positive = home faster; negative = away faster. Missing evidence for either
    team remains missing. Windows use only transitions ending at/before a sample.
    """
    if sample_seconds <= 0 or min_exposure_seconds <= 0 or any(w <= 0 for w in windows):
        raise ValueError("Sampling, window lengths, and minimum exposure must be positive.")
    if coverage not in {"5v5", "all"}:
        raise ValueError("Coverage must be 5v5 or all.")
    game = reference_tables["games"].set_index("game_id").loc[game_id]
    events = reference_tables["events_augmented"]
    events = events.loc[events["game_id"].eq(game_id)]
    if events.empty:
        return pd.DataFrame()
    periods = events.groupby("period")["clock_seconds"].max().sort_index()
    offsets = periods.cumsum().shift(fill_value=0)
    sequences = pace_tables["pace_sequences"]
    eligible_mask = sequences["game_id"].eq(game_id) & sequences["pace_status"].eq("eligible")
    if coverage == "5v5":
        eligible_mask &= sequences["is_5v5"]
    eligible = sequences.loc[eligible_mask, "possession_id"]
    work = pace_tables["pace_transitions"]
    work = work.loc[
        work["game_id"].eq(game_id) & work["possession_id"].isin(eligible)
        & work["exclusion_reason"].isna()
    ].copy()
    work["distance_ew_ft"] = work["dy_ft"].abs()
    work["distance_ns_ft"] = work["dx_ft"].abs()
    work["distance_n_ft"] = work["dx_ft"].clip(lower=0)
    fields = ["modeled_elapsed_seconds", *[v[0] for v in COMPONENTS.values()]]
    outputs = []
    for period, duration in periods.items():
        period_events = events.loc[events["period"].eq(period)]
        horizon = float(duration - period_events["modeled_clock_seconds"].min())
        samples = np.unique(np.append(np.arange(0, horizon, sample_seconds), horizon))
        intervals = work.loc[work["period"].eq(period)].copy()
        intervals["end_elapsed"] = duration - intervals["end_modeled_clock_seconds"]
        for window in windows:
            samples_df = pd.DataFrame({
                "source_dataset": game.source_dataset, "game_id": game_id,
                "coverage": coverage,
                "period": period, "window_seconds": window,
                "period_elapsed_seconds": samples,
                "clock_seconds_remaining": duration - samples,
                "game_elapsed_seconds": float(offsets[period]) + samples,
                "home_team_id": game.home_team_id, "away_team_id": game.away_team_id,
            })
            for role, team in [("home", game.home_team_id), ("away", game.away_team_id)]:
                selected = intervals.loc[intervals["possession_team_id"].eq(team)].sort_values(
                    ["end_elapsed", "end_event_id"], kind="stable"
                )
                end_times = selected["end_elapsed"].to_numpy(float)
                # Window is (sample-window, sample], within this period only.
                right = np.searchsorted(end_times, samples, side="right")
                left = np.searchsorted(end_times, samples - window, side="right")
                sums = np.vstack([np.zeros(len(fields)), selected[fields].to_numpy(float).cumsum(axis=0)])
                totals = sums[right] - sums[left]
                samples_df[f"{role}_transitions"] = right - left
                for i, field in enumerate(fields):
                    samples_df[f"{role}_{field}"] = totals[:, i]
                denominator = samples_df[f"{role}_modeled_elapsed_seconds"].where(
                    samples_df[f"{role}_modeled_elapsed_seconds"].ge(min_exposure_seconds)
                )
                for distance, speed in COMPONENTS.values():
                    samples_df[f"{role}_{speed}"] = samples_df[f"{role}_{distance}"] / denominator
            samples_df["has_comparison"] = (
                samples_df["home_modeled_elapsed_seconds"].ge(min_exposure_seconds)
                & samples_df["away_modeled_elapsed_seconds"].ge(min_exposure_seconds)
            )
            for _, speed in COMPONENTS.values():
                samples_df[f"momentum_{speed}"] = samples_df[f"home_{speed}"] - samples_df[f"away_{speed}"]
            outputs.append(samples_df)
    return pd.concat(outputs, ignore_index=True)


def momentum_goals(reference_tables, game_id):
    """All recorded goals, including penalty-shot goals, on the same timeline."""
    events = reference_tables["events_augmented"]
    game_events = events.loc[events["game_id"].eq(game_id)]
    periods = game_events.groupby("period")["clock_seconds"].max().sort_index()
    offsets = periods.cumsum().shift(fill_value=0)
    goals = game_events.loc[game_events["event"].isin(["Goal", "Penalty Shot Goal"])].copy()
    goals["game_elapsed_seconds"] = (
        goals["period"].map(offsets) + goals["period"].map(periods) - goals["modeled_clock_seconds"]
    )
    names = reference_tables["players"].set_index("player_id")["player_name"]
    goals["player_name"] = goals["player_id"].map(names).fillna("Unknown player")
    goals["clock_label"] = goals["clock_seconds"].map(
        lambda clock: f"{int(clock // 60)}:{int(clock % 60):02d}"
    )
    return goals


def pace_momentum_figure(table, teams, component="Total", window=60, goals=None, y_limit=None):
    if table.empty:
        return empty_figure("No game events for pace momentum")
    names = teams.set_index("team_id")["team_name"]
    home = names[table["home_team_id"].iloc[0]]
    away = names[table["away_team_id"].iloc[0]]
    coverage_label = "5v5" if table["coverage"].iloc[0] == "5v5" else "All game situations"
    fig = go.Figure()
    views = []
    maxima = []
    for seconds, subset in table.groupby("window_seconds"):
        ordered = subset.sort_values(["period", "period_elapsed_seconds"])
        for name, (_, speed) in COMPONENTS.items():
            views.append((seconds, name, ordered, speed))
    initial = next((i for i, (seconds, name, _, _) in enumerate(views)
                    if seconds == window and name == component), 0)
    buttons = []
    for index, (seconds, name, ordered, speed) in enumerate(views):
        x = ordered["game_elapsed_seconds"] / 60
        advantage = ordered[f"momentum_{speed}"]
        maxima.extend(advantage.dropna().abs().tolist())
        fig.add_trace(go.Scatter(
            x=x, y=advantage.clip(lower=0), mode="lines", line=dict(width=0),
            fill="tozeroy", fillcolor="rgba(89,122,166,0.35)",
            name=f"{home} faster", visible=index == initial, hoverinfo="skip", connectgaps=False,
        ))
        fig.add_trace(go.Scatter(
            x=x, y=advantage.clip(upper=0), mode="lines", line=dict(width=0),
            fill="tozeroy", fillcolor="rgba(207,135,94,0.4)",
            name=f"{away} faster", visible=index == initial, hoverinfo="skip", connectgaps=False,
        ))
        custom = ordered[[
            "period", "clock_seconds_remaining", f"home_{speed}", f"away_{speed}",
            "home_transitions", "away_transitions", "home_modeled_elapsed_seconds", "away_modeled_elapsed_seconds",
        ]].to_numpy()
        fig.add_trace(go.Scatter(
            x=x, y=advantage, mode="lines", line=dict(color="#34495e", width=1.5),
            visible=index == initial, showlegend=False, customdata=custom, connectgaps=False,
            hovertemplate="P%{customdata[0]:.0f} | %{customdata[1]:.1f} s remaining"
            "<br>Home-minus-away: %{y:.2f} ft/s<br>Home pace: %{customdata[2]:.2f} ft/s"
            "<br>Away pace: %{customdata[3]:.2f} ft/s<br>Home / away transitions: %{customdata[4]:.0f} / %{customdata[5]:.0f}"
            "<br>Home / away modeled exposure: %{customdata[6]:.1f} / %{customdata[7]:.1f} s<extra></extra>",
        ))
        buttons.append(dict(label=f"{name} | trailing {seconds} s", method="update", args=[
            {"visible": [i // 3 == index for i in range(len(views) * 3)]},
            {"title.text": f"Pace momentum - {home} vs {away} | {name} | trailing {seconds} s | {coverage_label}"},
        ]))
    limit = y_limit if y_limit is not None else (max(maxima, default=1) * 1.1 or 1)
    goal_trace_count = 0
    if goals is not None:
        for team_id, label, color, symbol in [
            (table["home_team_id"].iloc[0], home, "#597aa6", "circle"),
            (table["away_team_id"].iloc[0], away, "#cf875e", "diamond"),
        ]:
            scored = goals.loc[goals["team_id"].eq(team_id)]
            if scored.empty:
                continue
            fig.add_trace(go.Scatter(
                x=scored["game_elapsed_seconds"] / 60, y=np.zeros(len(scored)), mode="markers",
                marker=dict(size=12, color=color, symbol=symbol, line=dict(color="white", width=1)),
                name=f"{label} goals", visible=True,
                customdata=scored[["event", "player_name", "period", "clock_label", "event_id"]].to_numpy(),
                hovertemplate=label + "<br>%{customdata[0]}: %{customdata[1]}"
                "<br>P%{customdata[2]} | recorded clock %{customdata[3]}"
                "<br>Event %{customdata[4]}<extra></extra>",
            ))
            goal_trace_count += 1
            for elapsed in scored["game_elapsed_seconds"]:
                fig.add_vline(x=float(elapsed) / 60, line_dash="dot", line_color=color,
                              opacity=0.5, line_width=1)
    # Goal markers remain visible when switching the component or window.
    for button in buttons:
        button["args"][0]["visible"] += [True] * goal_trace_count
    fig.add_hline(y=0, line_color="#64717d", line_width=1)
    for period, group in table.groupby("period", sort=True):
        start = float((group["game_elapsed_seconds"] - group["period_elapsed_seconds"]).iloc[0]) / 60
        if start > 0:
            fig.add_vline(x=start, line_dash="dot", line_color="#b3bdc5")
        fig.add_annotation(x=start, y=1.05, yref="paper", text=f"P{period}", showarrow=False, xanchor="left")
    fig.update_xaxes(title="Game-clock elapsed time (minutes)")
    fig.update_yaxes(title="Home pace - away pace (ft/s)", range=[-limit, limit])
    fig.update_layout(updatemenus=[dropdown(buttons, active=initial)],
                      legend=dict(orientation="h", y=-0.18))
    return theme(fig, f"Pace momentum - {home} vs {away} | {component} | trailing {window} s | {coverage_label}", 550)


def momentum_associations(reference_tables, pace_tables, window=60, future_seconds=60,
                          min_exposure_seconds=5):
    """Exploratory all-situations associations; no independence-based p-values.

    Goal targets are disjoint future windows. Game outcomes come from recorded
    goals, cross-checked against the final score context, including a terminal
    goal whose score context has not yet incremented. Tied/uncertain outcomes
    are excluded from the binary win comparison.
    """
    events = reference_tables["events_augmented"]
    all_goals = events.loc[events["event"].isin(["Goal", "Penalty Shot Goal"])]
    games = reference_tables["games"]
    score_context = events.sort_values("event_id").groupby("game_id").tail(1).set_index("game_id")
    game_rows, goal_windows = [], []
    for game in games.itertuples(index=False):
        momentum = calculate_pace_momentum(
            reference_tables, pace_tables, game.game_id, windows=(window,),
            sample_seconds=5, min_exposure_seconds=min_exposure_seconds, coverage="all",
        )
        momentum_column = "momentum_speed_total_ft_s"
        valid = momentum.loc[momentum["has_comparison"]]
        goals = momentum_goals(reference_tables, game.game_id)
        # Complete, non-overlapping future windows within each period.
        horizons = momentum.groupby("period")["period_elapsed_seconds"].max()
        samples = momentum.loc[
            np.isclose(np.mod(momentum["period_elapsed_seconds"], future_seconds), 0)
            & (momentum["period_elapsed_seconds"] + future_seconds).le(momentum["period"].map(horizons))
        ].copy()
        samples["future_home_goals"] = 0
        samples["future_away_goals"] = 0
        for index, sample in samples.iterrows():
            future = goals.loc[
                goals["period"].eq(sample["period"])
                & goals["game_elapsed_seconds"].gt(sample["game_elapsed_seconds"])
                & goals["game_elapsed_seconds"].le(sample["game_elapsed_seconds"] + future_seconds)
            ]
            samples.loc[index, "future_home_goals"] = future["team_id"].eq(game.home_team_id).sum()
            samples.loc[index, "future_away_goals"] = future["team_id"].eq(game.away_team_id).sum()
        samples["future_goal_difference"] = samples["future_home_goals"] - samples["future_away_goals"]
        samples["future_seconds"] = future_seconds
        goal_windows.append(samples)

        game_goals = all_goals.loc[all_goals["game_id"].eq(game.game_id)]
        home_goals = int(game_goals["team_id"].eq(game.home_team_id).sum())
        away_goals = int(game_goals["team_id"].eq(game.away_team_id).sum())
        final_event = score_context.loc[game.game_id]
        context_home = final_event.team_goals if final_event.is_home else final_event.opponent_goals
        context_away = final_event.opponent_goals if final_event.is_home else final_event.team_goals
        missing_home = int(final_event["event"] in {"Goal", "Penalty Shot Goal"} and final_event.team_id == game.home_team_id)
        missing_away = int(final_event["event"] in {"Goal", "Penalty Shot Goal"} and final_event.team_id == game.away_team_id)
        exact_score = (home_goals, away_goals) == (context_home, context_away)
        terminal_goal_score = (home_goals, away_goals) == (context_home + missing_home, context_away + missing_away)
        score_consistent = exact_score or terminal_goal_score
        outcome_known = score_consistent and home_goals != away_goals
        game_rows.append(dict(
            source_dataset=game.source_dataset, game_id=game.game_id,
            home_team_id=game.home_team_id, away_team_id=game.away_team_id,
            mean_momentum_ft_s=valid[momentum_column].mean(),
            comparable_samples=len(valid), timeline_samples=len(momentum),
            comparison_coverage=len(valid) / len(momentum),
            home_goals=home_goals, away_goals=away_goals, goal_difference=home_goals-away_goals,
            outcome_known=outcome_known, score_consistent=score_consistent,
            terminal_goal_adjustment=bool(not exact_score and terminal_goal_score),
            home_win=float(home_goals > away_goals) if outcome_known else np.nan,
        ))
    game_table = pd.DataFrame(game_rows)
    goal_table = pd.concat(goal_windows, ignore_index=True)
    rows = []
    for scope in ["All sources", *sorted(games["source_dataset"].unique())]:
        for analysis, table, predictor, target in [
            ("Goals in the next minute", goal_table, "momentum_speed_total_ft_s", "future_goal_difference"),
            ("Home victory", game_table, "mean_momentum_ft_s", "home_win"),
        ]:
            selected = table if scope == "All sources" else table.loc[table["source_dataset"].eq(scope)]
            paired = selected.dropna(subset=[predictor, target])
            enough_variation = len(paired) >= 3 and paired[predictor].nunique() > 1 and paired[target].nunique() > 1
            rows.append(dict(
                scope=scope, analysis=analysis, observations=len(paired), games=paired["game_id"].nunique(),
                pearson_r=paired[predictor].corr(paired[target]) if enough_variation else np.nan,
            ))
    return game_table, goal_table, pd.DataFrame(rows)
