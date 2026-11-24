import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlmodel import Session, select

from app import crud
from app.api.routes.files import (
    create_group,
    create_pair,
    delete_files,
    get_current_file_types,
    read_files,
)
from app.core.config import settings
from app.crud import rename_file as rename_file_crud
from app.models import File, User, UserCreate
from tests.utils.user import create_random_user, user_authentication_headers
from tests.utils.utils import random_email, random_lower_string


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


def test_create_group_combines_selected_group_and_file(db: Session) -> None:
    owner = create_random_user(db)
    group = _create_saved_file(
        db=db,
        owner=owner,
        name=f"group-{random_lower_string()}",
        size=10,
        created_at=_utc_now(),
        file_type="fasta",
    )
    group.is_group = True
    existing_child = _create_saved_file(
        db=db,
        owner=owner,
        name=f"existing-{random_lower_string()}.fa",
        size=10,
        created_at=_utc_now(),
        file_type="fasta",
        parent_id=group.id,
    )
    child = _create_saved_file(
        db=db,
        owner=owner,
        name=f"child-{random_lower_string()}.fa",
        size=5,
        created_at=_utc_now(),
        file_type="fasta",
    )
    db.add(group)
    db.commit()
    db.refresh(group)

    result = create_group(
        session=db,
        current_user=owner,
        name=f"combined-{random_lower_string()}",
        file_ids=[group.id, child.id],
    )

    db.refresh(child)
    db.refresh(existing_child)
    assert child.parent_id == result.id
    assert existing_child.parent_id == result.id
    assert result.size == 15


def test_create_group_sanitises_the_name(db: Session) -> None:
    owner = create_random_user(db)
    child = _create_saved_file(
        db=db,
        owner=owner,
        name=f"child-{random_lower_string()}.fa",
        size=5,
        created_at=_utc_now(),
        file_type="fasta",
    )

    group = create_group(
        session=db,
        current_user=owner,
        name="my group; rm -rf /",
        file_ids=[child.id],
    )

    assert group.name == "my_group__rm_-rf__"


def test_create_pair_sanitises_the_name(db: Session) -> None:
    owner = create_random_user(db)
    forward = _create_saved_file(
        db=db,
        owner=owner,
        name=f"r1-{random_lower_string()}.fa",
        size=5,
        created_at=_utc_now(),
        file_type="fasta",
    )
    reverse = _create_saved_file(
        db=db,
        owner=owner,
        name=f"r2-{random_lower_string()}.fa",
        size=5,
        created_at=_utc_now(),
        file_type="fasta",
    )

    pair = create_pair(
        session=db,
        current_user=owner,
        name="reads 1 & 2",
        forward=forward.id,
        reverse=reverse.id,
    )

    assert pair.name == "reads_1___2"


