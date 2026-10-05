"""Plot hockey events on a full rink using normalized event coordinates."""

from __future__ import annotations

import base64
from pathlib import Path
from typing import Sequence

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from PIL import Image


_RINK_IMAGE_PATH = Path(__file__).resolve().parents[2] / "media" / "rink.png"
_X_MAX = 200.0
_Y_MAX = 85.0
_DEFAULT_MARKER_SIZE = 6
_DEFAULT_MARKER_OPACITY = 0.8
_DEFAULT_FIGURE_SCALE = 0.5
_DEFAULT_EVENT_COLORS = px.colors.qualitative.D3[1:]


def _convert_coordinates(
    x: pd.Series,
    y: pd.Series,
    image_width: int,
    image_height: int,
) -> tuple[pd.Series, pd.Series]:
    """Scale 200x85 rink coordinates into rink-image pixel coordinates."""
    image_x = pd.to_numeric(x, errors="coerce") / _X_MAX * image_width
    # Input y grows from the lower rink edge; image pixel y grows downward.
    image_y = image_height - pd.to_numeric(y, errors="coerce") / _Y_MAX * image_height
    return image_x, image_y


def plot_full_rink(
    df: pd.DataFrame,
    *,
    events: Sequence[str] | str | None = None,
    marker_size: float = _DEFAULT_MARKER_SIZE,
    marker_opacity: float = _DEFAULT_MARKER_OPACITY,
    figure_scale: float = _DEFAULT_FIGURE_SCALE,
    event_colors: dict[str, str] | None = None,
    show_legend: bool = True,
    show_player: bool = False,
) -> go.Figure:
    """Plot rows from a DataFrame on the full rink.

    The DataFrame must contain ``x``, ``y``, and ``event`` columns. Coordinates
    are expected on a 200-by-85 scale. If ``player`` is present, setting
    ``show_player=True`` displays player names in hover labels.

    Args:
        df: Event data with normalized coordinate and event columns.
        events: Optional event name or sequence of names to plot.
        marker_size: Marker diameter in pixels.
        marker_opacity: Opacity of the markers.
        figure_scale: Multiplier applied to the rink image's width and height.
        event_colors: Optional mapping from event name to marker color.
        show_legend: Whether to show one legend entry per event type.
        show_player: Include the ``player`` column in hover labels when present.

    Returns:
        A Plotly figure with event locations overlaid on the full rink.
    """
    required_columns = {"x", "y", "event"}
    missing_columns = required_columns - set(df.columns)
    if missing_columns:
        raise ValueError(f"DataFrame is missing required columns: {', '.join(sorted(missing_columns))}")
    if marker_size <= 0:
        raise ValueError("marker_size must be positive")
    if figure_scale <= 0:
        raise ValueError("figure_scale must be positive")

    data = df.copy()
    if events is not None:
        selected_events = [events] if isinstance(events, str) else list(events)
        data = data[data["event"].isin(selected_events)]

    numeric_x = pd.to_numeric(data["x"], errors="coerce")
    numeric_y = pd.to_numeric(data["y"], errors="coerce")
    invalid = numeric_x.isna() | numeric_y.isna()
    if invalid.any():
        bad_rows = data.index[invalid].tolist()[:5]
        raise ValueError(f"x and y must contain numeric, non-missing coordinates (invalid rows: {bad_rows})")
    out_of_bounds = numeric_x.lt(0) | numeric_x.gt(_X_MAX) | numeric_y.lt(0) | numeric_y.gt(_Y_MAX)
    if out_of_bounds.any():
        bad_rows = data.index[out_of_bounds].tolist()[:5]
        raise ValueError(f"Coordinates must be within x=0..200 and y=0..85 (invalid rows: {bad_rows})")

    image_path = _RINK_IMAGE_PATH
    if not image_path.is_file():
        raise FileNotFoundError(f"Rink image not found: {image_path}")
    with Image.open(image_path) as image:
        image_width, image_height = image.size
    image_x, image_y = _convert_coordinates(numeric_x, numeric_y, image_width, image_height)

    figure = go.Figure()
    encoded_image = base64.b64encode(image_path.read_bytes()).decode("ascii")
    figure.add_layout_image(
        dict(
            source=f"data:image/png;base64,{encoded_image}",
            xref="x",
            yref="y",
            x=0,
            y=0,
            sizex=image_width,
            sizey=image_height,
            sizing="stretch",
            layer="below",
        )
    )

    event_values = data["event"].fillna("Unknown").astype(str)
    categories = list(pd.unique(event_values))
    colors = event_colors or {}
    palette = _DEFAULT_EVENT_COLORS
    for index, event_name in enumerate(categories):
        mask = event_values.eq(event_name)
        customdata = None
        hovertemplate = f"Event: {event_name}<br>x: %{{customdata[0]:.1f}}<br>y: %{{customdata[1]:.1f}}"
        if show_player and "player" in data.columns:
            customdata = list(zip(numeric_x[mask], numeric_y[mask], data.loc[mask, "player"].fillna("")))
            hovertemplate = (
                f"Event: {event_name}<br>Player: %{{customdata[2]}}"
                "<br>x: %{customdata[0]:.1f}<br>y: %{customdata[1]:.1f}<extra></extra>"
            )
        else:
            customdata = list(zip(numeric_x[mask], numeric_y[mask]))
            hovertemplate += "<extra></extra>"

        figure.add_trace(
            go.Scatter(
                x=image_x[mask],
                y=image_y[mask],
                mode="markers",
                name=event_name,
                marker=dict(color=colors.get(event_name, palette[index % len(palette)]), size=marker_size, opacity=marker_opacity),
                customdata=customdata,
                hovertemplate=hovertemplate,
                showlegend=show_legend,
            )
        )

    figure.update_xaxes(range=[0, image_width], showgrid=False, zeroline=False, visible=False)
    figure.update_yaxes(range=[image_height, 0], scaleanchor="x", scaleratio=1, showgrid=False, zeroline=False, visible=False)
    figure.update_layout(
        width=round(image_width * figure_scale),
        height=round(image_height * figure_scale),
        margin=dict(l=0, r=0, t=0, b=0),
        plot_bgcolor="white",
        showlegend=show_legend,
    )
    return figure
