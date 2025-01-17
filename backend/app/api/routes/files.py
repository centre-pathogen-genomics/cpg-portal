import shutil
import uuid
from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from fastapi import APIRouter, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import desc
from sqlmodel import func, select

from app.api.deps import CurrentUser, FileDep, SessionDep
from app.core.security import create_access_token
from app.crud import save_file
from app.models import File, FilePublic, FilesPublic, FilesStatistics, FileType, Message

router = APIRouter()

@router.get("/", response_model=FilesPublic)
def read_files(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    order_by: str = Query("-created_at", regex=r"^-?[a-zA-Z_]+$")
) -> Any:
    """
    Retrieve files.
    """
    # Counting for pagination
    count_query = select(func.count()).select_from(File).where(File.owner_id == current_user.id)
    count = session.exec(count_query).one()

    # Parse the order_by string to determine the column and direction
    descending = order_by.startswith('-')
    column_name = order_by[1:] if descending else order_by

    # Validate and obtain the actual column object from the Run model
    if hasattr(File, column_name):
        column = getattr(File, column_name)
        order_expression = desc(column) if descending else column
    else:
        raise HTTPException(status_code=400, detail=f"Invalid column name: {column_name}")

    # Build the query based on user role
    query_base = select(File).where(File.owner_id == current_user.id)

    # Apply ordering, pagination and execute
    files_query = query_base.order_by(order_expression).offset(skip).limit(limit)
    files = session.exec(files_query).all()

    return FilesPublic(data=files, count=count)


@router.get("/stats", response_model=FilesStatistics)
def get_files_stats(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Get files statistics.
    """
    # Counting for pagination
    count_query = select(func.count()).select_from(File).where(File.owner_id == current_user.id)
    count = session.exec(count_query).one()

    # total size
    size_query = select(func.sum(File.size)).select_from(File).where(File.owner_id == current_user.id)

    total_size = session.exec(size_query).one() or 0

    return FilesStatistics(count=count, total_size=total_size)


def guess_file_type(file: UploadFile) -> str:
    """
    Guess file type based on the file extension.
    """
    if not file.content_type:
        return FileType.unknown
    if file.content_type.startswith("image"):
        return FileType.image
    if 'csv' in file.content_type or file.filename.endswith(".csv"):
        return FileType.csv
    if 'json' in file.content_type or file.filename.endswith(".json"):
        return FileType.json
    if 'tsv' in file.content_type or file.filename.endswith(".tsv"):
        return FileType.tsv
    if file.content_type.contains("text"):
        # catch all text/... types
        return FileType.text
    return FileType.unknown

@router.post("/", response_model=FilePublic)
async def upload_file(
    *, session: SessionDep, current_user: CurrentUser, file: UploadFile) -> Any:
    """
    Upload a new file.
    """
    # Create a temporary directory
    with TemporaryDirectory() as temp_dir:
        # Construct the temporary file path with the same name as the uploaded file
        tmp_path = Path(temp_dir) / file.filename

        # Write the uploaded file content to the temporary file
        with open(tmp_path, "wb") as tmp_file:
            shutil.copyfileobj(file.file, tmp_file, length=1024*1024)  # Copy in 1 MB chunks

        file_type = guess_file_type(file)

        # Call the function to save the file metadata
        file_metadata = save_file(
            session=session,
            file_path=tmp_path,
            file_type=file_type,
            owner_id=current_user.id
        )

    return file_metadata

@router.get("/{id}", response_model=FilePublic)
def read_file(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Retrieve file metadata.
    """
    file_metadata = session.get(File, id)
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    if file_metadata.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return file_metadata

@router.delete("/{id}")
def delete_file(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Delete file.
    """
    file_metadata: File = session.get(File, id)
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    if file_metadata.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    try:
        # remove file
        file_path = Path(file_metadata.location)
        if file_path.exists():
            file_path.unlink()
        session.delete(file_metadata)
        session.commit()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to delete file")
    return Message(message="File deleted successfully")

@router.delete("/")
def delete_files(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Delete all files.
    """
    files = session.exec(select(File).where(File.owner_id == current_user.id)).all()
    try:
        for file_metadata in files:
            # remove file
            file_path = Path(file_metadata.location)
            if file_path.exists():
                file_path.unlink()
            session.delete(file_metadata)
        session.commit()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to delete files")
    return Message(message="All files deleted successfully")

@router.get("/{id}/download")
def download_file(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Download file.
    """
    file_metadata = session.get(File, id)
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    if file_metadata.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return FileResponse(file_metadata.location, filename=file_metadata.name)

@router.get("/{id}/token", response_model=str)
def get_download_token(session: SessionDep, current_user: CurrentUser, id: uuid.UUID, minutes: int = 1) -> Any:
    """
    Get signed file download token.
    """
    file_metadata = session.get(File, id)
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    if file_metadata.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    access_token_expires = timedelta(minutes=minutes if minutes > 0 and minutes <= 60 * 24 else 1)
    return create_access_token(
            str(file_metadata.id), expires_delta=access_token_expires
        )

@router.get("/download/{token}")
def download_file_with_token(file_metadata: FileDep) -> Any:
    """
    Download file by token.
    """
    file_path = Path(file_metadata.location)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, filename=file_metadata.name)
