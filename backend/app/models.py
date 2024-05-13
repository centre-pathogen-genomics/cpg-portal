import enum
from datetime import datetime
from typing import Any, Optional

from sqlalchemy.dialects.postgresql import JSONB as JSON
from sqlalchemy.orm import RelationshipProperty
from sqlmodel import (
    Column,
    Enum,
    Field,
    ForeignKey,
    Relationship,
    SQLModel,
)


# Shared properties
# TODO replace email str with EmailStr when sqlmodel supports it
class UserBase(SQLModel):
    email: str = Field(unique=True, index=True)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = None


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str


# TODO replace email str with EmailStr when sqlmodel supports it
class UserRegister(SQLModel):
    email: str
    password: str
    full_name: str | None = None


# Properties to receive via API on update, all are optional
# TODO replace email str with EmailStr when sqlmodel supports it
class UserUpdate(UserBase):
    email: str | None = None  # type: ignore
    password: str | None = None


# TODO replace email str with EmailStr when sqlmodel supports it
class UserUpdateMe(SQLModel):
    full_name: str | None = None
    email: str | None = None


class UpdatePassword(SQLModel):
    current_password: str
    new_password: str


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    hashed_password: str
    items: list["Item"] = Relationship(back_populates="owner")
    workflows: list["Workflow"] = Relationship(back_populates="owner")
    files: list["File"] = Relationship(back_populates="owner")
    tasks: list["Task"] = Relationship(back_populates="owner")
    results: list["Result"] = Relationship(back_populates="owner")


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: int


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str
    description: str | None = None


# Properties to receive on item creation
class ItemCreate(ItemBase):
    title: str


# Properties to receive on item update
class ItemUpdate(ItemBase):
    title: str | None = None  # type: ignore


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    title: str
    owner_id: int | None = Field(default=None, foreign_key="user.id", nullable=False)
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: int
    owner_id: int


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
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
    sub: int | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str


# Shared properties
class WorkflowBase(SQLModel):
    name: str
    description: str | None = None
    image: str | None = None
    command: list[str]  # ["hello-world", "run", "{verbose_flag}", "--text", "{text}"]
    setup_command: str | None = None  # command -v hello-world >/dev/null 2>&1 || snk install wytamma/hello-world
    target_files: list[str] | None = None  # hello.txt these are the files that the workflow will generate that we want to keep (comma separated)
    json_results_file: str | None = None  # results file that will be save into the database
    enabled: bool = True

# Properties to receive on Workflow creation
class WorkflowCreate(WorkflowBase):
    name: str

# Properties to receive on Workflow update
class WorkflowUpdate(WorkflowBase):
    name: str | None = None  # type: ignore
    command: list[str] | None = None


# Database model, database table inferred from class name
class Workflow(WorkflowBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    command: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    owner_id: int | None = Field(default=None, foreign_key="user.id", nullable=False)
    owner: User | None = Relationship(back_populates="workflows")
    params: list["Param"] = Relationship(back_populates="workflow")
    tasks: list["Task"] = Relationship(back_populates="workflow")
    target_files: list[str] = Field(default_factory=list, sa_column=Column(JSON))


# Properties to return via API, id is always required
class WorkflowPublic(WorkflowBase):
    id: int
    owner_id: int


class WorkflowsPublic(SQLModel):
    data: list[WorkflowPublic]
    count: int


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
    id: int | None = Field(default=None, primary_key=True)
    param_type: ParamType = Field(sa_column=Column(Enum(ParamType)))
    options: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    default: int | float | str | bool | None = Field(default=None, sa_column=Column(JSON))
    workflow_id: int | None = Field(default=None, foreign_key="workflow.id", nullable=False)
    workflow: Workflow | None = Relationship(back_populates="params")


class ParamPublic(ParamBase):
    id: int
    workflow_id: int


class WorkflowCreateWithParams(WorkflowCreate):
    params: ParamCreate = []


class WorkflowPublicWithParams(WorkflowPublic):
    params: list[ParamPublic]


class WorkflowsPublicWithParams(SQLModel):
    data: list[WorkflowPublicWithParams]
    count: int


class TaskBase(SQLModel):
    taskiq_id: str


class TaskStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"

class Task(TaskBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    taskiq_id: str | None = None
    status: TaskStatus = Field(sa_column=Column(Enum(TaskStatus)))
    params: dict = Field(default_factory=dict, sa_column=Column(JSON))
    workflow_id: int | None = Field(default=None, foreign_key="workflow.id", nullable=False)
    workflow: Workflow | None = Relationship(back_populates="tasks")
    owner_id: int | None = Field(default=None, foreign_key="user.id", nullable=False)
    owner: User | None = Relationship(back_populates="tasks")
    result: Optional["Result"] = Relationship(
        sa_relationship=RelationshipProperty(
            "Result", back_populates="task", uselist=False, cascade="all, delete, delete-orphan"
        ),
    )
    created_at: datetime = Field(default=datetime.utcnow(), nullable=False)
    started_at: datetime | None = Field(default=None, nullable=True)
    finished_at: datetime | None = Field(default=None, nullable=True)


class TaskPublic(TaskBase):
    id: int
    owner_id: int
    workflow_id: int
    status: TaskStatus
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None


class Result(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    results: dict | None = Field(default_factory=dict, sa_column=Column(JSON))
    files: list["File"] = Relationship(
        sa_relationship=RelationshipProperty(
            "File", back_populates="result", uselist=True, cascade="all, delete, delete-orphan"
        ),
    )
    owner_id: int | None = Field(default=None, foreign_key="user.id", nullable=False)
    owner: User | None = Relationship(back_populates="results")
    task_id: int | None = Field(
        sa_column=Column("task_id", ForeignKey("task.id"), nullable=False)
    )
    task: Task = Relationship(
        sa_relationship=RelationshipProperty("Task", back_populates="result")
    )
    created_at: datetime = Field(default=datetime.utcnow(), nullable=False)

class FileBase(SQLModel):
    name: str

class File(FileBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    location: str
    owner_id: int | None = Field(default=None, foreign_key="user.id", nullable=False)
    owner: User | None = Relationship(back_populates="files")
    result_id: int | None = Field(default=None, foreign_key="result.id", nullable=True)
    result: Result | None = Relationship(back_populates="files")
    created_at: datetime = Field(default=datetime.utcnow(), nullable=False)

class FilePublic(FileBase):
    id: int
    result_id: int | None = None
    created_at: datetime


class FilesPublic(SQLModel):
    data: list[FilePublic]
    count: int


class ResultPublicWithFiles(SQLModel):
    id: int
    results: dict | None = None
    files: list[FilePublic] = []
    owner_id: int
    task_id: int
    created_at: datetime


class TaskPublicWithResult(TaskPublic):
    result: ResultPublicWithFiles | None = None


class TasksPublic(SQLModel):
    data: list[TaskPublic]
    count: int

class TasksPublicWithResult(SQLModel):
    data: list[TaskPublicWithResult]
    count: int
