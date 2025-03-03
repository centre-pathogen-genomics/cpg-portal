from collections.abc import Callable
from typing import Any

from fastapi import APIRouter as FastAPIRouter
from fastapi.types import DecoratedCallable


class TrailingSlashRouter(FastAPIRouter):
    """
    Custom router that adds an alternate route with a trailing slash for every route.
    """
    def api_route(
        self, path: str, *, include_in_schema: bool = True, **kwargs: Any
    ) -> Callable[[DecoratedCallable], DecoratedCallable]:
        if path.endswith("/") and len(path) > 1:
            path = path[:-1]

        add_path = super().api_route(
            path, include_in_schema=include_in_schema, **kwargs
        )

        alternate_path = path + "/"
        add_alternate_path = super().api_route(
            alternate_path, include_in_schema=False, **kwargs
        )

        def decorator(func: DecoratedCallable) -> DecoratedCallable:
            add_alternate_path(func)
            return add_path(func)

        return decorator
