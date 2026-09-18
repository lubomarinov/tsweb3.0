"""Сметка: състояние, зареждане, плащане с карта, продажба, история."""

from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import select

from ..deps import CurrentAccount, IdempotencyKeyHeader, PricesDep, SessionDep
from ..models import Transaction
from ..schemas import (
    AccountResponse,
    CardPaymentRequest,
    MovementResponse,
    SellRequest,
    TopUpRequest,
    TransactionResponse,
)
from ..services import account_snapshot, pay_with_card, sell_gold, top_up
from .price import to_schema

router = APIRouter(prefix="/account", tags=["Сметка"])


def _snapshot(session, account, prices) -> AccountResponse:  # noqa: ANN001
    """Състояние на сметката по текущата котировка."""
    quote = prices.current()
    return AccountResponse(
        **account_snapshot(session, account, quote), quote=to_schema(quote)
    )


@router.get("", response_model=AccountResponse)
def read_account(
    session: SessionDep, account: CurrentAccount, prices: PricesDep
) -> AccountResponse:
    return _snapshot(session, account, prices)


@router.get("/transactions", response_model=list[TransactionResponse])
def read_transactions(
    session: SessionDep,
    account: CurrentAccount,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> list[TransactionResponse]:
    """История, най-новото първо. Странициране, защото историята расте."""
    rows = session.scalars(
        select(Transaction)
        .where(Transaction.account_id == account.id)
        .order_by(Transaction.at.desc(), Transaction.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return [TransactionResponse.model_validate(row) for row in rows]


@router.post("/topup", response_model=MovementResponse, status_code=201)
def topup(
    payload: TopUpRequest,
    session: SessionDep,
    account: CurrentAccount,
    prices: PricesDep,
    idempotency_key: IdempotencyKeyHeader = None,
) -> MovementResponse:
    """Зарежда сметката и купува злато по курса в момента."""
    transaction = top_up(
        session, account, payload.amount, prices, idempotency_key=idempotency_key
    )
    return MovementResponse(
        transaction=TransactionResponse.model_validate(transaction),
        account=_snapshot(session, account, prices),
    )


@router.post("/card-payment", response_model=MovementResponse, status_code=201)
def card_payment(
    payload: CardPaymentRequest,
    session: SessionDep,
    account: CurrentAccount,
    prices: PricesDep,
    idempotency_key: IdempotencyKeyHeader = None,
) -> MovementResponse:
    """Авторизира плащане с картата: продава злато по курса в момента."""
    transaction = pay_with_card(
        session,
        account,
        payload.amount,
        payload.merchant,
        prices,
        idempotency_key=idempotency_key,
    )
    return MovementResponse(
        transaction=TransactionResponse.model_validate(transaction),
        account=_snapshot(session, account, prices),
    )


@router.post("/sell", response_model=MovementResponse, status_code=201)
def sell(
    payload: SellRequest,
    session: SessionDep,
    account: CurrentAccount,
    prices: PricesDep,
    idempotency_key: IdempotencyKeyHeader = None,
) -> MovementResponse:
    """Продава злато обратно в евро."""
    transaction = sell_gold(
        session, account, payload.gold, prices, idempotency_key=idempotency_key
    )
    return MovementResponse(
        transaction=TransactionResponse.model_validate(transaction),
        account=_snapshot(session, account, prices),
    )
