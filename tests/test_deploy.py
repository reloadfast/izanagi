def test_deploy_new_template(client, auth_headers, tmp_path):
    resp = client.post(
        "/api/deploy",
        json={"template_name": "myapp", "xml_content": "<Container></Container>"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["action"] == "created"
    assert data["template_name"] == "myapp"


def test_deploy_overwrite_template(client, auth_headers):
    client.post(
        "/api/deploy",
        json={"template_name": "myapp", "xml_content": "<v1/>"},
        headers=auth_headers,
    )
    resp = client.post(
        "/api/deploy",
        json={"template_name": "myapp", "xml_content": "<v2/>"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["action"] == "updated"


def test_deploy_records_history(client, auth_headers):
    client.post(
        "/api/deploy",
        json={"template_name": "histtest", "xml_content": "<x/>"},
        headers=auth_headers,
    )
    hist = client.get("/api/history", headers=auth_headers).json()
    assert any(h["template_name"] == "histtest" for h in hist)


def test_deploy_invalid_template_name(client, auth_headers):
    resp = client.post(
        "/api/deploy",
        json={"template_name": "../../etc/passwd", "xml_content": "<x/>"},
        headers=auth_headers,
    )
    # Either succeeds with sanitized name or returns 500 for empty safe name
    # The key is it must not path-traverse
    if resp.status_code == 200:
        assert resp.json()["template_name"] not in ("../../etc/passwd",)
    else:
        assert resp.status_code == 500


def test_deploy_requires_auth(client):
    resp = client.post(
        "/api/deploy",
        json={"template_name": "myapp", "xml_content": "<x/>"},
    )
    assert resp.status_code == 403


def test_deploy_writes_file(client, auth_headers, tmp_path):
    resp = client.post(
        "/api/deploy",
        json={"template_name": "filecheck", "xml_content": "<Root/>"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    written = (tmp_path / "templates" / "filecheck.xml").read_text()
    assert "<Root/>" in written
