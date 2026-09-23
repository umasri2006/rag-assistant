from pydantic import BaseModel, Field
from typing import List, Optional


class Citation(BaseModel):
    source: str
    page: Optional[int] = None
    file_type: str
    snippet: str


class QuestionRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    k: Optional[int] = Field(None, ge=1, le=20)


class AnswerResponse(BaseModel):
    answer: str
    citations: List[Citation]
    chunks_used: int
    question: str


class DocumentSource(BaseModel):
    source: str
    file_type: str
    total_pages: Optional[int] = None


class IngestResponse(BaseModel):
    message: str
    filename: str
    source_docs: int
    chunks_created: int
    collection: str


class DeleteResponse(BaseModel):
    message: str
    source: str
    deleted_chunks: int


class CollectionStats(BaseModel):
    total_chunks: int
    collection: str
    persist_dir: str


class HealthResponse(BaseModel):
    status: str
    model: str
    embedding_model: str
    collection_stats: CollectionStats
    timestamp: str