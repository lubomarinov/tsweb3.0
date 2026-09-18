"""Тестове на чистия домейн.

Огледало на ``src/core/ledger.test.ts`` — двете реализации трябва да дават
еднакви числа за еднакъв вход.
"""

from __future__ import annotations

import math

import pytest

from app.domain.gold import quote_from_mid
from app.domain.ledger import (
    Fees,
    LedgerError,
    TOPUP_MAX,
    TOPUP_MIN,
    TxKind,
    amount_for_gold,
    card_fee,
    gold_for_amount,
    month_start,
    plan_card_payment,
    plan_sell,
    plan_topup,
)
from app.domain.money import MICROGRAMS_PER_GRAM, eur

QUOTE = quote_from_mid(341_500, 1_758_153_600.0)


class TestTopUp:
    def test_купува_злато_по_ask_цената(self) -> None:
        movement = plan_topup(eur(1000), QUOTE)

        assert movement.kind is TxKind.TOPUP
        assert movement.price_per_gram == QUOTE.ask_per_gram
        assert movement.fee == 0  # зареждането е без такса
        assert movement.gold_delta == gold_for_amount(eur(1000), QUOTE.ask_per_gram)

    def test_не_издава_злато_което_не_е_купено(self) -> None:
        movement = plan_topup(eur(1000), QUOTE)
        cost = movement.gold_delta * QUOTE.ask_per_gram / MICROGRAMS_PER_GRAM
        assert cost <= eur(1000)

    @pytest.mark.parametrize(
        ("amount", "code"),
        [(TOPUP_MIN - 1, "amount_too_small"), (TOPUP_MAX + 1, "amount_too_large")],
    )
    def test_отхвърля_суми_извън_лимитите(self, amount: int, code: str) -> None:
        with pytest.raises(LedgerError) as error:
            plan_topup(amount, QUOTE)
        assert error.value.code == code


class TestCardPayment:
    def test_продава_точно_колкото_покрива_сумата(self) -> None:
        funded = plan_topup(eur(1000), QUOTE)
        payment = plan_card_payment(
            eur(50),
            QUOTE,
            "Кауфланд",
            available_gold=funded.gold_delta,
            card_volume_this_month=0,
        )

        sold = -payment.gold_delta
        proceeds = amount_for_gold(sold, QUOTE.bid_per_gram)

        # Покритието е пълно, но не повече от един цент излишък.
        assert proceeds >= eur(50)
        assert proceeds - eur(50) <= 1

    def test_без_такса_под_безплатния_лимит(self) -> None:
        funded = plan_topup(eur(1000), QUOTE)
        payment = plan_card_payment(
            eur(200),
            QUOTE,
            "Билла",
            available_gold=funded.gold_delta,
            card_volume_this_month=0,
        )
        assert payment.fee == 0

    def test_такса_само_върху_частта_над_лимита(self) -> None:
        # Първите 100 € са свободни, вторите 100 € са изцяло над лимита.
        used = Fees.FREE_MONTHLY_CARD_VOLUME - eur(100)
        fee = card_fee(eur(200), used)
        assert fee == round(eur(100) * Fees.CARD_OVER_LIMIT)

    def test_отказва_при_недостатъчно_злато(self) -> None:
        funded = plan_topup(eur(100), QUOTE)
        with pytest.raises(LedgerError) as error:
            plan_card_payment(
                eur(5000),
                QUOTE,
                "Яхта",
                available_gold=funded.gold_delta,
                card_volume_this_month=0,
            )
        assert error.value.code == "insufficient_gold"
        assert error.value.details["available_gold"] == funded.gold_delta


class TestSell:
    def test_изплаща_по_bid_и_удържа_такса(self) -> None:
        funded = plan_topup(eur(1000), QUOTE)
        sale = plan_sell(funded.gold_delta, QUOTE, available_gold=funded.gold_delta)

        assert sale.price_per_gram == QUOTE.bid_per_gram
        assert sale.gold_delta == -funded.gold_delta
        assert sale.fee == math.ceil(sale.amount * Fees.SELL)

    def test_отказва_над_наличността(self) -> None:
        with pytest.raises(LedgerError) as error:
            plan_sell(1, QUOTE, available_gold=0)
        assert error.value.code == "insufficient_gold"


class TestSpread:
    def test_веднага_след_покупка_сме_на_минус_със_спреда(self) -> None:
        movement = plan_topup(eur(1000), QUOTE)
        value_now = amount_for_gold(movement.gold_delta, QUOTE.bid_per_gram)

        # Купено по ask, оценено по bid — разликата е приходът на платформата.
        assert value_now < eur(1000)

    def test_стойността_следва_цената_в_двете_посоки(self) -> None:
        movement = plan_topup(eur(1000), QUOTE)
        higher = quote_from_mid(QUOTE.mid_per_ounce * 1.1, QUOTE.at)
        lower = quote_from_mid(QUOTE.mid_per_ounce * 0.9, QUOTE.at)

        base = amount_for_gold(movement.gold_delta, QUOTE.bid_per_gram)
        assert amount_for_gold(movement.gold_delta, higher.bid_per_gram) > base
        assert amount_for_gold(movement.gold_delta, lower.bid_per_gram) < base


class TestMonthStart:
    def test_връща_началото_на_месеца(self) -> None:
        from datetime import datetime, timezone

        at = datetime(2026, 9, 18, 13, 45, tzinfo=timezone.utc).timestamp()
        start = datetime.fromtimestamp(month_start(at), tz=timezone.utc)

        assert (start.year, start.month, start.day) == (2026, 9, 1)
        assert (start.hour, start.minute, start.second) == (0, 0, 0)
