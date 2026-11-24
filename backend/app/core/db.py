from sqlmodel import Session, create_engine, select

from app.core.config import settings
from app.core.security import get_password_hash
from app.models import Tool, User

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


def init_db(session: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next lines
    # from sqlmodel import SQLModel

    # This works because the models are already imported and registered from app.models
    # SQLModel.metadata.create_all(engine)

    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        # The one and only superuser is bootstrapped here from the environment.
        # There is no API that creates or promotes superusers (the create and
        # update schemas carry no is_superuser), and the partial unique index
        # from the single-superuser migration makes "at most one" a database
        # invariant as well. The bootstrap account skips the default role: a
        # superuser bypasses the permission checks anyway.
        user = User(
            email=settings.FIRST_SUPERUSER,
            hashed_password=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
            is_superuser=True,
            is_active=True,
        )
        session.add(user)
        session.commit()

    sleep_tool = session.exec(
        select(Tool).where(Tool.name == "Sleep")
    ).first()
    if not sleep_tool:
        print("Creating example Sleep tool")
        sleep_tool = Tool(
            name="Sleep",
            description="This is an example tool to simulate a long run. The tool will sleep for the number of seconds requested.",
            image="https://images.unsplash.com/photo-1415604934674-561df9abf539?w=500&auto=format&fit=crop&q=60",
            command="sleep {{SECONDS}}",
            enabled=True,
            owner_id=user.id,
            params=[{
                "name": "SECONDS",
                "description": "Number of seconds to sleep for.",
                "param_type": "int",
                "default": 5,
                "required": True,
            }]
        )
        session.add(sleep_tool)
        session.commit()
