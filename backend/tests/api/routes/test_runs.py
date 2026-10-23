import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from sqlmodel import Session

from app.api.routes.runs import create_run, delete_runs, read_run_tool_names, read_runs
from app.core.file_types import FileTypeEnum
from app.models import File, Run, RunStatus, Tool, ToolStatus, User
from tests.utils.user import create_random_user
from tests.utils.utils import random_lower_string


def _utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _create_tool(*, db: Session, owner: User) -> Tool:
    tool = Tool(
        name=f"tool-{random_lower_string()}",
        command="echo hello",
        enabled=True,
        status=ToolStatus.installed,
        owner_id=owner.id,
    )
    db.add(tool)
    db.commit()
    db.refresh(tool)
    return tool


def _create_run(
    *,
    db: Session,
    owner: User,
    tool: Tool,
    name: str,
    status: RunStatus,
    created_at: datetime,
    finished_at: datetime | None = None,
) -> Run:
    run = Run(
        name=name,
        status=status,
        created_at=created_at,
        started_at=created_at,
        finished_at=finished_at,
        params={},
        tool_id=tool.id,
        owner_id=owner.id,
    )
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


def _create_saved_file(
    *,
    db: Session,
    owner: User,
    name: str,
    file_type: str = "fastq.gz",
    parent_id=None,
) -> File:
    file = File(
        name=name,
        file_type=file_type,
        size=10,
        saved=True,
        location=f"/tmp/{name}",
        owner_id=owner.id,
        parent_id=parent_id,
    )
    db.add(file)
    db.commit()
    db.refresh(file)
    return file


async def _fake_broadcast(*args, **kwargs):  # noqa: ANN002, ANN003, ARG001
    return None


async def _fake_kiq(*args, **kwargs):  # noqa: ANN002, ANN003, ARG001
    return SimpleNamespace(task_id="task-id")


def test_read_runs_filters_by_name_and_sorts(db: Session) -> None:
    owner = create_random_user(db)
    tool = _create_tool(db=db, owner=owner)
    prefix = random_lower_string()

    older = _create_run(
        db=db,
        owner=owner,
        tool=tool,
        name=f"{prefix}-beta",
        status=RunStatus.completed,
        created_at=_utc_now() - timedelta(days=1),
    )
    newer = _create_run(
        db=db,
        owner=owner,
        tool=tool,
        name=f"{prefix}-alpha",
        status=RunStatus.failed,
        created_at=_utc_now(),
    )
    _create_run(
        db=db,
        owner=owner,
        tool=tool,
        name=f"{prefix}-unmatched",
        status=RunStatus.pending,
        created_at=_utc_now(),
    )

    result = read_runs(
        session=db,
        current_user=owner,
        name=prefix.upper(),
        order_by="name",
        tool_name=None,
        statuses=None,
    )

    assert result.count == 3
    assert [item.id for item in result.data[:2]] == [newer.id, older.id]


