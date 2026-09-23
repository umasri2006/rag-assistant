from typing import Optional, List, Dict

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from core.rag_chain import (
    answer_question,
    stream_answer,
)

from models.schemas import AnswerResponse


router = APIRouter(
    prefix="/query",
    tags=["Query"],
)


class QuestionRequest(BaseModel):
    question: str
    k: Optional[int] = None
    history: List[Dict] = Field(
        default_factory=list
    )
    source: Optional[str] = None


@router.post(
    "/",
    response_model=AnswerResponse,
)
async def query(
    request: QuestionRequest,
):

    try:
        result = answer_question(
            request.question,
            k=request.k,
            history=request.history,
            source=request.source,
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )

    return AnswerResponse(
        question=request.question,
        **result,
    )


@router.post("/stream")
async def query_stream(
    request: QuestionRequest,
):

    try:
        generator = stream_answer(
            request.question,
            k=request.k,
            history=request.history,
            source=request.source,
        )

        return StreamingResponse(
            generator,
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )