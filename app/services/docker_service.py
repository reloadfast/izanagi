import os

import docker
from docker.errors import DockerException, NotFound

DOCKER_SOCKET = os.getenv("DOCKER_SOCKET", "/var/run/docker.sock")


def get_docker_client() -> docker.DockerClient:
    return docker.DockerClient(base_url=f"unix://{DOCKER_SOCKET}")


def restart_container(container_name: str) -> dict:
    try:
        client = get_docker_client()
        container = client.containers.get(container_name)
        container.restart()
        return {"status": "restarted", "container_name": container_name}
    except NotFound:
        return {
            "status": "manual_recreate_required",
            "container_name": container_name,
            "reason": "Container not found",
        }
    except DockerException as exc:
        return {
            "status": "manual_recreate_required",
            "container_name": container_name,
            "reason": str(exc),
        }
    except Exception as exc:
        return {
            "status": "manual_recreate_required",
            "container_name": container_name,
            "reason": str(exc),
        }
