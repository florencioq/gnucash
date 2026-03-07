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
    assert duplicate.status_code == 401, duplicate.text
    assert duplicate.json()["code"] == "AUTH_REQUIRED"

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

    duplicate_with_superuser = client.post(
        "/auth/register",
        json={"email": "user@example.com", "password": "12345678"},
        headers=_bearer(tokens["access_token"]),
    )
    assert duplicate_with_superuser.status_code == 409, duplicate_with_superuser.text
    assert duplicate_with_superuser.json()["code"] == "USER_EMAIL_EXISTS"

    me = client.get("/auth/me", headers=_bearer(tokens["access_token"]))
    assert me.status_code == 200, me.text
    me_payload = me.json()
    assert me_payload["id"] == user["id"]
    assert me_payload["email"] == "user@example.com"

    users_listing = client.get("/auth/users", headers=_bearer(tokens["access_token"]))
    assert users_listing.status_code == 200, users_listing.text
    users = users_listing.json()
    assert len(users) == 1
    assert users[0]["email"] == "user@example.com"

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


def test_list_users_requires_access_token(client):
    no_auth = client.get("/auth/users")
    assert no_auth.status_code == 401, no_auth.text
    assert no_auth.json()["code"] == "AUTH_REQUIRED"


def test_register_requires_superuser_after_bootstrap(client):
    bootstrap = client.post(
        "/auth/register",
        json={"email": "admin@example.com", "password": "12345678", "full_name": "Admin"},
    )
    assert bootstrap.status_code == 201, bootstrap.text
    assert bootstrap.json()["is_superuser"] is True

    no_auth = client.post(
        "/auth/register",
        json={"email": "user@example.com", "password": "12345678", "full_name": "User"},
    )
    assert no_auth.status_code == 401, no_auth.text
    assert no_auth.json()["code"] == "AUTH_REQUIRED"

    admin_login = client.post(
        "/auth/login",
        json={"email": "admin@example.com", "password": "12345678"},
    )
    assert admin_login.status_code == 200, admin_login.text
    admin_token = admin_login.json()["access_token"]

    created_by_admin = client.post(
        "/auth/register",
        json={"email": "user@example.com", "password": "12345678", "full_name": "User"},
        headers=_bearer(admin_token),
    )
    assert created_by_admin.status_code == 201, created_by_admin.text
    assert created_by_admin.json()["is_superuser"] is False


def test_change_password_requires_valid_current_password(client):
    registered = client.post(
        "/auth/register",
        json={"email": "user@example.com", "password": "12345678", "full_name": "User"},
    )
    assert registered.status_code == 201, registered.text

    login = client.post("/auth/login", json={"email": "user@example.com", "password": "12345678"})
    assert login.status_code == 200, login.text
    token = login.json()["access_token"]

    wrong_current = client.post(
        "/auth/change-password",
        json={"current_password": "wrong-password", "new_password": "87654321"},
        headers=_bearer(token),
    )
    assert wrong_current.status_code == 401, wrong_current.text
    assert wrong_current.json()["code"] == "INVALID_CREDENTIALS"

    same_password = client.post(
        "/auth/change-password",
        json={"current_password": "12345678", "new_password": "12345678"},
        headers=_bearer(token),
    )
    assert same_password.status_code == 400, same_password.text
    assert same_password.json()["code"] == "PASSWORD_REUSE"

    changed = client.post(
        "/auth/change-password",
        json={"current_password": "12345678", "new_password": "87654321"},
        headers=_bearer(token),
    )
    assert changed.status_code == 204, changed.text

    old_login = client.post("/auth/login", json={"email": "user@example.com", "password": "12345678"})
    assert old_login.status_code == 401, old_login.text
    assert old_login.json()["code"] == "INVALID_CREDENTIALS"

    new_login = client.post("/auth/login", json={"email": "user@example.com", "password": "87654321"})
    assert new_login.status_code == 200, new_login.text


def test_superuser_can_reset_other_user_password(client):
    admin = client.post(
        "/auth/register",
        json={"email": "admin@example.com", "password": "12345678", "full_name": "Admin"},
    )
    assert admin.status_code == 201, admin.text
    admin_user = admin.json()

    admin_login = client.post("/auth/login", json={"email": "admin@example.com", "password": "12345678"})
    assert admin_login.status_code == 200, admin_login.text
    admin_token = admin_login.json()["access_token"]

    user = client.post(
        "/auth/register",
        json={"email": "user@example.com", "password": "12345678", "full_name": "User"},
        headers=_bearer(admin_token),
    )
    assert user.status_code == 201, user.text
    regular_user = user.json()

    regular_login = client.post("/auth/login", json={"email": "user@example.com", "password": "12345678"})
    assert regular_login.status_code == 200, regular_login.text
    regular_token = regular_login.json()["access_token"]

    forbidden = client.post(
        f"/auth/users/{admin_user['id']}/reset-password",
        json={"new_password": "99999999"},
        headers=_bearer(regular_token),
    )
    assert forbidden.status_code == 403, forbidden.text
    assert forbidden.json()["code"] == "FORBIDDEN"

    reset = client.post(
        f"/auth/users/{regular_user['id']}/reset-password",
        json={"new_password": "87654321"},
        headers=_bearer(admin_token),
    )
    assert reset.status_code == 204, reset.text

    old_login = client.post("/auth/login", json={"email": "user@example.com", "password": "12345678"})
    assert old_login.status_code == 401, old_login.text
    assert old_login.json()["code"] == "INVALID_CREDENTIALS"

    new_login = client.post("/auth/login", json={"email": "user@example.com", "password": "87654321"})
    assert new_login.status_code == 200, new_login.text


