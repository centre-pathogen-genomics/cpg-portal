from sqlmodel import Session

from app.models import AppSetting

APP_SETTING_ID = 1


def get_or_create_app_settings(session: Session) -> AppSetting:
    app_settings = session.get(AppSetting, APP_SETTING_ID)
    if app_settings:
        return app_settings

    app_settings = AppSetting(id=APP_SETTING_ID)
    session.add(app_settings)
    session.commit()
    session.refresh(app_settings)
    return app_settings
