"""Входна точка на FexoGold API."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import BRAND_NAME, settings
from .db import create_all
from .domain.ledger import LedgerError
from .routers import account, auth, price


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings.validate_for_production()
    create_all()
    yield


app = FastAPI(
    title=f"{BRAND_NAME} API",
    version="0.1.0",
    summary="Злато-обезпечена сметка и карта",
    description=(
        "Зареждането купува злато по спот курса в момента; плащането с "
        "картата продава точно толкова метал, колкото покрива сметката.\n\n"
        "**Демонстрационен проект.** Котировките са симулирани и никакви "
        "реални средства не се движат."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(LedgerError)
async def ledger_error_handler(_request: Request, error: LedgerError) -> JSONResponse:
    """Отказите по бизнес причина са 422, а не 500.

    Клиентът получава машинно четим ``code``, за да покаже съобщение, без да
    разчита на текста.
    """
    return JSONResponse(
        status_code=422,
        content={
            "code": error.code,
            "message": error.message,
            "details": {key: value for key, value in error.details.items()},
        },
    )


@app.get("/health", tags=["Служебни"])
def health() -> dict[str, str]:
    return {"status": "ok", "brand": BRAND_NAME}


app.include_router(auth.router)
app.include_router(price.router)
app.include_router(account.router)
