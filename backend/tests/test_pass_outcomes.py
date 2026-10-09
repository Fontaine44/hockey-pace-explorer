import pandas as pd
import pytest
from backend.app.api.routes.outcomes import PassOutcomeResponse, get_pass_outcomes
from backend.app.core.config import PROJECT_ROOT
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    source = pd.read_parquet(PROJECT_ROOT / "data/processed/pass_outcomes.parquet")
    source.iloc[::-1].to_sql("pass_outcomes", engine, index=False)
    with Session(engine) as db:
        yield db
    engine.dispose()


def test_pass_outcomes_match_exports_and_order(session):
    source = pd.read_parquet(PROJECT_ROOT / "data/processed/pass_outcomes.parquet")
    rows = get_pass_outcomes(session)
    assert len(rows) == 8
    assert [(row["pass_type"], row["quartile"]) for row in rows] == sorted(
        (row["pass_type"], row["quartile"]) for row in rows
    )
    assert [PassOutcomeResponse.model_validate(row).model_dump() for row in rows] == (
        source.to_dict(orient="records")
    )


def test_pass_outcomes_null_zero_and_empty_results(session):
    session.connection().exec_driver_sql(
        "UPDATE pass_outcomes SET completion_pct = NULL, median_pace_ft_s = 0 "
        "WHERE pass_type = 'Direct' AND quartile = 1"
    )
    first = PassOutcomeResponse.model_validate(get_pass_outcomes(session)[0])
    assert first.completion_pct is None
    assert first.median_pace_ft_s == 0
    session.connection().exec_driver_sql("DELETE FROM pass_outcomes")
    assert get_pass_outcomes(session) == []
