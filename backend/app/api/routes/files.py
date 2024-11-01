import os
import shutil
import uuid
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.crud import save_file
from app.models import File, FilePublic, FilesPublic, Message

router = APIRouter()

@router.get("/", response_model=FilesPublic)
def read_files(
    session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100
) -> Any:
    """
    Retrieve files.
    """
    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(File)
        count = session.exec(count_statement).one()
        statement = select(File).offset(skip).limit(limit)
        files = session.exec(statement).all()
    else:
        count_statement = (
            select(func.count())
            .select_from(File)
            .where(File.owner_id == current_user.id)
        )
        count = session.exec(count_statement).one()
        statement = (
            select(File)
            .where(File.owner_id == current_user.id)
            .offset(skip)
            .limit(limit)
        )
        files = session.exec(statement).all()
    return FilesPublic(data=files, count=count)

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

        # Call the function to save the file metadata
        file_metadata = save_file(
            session=session,
            file_path=tmp_path,
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
    if not current_user.is_superuser and (file_metadata.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return file_metadata

@router.delete("/{id}")
def delete_file(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Delete file.
    """
    file_metadata = session.get(File, id)
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    if not current_user.is_superuser and (file_metadata.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    try:
        # remove file
        file_path = Path(file_metadata.location)
        if file_path.exists():
            file_path.unlink()
        session.delete(file_metadata)
        session.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to delete file")
    return Message(message="File deleted successfully")

@router.get("/{id}/download")
def download_file(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Download file.
    """
    file_metadata = session.get(File, id)
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    if not current_user.is_superuser and (file_metadata.owner_id != current_user.id):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return FileResponse(file_metadata.location, filename=file_metadata.name)
