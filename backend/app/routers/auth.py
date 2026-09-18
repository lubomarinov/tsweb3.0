"""Регистрация и вход."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ..deps import CurrentUser, SessionDep
from ..schemas import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from ..security import create_access_token
from ..services import AuthError, authenticate, register_user

router = APIRouter(prefix="/auth", tags=["Автентикация"])


def _as_http(error: AuthError) -> HTTPException:
    """Превежда домейн отказа в HTTP, без да издава кой имейл съществува."""
    status_code = (
        status.HTTP_409_CONFLICT
        if error.code == "email_taken"
        else status.HTTP_401_UNAUTHORIZED
    )
    return HTTPException(
        status_code=status_code,
        detail={"code": error.code, "message": error.message},
    )


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, session: SessionDep) -> TokenResponse:
    try:
        user = register_user(
            session,
            email=payload.email,
            full_name=payload.full_name,
            password=payload.password,
        )
    except AuthError as error:
        raise _as_http(error) from error

    token, expires_in = create_access_token(user.id)
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, session: SessionDep) -> TokenResponse:
    try:
        user = authenticate(session, email=payload.email, password=payload.password)
    except AuthError as error:
        raise _as_http(error) from error

    token, expires_in = create_access_token(user.id)
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.get("/me", response_model=UserResponse)
def me(user: CurrentUser) -> UserResponse:
    return UserResponse.model_validate(user)
