import os
import hashlib
from typing import List, Dict, Any, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from core.config import get_settings

settings = get_settings()


def _get_embeddings() -> HuggingFaceEmbeddings:
    return HuggingFaceEmbeddings(
        model_name="all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )


def _get_chroma_client() -> chromadb.PersistentClient:
    os.makedirs(settings.chroma_persist_dir, exist_ok=True)

    return chromadb.PersistentClient(
        path=settings.chroma_persist_dir,
        settings=ChromaSettings(
            anonymized_telemetry=False
        ),
    )


def get_vector_store() -> Chroma:
    client = _get_chroma_client()

    return Chroma(
        client=client,
        collection_name=settings.chroma_collection,
        embedding_function=_get_embeddings(),
    )


def ingest_documents(
    documents: List[Document],
) -> Dict[str, Any]:

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        separators=[
            "\n\n",
            "\n",
            ". ",
            " ",
            "",
        ],
    )

    chunks = splitter.split_documents(documents)

    ids = [
        hashlib.md5(
            (
                chunk.page_content
                + str(chunk.metadata)
            ).encode()
        ).hexdigest()
        for chunk in chunks
    ]

    vs = get_vector_store()

    vs.add_documents(
        documents=chunks,
        ids=ids,
    )

    return {
        "source_docs": len(documents),
        "chunks_created": len(chunks),
        "collection": settings.chroma_collection,
    }


def retrieve_relevant_chunks(
    query: str,
    k: Optional[int] = None,
    filter_metadata: Optional[Dict[str, Any]] = None,
) -> List[Document]:

    k = k or settings.top_k_results

    vs = get_vector_store()

    return vs.similarity_search(
        query,
        k=k,
        filter=filter_metadata,
    )


def list_ingested_sources() -> List[Dict[str, Any]]:
    client = _get_chroma_client()

    try:
        col = client.get_collection(
            settings.chroma_collection
        )

        result = col.get(
            include=["metadatas"]
        )

        seen = {}

        for meta in result["metadatas"]:
            src = meta.get(
                "source",
                "unknown",
            )

            if src not in seen:
                seen[src] = {
                    "source": src,
                    "file_type": meta.get(
                        "file_type",
                        "unknown",
                    ),
                    "total_pages": meta.get(
                        "total_pages"
                    ),
                }

        return list(seen.values())

    except Exception:
        return []


def delete_source(source_name: str) -> int:
    client = _get_chroma_client()

    col = client.get_collection(
        settings.chroma_collection
    )

    result = col.get(
        where={"source": source_name},
        include=["metadatas"],
    )

    ids = result["ids"]

    if ids:
        col.delete(ids=ids)

    return len(ids)


def collection_stats() -> Dict[str, Any]:
    client = _get_chroma_client()

    try:
        col = client.get_collection(
            settings.chroma_collection
        )

        return {
            "total_chunks": col.count(),
            "collection": settings.chroma_collection,
            "persist_dir": settings.chroma_persist_dir,
        }

    except Exception:
        return {
            "total_chunks": 0,
            "collection": settings.chroma_collection,
            "persist_dir": settings.chroma_persist_dir,
        }