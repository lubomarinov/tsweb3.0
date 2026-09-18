"""Зависимости на FastAPI: текущ потребител, сметка, ценови поток."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_session
from .domain.gold import GoldPriceSource, SimulatedGoldPriceSource
from .models import Account, User
from .security import decode_access_token
from .services import get_account

bearer_scheme = HTTPBearer(auto_error=False)

# Един поток за целия процес: всяка заявка трябва да вижда една и съща цена,
# а не своя собствена симулация.
_price_source: GoldPriceSource = SimulatedGoldPriceSource()


def set_price_source(source: GoldPriceSource) -> None:
    """Подменя доставчика — за тестове или за реален feed при стартиране."""
    global _price_source
    _price_source = source


def get_price_source() -> GoldPriceSource:
    return _price_source


SessionDep = Annotated[Session, Depends(get_session)]
PricesDep = Annotated[GoldPriceSource, Depends(get_price_source)]


def get_current_user(
    session: SessionDep,
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ] = None,
) -> User:
    """Потребителят зад Bearer токена."""
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "unauthorized", "message": "Нужна е автентикация."},
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None or not credentials.credentials:
        raise unauthorized

    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise unauthorized

    user = session.get(User, user_id)
    if user is None:
        # Валиден токен на изтрит потребител.
        raise unauthorized

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_current_account(session: SessionDep, user: CurrentUser) -> Account:
    return get_account(session, user.id)


CurrentAccount = Annotated[Account, Depends(get_current_account)]

IdempotencyKeyHeader = Annotated[
    str | None,
    Header(
        alias="Idempotency-Key",
        description=(
            "Уникален ключ на заявката. При повторение на същия ключ сървърът "
            "връща вече изпълнената транзакция вместо второ движение."
        ),
    ),
]
