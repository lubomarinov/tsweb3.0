"""Схеми на заявките и отговорите.

Сумите по мрежата пътуват като цели числа (центове, микрограмове), а не като
десетични числа — така клиентът не може да внесе грешка от закръгляне, а
JSON не губи точност.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str


class QuoteResponse(BaseModel):
    at: float
    mid_per_ounce: int
    ask_per_gram: int
    bid_per_gram: int
    spread: float


class PriceHistoryResponse(BaseModel):
    quotes: list[QuoteResponse]


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    title: str
    at: float
    amount: int
    fee: int
    gold_delta: int
    price_per_gram: int
    gold_after: int


class AccountResponse(BaseModel):
    gold: int
    """Наличност в микрограмове."""

    deposited: int
    withdrawn: int
    fees_paid: int

    value: int
    """Пазарна стойност в евроцентове, ако се ликвидира сега."""

    unrealised_pnl: int
    """Нереализиран резултат спрямо нетно вложеното."""

    card_volume_this_month: int
    quote: QuoteResponse


class TopUpRequest(BaseModel):
    amount: int = Field(gt=0, description="Сума в евроцентове")


class CardPaymentRequest(BaseModel):
    amount: int = Field(gt=0, description="Сума в евроцентове")
    merchant: str = Field(min_length=1, max_length=200)


class SellRequest(BaseModel):
    gold: int = Field(gt=0, description="Количество в микрограмове")


class MovementResponse(BaseModel):
    transaction: TransactionResponse
    account: AccountResponse


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict = Field(default_factory=dict)
