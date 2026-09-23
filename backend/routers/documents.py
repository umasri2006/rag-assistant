from fastapi import APIRouter, UploadFile, File, HTTPException, status
from typing import List
from pathlib import Path
from core.document_loader import load_from_bytes, SUPPORTED_EXTENSIONS
from core.vector_store import ingest_documents, list_ingested_sources, delete_source
from models.schemas import IngestResponse, DocumentSource, DeleteResponse

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(file: UploadFile = File(...)):
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 50MB.")
    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=415, detail=f"Unsupported file type '{ext}'.")
    try:
        docs = load_from_bytes(content, file.filename)
        result = ingest_documents(docs)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    return IngestResponse(message=f"Successfully ingested '{file.filename}'", filename=file.filename, **result)


@router.get("/", response_model=List[DocumentSource])
async def list_documents():
    return list_ingested_sources()


@router.delete("/{source_name}", response_model=DeleteResponse)
async def delete_document(source_name: str):
    try:
        deleted = delete_source(source_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if deleted == 0:
        raise HTTPException(status_code=404, detail=f"No document found with source '{source_name}'")
    return DeleteResponse(message=f"Deleted {deleted} chunks", source=source_name, deleted_chunks=deleted)