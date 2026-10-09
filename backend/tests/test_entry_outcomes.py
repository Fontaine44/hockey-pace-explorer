import pandas as pd
import pytest
from backend.app.api.routes.outcomes import EntryOutcomeResponse, get_entry_outcomes
from backend.app.core.config import PROJECT_ROOT
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


@pytest.fixture
def session():
    engine = create_engine("sqlite://")
    source = pd.read_parquet(PROJECT_ROOT / "data/processed/entry_outcomes.parquet")
    source.iloc[::-1].to_sql("entry_outcomes", engine, index=False)
    with Session(engine) as db:
        yield db
    engine.dispose()


def test_entry_outcomes_preserve_exports_and_order(session):
    source = pd.read_parquet(PROJECT_ROOT / "data/processed/entry_outcomes.parquet")
    rows = get_entry_outcomes(session)
    assert len(rows) == 8
    assert [(row["entry_type"], row["quartile"]) for row in rows] == sorted(
        (row["entry_type"], row["quartile"]) for row in rows
    )
    assert [EntryOutcomeResponse.model_validate(row).model_dump() for row in rows] == (
        source.to_dict(orient="records")
    )


def test_entry_outcomes_nulls_zeros_and_empty_results(session):
    session.connection().exec_driver_sql(
        "UPDATE entry_outcomes SET shot_pct = NULL, median_pace_ft_s = 0 "
        "WHERE entry_type = 'Carried' AND quartile = 1"
    )
    first = EntryOutcomeResponse.model_validate(get_entry_outcomes(session)[0])
    assert first.shot_pct is None
    assert first.median_pace_ft_s == 0
    session.connection().exec_driver_sql("DELETE FROM entry_outcomes")
    assert get_entry_outcomes(session) == []
