from fastapi import APIRouter, Depends

from app.auth import auth_required
from app.models import Token
from app.services.docker_service import restart_container

router = APIRouter()


@router.post("/restart/{container_name}")
def restart_container_endpoint(
    container_name: str,
    _: Token = Depends(auth_required),
):
    return restart_container(container_name)
