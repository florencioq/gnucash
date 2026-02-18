from __future__ import annotations

from app.config import settings


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_auth_register_login_me_refresh_flow(client):
    register = client.post(
        "/auth/register",
        json={
            "email": "  USER@Example.com ",
            "password": "12345678",
            "full_name": "User Test",
        },
    )
    assert register.status_code == 201, register.text
    user = register.json()
    assert user["email"] == "user@example.com"
    assert user["full_name"] == "User Test"

    duplicate = client.post(
        "/auth/register",
        json={"email": "user@example.com", "password": "12345678"},
    )
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["code"] == "USER_EMAIL_EXISTS"

    invalid_login = client.post(
        "/auth/login",
        json={"email": "user@example.com", "password": "wrong-password"},
    )
    assert invalid_login.status_code == 401, invalid_login.text
    assert invalid_login.json()["code"] == "INVALID_CREDENTIALS"

    login = client.post(
        "/auth/login",
        json={"email": "USER@example.com", "password": "12345678"},
    )
    assert login.status_code == 200, login.text
    tokens = login.json()
    assert tokens["token_type"] == "bearer"
    assert tokens["expires_in"] > 0
    assert tokens["access_token"]
    assert tokens["refresh_token"]

    me = client.get("/auth/me", headers=_bearer(tokens["access_token"]))
    assert me.status_code == 200, me.text
    me_payload = me.json()
    assert me_payload["id"] == user["id"]
    assert me_payload["email"] == "user@example.com"

    refreshed = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refreshed.status_code == 200, refreshed.text
    refreshed_payload = refreshed.json()
    assert refreshed_payload["access_token"]
    assert refreshed_payload["refresh_token"]
    assert refreshed_payload["token_type"] == "bearer"

    invalid_refresh = client.post("/auth/refresh", json={"refresh_token": tokens["access_token"]})
    assert invalid_refresh.status_code == 401, invalid_refresh.text
    assert invalid_refresh.json()["code"] == "INVALID_TOKEN"


def test_auth_required_blocks_protected_routes_without_token(client, monkeypatch):
    monkeypatch.setattr(settings, "auth_required", True)

    blocked = client.get("/books")
    assert blocked.status_code == 401, blocked.text
    assert blocked.json()["code"] == "AUTH_REQUIRED"

    registered = client.post(
        "/auth/register",
        json={"email": "auth-required@example.com", "password": "12345678"},
    )
    assert registered.status_code == 201, registered.text

    login = client.post(
        "/auth/login",
        json={"email": "auth-required@example.com", "password": "12345678"},
    )
    assert login.status_code == 200, login.text
    access_token = login.json()["access_token"]

    allowed = client.get("/books", headers=_bearer(access_token))
    assert allowed.status_code == 200, allowed.text

    invalid = client.get("/books", headers=_bearer("invalid-token"))
    assert invalid.status_code == 401, invalid.text
    assert invalid.json()["code"] == "INVALID_TOKEN"