def test_read_runs_rejects_unknown_sort_column(db: Session) -> None:
    owner = create_random_user(db)

    with pytest.raises(HTTPException) as exc_info:
        read_runs(
            session=db,
            current_user=owner,
            order_by="owner_id",
            name=None,
            tool_name=None,
            statuses=None,
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid column name: owner_id"


def test_read_runs_sorts_by_runtime(db: Session) -> None:
    owner = create_random_user(db)
    tool = _create_tool(db=db, owner=owner)
    started_at = _utc_now() - timedelta(hours=2)
    shorter = _create_run(
        db=db,
        owner=owner,
        tool=tool,
        name=f"short-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=started_at,
        finished_at=started_at + timedelta(minutes=5),
    )
    longer = _create_run(
        db=db,
        owner=owner,
        tool=tool,
        name=f"long-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=started_at,
        finished_at=started_at + timedelta(minutes=30),
    )

    result = read_runs(
        session=db,
        current_user=owner,
        order_by="-runtime",
        name=None,
        tool_name=None,
        statuses=None,
    )

    assert [item.id for item in result.data[:2]] == [longer.id, shorter.id]


def test_read_runs_filters_by_tool_name(db: Session) -> None:
    owner = create_random_user(db)
    selected_tool = _create_tool(db=db, owner=owner)
    other_tool = _create_tool(db=db, owner=owner)

    matching = _create_run(
        db=db,
        owner=owner,
        tool=selected_tool,
        name=f"matching-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=_utc_now(),
    )
    _create_run(
        db=db,
        owner=owner,
        tool=other_tool,
        name=f"other-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=_utc_now(),
    )

    result = read_runs(
        session=db,
        current_user=owner,
        order_by="-created_at",
        name=None,
        tool_name=selected_tool.name,
        statuses=None,
    )

    assert result.count == 1
    assert result.data[0].id == matching.id


def test_read_runs_filters_by_statuses(db: Session) -> None:
    owner = create_random_user(db)
    tool = _create_tool(db=db, owner=owner)
    completed = _create_run(
        db=db,
        owner=owner,
        tool=tool,
        name=f"completed-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=_utc_now(),
    )
    _create_run(
        db=db,
        owner=owner,
        tool=tool,
        name=f"running-{random_lower_string()}",
        status=RunStatus.running,
        created_at=_utc_now(),
    )

    result = read_runs(
        session=db,
        current_user=owner,
        order_by="-created_at",
        name=None,
        tool_name=None,
        statuses=[RunStatus.completed],
    )

    assert result.count == 1
    assert result.data[0].id == completed.id


def test_delete_runs_filters_by_name_and_tool(db: Session) -> None:
    owner = create_random_user(db)
    selected_tool = _create_tool(db=db, owner=owner)
    other_tool = _create_tool(db=db, owner=owner)
    prefix = random_lower_string()
    matching = _create_run(
        db=db,
        owner=owner,
        tool=selected_tool,
        name=f"{prefix}-matching",
        status=RunStatus.completed,
        created_at=_utc_now(),
    )
    unmatched_name = _create_run(
        db=db,
        owner=owner,
        tool=selected_tool,
        name=f"other-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=_utc_now(),
    )
    unmatched_tool = _create_run(
        db=db,
        owner=owner,
        tool=other_tool,
        name=f"{prefix}-other-tool",
        status=RunStatus.completed,
        created_at=_utc_now(),
    )
    active = _create_run(
        db=db,
        owner=owner,
        tool=selected_tool,
        name=f"{prefix}-active",
        status=RunStatus.running,
        created_at=_utc_now(),
    )

    delete_runs(
        session=db,
        current_user=owner,
        name=prefix,
        tool_name=selected_tool.name,
        ids=None,
    )

    assert db.get(Run, matching.id) is None
    assert db.get(Run, unmatched_name.id) is not None
    assert db.get(Run, unmatched_tool.id) is not None
    assert db.get(Run, active.id) is not None


def test_delete_runs_filters_by_ids(db: Session) -> None:
    owner = create_random_user(db)
    tool = _create_tool(db=db, owner=owner)
    visible = _create_run(
        db=db,
        owner=owner,
        tool=tool,
        name=f"visible-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=_utc_now(),
    )
    hidden = _create_run(
        db=db,
        owner=owner,
        tool=tool,
        name=f"hidden-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=_utc_now(),
    )
    active = _create_run(
        db=db,
        owner=owner,
        tool=tool,
        name=f"active-{random_lower_string()}",
        status=RunStatus.running,
        created_at=_utc_now(),
    )

    delete_runs(
        session=db,
        current_user=owner,
        ids=[visible.id, active.id],
        name=None,
        tool_name=None,
    )

    assert db.get(Run, visible.id) is None
    assert db.get(Run, hidden.id) is not None
    assert db.get(Run, active.id) is not None


def test_read_run_tool_names_includes_only_current_users_run_tools(db: Session) -> None:
    owner = create_random_user(db)
    other_user = create_random_user(db)
    used_tool = _create_tool(db=db, owner=owner)
    unused_tool = _create_tool(db=db, owner=owner)
    other_users_tool = _create_tool(db=db, owner=other_user)

    _create_run(
        db=db,
        owner=owner,
        tool=used_tool,
        name=f"used-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=_utc_now(),
    )
    _create_run(
        db=db,
        owner=other_user,
        tool=other_users_tool,
        name=f"other-user-{random_lower_string()}",
        status=RunStatus.completed,
        created_at=_utc_now(),
    )

    tool_names = read_run_tool_names(session=db, current_user=owner)

    assert used_tool.name in tool_names
    assert unused_tool.name not in tool_names
    assert other_users_tool.name not in tool_names


def test_create_run_rejects_required_empty_values(db: Session) -> None:
    owner = create_random_user(db)
    tool = _create_tool(db=db, owner=owner)
    tool.params = [{"name": "sample", "param_type": "str", "required": True}]
    db.add(tool)
    db.commit()
    db.refresh(tool)

    for empty_value in ["", "   ", []]:
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                create_run(
                    session=db,
                    current_user=owner,
                    tool_id=tool.id,
                    params={"sample": empty_value},
                    tags=[],
                )
            )

        assert exc_info.value.status_code == 400
        assert exc_info.value.detail == "Missing required parameter: sample"


