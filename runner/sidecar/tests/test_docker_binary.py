import subprocess

from cpg_runner.docker_cli import Docker, docker_candidates, resolve_docker_binary


def test_path_wins_when_the_cli_is_on_it():
    resolved = resolve_docker_binary(
        which=lambda name: "/opt/bin/docker",
        exists=lambda path: False,
        env={},
    )
    assert resolved == "/opt/bin/docker"


def test_docker_desktop_location_is_used_when_path_is_empty():
    first = docker_candidates("darwin")[0]
    resolved = resolve_docker_binary(
        which=lambda name: None,
        exists=lambda path: path == first,
        env={},
    )
    assert resolved == str(first)


def test_configured_path_is_used_as_given():
    resolved = resolve_docker_binary(
        which=lambda name: None,
        exists=lambda path: False,
        env={"DOCKER_BIN": "/custom/docker"},
    )
    assert resolved == "/custom/docker"


def test_configured_name_is_looked_up():
    resolved = resolve_docker_binary(
        which=lambda name: "/usr/local/bin/podman" if name == "podman" else None,
        exists=lambda path: False,
        env={"DOCKER_BIN": "podman"},
    )
    assert resolved == "/usr/local/bin/podman"


def test_falls_back_to_the_configured_name():
    resolved = resolve_docker_binary(
        which=lambda name: None,
        exists=lambda path: False,
        env={},
    )
    assert resolved == "docker"


def test_windows_candidates_end_in_docker_exe():
    candidates = docker_candidates("win32")
    assert candidates
    assert all(str(candidate).endswith("docker.exe") for candidate in candidates)


def test_image_presence_is_asked_once_per_second():
    """One page load asks several times; the docker CLI should run once."""
    calls = []

    def runner(argv, **kwargs):
        calls.append(argv)
        return subprocess.CompletedProcess(
            args=argv, returncode=1, stdout="", stderr=""
        )

    docker = Docker(binary="docker", runner=runner)

    assert docker.image_present("tag") is False
    assert docker.image_present("tag") is False
    assert docker.image_present("tag") is False

    assert len(calls) == 1

    # Loading an image invalidates the answer.
    docker.forget()
    docker.image_present("tag")
    assert len(calls) == 2
