"""Котировки за злато."""

from __future__ import annotations

from fastapi import APIRouter, Query

from ..deps import PricesDep
from ..domain.gold import SPREAD, GoldQuote
from ..schemas import PriceHistoryResponse, QuoteResponse

router = APIRouter(prefix="/price", tags=["Цена"])


def to_schema(quote: GoldQuote) -> QuoteResponse:
    return QuoteResponse(
        at=quote.at,
        mid_per_ounce=quote.mid_per_ounce,
        ask_per_gram=quote.ask_per_gram,
        bid_per_gram=quote.bid_per_gram,
        spread=SPREAD,
    )


@router.get("", response_model=QuoteResponse)
def current_price(prices: PricesDep) -> QuoteResponse:
    """Текущата котировка — същата, по която сървърът изпълнява сделки."""
    return to_schema(prices.current())


@router.get("/history", response_model=PriceHistoryResponse)
def price_history(
    prices: PricesDep,
    points: int = Query(90, ge=2, le=365, description="Брой точки"),
) -> PriceHistoryResponse:
    return PriceHistoryResponse(
        quotes=[to_schema(quote) for quote in prices.history(points)]
    )