def test_create_run_rejects_path_traversal_params(db: Session) -> None:
    owner = create_random_user(db)
    tool = _create_tool(db=db, owner=owner)
    tool.params = [{"name": "output_file", "param_type": "str", "required": True}]
    db.add(tool)
    db.commit()
    db.refresh(tool)

    bad_params = [
        {"output_file": "../../../../../../etc/passwd"},
        {"output_file": "sub/out.txt"},
        {"output_file": ".."},
        {"output_file": "..\\out.txt"},
        # undeclared params are validated too
        {"output_file": "ok.txt", "undeclared": "../secret"},
    ]
    for params in bad_params:
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                create_run(
                    session=db,
                    current_user=owner,
                    tool_id=tool.id,
                    params=params,
                    tags=[],
                )
            )
        assert exc_info.value.status_code == 400
        assert "not allowed" in exc_info.value.detail


def test_create_run_allows_slashes_in_enum_values(db: Session) -> None:
    owner = create_random_user(db)
    tool = _create_tool(db=db, owner=owner)
    tool.params = [
        {
            "name": "scheme_name",
            "param_type": "enum",
            "required": True,
            "options": ["artic-sars-cov-2/400/v4.0.0"],
        },
        {"name": "label", "param_type": "str"},
    ]
    db.add(tool)
    db.commit()
    db.refresh(tool)

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)
    try:
        run = asyncio.run(
            create_run(
                session=db,
                current_user=owner,
                tool_id=tool.id,
                params={"scheme_name": "artic-sars-cov-2/400/v4.0.0", "label": "ok"},
                tags=[],
            )
        )
    finally:
        monkeypatch.undo()

    assert run.params["scheme_name"] == "artic-sars-cov-2/400/v4.0.0"


def test_process_targets_ignores_files_outside_tmp_dir(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app import tasks

    tmp_dir = tmp_path / "run"
    tmp_dir.mkdir()
    (tmp_dir / "out.txt").write_text("ok")
    (tmp_path / "secret.txt").write_text("secret")

    saved: list[str] = []

    def _fake_save_file(*, name, **kwargs):  # noqa: ANN003, ARG001
        saved.append(name)
        return SimpleNamespace(name=name)

    monkeypatch.setattr(tasks, "save_file", _fake_save_file)

    def _run(target_path: str, params: dict, *, required: bool = False):
        return SimpleNamespace(
            tool=SimpleNamespace(
                targets=[
                    {
                        "path": target_path,
                        "target_type": "txt",
                        "required": required,
                    }
                ]
            ),
            params=params,
            stdout="",
            files=[],
            owner_id=None,
            tags=[],
        )

    # param value is escaped before rendering, so `..` segments can't survive
    tasks.process_targets(
        None, _run("{{ output_file }}", {"output_file": "../secret.txt"}), tmp_dir
    )
    assert saved == []

    # a pattern that itself escapes the run dir is filtered out by containment
    tasks.process_targets(None, _run("../secret.txt", {}), tmp_dir)
    assert saved == []

    # normal matches inside the run dir still work
    tasks.process_targets(
        None, _run("{{ output_file }}", {"output_file": "out.txt"}), tmp_dir
    )
    assert saved == ["out.txt"]


def test_create_run_skips_hidden_params(db: Session) -> None:
    owner = create_random_user(db)
    tool = _create_tool(db=db, owner=owner)
    tool.params = [
        {"name": "enable_extra", "param_type": "bool", "required": True},
        {
            "name": "extra",
            "param_type": "str",
            "required": True,
            "visible_if_param": "enable_extra",
            "visible_if_operator": "equals",
            "visible_if_value": True,
        },
    ]
    db.add(tool)
    db.commit()
    db.refresh(tool)

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)
    try:
        run = asyncio.run(
            create_run(
                session=db,
                current_user=owner,
                tool_id=tool.id,
                params={"enable_extra": False, "extra": "ignored"},
                tags=[],
            )
        )
    finally:
        monkeypatch.undo()

    assert run.params == {"enable_extra": False}


