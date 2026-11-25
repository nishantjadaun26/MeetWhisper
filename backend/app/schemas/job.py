from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class JobResponse(BaseModel):
    id: str
    meeting_id: str
    status: str
    progress_percent: int
    stage_message: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
