import shutil
import uuid
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models import File, FileType, User, UserCreate, UserUpdate


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


def _save_single_file(session: Session, file_path: Path, file_type: FileType, owner_id: uuid.UUID) -> File:
    """Helper function to save a single file."""
    file_id = str(uuid.uuid4())
    file_name = file_path.name.replace(" ", "_")
    file_storage_location = Path(settings.STORAGE_PATH) / f"{file_id}_{file_name}"
    with open(file_storage_location, "wb") as fdst, open(file_path, "rb") as fsrc:
        shutil.copyfileobj(fsrc, fdst)
    file_metadata = File(
        name=file_name,
        owner_id=owner_id,
        location=str(file_storage_location),
        size=file_storage_location.stat().st_size,
        file_type=file_type,
    )
    session.add(file_metadata)
    return file_metadata

def save_file(*, session: Session, file_path: Path, file_type: FileType, owner_id: uuid.UUID) -> File:
    """Save a single file and commit the session."""
    file_metadata = _save_single_file(session, file_path, file_type, owner_id)
    session.commit()
    session.refresh(file_metadata)
    return file_metadata

def save_file_multiple(*, session: Session, file_paths: list[Path], owner_id: uuid.UUID) -> list[File]:
    """Save multiple files and commit the session after adding all files."""
    files = [_save_single_file(session, file_path, owner_id) for file_path in file_paths]
    session.commit()
    return files
