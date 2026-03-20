import hashlib
import os
from datetime import datetime, timezone

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from app.db import get_session
from app.models import Token

security = HTTPBearer()


def auth_required(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_session),
) -> Token:
    raw = credentials.credentials

    bootstrap = os.getenv("IZANAGI_BOOTSTRAP_TOKEN")
    if bootstrap and raw == bootstrap:
        return Token(
            id=-1,
            agent_name="Bootstrap",
            token_hash="",
            created_at=datetime.now(timezone.utc),
        )

    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    token = db.exec(select(Token).where(Token.token_hash == token_hash)).first()
    if not token:
        raise HTTPException(status_code=401, detail="Invalid or revoked token")

    token.last_used_at = datetime.now(timezone.utc)
    db.add(token)
    db.commit()
    db.refresh(token)
    return token
