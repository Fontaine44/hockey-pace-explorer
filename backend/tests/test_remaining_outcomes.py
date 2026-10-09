import pandas as pd
import pytest
from backend.app.api.routes.outcomes import (
    DumpInOutcomeResponse,
    EntryTypeOutcomeResponse,
    OzRecoveryOutcomeResponse,
    get_dump_in_outcomes,
    get_entry_type_outcomes,
    get_oz_recovery_outcomes,
)
from backend.app.core.config import PROJECT_ROOT
from sqlalchemy import create_engine
from sqlalchemy.orm import Session


@pytest.mark.parametrize(
    "table,endpoint,model,nullable",
    [
        (
            "oz_recovery_outcomes",
            get_oz_recovery_outcomes,
            OzRecoveryOutcomeResponse,
            "median_time_to_shot_seconds",
        ),
        (
            "entry_type_outcomes",
            get_entry_type_outcomes,
            EntryTypeOutcomeResponse,
            "controlled_entry_pct",
        ),
        (
            "dump_in_outcomes",
            get_dump_in_outcomes,
            DumpInOutcomeResponse,
            "team_recovery_pct",
        ),
    ],
)
def test_remaining_outcomes_exports_order_nulls_zeros_and_empty(
    table,
    endpoint,
    model,
    nullable,
):
    source = pd.read_parquet(PROJECT_ROOT / "data/processed" / f"{table}.parquet")
    engine = create_engine("sqlite://")
    source.iloc[::-1].to_sql(table, engine, index=False)
    with Session(engine) as session:
        rows = endpoint(session)
        assert [row["quartile"] for row in rows] == [1, 2, 3, 4]
        assert [model.model_validate(row).model_dump() for row in rows] == (
            source.to_dict(orient="records")
        )
        session.connection().exec_driver_sql(
            f"UPDATE {table} SET {nullable} = NULL, median_pace_ft_s = 0 "
            "WHERE quartile = 1"
        )
        first = model.model_validate(endpoint(session)[0]).model_dump()
        assert first[nullable] is None
        assert first["median_pace_ft_s"] == 0
        session.connection().exec_driver_sql(f"DELETE FROM {table}")
        assert endpoint(session) == []
    engine.dispose()