def test_create_run_requires_visible_conditional_param(db: Session) -> None:
    owner = create_random_user(db)
    tool = _create_tool(db=db, owner=owner)
    tool.params = [
        {"name": "enable_extra", "param_type": "bool", "required": True},
        {
            "name": "extra",
            "param_type": "str",
            "required": True,
            "visible_if_param": "enable_extra",
            "visible_if_operator": "equals",
            "visible_if_value": True,
        },
    ]
    db.add(tool)
    db.commit()
    db.refresh(tool)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            create_run(
                session=db,
                current_user=owner,
                tool_id=tool.id,
                params={"enable_extra": True},
                tags=[],
            )
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Missing required parameter: extra"


def test_create_run_flattens_group_children_when_pairs_are_allowed(
    monkeypatch: pytest.MonkeyPatch, db: Session
) -> None:
    owner = create_random_user(db)
    tool = _create_tool(db=db, owner=owner)
    tool.params = [
        {
            "name": "reads",
            "param_type": "file",
            "allowed_file_types": [FileTypeEnum.PAIR.value, "fastq.gz"],
            "multiple": True,
            "required": True,
        }
    ]
    db.add(tool)
    db.commit()
    db.refresh(tool)

    group = _create_saved_file(
        db=db, owner=owner, name=f"group-{random_lower_string()}"
    )
    group.is_group = True
    _create_saved_file(db=db, owner=owner, name="sample-a.fastq.gz", parent_id=group.id)
    _create_saved_file(db=db, owner=owner, name="sample-b.fastq.gz", parent_id=group.id)
    db.add(group)
    db.commit()
    db.refresh(group)

    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)

    run = asyncio.run(
        create_run(
            session=db,
            current_user=owner,
            tool_id=tool.id,
            params={"reads": [str(group.id)]},
            tags=[],
        )
    )

    assert run.params["reads"] == ["sample-a.fastq.gz", "sample-b.fastq.gz"]


def test_create_run_preserves_pair_children_when_pairs_are_allowed(
    monkeypatch: pytest.MonkeyPatch, db: Session
) -> None:
    owner = create_random_user(db)
    tool = _create_tool(db=db, owner=owner)
    tool.params = [
        {
            "name": "reads",
            "param_type": "file",
            "allowed_file_types": [FileTypeEnum.PAIR.value, "fastq.gz"],
            "multiple": True,
            "required": True,
        }
    ]
    db.add(tool)
    db.commit()
    db.refresh(tool)

    forward = _create_saved_file(db=db, owner=owner, name="sample_R1.fastq.gz")
    reverse = _create_saved_file(db=db, owner=owner, name="sample_R2.fastq.gz")
    pair = File(
        name="sample",
        file_type=FileTypeEnum.PAIR.value,
        size=20,
        saved=True,
        location=None,
        owner_id=owner.id,
        children=[forward, reverse],
    )
    db.add(pair)
    db.commit()
    db.refresh(pair)

    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)

    run = asyncio.run(
        create_run(
            session=db,
            current_user=owner,
            tool_id=tool.id,
            params={"reads": [str(pair.id)]},
            tags=[],
        )
    )

    assert run.params["reads"] == [["sample_R1.fastq.gz", "sample_R2.fastq.gz"]]


async def _fake_broadcast(*args, **kwargs):  # noqa: ANN002, ANN003, ARG001
    return None


def _tool_with_threads(
    db: Session,
    owner: User,
    *,
    min_cpus: int = 1,
    max_cpus: int | None = None,
    default_cpus: int | None = None,
) -> Tool:
    tool = _create_tool(db=db, owner=owner)
    tool.min_cpus = min_cpus
    tool.max_cpus = max_cpus
    tool.default_cpus = default_cpus
    db.add(tool)
    db.commit()
    db.refresh(tool)
    return tool


