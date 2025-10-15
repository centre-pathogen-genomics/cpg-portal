import asyncio
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Optional

import yaml


class CondaEnvMangerError(Exception):
    pass

class CondaEnvMangerInstallError(CondaEnvMangerError):
    pass

class CondaEnvMangerRemoveError(CondaEnvMangerError):
    pass

class CondaEnvManger:
    """Conda environment"""

    def __init__(self, path: Path, env_dict: dict, post_install_command: str = None, version: str | None = None):
        self.env_dict = env_dict
        self.post_install_command = post_install_command
        self.path = path
        self.activate_command = f"source /opt/conda/bin/activate '{self.path}'"
        self.version = version

    @property
    def is_created(self):
        return self.path.exists()

    @property
    def env_yaml_str(self) -> str:
        yaml_str = yaml.dump(self.env_dict, default_flow_style=False)
        if self.version:
            yaml_str = self.format_with_version(yaml_str)
        return yaml_str

    def format_with_version(self, s: str) -> str:
        if not self.version:
            return s
        return s.replace("{{version}}", self.version).replace("{{ version }}", self.version)

    async def _run_command(self, cmd, cwd=None):
        proc = await asyncio.create_subprocess_shell(
            cmd,
            cwd=cwd,
            shell=True,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            executable="/bin/bash",
        )
        stdout, _ = await proc.communicate()
        return proc.returncode, stdout.decode().strip()

    async def _run_post_install(self):
        command = f"{self.activate_command}; {self.format_with_version(self.post_install_command)}"
        returncode, stdout = await self._run_command(command, cwd=self.path)
        if returncode != 0:
            raise CondaEnvMangerInstallError(stdout)
        return stdout

    async def create(self):
        with NamedTemporaryFile(suffix=".yaml") as tmp:
            tmp.write(self.env_yaml_str.encode())
            tmp.flush()  # Ensure all data is written before the file is used.
            print(f"Environment file path: {tmp.name}")
            print(f"Environment file content:\n{self.env_yaml_str}")
            command = f"mamba env create --yes --quiet -f {tmp.name} -p {self.path}"
            returncode, stdout = await self._run_command(command)
            if returncode != 0:
                raise CondaEnvMangerInstallError(stdout)
            if self.post_install_command:
                try:
                    post_instal_stdout = await self._run_post_install()
                    post_instal_stdout = f"\n--- POST INSTALL ---\n{post_instal_stdout}"
                    if stdout is not None:
                        stdout += post_instal_stdout
                    else:
                        stdout = post_instal_stdout
                except CondaEnvMangerInstallError as e:
                    print(f"Failed to run post install command: {e}")
                    await self.remove()
                    raise e
        return stdout

    async def remove(self) -> None:
        if not self.path.exists():
            raise CondaEnvMangerRemoveError(f"Conda environment '{self.path}' does not exist")
        command = f"conda env remove --yes -p {self.path}"
        returncode, stdout = await self._run_command(command)
        if returncode != 0:
            raise CondaEnvMangerRemoveError(stdout)

    async def pin(self) -> str:
        if not self.path.exists():
            raise CondaEnvMangerError(f"Conda environment '{self.path}' does not exist")
        command = f"conda env export -p {self.path} --no-builds"
        returncode, stdout = await self._run_command(command)
        if returncode != 0:
            raise CondaEnvMangerError(stdout)
        return stdout
