from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from app.auth import auth_required
from app.db import get_session
from app.models import Token
from app.services.token_service import create_token, list_tokens, revoke_token

router = APIRouter()


class CreateTokenRequest(BaseModel):
    agent_name: str


@router.post("/tokens")
def create_new_token(
    body: CreateTokenRequest,
    _: Token = Depends(auth_required),
    db: Session = Depends(get_session),
):
    token, raw = create_token(db, body.agent_name)
    return {
        "id": token.id,
        "agent_name": token.agent_name,
        "token": raw,
        "created_at": token.created_at.isoformat(),
    }


@router.get("/tokens")
def get_tokens(
    _: Token = Depends(auth_required),
    db: Session = Depends(get_session),
):
    tokens = list_tokens(db)
    return [
        {
            "id": t.id,
            "agent_name": t.agent_name,
            "created_at": t.created_at.isoformat(),
            "last_used_at": t.last_used_at.isoformat() if t.last_used_at else None,
        }
        for t in tokens
    ]


@router.delete("/tokens/{token_id}")
def delete_token(
    token_id: int,
    _: Token = Depends(auth_required),
    db: Session = Depends(get_session),
):
    if not revoke_token(db, token_id):
        raise HTTPException(status_code=404, detail="Token not found")
    return {"status": "revoked"}
