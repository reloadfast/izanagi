from datetime import datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


class Token(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    agent_name: str = Field(index=True)
    token_hash: str = Field(unique=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_used_at: Optional[datetime] = None


class DeployHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    template_name: str
    agent_name: str
    action: str  # "created" or "updated"
    outcome: str  # "success" or "error"
    error_message: Optional[str] = None
