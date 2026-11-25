import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_auth_register_login_me_flow(client: AsyncClient):
    # Register
    reg_res = await client.post(
        "/api/auth/register",
        json={
            "email": "alice@meetwhisper.dev",
            "full_name": "Alice Smith",
            "password": "password123",
        },
    )
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert "access_token" in reg_data
    assert reg_data["user"]["email"] == "alice@meetwhisper.dev"
    token = reg_data["access_token"]

    # Duplicate email returns 409
    dup_res = await client.post(
        "/api/auth/register",
        json={
            "email": "alice@meetwhisper.dev",
            "full_name": "Alice Duplicate",
            "password": "password123",
        },
    )
    assert dup_res.status_code == 409

    # Protected /me with valid token
    me_res = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["full_name"] == "Alice Smith"

    # Protected /me without token returns 401
    unauth_res = await client.get("/api/auth/me")
    assert unauth_res.status_code == 401

    # Login with valid credentials
    login_res = await client.post(
        "/api/auth/login",
        json={"email": "alice@meetwhisper.dev", "password": "password123"},
    )
    assert login_res.status_code == 200
    assert "access_token" in login_res.json()

    # Login with wrong password returns 401
    bad_login = await client.post(
        "/api/auth/login",
        json={"email": "alice@meetwhisper.dev", "password": "wrongpassword"},
    )
    assert bad_login.status_code == 401


@pytest.mark.asyncio
async def test_auth_providers_and_invalid_google_token(client: AsyncClient):
    prov_res = await client.get("/api/auth/providers")
    assert prov_res.status_code == 200
    data = prov_res.json()
    assert "google_enabled" in data

    bad_google = await client.post(
        "/api/auth/google",
        json={"id_token": "invalid.google.token.payload"},
    )
    assert bad_google.status_code in (401, 502)
