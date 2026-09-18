"""Обща настройка на тестовете.

Всеки тест получава чиста база в паметта и НЕПОДВИЖНА котировка: симулиран
поток с движеща се цена би направил очакваните стойности недетерминирани.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from app.db import Base, get_session
from app.deps import get_price_source
from app.domain.gold import FrozenGoldPriceSource, quote_from_mid
from app.main import app

#: 3 415,00 EUR/oz ≈ 109,80 EUR/g mid — същата стойност като в TS тестовете.
QUOTE = quote_from_mid(341_500, 1_758_153_600.0)


@pytest.fixture()
def session_factory():
    engine = create_engine(
        "sqlite://",
        # Една връзка за целия тест: базата в паметта изчезва, ако връзката
        # се затвори между заявките.
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)

    from sqlalchemy.orm import sessionmaker

    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    yield factory
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture()
def prices() -> FrozenGoldPriceSource:
    return FrozenGoldPriceSource(QUOTE)


@pytest.fixture()
def client(session_factory, prices) -> TestClient:
    def override_session():
        session = session_factory()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_price_source] = lambda: prices

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture()
def auth_client(client: TestClient) -> TestClient:
    """Клиент с регистриран и влязъл потребител."""
    response = client.post(
        "/auth/register",
        json={
            "email": "ivan@example.com",
            "full_name": "Иван Петров",
            "password": "silna-parola-123",
        },
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client
