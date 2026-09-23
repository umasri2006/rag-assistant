from datetime import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import get_settings
from core.vector_store import collection_stats
from models.schemas import HealthResponse, CollectionStats
from routers import documents, query

settings = get_settings()

app = FastAPI(title="RAG Knowledge Assistant", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(query.router)


@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health():
    stats = collection_stats()
    return HealthResponse(
        status="ok",
        model=settings.llm_model,
        embedding_model=settings.embedding_model,
        collection_stats=CollectionStats(**stats),
        timestamp=datetime.utcnow().isoformat() + "Z",
    )


@app.get("/")
async def root():
    return {"name": "RAG Knowledge Assistant", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)