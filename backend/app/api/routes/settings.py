from fastapi import APIRouter
from sqlmodel import SQLModel

from app.api.deps import CurrentUser, SessionDep, SuperUser
from app.core.app_settings import get_or_create_app_settings
from app.models import AppSettingPublic, AppSettingUpdate

router = APIRouter()


class QueuePublicStatus(SQLModel):
    queue_paused: bool
    queue_pause_reason: str | None = None


@router.get("/queue", response_model=QueuePublicStatus)
def read_queue_status(
    session: SessionDep,
    _current_user: CurrentUser,
) -> QueuePublicStatus:
    """
    Retrieve user-visible queue drain status.
    """
    app_settings = get_or_create_app_settings(session)
    return QueuePublicStatus(
        queue_paused=app_settings.queue_paused,
        queue_pause_reason=app_settings.queue_pause_reason,
    )


@router.get("/", response_model=AppSettingPublic)
def read_app_settings(session: SessionDep, _current_user: SuperUser) -> AppSettingPublic:
    """
    Retrieve application settings.
    """
    return get_or_create_app_settings(session)


@router.patch("/", response_model=AppSettingPublic)
def update_app_settings(
    session: SessionDep,
    _current_user: SuperUser,
    settings_in: AppSettingUpdate,
) -> AppSettingPublic:
    """
    Update application settings.
    """
    app_settings = get_or_create_app_settings(session)
    app_settings.sqlmodel_update(settings_in.model_dump())
    session.add(app_settings)
    session.commit()
    session.refresh(app_settings)
    return app_settings
