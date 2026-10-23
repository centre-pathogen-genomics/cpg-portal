# ruff: noqa: E402
import os
import subprocess
from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlmodel import Session

# The suite must never write into the development database: a run left behind
# there holds on to the CPUs it asked for in the worker's scheduler, so enough
# runs from a test session block the development queue for good. Point the
# suite at its own database before the app settings are loaded below.
os.environ.setdefault("POSTGRES_DB", "app_test")

from app.core.config import settings
from app.core.db import engine, init_db
from app.main import app
from tests.utils.user import authentication_token_from_email
from tests.utils.utils import get_superuser_token_headers


@pytest.fixture(scope="session", autouse=True)
def _test_database() -> None:
    """Create the test database if needed and bring it up to date."""
    admin_engine = create_engine(
        str(settings.SQLALCHEMY_DATABASE_URI).rsplit("/", 1)[0] + "/postgres",
        isolation_level="AUTOCOMMIT",
    )
    with admin_engine.connect() as connection:
        exists = connection.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": settings.POSTGRES_DB},
        ).first()
        if not exists:
            connection.execute(text(f'CREATE DATABASE "{settings.POSTGRES_DB}"'))
    admin_engine.dispose()
    subprocess.run(
        ["alembic", "upgrade", "head"],
        check=True,
        cwd=Path(__file__).resolve().parents[1],
        capture_output=True,
    )


@pytest.fixture(scope="session", autouse=True)
def _cpus_to_spare() -> None:
    """The suite reuses one database across tests, so the worker hands out
    plenty of CPUs unless a test sets its own limit."""
    settings.TOTAL_CPUS = 1000


@pytest.fixture(scope="session", autouse=True)
def db() -> Generator[Session]:
    with Session(engine) as session:
        init_db(session)
        yield session


@pytest.fixture(scope="session")
def client() -> Generator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def superuser_token_headers(client: TestClient) -> dict[str, str]:
    return get_superuser_token_headers(client)


@pytest.fixture(scope="module")
def normal_user_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    return authentication_token_from_email(
        client=client, email=settings.EMAIL_TEST_USER, db=db
    )
