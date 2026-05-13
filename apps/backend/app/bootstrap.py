from app.core.config import get_settings
from app.db.session import get_session_factory
from app.modules.reports.service import ensure_default_report_templates
from app.modules.users.service import ensure_admin_user


def main() -> None:
    settings = get_settings()
    db = get_session_factory()()
    try:
        ensure_admin_user(db, settings)
        ensure_default_report_templates(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
