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


def test_deploy_invalid_template_name(client, auth_headers, tmp_path):
    # "../../etc/passwd" sanitizes to "etcpasswd" — dots and slashes are stripped
    resp = client.post(
        "/api/deploy",
        json={"template_name": "../../etc/passwd", "xml_content": "<x/>"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    # File must exist at the sanitized path, not at any traversal location
    safe_file = tmp_path / "templates" / "etcpasswd.xml"
    assert safe_file.exists(), "Sanitized file should be written"
    traversal = tmp_path / "templates" / "../../etc" / "passwd"
    assert not traversal.exists(), "Path traversal must not occur"


def test_deploy_requires_auth(client):
    resp = client.post(
        "/api/deploy",
        json={"template_name": "myapp", "xml_content": "<x/>"},
    )
    assert resp.status_code in (401, 403)


def test_deploy_writes_file(client, auth_headers, tmp_path):
    resp = client.post(
        "/api/deploy",
        json={"template_name": "filecheck", "xml_content": "<Root/>"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    written = (tmp_path / "templates" / "filecheck.xml").read_text()
    assert "<Root/>" in written
