VALID_XML = "<Container><Name>TestApp</Name></Container>"


def _deploy(client, auth_headers, name, xml=VALID_XML):
    return client.post(
        "/api/deploy",
        json={"template_name": name, "xml_content": xml},
        headers=auth_headers,
    )


def test_list_templates_empty(client, auth_headers):
    resp = client.get("/api/templates", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_templates_after_deploy(client, auth_headers):
    _deploy(client, auth_headers, "myapp")
    resp = client.get("/api/templates", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "myapp"
    assert "size_bytes" in data[0]
    assert "modified_at" in data[0]


def test_list_templates_multiple(client, auth_headers):
    _deploy(client, auth_headers, "app-one")
    _deploy(client, auth_headers, "app-two")
    names = [t["name"] for t in client.get("/api/templates", headers=auth_headers).json()]
    assert "app-one" in names
    assert "app-two" in names


def test_read_template(client, auth_headers):
    _deploy(client, auth_headers, "readme")
    resp = client.get("/api/templates/readme", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["template_name"] == "readme"
    assert "<Container>" in data["xml_content"]


def test_read_template_not_found(client, auth_headers):
    resp = client.get("/api/templates/doesnotexist", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_template(client, auth_headers):
    _deploy(client, auth_headers, "todelete")
    resp = client.delete("/api/templates/todelete", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "deleted"


def test_delete_removes_from_list(client, auth_headers):
    _deploy(client, auth_headers, "gone")
    client.delete("/api/templates/gone", headers=auth_headers)
    names = [t["name"] for t in client.get("/api/templates", headers=auth_headers).json()]
    assert "gone" not in names


def test_delete_template_not_found(client, auth_headers):
    resp = client.delete("/api/templates/ghost", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_records_history(client, auth_headers):
    _deploy(client, auth_headers, "tracked")
    client.delete("/api/templates/tracked", headers=auth_headers)
    hist = client.get("/api/history", headers=auth_headers).json()
    deleted_entries = [h for h in hist if h["action"] == "deleted" and h["template_name"] == "tracked"]
    assert len(deleted_entries) == 1
    assert deleted_entries[0]["outcome"] == "success"


def test_templates_require_auth(client):
    assert client.get("/api/templates").status_code in (401, 403)
    assert client.get("/api/templates/foo").status_code in (401, 403)
    assert client.delete("/api/templates/foo").status_code in (401, 403)
