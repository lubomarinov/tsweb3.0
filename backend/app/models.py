"""Таблиците на книгата.

Салдата се пазят като цели числа: евроцентове за пари, микрограмове за злато.
Транзакциите са само за добавяне — ред веднъж записан не се променя, защото
той е доказателството по какъв курс е станала сделката.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(256))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    account: Mapped["Account"] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )


class Account(Base):
    """Сметка в злато. Няма евро салдо — това е смисълът на продукта."""

    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True
    )

    gold: Mapped[int] = mapped_column(BigInteger, default=0)
    """Наличност в микрограмове."""

    deposited: Mapped[int] = mapped_column(BigInteger, default=0)
    withdrawn: Mapped[int] = mapped_column(BigInteger, default=0)
    fees_paid: Mapped[int] = mapped_column(BigInteger, default=0)

    version: Mapped[int] = mapped_column(Integer, default=0)
    """Брояч за оптимистично заключване.

    Две едновременни плащания по една сметка биха прочели едно и също салдо
    и второто би презаписало първото. SQLAlchemy сверява версията при UPDATE
    и вдига грешка вместо да загуби движение.
    """

    __mapper_args__ = {"version_id_col": version}

    user: Mapped[User] = relationship(back_populates="account")
    transactions: Mapped[list["Transaction"]] = relationship(
        back_populates="account",
        cascade="all, delete-orphan",
        order_by="Transaction.at.desc()",
    )


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )

    kind: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(200))
    at: Mapped[float] = mapped_column(default=time.time)

    amount: Mapped[int] = mapped_column(BigInteger)
    fee: Mapped[int] = mapped_column(BigInteger)
    gold_delta: Mapped[int] = mapped_column(BigInteger)
    price_per_gram: Mapped[int] = mapped_column(BigInteger)

    gold_after: Mapped[int] = mapped_column(BigInteger)
    """Наличност след движението — прави книгата проверима без пресмятане
    на цялата история."""

    account: Mapped[Account] = relationship(back_populates="transactions")


Index("ix_transactions_account_at", Transaction.account_id, Transaction.at)


class IdempotencyKey(Base):
    """Пази резултата от вече изпълнена финансова заявка.

    Клиент, който не е получил отговор (загубена мрежа, таймаут), ще повтори
    заявката. Без този запис повторението би било второ плащане.
    """

    __tablename__ = "idempotency_keys"
    __table_args__ = (UniqueConstraint("account_id", "key", name="uq_idem_account_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    key: Mapped[str] = mapped_column(String(128))
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
