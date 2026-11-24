import hashlib
import secrets
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
    Role,
    User,
    UserCreate,
    UserRole,
    UserUpdate,
    new_token_version,
)
from app.run_spec import sanitise_shell_input


class UploadLimitError(Exception):
    """Raised mid-stream when a saved file exceeds the upload size cap or the
    owner's storage quota. Carries the message the API route surfaces as the
    413 detail.
    """

    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    # A new account starts with the server-managed default role, so it can use
    # the portal without an explicit grant. The startup sync creates that role
    # if it is missing, after which the migration's assignment covers users.
    default_role = session.exec(
        select(Role).where(col(Role.is_default).is_(True))
    ).first()
    if default_role is not None:
        session.add(UserRole(user_id=db_obj.id, role_id=default_role.id))
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
    max_upload_size: int | None = None,
    existing_storage_used: int | None = None,
    max_storage: int | None = None,
) -> File:
    """Save a single file and commit the session.

    The stream is copied in fixed chunks and every byte written is counted, so
    the upload size cap and the owner's storage quota are enforced on real
    bytes rather than on the Content-Length the client declared. The instant a
    limit is crossed the partial destination is deleted and ``UploadLimitError``
    is raised (the caller maps it to HTTP 413). ``File.size`` is set from
    ``stat().st_size``, the authoritative post-write size.
    """
    file_id = str(uuid.uuid4())
    new_name_sanitised = sanitise_shell_input(name)

    # create a directory structure to save the file
    # e.g. /storage/ab/cd/ab_cd_filename
    # this is to avoid having too many files in a single directory
    # which can slow down the filesystem
    first_2_chars = file_id[:2]
    second_2_chars = file_id[2:4]
    file_storage_location = Path(settings.STORAGE_PATH) / first_2_chars / second_2_chars
    file_storage_location.mkdir(parents=True, exist_ok=True)
    file_storage_location = file_storage_location / f"{file_id}_{new_name_sanitised}"

    written = 0
    try:
        with open(file_storage_location, "wb") as fdst:
            print(f"Copying file content to {file_storage_location}")
            while chunk := file.read(16 * 1024 * 1024):  # 16MB buffer
                written += len(chunk)
                if max_upload_size is not None and written > max_upload_size:
                    raise UploadLimitError(
                        f"File size is too large. Max allowed size is {max_upload_size} bytes"
                    )
                if (
                    max_storage is not None
                    and existing_storage_used is not None
                    and existing_storage_used + written > max_storage
                ):
                    raise UploadLimitError(
                        f"Not enough storage space. Max allowed storage size is {max_storage} bytes"
                    )
                fdst.write(chunk)
            print(f"File saved to {file_storage_location}")
    except UploadLimitError:
        file_storage_location.unlink(missing_ok=True)
        raise

    file_metadata = File(
        name=new_name_sanitised,
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
    if (
        not file.children and file.location
    ):  # Only rename if the file is not a group and has a location
        # Group files do not have a location
        new_location_sanitised = (
            Path(file.location).parent / f"{file.id}_{new_name_sanitised}"
        )
        Path(file.location).rename(new_location_sanitised)
        file.location = str(new_location_sanitised)
    file.name = new_name_sanitised
    session.add(file)
    session.commit()
    session.refresh(file)
    return file
