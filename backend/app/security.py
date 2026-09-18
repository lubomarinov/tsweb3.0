"""Пароли и токени.

Хеширането ползва ``hashlib.scrypt`` от стандартната библиотека — бавна по
проект функция с памет-цена, подходяща за пароли. Няма външна зависимост,
която да трябва да се обновява заради уязвимост.
"""

from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt

from .config import settings

# Параметри на scrypt. n=2**15 дава ~100 ms на хеш на обикновен сървър —
# достатъчно бавно срещу подбор, достатъчно бързо за вход.
_SCRYPT_N = 2**15
_SCRYPT_R = 8
_SCRYPT_P = 1
_SALT_BYTES = 16
_KEY_BYTES = 32

# OpenSSL отказва scrypt над 32 MB по подразбиране, а n=2**15, r=8 иска точно
# 128*n*r = 32 MB. Вдигаме тавана явно, иначе хеширането гърми при старт.
_SCRYPT_MAXMEM = 128 * _SCRYPT_N * _SCRYPT_R * 2

_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    """Връща ``scrypt$<n>$<r>$<p>$<сол>$<хеш>``, всичко в шестнайсетичен вид."""
    salt = os.urandom(_SALT_BYTES)
    digest = hashlib.scrypt(
        password.encode(),
        salt=salt,
        n=_SCRYPT_N,
        r=_SCRYPT_R,
        p=_SCRYPT_P,
        dklen=_KEY_BYTES,
        maxmem=_SCRYPT_MAXMEM,
    )
    return f"scrypt${_SCRYPT_N}${_SCRYPT_R}${_SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Сверява парола срещу запазен хеш.

    Сравнението е с ``compare_digest``, за да не изтича информация през
    времето за отговор.
    """
    try:
        scheme, n, r, p, salt_hex, digest_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.scrypt(
            password.encode(),
            salt=bytes.fromhex(salt_hex),
            n=int(n),
            r=int(r),
            p=int(p),
            dklen=len(expected),
            maxmem=_SCRYPT_MAXMEM,
        )
    except (ValueError, TypeError):
        # Повреден или чужд формат на хеша — третира се като невалидна парола.
        return False
    return hmac.compare_digest(expected, actual)


def create_access_token(user_id: int) -> tuple[str, int]:
    """Издава токен. Връща (токен, секунди до изтичане)."""
    expires_in = settings.access_token_minutes * 60
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM), expires_in


def decode_access_token(token: str) -> int | None:
    """Връща потребителското id или ``None`` при невалиден/изтекъл токен."""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[_ALGORITHM])
        return int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError):
        return None
