"""Слой с услугите: свързва чистия домейн с базата.

Тук живее всичко, което домейнът нарочно не знае — четене на салдо, запис на
транзакция, идемпотентност. Правилото е: домейнът решава КАКВО става,
този слой го записва.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .domain import ledger
from .domain.gold import GoldPriceSource, GoldQuote
from .domain.ledger import LedgerError, Movement
from .models import Account, IdempotencyKey, Transaction, User
from .security import hash_password, verify_password


class AuthError(Exception):
    """Отказ при регистрация или вход."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def register_user(
    session: Session, *, email: str, full_name: str, password: str
) -> User:
    """Създава потребител заедно с празната му сметка."""
    email = email.strip().lower()

    user = User(
        email=email,
        full_name=full_name.strip(),
        password_hash=hash_password(password),
    )
    user.account = Account(gold=0, deposited=0, withdrawn=0, fees_paid=0)
    session.add(user)

    try:
        session.commit()
    except IntegrityError:
        # Уникалният индекс е авторитетът, а не предварителна проверка —
        # тя би имала състезание между проверката и записа.
        session.rollback()
        raise AuthError("email_taken", "Вече има регистрация с този имейл.") from None

    session.refresh(user)
    return user


def authenticate(session: Session, *, email: str, password: str) -> User:
    """Проверява имейл и парола."""
    user = session.scalar(select(User).where(User.email == email.strip().lower()))

    # Хешът се сверява дори при непознат имейл, за да не се различават по
    # време отговорите "няма такъв потребител" и "грешна парола".
    stored = user.password_hash if user else hash_password("$ няма такъв $")
    if not verify_password(password, stored) or user is None:
        raise AuthError("invalid_credentials", "Грешен имейл или парола.")

    return user


def get_account(session: Session, user_id: int) -> Account:
    """Сметката на потребителя."""
    account = session.scalar(select(Account).where(Account.user_id == user_id))
    if account is None:
        raise LedgerError("no_account", "Потребителят няма сметка.")
    return account


def card_volume_this_month(session: Session, account: Account, at: float) -> int:
    """Оборот по картата за календарния месец, в който попада ``at``.

    Смята се в базата, а не в паметта: историята расте без ограничение и
    зареждането ѝ цялата само за да се сумират няколко реда е разхищение.
    """
    start = ledger.month_start(at)
    total = session.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.account_id == account.id,
            Transaction.kind == ledger.TxKind.CARD.value,
            Transaction.at >= start,
        )
    )
    return int(total or 0)


def _find_idempotent(
    session: Session, account: Account, key: str | None
) -> Transaction | None:
    """Връща вече записаната транзакция за този ключ, ако има такава."""
    if not key:
        return None
    existing = session.scalar(
        select(IdempotencyKey).where(
            IdempotencyKey.account_id == account.id, IdempotencyKey.key == key
        )
    )
    if existing is None:
        return None
    return session.get(Transaction, existing.transaction_id)


def _commit_movement(
    session: Session,
    account: Account,
    movement: Movement,
    quote: GoldQuote,
    idempotency_key: str | None,
) -> Transaction:
    """Прилага движението към салдото и го записва като транзакция.

    Салдото и редът в историята се записват в една транзакция на базата —
    книга, в която едното е записано без другото, не може да се засече.
    """
    account.gold += movement.gold_delta

    if movement.kind is ledger.TxKind.TOPUP:
        account.deposited += movement.amount
    elif movement.kind is ledger.TxKind.CARD:
        account.withdrawn += movement.amount + movement.fee
    else:  # SELL
        account.withdrawn += movement.amount - movement.fee

    account.fees_paid += movement.fee

    transaction = Transaction(
        account_id=account.id,
        kind=movement.kind.value,
        title=movement.title,
        at=quote.at,
        amount=movement.amount,
        fee=movement.fee,
        gold_delta=movement.gold_delta,
        price_per_gram=movement.price_per_gram,
        gold_after=account.gold,
    )
    session.add(transaction)
    session.flush()

    if idempotency_key:
        session.add(
            IdempotencyKey(
                account_id=account.id,
                key=idempotency_key,
                transaction_id=transaction.id,
            )
        )

    try:
        session.commit()
    except IntegrityError:
        # Две едновременни заявки с един и същ ключ: губещата се отказва и
        # връща вече записаната транзакция вместо второ движение.
        session.rollback()
        existing = _find_idempotent(session, account, idempotency_key)
        if existing is not None:
            return existing
        raise

    session.refresh(transaction)
    return transaction


def top_up(
    session: Session,
    account: Account,
    amount: int,
    prices: GoldPriceSource,
    *,
    idempotency_key: str | None = None,
) -> Transaction:
    """Зарежда сметката и купува злато по текущата ask цена."""
    repeat = _find_idempotent(session, account, idempotency_key)
    if repeat is not None:
        return repeat

    quote = prices.current()
    movement = ledger.plan_topup(amount, quote)
    return _commit_movement(session, account, movement, quote, idempotency_key)


def pay_with_card(
    session: Session,
    account: Account,
    amount: int,
    merchant: str,
    prices: GoldPriceSource,
    *,
    idempotency_key: str | None = None,
) -> Transaction:
    """Авторизира плащане: продава злато по текущата bid цена."""
    repeat = _find_idempotent(session, account, idempotency_key)
    if repeat is not None:
        return repeat

    quote = prices.current()
    movement = ledger.plan_card_payment(
        amount,
        quote,
        merchant,
        available_gold=account.gold,
        card_volume_this_month=card_volume_this_month(session, account, quote.at),
    )
    return _commit_movement(session, account, movement, quote, idempotency_key)


def sell_gold(
    session: Session,
    account: Account,
    gold: int,
    prices: GoldPriceSource,
    *,
    idempotency_key: str | None = None,
) -> Transaction:
    """Продава злато обратно в евро."""
    repeat = _find_idempotent(session, account, idempotency_key)
    if repeat is not None:
        return repeat

    quote = prices.current()
    movement = ledger.plan_sell(gold, quote, available_gold=account.gold)
    return _commit_movement(session, account, movement, quote, idempotency_key)


def account_snapshot(session: Session, account: Account, quote: GoldQuote) -> dict:
    """Състояние на сметката, оценено по подадената котировка."""
    value = ledger.amount_for_gold(account.gold, quote.bid_per_gram)
    invested = account.deposited - account.withdrawn

    return {
        "gold": account.gold,
        "deposited": account.deposited,
        "withdrawn": account.withdrawn,
        "fees_paid": account.fees_paid,
        "value": value,
        "unrealised_pnl": value - invested,
        "card_volume_this_month": card_volume_this_month(session, account, quote.at),
    }
