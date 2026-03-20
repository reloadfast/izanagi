from fastapi import APIRouter, Depends

from app.auth import auth_required
from app.models import Token

router = APIRouter()


@router.get("/me")
def get_me(token: Token = Depends(auth_required)):
    return {
        "agent_name": token.agent_name,
        "created_at": token.created_at.isoformat() if token.id != -1 else None,
        "last_used_at": token.last_used_at.isoformat() if token.last_used_at else None,
    }
