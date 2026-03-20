def test_create_token(client, auth_headers):
    resp = client.post(
        "/api/tokens",
        json={"agent_name": "Claude Code"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert data["agent_name"] == "Claude Code"
    assert "id" in data


def test_list_tokens(client, auth_headers):
    client.post("/api/tokens", json={"agent_name": "Agent1"}, headers=auth_headers)
    resp = client.get("/api/tokens", headers=auth_headers)
    assert resp.status_code == 200
    tokens = resp.json()
    assert len(tokens) >= 1
    for t in tokens:
        assert "token" not in t
        assert "agent_name" in t
        assert "created_at" in t


def test_revoke_token(client, auth_headers):
    create_resp = client.post(
        "/api/tokens", json={"agent_name": "ToRevoke"}, headers=auth_headers
    )
    token_id = create_resp.json()["id"]
    resp = client.delete(f"/api/tokens/{token_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "revoked"


def test_revoke_nonexistent_token(client, auth_headers):
    resp = client.delete("/api/tokens/9999", headers=auth_headers)
    assert resp.status_code == 404


def test_token_required(client):
    resp = client.get("/api/tokens")
    assert resp.status_code in (401, 403)


def test_invalid_token_rejected(client):
    resp = client.get(
        "/api/tokens", headers={"Authorization": "Bearer invalid-garbage"}
    )
    assert resp.status_code == 401


def test_created_token_works(client, auth_headers):
    create_resp = client.post(
        "/api/tokens", json={"agent_name": "NewAgent"}, headers=auth_headers
    )
    raw_token = create_resp.json()["token"]
    resp = client.get(
        "/api/tokens", headers={"Authorization": f"Bearer {raw_token}"}
    )
    assert resp.status_code == 200