def test_create_run_validates_threads(db: Session, monkeypatch) -> None:
    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)
    owner = create_random_user(db)
    owner.max_cpus = 4
    db.add(owner)
    db.commit()
    tool = _tool_with_threads(db, owner, max_cpus=8, default_cpus=2)

    # The user's own limit (4) caps the tool's limit (8).
    run = asyncio.run(
        create_run(
            session=db,
            current_user=owner,
            tool_id=tool.id,
            params={},
            tags=[],
            cpus=4,
        )
    )
    assert run.cpus == 4

    # One thread is always allowed, above the user's limit is not.
    one = asyncio.run(
        create_run(
            session=db,
            current_user=owner,
            tool_id=tool.id,
            params={},
            tags=[],
            cpus=1,
        )
    )
    assert one.cpus == 1

    for cpus in (0, 5):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                create_run(
                    session=db,
                    current_user=owner,
                    tool_id=tool.id,
                    params={},
                    tags=[],
                    cpus=cpus,
                )
            )
        assert exc_info.value.status_code == 400
        assert "between 1 and 4" in exc_info.value.detail


def test_create_run_defaults_threads_to_the_tool_default(
    db: Session, monkeypatch
) -> None:
    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)
    owner = create_random_user(db)
    tool = _tool_with_threads(db, owner, max_cpus=3, default_cpus=3)

    run = asyncio.run(
        create_run(
            session=db,
            current_user=owner,
            tool_id=tool.id,
            params={},
            tags=[],
        )
    )

    assert run.cpus == 3


def test_create_run_threads_when_the_user_limit_is_below_the_tool(
    db: Session, monkeypatch
) -> None:
    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)
    owner = create_random_user(db)
    owner.max_cpus = 2
    db.add(owner)
    db.commit()
    tool = _tool_with_threads(db, owner, max_cpus=16, default_cpus=4)

    # The tool's default is clamped to what the user may use.
    defaulted = asyncio.run(
        create_run(
            session=db,
            current_user=owner,
            tool_id=tool.id,
            params={},
            tags=[],
        )
    )
    assert defaulted.cpus == 2

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            create_run(
                session=db,
                current_user=owner,
                tool_id=tool.id,
                params={},
                tags=[],
                cpus=4,
            )
        )

    assert exc_info.value.status_code == 400
    assert "between 1 and 2" in exc_info.value.detail


def test_create_run_keeps_threads_at_least_the_tool_minimum(
    db: Session, monkeypatch
) -> None:
    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)
    owner = create_random_user(db)
    owner.max_cpus = 8
    db.add(owner)
    db.commit()
    # A tool that needs at least four threads, for instance because its command
    # hardcodes them.
    tool = _tool_with_threads(db, owner, min_cpus=4, max_cpus=8, default_cpus=6)

    defaulted = asyncio.run(
        create_run(
            session=db,
            current_user=owner,
            tool_id=tool.id,
            params={},
            tags=[],
        )
    )
    assert defaulted.cpus == 6

    at_the_minimum = asyncio.run(
        create_run(
            session=db,
            current_user=owner,
            tool_id=tool.id,
            params={},
            tags=[],
            cpus=4,
        )
    )
    assert at_the_minimum.cpus == 4

    for cpus in (1, 3, 9):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(
                create_run(
                    session=db,
                    current_user=owner,
                    tool_id=tool.id,
                    params={},
                    tags=[],
                    cpus=cpus,
                )
            )
        assert exc_info.value.status_code == 400
        assert "between 4 and 8" in exc_info.value.detail


def test_create_run_without_a_tool_maximum_or_default(
    db: Session, monkeypatch
) -> None:
    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)
    owner = create_random_user(db)
    owner.max_cpus = 3
    db.add(owner)
    db.commit()
    # A tool that leaves the maximum out does not care how many threads a run
    # takes, so the user's own limit is the maximum, and one that leaves the
    # default out starts at its minimum.
    tool = _tool_with_threads(db, owner, min_cpus=1)

    defaulted = asyncio.run(
        create_run(
            session=db, current_user=owner, tool_id=tool.id, params={}, tags=[]
        )
    )
    assert defaulted.cpus == 1

    at_the_top = asyncio.run(
        create_run(
            session=db,
            current_user=owner,
            tool_id=tool.id,
            params={},
            tags=[],
            cpus=owner.max_cpus,
        )
    )
    assert at_the_top.cpus == 3

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            create_run(
                session=db,
                current_user=owner,
                tool_id=tool.id,
                params={},
                tags=[],
                cpus=4,
            )
        )
    assert exc_info.value.status_code == 400
    assert "between 1 and 3" in exc_info.value.detail

    # A minimum without a maximum behaves the same way.
    tool_with_minimum = _tool_with_threads(db, owner, min_cpus=2)

    defaulted_to_the_minimum = asyncio.run(
        create_run(
            session=db,
            current_user=owner,
            tool_id=tool_with_minimum.id,
            params={},
            tags=[],
        )
    )
    assert defaulted_to_the_minimum.cpus == 2

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            create_run(
                session=db,
                current_user=owner,
                tool_id=tool_with_minimum.id,
                params={},
                tags=[],
                cpus=1,
            )
        )
    assert exc_info.value.status_code == 400
    assert "between 2 and 3" in exc_info.value.detail


