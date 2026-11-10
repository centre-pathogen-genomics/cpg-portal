"""Turn the renderer's submitted values into what a run's command may see."""

from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from app.core.file_types import FileTypes
from app.run_spec import (
    input_file_name,
    is_missing_param_value,
    validate_param_value,
    visible_params,
)

from .config import ToolConfig


def _path_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value if str(item).strip()]
    text = str(value).strip()
    return [text] if text else []


def _allowed_extensions(param: Mapping[str, Any]) -> list[str]:
    extensions: list[str] = []
    for file_type in param.get("allowed_file_types") or []:
        metadata = FileTypes.allowed.get(str(file_type))
        if metadata is not None:
            extensions.extend(metadata.extensions)
    return extensions


def _check_file_type(name: str, extensions: Sequence[str]) -> None:
    if not extensions:
        return
    lowered = name.lower()
    if not any(lowered.endswith(ext.lower()) for ext in extensions):
        raise ValueError(f"File type not allowed: {name}")


def _resolve_file_param(
    param: Mapping[str, Any],
    name: str,
    paths: list[str],
    *,
    seen_names: set[str],
) -> Any:
    if not paths:
        if param.get("required"):
            raise ValueError(f"Missing required parameter: {name}")
        return [] if param.get("multiple") else ""
    if not param.get("multiple") and len(paths) != 1:
        raise ValueError(
            f"Parameter `{name}` expects exactly one file, got {len(paths)}"
        )
    extensions = _allowed_extensions(param)
    visible_names: list[str] = []
    for raw_path in paths:
        path = Path(raw_path)
        if not path.is_absolute():
            raise ValueError(f"File paths must be absolute: {raw_path}")
        if not path.is_file():
            raise ValueError(f"File not found: {raw_path}")
        _check_file_type(path.name, extensions)
        visible_name = input_file_name(path.name)
        if visible_name in seen_names:
            raise ValueError(f"Duplicate input file name: {visible_name}")
        seen_names.add(visible_name)
        visible_names.append(visible_name)
    if param.get("multiple"):
        return visible_names
    return visible_names[0]


def resolve_params(
    tool: ToolConfig,
    submitted: Mapping[str, Any],
    file_paths: Mapping[str, list[str]],
) -> dict[str, Any]:
    """Return the values a run's command and setup files are rendered with."""
    visibility = visible_params(tool.params, submitted)
    resolved: dict[str, Any] = {}
    seen_input_names: set[str] = set()

    for param in tool.params:
        name = param["name"]
        if not visibility.get(name, True):
            continue
        param_type = str(param["param_type"])
        if param_type == "file":
            paths = list(file_paths.get(name) or [])
            if not paths:
                paths = _path_list(submitted.get(name))
            resolved[name] = _resolve_file_param(
                param, name, paths, seen_names=seen_input_names
            )
            continue

        value = submitted.get(name, param.get("default"))
        if is_missing_param_value(value):
            if param.get("required"):
                raise ValueError(f"Missing required parameter: {name}")
            default = param.get("default")
            if param_type == "bool":
                resolved[name] = bool(default)
            else:
                resolved[name] = default
            continue

        if param_type == "int":
            try:
                resolved[name] = int(float(value))
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Invalid value for parameter: {name}") from exc
        elif param_type == "float":
            try:
                resolved[name] = float(value)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Invalid value for parameter: {name}") from exc
        elif param_type == "bool":
            resolved[name] = bool(value)
        elif param_type == "enum":
            text = str(value)
            validate_param_value(text)
            if text not in (param.get("options") or []):
                raise ValueError(f"Invalid value for parameter: {name}")
            resolved[name] = text
        elif param_type == "str":
            text = str(value)
            validate_param_value(text)
            resolved[name] = text
        else:
            raise ValueError(f"Unknown parameter type: {param_type}")

    return resolved
