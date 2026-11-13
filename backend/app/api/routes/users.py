import logging
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException, Request
from sqlalchemy import delete, update
from sqlmodel import func, select

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.api.permission_router import PermissionAPIRouter
from app.core.config import settings
from app.core.rbac import (
    effective_permission_names,
    has_permission,
)
from app.core.security import get_password_hash, verify_password
from app.core.turnstile import verify_turnstile
from app.models import (
    AuthTokenPurpose,
    File,
    Message,
    Run,
    UpdatePassword,
    User,
    UserCreate,
    UserFavouriteToolsLink,
    UserMe,
    UserPermission,
    UserPublic,
    UserRegister,
    UserRole,
    UsersPublic,
    UserUpdate,
    UserUpdateMe,
)
from app.utils import (
    generate_account_activation_email,
    generate_new_account_email,
    send_email,
)

router = PermissionAPIRouter(resource="users")

logger = logging.getLogger(__name__)


def _delete_user_with_owned_data(*, session: SessionDep, user: User) -> None:
    """
    Delete a user together with the runs and files they own.

    Runs and files keep a hard reference to their owner, so they cannot be left
    behind or set to NULL. Stored file contents are removed after the rows are
    committed. Files owned by someone else are detached rather than deleted.
    """
    active_runs = session.exec(
        select(func.count())
        .select_from(Run)
        .where(
            Run.owner_id == user.id,
            Run.status.in_(["pending", "running"]),
        )
    ).one()
    if active_runs:
        raise HTTPException(
            status_code=409,
            detail="Cancel active runs before deleting this account.",
        )

    run_ids = session.exec(select(Run.id).where(Run.owner_id == user.id)).all()
    file_ids = session.exec(select(File.id).where(File.owner_id == user.id)).all()
    locations = session.exec(
        select(File.location).where(
            File.owner_id == user.id, File.location.is_not(None)
        )
    ).all()

    # A shared run may be given another user's saved input file; only output
    # files belong to the run. Detach anything foreign that still points at a
    # row about to disappear, so the foreign row survives.
    if run_ids:
        session.exec(
            update(File)
            .where(File.run_id.in_(run_ids), File.owner_id != user.id)
            .values(run_id=None)
        )
    if file_ids:
        session.exec(
            update(File)
            .where(File.parent_id.in_(file_ids), File.owner_id != user.id)
            .values(parent_id=None)
        )

    session.exec(delete(File).where(File.owner_id == user.id))
    session.exec(delete(Run).where(Run.owner_id == user.id))
    session.exec(
        delete(UserFavouriteToolsLink).where(UserFavouriteToolsLink.user_id == user.id)
    )
    session.exec(delete(UserRole).where(UserRole.user_id == user.id))
    session.exec(delete(UserPermission).where(UserPermission.user_id == user.id))
    user_id = user.id
    session.delete(user)
    session.commit()

    for location in locations:
        try:
            Path(location).unlink(missing_ok=True)
        except OSError:
            logger.warning(
                "Could not remove stored file %s of deleted user %s",
                location,
                user_id,
            )


@router.get("/", action="list", response_model=UsersPublic)
def read_users(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    """
    Retrieve users, newest first.

    The order matters to the admin table: it asks for a page of users and
    filters them in the browser, so without it a new account can fall outside
    the page and be impossible to find.
    """

    count_statement = select(func.count()).select_from(User)
    count = session.exec(count_statement).one()

    statement = (
        select(User).order_by(User.created_at.desc()).offset(skip).limit(limit)
    )
    users = session.exec(statement).all()

    return UsersPublic(data=users, count=count)


@router.post("/", response_model=UserPublic)
def create_user(*, session: SessionDep, user_in: UserCreate) -> Any:
    """
    Create new user.
    """
    user = crud.get_user_by_email(session=session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )

    user = crud.create_user(session=session, user_create=user_in)
    if settings.emails_enabled and user_in.email:
        password_reset_token = crud.create_auth_token(
            session=session, user=user, purpose=AuthTokenPurpose.RESET
        )
        email_data = generate_new_account_email(
            email_to=user_in.email, username=user_in.email, token=password_reset_token
        )
        send_email(
            email_to=user_in.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
    return user


@router.patch("/me", action="update_self", response_model=UserPublic)
def update_user_me(
    *, session: SessionDep, user_in: UserUpdateMe, current_user: CurrentUser
) -> Any:
    """
    Update own user.
    """

    if user_in.email:
        existing_user = crud.get_user_by_email(session=session, email=user_in.email)
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=409, detail="User with this email already exists"
            )
    user_data = user_in.model_dump(exclude_unset=True)
    current_user.sqlmodel_update(user_data)
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@router.patch("/me/password", action="update_self", response_model=Message)
def update_password_me(
    *, session: SessionDep, body: UpdatePassword, current_user: CurrentUser
) -> Any:
    """
    Update own password.
    """
    password_verified, _ = verify_password(
        body.current_password, current_user.hashed_password
    )
    if not password_verified:
        raise HTTPException(status_code=400, detail="Incorrect password")
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=400, detail="New password cannot be the same as the current one"
        )
    hashed_password = get_password_hash(body.new_password)
    current_user.hashed_password = hashed_password
    session.add(current_user)
    session.commit()
    return Message(message="Password updated successfully")


