"""POST /api/chat - talk to the Veda Assistant (Ayurvedic RAG chatbot)."""

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.ayurveda_rag import assistant

router = APIRouter(prefix="/api", tags=["Veda Assistant"])
logger = logging.getLogger(__name__)


class Turn(BaseModel):
    user: str = Field(..., max_length=2000)
    bot: str = Field(..., max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000)
    history: list[Turn] = Field(default=[], max_length=20)
    language: str = Field(default="English", max_length=30)
    # Short summary of the user's latest lab report (sent by the Node server),
    # so advice combines symptoms + report findings.
    report_context: str | None = Field(default=None, max_length=3000)


@router.post("/chat")
def chat(request: ChatRequest):
    # A normal `def` (not async) so FastAPI runs this slow AI work in a
    # background thread and the server stays responsive.
    try:
        history = [turn.model_dump() for turn in request.history[-6:]]
        return assistant.ask(request.message, history, request.language,
                             report_context=request.report_context)
    except Exception:
        logger.exception("Assistant failed")
        raise HTTPException(status_code=500, detail="The assistant could not answer right now.")
