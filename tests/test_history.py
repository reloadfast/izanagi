def test_history_empty(client, auth_headers):
    resp = client.get("/api/history", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_history_after_deploy(client, auth_headers):
    client.post(
        "/api/deploy",
        json={"template_name": "histapp", "xml_content": "<Container/>"},
        headers=auth_headers,
    )
    resp = client.get("/api/history", headers=auth_headers)
    data = resp.json()
    assert len(data) == 1
    entry = data[0]
    assert entry["template_name"] == "histapp"
    assert entry["outcome"] == "success"
    assert entry["action"] == "created"
    assert entry["agent_name"] == "Bootstrap"
    assert "timestamp" in entry


def test_history_records_update(client, auth_headers):
    for _ in range(2):
        client.post(
            "/api/deploy",
            json={"template_name": "repeated", "xml_content": "<Container/>"},
            headers=auth_headers,
        )
    resp = client.get("/api/history", headers=auth_headers)
    data = resp.json()
    assert len(data) == 2
    actions = {h["action"] for h in data}
    assert "created" in actions
    assert "updated" in actions


def test_history_requires_auth(client):
    resp = client.get("/api/history")
    assert resp.status_code in (401, 403)


def test_history_limit(client, auth_headers):
    for i in range(5):
        client.post(
            "/api/deploy",
            json={"template_name": f"app{i}", "xml_content": "<Container/>"},
            headers=auth_headers,
        )
    resp = client.get("/api/history?limit=3", headers=auth_headers)
    assert len(resp.json()) == 3
