from sqlmodel import Session, create_engine, select

from app import crud
from app.core.config import settings
from app.models import Param, User, UserCreate, Workflow, WorkflowCreate

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

    sleep_workflow = session.exec(
        select(Workflow).where(Workflow.name == "Sleep")
    ).first()
    if not sleep_workflow:
        print("Creating example Sleep workflow")
        sleep_workflow = Workflow(
            name="Sleep",
            description="This is an example workflow to simulate a long running task. The job will sleep for the number of seconds requested.",
            image="https://images.unsplash.com/photo-1415604934674-561df9abf539?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTh8fGNsb2NrfGVufDB8fDB8fHwy",
            command=["sleep", "{SECONDS}"],
            enabled=True,
            owner_id=user.id,
        )
        session.add(sleep_workflow)
        session.commit()
        session.refresh(sleep_workflow)

        param = Param(
            name="SECONDS",
            description="Number of seconds to sleep for.",
            param_type="int",
            default=5,
            options=None,
            flag=None,
            required=True,
            workflow_id=sleep_workflow.id,
        )
        session.add(param)
        session.commit()
