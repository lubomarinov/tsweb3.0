"""Конфигурация, четена от средата.

Стойностите по подразбиране са годни за локална разработка. В продукция
``FEXOGOLD_SECRET_KEY`` задължително се подава отвън — вж. проверката в
``Settings.validate_for_production``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field

BRAND_NAME = "FexoGold"

#: Ключ по подразбиране само за разработка. Разпознаваем нарочно, за да може
#: проверката по-долу да откаже стартиране с него в продукция.
_DEV_SECRET = "dev-secret-not-for-production-32b+"


@dataclass(frozen=True, slots=True)
class Settings:
    database_url: str = field(
        default_factory=lambda: os.environ.get(
            "FEXOGOLD_DATABASE_URL", "sqlite:///./fexogold.db"
        )
    )
    secret_key: str = field(
        default_factory=lambda: os.environ.get("FEXOGOLD_SECRET_KEY", _DEV_SECRET)
    )
    access_token_minutes: int = field(
        default_factory=lambda: int(os.environ.get("FEXOGOLD_TOKEN_MINUTES", "60"))
    )
    environment: str = field(
        default_factory=lambda: os.environ.get("FEXOGOLD_ENV", "development")
    )
    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(
            origin.strip()
            for origin in os.environ.get(
                # 5173 е `vite dev`, 4173 е `vite preview` — и двата се ползват
                # при разработка, затова и двата са разрешени по подразбиране.
                "FEXOGOLD_CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173"
                ",http://localhost:4173,http://127.0.0.1:4173",
            ).split(",")
            if origin.strip()
        )
    )

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    def validate_for_production(self) -> None:
        """Отказва стартиране с ключа за разработка в продукция.

        По-добре процесът да не тръгне, отколкото да подписва токени с ключ,
        който е публичен в хранилището.
        """
        if self.is_production and self.secret_key == _DEV_SECRET:
            raise RuntimeError(
                "FEXOGOLD_SECRET_KEY трябва да е зададен извън кода в продукция."
            )


settings = Settings()