@router.get("/me", response_model=UserMe, public=True)
def read_user_me(current_user: CurrentUser, session: SessionDep) -> Any:
    """
    Get current user, with the permissions they hold.

    The permissions are read from the database, not the token, so a change
    takes effect on the next request.
    """
    return UserMe(
        **UserPublic.model_validate(current_user).model_dump(),
        permissions=sorted(effective_permission_names(session, current_user)),
    )


@router.delete("/me", action="delete_self", response_model=Message)
def delete_user_me(session: SessionDep, current_user: CurrentUser) -> Any:
    """
    Delete own user.
    """
    if current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    _delete_user_with_owned_data(session=session, user=current_user)
    return Message(message="User deleted successfully")


@router.post("/signup", public=True, response_model=UserPublic)
def register_user(
    session: SessionDep, user_in: UserRegister, request: Request
) -> Any:
    """
    Register a new inactive user and send them an account activation email.
    """
    # Only asks for anything when a Turnstile secret key is configured.
    verify_turnstile(
        user_in.turnstile_token,
        request.client.host if request.client else None,
    )
    existing_user = crud.get_user_by_email(session=session, email=user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system",
        )

    user_create = UserCreate.model_validate(user_in)
    user_create.is_active = False
    user = crud.create_user(session=session, user_create=user_create)

    if settings.emails_enabled and user.email:
        activation_token = crud.create_auth_token(
            session=session, user=user, purpose=AuthTokenPurpose.ACTIVATE
        )
        email_data = generate_account_activation_email(
            email_to=user.email,
            username=user.email,
            token=activation_token,
        )
        send_email(
            email_to=user.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )

    return user


@router.get("/activate", public=True)
def activate_account(token: str, session: SessionDep) -> Message:
    """
    Activate user account from confirmation email token.

    The token is random, single-use and stored server-side (hashed), so it
    cannot be forged and a replay (or a token from the password-reset flow)
    is rejected.
    """
    user = crud.consume_auth_token(
        session=session, token=token, purpose=AuthTokenPurpose.ACTIVATE
    )
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    user.is_active = True
    session.add(user)
    session.commit()
    return Message(message="User activated successfully.")


@router.get("/{user_id}", response_model=UserPublic)
def read_user_by_id(
    user_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> Any:
    """
    Get a specific user by id.
    """
    user = session.get(User, user_id)
    if user == current_user:
        return user
    if not has_permission(session, current_user, "users:list"):
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges",
        )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch("/{user_id}", response_model=UserPublic)
def update_user(
    *,
    session: SessionDep,
    user_id: uuid.UUID,
    user_in: UserUpdate,
) -> Any:
    """
    Update a user.
    """

    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    if user_in.email:
        existing_user = crud.get_user_by_email(session=session, email=user_in.email)
        if existing_user and existing_user.id != user_id:
            raise HTTPException(
                status_code=409, detail="User with this email already exists"
            )

    db_user = crud.update_user(session=session, db_user=db_user, user_in=user_in)
    return db_user


@router.delete("/{user_id}")
def delete_user(
    session: SessionDep, current_user: CurrentUser, user_id: uuid.UUID
) -> Message:
    """
    Delete a user.
    """
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user == current_user:
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    _delete_user_with_owned_data(session=session, user=user)
    return Message(message="User deleted successfully")
