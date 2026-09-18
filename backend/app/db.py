"""Връзка към базата и сесии."""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    """Обща база за всички модели."""


_is_sqlite = settings.database_url.startswith("sqlite")

engine = create_engine(
    settings.database_url,
    # SQLite по подразбиране връзва връзката към нишката, която я е създала;
    # FastAPI обслужва заявки от пул от нишки.
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    pool_pre_ping=True,
)

if _is_sqlite:

    @event.listens_for(engine, "connect")
    def _configure_sqlite(dbapi_connection, _record) -> None:  # noqa: ANN001
        """Включва външните ключове и WAL.

        SQLite не спазва външни ключове по подразбиране, а книга без тях
        допуска транзакции към несъществуваща сметка.
        """
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    """FastAPI зависимост: сесия за времето на една заявка."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def create_all() -> None:
    """Създава таблиците.

    Достатъчно за демо. Продукционен проект би ползвал Alembic миграции —
    ``create_all`` не променя вече съществуваща схема.
    """
    from . import models  # noqa: F401  (регистрира моделите в метаданните)

    Base.metadata.create_all(bind=engine)
