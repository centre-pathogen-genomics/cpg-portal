from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlmodel import Session

from app.api.routes.files import get_current_file_types, read_files
from app.models import File, User
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


def _utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _create_saved_file(
    *,
    db: Session,
    owner: User,
    name: str,
    size: int,
    created_at: datetime,
    file_type: str = "text",
    saved: bool = True,
    parent_id=None,
) -> File:
    file = File(
        name=name,
        file_type=file_type,
        size=size,
        saved=saved,
        owner_id=owner.id,
        created_at=created_at,
        parent_id=parent_id,
    )
    db.add(file)
    db.commit()
    db.refresh(file)
    return file


def test_read_files_filters_by_name_and_sorts(
    db: Session,
) -> None:
    owner = create_random_user(db)
    prefix = random_lower_string()

    older = _create_saved_file(
        db=db,
        owner=owner,
        name=f"{prefix}-beta.txt",
        size=20,
        created_at=_utc_now() - timedelta(days=1),
    )
    newer = _create_saved_file(
        db=db,
        owner=owner,
        name=f"{prefix}-alpha.txt",
        size=10,
        created_at=_utc_now(),
    )
    _create_saved_file(
        db=db,
        owner=owner,
        name=f"{prefix}-unmatched.log",
        size=30,
        created_at=_utc_now(),
    )

    result = read_files(
        session=db,
        current_user=owner,
        name=prefix.upper(),
        order_by="name",
        types=[],
    )

    assert result.count == 3
    assert [item.id for item in result.data[:2]] == [newer.id, older.id]


def test_read_files_rejects_unknown_sort_column(db: Session) -> None:
    owner = create_random_user(db)

    with pytest.raises(HTTPException) as exc_info:
        read_files(
            session=db,
            current_user=owner,
            order_by="owner_id",
            name=None,
            types=[],
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid column name: owner_id"


def test_get_current_file_types_includes_only_current_saved_top_level_types(
    db: Session,
) -> None:
    owner = create_random_user(db)
    other_user = create_random_user(db)
    parent = _create_saved_file(
        db=db,
        owner=owner,
        name=f"parent-{random_lower_string()}.txt",
        size=1,
        created_at=_utc_now(),
        file_type="text",
    )
    _create_saved_file(
        db=db,
        owner=owner,
        name=f"reads-{random_lower_string()}.fastq",
        size=10,
        created_at=_utc_now(),
        file_type="fastq",
    )
    _create_saved_file(
        db=db,
        owner=owner,
        name=f"draft-{random_lower_string()}.csv",
        size=10,
        created_at=_utc_now(),
        file_type="csv",
        saved=False,
    )
    _create_saved_file(
        db=db,
        owner=owner,
        name=f"child-{random_lower_string()}.bam",
        size=10,
        created_at=_utc_now(),
        file_type="bam",
        parent_id=parent.id,
    )
    _create_saved_file(
        db=db,
        owner=other_user,
        name=f"other-{random_lower_string()}.json",
        size=10,
        created_at=_utc_now(),
        file_type="json",
    )

    current_types = get_current_file_types(session=db, current_user=owner)

    assert set(current_types) == {"fastq", "text"}
