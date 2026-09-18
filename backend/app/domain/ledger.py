"""Счетоводна книга на злато-обезпечената сметка.

Огледало на ``src/core/ledger.ts``. Разликата в ролите е съществена:
клиентът смята, за да ПОКАЖЕ какво ще стане, а този модул решава какво
наистина става. Затова тук няма нито едно допускане, което да идва от
клиента — сумата се валидира наново, курсът се взима от сървърния поток,
а наличността се чете от базата.

Функциите са чисти: вход → резултат, без достъп до база или време. Записът
в базата се прави от слоя с услугите, който ги вика.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum

from .gold import GoldQuote
from .money import MICROGRAMS_PER_GRAM, fee_of


class TxKind(str, Enum):
    """Вид движение по сметката."""

    TOPUP = "topup"
    """Зареждане с евро → покупка на злато."""

    CARD = "card"
    """Плащане с картата → продажба на злато."""

    SELL = "sell"
    """Ръчна продажба на злато → изплащане в евро."""


class Fees:
    """Такси на продукта.

    Зареждането е без такса — платформата печели от спреда. Плащането с
    картата се таксува само над безплатния месечен оборот.
    """

    TOPUP = 0.0
    CARD_OVER_LIMIT = 0.005
    FREE_MONTHLY_CARD_VOLUME = 100_000  # 1 000,00 EUR
    SELL = 0.0025


#: Лимити за зареждане в евроцентове.
TOPUP_MIN = 10_00
TOPUP_MAX = 1_000_000  # 10 000,00 EUR


class LedgerError(Exception):
    """Отказ по бизнес причина, а не по техническа.

    Носи машинно четим ``code``, за да може API слоят да го преведе в
    HTTP отговор, без да разчита на текста на съобщението.
    """

    def __init__(self, code: str, message: str, **details: object) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details


@dataclass(frozen=True, slots=True)
class Movement:
    """Резултат от една сделка: какво се записва и как се мести салдото.

    Не пипа база — слоят с услугите го превръща в ред в таблицата.
    """

    kind: TxKind
    title: str
    amount: int
    """Брутна сума в евроцентове."""

    fee: int
    """Удържана такса в евроцентове."""

    gold_delta: int
    """Злато, купено (+) или продадено (−), в микрограмове."""

    price_per_gram: int
    """Курсът, приложен към сделката."""


def gold_for_amount(amount: int, price_per_gram: int) -> int:
    """Колко микрограма злато се получават за дадена сума.

    Умножава се преди делението, за да е делението единствената операция със
    закръгляне — същата формула като в клиента, за да съвпадат числата.
    Закръгля се НАДОЛУ: платформата не издава злато, което не е купила.
    """
    if price_per_gram <= 0:
        return 0
    return (amount * MICROGRAMS_PER_GRAM) // price_per_gram


def amount_for_gold(gold: int, price_per_gram: int) -> int:
    """Колко евроцента струва дадено количество злато."""
    return round((gold * price_per_gram) / MICROGRAMS_PER_GRAM)


def gold_needed_for_amount(amount: int, price_per_gram: int) -> int:
    """Колко злато трябва да се продаде, за да се покрие сума.

    Закръгля се НАГОРЕ: покритието трябва да е пълно, иначе сметката остава
    с дефицит от част от цента.
    """
    if price_per_gram <= 0:
        raise LedgerError("invalid_quote", "Невалидна котировка.")
    return math.ceil((amount * MICROGRAMS_PER_GRAM) / price_per_gram)


def month_start(at: float) -> float:
    """Начало на календарния месец, в който попада моментът (UTC)."""
    moment = datetime.fromtimestamp(at, tz=timezone.utc)
    return moment.replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    ).timestamp()


def card_fee(amount: int, card_volume_this_month: int) -> int:
    """Такса за плащане с карта: само върху частта над безплатния лимит."""
    remaining_free = max(Fees.FREE_MONTHLY_CARD_VOLUME - card_volume_this_month, 0)
    chargeable = max(amount - remaining_free, 0)
    return fee_of(chargeable, Fees.CARD_OVER_LIMIT)


def plan_topup(amount: int, quote: GoldQuote) -> Movement:
    """Зареждане: купува се злато по ask цената."""
    if amount < TOPUP_MIN:
        raise LedgerError(
            "amount_too_small",
            f"Минималната сума за зареждане е {TOPUP_MIN / 100:.2f} EUR.",
            min=TOPUP_MIN,
        )
    if amount > TOPUP_MAX:
        raise LedgerError(
            "amount_too_large",
            f"Максималната сума за зареждане е {TOPUP_MAX / 100:.2f} EUR.",
            max=TOPUP_MAX,
        )

    fee = fee_of(amount, Fees.TOPUP)
    bought = gold_for_amount(amount - fee, quote.ask_per_gram)

    return Movement(
        kind=TxKind.TOPUP,
        title="Зареждане и покупка на злато",
        amount=amount,
        fee=fee,
        gold_delta=bought,
        price_per_gram=quote.ask_per_gram,
    )


def plan_card_payment(
    amount: int,
    quote: GoldQuote,
    merchant: str,
    *,
    available_gold: int,
    card_volume_this_month: int,
) -> Movement:
    """Плащане с картата: продава се точно толкова злато, колкото покрива
    сумата плюс таксата, по bid цената в момента на авторизация."""
    if amount <= 0:
        raise LedgerError("amount_too_small", "Сумата трябва да е положителна.", min=1)

    fee = card_fee(amount, card_volume_this_month)
    required_gold = gold_needed_for_amount(amount + fee, quote.bid_per_gram)

    if required_gold > available_gold:
        raise LedgerError(
            "insufficient_gold",
            "Наличното злато не покрива плащането.",
            required_gold=required_gold,
            available_gold=available_gold,
        )

    return Movement(
        kind=TxKind.CARD,
        title=merchant,
        amount=amount,
        fee=fee,
        gold_delta=-required_gold,
        price_per_gram=quote.bid_per_gram,
    )


def plan_sell(gold: int, quote: GoldQuote, *, available_gold: int) -> Movement:
    """Ръчна продажба на злато обратно в евро."""
    if gold <= 0:
        raise LedgerError("amount_too_small", "Количеството трябва да е положително.", min=1)
    if gold > available_gold:
        raise LedgerError(
            "insufficient_gold",
            "Наличното злато не стига за тази продажба.",
            required_gold=gold,
            available_gold=available_gold,
        )

    gross = amount_for_gold(gold, quote.bid_per_gram)
    fee = fee_of(gross, Fees.SELL)

    return Movement(
        kind=TxKind.SELL,
        title="Продажба на злато",
        amount=gross,
        fee=fee,
        gold_delta=-gold,
        price_per_gram=quote.bid_per_gram,
    )