def test_create_group_rejects_mismatched_group_and_file_type(db: Session) -> None:
    owner = create_random_user(db)
    group = _create_saved_file(
        db=db,
        owner=owner,
        name=f"group-{random_lower_string()}",
        size=10,
        created_at=_utc_now(),
        file_type="fasta",
    )
    group.is_group = True
    _create_saved_file(
        db=db,
        owner=owner,
        name=f"existing-{random_lower_string()}.fa",
        size=10,
        created_at=_utc_now(),
        file_type="fasta",
        parent_id=group.id,
    )
    child = _create_saved_file(
        db=db,
        owner=owner,
        name=f"child-{random_lower_string()}.txt",
        size=5,
        created_at=_utc_now(),
        file_type="text",
    )
    db.add(group)
    db.commit()
    db.refresh(group)

    with pytest.raises(HTTPException) as exc_info:
        create_group(
            session=db,
            current_user=owner,
            name=f"combined-{random_lower_string()}",
            file_ids=[group.id, child.id],
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "All files in a group must have the same file type"


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


def test_read_files_sorts_by_updated_at(db: Session) -> None:
    owner = create_random_user(db)
    prefix = random_lower_string()
    older = _create_saved_file(
        db=db,
        owner=owner,
        name=f"{prefix}-older.txt",
        size=10,
        created_at=_utc_now() - timedelta(days=2),
    )
    newer = _create_saved_file(
        db=db,
        owner=owner,
        name=f"{prefix}-newer.txt",
        size=10,
        created_at=_utc_now() - timedelta(days=1),
    )
    # Creating a file sets updated_at too, so age them on purpose.
    older.updated_at = _utc_now() - timedelta(days=2)
    newer.updated_at = _utc_now() - timedelta(days=1)
    db.add(older)
    db.add(newer)
    db.commit()

    # Renaming the older file moves it to the top of the list.
    rename_file_crud(
        session=db, file=older, new_name=f"{prefix}-older-renamed.txt"
    )

    result = read_files(
        session=db,
        current_user=owner,
        name=prefix,
        order_by="-updated_at",
        types=[],
    )

    assert [item.id for item in result.data[:2]] == [older.id, newer.id]


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


def test_read_files_loads_children_without_per_file_queries(db: Session) -> None:
    """Serialising top-level files must not query children once per file (N+1)."""
    owner = create_random_user(db)
    prefix = random_lower_string()
    expected_children: dict[uuid.UUID, list[uuid.UUID]] = {}
    parent_count = 6

    for index in range(parent_count):
        created_at = _utc_now()
        parent = _create_saved_file(
            db=db,
            owner=owner,
            name=f"{prefix}-pair-{index}",
            size=2,
            created_at=created_at,
            file_type="pair",
        )
        children = [
            _create_saved_file(
                db=db,
                owner=owner,
                name=f"{prefix}-{index}_R{read}.fastq",
                size=1,
                created_at=created_at + timedelta(seconds=read),
                file_type="fastq",
                parent_id=parent.id,
            )
            for read in (1, 2)
        ]
        expected_children[parent.id] = [child.id for child in children]

    statements: list[str] = []

    def _record_statement(
        _conn: Any,
        _cursor: Any,
        statement: str,
        _parameters: Any,
        _context: Any,
        _executemany: bool,
    ) -> None:
        statements.append(statement)

    engine = db.get_bind()
    event.listen(engine, "before_cursor_execute", _record_statement)
    try:
        result = read_files(
            session=db,
            current_user=owner,
            name=prefix,
            order_by="name",
            types=[],
        )
    finally:
        event.remove(engine, "before_cursor_execute", _record_statement)

    assert result.count == parent_count
    # Budget: current_user refresh, count, page, one batched children query.
    # Lazy loading children per file would add one query per parent.
    assert len(statements) <= 5, statements
    for item in result.data:
        assert [child.id for child in item.children or []] == expected_children[item.id]


def test_delete_files_filters_by_ids(db: Session) -> None:
    owner = create_random_user(db)
    visible = _create_saved_file(
        db=db,
        owner=owner,
        name=f"visible-{random_lower_string()}.txt",
        size=10,
        created_at=_utc_now(),
    )
    hidden = _create_saved_file(
        db=db,
        owner=owner,
        name=f"hidden-{random_lower_string()}.txt",
        size=10,
        created_at=_utc_now(),
    )
    unsaved = _create_saved_file(
        db=db,
        owner=owner,
        name=f"unsaved-{random_lower_string()}.txt",
        size=10,
        created_at=_utc_now(),
        saved=False,
    )

    delete_files(
        session=db,
        current_user=owner,
        ids=[visible.id, unsaved.id],
        name=None,
        types=[],
        top_level_only=False,
    )

    assert db.get(File, visible.id) is None
    assert db.get(File, hidden.id) is not None
    assert db.get(File, unsaved.id) is not None


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


def _make_upload_user(
    client: TestClient, db: Session
) -> tuple[User, dict[str, str]]:
    """A fresh user (default role holds files:create) with a bearer token."""
    email = random_email()
    password = random_lower_string()
    user = crud.create_user(
        session=db, user_create=UserCreate(email=email, password=password)
    )
    return user, user_authentication_headers(
        client=client, email=email, password=password
    )


def _file_part(
    *, boundary: str, filename: str, data: bytes, content_length: int | None
) -> bytes:
    """A raw multipart file part. The declared Content-Length may be a lie or
    absent, exactly the inputs the counted copy must not trust."""
    headers = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        "Content-Type: application/octet-stream\r\n"
    )
    if content_length is not None:
        headers += f"Content-Length: {content_length}\r\n"
    return headers.encode() + b"\r\n" + data + f"\r\n--{boundary}--\r\n".encode()


