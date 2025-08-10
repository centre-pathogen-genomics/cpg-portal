import uuid
from datetime import timedelta
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import and_, desc
from sqlmodel import func, select

from app.api.deps import CurrentUser, FileDep, SessionDep, get_current_user
from app.core.config import settings
from app.core.file_types import FileTypeEnum, FileTypeMetadata, file_types
from app.core.security import create_access_token
from app.crud import get_file_stats
from app.crud import save_file as save_file_to_filesystem
from app.models import (
    File,
    FilePublic,
    FilesPublic,
    FilesStatistics,
    Message,
    Run,
)

router = APIRouter()


def check_file_access(session: SessionDep, current_user: CurrentUser, file_metadata: File) -> bool:
    """
    Check if the current user has access to the file.
    Returns True if:
    1. User owns the file, OR
    2. File belongs to a shared run
    """
    if file_metadata.owner_id == current_user.id:
        return True
    # Check if file belongs to a shared run
    if file_metadata.run_id:
        run = session.get(Run, file_metadata.run_id)
        if run and run.shared:
            return True
    return False


@router.get("/", response_model=FilesPublic)
def read_files(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
    order_by: str = Query("-created_at", regex=r"^-?[a-zA-Z_]+$"),
    types: list[FileTypeEnum] = Query(None),
) -> Any:
    """
    Retrieve saved files.
    """
    if not types:
        types = []
    print(f"Types: {types}")
    # start with all the top level files
    base_where = (File.owner_id == current_user.id) & (File.saved) & (File.parent_id.is_(None))

    # filter by file types if requested
    if types:
        base_where = and_(base_where, File.file_type.in_(t.value for t in types))

    # Counting for pagination
    count_query = select(func.count()).select_from(File).where(base_where)
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
    query_base = select(File).where(base_where)

    # Apply ordering, pagination and execute
    files_query = query_base.order_by(order_expression).offset(skip).limit(limit)
    files = session.exec(files_query).all()

    return FilesPublic(data=files, count=count)

@router.get("/types", response_model=dict[str, FileTypeMetadata], dependencies=[Depends(get_current_user)])
def get_files_allowed_types() -> Any:
    """
    Get allowed file types.
    """
    return file_types.allowed

