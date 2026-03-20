from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.auth import auth_required
from app.db import get_session
from app.models import DeployHistory, Token

router = APIRouter()


@router.get("/history")
def get_history(
    limit: int = 50,
    _: Token = Depends(auth_required),
    db: Session = Depends(get_session),
):
    records = db.exec(
        select(DeployHistory).order_by(DeployHistory.timestamp.desc()).limit(limit)
    ).all()
    return [
        {
            "id": r.id,
            "timestamp": r.timestamp.isoformat(),
            "template_name": r.template_name,
            "agent_name": r.agent_name,
            "action": r.action,
            "outcome": r.outcome,
            "error_message": r.error_message,
        }
        for r in records
    ]