def _upload_raw(
    client: TestClient, headers: dict[str, str], body: bytes, *, boundary: str
) -> Any:
    return client.post(
        f"{settings.API_V1_STR}/files/",
        content=body,
        headers={
            **headers,
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )


def _saved_files_for(db: Session, owner: User) -> list[File]:
    return list(db.exec(select(File).where(File.owner_id == owner.id)).all())


def _stored_files(storage_path: Path) -> list[Path]:
    return [p for p in storage_path.rglob("*") if p.is_file()]


def test_upload_rejects_lying_content_length_with_413(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """Declaring a small Content-Length must not bypass the size cap: the cap
    is enforced on the bytes actually streamed to storage."""
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "MAX_FILE_UPLOAD_SIZE", 1024)
    owner, headers = _make_upload_user(client, db)
    boundary = "lying-upload-boundary"

    response = _upload_raw(
        client,
        headers,
        _file_part(
            boundary=boundary,
            filename="payload.bin",
            data=b"A" * 4096,
            content_length=10,  # lies: the real body is 4096 bytes
        ),
        boundary=boundary,
    )

    assert response.status_code == 413
    assert "too large" in response.json()["detail"]
    assert _saved_files_for(db, owner) == []
    assert _stored_files(tmp_path) == []


def test_upload_part_without_content_length_exceeding_cap_returns_413(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """A chunked part (no Content-Length) that exceeds the cap gets a 413, not
    a 500, and leaves nothing behind."""
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "MAX_FILE_UPLOAD_SIZE", 1024)
    owner, headers = _make_upload_user(client, db)
    boundary = "chunked-upload-boundary"

    response = _upload_raw(
        client,
        headers,
        _file_part(
            boundary=boundary,
            filename="payload.bin",
            data=b"B" * 2048,
            content_length=None,
        ),
        boundary=boundary,
    )

    assert response.status_code == 413
    assert _saved_files_for(db, owner) == []
    assert _stored_files(tmp_path) == []


def test_upload_exceeding_storage_quota_on_counted_bytes_returns_413(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """An upload that pushes the user past max_storage is aborted mid-stream on
    the counted bytes, leaving no partial artifact behind."""
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "MAX_FILE_UPLOAD_SIZE", 1024 * 1024)
    owner, headers = _make_upload_user(client, db)
    owner.max_storage = 2048
    db.add(owner)
    db.commit()
    db.refresh(owner)
    _create_saved_file(
        db=db, owner=owner, name="existing.txt", size=1500, created_at=_utc_now()
    )
    boundary = "over-quota-boundary"

    response = _upload_raw(
        client,
        headers,
        _file_part(
            boundary=boundary,
            filename="payload.bin",
            data=b"C" * 4096,
            content_length=10,
        ),
        boundary=boundary,
    )

    assert response.status_code == 413
    assert "Not enough storage space" in response.json()["detail"]
    assert len(_saved_files_for(db, owner)) == 1  # only the pre-existing file
    assert _stored_files(tmp_path) == []


def test_upload_small_file_succeeds_and_records_real_size(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    """A normal upload still lands on disk with File.size from stat().st_size."""
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))
    owner, headers = _make_upload_user(client, db)
    boundary = "happy-upload-boundary"
    payload = b"hello portal"

    response = _upload_raw(
        client,
        headers,
        _file_part(
            boundary=boundary,
            filename="note.txt",
            data=payload,
            content_length=len(payload),
        ),
        boundary=boundary,
    )

    assert response.status_code == 200
    row = db.get(File, uuid.UUID(response.json()["id"]))
    assert row is not None
    assert row.owner_id == owner.id
    assert row.size == len(payload)
    assert Path(row.location).read_bytes() == payload
