"""Tool command semantics shared by the portal worker and the local runner.

This module is imported by the standalone desktop sidecar as well as by the
portal, so it may only depend on the standard library and jinja2: no settings,
no database models, no FastAPI. Parameters are handled as mappings, the shape a
tool has in its JSON, so a caller does not have to build ORM objects first.
"""

import re
from collections.abc import Mapping, Sequence
from shlex import quote
from typing import Any

from jinja2 import Environment as JinjaEnvironment

# Visibility operators, as they appear in a tool's JSON. Kept as plain strings
# so this module does not import the model enums; `str()` of those enums is the
# same value.
_TRUTHY_OPERATORS = {"truthy", "falsy", "is_set", "is_empty"}
_LIST_OPERATORS = {"in", "not_in"}


def sanitise_shell_input(input_string: str) -> str:
    """
    Sanitise input string to allow only allowed characters.
    Any other character is removed.
    """
    return re.sub(
        r"[^a-zA-Z0-9\-_\.\+]", "_", input_string
    )  # replace invalid characters with "_"


def input_file_name(name: str) -> str:
    """The name a tool sees for one of its input files.

    On disk a file is stored as `<file id>_<name>` to keep it unique; inside a
    run the tool gets the plain name, so its command and its working directory
    agree. The run creation endpoint checks for clashes before it queues a run.
    """
    return sanitise_shell_input(name)


def escape(value: Any) -> Any:
    if isinstance(value, list):
        return [escape(i) for i in value]
    elif isinstance(value, str):
        return quote(sanitise_shell_input(value))
    elif isinstance(value, bool):
        return value
    elif isinstance(value, int):
        return value
    elif isinstance(value, float):
        return value
    elif value is None:
        return None
    else:
        raise Exception(f"Unknown parameter type: {type(value)}")


def validate_param_value(value: Any) -> None:
    """
    Reject string parameter values that could be used for path traversal.

    A "/" is allowed: `escape` masks it to "_" before the command template
    renders, and that is why a tool that wants a slash asks for it back with a
    replace. A backslash, a NUL byte, or a parent-directory reference is
    rejected instead.

    Raises ValueError if the value (or any string nested in a list) contains a
    backslash, a NUL byte, or is a parent-directory reference.
    """
    if isinstance(value, list):
        for item in value:
            validate_param_value(item)
    elif isinstance(value, str):
        if "\\" in value or "\x00" in value or value == "..":
            raise ValueError(
                "Backslashes, NUL bytes and traversal sequences are not allowed"
            )


def flatten(lst: list[Any]) -> list[Any]:
    """Recursively flattens a nested list."""
    result = []
    for item in lst:
        if isinstance(item, list):
            result.extend(flatten(item))
        else:
            result.append(item)
    return result


def is_missing_param_value(value: Any) -> bool:
    return (
        value is None
        or (isinstance(value, str) and value.strip() == "")
        or (isinstance(value, list) and len(value) == 0)
    )


def _param_type(param: Mapping[str, Any]) -> str:
    return str(param["param_type"])


def _parse_visibility_condition_value(
    *,
    value: Any,
    dependency: Mapping[str, Any],
    operator: str,
) -> Any:
    def parse_scalar(raw_value: Any) -> Any:
        if raw_value is None:
            return None

        param_type = _param_type(dependency)

        if param_type == "bool":
            if isinstance(raw_value, bool):
                return raw_value
            if isinstance(raw_value, str):
                lowered = raw_value.strip().lower()
                if lowered in {"true", "1", "yes", "on"}:
                    return True
                if lowered in {"false", "0", "no", "off"}:
                    return False
            raise ValueError(
                f"Invalid visibility condition value for parameter `{dependency['name']}`"
            )

        if param_type == "int":
            try:
                return int(raw_value)
            except (TypeError, ValueError) as exc:
                raise ValueError(
                    f"Invalid visibility condition value for parameter `{dependency['name']}`"
                ) from exc

        if param_type == "float":
            try:
                return float(raw_value)
            except (TypeError, ValueError) as exc:
                raise ValueError(
                    f"Invalid visibility condition value for parameter `{dependency['name']}`"
                ) from exc

        if isinstance(raw_value, list):
            return [str(item) for item in raw_value]

        return str(raw_value)

    if operator in _TRUTHY_OPERATORS:
        return None

    if operator in _LIST_OPERATORS:
        if value is None:
            return []
        if isinstance(value, list):
            return [parse_scalar(item) for item in value]
        if isinstance(value, str):
            return [
                parse_scalar(item.strip()) for item in value.split(",") if item.strip()
            ]
        return [parse_scalar(value)]

    if value is None:
        return None
    return parse_scalar(value)


