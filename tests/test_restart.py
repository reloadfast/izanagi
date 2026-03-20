from unittest.mock import MagicMock, patch

import docker.errors


def test_restart_success(client, auth_headers):
    mock_container = MagicMock()
    with patch("app.services.docker_service.get_docker_client") as mock_get:
        mock_get.return_value.containers.get.return_value = mock_container
        resp = client.post("/api/restart/mycontainer", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "restarted"
    assert data["container_name"] == "mycontainer"
    mock_container.restart.assert_called_once()


def test_restart_container_not_found(client, auth_headers):
    with patch("app.services.docker_service.get_docker_client") as mock_get:
        mock_get.return_value.containers.get.side_effect = docker.errors.NotFound(
            "not found"
        )
        resp = client.post("/api/restart/missing", headers=auth_headers)

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "manual_recreate_required"
    assert data["container_name"] == "missing"
    assert "reason" in data


def test_restart_docker_exception(client, auth_headers):
    with patch("app.services.docker_service.get_docker_client") as mock_get:
        mock_get.return_value.containers.get.side_effect = (
            docker.errors.DockerException("daemon error")
        )
        resp = client.post("/api/restart/broken", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["status"] == "manual_recreate_required"


def test_restart_socket_unavailable(client, auth_headers):
    with patch(
        "app.services.docker_service.get_docker_client",
        side_effect=Exception("socket not found"),
    ):
        resp = client.post("/api/restart/any", headers=auth_headers)

    assert resp.status_code == 200
    assert resp.json()["status"] == "manual_recreate_required"


def test_restart_requires_auth(client):
    resp = client.post("/api/restart/mycontainer")
    assert resp.status_code == 403
