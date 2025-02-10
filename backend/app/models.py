import enum
import uuid
from datetime import datetime

from pydantic import EmailStr
from sqlalchemy.dialects.postgresql import JSONB as JSON
from sqlalchemy.orm import RelationshipProperty
from sqlmodel import (
    Column,
    Enum,
    Field,
    Relationship,
    SQLModel,
)


# Link tables for many-to-many relationships
class UserFavouriteToolsLink(SQLModel, table=True):
    user_id: uuid.UUID  | None = Field(default=None, foreign_key="user.id", primary_key=True)
    tool_id: uuid.UUID  | None = Field(default=None, foreign_key="tool.id", primary_key=True)

# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=40)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=40)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(UserBase):
    email: EmailStr | None = Field(default=None, max_length=255)  # type: ignore
    password: str | None = Field(default=None, min_length=8, max_length=40)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=40)
    new_password: str = Field(min_length=8, max_length=40)



# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    favourite_tools: list["Tool"] = Relationship(
        back_populates="favourited_by",
        link_model=UserFavouriteToolsLink
    )
    files: list["File"] = Relationship(back_populates="owner")
    runs: list["Run"] = Relationship(back_populates="owner")



# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int

# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str


class SetupFile(SQLModel):
    name: str
    content: str


class FileType(str, enum.Enum):
    text = "text"
    image = "image"
    csv = "csv"
    tsv = "tsv"
    json = "json"
    unknown = "unknown"


class Target(SQLModel):
    path: str
    target_type: FileType
    required: bool = True


class ParamType(str, enum.Enum):
    str = "str"
    int = "int"
    float = "float"
    bool = "bool"
    enum = "enum"
    file = "file"
    files = "files"

class Param(SQLModel):
    name: str
    param_type: ParamType
    description: str | None = None
    default: int | float | str | bool | None = None
    options: list[str] | None = None
    required: bool = False

class ToolStatus(str, enum.Enum):
    uninstalled = "uninstalled"
    uninstalling = "uninstalling"
    installed = "installed"
    installing = "installing"
    failed = "failed"


class CondaEnvPipDependency(SQLModel):
    pip: list[str]

class CondaEnv(SQLModel):
    channels: list[str] = Field(default_factory=list)
    dependencies: list[str | CondaEnvPipDependency] = Field(default_factory=list)

class ToolBadge(SQLModel):
    badge: str | None = None
    url: str | None = None

# Shared properties
class ToolBase(SQLModel):
    name: str
    version: str | None = None
    image: str | None = None
    description: str | None = None
    url: str | None = None
    github_repo: str | None = None # :name/:repo
    docs_url: str | None = None
    paper_doi: str | None = None
    license: str | None = None
    citation_markdown: str | None = None
    badges: list[ToolBadge] | None = None
    tags: list[str] | None = None
    command: str
    conda_env: CondaEnv | None = None # dependencies: [python=3.9, bokeh=2.4.2, conda-forge::numpy=1.21.*, nodejs=16.13.*, flask, pip, {pip: [Flask-Testing]}]
    post_install: str | None = None  # command -v hello-world >/dev/null 2>&1 || snk install wytamma/hello-world
    setup_files: list[SetupFile] | None = None
    params: list[Param] | None = None
    targets: list[Target] | None = None

# Properties to receive on Tool creation
class ToolCreate(ToolBase):
    name: str

# Properties to receive on Tool update
class ToolUpdate(ToolBase):
    favourited_count: int = 0
    run_count: int = 0
    enabled: bool = False
    name: str | None = None  # type: ignore
    command: str | None = None
    status: ToolStatus | None = None

