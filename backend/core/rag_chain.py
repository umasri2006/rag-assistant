from typing import AsyncIterator, List, Dict, Any, Optional

from langchain_ollama import ChatOllama
from langchain_core.documents import Document
from langchain_core.messages import (
    HumanMessage,
    SystemMessage,
    AIMessage,
)

from core.config import get_settings
from core.vector_store import retrieve_relevant_chunks

settings = get_settings()


SYSTEM_PROMPT = """You are Lotus, a friendly, warm and helpful AI assistant — like a smart friend who happens to know a lot.

You have two modes:

1. CASUAL CHAT — when someone greets you, asks how you are, chats casually, or asks general questions NOT about documents, just reply naturally and warmly like a friend would.

2. DOCUMENT MODE — when someone asks about their uploaded documents, answer strictly from the document context provided and cite sources.

Personality:
- Warm, friendly and approachable
- Use casual language, contractions (I'm, you're, let's)
- Keep casual replies short and natural
- Never say "As an AI language model..."
- Never be robotic or overly formal
- Use emojis occasionally 🌿
- Your name is Lotus
"""


def _format_context(
    chunks: List[Document],
) -> str:

    parts = []

    for i, chunk in enumerate(chunks, 1):
        src = chunk.metadata.get(
            "source",
            "unknown",
        )

        page = chunk.metadata.get(
            "page",
            "",
        )

        page_str = (
            f", page {page + 1}"
            if page != ""
            else ""
        )

        parts.append(
            f"[{i}] Source: {src}{page_str}\n"
            f"{chunk.page_content.strip()}"
        )

    return "\n\n".join(parts)


def _format_citations(
    chunks: List[Document],
) -> List[Dict[str, Any]]:

    seen = set()
    citations = []

    for chunk in chunks:
        src = chunk.metadata.get(
            "source",
            "unknown",
        )

        page = chunk.metadata.get(
            "page",
            "",
        )

        key = f"{src}:{page}"

        if key not in seen:
            seen.add(key)

            citations.append({
                "source": src,
                "page": (
                    page + 1
                    if page != ""
                    else None
                ),
                "file_type": chunk.metadata.get(
                    "file_type",
                    "unknown",
                ),
                "snippet": (
                    chunk.page_content[:200]
                    .strip()
                    + "…"
                ),
            })

    return citations


def _get_llm() -> ChatOllama:
    return ChatOllama(
        model="llama3.2",
        base_url="http://localhost:11434",
        temperature=0.7,
    )


def _build_messages(
    question: str,
    history: List[Dict],
    context: Optional[str] = None,
) -> list:

    messages = [
        SystemMessage(
            content=SYSTEM_PROMPT
        )
    ]

    for turn in history:
        if turn["role"] == "user":
            messages.append(
                HumanMessage(
                    content=turn["content"]
                )
            )

        elif turn["role"] == "assistant":
            messages.append(
                AIMessage(
                    content=turn["content"]
                )
            )

    if context:
        user_msg = f"""Here is context from my documents — please answer based on this:

CONTEXT:
{context}

─────────────────────────────────────────
MY QUESTION: {question}

Answer using the context above and cite sources inline like [Source: filename]."""

    else:
        user_msg = question

    messages.append(
        HumanMessage(
            content=user_msg
        )
    )

    return messages


def answer_question(
    question: str,
    k: Optional[int] = None,
    history: Optional[List[Dict]] = None,
    source: Optional[str] = None,
) -> Dict[str, Any]:

    history = history or []

    llm = _get_llm()

    filter_metadata = None

    if source:
        filter_metadata = {
            "source": source
        }

    chunks = retrieve_relevant_chunks(
        question,
        k=k,
        filter_metadata=filter_metadata,
    )

    if chunks:
        context = _format_context(chunks)
        citations = _format_citations(chunks)
    else:
        context = None
        citations = []

    messages = _build_messages(
        question,
        history,
        context,
    )

    response = llm.invoke(messages)

    return {
        "answer": response.content,
        "citations": citations,
        "chunks_used": len(chunks),
    }


async def stream_answer(
    question: str,
    k: Optional[int] = None,
    history: Optional[List[Dict]] = None,
    source: Optional[str] = None,
) -> AsyncIterator[str]:

    import json

    history = history or []

    llm = _get_llm()

    filter_metadata = None

    if source:
        filter_metadata = {
            "source": source
        }

    chunks = retrieve_relevant_chunks(
        question,
        k=k,
        filter_metadata=filter_metadata,
    )

    if chunks:
        context = _format_context(chunks)
        citations = _format_citations(chunks)
    else:
        context = None
        citations = []

    yield (
        "data: "
        + json.dumps({
            "type": "citations",
            "citations": citations,
            "chunks_used": len(chunks),
        })
        + "\n\n"
    )

    messages = _build_messages(
        question,
        history,
        context,
    )

    async for token in llm.astream(messages):

        if token.content:
            yield (
                "data: "
                + json.dumps({
                    "type": "token",
                    "content": token.content,
                })
                + "\n\n"
            )

    yield (
        "data: "
        + json.dumps({
            "type": "done"
        })
        + "\n\n"
    )