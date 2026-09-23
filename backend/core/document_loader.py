import os
import tempfile
from pathlib import Path
from typing import List
from langchain_core.documents import Document
from langchain_community.document_loaders import PyPDFLoader, TextLoader

SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md", ".markdown"}


def load_pdf(file_path: str, source_name: str) -> List[Document]:
    loader = PyPDFLoader(file_path)
    pages = loader.load()
    total_pages = len(pages)
    for page in pages:
        page.metadata.update({
            "source": source_name,
            "file_type": "pdf",
            "total_pages": total_pages,
        })
    return pages


def load_text(file_path: str, source_name: str, file_type: str = "txt") -> List[Document]:
    loader = TextLoader(file_path, encoding="utf-8")
    docs = loader.load()
    for doc in docs:
        doc.metadata.update({
            "source": source_name,
            "file_type": file_type,
        })
    return docs


def load_from_bytes(file_bytes: bytes, filename: str) -> List[Document]:
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file type '{ext}'.")

    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        if ext == ".pdf":
            docs = load_pdf(tmp_path, source_name=filename)
        elif ext in {".md", ".markdown"}:
            docs = load_text(tmp_path, source_name=filename, file_type="markdown")
        else:
            docs = load_text(tmp_path, source_name=filename, file_type="txt")
    finally:
        os.unlink(tmp_path)

    return docs


def load_from_directory(directory: str) -> List[Document]:
    all_docs: List[Document] = []
    for root, _, files in os.walk(directory):
        for fname in files:
            ext = Path(fname).suffix.lower()
            if ext not in SUPPORTED_EXTENSIONS:
                continue
            full_path = os.path.join(root, fname)
            try:
                with open(full_path, "rb") as f:
                    content = f.read()
                docs = load_from_bytes(content, fname)
                all_docs.extend(docs)
                print(f"  Loaded: {fname} ({len(docs)} page(s))")
            except Exception as e:
                print(f"  Skipped {fname}: {e}")
    return all_docs