def test_book_access_roles_and_superuser_rules(client, monkeypatch):
    monkeypatch.setattr(settings, "auth_required", True)

    admin = client.post(
        "/auth/register",
        json={"email": "admin@example.com", "password": "12345678", "full_name": "Admin"},
    )
    assert admin.status_code == 201, admin.text
    admin_user = admin.json()
    assert admin_user["is_superuser"] is True

    admin_login = client.post("/auth/login", json={"email": "admin@example.com", "password": "12345678"})
    assert admin_login.status_code == 200, admin_login.text
    admin_token = admin_login.json()["access_token"]

    created_book_a = client.post("/books", json={"name": "Book A"}, headers=_bearer(admin_token))
    assert created_book_a.status_code == 201, created_book_a.text
    book_a = created_book_a.json()["id"]

    created_book_b = client.post("/books", json={"name": "Book B"}, headers=_bearer(admin_token))
    assert created_book_b.status_code == 201, created_book_b.text
    book_b = created_book_b.json()["id"]

    created_commodity = client.post(
        "/commodities",
        json={"namespace": "CURRENCY", "mnemonic": "USD", "fullname": "US Dollar", "fraction": 100, "quote": False},
        headers=_bearer(admin_token),
    )
    assert created_commodity.status_code == 201, created_commodity.text
    commodity_id = created_commodity.json()["id"]

    root_a = client.post(
        "/accounts",
        json={
            "book_id": book_a,
            "name": "Root A",
            "type": "ROOT",
            "commodity_id": commodity_id,
            "is_placeholder": True,
        },
        headers=_bearer(admin_token),
    )
    assert root_a.status_code == 201, root_a.text

    root_b = client.post(
        "/accounts",
        json={
            "book_id": book_b,
            "name": "Root B",
            "type": "ROOT",
            "commodity_id": commodity_id,
            "is_placeholder": True,
        },
        headers=_bearer(admin_token),
    )
    assert root_b.status_code == 201, root_b.text

    regular = client.post(
        "/auth/register",
        json={"email": "user@example.com", "password": "12345678", "full_name": "User"},
        headers=_bearer(admin_token),
    )
    assert regular.status_code == 201, regular.text
    regular_user = regular.json()

    regular_login = client.post("/auth/login", json={"email": "user@example.com", "password": "12345678"})
    assert regular_login.status_code == 200, regular_login.text
    regular_token = regular_login.json()["access_token"]

    superuser_only = client.get("/auth/users", headers=_bearer(regular_token))
    assert superuser_only.status_code == 403, superuser_only.text
    assert superuser_only.json()["code"] == "FORBIDDEN"

    no_access = client.get(f"/accounts?book_id={book_a}", headers=_bearer(regular_token))
    assert no_access.status_code == 403, no_access.text
    assert no_access.json()["code"] == "FORBIDDEN_BOOK"

    grant_viewer = client.put(
        f"/auth/users/{regular_user['id']}/books/{book_a}",
        json={"role": "VIEWER"},
        headers=_bearer(admin_token),
    )
    assert grant_viewer.status_code == 200, grant_viewer.text
    assert grant_viewer.json()["role"] == "VIEWER"

    read_allowed = client.get(f"/accounts?book_id={book_a}", headers=_bearer(regular_token))
    assert read_allowed.status_code == 200, read_allowed.text

    write_blocked = client.post(
        "/accounts",
        json={
            "book_id": book_a,
            "parent_id": root_a.json()["id"],
            "name": "Cash",
            "type": "ASSET",
            "commodity_id": commodity_id,
            "is_placeholder": False,
        },
        headers=_bearer(regular_token),
    )
    assert write_blocked.status_code == 403, write_blocked.text
    assert write_blocked.json()["code"] == "FORBIDDEN_BOOK"

    grant_editor = client.put(
        f"/auth/users/{regular_user['id']}/books/{book_a}",
        json={"role": "EDITOR"},
        headers=_bearer(admin_token),
    )
    assert grant_editor.status_code == 200, grant_editor.text
    assert grant_editor.json()["role"] == "EDITOR"

    write_allowed = client.post(
        "/accounts",
        json={
            "book_id": book_a,
            "parent_id": root_a.json()["id"],
            "name": "Cash",
            "type": "ASSET",
            "commodity_id": commodity_id,
            "is_placeholder": False,
        },
        headers=_bearer(regular_token),
    )
    assert write_allowed.status_code == 201, write_allowed.text

    wrong_book = client.get(f"/accounts?book_id={book_b}", headers=_bearer(regular_token))
    assert wrong_book.status_code == 403, wrong_book.text

    cannot_create_book = client.post("/books", json={"name": "Not Allowed"}, headers=_bearer(regular_token))
    assert cannot_create_book.status_code == 403, cannot_create_book.text
