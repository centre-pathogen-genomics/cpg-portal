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


# Shared properties
class ToolBase(SQLModel):
    name: str
    description: str | None = None
    image: str | None = None
    tags: list[str] | None = None
    favourited_count: int = 0
    run_count: int = 0
    command: list[str]  # ["hello-world", "run", "{verbose_flag}", "--text", "{text}"]
    setup_command: str | None = None  # command -v hello-world >/dev/null 2>&1 || snk install wytamma/hello-world
    enabled: bool = False

# Properties to receive on Tool creation
class ToolCreate(ToolBase):
    name: str

# Properties to receive on Tool update
class ToolUpdate(ToolBase):
    name: str | None = None  # type: ignore
    command: list[str] | None = None

# Database model, database table inferred from class name
class Tool(ToolBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True, unique=True)
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    command: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    params: list["Param"] = Relationship(
        back_populates="tool",
        sa_relationship=RelationshipProperty(
            "Param", cascade="all, delete, delete-orphan"
        )
    )
    targets: list["Target"] = Relationship(
        back_populates="tool",
        sa_relationship=RelationshipProperty(
            "Target", cascade="all, delete, delete-orphan"
        )
    )
    runs: list["Run"] = Relationship(
        back_populates="tool",
        sa_relationship=RelationshipProperty(
            "Run", cascade="all, delete, delete-orphan"
        )
    )
    favourited_by: list[User] = Relationship(
        back_populates="favourite_tools", link_model=UserFavouriteToolsLink
    )


# Properties to return via API, id is always required
class ToolPublic(ToolBase):
    id: uuid.UUID
    favourited: bool = False


class ToolMinimalPublic(SQLModel):
    id: uuid.UUID
    name: str

class ToolsPublic(SQLModel):
    data: list[ToolPublic]
    count: int

class FileType(str, enum.Enum):
    text = "text"
    image = "image"
    csv = "csv"
    tsv = "tsv"
    json = "json"
    unknown = "unknown"


class TargetBase(SQLModel):
    path: str
    target_type: FileType
    required: bool = True


class TargetCreate(TargetBase):
    name: str

class TargetUpdate(TargetBase):
    path: str | None = None
    target_type: FileType | None = None

class Target(TargetBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    target_type: FileType = Field(sa_column=Column(Enum(FileType)))
    tool_id: uuid.UUID = Field(foreign_key="tool.id", nullable=False)
    tool: Tool = Relationship(back_populates="targets")


class TargetPublic(TargetBase):
    id: uuid.UUID
    tool_id: uuid.UUID

class ParamType(str, enum.Enum):
    str = "str"
    int = "int"
    float = "float"
    bool = "bool"
    enum = "enum"
    file = "file"

class ParamBase(SQLModel):
    name: str
    description: str | None = None
    param_type: ParamType
    default: int | float | str | bool
    options: list[str] | None = None
    flag: str | None = None
    required: bool = False


class ParamCreate(ParamBase):
    name: str

class ParamUpdate(ParamBase):
    name: str | None = None
    description: str | None = None
    param_type: ParamType | None = None
    default: int | float | str | bool | None = None
    required: bool | None = None


class Param(ParamBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    param_type: ParamType = Field(sa_column=Column(Enum(ParamType)))
    options: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    default: int | float | str | bool | None = Field(default=None, sa_column=Column(JSON))
    tool_id: uuid.UUID = Field(foreign_key="tool.id", nullable=False)
    tool: Tool = Relationship(back_populates="params")


class ParamPublic(ParamBase):
    id: uuid.UUID
    tool_id: uuid.UUID


class ToolCreateWithParamsAndTargets(ToolCreate):
    params: list[ParamCreate] = []
    targets: list[TargetCreate] = []


class ToolPublicWithParamsAndTargets(ToolPublic):
    params: list[ParamPublic]
    targets: list[TargetPublic]


class ToolsPublicWithParamsAndTargets(SQLModel):
    data: list[ToolPublicWithParamsAndTargets]
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
    params: dict = Field(default_factory=dict, sa_column=Column(JSON))
    files: list["File"] = Relationship(
        back_populates="run",
        sa_relationship=RelationshipProperty(
            "File", cascade="all, delete, delete-orphan"
        ),
    )
    command: str | None = None
    stderr: str | None = None
    stdout: str | None = None
    tool_id: uuid.UUID = Field(foreign_key="tool.id", nullable=False)
    tool: Tool = Relationship(back_populates="runs")
    owner_id: uuid.UUID = Field(foreign_key="user.id", nullable=False)
    owner: User = Relationship(back_populates="runs")
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    started_at: datetime | None = Field(default=None, nullable=True)
    finished_at: datetime | None = Field(default=None, nullable=True)


class RunPublicMinimal(RunBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    tool: ToolPublic
    params: dict


class FileBase(SQLModel):
    name: str
    file_type: FileType | None = None
    size: int | None = None


class File(FileBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    file_type: FileType | None = Field(sa_column=Column(Enum(FileType)))
    location: str
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


class RunPublic(RunPublicMinimal):
    stderr: str | None = None
    stdout: str | None = None
    command: str | None = None
    params: dict
    files: list[FilePublic]


class RunsPublicMinimal(SQLModel):
    data: list[RunPublicMinimal]
    count: int

class RunsPublic(SQLModel):
    data: list[RunPublic]
    count: int