# Database model, database table inferred from class name
class Tool(ToolBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True, unique=True)
    badges: list[ToolBadge] | None = Field(default_factory=list, sa_column=Column(JSON))
    favourited_count: int = 0
    run_count: int = 0
    enabled: bool = False
    tags: list[str] | None = Field(default_factory=list, sa_column=Column(JSON))
    status: ToolStatus = Field(default=ToolStatus.uninstalled, sa_column=Column(Enum(ToolStatus)))
    installation_log: str | None = None
    conda_env: CondaEnv | None = Field(default=None, sa_column=Column(JSON))
    conda_env_pinned: str | None = None
    setup_files: list[SetupFile] | None = Field(default_factory=list, sa_column=Column(JSON))
    params: list[Param] | None = Field(default_factory=list, sa_column=Column(JSON))
    targets: list[Target] | None = Field(default_factory=list, sa_column=Column(JSON))
    runs: list["Run"] = Relationship(
        back_populates="tool",
        sa_relationship=RelationshipProperty(
            "Run", cascade="all, delete, delete-orphan"
        )
    )
    favourited_by: list[User] = Relationship(
        back_populates="favourite_tools", link_model=UserFavouriteToolsLink
    )
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)


# Properties to return via API, id is always required
class ToolPublic(ToolBase):
    favourited: bool = False
    status: ToolStatus
    installation_log: str | None = None
    favourited_count: int = 0
    run_count: int = 0
    enabled: bool = False
    conda_env_pinned: str | None = None
    id: uuid.UUID

class ToolMinimalPublic(SQLModel):
    id: uuid.UUID
    name: str
    image: str | None = None
    description: str | None = None
    tags: list[str] | None = None
    params: list[Param] | None = None
    favourited: bool = False
    favourited_count: int = 0
    run_count: int = 0
    enabled: bool = False

class ToolsPublic(SQLModel):
    data: list[ToolMinimalPublic]
    count: int

class RunStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class RunBase(SQLModel):
    taskiq_id: str
    status: RunStatus
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class Run(RunBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    taskiq_id: str | None = None
    status: RunStatus = Field(sa_column=Column(Enum(RunStatus)))
    tags: list[str] | None = Field(default_factory=list, sa_column=Column(JSON))
    params: dict = Field(default_factory=dict, sa_column=Column(JSON))
    files: list["File"] = Relationship(
        back_populates="run",
        sa_relationship=RelationshipProperty(
            "File", cascade="all, delete, delete-orphan"
        ),
    )
    command: str | None = None
    conda_env_pinned: str | None = None
    stderr: str | None = None
    stdout: str | None = None
    tool_id: uuid.UUID = Field(foreign_key="tool.id", nullable=False)
    tool: Tool = Relationship(back_populates="runs")
    owner_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    owner: User = Relationship(back_populates="runs")
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    started_at: datetime | None = Field(default=None, nullable=True)
    finished_at: datetime | None = Field(default=None, nullable=True)


class RunPublicMinimal(SQLModel):
    id: uuid.UUID
    tool: ToolMinimalPublic
    params: dict
    status: RunStatus
    tags: list[str] | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None


class FileBase(SQLModel):
    name: str
    file_type: FileType | None = None
    size: int | None = None
    saved: bool = False
    tags: list[str] | None = None


class File(FileBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    file_type: FileType | None = Field(sa_column=Column(Enum(FileType)))
    location: str
    tags: list[str] | None = Field(default_factory=list, sa_column=Column(JSON))
    owner_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    owner: "User" = Relationship(back_populates="files")
    run_id: uuid.UUID = Field(foreign_key="run.id", nullable=True)
    run: "Run" = Relationship(back_populates="files")
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)


class FilePublic(FileBase):
    id: uuid.UUID
    run_id: uuid.UUID | None = None
    created_at: datetime


class FilesPublic(SQLModel):
    data: list[FilePublic]
    count: int

class FilesStatistics(SQLModel):
    count: int
    total_size: int

class RunPublic(RunPublicMinimal):
    stderr: str | None = None
    stdout: str | None = None
    command: str | None = None
    conda_env_pinned: str | None = None
    params: dict
    files: list[FilePublic]


class RunsPublicMinimal(SQLModel):
    data: list[RunPublicMinimal]
    count: int
