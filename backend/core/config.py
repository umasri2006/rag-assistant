from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
from typing import List


class Settings(BaseSettings):
    anthropic_api_key: str = Field(..., env="ANTHROPIC_API_KEY")
    llm_model: str = Field("claude-3-5-sonnet-20241022", env="LLM_MODEL")
    chunk_size: int = Field(800, env="CHUNK_SIZE")
    chunk_overlap: int = Field(150, env="CHUNK_OVERLAP")
    top_k_results: int = Field(5, env="TOP_K_RESULTS")
    chroma_persist_dir: str = Field("./chroma_db", env="CHROMA_PERSIST_DIR")
    chroma_collection: str = Field("company_docs", env="CHROMA_COLLECTION")
    host: str = Field("0.0.0.0", env="HOST")
    port: int = Field(8000, env="PORT")
    cors_origins: List[str] = Field(
        default=["http://localhost:5173", "http://localhost:3000"],
        env="CORS_ORIGINS"
    )

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()