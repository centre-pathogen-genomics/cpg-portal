"""API router that derives permission requirements from its routes.

A route declared on ``PermissionAPIRouter(resource="files")`` needs
``files:read`` for a GET, ``files:create`` for a POST, and so on. The
permission is registered in the catalog as the route is declared, so the
catalog and the enforcement cannot drift apart.

Pass ``action=`` to name a permission that differs from the method mapping
(``cancel``, ``share``, ``favourite``, ...) and ``public=True`` for a route that
has no permission requirement at all. ``public`` does not by itself make a
route anonymous: a handler that declares ``CurrentUser`` still requires
authentication.
"""

from collections.abc import Callable
from typing import Any, TypeVar

from fastapi import APIRouter, Depends

from app.api.deps import require_permission
from app.core.rbac import permission_registry

HTTP_ACTION_BY_METHOD = {
    "GET": "read",
    "POST": "create",
    "PUT": "update",
    "PATCH": "update",
    "DELETE": "delete",
}

DecoratedCallable = TypeVar("DecoratedCallable", bound=Callable[..., Any])


class PermissionAPIRouter(APIRouter):
    """APIRouter whose routes require ``<resource>:<action>``."""

    def __init__(self, *, resource: str, **kwargs: Any) -> None:
        self.resource = resource
        super().__init__(**kwargs)

    def api_route(
        self, *args: Any, **kwargs: Any
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        action = kwargs.pop("action", None)
        public = kwargs.pop("public", False)
        if public:
            return super().api_route(*args, **kwargs)

        methods: list[str] = kwargs.get("methods") or ["GET"]
        actions: set[str] = set()
        for method in methods:
            mapped = HTTP_ACTION_BY_METHOD.get(method.upper())
            if mapped is None:
                raise ValueError(f"Unsupported permission method: {method}")
            actions.add(mapped)

        if action is None:
            if len(actions) != 1:
                raise ValueError(
                    "Permission routes with several methods require an explicit action"
                )
            action = actions.pop()

        permission = f"{self.resource}:{action}"
        kwargs["dependencies"] = [
            *kwargs.get("dependencies", []),
            Depends(require_permission(permission)),
        ]
        decorator = super().api_route(*args, **kwargs)

        def register_endpoint(endpoint: DecoratedCallable) -> DecoratedCallable:
            permission_registry.register_route(permission, endpoint)
            return decorator(endpoint)

        return register_endpoint

    def get(
        self, *args: Any, **kwargs: Any
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        kwargs["methods"] = ["GET"]
        return self.api_route(*args, **kwargs)

    def post(
        self, *args: Any, **kwargs: Any
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        kwargs["methods"] = ["POST"]
        return self.api_route(*args, **kwargs)

    def put(
        self, *args: Any, **kwargs: Any
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        kwargs["methods"] = ["PUT"]
        return self.api_route(*args, **kwargs)

    def patch(
        self, *args: Any, **kwargs: Any
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        kwargs["methods"] = ["PATCH"]
        return self.api_route(*args, **kwargs)

    def delete(
        self, *args: Any, **kwargs: Any
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        kwargs["methods"] = ["DELETE"]
        return self.api_route(*args, **kwargs)