def _is_visible_if_match(
    *, dependency_value: Any, operator: str, expected_value: Any
) -> bool:
    if operator == "truthy":
        return bool(dependency_value)
    if operator == "falsy":
        return not bool(dependency_value)
    if operator == "is_set":
        return not is_missing_param_value(dependency_value)
    if operator == "is_empty":
        return is_missing_param_value(dependency_value)

    if operator == "equals":
        return dependency_value == expected_value
    if operator == "not_equals":
        return dependency_value != expected_value
    if operator == "in":
        if isinstance(dependency_value, list):
            return any(item in expected_value for item in dependency_value)
        return dependency_value in expected_value
    if operator == "not_in":
        if isinstance(dependency_value, list):
            return all(item not in expected_value for item in dependency_value)
        return dependency_value not in expected_value
    if operator == "greater_than":
        return dependency_value > expected_value
    if operator == "greater_than_or_equal":
        return dependency_value >= expected_value
    if operator == "less_than":
        return dependency_value < expected_value
    if operator == "less_than_or_equal":
        return dependency_value <= expected_value
    return False


def visible_params(
    tool_params: Sequence[Mapping[str, Any]], values: Mapping[str, Any]
) -> dict[str, bool]:
    """Which parameters the run form shows and the run keeps, by name.

    A parameter is visible unless its `visible_if_*` condition on another
    parameter does not hold; a condition on a parameter that does not exist
    hides it. Raises ValueError for a condition value that cannot be read as the
    type of the parameter it looks at, and for a cycle.
    """
    params_by_name = {param["name"]: param for param in tool_params}
    raw_values = dict(values)
    visibility_cache: dict[str, bool] = {}
    visiting: set[str] = set()

    def is_visible(param_name: str) -> bool:
        if param_name in visibility_cache:
            return visibility_cache[param_name]
        if param_name in visiting:
            raise ValueError(
                f"Circular visibility condition detected for parameter `{param_name}`"
            )

        param = params_by_name.get(param_name)
        if param is None:
            visibility_cache[param_name] = True
            return True

        visiting.add(param_name)
        try:
            condition_param_name = param.get("visible_if_param")
            if not condition_param_name:
                visible = True
            else:
                dependency = params_by_name.get(condition_param_name)
                if dependency is None:
                    visible = False
                else:
                    visible = is_visible(condition_param_name)
                    if visible:
                        operator = str(param.get("visible_if_operator") or "equals")
                        dependency_value = raw_values.get(
                            condition_param_name, dependency.get("default")
                        )
                        expected_value = _parse_visibility_condition_value(
                            value=param.get("visible_if_value"),
                            dependency=dependency,
                            operator=operator,
                        )
                        visible = _is_visible_if_match(
                            dependency_value=dependency_value,
                            operator=operator,
                            expected_value=expected_value,
                        )
            visibility_cache[param_name] = visible
            return visible
        finally:
            visiting.discard(param_name)

    for param in tool_params:
        is_visible(param["name"])

    return visibility_cache


def _escaped_values(params: Mapping[str, Any]) -> dict[str, Any]:
    escaped = {}
    for name, value in params.items():
        try:
            escaped[name] = escape(value)
        except Exception:
            raise ValueError(f"Invalid parameter value: {value}")
    return escaped


def render_command(template: str, params: Mapping[str, Any], cpus: int) -> str:
    """Render a tool's command template the way the worker does.

    Every value is escaped first, so a value cannot inject shell syntax. The
    run's CPUs are in the context as `cpus`, so a tool can ask for the CPUs it
    reserved with its own threads flag, e.g. `--threads {{ cpus }}`. It wins
    over a parameter of the same name.
    """
    escaped = _escaped_values(params)
    escaped["cpus"] = cpus
    env = JinjaEnvironment()
    env.filters["flatten"] = flatten
    return env.from_string(template).render(**escaped)


def render_template(template: str, context: Mapping[str, Any]) -> str:
    """Render a setup file's content with the run's plain parameter values."""
    return JinjaEnvironment().from_string(template).render(**context)


def render_target_path(path: str, params: Mapping[str, Any]) -> str:
    """Render a target glob with the same escaped values the command got.

    Escaping means user input cannot inject path parts.
    """
    escaped = _escaped_values(params)
    return JinjaEnvironment().from_string(path).render(**escaped)
