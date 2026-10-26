"""Sampling what a run is using, for the run page's profiler.

Readings come from psutil over the process tree the command itself runs, so the
sandbox's own runtime - apptainer's starter and the container's init, which are
Go programs with a handful of threads each - is not counted as the tool's
resource use. The worker takes one reading per interval and stores a handful of
numbers per reading: a run can be watched while it works, and its peaks are
still there afterwards.
"""

from dataclasses import dataclass

import psutil

# apptainer's own binaries, by executable path and by name: the starter that
# sets the container up and the init that runs inside it.
RUNTIME_NAMES = {"starter", "starter-suid", "appinit", "apptainer"}


@dataclass
class TreeReading:
    """What the tree used since the previous reading."""

    # CPU seconds (user plus system) spent across the tree.
    cpu_seconds: float
    rss_bytes: int
    processes: int
    threads: int
    read_bytes: int
    write_bytes: int


def is_runtime(process: psutil.Process) -> bool:
    """Whether this process is part of the sandbox's own plumbing."""
    try:
        with process.oneshot():
            name = process.name()
            executable = process.exe()
    except psutil.Error:
        return False
    return name in RUNTIME_NAMES or "apptainer" in executable


def command_root(root_pid: int) -> psutil.Process | None:
    """
    The process running the command, rather than the sandbox that launched it.

    `apptainer exec` starts a Go starter, which starts the container's init,
    which starts the command. Only the last of those is the run's own work.
    """
    try:
        process = psutil.Process(root_pid)
    except psutil.Error:
        return None
    while is_runtime(process):
        try:
            children = process.children()
        except psutil.Error:
            return None
        if not children:
            break
        process = children[0]
    return process


def read_tree(root_pid: int, seen: dict[int, float]) -> TreeReading | None:
    """
    Take one reading of the tree the command runs in, under `root_pid`.

    `seen` holds the CPU seconds each process had at the previous reading, which
    is what turns two readings into a percentage. It is updated in place, and
    processes that have exited are forgotten.

    Returns None once the tree is gone.
    """
    root = command_root(root_pid)
    if root is None:
        return None
    try:
        processes = [root, *root.children(recursive=True)]
    except psutil.Error:
        return None

    cpu_seconds = 0.0
    rss_bytes = 0
    threads = 0
    read_bytes = 0
    write_bytes = 0
    current: dict[int, float] = {}

    for process in processes:
        try:
            with process.oneshot():
                times = process.cpu_times()
                spent = times.user + times.system
                rss_bytes += process.memory_info().rss
                threads += process.num_threads()
                try:
                    io = process.io_counters()
                except (psutil.Error, AttributeError):
                    io = None
                if io is not None:
                    read_bytes += io.read_bytes
                    write_bytes += io.write_bytes
        except psutil.Error:
            # The process may exit between listing it and reading it.
            continue

        current[process.pid] = spent
        previous = seen.get(process.pid)
        if previous is not None and spent >= previous:
            cpu_seconds += spent - previous

    seen.clear()
    seen.update(current)

    return TreeReading(
        cpu_seconds=cpu_seconds,
        rss_bytes=rss_bytes,
        processes=len(current),
        threads=threads,
        read_bytes=read_bytes,
        write_bytes=write_bytes,
    )
