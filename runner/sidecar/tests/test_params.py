import pytest

from app.run_spec import render_command
from cpg_runner.params import resolve_params
from support import make_tool


def _tool(tmp_path, **overrides):
    params = [
        {"name": "x", "param_type": "str", "required": True},
        {"name": "n", "param_type": "int", "default": 3},
        {"name": "ratio", "param_type": "float", "default": 1.5},
        {"name": "flag", "param_type": "bool", "default": False},
        {"name": "mode", "param_type": "enum", "options": ["a", "b"], "default": "a"},
        {
            "name": "extra",
            "param_type": "str",
            "visible_if_param": "flag",
            "visible_if_operator": "truthy",
        },
        {
            "name": "files",
            "param_type": "file",
            "multiple": True,
            "allowed_file_types": ["fasta"],
            "cpus_per_file": 2,
        },
    ]
    params = overrides.pop("params", params)
    return make_tool(params=params, **overrides)


def _fasta(tmp_path, name="seq.fasta", text=">a\nACGT\n"):
    path = tmp_path / name
    path.write_text(text)
    return path


def test_visibility_defaults_and_coercion(tmp_path):
    f1 = _fasta(tmp_path, "in1.fasta")
    f2 = _fasta(tmp_path, "in2.fasta")
    tool = _tool(tmp_path)
    submitted = {"x": "hello", "n": "4", "ratio": "2.5", "files": [str(f1), str(f2)]}
    resolved = resolve_params(tool, submitted, {})
    assert resolved["x"] == "hello"
    assert resolved["n"] == 4
    assert resolved["ratio"] == 2.5
    assert resolved["flag"] is False
    assert resolved["mode"] == "a"
    assert "extra" not in resolved
    assert resolved["files"] == ["in1.fasta", "in2.fasta"]


def test_visible_conditional_param_is_kept(tmp_path):
    tool = _tool(tmp_path)
    f1 = _fasta(tmp_path, "in1.fasta")
    resolved = resolve_params(
        tool, {"x": "hello", "flag": True, "extra": "kept", "files": [str(f1)]}, {}
    )
    assert resolved["extra"] == "kept"


def test_required_param_missing(tmp_path):
    tool = _tool(tmp_path)
    with pytest.raises(ValueError, match="Missing required parameter: x"):
        resolve_params(tool, {}, {})


def test_invalid_enum(tmp_path):
    tool = _tool(tmp_path)
    with pytest.raises(ValueError, match="Invalid value for parameter: mode"):
        resolve_params(tool, {"x": "hello", "mode": "z"}, {})


def test_duplicate_input_file_names(tmp_path):
    first = tmp_path / "one"
    second = tmp_path / "two"
    first.mkdir()
    second.mkdir()
    f1 = _fasta(first, "same.fasta")
    f2 = _fasta(second, "same.fasta")
    tool = _tool(tmp_path)
    with pytest.raises(ValueError, match="Duplicate input file name: same.fasta"):
        resolve_params(tool, {"x": "hello", "files": [str(f1), str(f2)]}, {})


def test_extension_filter(tmp_path):
    text = tmp_path / "notes.txt"
    text.write_text("hi")
    tool = _tool(tmp_path)
    with pytest.raises(ValueError, match="File type not allowed: notes.txt"):
        resolve_params(tool, {"x": "hello", "files": [str(text)]}, {})


def test_single_file_param_returns_a_string(tmp_path):
    tool = _tool(
        tmp_path,
        params=[
            {
                "name": "seq",
                "param_type": "file",
                "multiple": False,
                "allowed_file_types": ["fasta"],
            }
        ],
    )
    f1 = _fasta(tmp_path, "only.fasta")
    resolved = resolve_params(tool, {"seq": [str(f1)]}, {})
    assert resolved["seq"] == "only.fasta"


def test_command_golden_string_with_flatten_and_cpus(tmp_path):
    tool = _tool(
        tmp_path,
        command="python {{ x }} {{ files|flatten|join(' ') }}",
    )
    f1 = _fasta(tmp_path, "in1.fasta")
    f2 = _fasta(tmp_path, "in2.fasta")
    resolved = resolve_params(tool, {"x": "hello", "files": [str(f1), str(f2)]}, {})
    assert (
        render_command(tool.command, resolved, 3) == "python hello in1.fasta in2.fasta"
    )
    assert render_command("echo {{ cpus }}", {}, 4) == "echo 4"
