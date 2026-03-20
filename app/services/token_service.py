import hashlib
import secrets
from datetime import datetime, timezone

from sqlmodel import Session, select

from app.models import Token


def create_token(db: Session, agent_name: str) -> tuple[Token, str]:
    raw = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()

    token = Token(
        agent_name=agent_name,
        token_hash=token_hash,
        created_at=datetime.now(timezone.utc),
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token, raw


def list_tokens(db: Session) -> list[Token]:
    return list(db.exec(select(Token)).all())


def revoke_token(db: Session, token_id: int) -> bool:
    token = db.get(Token, token_id)
    if not token:
        return False
    db.delete(token)
    db.commit()
    return True
