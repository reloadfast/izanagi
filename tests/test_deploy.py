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
        json={"template_name": "myapp", "xml_content": "<Container><Name>v1</Name></Container>"},
        headers=auth_headers,
    )
    resp = client.post(
        "/api/deploy",
        json={"template_name": "myapp", "xml_content": "<Container><Name>v2</Name></Container>"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["action"] == "updated"


def test_deploy_records_history(client, auth_headers):
    client.post(
        "/api/deploy",
        json={"template_name": "histtest", "xml_content": "<Container/>"},
        headers=auth_headers,
    )
    hist = client.get("/api/history", headers=auth_headers).json()
    assert any(h["template_name"] == "histtest" for h in hist)


def test_deploy_invalid_template_name(client, auth_headers, tmp_path):
    # "../../etc/passwd" sanitizes to "etcpasswd" — dots and slashes are stripped
    resp = client.post(
        "/api/deploy",
        json={"template_name": "../../etc/passwd", "xml_content": "<Container/>"},
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
        json={"template_name": "filecheck", "xml_content": "<Container><Name>MyApp</Name></Container>"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    written = (tmp_path / "templates" / "filecheck.xml").read_text()
    assert "<Container>" in written
    assert "<Name>MyApp</Name>" in written


def test_deploy_rejects_malformed_xml(client, auth_headers):
    resp = client.post(
        "/api/deploy",
        json={"template_name": "bad", "xml_content": "<Container><unclosed>"},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    assert "Malformed XML" in resp.json()["detail"]


def test_deploy_rejects_wrong_root_element(client, auth_headers):
    resp = client.post(
        "/api/deploy",
        json={"template_name": "bad", "xml_content": "<NotAContainer><Name>x</Name></NotAContainer>"},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    assert "Container" in resp.json()["detail"]


def test_deploy_validation_does_not_write_file(client, auth_headers, tmp_path):
    client.post(
        "/api/deploy",
        json={"template_name": "neverwritten", "xml_content": "not xml at all"},
        headers=auth_headers,
    )
    assert not (tmp_path / "templates" / "neverwritten.xml").exists()


def test_deploy_validation_does_not_record_history(client, auth_headers):
    client.post(
        "/api/deploy",
        json={"template_name": "ghost", "xml_content": "<Wrong/>"},
        headers=auth_headers,
    )
    hist = client.get("/api/history", headers=auth_headers).json()
    assert not any(h["template_name"] == "ghost" for h in hist)
