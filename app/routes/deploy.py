import os
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from app.auth import auth_required
from app.db import get_session
from app.models import DeployHistory, Token
from app.services.template_service import write_template

router = APIRouter()


class DeployRequest(BaseModel):
    template_name: str
    xml_content: str


@router.post("/deploy")
def deploy_template(
    body: DeployRequest,
    token: Token = Depends(auth_required),
    db: Session = Depends(get_session),
):
    templates_path = os.getenv("IZANAGI_TEMPLATES_PATH", "/templates")
    result = write_template(templates_path, body.template_name, body.xml_content)

    record = DeployHistory(
        timestamp=datetime.utcnow(),
        template_name=body.template_name,
        agent_name=token.agent_name,
        action=result["action"],
        outcome=result["outcome"],
        error_message=result.get("error_message"),
    )
    db.add(record)
    db.commit()

    if result["outcome"] == "error":
        raise HTTPException(
            status_code=500,
            detail=result.get("error_message", "Deploy failed"),
        )

    return {
        "status": "ok",
        "action": result["action"],
        "template_name": body.template_name,
    }
