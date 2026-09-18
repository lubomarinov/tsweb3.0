"""Ценови поток за злато.

``GoldPriceSource`` е границата към доставчика на котировки. Продукционният
сървър би имплементирал наследник, който чете реален feed (LBMA fixing,
борсов поток, Metals-API) и кешира последната котировка; целият останал код
работи срещу интерфейса и не се променя.

Демото ползва детерминиран симулиран поток със seed, за да са възпроизводими
тестовете и графиките.
"""

from __future__ import annotations

import math
import random
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass

from .money import GRAMS_PER_TROY_OUNCE

#: Спред между купува и продава. Това е приходът на платформата от обмяната.
SPREAD = 0.004

#: Начална mid цена за тройунция в евроцентове (3 415,00 EUR/oz).
DEMO_OPENING_PRICE_PER_OUNCE = 341_500


@dataclass(frozen=True, slots=True)
class GoldQuote:
    """Котировка в конкретен момент. Неизменяема — веднъж издадена, се пази
    в транзакцията като доказателство по какъв курс е станала сделката."""

    at: float
    """Unix време в секунди."""

    mid_per_ounce: int
    """Средна цена за тройунция в евроцентове."""

    ask_per_gram: int
    """Цена, на която клиентът КУПУВА грам."""

    bid_per_gram: int
    """Цена, на която клиентът ПРОДАВА грам."""


def quote_from_mid(mid_per_ounce: float, at: float) -> GoldQuote:
    """Изгражда bid/ask котировка от mid цена за унция."""
    mid_per_gram = mid_per_ounce / GRAMS_PER_TROY_OUNCE
    return GoldQuote(
        at=at,
        mid_per_ounce=round(mid_per_ounce),
        ask_per_gram=round(mid_per_gram * (1 + SPREAD)),
        bid_per_gram=round(mid_per_gram * (1 - SPREAD)),
    )


class GoldPriceSource(ABC):
    """Граница към доставчика на котировки."""

    @abstractmethod
    def current(self) -> GoldQuote:
        """Последна известна котировка."""

    @abstractmethod
    def history(self, points: int = 90) -> list[GoldQuote]:
        """История за графики, най-старата точка първа."""


class SimulatedGoldPriceSource(GoldPriceSource):
    """Случайно блуждаене с лек възходящ дрейф.

    Не моделира реален пазар — целта е котировките да се движат правдоподобно.
    """

    def __init__(
        self,
        *,
        points: int = 90,
        step_seconds: float = 24 * 60 * 60,
        seed: int = 20260918,
        volatility: float = 0.0075,
        drift: float = 0.0006,
        now: float | None = None,
    ) -> None:
        self._rng = random.Random(seed)
        self._volatility = volatility
        self._series: list[GoldQuote] = []

        start = time.time() if now is None else now
        mid = float(DEMO_OPENING_PRICE_PER_OUNCE)

        # Историята се строи назад във времето, за да завърши в "сега".
        for index in range(points - 1, -1, -1):
            mid *= 1 + drift + self._rng.gauss(0, 1) * volatility
            self._series.append(quote_from_mid(mid, start - index * step_seconds))

        self._mid = mid
        self._points = points

    def current(self) -> GoldQuote:
        return self._series[-1]

    def history(self, points: int = 90) -> list[GoldQuote]:
        return self._series[-points:]

    def tick(self, at: float | None = None) -> GoldQuote:
        """Придвижва цената с една вътредневна стъпка."""
        self._mid *= 1 + self._rng.gauss(0, 1) * self._volatility * 0.12
        quote = quote_from_mid(self._mid, time.time() if at is None else at)
        self._series.append(quote)
        # Историята се подрязва, за да не расте без край в дълго живеещ процес.
        if len(self._series) > self._points * 4:
            del self._series[: len(self._series) - self._points * 4]
        return quote


class FrozenGoldPriceSource(GoldPriceSource):
    """Неподвижна котировка. Ползва се в тестове, където движението на цената
    би направило очакваните стойности недетерминирани."""

    def __init__(self, quote: GoldQuote) -> None:
        self._quote = quote

    def current(self) -> GoldQuote:
        return self._quote

    def history(self, points: int = 90) -> list[GoldQuote]:
        return [self._quote]


def per_ounce_from_per_gram(per_gram: int) -> int:
    """Цена за унция от цена за грам — за справка до котировката."""
    return round(per_gram * GRAMS_PER_TROY_OUNCE)


__all__ = [
    "SPREAD",
    "DEMO_OPENING_PRICE_PER_OUNCE",
    "GoldQuote",
    "GoldPriceSource",
    "SimulatedGoldPriceSource",
    "FrozenGoldPriceSource",
    "quote_from_mid",
    "per_ounce_from_per_gram",
]
