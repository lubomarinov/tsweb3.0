"""Тестове на HTTP слоя: автентикация, сделки, идемпотентност."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.domain.money import eur
from tests.conftest import QUOTE


class TestAuth:
    def test_регистрация_връща_токен(self, client: TestClient) -> None:
        response = client.post(
            "/auth/register",
            json={
                "email": "nov@example.com",
                "full_name": "Нов Потребител",
                "password": "silna-parola-123",
            },
        )
        assert response.status_code == 201
        assert response.json()["access_token"]

    def test_дублиран_имейл_се_отказва(self, auth_client: TestClient) -> None:
        response = auth_client.post(
            "/auth/register",
            json={
                "email": "ivan@example.com",
                "full_name": "Друг Иван",
                "password": "silna-parola-123",
            },
        )
        assert response.status_code == 409
        assert response.json()["detail"]["code"] == "email_taken"

    def test_грешна_парола(self, auth_client: TestClient) -> None:
        response = auth_client.post(
            "/auth/login",
            json={"email": "ivan@example.com", "password": "gresna-parola"},
        )
        assert response.status_code == 401

    def test_непознат_имейл_дава_същия_отказ(self, client: TestClient) -> None:
        # Отговорът не бива да издава дали имейлът съществува.
        response = client.post(
            "/auth/login",
            json={"email": "nyama@example.com", "password": "kakvato-parola"},
        )
        assert response.status_code == 401
        assert response.json()["detail"]["code"] == "invalid_credentials"

    def test_без_токен_сметката_е_затворена(self, client: TestClient) -> None:
        assert client.get("/account").status_code == 401

    def test_повреден_токен_се_отхвърля(self, client: TestClient) -> None:
        response = client.get("/account", headers={"Authorization": "Bearer boklyk"})
        assert response.status_code == 401


class TestPrice:
    def test_котировката_е_публична(self, client: TestClient) -> None:
        body = client.get("/price").json()
        assert body["ask_per_gram"] == QUOTE.ask_per_gram
        assert body["bid_per_gram"] == QUOTE.bid_per_gram
        # Купува винаги е по-скъпо от продава — иначе спредът е обърнат.
        assert body["ask_per_gram"] > body["bid_per_gram"]


class TestAccountFlow:
    def test_нова_сметка_е_празна(self, auth_client: TestClient) -> None:
        body = auth_client.get("/account").json()
        assert body["gold"] == 0
        assert body["deposited"] == 0
        assert body["unrealised_pnl"] == 0

    def test_зареждане_купува_злато(self, auth_client: TestClient) -> None:
        response = auth_client.post("/account/topup", json={"amount": eur(1000)})
        assert response.status_code == 201

        body = response.json()
        assert body["transaction"]["kind"] == "topup"
        assert body["transaction"]["price_per_gram"] == QUOTE.ask_per_gram
        assert body["account"]["gold"] > 0
        assert body["account"]["deposited"] == eur(1000)

        # Оценено по bid — веднага сме на минус точно със спреда.
        assert body["account"]["unrealised_pnl"] < 0

    def test_плащането_продава_злато(self, auth_client: TestClient) -> None:
        auth_client.post("/account/topup", json={"amount": eur(1000)})
        before = auth_client.get("/account").json()["gold"]

        response = auth_client.post(
            "/account/card-payment",
            json={"amount": eur(62.80), "merchant": "Супермаркет"},
        )
        assert response.status_code == 201

        body = response.json()
        assert body["transaction"]["gold_delta"] < 0
        assert body["transaction"]["price_per_gram"] == QUOTE.bid_per_gram
        assert body["account"]["gold"] == before + body["transaction"]["gold_delta"]
        assert body["account"]["card_volume_this_month"] == eur(62.80)

    def test_плащане_без_покритие_е_422(self, auth_client: TestClient) -> None:
        response = auth_client.post(
            "/account/card-payment", json={"amount": eur(500), "merchant": "Яхта"}
        )
        assert response.status_code == 422
        assert response.json()["code"] == "insufficient_gold"

    def test_зареждане_под_минимума_е_422(self, auth_client: TestClient) -> None:
        response = auth_client.post("/account/topup", json={"amount": 1})
        assert response.status_code == 422
        assert response.json()["code"] == "amount_too_small"

    def test_продажба_връща_златото_в_евро(self, auth_client: TestClient) -> None:
        auth_client.post("/account/topup", json={"amount": eur(1000)})
        gold = auth_client.get("/account").json()["gold"]

        response = auth_client.post("/account/sell", json={"gold": gold})
        assert response.status_code == 201
        assert response.json()["account"]["gold"] == 0

    def test_историята_е_най_новото_първо(self, auth_client: TestClient) -> None:
        auth_client.post("/account/topup", json={"amount": eur(1000)})
        auth_client.post(
            "/account/card-payment", json={"amount": eur(20), "merchant": "Кафе"}
        )

        rows = auth_client.get("/account/transactions").json()
        assert [row["kind"] for row in rows] == ["card", "topup"]
        # gold_after прави книгата проверима без пресмятане на цялата история.
        assert rows[0]["gold_after"] == auth_client.get("/account").json()["gold"]

    def test_сметките_са_изолирани_между_потребителите(
        self, auth_client: TestClient
    ) -> None:
        auth_client.post("/account/topup", json={"amount": eur(1000)})

        second = auth_client.post(
            "/auth/register",
            json={
                "email": "maria@example.com",
                "full_name": "Мария Георгиева",
                "password": "silna-parola-123",
            },
        ).json()["access_token"]

        body = auth_client.get(
            "/account", headers={"Authorization": f"Bearer {second}"}
        ).json()
        assert body["gold"] == 0


class TestIdempotency:
    def test_повторена_заявка_не_плаща_два_пъти(self, auth_client: TestClient) -> None:
        auth_client.post("/account/topup", json={"amount": eur(1000)})
        headers = {"Idempotency-Key": "plateshtane-001"}

        first = auth_client.post(
            "/account/card-payment",
            json={"amount": eur(50), "merchant": "Лидл"},
            headers=headers,
        ).json()
        second = auth_client.post(
            "/account/card-payment",
            json={"amount": eur(50), "merchant": "Лидл"},
            headers=headers,
        ).json()

        # Същата транзакция, а не втора.
        assert first["transaction"]["id"] == second["transaction"]["id"]
        assert len(auth_client.get("/account/transactions").json()) == 2

    def test_различен_ключ_е_ново_плащане(self, auth_client: TestClient) -> None:
        auth_client.post("/account/topup", json={"amount": eur(1000)})

        for key in ("a", "b"):
            auth_client.post(
                "/account/card-payment",
                json={"amount": eur(50), "merchant": "Лидл"},
                headers={"Idempotency-Key": key},
            )

        assert len(auth_client.get("/account/transactions").json()) == 3

    def test_без_ключ_повторението_е_ново_плащане(
        self, auth_client: TestClient
    ) -> None:
        # Без ключ сървърът няма как да различи повторение от нова покупка.
        auth_client.post("/account/topup", json={"amount": eur(1000)})
        for _ in range(2):
            auth_client.post(
                "/account/card-payment",
                json={"amount": eur(50), "merchant": "Лидл"},
            )

        assert len(auth_client.get("/account/transactions").json()) == 3
