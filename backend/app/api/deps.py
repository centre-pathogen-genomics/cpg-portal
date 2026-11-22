from collections.abc import Callable, Generator
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Query, Request, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pydantic import ValidationError
from sqlmodel import Session

from app.core import security
from app.core.config import settings
from app.core.db import engine
from app.core.observability import audit
from app.core.rbac import has_permission
from app.models import File, TokenPayload, User

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token"
)
optional_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/login/access-token",
    auto_error=False,
)


def get_db() -> Generator[Session]:
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]
TokenDep = Annotated[str, Depends(reusable_oauth2)]


def get_current_user(
    session: SessionDep, token: TokenDep, request: Request = None
) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except InvalidTokenError, ValidationError:
        audit("auth.token_rejected", request=request, reason="malformed")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Could not validate credentials",
        )
    user = session.get(User, token_data.sub)
    if not user:
        audit(
            "auth.token_rejected",
            request=request,
            reason="unknown_user",
            subject=token_data.sub,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    # Tokens without a version (old, or minted by something other than login) and
    # tokens from before a password reset / deactivation are rejected.
    if token_data.ver is None or token_data.ver != user.token_version:
        audit(
            "auth.token_rejected",
            request=request,
            reason="stale_version",
            user_id=user.id,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    if not user.is_active:
        audit(
            "auth.token_rejected",
            request=request,
            reason="inactive",
            user_id=user.id,
        )
        raise HTTPException(status_code=400, detail="Inactive user")
    return user


def get_current_user_or_anonymous(
    session: SessionDep,
    token: Annotated[str | None, Depends(optional_oauth2)],
    request: Request = None,
) -> User | None:
    # no header → anonymous
    if token is None:
        return None
    try:
        # valid bearer token → real user
        return get_current_user(session, token, request)
    except HTTPException as e:
        # Invalid or stale credentials do not block public routes.
        if e.status_code in {
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_403_FORBIDDEN,
        }:
            return None
        # other errors (404, 400) bubble up
        raise


def get_current_user_from_query(
    session: SessionDep,
    token: Annotated[str | None, Query()] = None,
    request: Request = None,
) -> User:
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return get_current_user(session, token, request)


CurrentUser = Annotated[User, Depends(get_current_user)]
CurrentUserOrAnonymous = Annotated[User | None, Depends(get_current_user_or_anonymous)]


def require_permission(permission: str) -> Callable[..., User]:
    def check_permission(
        current_user: CurrentUser, session: SessionDep, request: Request
    ) -> User:
        if not has_permission(session, current_user, permission):
            audit(
                "auth.permission_denied",
                request=request,
                user_id=current_user.id,
                permission=permission,
            )
            raise HTTPException(
                status_code=403, detail=f"Missing permission: {permission}"
            )
        return current_user

    return check_permission


def get_file(session: SessionDep, token: str) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except InvalidTokenError, ValidationError:
        raise HTTPException(
            status_code=403,
            detail="Could not validate credentials",
        )
    file_metadata = session.get(File, token_data.sub)
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")
    return file_metadata


FileDep = Annotated[File, Depends(get_file)]
