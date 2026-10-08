import numpy as np
import pandas as pd
import pytest
from backend.app.ingest import build_game_team_pace


def test_pooled_weighting_zero_duration_missing_and_overtime():
    games = pd.DataFrame(
        {
            "game_id": [1],
            "away_team_id": [1],
            "home_team_id": [2],
            "source_dataset": ["test"],
        }
    )
    sequences = pd.DataFrame(
        {
            "game_id": [1] * 5,
            "possession_team_id": [1, 1, 1, 1, 2],
            "period": [1, 1, 1, 4, 4],
            "source_dataset": ["test"] * 5,
            "transitions": [1, 1, 1, 1, 0],
            "modeled_elapsed_seconds": [1.0, 9.0, 0.0, 2.0, np.nan],
            "distance_ft": [10.0, 270.0, 5.0, 10.0, np.nan],
            "distance_ew_ft": [5.0, 135.0, 2.5, 5.0, np.nan],
            "distance_ns_ft": [5.0, 135.0, 2.5, 5.0, np.nan],
            "distance_n_ft": [0.0, 0.0, 0.0, 0.0, np.nan],
        }
    )
    result = build_game_team_pace(sequences, games).set_index(["team_id", "period"])
    assert len(result) == 6
    assert result.loc[(1, 1), "speed_total_ft_s"] == 28.5
    assert result.loc[(1, 0), "speed_total_ft_s"] == pytest.approx(295 / 12)
    assert result.loc[(1, 0), "speed_ew_ft_s"] == pytest.approx(147.5 / 12)
    assert result.loc[(1, 0), "speed_n_ft_s"] == 0
    assert result.loc[(2, 4), "modeled_elapsed_seconds"] == 0
    assert np.isnan(result.loc[(2, 0), "speed_total_ft_s"])
    for column, value in [
        ("distance_ft", np.inf),
        ("distance_n_ft", -1),
        ("possession_team_id", 99),
        ("source_dataset", "wrong"),
    ]:
        bad = sequences.copy()
        bad.loc[0, column] = value
        with pytest.raises(ValueError):
            build_game_team_pace(bad, games)
