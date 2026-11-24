import io
from pathlib import Path

import pytest
from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.models import File
from tests.utils.user import create_random_user


class _ChunkedStream(io.BytesIO):
    """A binary stream yielding a fixed-size chunk per read call."""

    def __init__(self, chunk: bytes, count: int) -> None:
        super().__init__()
        self._chunk = chunk
        self._remaining = count

    def read(self, size: int = -1) -> bytes:  # noqa: ARG001
        if self._remaining <= 0:
            return b""
        self._remaining -= 1
        return self._chunk


def test_save_file_aborts_at_size_cap_and_deletes_partial_file(
    db: Session, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))
    owner = create_random_user(db)

    with pytest.raises(crud.UploadLimitError):
        crud.save_file(
            session=db,
            name="big.bin",
            file=_ChunkedStream(b"x" * 1024, count=4),  # 4 KiB streamed
            file_type="text",
            owner_id=owner.id,
            saved=True,
            max_upload_size=2048,
        )

    assert list(tmp_path.rglob("*.bin")) == []
    assert not db.exec(select(File).where(File.owner_id == owner.id)).all()


def test_save_file_aborts_at_storage_quota_on_counted_bytes(
    db: Session, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))
    owner = create_random_user(db)
    owner.max_storage = 1500
    db.add(owner)
    db.commit()

    # 500 bytes already used; 512-byte chunks cross the 1500-byte limit on the
    # second read (500 + 1024 > 1500), proving the counter accumulates across
    # reads instead of trusting any declared size.
    with pytest.raises(crud.UploadLimitError):
        crud.save_file(
            session=db,
            name="big.bin",
            file=_ChunkedStream(b"y" * 512, count=4),
            file_type="text",
            owner_id=owner.id,
            saved=True,
            existing_storage_used=500,
            max_storage=1500,
        )

    assert list(tmp_path.rglob("*.bin")) == []
    assert not db.exec(select(File).where(File.owner_id == owner.id)).all()
