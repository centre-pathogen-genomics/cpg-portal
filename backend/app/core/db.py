from sqlmodel import Session, create_engine, select

from app import crud
from app.core.config import settings
from app.models import Tool, User, UserCreate

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
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
        )
        user = crud.create_user(session=session, user_create=user_in)

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
