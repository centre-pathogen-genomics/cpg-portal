import hashlib
import secrets
import shutil
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, BinaryIO

from sqlalchemy import delete
from sqlmodel import Session, col, func, select

from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models import (
    AuthToken,
    AuthTokenPurpose,
    File,
    FilesStatistics,
    FileType,
    User,
    UserCreate,
    UserUpdate,
    new_token_version,
)
from app.utils import sanitise_shell_input


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> Any:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        hashed_password = get_password_hash(password)
        extra_data["hashed_password"] = hashed_password
    # A new password or a deactivation must kill existing sessions and any
    # outstanding activation/reset links (otherwise a deactivated user could
    # re-activate themselves with an old emailed link).
    if "password" in user_data or user_data.get("is_active") is False:
        revoke_user_access(session=session, user=db_user)
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def _hash_auth_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _utcnow_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def revoke_user_access(*, session: Session, user: User) -> None:
    """
    Invalidate all of the user's access tokens and outstanding emailed tokens.
    Does not commit: the caller commits together with the change that required it.
    """
    user.token_version = new_token_version()
    session.add(user)
    session.exec(delete(AuthToken).where(col(AuthToken.user_id) == user.id))


def create_auth_token(
    *, session: Session, user: User, purpose: AuthTokenPurpose
) -> str:
    """
    Create a random single-use token for `user` and return it (to be emailed).
    Only its SHA-256 is stored.
    """
    now = _utcnow_naive()
    # tidy this user's expired tokens so the table stays small
    session.exec(
        delete(AuthToken).where(
            col(AuthToken.user_id) == user.id, col(AuthToken.expires_at) < now
        )
    )
    token = secrets.token_urlsafe(32)
    session.add(
        AuthToken(
            user_id=user.id,
            purpose=purpose.value,
            token_hash=_hash_auth_token(token),
            expires_at=now + timedelta(hours=settings.EMAIL_RESET_TOKEN_EXPIRE_HOURS),
        )
    )
    session.commit()
    return token


def consume_auth_token(
    *, session: Session, token: str, purpose: AuthTokenPurpose
) -> User | None:
    """
    Atomically delete the token and return its user, or None if the token is
    unknown, for a different purpose, or expired. Single use: a replay finds
    nothing. Does not commit: the caller commits after applying the change, so a
    failure after this point leaves the token unspent.
    """
    row = session.exec(
        delete(AuthToken)
        .where(
            col(AuthToken.token_hash) == _hash_auth_token(token),
            col(AuthToken.purpose) == purpose.value,
        )
        .returning(col(AuthToken.user_id), col(AuthToken.expires_at))
    ).first()
    if row is None:
        return None
    user_id, expires_at = row
    if expires_at < _utcnow_naive():
        return None
    return session.get(User, user_id)


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    session_user = session.exec(statement).first()
    return session_user


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        return None
    verified, updated_hash = verify_password(password, db_user.hashed_password)
    if not verified:
        return None
    if updated_hash:
        db_user.hashed_password = updated_hash
        session.add(db_user)
        session.commit()
        session.refresh(db_user)
    return db_user


def get_file_stats(session: Session, current_user: User) -> FilesStatistics:
    """
    Get saved files statistics.
    """
    # Count
    count_query = (
        select(func.count())
        .select_from(File)
        .where((File.owner_id == current_user.id) & (File.saved))
    )
    count = session.exec(count_query).one()
    # total size
    size_query = (
        select(func.sum(File.size))
        .select_from(File)
        .where((File.owner_id == current_user.id) & (File.saved))
    )
    total_size = session.exec(size_query).one() or 0
    return FilesStatistics(count=count, total_size=total_size)


def save_file(
    *,
    session: Session,
    name: str,
    file: BinaryIO,
    file_type: FileType,
    owner_id: uuid.UUID,
    saved: bool = False,
    tags: list[str] = None,
) -> File:
    """Save a single file and commit the session."""
    file_id = str(uuid.uuid4())
    file_name = sanitise_shell_input(name)

    # create a directory structure to save the file
    # e.g. /storage/ab/cd/ab_cd_filename
    # this is to avoid having too many files in a single directory
    # which can slow down the filesystem
    first_2_chars = file_id[:2]
    second_2_chars = file_id[2:4]
    file_storage_location = Path(settings.STORAGE_PATH) / first_2_chars / second_2_chars
    file_storage_location.mkdir(parents=True, exist_ok=True)
    file_storage_location = file_storage_location / f"{file_id}_{file_name}"

    with open(file_storage_location, "wb") as fdst:
        print(f"Copying file content to {file_storage_location}")
        shutil.copyfileobj(file, fdst, length=16 * 1024 * 1024)  # 16MB buffer
        print(f"File saved to {file_storage_location}")

    file_metadata = File(
        name=name,
        owner_id=owner_id,
        location=str(file_storage_location),
        size=file_storage_location.stat().st_size,
        file_type=file_type,
        saved=saved,
        tags=tags,
    )
    session.add(file_metadata)
    session.commit()
    session.refresh(file_metadata)
    return file_metadata


def rename_file(*, session: Session, file: File, new_name: str) -> File:
    """Rename a file both in the filesystem and in the database."""
    new_name_sanitised = sanitise_shell_input(new_name)
    if not file.children:
        # Group files do not have a location
        new_location_sanitised = (
            Path(file.location).parent / f"{file.id}_{new_name_sanitised}"
        )
        Path(file.location).rename(new_location_sanitised)
        file.location = str(new_location_sanitised)
    file.name = new_name
    session.add(file)
    session.commit()
    session.refresh(file)
    return file
