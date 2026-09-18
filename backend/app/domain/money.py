"""Точна аритметика за пари и злато.

Огледало на ``src/core/money.ts`` във фронтенда. Двете реализации трябва да
дават еднакъв резултат за еднакъв вход — клиентът показва какво ще стане,
сървърът решава какво наистина става, и двете числа трябва да съвпадат.

Пари се пазят в евроцентове, злато — в микрограмове, и двете като ``int``.
Никъде не се ползва ``float`` за салда: закръгляването на float натрупва
грешки, които в счетоводна книга изглеждат като изчезващи стотинки.
"""

from __future__ import annotations

import math

CENTS_PER_EUR = 100
MICROGRAMS_PER_GRAM = 1_000_000

#: Грамове в една тройунция — стандартът, по който се котира златото.
GRAMS_PER_TROY_OUNCE = 31.1034768


def eur(amount: float) -> int:
    """Превръща евро в евроцентове."""
    return round(amount * CENTS_PER_EUR)


def to_eur(cents: int) -> float:
    """Само за показване — никога за сметки."""
    return cents / CENTS_PER_EUR


def grams(amount: float) -> int:
    """Превръща грамове в микрограмове."""
    return round(amount * MICROGRAMS_PER_GRAM)


def to_grams(micrograms: int) -> float:
    """Само за показване — никога за сметки."""
    return micrograms / MICROGRAMS_PER_GRAM


def fee_of(amount: int, rate: float) -> int:
    """Процентна такса, закръглена НАГОРЕ до цял цент.

    Нагоре, за да не може серия от микро-транзакции да свали таксата до нула
    чрез закръгляне.
    """
    return math.ceil(amount * rate)
