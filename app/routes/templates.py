import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.auth import auth_required
from app.db import get_session
from app.models import DeployHistory, Token
from app.services.template_service import delete_template_file, list_templates, read_template

router = APIRouter()


@router.get("/templates")
def get_templates(
    _: Token = Depends(auth_required),
):
    templates_path = os.getenv("IZANAGI_TEMPLATES_PATH", "/templates")
    templates = list_templates(templates_path)
    return [
        {
            "name": t["name"],
            "size_bytes": t["size_bytes"],
            "modified_at": datetime.fromtimestamp(t["modified_at"], tz=timezone.utc).isoformat(),
        }
        for t in templates
    ]


@router.get("/templates/{template_name}")
def get_template(
    template_name: str,
    _: Token = Depends(auth_required),
):
    templates_path = os.getenv("IZANAGI_TEMPLATES_PATH", "/templates")
    content = read_template(templates_path, template_name)
    if content is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_name}' not found")
    return {"template_name": template_name, "xml_content": content}


@router.delete("/templates/{template_name}")
def remove_template(
    template_name: str,
    token: Token = Depends(auth_required),
    db: Session = Depends(get_session),
):
    templates_path = os.getenv("IZANAGI_TEMPLATES_PATH", "/templates")
    deleted = delete_template_file(templates_path, template_name)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Template '{template_name}' not found")

    record = DeployHistory(
        timestamp=datetime.now(timezone.utc),
        template_name=template_name,
        agent_name=token.agent_name,
        action="deleted",
        outcome="success",
    )
    db.add(record)
    db.commit()

    return {"status": "deleted", "template_name": template_name}