def test_create_run_defaults_threads_to_the_input_files(
    db: Session, monkeypatch
) -> None:
    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)
    owner = create_random_user(db)
    owner.max_cpus = 4
    db.add(owner)
    db.commit()
    tool = _create_tool(db=db, owner=owner)
    tool.params = [{"name": "file", "param_type": "file", "multiple": True}]
    db.add(tool)
    db.commit()
    files = [
        _create_saved_file(db=db, owner=owner, name=f"sample_{index}.fastq.gz")
        for index in range(3)
    ]

    def run_with(files_for_run: list[File]):
        return asyncio.run(
            create_run(
                session=db,
                current_user=owner,
                tool_id=tool.id,
                params={"file": [str(file.id) for file in files_for_run]},
                tags=[],
            )
        )

    # A tool that takes a batch of input files wants a thread per file.
    assert run_with(files).cpus == 3

    # The user's own limit still caps that.
    more_files = [
        _create_saved_file(db=db, owner=owner, name=f"extra_{index}.fastq.gz")
        for index in range(5)
    ]
    assert run_with(files + more_files).cpus == 4

    # Without input files the tool's minimum is the default.
    assert run_with([]).cpus == 1

    # A single-file param does not multiply anything.
    tool.params = [{"name": "file", "param_type": "file", "multiple": False}]
    db.add(tool)
    db.commit()
    assert run_with(files[:1]).cpus == 1


def test_create_run_scales_the_default_by_the_cpus_per_file(
    db: Session, monkeypatch
) -> None:
    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)
    owner = create_random_user(db)
    owner.max_cpus = 8
    db.add(owner)
    db.commit()
    tool = _create_tool(db=db, owner=owner)
    tool.params = [
        {
            "name": "file",
            "param_type": "file",
            "multiple": True,
            "cpus_per_file": 2,
        }
    ]
    db.add(tool)
    db.commit()
    files = [
        _create_saved_file(db=db, owner=owner, name=f"scaled_{index}.fastq.gz")
        for index in range(3)
    ]

    def run_with(files_for_run: list[File]):
        return asyncio.run(
            create_run(
                session=db,
                current_user=owner,
                tool_id=tool.id,
                params={"file": [str(file.id) for file in files_for_run]},
                tags=[],
            )
        )

    # Two CPUs per file and three files is six.
    assert run_with(files).cpus == 6

    # A default the tool names instead wins.
    tool.default_cpus = 2
    db.add(tool)
    db.commit()
    assert run_with(files).cpus == 2


def test_create_run_counts_groups_but_not_pairs(db: Session, monkeypatch) -> None:
    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)
    owner = create_random_user(db)
    owner.max_cpus = 8
    db.add(owner)
    db.commit()
    tool = _create_tool(db=db, owner=owner)
    tool.params = [{"name": "file", "param_type": "file", "multiple": True}]
    db.add(tool)
    db.commit()

    def make(container: str, *, is_group: bool, children: list[File]) -> File:
        file = File(
            name=container,
            file_type=FileTypeEnum.PAIR.value,
            size=20,
            saved=True,
            location=None,
            owner_id=owner.id,
            is_group=is_group,
            children=children,
        )
        db.add(file)
        db.commit()
        db.refresh(file)
        return file

    pair = make(
        "sample",
        is_group=False,
        children=[
            _create_saved_file(db=db, owner=owner, name="sample_R1.fastq.gz"),
            _create_saved_file(db=db, owner=owner, name="sample_R2.fastq.gz"),
        ],
    )
    group = make(
        "batch",
        is_group=True,
        children=[
            _create_saved_file(db=db, owner=owner, name="batch_1.fastq.gz"),
            _create_saved_file(db=db, owner=owner, name="batch_2.fastq.gz"),
        ],
    )

    def run_with(chosen: list[File]):
        return asyncio.run(
            create_run(
                session=db,
                current_user=owner,
                tool_id=tool.id,
                params={"file": [str(file.id) for file in chosen]},
                tags=[],
            )
        )

    # A pair is one unit of work even though it carries two files.
    assert run_with([pair]).cpus == 1

    # A group stands for the files it holds.
    assert run_with([group]).cpus == 2

    # And they add up: a pair, a group and a plain file.
    plain = _create_saved_file(db=db, owner=owner, name="single.fastq.gz")
    assert run_with([pair, group, plain]).cpus == 4


