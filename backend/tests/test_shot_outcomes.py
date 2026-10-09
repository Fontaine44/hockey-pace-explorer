import pandas as pd
import pytest
from backend.app.api.routes.outcomes import ShotOutcomeResponse, get_shot_outcomes
from backend.app.core.config import PROJECT_ROOT
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    source = pd.read_parquet(PROJECT_ROOT / "data/processed/shot_outcomes.parquet")
    source.iloc[::-1].to_sql("shot_outcomes", engine, index=False)
    with Session(engine) as db:
        yield db
    engine.dispose()


def test_shot_outcomes_match_exports_and_order(session):
    source = pd.read_parquet(PROJECT_ROOT / "data/processed/shot_outcomes.parquet")
    rows = get_shot_outcomes(session)
    assert [row["quartile"] for row in rows] == [1, 2, 3, 4]
    assert [ShotOutcomeResponse.model_validate(row).model_dump() for row in rows] == (
        source.to_dict(orient="records")
    )


def test_shot_outcomes_null_zero_and_empty_results(session):
    session.connection().exec_driver_sql(
        "UPDATE shot_outcomes SET mean_distance_ft = NULL, on_net_pct = 0 "
        "WHERE quartile = 1"
    )
    first = ShotOutcomeResponse.model_validate(get_shot_outcomes(session)[0])
    assert first.mean_distance_ft is None
    assert first.on_net_pct == 0
    session.connection().exec_driver_sql("DELETE FROM shot_outcomes")
    assert get_shot_outcomes(session) == []
