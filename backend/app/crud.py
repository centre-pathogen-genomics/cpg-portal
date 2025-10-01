import shutil
import uuid
from pathlib import Path
from typing import Any, BinaryIO

from sqlmodel import Session, func, select

from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models import File, FilesStatistics, FileType, User, UserCreate, UserUpdate
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
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def get_user_by_email(*, session: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    session_user = session.exec(statement).first()
    return session_user


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    db_user = get_user_by_email(session=session, email=email)
    if not db_user:
        return None
    if not verify_password(password, db_user.hashed_password):
        return None
    return db_user


def get_file_stats(session: Session, current_user: User) -> FilesStatistics:
    """
    Get saved files statistics.
    """
    # Count
    count_query = select(func.count()).select_from(File).where((File.owner_id == current_user.id) & (File.saved))
    count = session.exec(count_query).one()
    # total size
    size_query = select(func.sum(File.size)).select_from(File).where((File.owner_id == current_user.id) & (File.saved))
    total_size = session.exec(size_query).one() or 0
    return FilesStatistics(count=count, total_size=total_size)

def save_file(*, session: Session, name: str, file: BinaryIO, file_type: FileType, owner_id: uuid.UUID, saved: bool = False, tags: list[str] = None) -> File:
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
        shutil.copyfileobj(file, fdst, length=16 * 1024 * 1024) # 16MB buffer
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
        new_location_sanitised = Path(file.location).parent / f"{file.id}_{new_name_sanitised}"
        Path(file.location).rename(new_location_sanitised)
        file.location = str(new_location_sanitised)
    file.name = new_name
    session.add(file)
    session.commit()
    session.refresh(file)
    return file