def test_create_run_skips_file_params_with_a_disabled_multiplier(
    db: Session, monkeypatch
) -> None:
    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)
    owner = create_random_user(db)
    owner.max_cpus = 8
    db.add(owner)
    db.commit()
    tool = _create_tool(db=db, owner=owner)
    # Two file parameters, but only the reference scales the default.
    tool.params = [
        {"name": "reads", "param_type": "file", "multiple": True, "cpus_per_file": 0},
        {
            "name": "reference",
            "param_type": "file",
            "multiple": True,
            "cpus_per_file": 2,
        },
    ]
    db.add(tool)
    db.commit()
    reads = [
        _create_saved_file(db=db, owner=owner, name=f"reads_{index}.fastq.gz")
        for index in range(3)
    ]
    references = [
        _create_saved_file(db=db, owner=owner, name=f"ref_{index}.fasta")
        for index in range(1)
    ]

    def run_with(chosen: dict):
        return asyncio.run(
            create_run(
                session=db,
                current_user=owner,
                tool_id=tool.id,
                params={
                    name: [str(file.id) for file in files]
                    for name, files in chosen.items()
                },
                tags=[],
            )
        )

    # Three reads do not count, one reference counts double.
    assert run_with({"reads": reads, "reference": references}).cpus == 2

    # With only the disabled parameter there is nothing to scale.
    assert run_with({"reads": reads}).cpus == 1


def test_create_run_threads_when_the_tool_minimum_is_above_the_user_limit(
    db: Session, monkeypatch
) -> None:
    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)
    owner = create_random_user(db)
    owner.max_cpus = 2
    db.add(owner)
    db.commit()
    tool = _tool_with_threads(db, owner, min_cpus=4, max_cpus=8, default_cpus=4)

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(
            create_run(
                session=db,
                current_user=owner,
                tool_id=tool.id,
                params={},
                tags=[],
            )
        )

    assert exc_info.value.status_code == 400
    assert "needs at least 4 threads" in exc_info.value.detail


def test_create_run_threads_of_an_admin_are_not_capped(
    db: Session, monkeypatch
) -> None:
    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)
    owner = create_random_user(db)
    owner.max_cpus = 2
    owner.is_superuser = True
    db.add(owner)
    db.commit()
    tool = _tool_with_threads(db, owner, max_cpus=8, default_cpus=4)

    run = asyncio.run(
        create_run(
            session=db,
            current_user=owner,
            tool_id=tool.id,
            params={},
            tags=[],
            cpus=8,
        )
    )

    assert run.cpus == 8


def test_create_run_names_unnamed_runs(db: Session, monkeypatch) -> None:
    monkeypatch.setattr("app.tasks.run_tool.kiq", _fake_kiq)
    monkeypatch.setattr("app.api.routes.runs.manager.broadcast", _fake_broadcast)
    owner = create_random_user(db)
    tool = _create_tool(db=db, owner=owner)
    today = datetime.now(UTC).strftime("%Y%m%d")

    def run(name: str | None = None):
        return asyncio.run(
            create_run(
                session=db,
                current_user=owner,
                tool_id=tool.id,
                params={},
                tags=[],
                name=name,
            )
        )

    assert run().name == f"{tool.name}-{today}-001"
    assert run().name == f"{tool.name}-{today}-002"
    # A blank name is a missing name, and a given name is kept as it is.
    assert run("   ").name == f"{tool.name}-{today}-003"
    assert run("my own name").name == "my own name"