@router.get("/stats", response_model=FilesStatistics)
def get_files_stats(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Get saved files statistics.
    """
    return get_file_stats(session, current_user)



@router.post("/", response_model=FilePublic)
def upload_file(
    *, session: SessionDep, current_user: CurrentUser, file: UploadFile) -> Any:
    """
    Upload a new file.
    """
    if file.size > settings.MAX_FILE_UPLOAD_SIZE:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"File size is too large. Max allowed size is {settings.MAX_FILE_UPLOAD_SIZE} bytes")
    storage_stats = get_file_stats(session, current_user)
    if storage_stats.total_size + file.size > current_user.max_storage:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"Not enough storage space. Max allowed storage size is {current_user.max_storage} bytes")
    if storage_stats.count + 1 > current_user.max_storage_files:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=f"Not enough storage space. Max allowed number of files is {current_user.max_storage_files}")
    # TODO: potentially convert to async func and use aiofiles (https://stackoverflow.com/questions/63580229/how-to-save-uploadfile-in-fastapi)
    # Create a temporary directory

    file_type = file_types.get_type(file.filename)

    print(f"File type: {file_type}")
    file_metadata = save_file_to_filesystem(
        session=session,
        name=file.filename,
        file=file.file,
        file_type=file_type,
        owner_id=current_user.id,
        saved=True
    )

    return file_metadata


@router.post("/pairs", response_model=FilePublic)
def create_pair(
    session: SessionDep, current_user: CurrentUser, name: str, forward: uuid.UUID, reverse: uuid.UUID
) -> Any:
    """
    Create a group of paired-end reads.
    """
    # Check if all files belong to the user
    forward_file = session.get(File, forward)
    reverse_file = session.get(File, reverse)
    if not forward_file or not reverse_file:
        raise HTTPException(status_code=404, detail="File not found")
    if forward_file.owner_id != current_user.id or reverse_file.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")

    sum_size = forward_file.size + reverse_file.size
    children = [forward_file, reverse_file]
    # Create a pair group
    pair_metadata = File(
        name=name,
        owner_id=current_user.id,
        file_type=FileTypeEnum.PAIR.value,
        children=children,
        size=sum_size,
        saved=True,
    )
    session.add(pair_metadata)
    session.commit()
    session.refresh(pair_metadata)
    # set the created_at time for the children to the same as the parent
    forward_file.created_at = pair_metadata.created_at
    # add so reverse file is after forward file in the list R1 then R2
    reverse_file.created_at = pair_metadata.created_at + timedelta(seconds=1)
    session.add(forward_file)
    session.add(reverse_file)
    session.commit()
    print(f"Pair created: {pair_metadata}")
    return pair_metadata

@router.get("/{id}", response_model=FilePublic)
def read_file(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Retrieve file metadata.
    """
    file_metadata = session.get(File, id)
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    if not check_file_access(session, current_user, file_metadata):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    return file_metadata


@router.post("{id}/save", response_model=FilePublic)
def save_file(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Save file to My Files.
    """
    file_metadata = session.get(File, id)
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    if file_metadata.owner_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not enough permissions")
    file_metadata.saved = True
    session.add(file_metadata)
    session.commit()
    session.refresh(file_metadata)
    return file_metadata


# Support both path styles to be resilient to client generation quirks
@router.post("/{id}/copy", response_model=FilePublic)
def copy_file(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    """
    Copy a file (or pair) the user has access to into their own saved files.
    - If the user already owns the file, simply mark it saved and return it.
    - If the file is accessible via a shared run, duplicate the file(s) and
      create new metadata owned by the current user with saved=True.
    """
    source = session.get(File, id)
    if not source:
        raise HTTPException(status_code=404, detail="File not found")

    # Otherwise, ensure the user has access (e.g., via a shared run)
    if not check_file_access(session, current_user, source):
        raise HTTPException(status_code=400, detail="Not enough permissions")

    # Calculate storage impact
    files_to_copy = []
    total_size_to_add = 0
    files_count_to_add = 0

    if source.file_type == FileTypeEnum.PAIR.value:
        if not source.children or len(source.children) != 2:
            raise HTTPException(status_code=400, detail="Invalid pair file")
        for child in source.children:
            if not child.location:
                raise HTTPException(status_code=404, detail="File not found")
            path = Path(child.location)
            if not path.exists():
                raise HTTPException(status_code=404, detail="File not found")
            files_to_copy.append(child)
            total_size_to_add += child.size or path.stat().st_size
            files_count_to_add += 1
    else:
        if not source.location:
            raise HTTPException(status_code=404, detail="File not found")
        path = Path(source.location)
        if not path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        files_to_copy.append(source)
        total_size_to_add += source.size or path.stat().st_size
        files_count_to_add += 1

    # Enforce storage limits similar to upload
    storage_stats = get_file_stats(session, current_user)
    if storage_stats.total_size + total_size_to_add > current_user.max_storage:
        raise HTTPException(
            status_code=413,
            detail=f"Not enough storage space. Max allowed storage size is {current_user.max_storage} bytes",
        )
    if storage_stats.count + files_count_to_add > current_user.max_storage_files:
        raise HTTPException(
            status_code=413,
            detail=f"Not enough storage space. Max allowed number of files is {current_user.max_storage_files}",
        )

    # Perform the copy
    new_children: list[File] = []
    for original in files_to_copy:
        # Open original content and save as a new file owned by current user
        file_path = Path(original.location) if original.location else None
        if not file_path or not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        with open(file_path, "rb") as fsrc:
            copied = save_file_to_filesystem(
                session=session,
                name=original.name,
                file=fsrc,
                file_type=original.file_type,
                owner_id=current_user.id,
                saved=True,
            )
        # Preserve tags if present
        if hasattr(original, "tags") and original.tags:
            copied.tags = list(original.tags)
            session.add(copied)
            session.commit()
            session.refresh(copied)
        new_children.append(copied)

    # If original was a pair, create a new pair parent for the user
    if source.file_type == FileTypeEnum.PAIR.value:
        sum_size = sum(c.size for c in new_children)
        pair_metadata = File(
            name=source.name,
            owner_id=current_user.id,
            file_type=FileTypeEnum.PAIR.value,
            children=new_children,
            size=sum_size,
            saved=True,
        )
        session.add(pair_metadata)
        session.commit()
        session.refresh(pair_metadata)
        return pair_metadata

    # Single file copy
    return new_children[0]


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
        files_to_delete = [file_metadata]
        if file_metadata.children:
            files_to_delete.extend(file_metadata.children)
        for file_to_delete in files_to_delete:
            if file_to_delete.location:
                file_path = Path(file_to_delete.location)
                if file_path.exists():
                    file_path.unlink()
            session.delete(file_to_delete)
            session.commit()
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to delete file")
    return Message(message="File deleted successfully")

@router.delete("/")
def delete_files(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Delete all saved files.
    """
    files = session.exec(select(File).where((File.owner_id == current_user.id) & (File.saved))).all()
    try:
        for file_metadata in files:
            # remove file
            if file_metadata.location:
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
    if not check_file_access(session, current_user, file_metadata):
        raise HTTPException(status_code=400, detail="Not enough permissions")
    if file_metadata.file_type == FileTypeEnum.PAIR.value:
        # TODO: Download zipped files?
        raise HTTPException(status_code=400, detail="Paired-end reads cannot be downloaded directly. Please download the files separately.")
    if not file_metadata.location:
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_metadata.location, filename=file_metadata.name)

@router.get("/{id}/token", response_model=str)
def get_download_token(session: SessionDep, current_user: CurrentUser, id: uuid.UUID, minutes: int = 1) -> Any:
    """
    Get signed file download token.
    """
    file_metadata = session.get(File, id)
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    if not check_file_access(session, current_user, file_metadata):
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
    if not file_metadata.location:
        raise HTTPException(status_code=404, detail="File not found")
    file_path = Path(file_metadata.location)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path, filename=file_metadata.name)
